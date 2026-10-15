# Animal Survivors 魔法の森 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 夜の街のあとに開く 7 つめのステージ「魔法の森」（敵 7 種の入れ替え、妖精の輪、ボス 2 体、遺物 2 つ、曲、実績 3 つ）と、魔法の森のクリアで仲間になる 13 匹めの動物「ユニコーン」（専用の武器「虹のビーム」と専用進化「虹の大砲」）を足す。

**Architecture:** 魔法の森の表は夜の街と同じく森の表を写して敵を入れ替える（`stages/grove.ts`）。妖精の輪は `fairy.ts` が `World.fairy`（時計・輪・ためている秒）として持ち、夜の街の `blackout.ts` と同じく step の中で進める。輪の中に閉じ込めるのは `fairy.ts` の `holdInRing()` 1 つで決め、親の World の移動と子の端末の移動（`coop.ts` の `CoopGuest.move`）の両方が使う（海岸の `wadeFactor` と同じ形）。ボスは今の動き方の型（女王グモ・大イノシシ）を使い回し、技を足す分を `bosses-grove.ts` に置く。虹のビームは新しい武器の種類 `beam` で、当たりは `$lib/segments.ts` の `closest()` で線分と敵の距離を測る。

**Tech Stack:** SvelteKit（Svelte 5 runes）、TypeScript、vitest、scratchpad のボットとドット絵の道具、headless Chrome（playwright-core）

**Spec:** `docs/superpowers/specs/2026-10-16-animal-survivors-grove-design.md`

## Global Constraints

- 新しい絵は使う前に見本を見せる。敵・ボス・地面とユニコーンを 1 回にまとめて見せ、決まるまでその絵を使うタスクに進まない。見た目の水準は今の敵と動物にそろえる。ユニコーンは白い体にパステルのたてがみと金の角のかわいい顔。
- 魔法の森の id は `grove`。時刻は森の表を写す（10 分）。硬さと攻撃は森の 1.65 倍（Task 8 でボットに合わせて直す）、同時に出る数の上限は森の 1.2 倍、コイン 4 倍。開くのは夜の街のクリア（`after: 'city'`）。
- 妖精の輪は 95・215・335・455 秒に 1 つ現れ、帯「妖精の輪が現れた！」。半径 30 ドット、動物から 60〜120 ドット先の障害物にかからない場所、20 秒で消える。入ると 3 秒（妖精の粉で 2 秒）ためて、そのあいだ輪の中の動物は外へ出られない。満ちると輪のまわりの画面の大きさの範囲でふつうの敵（群れも）が倒れ、ヌシとボスは最大 HP の 1 割、ランタンは残る。満ちた輪は消える。月のしずくで倒れていない動物の HP が 3 割戻る。
- 妖精の輪の時計とためる時計は step の中で進め、3 択・一時停止・時計の品で止まる。動きを減らす設定では満ちたときの光の広がりを出さない。
- ユニコーンの id は `unicorn`、名前は 子どものユニコーン・虹のユニコーン・星のユニコーン、段は最強（`tier: 4`）、とくいは移動の速さ +10%（`bonus: { speed: 0.1 }`）。
- 虹のビームは長さ 120 ドット（範囲で伸びる）・太さ 8 ドット、出た瞬間に線にかかる敵へ 1 回ずつ当たり、絵は 0.25 秒。本数は Lv1 で 1 本、Lv5 で 3 本。画面の中の敵だけを狙い、空やもぐっているボスは狙わない。虹の大砲は太さ 2 倍で画面の端まで伸びる。
- 協力プレイの知らせの形が変わるので `COOP_VERSION` を 7 から 8 に上げる。
- コンポーネントは 200 行未満。コメントは非自明な WHY だけを日本語で（変更履歴・チケット番号は書かない）。テスト名は日本語の文。`pnpm verify` が通ること。
- コミットは英語の命令形 1 文。Co-Authored-By などの署名の行は付けない。push はしない。

## Review Focus

- 輪が出た時刻に動物が障害物に囲まれていて、60〜120 ドットに置ける場所が無いときも、止まらず輪を置かないか、範囲の外側の近い場所に置く（Task 3 のテスト）。
- ためているあいだに動物が倒れた・抜けた・時計の品で止まったときに、閉じ込めが残ったままにならない（Task 3 のテスト）。
- 子の端末でも、ためているあいだ子の動物が輪の外へ出られない（Task 3 のテスト）。
- 虹のビームが、敵が 1 体だけ・線の端ぎりぎり・空にいるボスだけのときに、止まらず・同じ敵に 2 回当たらず・空のボスに当たらない（Task 6 のテスト）。
- 前に夜の街をクリアした古い記録で魔法の森を選べ、壊れた記録でも魔法の森の世界を作れる（Task 2 のテスト）。

---

### Task 1: 絵の見本と取り込み（利用者に見せて止まる）

- [ ] scratchpad の道具（夜の街で使った `scratchpad/city-art/` の node の道具を新しい `scratchpad/grove-art/` に写す。`art/*.ts` の 1 文字 1 色の格子を node で直接読み、zlib で PNG にする）で次を描き、3 枚の見本の PNG（`enemies.png`・`bosses.png`・`ground-unicorn.png`）を `SendUserFile` で見せる。
  - 敵 7 種（`shroomling`・`pixie`・`vineSnake`・`gemSnail`・`thornBoar`・`hopFrog`・`stumpGhost`。森の対の大きさで 2 コマずつ）を、森・夜の街の 7 種と並べ、苔の地面の上にも置く。
  - ボス 2 体。魔女（`witch`、40 ドット前後、浮く 2 コマ）と森の大ジカ（`stag`、同じくらい、歩く 2 コマと、`draw.ts` が予告のあいだに描く 3 コマめ（角を下げたかっこう））。魔女の魔法の弾（`shot` の絵、8 ドット）。巨大カラス・下水の大ワニと並べる。
  - 16 ドットのタイル（苔 4 コマと、`dirt` の枠の花の群れ）と飾り（小さなキノコ・花・木の根・光る粒）、障害物 2 種（`shroom` 大きな光るキノコ・`runestone` 魔法の石の柱。`art/obstacles.ts` の形）、妖精の輪（輪に並んだキノコ。半径 30 に合わせる）、ユニコーンの 3 段階（16・20・24 ドットの歩き 4 コマ・攻撃・やられ。`art/animals.ts` と `art/grown.ts` の形）、虹のビームの印（12 ドット。虹の大砲は `itemArt()` が作る）、遺物 2 つ（`dust` 妖精の粉・`moon` 月のしずく）。アライグマの 3 段階と並べる。
- [ ] 直しを言われたら直して見せ直す。決まったら、夜の街と同じ入れ方で `art/enemies.ts`、新しい `art/bosses-grove.ts`（`BOSS_ART` に広げる）、新しい `art/grove.ts`（`GROVE_ART` と `FAIRY_RING_ART`）、`art/obstacles.ts`、`art/animals.ts`・`art/grown.ts`（`unicorn`）、`art/items.ts`（`weapon-rainbowBeam`）、`art/explore.ts`（`dust`・`moon`）に入れ、`pixels.test.ts` の数と格子の確かめに足す。型は入れるファイルの中だけで広げる。
- [ ] Commit `Add Animal Survivors' magic grove art`

### Task 2: 魔法の森の表・敵・地面・障害物・曲・ステージの一覧

**Files:**

- Create: `src/lib/games/animal-survivors/stages/grove.ts`
- Modify: `stages/forest.ts`（`Stage['art']` と `Stage['song']` に `'grove'`、`Stage` に `rings: { at: number; len: number }[]`、今の 6 面は `[]`）、`stages/index.ts`（`STAGES` の最後に `GROVE`）、`enemies.ts`（7 種。動き・体力・経験値は森の対応する敵と同じ数で、名前と絵だけ変える）、`obstacles.ts`（`grove` の 2 種の形 `SHAPES` と面ごとの表）、`draw.ts`（`GROUNDS.grove`）、`StageSelect.svelte`（`LOOK.grove`）、`songs.ts`（`grove`、ふしぎで明るい 1 曲。夜の街の曲の形）、`achievements.ts`（`groveClear`「魔法の森をクリア」1200 コイン、動物はまだ付けない）と `trophy-groups.ts`、`records.ts` のステージの id
- Test: `src/lib/games/animal-survivors/grove.test.ts`

**Interfaces:**

- Produces: `GROVE: Stage`（`stages/grove.ts`）、`Stage.rings`、敵の id `shroomling`・`pixie`・`vineSnake`・`gemSnail`・`thornBoar`・`hopFrog`・`stumpGhost`

- [ ] **Step 1: テストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { ENEMIES } from './enemies';
import { canPlay, emptyRecords, parseRecords } from './records';
import { STAGES } from './stages';
import { CITY } from './stages/city';
import { FOREST } from './stages/forest';
import { GROVE } from './stages/grove';
import { createWorld } from './world';

describe('魔法の森の表', () => {
  it('夜の街のあとに並び、夜の街をクリアすると選べる', () => {
    expect(STAGES.map((s) => s.id)).toEqual(['forest', 'graveyard', 'snow', 'volcano', 'coast', 'city', 'grove']);
    expect(canPlay(emptyRecords(), 'grove')).toBe(false);
    const before = ['forest', 'graveyard', 'snow', 'volcano', 'coast', 'city'];
    expect(canPlay({ ...emptyRecords(), stages: before }, 'grove')).toBe(true);
  });

  it('時刻は森と同じで、森より 1.65 倍強く、コインは 4 倍、妖精の輪は 4 回', () => {
    expect(GROVE.length).toBe(FOREST.length);
    expect(GROVE.bosses.map((b) => b.at)).toEqual(CITY.bosses.map((b) => b.at));
    expect(GROVE.events.map((e) => e.at)).toEqual(FOREST.events.map((e) => e.at));
    expect(GROVE.toughness(300)).toBeCloseTo(FOREST.toughness(300) * 1.65);
    expect(GROVE.fury(300)).toBeCloseTo(FOREST.fury(300) * 1.65);
    expect(GROVE.coin).toBe(4);
    expect(GROVE.rings.map((t) => [t.at, t.len])).toEqual([
      [95, 20],
      [215, 20],
      [335, 20],
      [455, 20]
    ]);
    expect(GROVE.blackouts).toEqual([]);
    expect(CITY.rings).toEqual([]);
  });

  it('敵とボスはどれも敵の表にあり、森の 7 種と同じ動き方', () => {
    for (const w of GROVE.waves) expect(ENEMIES[w.enemy]).toBeDefined();
    for (const b of GROVE.bosses) expect(ENEMIES[b.id].boss).toBe(b.id);
    const pairs: [string, string][] = [
      ['rat', 'shroomling'],
      ['bat', 'pixie'],
      ['snake', 'vineSnake'],
      ['caterpillar', 'gemSnail'],
      ['boar', 'thornBoar'],
      ['spider', 'hopFrog'],
      ['croc', 'stumpGhost']
    ];
    for (const [from, to] of pairs) {
      expect(ENEMIES[to].hp).toBe(ENEMIES[from].hp);
      expect(ENEMIES[to].xp).toBe(ENEMIES[from].xp);
    }
  });

  it('古い記録でも読め、魔法の森の世界を作れる', () => {
    const r = parseRecords(JSON.stringify({ stages: ['forest', 'city', 'grove', 'nope'], stage: 'grove' }));
    expect(r.stages).toContain('grove');
    expect(r.stage).toBe('grove');
    expect(createWorld('dog', 1, { w: 274, h: 394 }, {}, 'grove').stage).toBe(GROVE);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる** Run: `pnpm exec vitest run src/lib/games/animal-survivors/grove.test.ts` → `stages/grove` が無いので FAIL。`createWorld` の引数の形などは今のコードに合わせて直してよい（確かめる中身は変えない）。
- [ ] **Step 3: 実装する**。`stages/grove.ts` は `stages/city.ts` と同じ形で、`SWAP` を上の 7 組に、`HARDER = 1.65`、`coin: 4`、`song: 'grove'`、`unlock: '夜の街をクリアすると行ける'`、`after: 'city'`、`tides: []`、`blackouts: []`、`rings` を上の 4 つ、`bosses: bossRun('stag', 'witch', '魔法の森の主')`（ボスの id は Task 4・5 で本物にする。このタスクでは `enemies.ts` に仮の行として 2 体を、大イノシシと女王グモの数と `ai` で入れておく）。夜の街の配線（`grep -rn "'city'"` で出てくるところ）を全部写す。
- [ ] **Step 4: 通ることを確かめる** Run: `pnpm exec vitest run src/lib/games/animal-survivors/` → PASS。ステージや実績や図鑑の数を固めているテスト（`achievements`・`book`・`StageSelect`・各面のテストのステージの並び）は 7 面と実績 1 つ・敵 7 種・ボス 2 体の増えに直す。遺物の置き場所のテストで `grove` の遺物がまだ無いために落ちるものは、Task 3 と Task 6 で遺物が入るまで `grove` を外しておく（外したことを報告に書く）。
- [ ] **Step 5: Commit** `Add Animal Survivors' magic grove stage table, enemies and ground`

### Task 3: 妖精の輪

**Files:**

- Create: `src/lib/games/animal-survivors/fairy.ts`、`src/lib/games/animal-survivors/draw-grove.ts`
- Modify: `world.ts`（`World.fairy: Fairy`、step の中で `stepFairy(w, dt)`（`w.freeze > 0` のあいだは呼ばない。`stepBlackout` と同じ場所）、自分の移動のあと（今の `wadeFactor` を掛けている移動の式のすぐあと）に `holdInRing(w, p)`、`World.fairyKills`）、`draw.ts`（地面のあと・敵の前に `drawRing`、`fx.draw` のあとに満ちたときの光）、`draw-events.ts`（輪の矢印。宝の地図の `treasureArrow` と同じ描き方）、`snap.ts`（`fairy` を様子に載せて子の World に写す、`COOP_VERSION` を 8）、`coop.ts`（`CoopGuest.move` の移動のあとに `holdInRing(v, p)`）、`relics.ts`（`RelicId` に `dust` と `moon`、`RELICS` に `r('dust', '妖精の粉', '妖精の輪で魔力がたまる時間が 3 秒から 2 秒になる', 'grove', 0.6, 700)` と `r('moon', '月のしずく', '妖精の輪の魔力が満ちたとき、HP が 3 割戻る', 'grove', -1.9, 1500)`）
- Test: `src/lib/games/animal-survivors/fairy.test.ts`

**Interfaces:**

- Produces:
  - `export interface Ring { x: number; y: number; r: number }`
  - `export interface Fairy { next: number; left: number; ring: Ring | null; charge: number; turn: number; burst: number }`（`left` は輪が残る秒、`charge` はためた秒（0 ならためていない）、`burst` は満ちた光の残り秒）、`calmGrove(): Fairy`（`blackout.ts` の `lightsOn` と同じ形）
  - `stepFairy(w: World, dt: number): void`
  - `holdInRing(w: World, p: { x: number; y: number }): void`（ためているあいだ、輪の中にいる動物を輪の内側（半径 `r - 2`）に戻す。ためていなければ何もしない）
  - `chargeTime(w: World): number`（`CHARGE`、妖精の粉を持てば `CHARGE_DUST`）
  - 定数 `RING_R = 30`、`RING_NEAR = 60`、`RING_FAR = 120`、`RING_LIFE = 20`、`CHARGE = 3`、`CHARGE_DUST = 2`、`BOSS_CUT = 0.1`、`MOON_HEAL = 0.3`、`BURST_SECS = 0.6`

- [ ] **Step 1: テストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { CHARGE, CHARGE_DUST, RING_FAR, RING_NEAR, RING_LIFE, chargeTime, holdInRing, stepFairy } from './fairy';
import { ENEMIES } from './enemies';
import { obstaclesNear } from './obstacles';
import { createWorld, makeEnemy, step } from './world';

const VIEW = { w: 274, h: 394 };
const quiet = () => {
  const w = createWorld('dog', 1, VIEW, {}, 'grove');
  w.stage = { ...w.stage, waves: [], bosses: [], events: [], chiefs: [] };
  w.weapons = [];
  w.propCd = 9999;
  w.metalAt = -1;
  return w;
};
const run = (w: ReturnType<typeof quiet>, secs: number) => {
  for (let i = 0; i < Math.round(secs * 30); i++) step(w, { x: 0, y: 0 }, 1 / 30);
};
const appear = (w: ReturnType<typeof quiet>) => {
  w.time = 95;
  stepFairy(w, 0);
  return w.fairy.ring!;
};

describe('妖精の輪', () => {
  it('時刻に帯を出し、動物から 60〜120 ドット先の障害物の無い場所に置き、20 秒で消える', () => {
    const w = quiet();
    w.time = 94.9;
    let shown = false;
    for (let i = 0; i < 10; i++) {
      step(w, { x: 0, y: 0 }, 1 / 30);
      shown ||= w.events.some((e) => e.type === 'swarm' && e.text === '妖精の輪が現れた！');
    }
    expect(shown).toBe(true);
    const ring = w.fairy.ring!;
    const d = Math.hypot(ring.x - w.player.x, ring.y - w.player.y);
    expect(d).toBeGreaterThanOrEqual(RING_NEAR);
    expect(d).toBeLessThanOrEqual(RING_FAR);
    expect(obstaclesNear(w.ground, ring.x, ring.y, ring.r, []).length).toBe(0);
    run(w, RING_LIFE + 0.5);
    expect(w.fairy.ring).toBeNull();
  });

  it('入るとためはじめ、3 秒で満ちてふつうの敵が倒れ、ヌシとボスは 1 割、ランタンは残る', () => {
    const w = quiet();
    const ring = appear(w);
    w.player.x = ring.x;
    w.player.y = ring.y;
    const grunt = makeEnemy(ENEMIES.shroomling, ring.x + 60, ring.y, 1e6);
    const boss = makeEnemy(ENEMIES.witch, ring.x - 80, ring.y, 1000);
    w.enemies.push(grunt, boss);
    run(w, CHARGE - 0.2);
    expect(grunt.alive).toBe(true);
    run(w, 0.4);
    expect(grunt.alive).toBe(false);
    expect(boss.hp).toBeCloseTo(900, 0);
    expect(w.fairy.ring).toBeNull();
    expect(w.fairyKills).toBe(1);
  });

  it('ためているあいだは輪の外へ出られず、満ちたら出られる', () => {
    const w = quiet();
    const ring = appear(w);
    w.player.x = ring.x;
    w.player.y = ring.y;
    for (let i = 0; i < 30 * 2; i++) step(w, { x: 1, y: 0 }, 1 / 30);
    expect(Math.hypot(w.player.x - ring.x, w.player.y - ring.y)).toBeLessThanOrEqual(ring.r);
    for (let i = 0; i < 30 * 3; i++) step(w, { x: 1, y: 0 }, 1 / 30);
    expect(Math.hypot(w.player.x - ring.x, w.player.y - ring.y)).toBeGreaterThan(ring.r);
  });

  it('時計の品で止まっているあいだは、輪の時計もためる時計も進まない', () => {
    const w = quiet();
    const ring = appear(w);
    w.player.x = ring.x;
    w.player.y = ring.y;
    run(w, 1);
    const { left, charge } = w.fairy;
    w.freeze = 5;
    run(w, 2);
    expect(w.fairy.left).toBe(left);
    expect(w.fairy.charge).toBe(charge);
  });

  it('妖精の粉で 2 秒、月のしずくで満ちたとき HP が 3 割戻る', () => {
    const w = quiet();
    expect(chargeTime(w)).toBe(CHARGE);
    w.relics.push('dust', 'moon');
    expect(chargeTime(w)).toBe(CHARGE_DUST);
    const ring = appear(w);
    w.player.x = ring.x;
    w.player.y = ring.y;
    w.player.hp = 10;
    run(w, CHARGE_DUST + 0.2);
    expect(w.player.hp).toBeGreaterThanOrEqual(10 + Math.floor(w.stats.maxHp * 0.3) - 1);
  });

  it('ためていないときは holdInRing は何もしない', () => {
    const w = quiet();
    const ring = appear(w);
    const p = { x: ring.x + 200, y: ring.y };
    holdInRing(w, p);
    expect(p.x).toBe(ring.x + 200);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる** Run: `pnpm exec vitest run src/lib/games/animal-survivors/fairy.test.ts` → FAIL。`makeEnemy`・`w.player.hp`・`w.stats.maxHp`・`w.ground` などの名前は今のコードに合わせて直してよい（確かめる中身は変えない）。
- [ ] **Step 3: 実装する**。`stepFairy` は `blackout.ts` の `stepBlackout` と同じ時計の形で、時刻になったら置き方の関数で輪を置いて帯を出す。置き方は、倒れていない動物を `heroes.ts` の `nextPlacer(w, w.fairy)` で選び、`w.rand()` の角度と 60〜120 の距離で最大 12 回試して `obstaclesNear(w.ground, x, y, RING_R, [])` が空の場所に置く。12 回とも障害物にかかれば、その回は輪を置かない（帯も出さない）。輪があるあいだは `left` を減らし、0 で消す。ためていなければ、倒れていない動物のどれかが輪の中に入ったら `charge` を `dt` ずつ進め始め、ためはじめたら輪の中の動物が全員出ても戻さない（閉じ込めるので出られない）。`chargeTime(w)` に届いたら満ちる。満ちたときは、輪の中心から画面の半分の幅と高さの範囲で、`prop`・`boss`・`part`・`metal` でない生きた敵を倒し（`damageEnemy` に十分大きい値で。倒した数を `fairyKills` に足す）、ヌシ（`chief`）とボスには最大 HP の `BOSS_CUT` を与え（大ヘビの節は数えない）、月のしずくを持っていれば倒れていない動物の HP を最大 HP の `MOON_HEAL` 戻す。輪を消して `burst = BURST_SECS` にし、出来事を 1 つ積む（両方の端末で光るように持ち主を付けない）。`holdInRing` は `charge > 0` で、その動物が輪の中心から `r + 8` 以内にいるときだけ、`r - 2` の内側へ戻す（ためはじめたときに遠くにいた相棒は留めない）。倒れた動物は留めない。抜けた動物は数えない。
- [ ] **Step 4: 描く**。`draw-grove.ts` の `drawRing` は `FAIRY_RING_ART` を輪の中心に描き、ためているあいだは輪の内側を下から光で満たす（`charge / chargeTime` の高さ）。満ちた光は `burst` のあいだ輪の中心から広がる白い円で、動きを減らす設定（`prompts?.still`）では描かない。輪が画面の外にあるあいだは `draw-events.ts` に `ringArrow` を足して、宝の地図の矢印と同じ描き方で端に出す。
- [ ] **Step 5: 協力プレイ**。`snap.ts` の様子に `fairy`（`ring`・`left`・`charge`・`burst`）を足し、子の World に写す。`coop.ts` の `CoopGuest.move` で、自分の動物を動かしたあとに `holdInRing(v, p)` を呼ぶ。`coop.test.ts` の版ちがいのテストを `COOP_VERSION` 8 に直し、`started()` の親の World で輪を置いてためはじめ（親の動物を輪の中へ）、子の動物も輪の中に置いて様子を 1 回送ってから、子が `g.move({ x: 1, y: 0 }, 1 / 30)` を 60 回呼んでも輪の外へ出ないテストを足す。
- [ ] **Step 6: 通ることを確かめる** Run: `pnpm exec vitest run src/lib/games/animal-survivors/` → PASS。
- [ ] **Step 7: 画面を撮る**（headless の Chrome で 1:35 に時刻を飛ばし、輪が出たところ・ためているところ・満ちたところを撮る。夜の街で使った `scratchpad/city-shots/shoot.mjs` の形で `/@fs` から読み込む。`pnpm dev --port 5198 --strictPort`、終わったら止める）
- [ ] **Step 8: Commit** `Add Animal Survivors' magic grove fairy rings`

### Task 4: 森の大ジカ

**Files:**

- Create: `src/lib/games/animal-survivors/bosses-grove.ts`
- Modify: `enemies.ts`（`stag` を本物の数と `ai: 'stag'` に。`ai` の型に `'stag'`、`BossId`）、`bosses.ts`（`moveBoss` の分岐）、`world.ts`（`touch()` の突進の強さに、大イノシシと同じく `stag` の突進を足す）、`draw.ts`（角ふりの予告のあいだは 3 コマめ）
- Test: `src/lib/games/animal-survivors/bosses-grove.test.ts`

- [ ] **Step 1: テストを書く**。森の大ジカを自分の右 120 ドットに置き、15 秒動かす。大イノシシと同じ突進の予告の矢印が出て、続けて 3 回突進する。角ふりでは、いちばん近い動物の向きに扇の予告（竜の息の `Hazard` の形）が 1 秒出て、そのあと扇の中の自分にだけ当たり（扇の外では HP が減らない）、当たっても遅くならない（`p.slow` が 0 のまま）。扇の向きは予告を置いたときに決まり、そのあと自分が動いても変わらない。`rage` の行では攻撃の間が短くなる。
- [ ] **Step 2〜4**（落ちる → 実装 → 通る）。動きは `bosses-forest.ts` の `boar` を呼び、突進 3 回のあとの休みで角ふりを使う（突進と角ふりを交互に、間は `rage` で割る）。扇は竜の息の予告の形を使い回し、遅くする印を付けない（息の当たりが遅くするなら、遅くしない場合分けを足す）。数は大イノシシの体力・攻撃から始める（Task 8 で合わせる）。
- [ ] **Step 5: Commit** `Add Animal Survivors' forest stag with the antler sweep`

### Task 5: 魔女

**Files:**

- Modify: `bosses-grove.ts`、`enemies.ts`（`witch` を本物の数と `ai: 'witch'` に、手下 `minion` はいたずら妖精 `pixie`、飛び道具の絵 `shot` は Task 1 の魔法の弾）、`bosses.ts`（`moveBoss` の分岐）
- Test: `bosses-grove.test.ts` に足す

- [ ] **Step 1: テストを書く**。魔女を置いて 15 秒動かすと、魔法の弾（女王グモの飛び道具の形）といたずら妖精の手下が出る。魔法陣では、いちばん近い動物のまわりに予告の円が 3 つ、0.4 秒ずつずれて置かれ、それぞれ予告のあと円の中の自分にだけ当たる。円の場所は置いたときに決まり、置いたあとに自分が 60 ドット動いても動かない（置いた円の中心と予告の中心が同じ。円の当たりの中心は、ほかの予告の円と同じ `RING_DY` のずらし方に合わせる）。魔女が倒れたら、出ていない予告は消える（今の予告の持ち主のしくみ）。協力プレイで動物が 2 匹のとき、円はいちばん近い生きている動物のまわりに置く。
- [ ] **Step 2〜4**（落ちる → 実装 → 通る）。動きは女王グモの `queen` の分岐を呼び、それと交互に（間は `rage` で割る）魔法陣を使う。円は巨大ベアの `slam` の `Hazard` の形を、遅れ（`delay`）を 1.0・1.4・1.8 秒にして置く。数は女王グモの体力・攻撃から始める（Task 8 で合わせる）。
- [ ] **Step 5: 画面を撮る**（headless でボスの時刻に飛ばし、森の大ジカの角ふりと、魔女の魔法陣を撮る）
- [ ] **Step 6: Commit** `Add Animal Survivors' witch with magic circles`

### Task 6: ユニコーンと虹のビーム・虹の大砲

**Files:**

- Modify: `animals.ts`（`AnimalId` に `unicorn`、行を足す。`tier: 4`、`forms: ['子どものユニコーン', '虹のユニコーン', '星のユニコーン']`、`weapon: 'rainbowBeam'`、`special: 'rainbowBeamSp'`、`bonus: { speed: 0.1 }`。能力の数は Task 8 で合わせる仮の値で、アライグマと同じにしておく）、`weapons.ts`（`WeaponKind` に `'beam'`、`rainbowBeam` と `rainbowBeamSp`、`EXCLUSIVE` に `rainbowBeam`）、`arms.ts`（`beam` の動き方）、`draw-arms.ts`（虹の線）、`achievements.ts`（`groveClear` に `animal: 'unicorn'`）、`link-halves.ts`（ユニコーンの半分）
- Test: `src/lib/games/animal-survivors/unicorn.test.ts`

**Interfaces:**

- Consumes: `closest(seg, px, py)`（`$lib/segments.ts`）、`arms.ts` の空のボスを外す近い敵の選び方（アライグマの `nearestN`）
- Produces: 武器の id `rainbowBeam`・`rainbowBeamSp`、`WeaponKind` の `'beam'`、`BEAM_LEN = 120`、`BEAM_W = 8`、`BEAM_SECS = 0.25`（`arms.ts`）

- [ ] **Step 1: テストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from './achievements';
import { animal } from './animals';
import { BEAM_LEN, BEAM_W } from './arms';
import { choices } from './choices';
import { ENEMIES } from './enemies';
import { emptyRecords, parseRecords } from './records';
import { WEAPONS } from './weapons';
import { createWorld, makeEnemy, step } from './world';

const VIEW = { w: 274, h: 394 };
const unicornWorld = () => {
  const w = createWorld('unicorn', 1, VIEW);
  w.stage = { ...w.stage, waves: [], bosses: [], events: [], chiefs: [] };
  w.propCd = 9999;
  w.metalAt = -1;
  return w;
};
const run = (w: ReturnType<typeof unicornWorld>, secs: number) => {
  for (let i = 0; i < Math.round(secs * 30); i++) step(w, { x: 0, y: 0 }, 1 / 30);
};

describe('ユニコーン', () => {
  it('最強の段で、虹のビームを持ち、魔法の森のクリアで仲間になる', () => {
    const a = animal('unicorn');
    expect(a.tier).toBe(4);
    expect(a.forms).toEqual(['子どものユニコーン', '虹のユニコーン', '星のユニコーン']);
    expect(a.weapon).toBe('rainbowBeam');
    expect(a.bonus).toEqual({ speed: 0.1 });
    expect(ACHIEVEMENTS.find((d) => d.id === 'groveClear')?.animal).toBe('unicorn');
    const r = parseRecords(JSON.stringify({ ...emptyRecords(), achieved: ['groveClear'] }));
    expect(r.unlocked).toContain('unicorn');
  });

  it('虹のビームは Lv1 で 1 本、Lv5 で 3 本', () => {
    const def = WEAPONS.rainbowBeam;
    expect(def.kind).toBe('beam');
    expect(def.base.amount).toBe(1);
    expect(def.base.amount + def.ups.reduce((n, u) => n + (u.amount ?? 0), 0)).toBe(3);
  });

  it('線にかかる敵にだけ、1 回ずつ当たる', () => {
    const w = unicornWorld();
    w.weapons[0].cd = 0;
    const p = w.player;
    const a = makeEnemy(ENEMIES.shroomling, p.x + 40, p.y, 1e6);
    const b = makeEnemy(ENEMIES.shroomling, p.x + BEAM_LEN - 10, p.y + 2, 1e6);
    const off = makeEnemy(ENEMIES.shroomling, p.x + 60, p.y + BEAM_W + 30, 1e6);
    const past = makeEnemy(ENEMIES.shroomling, p.x + BEAM_LEN + 40, p.y, 1e6);
    w.enemies.push(a, b, off, past);
    step(w, { x: 0, y: 0 }, 1 / 30);
    expect(a.hp).toBeLessThan(1e6);
    expect(b.hp).toBeLessThan(1e6);
    expect(off.hp).toBe(1e6);
    expect(past.hp).toBe(1e6);
    const once = 1e6 - a.hp;
    run(w, 0.2);
    expect(1e6 - a.hp).toBe(once);
  });

  it('空にいるボスは狙わず、ほかに敵がいなければ撃たない', () => {
    const w = unicornWorld();
    w.weapons[0].cd = 0;
    const e = makeEnemy(ENEMIES.raven, w.player.x + 40, w.player.y, 1e6);
    e.state = 4;
    w.enemies.push(e);
    run(w, 0.5);
    expect(e.hp).toBe(1e6);
  });

  it('虹のビームは、ほかの動物の 3 択に出ない', () => {
    const w = createWorld('dog', 1, VIEW);
    for (let i = 0; i < 200; i++) {
      expect(choices(w).some((c) => c.kind === 'weapon' && c.id === 'rainbowBeam')).toBe(false);
    }
  });
});
```

- [ ] **Step 2: 落ちることを確かめる** Run: `pnpm exec vitest run src/lib/games/animal-survivors/unicorn.test.ts` → `unicorn` が無いので FAIL。`makeEnemy`・`w.weapons[0].cd`・`e.state`・`choices()` の戻りの形は今のコードに合わせて直してよい（確かめる中身は変えない。大ワシ型のボスが空にいる state は `bosses-snow.ts` の `airborne()` を見て合わせる）。
- [ ] **Step 3: 実装する**。`beam` は撃つときに、アライグマの `nearestN` と同じ選び方（画面の中・空やもぐっているボスを外す）で近い順に `amount` 体を選び、それぞれの向きへ自分から長さ `BEAM_LEN × area` の線分を作る。線分ごとに、生きた敵で `closest()` からの距離が `BEAM_W / 2 + 敵の半径` 以下のものへ `strike()`（`damageEnemy` に武器の id を渡す、アライグマの缶と同じ通り道）で 1 回ずつ当てる。絵のための効果（線の両端と向き、`BEAM_SECS`）を 1 つ置き、協力プレイの様子に載せる（効果の種類が増えるだけなら今の効果の行で運べる）。`rainbowBeamSp` は `sp(...)` の形で強さを上げ、太さ `BEAM_W × 2`、長さは画面の対角線（`Math.hypot(view.w, view.h)`）。描き方は `draw-arms.ts` で、虹の 6 色の細い線を重ね、残りの秒で細く薄くする。図鑑の姿・「全部の動物がそろう」の実績など、動物の数を固めたテストは 13 匹に直す。`link-halves.ts` にユニコーンの半分（帯の形）を足す。
- [ ] **Step 4: 専用進化のテストを足す**。3 段階めに育ったユニコーンで `rainbowBeam` を Lv5 にすると `rainbowBeamSp` に入れ替わる（`trySpecial`）。虹の大砲は、自分から 200 ドット先の線の上の敵にも当たる。
- [ ] **Step 5: 通ることを確かめる** Run: `pnpm exec vitest run src/lib/games/animal-survivors/` → PASS。Task 2 で遺物のテストから外した `grove` を戻す（妖精の粉と月のしずくは Task 3 で入っている）。
- [ ] **Step 6: Commit** `Add Animal Survivors' unicorn with the rainbow beam`

### Task 7: 実績と 13 匹のキャラ選択

**Files:**

- Modify: `achievements.ts`（`groveBosses`「魔女と森の大ジカを倒す」700 コインは夜の街の `cityBosses` と同じ形で `witch` と `stag`、`fairy500`「妖精の輪で敵を 500 体倒す」600 コインは記録の `fairyKills` の合計で `progress` を持つ。夜の街の `blackout500` と同じ形）、`records.ts`（`fairyKills`、古い記録は 0）、`world.ts` の `RunSummary` と `summary`（`fairyKills`）、`overtime.ts`（`blackoutKills` と同じく延長戦のもとの値と差）、`coop-run.ts`（`summaryOk` の `opt(v, n)` の並び）、`trophy-groups.ts`（「ボス」と「倒す」の見出しに足す）、`docs/progress.md` の実績の数
- Test: `grove.test.ts` に足す（実績の数を固めているテストは 2 つ増やす）、`charselect.svelte.test.ts` の動物の数を 13 に

- [ ] TDD で足す（落ちる → 実装 → 通る）。`blackoutKills` を `grep` して出てくるところすべてに `fairyKills` を並べる。古い記録は `fairyKills` 0 で読む。延長戦の 2 回めの記録では差だけを足す（クリアで 30、延長戦の終わりで 50 なら合計 50）。
- [ ] headless の Chrome（820 × 1180）でキャラ選択を撮り、13 匹の 3 段（5・5・3）・詳しい札・「この子で出発」がスクロールなしで収まることを確かめる。収まらなければタイルを小さくする。
- [ ] Commit `Add Animal Survivors' magic grove achievements`

### Task 8: ボットで合わせる

- [ ] scratchpad のボット（`/private/tmp/claude-501/-Users-oekazuma-localRepo-asobibako--claude-worktrees-meccha-chameleon-clone-51ef75/51b5c055-e566-441b-b500-6d9d4d77268c/scratchpad/sim/`。海岸と夜の街を合わせたもの。無ければ同じ方針で作り直す）に、輪が出ていてボスの予告が無いときは輪へ向かう動きを足し、`STAGE=grove` を店半分・全部、犬・キツネ・パンダを 24 回ずつ遊ばせる。同じボットの夜の街（店半分 43/72 前後）より少し低いクリアの割合になるよう、`stages/grove.ts` の `HARDER`、ボス 2 体の体力と攻撃を合わせる。
- [ ] `ANIMALS=unicorn,drake,chick,otter,raccoon` で店なし・半分の森と魔法の森を 36 回ずつ比べ、ユニコーンがほかの最強の段と同じくらいになるよう、`animals.ts` の数と `rainbowBeam` の数値を合わせる。
- [ ] spec に「## 11. 調整の結果」（表と、なぜその値にしたか。調整のつまみは今の値だけを書き、前の値の列は作らない。比べた回数を書く）を足す。Commit `Tune Animal Survivors' magic grove and unicorn with bot runs`

### Task 9: 仕上げ

- [ ] `src/lib/games/animal-survivors/CLAUDE.md` の最初の段落の面の一覧に魔法の森を足し、話題ごとの文書のファイルの一覧に `fairy.ts`・`draw-grove.ts`・`bosses-grove.ts` を足す。`docs/stages.md`（魔法の森・妖精の輪・妖精の粉と月のしずく）・`docs/bosses.md`（魔女と森の大ジカ、`ai` の一覧）・`docs/animals.md`（13 匹めのユニコーン）・`docs/weapons.md`（`beam`）・`docs/coop.md`（輪を様子に載せる・子の閉じ込め・`COOP_VERSION` 8）・`docs/menus.md`（13 匹）に今の仕様として書き足す（経緯は書かない）。書く数はコードを `grep` して確かめる。
- [ ] `pnpm verify` → exit 0。Commit `Describe Animal Survivors' magic grove and unicorn`
- [ ] 別の係にブランチ全体を見てもらい、Critical と Important を直す。そのあと main へ merge して push してよいかを利用者に聞く。
