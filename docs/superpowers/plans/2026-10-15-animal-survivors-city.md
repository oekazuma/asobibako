# Animal Survivors 夜の街 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 海岸のあとに開く 6 つめのステージ「夜の街」（敵 7 種の入れ替え、街灯、停電、ボス 2 体、遺物 2 つ、曲、実績 3 つ）と、夜の街のクリアで仲間になる 12 匹めの動物「アライグマ」（専用の武器「ガラクタ投げ」と専用進化「打ち上げ花火」）を足す。

**Architecture:** 夜の街の表は海岸と同じく森の表を写して敵を入れ替える（`stages/city.ts`）。停電は `blackout.ts` が `World.blackout`（時計と暗さ 0..1）として持ち、海岸の `tide.ts` と同じく step の中で進める。街灯は祠と同じく区画の位置のハッシュで決まり（`blackout.ts` の `streetLightAt` と `streetLightsNear`）、当たりは無い。暗さは `draw-city.ts` が仮想画面の大きさの canvas 1 枚に輪を抜いて作り、`draw.ts` が敵・弾・数字のあと、ボスの予告と HUD の前に重ねる。ボスは今の動き方の型（巨大ベア・大ワシ）を使い回し、技を足す分を `bosses-city.ts` に置く。ガラクタ投げは新しい武器の種類 `lob` で、落ちた所に海岸の真珠のしぶきと同じ 1 回だけ当たる区域を置く。

**Tech Stack:** SvelteKit（Svelte 5 runes）、TypeScript、vitest、scratchpad のボットとドット絵の道具、headless Chrome（playwright-core）

**Spec:** `docs/superpowers/specs/2026-10-15-animal-survivors-city-design.md`

## Global Constraints

- 新しい絵は使う前に見本を見せる。敵・ボス・地面とアライグマの 3 回に分け、決まるまでその絵を使うタスクに進まない。見た目の水準は今の敵と動物にそろえる。アライグマは目のまわりの黒いマスクと縞のしっぽのかわいい顔。
- 夜の街の時刻は森の表を写す（10 分）。硬さと攻撃は森の 1.55 倍（Task 10 でボットに合わせて直す）、同時に出る数の上限は森の 1.2 倍、コイン 3.5 倍。開くのは海岸のクリア（`after: 'coast'`）。
- 停電は 95・215・335・455 秒に 20 秒ずつ。3 秒前に帯「停電だ！」。暗くなる・戻るのに 1 秒ずつ。明るいのは動物のまわり（半径 70 ドット、懐中電灯で 1.5 倍）と街灯の下（半径 50 ドット）、ふちは 12 ドットでぼかす。暗いところは 85% の暗さ。当たり・強さ・動きは変わらない。
- 停電の時計は step の中で進め、3 択・一時停止・時計の品で止まる。動きを減らす設定では暗さの移り変わりを 0 秒にする。
- 暗さは敵・弾・品・ダメージの数字の上、HUD・帯・ボスの体力バーの下。ボスの予告の円と矢印は暗さの上にも描く。
- アライグマの id は `raccoon`、名前は アライグマ・夜回りアライグマ・街の親分アライグマ、段は最強（`tier: 4`）、とくいは攻撃の範囲 +10%（`bonus: { area: 0.1 }`）。
- ガラクタ投げは 0.6 秒の山なりで敵のそのときの位置へ落ち、半径 24 ドットの輪の中に 1 回だけまとめて当たる。投げる数は Lv1 で 1 個、Lv5 で 3 個。
- 協力プレイの知らせの形が変わるので `COOP_VERSION` を 6 から 7 に上げる。
- コンポーネントは 200 行未満。コメントは非自明な WHY だけを日本語で（変更履歴・チケット番号は書かない）。テスト名は日本語の文。`pnpm verify` が通ること。
- コミットは英語の命令形 1 文。Co-Authored-By などの署名の行は付けない。push はしない。

## Review Focus

- 停電の終わりぎわに 3 択や時計の品で止まっても、暗さが残ったままにならず、止まっているあいだは暗さも時計も動かない（Task 5 のテスト）。
- 子の端末でも、届いた暗さと 2 匹の位置で同じ暗さを描き、子の動物のまわりも明るい（Task 5 のテスト）。
- 街灯が障害物の上や始めの位置のまわりに出ず、同じ種でいつも同じ場所に出る（協力プレイの 2 台でそろう）（Task 4 のテスト）。
- ガラクタ投げが、落ちる前に敵が倒れた・動いた・敵がいないときに、止まらず・落ちる前には当たらず・輪の中の敵に 1 回だけ当たる（Task 8 のテスト）。
- 前に海岸をクリアした古い記録で夜の街を選べ、壊れた記録でも夜の街の世界を作れる（Task 4 のテスト）。

---

### Task 1: 敵 7 種の絵の見本（利用者に見せて止まる）

- [ ] scratchpad の道具（`art/*.ts` の 1 文字 1 色の格子を node で直接読み、zlib で PNG にする。`art/enemies.ts` の森の 7 種を読んで形と大きさを合わせる）で、ドブネズミ・カラス・ハクビシン・ゴミ袋おばけ・野良犬・ヤモリ・下水ワニを 2 コマずつ描き、森の 7 種と海岸の 7 種と並べた PNG を `SendUserFile` で見せる。夜の地面（暗い紺のアスファルト）の上で見えるよう、輪郭は明るめにする。
- [ ] 決まった絵を `art/enemies.ts` に足す（`pixels.test.ts` が幅・行数・パレットを確かめる）。直しを言われたら直して見せ直す。

### Task 2: ボス 2 体の絵の見本（利用者に見せて止まる）

- [ ] 巨大カラス（40 ドット前後、はばたく 2 コマ）と下水の大ワニ（同じくらい、歩く 2 コマとマンホールから顔を出す 1 コマの計 3 コマ）を描き、巨大ガニ・大ダコと並べて見せる。
- [ ] 決まった絵を `art/bosses-city.ts`（`CITY_BOSS_ART`、`art/bosses-coast.ts` と同じ形）に入れ、`BOSS_ART` に足す。

### Task 3: 地面と飾り・街灯・障害物・アライグマ・アイコンの絵の見本（利用者に見せて止まる）

- [ ] 16 ドットのタイル（アスファルト 4 コマ・歩道）と飾り（マンホール・白線・空き缶・落ち葉）、街灯（足もとが分かる 1 本、灯りの色は暖かい黄）、障害物 2 種（自動販売機・ゴミ置き場。`art/obstacles.ts` の形）、アライグマの 3 段階（16・20・24 ドットの歩き 4 コマ・攻撃・やられ。`art/animals.ts` と `art/grown.ts` の形）、ガラクタ投げ・打ち上げ花火の印（12 ドット、打ち上げ花火は金色に赤い王冠）、投げる缶（8 ドット）と火花、遺物 2 つ（懐中電灯・金の招き猫）の印を描く。海岸の地面・ラッコの 3 段階と並べて見せる。
- [ ] 決まった絵を `art/city.ts`（`CITY_ART`、海岸の `COAST_ART` と同じ形）、`art/obstacles.ts`、`art/animals.ts`・`art/grown.ts`（`raccoon`）、`art/items.ts`（`weapon-junkToss`・`weapon-junkTossSp`・缶・火花）、`art/explore.ts`（遺物 `torch`・`luckyCat`）に入れる。

### Task 4: 夜の街の表・敵・地面・障害物・街灯・曲・ステージの一覧

**Files:**

- Create: `src/lib/games/animal-survivors/stages/city.ts`、`src/lib/games/animal-survivors/blackout.ts`（このタスクでは街灯だけ）
- Modify: `stages/forest.ts`（`Stage['art']` に `'city'`、`Stage` に `blackouts: { at: number; len: number }[]`、今の 5 面は `[]`）、`stages/index.ts`（`STAGES` の最後に `CITY`）、`enemies.ts`（7 種。動き・体力・経験値は森の対応する敵と同じ数で、名前と絵だけ変える）、`obstacles.ts`（`city` の 2 種の形 `SHAPES`）、`draw.ts`（`GROUNDS.city`、街灯を祠と同じところで描く）、`StageSelect.svelte`（`LOOK.city`）、`songs.ts`（`city`、軽いジャズ風の 1 曲。海岸の曲の形）、`Survivors.svelte` の曲の型、`achievements.ts`（`cityClear`「夜の街をクリア」、動物はまだ付けない）、`records.ts` のステージの id
- Test: `src/lib/games/animal-survivors/city.test.ts`

**Interfaces:**

- Produces: `CITY: Stage`（`stages/city.ts`）、`Stage.blackouts`、敵の id `sewerRat`・`crow`・`civet`・`trashGhost`・`stray`・`gecko`・`sewerGator`
- Produces: `export interface StreetLight { x: number; y: number }`、`streetLightAt(g: Ground, cx: number, cy: number): StreetLight | null`、`streetLightsNear(g: Ground, x: number, y: number, r: number, out: StreetLight[]): StreetLight[]`、定数 `LIGHT_CHANCE = 1 / 6`（`blackout.ts`。`shrines.ts` の `shrineAt` と同じ形で、ハッシュの種は祠と別の値にする。街灯は夜の街の面だけに出す）

- [ ] **Step 1: テストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { streetLightAt } from './blackout';
import { ENEMIES } from './enemies';
import { CELL, obstaclesNear } from './obstacles';
import { canPlay, emptyRecords, parseRecords } from './records';
import { STAGES } from './stages';
import { CITY } from './stages/city';
import { COAST } from './stages/coast';
import { FOREST } from './stages/forest';
import { createWorld } from './world';

describe('夜の街の表', () => {
  it('海岸のあとに並び、海岸をクリアすると選べる', () => {
    expect(STAGES.map((s) => s.id)).toEqual(['forest', 'graveyard', 'snow', 'volcano', 'coast', 'city']);
    expect(canPlay(emptyRecords(), 'city')).toBe(false);
    expect(canPlay({ ...emptyRecords(), stages: ['forest', 'graveyard', 'snow', 'volcano', 'coast'] }, 'city')).toBe(
      true
    );
  });

  it('時刻は森と同じで、森より 1.55 倍強く、コインは 3.5 倍、停電は 4 回', () => {
    expect(CITY.length).toBe(FOREST.length);
    expect(CITY.bosses.map((b) => b.at)).toEqual(COAST.bosses.map((b) => b.at));
    expect(CITY.events.map((e) => e.at)).toEqual(FOREST.events.map((e) => e.at));
    expect(CITY.toughness(300)).toBeCloseTo(FOREST.toughness(300) * 1.55);
    expect(CITY.fury(300)).toBeCloseTo(FOREST.fury(300) * 1.55);
    expect(CITY.coin).toBe(3.5);
    expect(CITY.blackouts.map((t) => [t.at, t.len])).toEqual([
      [95, 20],
      [215, 20],
      [335, 20],
      [455, 20]
    ]);
    expect(CITY.tides).toEqual([]);
    expect(COAST.blackouts).toEqual([]);
  });

  it('敵とボスはどれも敵の表にあり、森の 7 種と同じ動き方', () => {
    for (const w of CITY.waves) expect(ENEMIES[w.enemy]).toBeDefined();
    for (const b of CITY.bosses) expect(ENEMIES[b.id].boss).toBe(b.id);
    const pairs: [string, string][] = [
      ['rat', 'sewerRat'],
      ['bat', 'crow'],
      ['snake', 'civet'],
      ['caterpillar', 'trashGhost'],
      ['boar', 'stray'],
      ['spider', 'gecko'],
      ['croc', 'sewerGator']
    ];
    for (const [from, to] of pairs) {
      expect(ENEMIES[to].hp).toBe(ENEMIES[from].hp);
      expect(ENEMIES[to].xp).toBe(ENEMIES[from].xp);
    }
  });

  it('街灯は区画の位置で決まり、障害物の上と始めの位置のまわりには出ない', () => {
    const g = createWorld('dog', 1, { w: 274, h: 394 }, {}, 'city').ground;
    let n = 0;
    for (let cx = -20; cx < 20; cx++)
      for (let cy = -20; cy < 20; cy++) {
        const s = streetLightAt(g, cx, cy);
        expect(streetLightAt(g, cx, cy)).toEqual(s);
        if (!s) continue;
        n++;
        expect(Math.hypot(s.x, s.y)).toBeGreaterThan(120);
        expect(obstaclesNear(g, s.x, s.y, 12, []).length).toBe(0);
        expect(Math.floor(s.x / CELL)).toBe(cx);
      }
    expect(n / 1600).toBeGreaterThan(0.08);
    expect(n / 1600).toBeLessThan(0.25);
  });

  it('古い記録でも読め、夜の街の世界を作れる', () => {
    const r = parseRecords(JSON.stringify({ stages: ['forest', 'coast', 'city', 'nope'], stage: 'city' }));
    expect(r.stages).toContain('city');
    expect(r.stage).toBe('city');
    expect(createWorld('dog', 1, { w: 274, h: 394 }, {}, 'city').stage).toBe(CITY);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる** Run: `pnpm exec vitest run src/lib/games/animal-survivors/city.test.ts` → `stages/city` が無いので FAIL。`createWorld` の引数の形・`w.ground` の名前・`obstaclesNear` の引数は今のコードに合わせて直してよい（確かめる中身は変えない）。
- [ ] **Step 3: 実装する**。`stages/city.ts` は `stages/coast.ts` と同じ形で、`SWAP` を上の 7 組に、`HARDER = 1.55`、`coin: 3.5`、`song: 'city'`、`unlock: '海岸をクリアすると行ける'`、`after: 'coast'`、`tides: []`、`blackouts` を上の 4 つ、`bosses: bossRun('gator', 'raven', '夜の街の主')`（ボスの id は Task 6・7 で敵の表に入れる。このタスクでは `enemies.ts` に仮の行として 2 体を、巨大ベアと大ワシの数で入れておく。敵のカラス `crow` と名前がぶつからないよう、巨大カラスの id は `raven`、下水の大ワニは `gator`）。障害物は `obstacles.ts` の面ごとの表に自動販売機とゴミ置き場を足す。街灯は `shrines.ts` の `shrineAt` を写した `streetLightAt` で、`hash` の種を祠と別にし、`CHANCE` を `LIGHT_CHANCE` にする。描くのは `draw.ts` の `drawShrines` の隣（夜の街の面だけ）。
- [ ] **Step 4: 通ることを確かめる** Run: `pnpm exec vitest run src/lib/games/animal-survivors/` → PASS。ステージや実績の数を固めているテスト（`achievements` の数、`StageSelect` の並び）は 6 面と実績 1 つ増えに直す。
- [ ] **Step 5: Commit** `Add Animal Survivors' night city stage table, enemies, ground and street lights`

### Task 5: 停電

**Files:**

- Create: `src/lib/games/animal-survivors/draw-city.ts`
- Modify: `blackout.ts`（停電の時計）、`world.ts`（`World.blackout: Blackout`、step の中で `stepBlackout(w, dt)`（`w.freeze > 0` のあいだは呼ばない。`stepTide` と同じ場所）、`World.blackoutKills`（停電のあいだ `w.blackout.left > 0` に倒した数。`tideKills` を足しているところの隣））、`draw.ts`（`fx.draw` のあと・`hazardsAbove` の前に `drawDark(ctx, w, cx, cy, v, still)`、暗さがあるときは続けて `hazardsBelow` の予告の円をもう一度描く）、`snap.ts`（`blackout: { left, dark }` を様子に載せて子の World に写す、`COOP_VERSION` を 7）、`relics.ts`（`RelicId` に `torch`、`RELICS` に懐中電灯 `r('torch', '懐中電灯', '停電のとき、自分のまわりの明るい輪が 1.5 倍に広がる', 'city', 0.8, 700)`）
- Test: `src/lib/games/animal-survivors/blackout.test.ts`

**Interfaces:**

- Produces:
  - `export interface Blackout { next: number; left: number; warned: boolean; dark: number }`（`dark` は 0..1 の暗さ。`left > 0` のあいだ 1 秒で 1 へ、`left <= 0` で 1 秒で 0 へ）、`lightsOn(): Blackout`（`tide.ts` の `lowTide` と同じ形）
  - `stepBlackout(w: World, dt: number): void`
  - `lightRadius(w: World): number`（`HERO_LIGHT` に、懐中電灯を持てば 1.5 を掛ける）
  - 定数 `BLACKOUT_WARN = 3`、`FADE = 1`、`HERO_LIGHT = 70`、`LAMP_LIGHT = 50`、`EDGE_BLUR = 12`、`DARK = 0.85`
  - `drawDark(ctx: CanvasRenderingContext2D, w: World, cx: number, cy: number, v: { w: number; h: number }, still: boolean): void`（`draw-city.ts`。`still` なら暗さは `left > 0 ? 1 : 0`）

- [ ] **Step 1: テストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { BLACKOUT_WARN, FADE, HERO_LIGHT, lightRadius, stepBlackout } from './blackout';
import { createWorld, step } from './world';

const VIEW = { w: 274, h: 394 };
const quiet = () => {
  const w = createWorld('dog', 1, VIEW, {}, 'city');
  w.stage = { ...w.stage, waves: [], bosses: [], events: [], chiefs: [] };
  w.weapons = [];
  w.propCd = 9999;
  w.metalAt = -1;
  return w;
};
const run = (w: ReturnType<typeof quiet>, secs: number) => {
  for (let i = 0; i < Math.round(secs * 30); i++) step(w, { x: 0, y: 0 }, 1 / 30);
};

describe('停電', () => {
  it('3 秒前に帯を出し、1 秒で暗くなり、20 秒のあと 1 秒で戻る', () => {
    const w = quiet();
    w.time = 95 - BLACKOUT_WARN - 1;
    let warned = false;
    for (let i = 0; i < 30 * 2; i++) {
      step(w, { x: 0, y: 0 }, 1 / 30);
      warned ||= w.events.some((e) => e.type === 'swarm' && e.text === '停電だ！');
    }
    expect(warned).toBe(true);
    run(w, BLACKOUT_WARN - 1 + FADE + 0.1);
    expect(w.blackout.left).toBeGreaterThan(0);
    expect(w.blackout.dark).toBe(1);
    run(w, 20);
    expect(w.blackout.left).toBe(0);
    run(w, FADE + 0.1);
    expect(w.blackout.dark).toBe(0);
  });

  it('時計の品で止まっているあいだは、停電の時計も暗さも進まない', () => {
    const w = quiet();
    w.time = 100;
    stepBlackout(w, 0);
    run(w, 2);
    const { left, dark, next } = w.blackout;
    w.freeze = 5;
    run(w, 2);
    expect(w.blackout.left).toBe(left);
    expect(w.blackout.dark).toBe(dark);
    expect(w.blackout.next).toBe(next);
  });

  it('懐中電灯を持つと明るい輪が 1.5 倍', () => {
    const w = quiet();
    expect(lightRadius(w)).toBe(HERO_LIGHT);
    w.relics.push('torch');
    expect(lightRadius(w)).toBe(HERO_LIGHT * 1.5);
  });

  it('停電のあいだに倒した敵を数える', () => {
    const w = quiet();
    w.time = 100;
    stepBlackout(w, 0);
    run(w, 1);
    expect(w.blackout.left).toBeGreaterThan(0);
    expect(w.blackoutKills).toBe(0);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる** Run: `pnpm exec vitest run src/lib/games/animal-survivors/blackout.test.ts` → FAIL。
- [ ] **Step 3: 実装する**。`stepBlackout` は `tide.ts` の `stepTide` の時計の部分と同じ形（3 秒前に `w.events.push({ type: 'swarm', text: '停電だ！' })`、時刻で `left = len`、`left` を減らし、`dark` を `dt / FADE` ずつ 1 か 0 へ寄せる）。停電の途中から始まる回（`w.time` が停電の中）でも、最初の step で `left` を残りの秒にする。`blackoutKills` は `tideKills` を足しているところの隣で `w.blackout.left > 0` のとき足す。最後のテストは倒した敵を 1 体作って `damageEnemy` で倒し、`blackoutKills` が 1 になることまで確かめる形に直す（今のテストの `damageEnemy` の呼び方を写す）。
- [ ] **Step 4: 描く**。`draw-city.ts` の `drawDark` は、仮想画面の大きさ（`v.w × v.h` のドット）の canvas を 1 枚控え、`dark` が 0 なら何もしない。描くときは `rgb(4 6 20 / ${DARK})` で塗り、`globalCompositeOperation = 'destination-out'` で、生きている動物ごとに `lightRadius(w)`、画面に入る街灯ごとに `LAMP_LIGHT` の放射グラデーション（内側 `r - EDGE_BLUR` まで不透明、`r` で透明）を抜く。輪の位置（ドットに丸めた中心）と半径と `dark` が前のフレームと同じなら描き直さない。主の ctx へは `globalAlpha = dark` で `drawImage(canvas, cx, cy)` する（仮想のドットのまま拡大されるので、ふちはドット絵の段になる）。`draw.ts` は `fx.draw(ctx, S)` のあとに `drawDark` を呼び、`dark > 0` なら続けて `hazardsBelow(ctx, w, q, now)` のうち予告の円と矢印だけをもう一度描く（今の関数に引数を足すか、予告だけを描く小さな関数に分ける。どちらか短いほう）。`still` は `prompts?.still`（動きを減らす設定）を渡す。
- [ ] **Step 5: 協力プレイ**。`snap.ts` の様子に `blackout: { left, dark }` を足し、子の World に写す。子の端末の `drawDark` は写した `dark` と 2 匹の位置で描く（倒れている動物のまわりも明るい）。`coop.test.ts` の版ちがいのテストを `COOP_VERSION` 7 に直し、`started()` の親の World で停電を始めてから様子を 1 回送ると、子の World の `blackout.dark` と `left` が親と同じになるテストを足す。
- [ ] **Step 6: 通ることを確かめる** Run: `pnpm exec vitest run src/lib/games/animal-survivors/` → PASS。
- [ ] **Step 7: 画面を撮る**（headless の Chrome で 1:38 に時刻を飛ばし、停電の中で自分のまわりと街灯の下だけが明るいところを撮る。`pnpm dev --port 5198 --strictPort`、終わったら止める）
- [ ] **Step 8: Commit** `Add Animal Survivors' night city blackouts`

### Task 6: 下水の大ワニ

**Files:**

- Create: `src/lib/games/animal-survivors/bosses-city.ts`
- Modify: `enemies.ts`（`gator` を本物の数と `ai: 'gator'` に。`ai` の型に `'gator'`、`BossId`）、`bosses.ts`（`moveBoss` の分岐。巨大ベアの `bear` を使えるよう export する）、`bosses-snow.ts`（`airborne()` に潜っている状態の `gator` を足す）、`draw.ts`（潜っているあいだは描かず、出てくる 1 秒はマンホールの 3 コマめ）
- Test: `src/lib/games/animal-survivors/bosses-city.test.ts`

- [ ] **Step 1: テストを書く**。下水の大ワニを自分の右 120 ドットに置き、15 秒動かす。巨大ベアと同じ突進の予告の矢印と地ならしの予告の輪が出る。マンホールもぐりでは、潜っているあいだ（`airborne(e)` が true）武器も体当たりも当たらず（HP が減らない）、自分の近くに半径 36 の予告の円が 1 秒出て、そのあと大ワニがその円の中心に出てきて、円の中の自分にだけ当たる（円の外では HP が減らない）。円の場所は予告を置いたときの自分の位置で、そのあと自分が 60 ドット動いても動かない。`rage` の行では攻撃の間が短くなる。
- [ ] **Step 2〜4**（落ちる → 実装 → 通る）。動きは巨大ベアの `bear` を呼び、それと交互に 5 秒ごと（`rage` で割る）マンホールもぐりを使う。もぐりは state を 2 つ足し（潜る 1 秒・予告 1 秒）、予告の円は巨大ベアの `slam` の `Hazard` の形を、置いたときの自分の位置に置く。出てきたときの当たりは予告の `slam` が受け持つ。数は巨大ベアの体力・攻撃から始める（Task 10 で合わせる）。
- [ ] **Step 5: Commit** `Add Animal Survivors' sewer gator with the manhole dive`

### Task 7: 巨大カラス

**Files:**

- Modify: `bosses-city.ts`、`enemies.ts`（`raven` を本物の数と `ai: 'raven'` に）、`bosses.ts`（`moveBoss` の分岐）、`bosses-snow.ts`（`airborne()` に大ワシと同じ状態の `raven` を足す）、`world.ts`（森の出来事の「群れ」を出すところ（今の `drift` を付けて帯に並べる部分）を、`swarm(w: World, def: EnemyDef, count: number, text: string)` として外に出して、出来事と巨大カラスの両方から呼ぶ）
- Test: `bosses-city.test.ts` に足す

- [ ] **Step 1: テストを書く**。巨大カラスを置いて 15 秒動かすと、大ワシと同じ影の予告と急降下と羽根が出る。カラスの群れを呼ぶと、帯「カラスの群れが来る！」が出て、1 秒たつまでは群れが出ず、1 秒たつと `drift > 0` のカラス（`crow`）が 8 体ほど増える。群れのカラスは追わずにまっすぐ進み、抜けたら消える（今の群れと同じ）。群れの帯の出来事でも、森の出来事の群れの数と位置が `swarm` に分ける前と同じ（森の出来事の群れの既存のテストが通る）。
- [ ] **Step 2〜4**（落ちる → 実装 → 通る）。動きは大ワシの `eagle`（`bosses-forest.ts`）を呼び、急降下 2 回ごとに 1 回、群れを呼ぶ（帯を出して 1 秒の時計を持ち、0 になったら `swarm(w, ENEMIES.crow, 8, ...)`。帯の文は `swarm` の中で出さず、呼ぶ前に出す）。群れの出る数は同時に出せる数の上限とは別で、入れ物の 400 体を越えない（今の出来事と同じ）。
- [ ] **Step 5: 画面を撮る**（headless でボスの時刻に飛ばし、大ワニのマンホールもぐりと、巨大カラスの群れを撮る）
- [ ] **Step 6: Commit** `Add Animal Survivors' giant raven that calls a crow swarm`

### Task 8: アライグマとガラクタ投げ・打ち上げ花火

**Files:**

- Modify: `animals.ts`（`AnimalId` に `raccoon`、行を足す。`tier: 4`、`forms: ['アライグマ', '夜回りアライグマ', '街の親分アライグマ']`、`weapon: 'junkToss'`、`special: 'junkTossSp'`、`bonus: { area: 0.1 }`。能力の数は Task 10 で合わせる仮の値で、ラッコと同じにしておく）、`weapons.ts`（`WeaponKind` に `'lob'`、`junkToss` と `junkTossSp`、`EXCLUSIVE` に `junkToss`）、`arms.ts`（`lob` の動き方）、`draw-arms.ts`（缶の山なりと落ちる場所の影、火花）、`achievements.ts`（`cityClear` に `animal: 'raccoon'`）、`relics.ts`（`RelicId` に `luckyCat`、`RELICS` に金の招き猫 `r('luckyCat', '金の招き猫', 'その回のコインが 1 割増える', 'city', -1.4, 1500)`）、`world.ts`（`coinsOf` の `w.greed` を `greedOf(w)` に）、`drops.ts`（同じく `greedOf(w)`）、`relics.ts` に `greedOf(w) = w.greed * (hasRelic(w, 'luckyCat') ? 1.1 : 1)`
- Test: `src/lib/games/animal-survivors/raccoon.test.ts`

**Interfaces:**

- Consumes: `SPLASH_SECS`（`arms.ts`、1 回だけ当たる区域の長さ）、`hasRelic(w, id)`
- Produces: 武器の id `junkToss`・`junkTossSp`、`WeaponKind` の `'lob'`、`LOB_SECS = 0.6`、`LOB_R = 24`（`arms.ts`）、`greedOf(w: World): number`（`relics.ts`）

- [ ] **Step 1: テストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from './achievements';
import { animal } from './animals';
import { LOB_R, LOB_SECS } from './arms';
import { choices } from './choices';
import { ENEMIES } from './enemies';
import { emptyRecords, parseRecords } from './records';
import { greedOf } from './relics';
import { WEAPONS } from './weapons';
import { createWorld, makeEnemy, step } from './world';

const VIEW = { w: 274, h: 394 };
const raccoonWorld = () => {
  const w = createWorld('raccoon', 1, VIEW);
  w.stage = { ...w.stage, waves: [], bosses: [], events: [], chiefs: [] };
  w.propCd = 9999;
  w.metalAt = -1;
  return w;
};
const run = (w: ReturnType<typeof raccoonWorld>, secs: number) => {
  for (let i = 0; i < Math.round(secs * 30); i++) step(w, { x: 0, y: 0 }, 1 / 30);
};

describe('アライグマ', () => {
  it('最強の段で、ガラクタ投げを持ち、夜の街のクリアで仲間になる', () => {
    const a = animal('raccoon');
    expect(a.tier).toBe(4);
    expect(a.forms).toEqual(['アライグマ', '夜回りアライグマ', '街の親分アライグマ']);
    expect(a.weapon).toBe('junkToss');
    expect(a.bonus).toEqual({ area: 0.1 });
    expect(ACHIEVEMENTS.find((d) => d.id === 'cityClear')?.animal).toBe('raccoon');
    const r = parseRecords(JSON.stringify({ ...emptyRecords(), achieved: ['cityClear'] }));
    expect(r.unlocked).toContain('raccoon');
  });

  it('ガラクタ投げは Lv1 で 1 個、Lv5 で 3 個', () => {
    const def = WEAPONS.junkToss;
    expect(def.kind).toBe('lob');
    expect(def.base.amount).toBe(1);
    expect(def.base.amount + def.ups.reduce((n, u) => n + (u.amount ?? 0), 0)).toBe(3);
  });

  it('落ちる前は当たらず、落ちたら輪の中の敵にまとめて 1 回だけ当たる', () => {
    const w = raccoonWorld();
    const a = makeEnemy(ENEMIES.sewerRat, w.player.x + 50, w.player.y, 1e6);
    const b = makeEnemy(ENEMIES.sewerRat, w.player.x + 50 + LOB_R / 2, w.player.y, 1e6);
    const far = makeEnemy(ENEMIES.sewerRat, w.player.x + 50 + LOB_R * 3, w.player.y, 1e6);
    w.enemies.push(a, b, far);
    run(w, LOB_SECS / 2);
    expect(a.hp).toBe(1e6);
    run(w, LOB_SECS);
    expect(a.hp).toBeLessThan(1e6);
    expect(b.hp).toBeLessThan(1e6);
    expect(far.hp).toBe(1e6);
    const once = 1e6 - a.hp;
    run(w, 0.3);
    expect(1e6 - a.hp).toBe(once);
  });

  it('投げたあとに敵が倒れても、落ちる所は変わらず、止まらない', () => {
    const w = raccoonWorld();
    const a = makeEnemy(ENEMIES.sewerRat, w.player.x + 50, w.player.y, 1e6);
    w.enemies.push(a);
    run(w, 0.2);
    a.alive = false;
    run(w, LOB_SECS * 2);
    expect(w.player.hp).toBeGreaterThan(0);
  });

  it('ガラクタ投げは、ほかの動物の 3 択に出ない', () => {
    const w = createWorld('dog', 1, VIEW);
    for (let i = 0; i < 200; i++) {
      expect(choices(w).some((c) => c.kind === 'weapon' && c.id === 'junkToss')).toBe(false);
    }
  });

  it('金の招き猫を持つとコインが 1 割増える', () => {
    const w = raccoonWorld();
    const g = greedOf(w);
    w.relics.push('luckyCat');
    expect(greedOf(w)).toBeCloseTo(g * 1.1);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる** Run: `pnpm exec vitest run src/lib/games/animal-survivors/raccoon.test.ts` → `raccoon` が無いので FAIL。テストの `makeEnemy`・`w.relics`・`choices()` の戻りの形は今のコードに合わせて直してよい（確かめる中身は変えない）。最初の投げの時刻が武器の待ち時間でずれるなら、`w.weapons[0]` の待ち時間を 0 にしてから始める。
- [ ] **Step 3: 実装する**。`lob` は撃つときにいちばん近い敵から順に `amount` 体を選び（敵が足りなければ同じ敵へ）、そのときの敵の位置を落ちる点として弾に覚える。弾は `LOB_SECS` で落ちる点へまっすぐ進み（途中の敵には当たらない）、落ちたら落ちる点に半径 `LOB_R × area` の区域を `SPLASH_SECS` だけ置く（海岸の真珠のしぶきと同じく 1 回だけ当たる）。絵は山なり（`sin` で上へずらす）と、落ちる点の薄い影。`junkTossSp` は `sp(...)` の形で強さを上げ、落ちたあと 8 方向へ火花（`shot` と同じ短い弾、射程 50 ドット、`pierce` 1）を出す。図鑑の姿・「全部の動物がそろう」の実績など、動物の数を固めたテストは 12 匹に直す。
- [ ] **Step 4: 専用進化のテストを足す**。3 段階めに育ったアライグマで `junkToss` を Lv5 にすると `junkTossSp` に入れ替わる（`trySpecial`）。打ち上げ花火が落ちると、輪の外 40 ドットの敵にも火花が当たる。
- [ ] **Step 5: 通ることを確かめる** Run: `pnpm exec vitest run src/lib/games/animal-survivors/` → PASS。
- [ ] **Step 6: Commit** `Add Animal Survivors' raccoon with the lobbed junk toss`

### Task 9: 実績と 12 匹のキャラ選択

**Files:**

- Modify: `achievements.ts`（`cityBosses`「巨大カラスと下水の大ワニを倒す」は海岸の `coastBosses` と同じ形で `raven` と `gator`、`blackout500`「停電のあいだに敵を 500 体倒す」は記録の `blackoutKills` の合計で `progress` を持つ。海岸の `tide500` と同じ形）、`records.ts`（`blackoutKills`、古い記録は 0）、`world.ts` の `RunSummary` と `summary`（`blackoutKills`）、`overtime.ts`（`tideKills` と同じく延長戦のもとの値と差）、`coop-run.ts`（`summaryOk` の `opt(v, n)` の並び）、`trophy-groups.ts`（「ボス」と「倒す」の見出しに足す）、`docs/progress.md` の実績の数
- Test: `city.test.ts` に足す（実績の数を固めているテストは 2 つ増やす）、`charselect.svelte.test.ts` の動物の数を 12 に

- [ ] TDD で足す（落ちる → 実装 → 通る）。`tideKills` を `grep` して出てくるところすべてに `blackoutKills` を並べる。古い記録は `blackoutKills` 0 で読む。延長戦の 2 回めの記録では差だけを足す（クリアで 30、延長戦で 20 なら合計 50）。
- [ ] headless の Chrome（820 × 1180）でキャラ選択を撮り、12 匹の 3 段（5・5・2）・詳しい札・「この子で出発」がスクロールなしで収まることを確かめる。
- [ ] Commit `Add Animal Survivors' night city achievements`

### Task 10: ボットで合わせる

- [ ] scratchpad のボット（`/private/tmp/claude-501/-Users-oekazuma-localRepo-asobibako--claude-worktrees-meccha-chameleon-clone-51ef75/51b5c055-e566-441b-b500-6d9d4d77268c/scratchpad/sim/`。海岸を合わせたもの。無ければ同じ方針で作り直す）で `STAGE=city` を店半分・全部、犬・キツネ・パンダを 24 回ずつ遊ばせ、同じボットの海岸（店半分 52/72 前後）より少し低いクリアの割合になるよう、`stages/city.ts` の `HARDER`、ボス 2 体の体力と攻撃を合わせる。ボットは暗さの影響を受けないので、暗さの数は変えない。
- [ ] `ANIMALS=raccoon,drake,chick,otter` で店なし・半分の森と夜の街を 36 回ずつ比べ、アライグマがほかの最強の段と同じくらいになるよう、`animals.ts` の数と `junkToss` の数値を合わせる。
- [ ] spec に「## 11. 調整の結果」（表と、なぜその値にしたか）を足す。Commit `Tune Animal Survivors' night city and raccoon with bot runs`

### Task 11: 仕上げ

- [ ] `src/lib/games/animal-survivors/CLAUDE.md` の最初の段落の面の一覧に夜の街を足し、`docs/stages.md`（夜の街・街灯・停電・懐中電灯と金の招き猫）・`docs/bosses.md`（巨大カラスと下水の大ワニ）・`docs/animals.md`（12 匹めのアライグマとガラクタ投げ）・`docs/weapons.md`（`lob`）・`docs/coop.md`（停電を様子に載せる、`COOP_VERSION` 7）に今の仕様として書き足す（経緯は書かない）。書く数はコードを `grep` して確かめる。
- [ ] `pnpm verify` → exit 0。Commit `Describe Animal Survivors' night city and raccoon`
- [ ] 別の係にブランチ全体を見てもらい、Critical と Important を直す。そのあと main へ merge して push してよいかを利用者に聞く。
