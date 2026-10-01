# Animal Survivors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 動物版のヴァンサバ「Animal Survivors」を、あそびばこの 1 人用ゲームとして最小版（キャラ選択からリザルトまで）まで作る。

**Architecture:** ルール（`world.ts`・`arms.ts`・`drops.ts`・`choices.ts`）は DOM を使わない純粋な TS で、データの表（動物・武器・パッシブ・敵・ステージ）を読んで動く。描画は低解像度のドット絵を canvas 2D に整数倍で描き、HUD も同じ canvas に描く。日本語の文字が要る画面（キャラ選択・3 択・リザルト）だけを Svelte の HTML にする。

**Tech Stack:** SvelteKit（Svelte 5 runes）、TypeScript、canvas 2D、vitest（node の unit project）、playwright-core（scratchpad の確認用）

**Spec:** `docs/superpowers/specs/2026-10-02-animal-survivors-design.md`

## 止まるところ

この計画には利用者の確認で止まるところが 2 つある。

| どこで          | 何を見せるか                         | 次へ進む条件                     |
| --------------- | ------------------------------------ | -------------------------------- |
| Task 1 の終わり | すべてのドット絵を並べたシートの画像 | 利用者が「この絵でよい」と言う   |
| Task 9 の終わり | main へ入れる前の、遊べる最小版      | 実機で触ってもらい、感想をもらう |

Task 2 以降は、Task 1 のシートが承認されるまで始めない。

## Global Constraints

- 置き場所は `src/lib/games/animal-survivors/`。`meta.ts` は `players: 1`、`levels: 1`。シェルの `onfinish` は呼ばない（リザルトはゲームが持つ）。
- 文字は漢字まじり。絵文字は使わない。外部フォントは読み込まない。
- コンポーネントは 200 行未満。`<main>` は書かない（シェルの `<main class="stage solo">` の中に描かれる）。
- 指は `pointerdown` と `pointerId` で扱う。盤面の座標は `$lib/board-input` の `BoardInput` で取る（横向きの回転を直してくれる）。
- 盤面の中の大きさは `%` か `cqh` / `cqw` で書き、`dvh` / `vw` は使わない。
- プレイ中はシェルが左上に ✕（タイトルへ）、右上に ↻（作り直し）を出す。HUD・3 択・リザルトのボタンは、上端から `max(72px, env(safe-area-inset-top) + 60px)` までの左右の隅に置かない。
- 1 プレイは 900 秒。座標と大きさは仮想画面のドット（px）が単位。
- コメントは非自明な WHY だけ。変更履歴やタスク番号は書かない。
- 各 Task の終わりに `pnpm test:run`、`pnpm check`、`pnpm lint`、`pnpm vitals --diff` を通してから commit する。commit の末尾に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` を付ける。

## Review Focus

- レベルアップの 3 択やリザルトが、移動に使っている指の下に出る。指を離したときの iOS の合成 click でカードやボタンが押されないこと（Task 7・8 の `Settle`）。
- 1 回の拾いで Lv が 2 つ以上上がる。3 択が上がった回数だけ続けて出ること（Task 5 のテスト）。
- 武器もパッシブも全部 Lv5 になった。3 択が埋め札（肉・経験値の袋）だけになり、袋の経験値で上がる Lv も有限で止まること（Task 5 のテスト）。
- 玉が 400 個を超える。合わせた玉に値が足され、経験値が消えないこと（Task 5 のテスト）。
- 遠すぎる敵を回し直す位置が、いつも画面の外であること（Task 3 のテスト）。指とキーボードを同時に使ったら指を優先すること（Task 6 のテスト）。

---

## ファイルの地図

| ファイル                  | 持つもの                                                          |
| ------------------------- | ----------------------------------------------------------------- |
| `pixels.ts`               | ドット絵の格子の型、格子の検査（純粋）、canvas への焼きこみと控え |
| `art/palette.ts`          | 共通の色（1 文字 = 1 色）                                         |
| `art/animals.ts`          | 犬・猫・狼の絵（歩き 4・攻撃 1・被弾 1）                          |
| `art/enemies.ts`          | 敵 5 種の絵（歩き 2）                                             |
| `art/items.ts`            | 弾・玉・肉・磁石・武器とパッシブのアイコン                        |
| `art/forest.ts`           | 地面のタイルと飾り                                                |
| `animals.ts`              | 動物の表                                                          |
| `weapons.ts`              | 武器の表、`weaponStats()`、`upText()`                             |
| `passives.ts`             | パッシブの表、`Stats` と `stats()`                                |
| `enemies.ts`              | 敵の表                                                            |
| `stages/forest.ts`        | 出現表・上限・硬さの伸び                                          |
| `rng.ts`                  | 種から作る乱数                                                    |
| `grid.ts`                 | 当たり判定の格子                                                  |
| `world.ts`                | 1 ゲームの状態と `step()`（移動・出現・敵の動き・接触・時間）     |
| `arms.ts`                 | 武器 7 種の動き方と当たり                                         |
| `drops.ts`                | 経験値の曲線・玉・肉・磁石・拾う                                  |
| `choices.ts`              | レベルアップの 3 択と適用                                         |
| `input.ts`                | キー・スティック・パッドの向き（純粋）                            |
| `font.ts`                 | 3×5 のドット字                                                    |
| `effects.ts`              | 見た目だけの粒・浮かぶ数字・揺れ                                  |
| `draw.ts`                 | 仮想画面の大きさ、地面・飾り・玉・敵・自分・弾の描画              |
| `hud.ts`                  | canvas の HUD（Lv・HP・EXP・時間・撃破数・武器とパッシブ）        |
| `sounds.ts`               | 効果音                                                            |
| `Survivors.svelte`        | キャラ選択・プレイ・リザルトの切り替え                            |
| `Play.svelte`             | canvas・ループ・入力・一時停止・3 択の重ね                        |
| `CharSelect.svelte`       | キャラ選択                                                        |
| `LevelUp.svelte`          | 3 択のカード                                                      |
| `Result.svelte`           | リザルト                                                          |
| `PixelIcon.svelte`        | 焼いた絵を小さな canvas に描く部品                                |
| `Howto.svelte`・`meta.ts` | シェルのタイトルの遊び方と一覧用の情報                            |

テストは同じフォルダの `*.test.ts`（vitest の unit project が拾う）。

---

### Task 1: ドット絵と見本シート

**Files:**

- Create: `src/lib/games/animal-survivors/pixels.ts`
- Create: `src/lib/games/animal-survivors/art/palette.ts`, `art/animals.ts`, `art/enemies.ts`, `art/items.ts`, `art/forest.ts`
- Test: `src/lib/games/animal-survivors/pixels.test.ts`
- Create (scratchpad、commit しない): `<scratchpad>/sheet.mjs`

**Interfaces:**

- Produces:
  - `interface Art { w: number; h: number; frames: string[][]; pal?: Record<string, string> }`（`frames[i]` は `h` 本の長さ `w` の文字列。`.` は透明）
  - `function problems(name: string, art: Art, palette: Record<string, string>): string[]`（純粋。空なら正しい）
  - `function bake(art: Art, frame: number, mode?: 'normal' | 'flip' | 'white' | 'flipWhite'): HTMLCanvasElement`（1 ドット = 1 画素の canvas。控えて同じものを返す）
  - `PALETTE`、`ANIMAL_ART: Record<'dog' | 'cat' | 'wolf', { walk: Art; attack: Art; hurt: Art }>`、`ENEMY_ART: Record<'rat' | 'bat' | 'caterpillar' | 'snake' | 'boar', Art>`、`ITEM_ART: Record<string, Art>`、`FOREST_ART: { grass: Art; dirt: Art; decor: Record<'flower' | 'tuft' | 'tree' | 'rock' | 'stump', Art> }`

**絵の決まり**

| 種類       | 大きさ                                                       | コマ                                             |
| ---------- | ------------------------------------------------------------ | ------------------------------------------------ |
| 犬・猫・狼 | 16×16                                                        | walk 4、attack 1、hurt 1。右向きに描き、左は反転 |
| 敵         | ネズミ・コウモリ 12×12、ヘビ・イモムシ 14×12、イノシシ 18×14 | 2（歩きか羽ばたき）                              |
| 弾         | 骨 8×8、魚 10×6、羽根 8×8                                    | 1（骨は描くときに回す）                          |
| 玉         | 青 5×5、緑 6×6、赤 7×7                                       | 2（光る）                                        |
| 肉・磁石   | 10×10                                                        | 1                                                |
| アイコン   | 12×12                                                        | 武器 7・パッシブ 10                              |
| 地面       | 16×16 のタイル                                               | 草 4 種（1 枚の Art の 4 コマ）、土 1            |
| 飾り       | 花 8×8、草むら 12×8、切り株 14×12、岩 16×12、木 32×40        | 1                                                |

- 外側に濃い線（`k`）を 1 ドットで引く。色は `PALETTE` の 24 色以内で、動物ごとの差し色だけ `pal` で足してよい。
- 足もとは下端の行。描くときは足もとの中央を位置に合わせる。
- 小さくても犬は垂れ耳と太いしっぽ、猫はとがった耳と細く上がるしっぽ、狼はとがった耳・灰色・とがった鼻先と白い胸、で見分けられること。
- 歩き 4 コマは、体を 1 ドット上下させ、足を前後に入れ替える。被弾は目を `><` にして体を少し縮める。攻撃は口を開けて前へ乗り出す。

- [ ] **Step 1: 格子の検査のテストを書く**

```ts
// pixels.test.ts
import { describe, expect, it } from 'vitest';
import { ANIMAL_ART } from './art/animals';
import { ENEMY_ART } from './art/enemies';
import { FOREST_ART } from './art/forest';
import { ITEM_ART } from './art/items';
import { PALETTE } from './art/palette';
import { problems, type Art } from './pixels';

const all: [string, Art][] = [
  ...Object.entries(ANIMAL_ART).flatMap(([id, a]) =>
    Object.entries(a).map(([k, art]) => [`${id}.${k}`, art] as [string, Art])
  ),
  ...Object.entries(ENEMY_ART),
  ...Object.entries(ITEM_ART),
  ['grass', FOREST_ART.grass],
  ['dirt', FOREST_ART.dirt],
  ...Object.entries(FOREST_ART.decor)
];

describe('ドット絵の格子', () => {
  it('problems は幅のずれと知らない文字を見つける', () => {
    const bad: Art = { w: 2, h: 2, frames: [['k.', 'kkk']] };
    expect(problems('bad', bad, { k: '#000' })).toEqual(['bad[0] 2 行目の幅が 3']);
    expect(problems('x', { w: 1, h: 1, frames: [['z']] }, { k: '#000' })).toEqual(['x[0] に色のない文字 z']);
    expect(problems('n', { w: 1, h: 2, frames: [['k']] }, { k: '#000' })).toEqual(['n[0] の行数が 1']);
  });

  it.each(all)('%s はすべてのコマが正しい', (name, art) => {
    expect(problems(name, art, PALETTE)).toEqual([]);
  });

  it('動物の歩きは 4 コマ、敵は 2 コマ', () => {
    for (const a of Object.values(ANIMAL_ART)) expect(a.walk.frames).toHaveLength(4);
    for (const e of Object.values(ENEMY_ART)) expect(e.frames).toHaveLength(2);
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors/pixels.test.ts`
Expected: FAIL（`./pixels` が無い）

- [ ] **Step 3: `pixels.ts` を書く**

```ts
export interface Art {
  w: number;
  h: number;
  /** コマごとに h 本、長さ w の文字列。'.' は透明 */
  frames: string[][];
  /** この絵だけの差し色。PALETTE より優先する */
  pal?: Record<string, string>;
}

export function problems(name: string, art: Art, palette: Record<string, string>): string[] {
  const out: string[] = [];
  art.frames.forEach((rows, i) => {
    if (rows.length !== art.h) out.push(`${name}[${i}] の行数が ${rows.length}`);
    rows.forEach((row, y) => {
      if (row.length !== art.w) out.push(`${name}[${i}] ${y + 1} 行目の幅が ${row.length}`);
      for (const ch of new Set(row))
        if (ch !== '.' && !(ch in palette) && !(art.pal && ch in art.pal))
          out.push(`${name}[${i}] に色のない文字 ${ch}`);
    });
  });
  return out;
}

const baked = new WeakMap<Art, Map<string, HTMLCanvasElement>>();

/** 1 ドット = 1 画素で焼く。拡大は描く側が整数倍で行う。white は当たったときの白い点滅 */
export function bake(
  art: Art,
  frame: number,
  mode: 'normal' | 'flip' | 'white' | 'flipWhite' = 'normal'
): HTMLCanvasElement {
  let cache = baked.get(art);
  if (!cache) baked.set(art, (cache = new Map()));
  const key = `${frame}:${mode}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = art.w;
  c.height = art.h;
  const ctx = c.getContext('2d')!;
  const flip = mode === 'flip' || mode === 'flipWhite';
  const white = mode === 'white' || mode === 'flipWhite';
  art.frames[frame].forEach((row, y) => {
    for (let x = 0; x < art.w; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      ctx.fillStyle = white ? '#ffffff' : (art.pal?.[ch] ?? PALETTE[ch]);
      ctx.fillRect(flip ? art.w - 1 - x : x, y, 1, 1);
    }
  });
  cache.set(key, c);
  return c;
}
```

`PALETTE` は `./art/palette` から import する。

- [ ] **Step 4: `art/palette.ts` と絵を描く**

色の例（足し引きしてよい。24 色以内）。

```ts
export const PALETTE: Record<string, string> = {
  k: '#24151f', // 線
  w: '#fff8ec',
  g: '#8a8f9e', // 灰
  G: '#5a5d6e',
  b: '#c07a3e', // 茶
  B: '#7d4524',
  c: '#f3d9a4', // クリーム
  o: '#e8963a', // 橙
  p: '#ef8fa0', // 桃
  r: '#d8463c',
  y: '#ffd84a',
  l: '#8fd14f', // 草
  L: '#4f9a3a',
  d: '#2f6b33',
  t: '#a8744a', // 土
  T: '#6e4a30',
  s: '#b9c2cc', // 石
  S: '#77808c',
  u: '#5ab0ff', // 青
  U: '#2a64c8',
  v: '#a66ae0', // 紫
  e: '#ff7b2e' // 炎
};
```

犬の歩き 1 コマ目の例（形の参考。仕上がりはシートの承認で決める）。

```ts
const dogWalk0 = [
  '................',
  '..........k..k..',
  '.........kBk.kBk',
  '.........kbbkbbk',
  '........kbbbbbbk',
  '.k......kbbkwbck',
  'kbk.....kbbbbcck',
  'kbk..kkkkbbbbckk',
  '.kbkkbbbbbrrrk..',
  '..kbbbbbbbbbbk..',
  '..kbbbbbbbccbk..',
  '..kbbbbbbbccbk..',
  '...kbbkkkbbkbk..',
  '...kbk..kbk.kbk.',
  '...kk...kk...kk.',
  '................'
];
```

`art/animals.ts` に 3 匹 × 6 コマ、`art/enemies.ts` に 5 種 × 2 コマ、`art/items.ts` に弾・玉・肉・磁石・アイコン 17 枚、`art/forest.ts` に地面と飾りを、上の表の大きさで描く。アイコンの名前は Task 2 の `icon` と同じにする（武器は `weapon-<id>`、パッシブは `passive-<id>`）。

- [ ] **Step 5: テストを通す**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors/pixels.test.ts`
Expected: PASS

- [ ] **Step 6: 見本シートを撮る**

`<scratchpad>/sheet.mjs` を作る。dev サーバー（`preview_start` の `dev`、`http://localhost:5173/asobibako/`）を開き、`page.evaluate` の中で `import('/asobibako/@fs<repo の絶対パス>/src/lib/games/animal-survivors/art/animals.ts')` などを読み、`bake()` した絵を 1 枚の canvas に 6 倍で並べる（`imageSmoothingEnabled = false`）。並べ方は次のとおり。

1. 3 匹の全コマ（左向きの反転も 1 コマ）。それぞれ下に名前。
2. 敵 5 種の全コマと白い点滅の版。
3. 弾・玉・肉・磁石・アイコン。
4. 森の地面を 12×8 タイル敷き、飾りを散らし、その上に 3 匹と敵を何体か置いた「プレイ画面ふう」の 1 枚（4 倍）。

```js
import { createRequire } from 'node:module';
const require = createRequire('<repo>/package.json');
const { chromium } = require('playwright-core');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await (await browser.newContext({ bypassCSP: true })).newPage();
await page.goto('http://localhost:5173/asobibako/');
const png = await page.evaluate(async (root) => {
  const at = (p) => import(`/asobibako/@fs${root}/src/lib/games/animal-survivors/${p}`);
  const [{ bake }, { ANIMAL_ART }, { ENEMY_ART }, { ITEM_ART }, { FOREST_ART }] = await Promise.all(
    ['pixels.ts', 'art/animals.ts', 'art/enemies.ts', 'art/items.ts', 'art/forest.ts'].map(at)
  );
  // ここで 1 枚の canvas に並べ、toDataURL を返す
}, '<repo の絶対パス>');
// png を <scratchpad>/sheet.png に書く
await browser.close();
```

Run: `node <scratchpad>/sheet.mjs`、出来た画像を Read で見て、決まりの表とシルエットの条件を満たすまで直す。

- [ ] **Step 7: commit**

```bash
git add src/lib/games/animal-survivors
git commit -m "Draw Animal Survivors' pixel art: three animals, five enemies, items, icons, and forest tiles"
```

- [ ] **Step 8: 利用者に見せて止まる**

`SendUserFile` で `sheet.png` を送り、「ちゃんとしたゲームに見えるか」を聞く。直しを頼まれたら Step 4 に戻る。承認されるまで Task 2 へ進まない。

---

### Task 2: データの表

**Files:**

- Create: `animals.ts`, `weapons.ts`, `passives.ts`, `enemies.ts`, `stages/forest.ts`（すべて `src/lib/games/animal-survivors/` の下）
- Test: `data.test.ts`

**Interfaces:**

- Consumes: なし（絵の名前は文字列で持つ）
- Produces:

```ts
// animals.ts
export type AnimalId = 'dog' | 'cat' | 'wolf';
export interface Animal {
  id: AnimalId;
  name: string;
  blurb: string;
  hp: number;
  speed: number;
  might: number;
  weapon: string;
}
export const ANIMALS: Animal[];
export function animal(id: AnimalId): Animal;

// weapons.ts
export type WeaponKind = 'shot' | 'swipe' | 'ring' | 'boomerang' | 'orbit' | 'strike' | 'homing';
export interface WeaponStats {
  damage: number;
  cooldown: number;
  amount: number;
  area: number;
  speed: number;
  pierce: number;
  duration: number;
  knockback: number;
}
export interface WeaponDef {
  id: string;
  name: string;
  blurb: string;
  kind: WeaponKind;
  base: WeaponStats;
  ups: Partial<WeaponStats>[];
}
export const WEAPONS: Record<string, WeaponDef>;
export const MAX_LEVEL = 5;
export function weaponStats(def: WeaponDef, level: number): WeaponStats;
export function upText(def: WeaponDef, level: number): string; // level へ上げたときに増えるもの

// passives.ts
export type StatKey = 'maxHp' | 'might' | 'haste' | 'speed' | 'armor' | 'growth' | 'area' | 'crit' | 'regen' | 'magnet';
export type Stats = Record<StatKey, number>;
export interface PassiveDef {
  id: string;
  name: string;
  blurb: string;
  stat: StatKey;
  per: number;
}
export const PASSIVES: Record<string, PassiveDef>;
export function stats(a: Animal, passives: { id: string; level: number }[]): Stats;

// enemies.ts
export type Move = 'chase' | 'wave' | 'snake' | 'charge';
export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  speed: number;
  atk: number;
  r: number;
  xp: number;
  move: Move;
  heavy: number;
}
export const ENEMIES: Record<string, EnemyDef>;

// stages/forest.ts
export interface Wave {
  from: number;
  to: number;
  enemy: string;
  rate: [number, number];
}
export interface Stage {
  id: string;
  name: string;
  length: number;
  waves: Wave[];
  cap: (t: number) => number;
  toughness: (t: number) => number;
}
export const FOREST: Stage;
export function spawnRate(w: Wave, t: number): number; // 範囲外は 0、範囲内は rate を線形に
```

**数値（最初の目安。Task 9 で直す）**

| 動物 | name | hp  | speed | might | weapon |
| ---- | ---- | --- | ----- | ----- | ------ |
| dog  | 犬   | 100 | 1.0   | 1.0   | `woof` |
| cat  | 猫   | 70  | 1.25  | 0.9   | `paw`  |
| wolf | 狼   | 120 | 1.0   | 1.3   | `howl` |

| id          | name             | kind      | damage | cooldown | amount | area | speed | pierce | duration | knockback | ups（Lv2〜Lv5）                                                                 |
| ----------- | ---------------- | --------- | ------ | -------- | ------ | ---- | ----- | ------ | -------- | --------- | ------------------------------------------------------------------------------- |
| `woof`      | ワンワンショット | shot      | 10     | 0.9      | 1      | 1    | 170   | 1      | 1.2      | 40        | `{damage:2}`, `{amount:1}`, `{cooldown:-0.15}`, `{amount:1, pierce:1}`          |
| `paw`       | ネコパンチ       | swipe     | 9      | 0.6      | 1      | 1    | 0     | 99     | 0.15     | 60        | `{damage:3}`, `{area:0.25}`, `{amount:1}`, `{damage:3, cooldown:-0.1}`          |
| `howl`      | 遠吠え           | ring      | 12     | 2.2      | 1      | 1    | 0     | 99     | 0.45     | 140       | `{damage:4}`, `{area:0.3}`, `{cooldown:-0.4}`, `{damage:6, area:0.2}`           |
| `boomerang` | 骨ブーメラン     | boomerang | 12     | 1.6      | 1      | 1    | 150   | 99     | 1.4      | 50        | `{damage:2.4}`, `{amount:1}`, `{area:0.25}`, `{damage:3, amount:1}`             |
| `feather`   | 羽根の嵐         | orbit     | 7      | 3.5      | 2      | 1    | 3.2   | 99     | 3.0      | 30        | `{amount:1}`, `{damage:3}`, `{duration:1, area:0.2}`, `{amount:1, speed:0.8}`   |
| `thunder`   | 雷撃             | strike    | 22     | 2.0      | 1      | 1    | 0     | 99     | 0.2      | 0         | `{amount:1}`, `{damage:8}`, `{amount:1, area:0.3}`, `{cooldown:-0.4, damage:8}` |
| `fish`      | 魚ミサイル       | homing    | 14     | 1.4      | 1      | 1    | 120   | 1      | 2.5      | 30        | `{damage:4}`, `{amount:1}`, `{area:0.4}`, `{amount:1, cooldown:-0.2}`           |

`area` は倍率（1 = 基本の大きさ）。基本の大きさは `arms.ts` が武器の種類ごとに持つ。`speed` は shot・boomerang・homing では px/秒、orbit では回る速さ（ラジアン/秒）。

| id        | name         | stat   | per  | 意味                         |
| --------- | ------------ | ------ | ---- | ---------------------------- |
| `heart`   | 大きな心臓   | maxHp  | 20   | 最大 HP +20                  |
| `fang`    | するどい牙   | might  | 0.1  | 攻撃力 +10%                  |
| `drum`    | はやい鼓動   | haste  | 0.08 | 待ち時間 −8%（下限 0.35 倍） |
| `paws`    | かるい足     | speed  | 0.1  | 移動速度 +10%                |
| `fur`     | ぶあつい毛皮 | armor  | 1    | 受けるダメージ −1（最低 1）  |
| `nose`    | 鼻ききの勘   | growth | 0.1  | 経験値 +10%                  |
| `roar`    | 大きな声     | area   | 0.1  | 攻撃範囲 +10%                |
| `claw`    | 野生の勘     | crit   | 0.05 | 会心率 +5%（会心は 2 倍）    |
| `leaf`    | 薬草         | regen  | 0.3  | 毎秒 HP +0.3                 |
| `whisker` | ひげアンテナ | magnet | 0.25 | 取得範囲 +25%                |

`stats()` の基本値は `{ maxHp: a.hp, might: a.might, haste: 0, speed: a.speed, armor: 0, growth: 1, area: 1, crit: 0.05, regen: 0, magnet: 1 }` で、パッシブの `per × level` を足す。

| id            | name     | hp  | speed | atk | r   | xp  | move   | heavy |
| ------------- | -------- | --- | ----- | --- | --- | --- | ------ | ----- |
| `rat`         | ネズミ   | 6   | 40    | 5   | 5   | 1   | chase  | 0     |
| `bat`         | コウモリ | 4   | 58    | 4   | 5   | 1   | wave   | 0     |
| `snake`       | ヘビ     | 14  | 34    | 8   | 6   | 2   | snake  | 0.2   |
| `caterpillar` | イモムシ | 40  | 20    | 10  | 7   | 5   | chase  | 0.6   |
| `boar`        | イノシシ | 70  | 26    | 18  | 8   | 8   | charge | 0.8   |

`heavy` はノックバックを減らす割合（0..1）。

森の出現表（秒）。

| from | to  | enemy       | rate（毎秒、from → to） |
| ---- | --- | ----------- | ----------------------- |
| 0    | 300 | rat         | 0.8 → 3                 |
| 60   | 600 | bat         | 0.5 → 2.5               |
| 180  | 900 | snake       | 0.5 → 3                 |
| 300  | 900 | rat         | 3 → 6                   |
| 360  | 900 | caterpillar | 0.3 → 2                 |
| 540  | 900 | boar        | 0.2 → 1.2               |
| 600  | 900 | bat         | 3 → 6                   |
| 720  | 900 | rat         | 8 → 14                  |

`cap(t) = Math.min(400, Math.round(30 + (t / 720) * 370))`、`toughness(t) = 1 + (t / 900) * 1.5`、`length: 900`。

- [ ] **Step 1: テストを書く**

```ts
// data.test.ts
import { describe, expect, it } from 'vitest';
import { ANIMALS, animal } from './animals';
import { ENEMIES } from './enemies';
import { PASSIVES, stats } from './passives';
import { FOREST, spawnRate } from './stages/forest';
import { MAX_LEVEL, WEAPONS, upText, weaponStats } from './weapons';

describe('データの表', () => {
  it('動物の初期武器と出現表の敵は表にある', () => {
    for (const a of ANIMALS) expect(WEAPONS[a.weapon]).toBeDefined();
    for (const w of FOREST.waves) expect(ENEMIES[w.enemy]).toBeDefined();
  });

  it('武器はどれも Lv5 までの上げ幅を 4 つ持つ', () => {
    for (const d of Object.values(WEAPONS)) expect(d.ups).toHaveLength(MAX_LEVEL - 1);
  });

  it('weaponStats は Lv までの上げ幅を足す', () => {
    const d = WEAPONS.woof;
    expect(weaponStats(d, 1)).toEqual(d.base);
    expect(weaponStats(d, 3)).toMatchObject({ damage: 12, amount: 2 });
    expect(weaponStats(d, 5)).toMatchObject({ damage: 12, amount: 3, pierce: 2 });
    expect(weaponStats(d, 5).cooldown).toBeCloseTo(0.75);
  });

  it('upText は上げ幅を言葉にする', () => {
    expect(upText(WEAPONS.woof, 2)).toBe('ダメージ +20%');
    expect(upText(WEAPONS.woof, 3)).toBe('発射数 +1');
    expect(upText(WEAPONS.woof, 5)).toBe('発射数 +1・貫通 +1');
    expect(upText(WEAPONS.boomerang, 4)).toBe('大きさ +25%');
  });

  it('stats はパッシブを Lv の分だけ足す', () => {
    const s = stats(animal('cat'), [
      { id: 'heart', level: 2 },
      { id: 'paws', level: 1 }
    ]);
    expect(s.maxHp).toBe(110);
    expect(s.speed).toBeCloseTo(1.35);
    expect(Object.keys(PASSIVES)).toHaveLength(10);
  });

  it('出現の速さは範囲の中で線形、外は 0', () => {
    const w = FOREST.waves[0];
    expect(spawnRate(w, 0)).toBeCloseTo(0.8);
    expect(spawnRate(w, 150)).toBeCloseTo(1.9);
    expect(spawnRate(w, 300)).toBe(0);
    expect(FOREST.cap(0)).toBe(30);
    expect(FOREST.cap(720)).toBe(400);
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors/data.test.ts`
Expected: FAIL（モジュールが無い）

- [ ] **Step 3: 表と関数を書く**

上の表をそのまま写す。`weaponStats` と `upText` は次のとおり。

```ts
const LABEL: Record<keyof WeaponStats, string> = {
  damage: 'ダメージ',
  cooldown: '待ち時間',
  amount: '発射数',
  area: '大きさ',
  speed: '速さ',
  pierce: '貫通',
  duration: '時間',
  knockback: 'ふきとばし'
};

export function weaponStats(def: WeaponDef, level: number): WeaponStats {
  const s = { ...def.base };
  for (const up of def.ups.slice(0, level - 1))
    for (const [k, v] of Object.entries(up) as [keyof WeaponStats, number][]) s[k] += v;
  return s;
}

/** damage・area・speed・duration は Lv1 に対する割合、ほかは数で書く */
export function upText(def: WeaponDef, level: number): string {
  const up = def.ups[level - 2];
  return (Object.entries(up) as [keyof WeaponStats, number][])
    .map(([k, v]) => {
      if (k === 'amount' || k === 'pierce') return `${LABEL[k]} +${v}`;
      if (k === 'cooldown') return `${LABEL[k]} -${Math.round((-v / def.base.cooldown) * 100)}%`;
      if (k === 'area') return `${LABEL[k]} +${Math.round(v * 100)}%`;
      return `${LABEL[k]} +${Math.round((v / def.base[k]) * 100)}%`;
    })
    .join('・');
}
```

`spawnRate(w, t)` は `t < w.from || t >= w.to` なら 0、そうでなければ `w.rate[0] + (w.rate[1] - w.rate[0]) * (t - w.from) / (w.to - w.from)`。

- [ ] **Step 4: テストを通す**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors/data.test.ts`
Expected: PASS

- [ ] **Step 5: commit**

```bash
git add src/lib/games/animal-survivors
git commit -m "Add Animal Survivors' data tables: animals, weapons with level-ups, passives, enemies, and the forest's waves"
```

---

### Task 3: 世界の土台（移動・出現・敵の動き・接触・時間）

**Files:**

- Create: `rng.ts`, `grid.ts`, `world.ts`
- Test: `world.test.ts`

**Interfaces:**

- Consumes: Task 2 のすべて
- Produces:

```ts
// rng.ts
export type Rng = () => number; // 0..1
export function rng(seed: number): Rng; // mulberry32

// grid.ts
export class Grid {
  constructor(cell?: number); // 既定 32
  clear(): void;
  add(i: number, x: number, y: number): void;
  /** (x, y) から r 以内のセルにある番号を out に入れて返す（距離の判定は呼ぶ側） */
  near(x: number, y: number, r: number, out: number[]): number[];
}

// world.ts
export interface Enemy {
  alive: boolean;
  def: EnemyDef;
  x: number;
  y: number;
  kx: number;
  ky: number;
  hp: number;
  flash: number;
  t: number;
  phase: number;
  state: 0 | 1 | 2;
  dx: number;
  dy: number;
  hit: Float64Array;
}
export interface Player {
  x: number;
  y: number;
  hp: number;
  facing: 1 | -1;
  aimX: number;
  aimY: number;
  invuln: number;
  moving: boolean;
  attack: number;
  hurt: number;
}
export interface Owned {
  id: string;
  level: number;
}
export type GameEvent =
  | { type: 'hit'; x: number; y: number; dmg: number; crit: boolean }
  | { type: 'kill'; x: number; y: number; enemy: string }
  | { type: 'pickup'; value: number }
  | { type: 'heal'; amount: number }
  | { type: 'magnet' }
  | { type: 'hurt'; dmg: number }
  | { type: 'fire'; weapon: string }
  | { type: 'levelup' }
  | { type: 'clear' }
  | { type: 'dead' };
export interface World {
  rand: Rng;
  time: number;
  stage: Stage;
  animal: Animal;
  stats: Stats;
  player: Player;
  weapons: (Owned & { cd: number })[];
  passives: Owned[];
  enemies: Enemy[];
  shots: Shot[];
  effects: Effect[];
  gems: Gem[];
  items: Item[]; // Shot・Effect は Task 4、Gem・Item は Task 5 が中身を定義する
  level: number;
  xp: number;
  xpTotal: number;
  kills: number;
  pending: number;
  over: null | 'dead' | 'clear';
  view: { w: number; h: number };
  events: GameEvent[];
  spawnAcc: number[];
  grid: Grid;
}
export const MAX_ENEMIES = 400;
export function createWorld(animal: AnimalId, seed: number, view: { w: number; h: number }): World; // 敵のプールは空で始める
export function makeEnemy(def: EnemyDef, x: number, y: number, hp: number): Enemy; // 生きている敵を 1 体作る（テストでも使う）
export function step(w: World, input: { x: number; y: number }, dt: number): void;
export function spawnPoint(w: World, out?: { x: number; y: number }): { x: number; y: number }; // 画面の外の輪
export function damageEnemy(w: World, i: number, dmg: number, kx: number, ky: number): void; // Task 4 も使う
```

`Shot`・`Effect` は Task 4 の `arms.ts`、`Gem`・`Item` は Task 5 の `drops.ts` で export し、`world.ts` は型だけを import する。Task 3 の時点では `arms.ts` と `drops.ts` に型と空の `fire(w, dt)`・`hits(w, dt)`・`collect(w, dt)`・`dropFrom(w, enemy)` を置き、`step` から呼んでおく。

**`step(w, input, dt)` の順番**

1. `w.events.length = 0`。`w.over` か `w.pending > 0` なら何もしない。
2. `w.time += dt`。`w.time >= stage.length` なら残りの敵を全員倒し（撃破には数えるが玉は落とさない）、`over = 'clear'`、`clear` を出して戻る。
3. 自分を動かす。`input` は長さ 1 以下の向き。速さは `60 * stats.speed` px/秒。動いていれば `aimX/aimY` を向きに、`facing` を x の符号に（0 なら前のまま）。`invuln`・`hurt`・`attack` を dt だけ減らす。`hp = Math.min(maxHp, hp + regen * dt)`。
4. 出現。出現表の行ごとに `spawnAcc[i] += spawnRate * dt`、1 以上で 1 体ずつ出す。生きている敵が `cap(time)` 以上なら出さずに溜めもしない。HP は `def.hp * toughness(time)`。プールの死んだ枠を使い、無ければ `MAX_ENEMIES` まで足す。
5. 敵を動かす（下の表）。ノックバックは `kx, ky` を毎秒 `0.0001` 倍の速さで減らして足す（`k *= Math.pow(1e-4, dt)`）。
6. 格子を作り直し、敵どうしを押し合う。近い 4 体までと比べ、重なりの半分ずつ押し返す。
7. 遠すぎる敵を回す。自分からの距離が `Math.hypot(view.w, view.h) * 0.9` を超えたら、`spawnPoint()` へ置き直す（HP はそのまま）。
8. 接触。`invuln <= 0` のとき、`r + 5` 以内の敵のうち `atk` がいちばん大きいものから `Math.max(1, atk - armor)` を受け、`invuln = 0.5`、`hurt = 0.3`、`hurt` を出す。`hp <= 0` なら `over = 'dead'`、`dead` を出す。
9. `fire(w, dt)`・`hits(w, dt)`・`collect(w, dt)` を呼ぶ（Task 4・5）。

| move   | 動き方                                                                                                                                                                 |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| chase  | 自分へまっすぐ                                                                                                                                                         |
| wave   | 自分への向きに、直角の向きを `sin(t * 6 + phase) * 0.8` だけ混ぜる                                                                                                     |
| snake  | 自分への向きに、直角の向きを `sin(t * 3 + phase) * 0.5` だけ混ぜる                                                                                                     |
| charge | state 0 は追う。60 px 以内に入ったら state 1 で 0.6 秒止まり（そのときの自分への向きを `dx, dy` に覚える）、state 2 で 4 倍の速さで 0.8 秒まっすぐ走り、state 0 へ戻る |

`spawnPoint` は、自分を中心に半径 `Math.hypot(view.w, view.h) / 2 + 24` の円周上のでたらめな角度。自分が動いていれば、角度を動く向きの ±90° に寄せる確率を 0.6 にする（進む先から来る）。

`damageEnemy(w, i, dmg, kx, ky)` は `hp -= dmg`、`flash = 0.12`、`kx += kx * (1 - heavy)` の形で吹き飛ばしを足し、`hit` を出す。`hp <= 0` で `alive = false`、`kills += 1`、`kill` を出し、`dropFrom(w, enemy)` を呼ぶ。会心の判定は呼ぶ側（Task 4）が行い、`hit` の `crit` は引数で渡す（`damageEnemy(w, i, dmg, kx, ky, crit = false)`）。

- [ ] **Step 1: テストを書く**

```ts
// world.test.ts
import { describe, expect, it } from 'vitest';
import { ENEMIES } from './enemies';
import { Grid } from './grid';
import { createWorld, makeEnemy, spawnPoint, step } from './world';

const VIEW = { w: 260, h: 380 };
const still = { x: 0, y: 0 };

describe('格子', () => {
  it('near は近いセルのものだけを返す', () => {
    const g = new Grid(32);
    g.add(0, 0, 0);
    g.add(1, 40, 0);
    g.add(2, 400, 400);
    expect(g.near(0, 0, 50, []).sort()).toEqual([0, 1]);
  });
});

describe('世界', () => {
  it('自分は入力の向きに 60 × speed px/秒で動き、向きを覚える', () => {
    const w = createWorld('dog', 1, VIEW);
    step(w, { x: -1, y: 0 }, 0.5);
    expect(w.player.x).toBeCloseTo(-30);
    expect(w.player.facing).toBe(-1);
  });

  it('序盤は出現表どおりにネズミが出る', () => {
    const w = createWorld('dog', 1, VIEW);
    w.weapons = []; // 武器で倒さないように
    for (let i = 0; i < 300; i++) step(w, still, 1 / 30); // 10 秒
    const alive = w.enemies.filter((e) => e.alive);
    expect(alive.length).toBeGreaterThanOrEqual(7);
    expect(new Set(alive.map((e) => e.def.id))).toEqual(new Set(['rat']));
  });

  it('同じ種なら同じ展開になる', () => {
    const run = () => {
      const w = createWorld('wolf', 7, VIEW);
      for (let i = 0; i < 900; i++) step(w, { x: Math.sin(i / 50), y: Math.cos(i / 70) }, 1 / 30);
      return [w.kills, w.player.hp, w.enemies.filter((e) => e.alive).length];
    };
    expect(run()).toEqual(run());
  });

  it('敵に触れると HP が減り、しばらく無敵になる', () => {
    const w = createWorld('dog', 1, VIEW);
    w.weapons = [];
    w.enemies.push(makeEnemy(ENEMIES.rat, 3, 0, 6));
    step(w, still, 1 / 60);
    expect(w.player.hp).toBe(95);
    step(w, still, 1 / 60);
    expect(w.player.hp).toBe(95);
  });

  it('回し直す位置はいつも画面の外', () => {
    const w = createWorld('dog', 3, VIEW);
    w.player.x = 1000;
    w.player.moving = true;
    w.player.aimX = 1;
    for (let i = 0; i < 500; i++) {
      const p = spawnPoint(w);
      const inside = Math.abs(p.x - w.player.x) < VIEW.w / 2 && Math.abs(p.y - w.player.y) < VIEW.h / 2;
      expect(inside).toBe(false);
    }
  });

  it('900 秒でクリアになり、HP 0 でゲームオーバーになる', () => {
    const a = createWorld('dog', 1, VIEW);
    a.time = 899.99;
    step(a, still, 0.02);
    expect(a.over).toBe('clear');
    const b = createWorld('dog', 1, VIEW);
    b.player.hp = 1;
    b.weapons = [];
    b.enemies.push(makeEnemy(ENEMIES.rat, 0, 0, 6));
    step(b, still, 1 / 60);
    expect(b.over).toBe('dead');
    expect(b.events.map((e) => e.type)).toContain('dead');
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors/world.test.ts`
Expected: FAIL

- [ ] **Step 3: `rng.ts`・`grid.ts`・`world.ts` を書く**

```ts
// rng.ts
export type Rng = () => number;
export function rng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

```ts
// grid.ts
/** 毎フレーム作り直す。セルの配列は使い回し、空のセルも消さない */
export class Grid {
  readonly #cell: number;
  readonly #cells = new Map<number, number[]>();
  constructor(cell = 32) {
    this.#cell = cell;
  }
  #key(cx: number, cy: number) {
    return (cx + 32768) * 65536 + (cy + 32768);
  }
  clear() {
    for (const list of this.#cells.values()) list.length = 0;
  }
  add(i: number, x: number, y: number) {
    const k = this.#key(Math.floor(x / this.#cell), Math.floor(y / this.#cell));
    let list = this.#cells.get(k);
    if (!list) this.#cells.set(k, (list = []));
    list.push(i);
  }
  near(x: number, y: number, r: number, out: number[]) {
    out.length = 0;
    const c = this.#cell;
    for (let cx = Math.floor((x - r) / c); cx <= Math.floor((x + r) / c); cx++)
      for (let cy = Math.floor((y - r) / c); cy <= Math.floor((y + r) / c); cy++) {
        const list = this.#cells.get(this.#key(cx, cy));
        if (list) for (const i of list) out.push(i);
      }
    return out;
  }
}
```

`world.ts` は上の「`step` の順番」と動き方の表のとおりに書く。`createWorld` は `player` を原点・`hp = stats.maxHp`・`facing = 1`・`aimX = 1` で作り、`weapons` に動物の初期武器を Lv1・`cd = 0.3` で入れ、`level = 1`、`spawnAcc` を出現表の行数の 0 で埋める。敵の `hit` は `new Float64Array(6).fill(-1)`（武器の枠ごとの最後に当たった時刻）。

- [ ] **Step 4: テストを通す**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors/world.test.ts`
Expected: PASS

- [ ] **Step 5: commit**

```bash
git add src/lib/games/animal-survivors
git commit -m "Add Animal Survivors' world: movement, waves, enemy moves, crowd pushing, wrap-around, contact damage, and the 15-minute clock"
```

---

### Task 4: 武器 7 種

**Files:**

- Modify: `arms.ts`（Task 3 で置いた空の関数を中身にする）
- Test: `arms.test.ts`

**Interfaces:**

- Consumes: `World`, `damageEnemy`, `weaponStats`, `WEAPONS`
- Produces:

```ts
export interface Shot {
  alive: boolean;
  slot: number;
  kind: 'shot' | 'boomerang' | 'homing' | 'orbit';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  age: number;
  r: number;
  dmg: number;
  pierce: number;
  hits: number[];
  angle: number;
}
export interface Effect {
  alive: boolean;
  slot: number;
  kind: 'swipe' | 'ring' | 'bolt' | 'burst';
  x: number;
  y: number;
  age: number;
  life: number;
  r: number;
  angle: number;
  born: number;
}
export function fire(w: World, dt: number): void; // 待ち時間を減らし、0 以下で撃つ
export function hits(w: World, dt: number): void; // 弾とエフェクトを動かして当てる
export function power(w: World, base: number): { dmg: number; crit: boolean }; // might と crit を掛ける
```

**武器の種類ごとの動き（基本の大きさは `area` 倍する）**

| kind      | 撃つとき                                                                                                                            | 当たり                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| shot      | いちばん近い敵（いなければ `aim`）へ、`amount` 発を 12° ずつ広げて撃つ。半径 4、`life = duration`                                   | 当たった敵を `hits` に入れ、`pierce` を 1 減らし、0 で消える                                     |
| swipe     | `aim` の向き（2 発目は逆向き）に半径 26 の 110° の扇。`life = duration`                                                             | 生まれた時点で 1 回だけ、扇の中の敵へ                                                            |
| ring      | 自分の位置で半径 0 → 56 に `life` で広がる輪                                                                                        | 縁から ±6 にいて、まだこの輪に当たっていない敵（`enemy.hit[slot] < born`）へ。外向きに吹き飛ばす |
| boomerang | `aim` の向き（2 本目以降は 25° ずつずらす）へ `speed` で出て、毎秒 `speed × 1.6` で減速し、戻りは自分へ。半径 6、自分に戻ると消える | 同じ敵へは 0.35 秒あけて                                                                         |
| orbit     | `amount` 枚を等間隔の角度に置き、`duration` 秒だけ自分の周り半径 30 を `speed` ラジアン/秒で回る。待ち時間は消えてから数える        | 同じ敵へは 0.4 秒あけて。半径 5                                                                  |
| strike    | 画面の中の生きている敵から `amount` 体をでたらめに選び、その位置に `bolt`                                                           | その位置から半径 14 の敵へ 1 回                                                                  |
| homing    | `amount` 発を `aim` の向きに出す。毎秒 4 ラジアンまで、いちばん近い敵へ曲がる。半径 4                                               | 当たったら半径 16 の `burst` を出して周りへ。弾は消える                                          |

- 撃つたびに `fire` を出し、`player.attack = 0.15` にする（攻撃のコマを見せる）。
- 待ち時間は `cooldown * Math.max(0.35, 1 - stats.haste)`。
- ダメージは `power(w, damage)`。`dmg = damage * might`、`rand() < crit` なら 2 倍で `crit = true`。
- 吹き飛ばしは当たった向きに `knockback` px/秒。
- 弾は自分から `Math.hypot(view.w, view.h)` 以上離れたら消える。

- [ ] **Step 1: テストを書く**

```ts
// arms.test.ts
import { describe, expect, it } from 'vitest';
import { ENEMIES } from './enemies';
import { createWorld, makeEnemy, step } from './world';

const VIEW = { w: 260, h: 380 };
const still = { x: 0, y: 0 };

function only(weapon: string, level = 1) {
  const w = createWorld('dog', 5, VIEW);
  w.weapons = [{ id: weapon, level, cd: 0 }];
  w.stage = { ...w.stage, waves: [] };
  w.spawnAcc = [];
  w.stats.crit = 0;
  return w;
}

const run = (w: ReturnType<typeof only>, seconds: number) => {
  for (let i = 0; i < seconds * 60; i++) step(w, still, 1 / 60);
};

describe('武器', () => {
  it('ワンワンショットは近い敵へ飛んで当たる', () => {
    const w = only('woof');
    w.enemies.push(makeEnemy(ENEMIES.caterpillar, 60, 0, 100));
    run(w, 0.6);
    expect(w.enemies[0].hp).toBe(90);
  });

  it('Lv3 は 2 発になる', () => {
    const w = only('woof', 3);
    w.enemies.push(makeEnemy(ENEMIES.caterpillar, 60, 0, 1000));
    step(w, still, 1 / 60);
    expect(w.shots.filter((s) => s.alive)).toHaveLength(2);
  });

  it('ネコパンチは向いている側だけを引っかく', () => {
    const w = only('paw');
    w.enemies.push(makeEnemy(ENEMIES.caterpillar, 15, 0, 100), makeEnemy(ENEMIES.caterpillar, -15, 0, 100));
    step(w, still, 1 / 60);
    expect(w.enemies[0].hp).toBe(91);
    expect(w.enemies[1].hp).toBe(100);
  });

  it('遠吠えの輪は 1 回の輪で同じ敵に 1 度だけ当たる', () => {
    const w = only('howl');
    w.enemies.push(makeEnemy(ENEMIES.caterpillar, 30, 0, 1000));
    w.enemies[0].def = { ...ENEMIES.caterpillar, speed: 0, heavy: 1 };
    run(w, 0.5);
    expect(w.enemies[0].hp).toBe(988);
  });

  it('羽根の嵐は同じ敵に間をあけて何度も当たる', () => {
    const w = only('feather');
    w.enemies.push(makeEnemy({ ...ENEMIES.caterpillar, speed: 0, heavy: 1 }, 30, 0, 1000));
    run(w, 2);
    const hits = (1000 - w.enemies[0].hp) / 7;
    expect(hits).toBeGreaterThanOrEqual(2);
    expect(hits).toBeLessThanOrEqual(6);
  });

  it('雷撃は画面の中の敵にだけ落ちる', () => {
    const w = only('thunder');
    w.enemies.push(makeEnemy(ENEMIES.rat, 1000, 0, 100), makeEnemy(ENEMIES.rat, 50, 50, 100));
    step(w, still, 1 / 60);
    expect(w.enemies[0].hp).toBe(100);
    expect(w.enemies[1].hp).toBe(78);
  });

  it('攻撃力と会心が掛かる', () => {
    const w = only('woof');
    w.stats.might = 1.5;
    w.stats.crit = 1;
    w.enemies.push(makeEnemy(ENEMIES.caterpillar, 60, 0, 100));
    run(w, 0.6);
    expect(w.enemies[0].hp).toBe(70);
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors/arms.test.ts`
Expected: FAIL

- [ ] **Step 3: `arms.ts` を書く**

上の表のとおりに、`fire` は `switch (def.kind)` で弾かエフェクトを作り、`hits` は弾を動かしてから `w.grid.near()` で近い敵を拾い、距離 `< shot.r + enemy.def.r` で当てる。弾とエフェクトもプール（`alive` が false の枠を使い回す）。

- [ ] **Step 4: テストを通す**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors/arms.test.ts`
Expected: PASS

- [ ] **Step 5: commit**

```bash
git add src/lib/games/animal-survivors
git commit -m "Add Animal Survivors' seven weapon kinds: shot, swipe, ring, boomerang, orbit, strike, and homing"
```

---

### Task 5: 経験値・ドロップ・3 択

**Files:**

- Modify: `drops.ts`（Task 3 の空の関数を中身にする）
- Create: `choices.ts`
- Test: `drops.test.ts`

**Interfaces:**

- Consumes: `World`, `stats()`, `WEAPONS`, `PASSIVES`, `MAX_LEVEL`
- Produces:

```ts
// drops.ts
export interface Gem {
  alive: boolean;
  x: number;
  y: number;
  value: number;
  pulled: boolean;
}
export interface Item {
  alive: boolean;
  kind: 'meat' | 'magnet';
  x: number;
  y: number;
  pulled: boolean;
}
export const MAX_GEMS = 400;
export function xpNeed(level: number): number;
export function gainXp(w: World, value: number): void;
export function dropGem(w: World, x: number, y: number, value: number): void;
export function dropFrom(w: World, e: Enemy): void;
export function collect(w: World, dt: number): void;
export function gemTier(value: number): 0 | 1 | 2; // 描く色。1〜4 は青、5〜19 は緑、20 以上は赤

// choices.ts
export type Choice =
  | { kind: 'weapon'; id: string; level: number }
  | { kind: 'passive'; id: string; level: number }
  | { kind: 'meat' }
  | { kind: 'bag' };
export const SLOTS = 6;
export function choices(w: World, n?: number): Choice[]; // 既定 3
export function apply(w: World, c: Choice): void;
```

**決まり**

- `xpNeed(level)` は、Lv1→2 が 5、Lv20 まで 1 Lv ごとに +10、そこから Lv40 まで +13、それより上は +16。
- `gainXp(w, v)` は `v * stats.growth` を `xp` と `xpTotal` に足し、`xp >= xpNeed(level)` のあいだ `xp -= need`、`level += 1`、`pending += 1`、`levelup` を出す。
- `dropFrom` は、敵の `xp` の玉を必ず 1 個、`rand() < 0.012` で肉、`rand() < 0.004` で磁石を落とす。
- `dropGem` は、生きている玉が `MAX_GEMS` 個あるとき、自分からいちばん遠い玉に値を足す（新しい玉は作らない）。
- `collect` は、自分から `24 * stats.magnet` 以内の玉と物を `pulled` にし、`pulled` のものは自分へ毎秒 `220` px で寄せる。8 px 以内で拾う。玉は `gainXp` と `pickup`、肉は HP を 30 回復して `heal`、磁石は生きている玉をすべて `pulled` にして `magnet`。
- `choices` の候補は、持っている武器・パッシブで Lv5 未満のもの（次の Lv）と、枠（6）が空いていれば持っていないもの（Lv1）。重みはすべて 1 で、重なりなしに `n` 個選ぶ。足りなければ `meat`、`bag` の順で埋める（同じ札は 1 枚まで。`n` が 3 なら 3 枚目も足りないときは `meat` と `bag` の 2 枚だけで返す）。
- `apply` は `pending -= 1`。武器は Lv を上げるか `cd: 0` で足す。パッシブは Lv を上げるか足し、`w.stats = stats(w.animal, w.passives)` を作り直す。最大 HP が増えたら増えた分だけ今の HP も足す。`meat` は HP を最大の 30% 回復、`bag` は `gainXp(w, 25)`（ここで Lv が上がれば `pending` が増える）。

- [ ] **Step 1: テストを書く**

```ts
// drops.test.ts
import { describe, expect, it } from 'vitest';
import { apply, choices, SLOTS } from './choices';
import { collect, dropGem, gainXp, MAX_GEMS, xpNeed } from './drops';
import { PASSIVES } from './passives';
import { MAX_LEVEL, WEAPONS } from './weapons';
import { createWorld } from './world';

const VIEW = { w: 260, h: 380 };
const fresh = () => createWorld('dog', 2, VIEW);

describe('経験値', () => {
  it('必要量は 5 から 10 ずつ、Lv20 から 13 ずつ増える', () => {
    expect(xpNeed(1)).toBe(5);
    expect(xpNeed(2)).toBe(15);
    expect(xpNeed(20)).toBe(195);
    expect(xpNeed(21)).toBe(208);
  });

  it('一度に 2 つ上がれば 3 択が 2 回たまる', () => {
    const w = fresh();
    gainXp(w, 20);
    expect(w.level).toBe(3);
    expect(w.pending).toBe(2);
    expect(w.events.filter((e) => e.type === 'levelup')).toHaveLength(2);
  });

  it('玉があふれたら遠い玉に値を足し、経験値は消えない', () => {
    const w = fresh();
    for (let i = 0; i < MAX_GEMS; i++) dropGem(w, 100 + i, 0, 1);
    dropGem(w, 50, 0, 7);
    const alive = w.gems.filter((g) => g.alive);
    expect(alive).toHaveLength(MAX_GEMS);
    expect(alive.reduce((s, g) => s + g.value, 0)).toBe(MAX_GEMS + 7);
    expect(alive.find((g) => g.x === 100 + MAX_GEMS - 1)!.value).toBe(8);
  });

  it('近い玉は吸い寄せられて拾える', () => {
    const w = fresh();
    dropGem(w, 20, 0, 3);
    for (let i = 0; i < 30; i++) collect(w, 1 / 60);
    expect(w.xp).toBe(3);
  });
});

describe('3 択', () => {
  it('同じものは重ならず、3 枚出る', () => {
    const w = fresh();
    const c = choices(w);
    expect(c).toHaveLength(3);
    expect(new Set(c.map((x) => JSON.stringify(x))).size).toBe(3);
  });

  it('枠が埋まったら持っていないものは出ない', () => {
    const w = fresh();
    w.weapons = Object.keys(WEAPONS)
      .slice(0, SLOTS)
      .map((id) => ({ id, level: 1, cd: 0 }));
    w.passives = Object.keys(PASSIVES)
      .slice(0, SLOTS)
      .map((id) => ({ id, level: 1 }));
    for (let i = 0; i < 50; i++)
      for (const c of choices(w)) {
        if (c.kind === 'weapon') expect(w.weapons.some((o) => o.id === c.id)).toBe(true);
        if (c.kind === 'passive') expect(w.passives.some((o) => o.id === c.id)).toBe(true);
      }
  });

  it('全部 Lv5 なら肉と袋だけになり、選び続けても止まる', () => {
    const w = fresh();
    w.weapons = Object.keys(WEAPONS)
      .slice(0, SLOTS)
      .map((id) => ({ id, level: MAX_LEVEL, cd: 0 }));
    w.passives = Object.keys(PASSIVES)
      .slice(0, SLOTS)
      .map((id) => ({ id, level: MAX_LEVEL }));
    w.pending = 1;
    expect(choices(w).map((c) => c.kind)).toEqual(['meat', 'bag']);
    let guard = 0;
    while (w.pending > 0 && guard++ < 1000) apply(w, { kind: 'bag' });
    expect(w.pending).toBe(0);
  });

  it('パッシブを取るとステータスが変わり、最大 HP の分だけ今の HP も増える', () => {
    const w = fresh();
    w.pending = 1;
    w.player.hp = 50;
    apply(w, { kind: 'passive', id: 'heart', level: 1 });
    expect(w.stats.maxHp).toBe(120);
    expect(w.player.hp).toBe(70);
    expect(w.pending).toBe(0);
  });

  it('武器を取ると Lv が上がる', () => {
    const w = fresh();
    w.pending = 1;
    apply(w, { kind: 'weapon', id: 'woof', level: 2 });
    expect(w.weapons[0].level).toBe(2);
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors/drops.test.ts`
Expected: FAIL

- [ ] **Step 3: `drops.ts` と `choices.ts` を書く**

上の決まりのとおり。`choices` の並べ替えは `w.rand` を使った Fisher–Yates。

- [ ] **Step 4: テストを通す**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors`
Expected: PASS（Task 1〜5 のすべて）

- [ ] **Step 5: commit**

```bash
git add src/lib/games/animal-survivors
git commit -m "Add Animal Survivors' experience, drops, and level-up choices"
```

---

### Task 6: 入力

**Files:**

- Create: `input.ts`
- Test: `input.test.ts`

**Interfaces:**

- Produces:

```ts
export type Vec = { x: number; y: number };
export function keyVector(keys: ReadonlySet<string>): Vec; // KeyboardEvent.code の集合
export function stickVector(dx: number, dy: number, radius: number): Vec; // 遊び 15%、長さ 1 まで
export function padVector(axes: readonly number[] | undefined): Vec; // 左スティック、遊び 0.2
export function pick(...vs: Vec[]): Vec; // 先に 0 でないものを使う。呼ぶ側は 指・キー・パッドの順に渡す
```

- [ ] **Step 1: テストを書く**

```ts
// input.test.ts
import { describe, expect, it } from 'vitest';
import { keyVector, padVector, pick, stickVector } from './input';

describe('入力', () => {
  it('WASD と矢印キーは同じ向き、斜めは長さ 1', () => {
    expect(keyVector(new Set(['KeyW']))).toEqual({ x: 0, y: -1 });
    expect(keyVector(new Set(['ArrowLeft']))).toEqual({ x: -1, y: 0 });
    const d = keyVector(new Set(['KeyD', 'ArrowDown']));
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(1);
    expect(keyVector(new Set(['KeyA', 'KeyD']))).toEqual({ x: 0, y: 0 });
  });

  it('スティックは遊びの中では 0、半径の外では長さ 1', () => {
    expect(stickVector(3, 0, 40)).toEqual({ x: 0, y: 0 });
    expect(stickVector(20, 0, 40).x).toBeCloseTo(0.5);
    expect(stickVector(0, 400, 40)).toEqual({ x: 0, y: 1 });
  });

  it('パッドは遊び 0.2', () => {
    expect(padVector([0.1, 0.1])).toEqual({ x: 0, y: 0 });
    expect(padVector([1, 0]).x).toBeCloseTo(1);
    expect(padVector(undefined)).toEqual({ x: 0, y: 0 });
  });

  it('指とキーを同時に使ったら指を優先する', () => {
    expect(pick({ x: 0, y: 1 }, { x: 1, y: 0 })).toEqual({ x: 0, y: 1 });
    expect(pick({ x: 0, y: 0 }, { x: 1, y: 0 })).toEqual({ x: 1, y: 0 });
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors/input.test.ts`
Expected: FAIL

- [ ] **Step 3: `input.ts` を書く**

```ts
export type Vec = { x: number; y: number };
const ZERO = { x: 0, y: 0 };

function unit(x: number, y: number): Vec {
  const len = Math.hypot(x, y);
  return len === 0 ? ZERO : { x: x / len, y: y / len };
}

export function keyVector(keys: ReadonlySet<string>): Vec {
  const has = (...k: string[]) => k.some((c) => keys.has(c));
  const x = (has('KeyD', 'ArrowRight') ? 1 : 0) - (has('KeyA', 'ArrowLeft') ? 1 : 0);
  const y = (has('KeyS', 'ArrowDown') ? 1 : 0) - (has('KeyW', 'ArrowUp') ? 1 : 0);
  return unit(x, y);
}

export function stickVector(dx: number, dy: number, radius: number): Vec {
  const len = Math.hypot(dx, dy) / radius;
  if (len < 0.15) return ZERO;
  const k = Math.min(1, len) / (len * radius);
  return { x: dx * k, y: dy * k };
}

export function padVector(axes: readonly number[] | undefined): Vec {
  const [x = 0, y = 0] = axes ?? [];
  const len = Math.hypot(x, y);
  if (len < 0.2) return ZERO;
  const k = Math.min(1, len) / len;
  return { x: x * k, y: y * k };
}

export function pick(...vs: Vec[]): Vec {
  return vs.find((v) => v.x !== 0 || v.y !== 0) ?? ZERO;
}
```

- [ ] **Step 4: テストを通す**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors/input.test.ts`
Expected: PASS

- [ ] **Step 5: commit**

```bash
git add src/lib/games/animal-survivors
git commit -m "Add Animal Survivors' input: keys, a floating touch stick, and a gamepad"
```

---

### Task 7: 描画とプレイ画面

**Files:**

- Create: `font.ts`, `effects.ts`, `draw.ts`, `hud.ts`, `sounds.ts`, `Play.svelte`, `LevelUp.svelte`, `PixelIcon.svelte`, `Survivors.svelte`（この Task では犬で `Play` を出すだけ）, `Howto.svelte`, `meta.ts`
- Modify: `src/lib/games.ts`（import と `games` 配列に 1 行）
- Test: `draw.test.ts`

**Interfaces:**

- Consumes: Task 1〜6 のすべて
- Produces:

```ts
// draw.ts
export interface ViewSize {
  scale: number;
  w: number;
  h: number;
} // 仮想画面の 1 ドット = scale 画素
export function viewSize(cssW: number, cssH: number, dpr: number): ViewSize;
export function draw(ctx: CanvasRenderingContext2D, w: World, fx: Effects, v: ViewSize, now: number): void;

// effects.ts（見た目だけ。ルールに影響しない）
export class Effects {
  take(w: World): void; // w.events から粒・数字・揺れ・光を作る
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number): void;
  shake: number; // 今の揺れ（px）
}

// font.ts
export function text(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  color: string,
  size?: 1 | 2
): number; // 幅を返す。0-9 A-Z : . / + - % と空白

// hud.ts
export function hud(ctx: CanvasRenderingContext2D, w: World, v: ViewSize, top: number): void; // top は仮想ドットでの上の余白

// sounds.ts
export const sounds: {
  hit(): void;
  kill(): void;
  pickup(chain: number): void;
  levelup(): void;
  hurt(): void;
  magnet(): void;
  heal(): void;
  clear(): void;
  dead(): void;
};
```

**仮想画面**

`viewSize(cssW, cssH, dpr)` は `scale = Math.max(2, Math.round((cssW * dpr) / 260))`、`w = Math.ceil((cssW * dpr) / scale)`、`h = Math.ceil((cssH * dpr) / scale)`。`cssW` と `cssH` は canvas の `offsetWidth` と `offsetHeight`（`BoardInput.px(1, 1)` と同じ。横向きで回っても盤面そのものの大きさになる）。

**描く順番（`draw`）**

1. `ctx.setTransform(scale, 0, 0, scale, 0, 0)`、`imageSmoothingEnabled = false`。カメラは自分を中心に、揺れを足して整数に丸める。
2. 地面。画面に入る 16 px のタイルを、タイル座標の整数ハッシュで草の 4 コマから選んで敷き、ハッシュが 0.08 未満のタイルは土にする。
3. 飾り。48 px のセルごとに、セル座標のハッシュで「なし 55%・草むら 18%・花 12%・岩 6%・切り株 4%・木 5%」を選び、セルの中のずれもハッシュで決める。
4. 影（黒の 25% の横長の楕円を、ドットの四角 3 段で描く）を、玉以外のすべての下に。
5. 玉（2 コマで光る）と物。
6. 敵を y の順に。`flash > 0` なら白い版、向きは自分の側を向くよう反転。歩きは `Math.floor(t * 6) % 2`。
7. 自分。被弾中は `hurt` のコマ、`attack > 0` は攻撃のコマ、動いていれば歩き 4 コマ（毎秒 10 コマ）、止まっていれば 1 コマ目。無敵のあいだは 0.08 秒ごとに点滅。白いふち（1 ドット）は、白い版を上下左右に 1 ドットずらして 4 回描いてから本体を描く。HP が最大でなければ、足もとに幅 16 の小さな HP の棒。
8. 弾とエフェクト。骨は `age * 14` ラジアンで回し、ブーメランは大きめ、魚は進む向きへ回す。扇は白の 60% の弧、輪は白と淡い青の 2 重の円（線の太さ 2、`life` に応じて薄く）、雷は黄色と白のぎざぎざの線を上から、爆ぜは橙の円。エフェクトは `globalAlpha` 0.75 まで。
9. `Effects.draw`（粒・ダメージ数字）。
10. `hud()`。

**HUD（`hud.ts`）**

- 最上段に画面の幅いっぱいの EXP の棒（高さ 4、青）。
- 上の余白 `top`（`max(72px, safe-area + 60px)` を仮想ドットに直した値）の下に、左から `LV 12`、中央に `12:43`（大きい字）、右に撃破数（どくろのアイコンと数）。
- その下に HP の棒（幅 80、赤、数字つき）。
- 画面の下端に、武器 6 枠とパッシブ 6 枠のアイコン（12×12）を 2 列で並べ、それぞれ右下に Lv の点。
- 文字は `font.ts` の 3×5 字に 1 ドットの黒いふちを付ける。

**演出（`Effects.take`）**

| 出来事  | 見た目                                                                                          | 音                                                |
| ------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| hit     | ダメージ数字を 0.6 秒浮かべる（会心は size 2 の黄色）。数字は同時に 60 個まで、古いものから消す | 1 フレームに 1 回まで `hit`                       |
| kill    | 敵の色の 2×2 の粒を 6 個、白い粒を 2 個                                                         | 1 フレームに 1 回まで `kill`                      |
| pickup  | なし                                                                                            | `pickup(chain)`。0.3 秒以内に続いた数で音を上げる |
| hurt    | 揺れ 2 px                                                                                       | `hurt`                                            |
| levelup | 自分から白と黄の粒の輪                                                                          | `levelup`                                         |
| magnet  | 画面の縁が 0.3 秒青く光る                                                                       | `magnet`                                          |
| heal    | 緑の `+30`                                                                                      | `heal`                                            |

粒は 600 個のプールで、あふれたら新しい粒を捨てる。

**`Play.svelte`**

- props: `{ animal: AnimalId; onend: (w: World) => void }`。
- `onMount` で `createWorld(animal, Date.now() % 2 ** 31, ...)`、`animate(frame)` を回す。`ResizeObserver` で canvas の大きさを `viewSize` から決め直し、`w.view` を仮想画面の大きさにする。
- 入力は `BoardInput` の `down` / `move` / `up`。最初の 1 本の指だけを使い、置いた位置からのずれを `stickVector(dx, dy, 0.12 × 盤面の幅)` にする。指を置いた所に、薄い丸（外）と濃い丸（内）のスティックを HTML で出す。キーは `window` の `keydown` / `keyup`（`code` を Set に入れる。矢印キーと WASD は `preventDefault`）。`blur` で Set を空にする。パッドは毎フレーム `navigator.getGamepads?.()[0]?.axes`。
- 毎フレーム `step(w, pick(stick, keys, pad), dt)`、`fx.take(w)`、`fx.update(dt)`、`draw(...)`。`w.pending > 0` のあいだは `LevelUp` を重ね、`step` も `fx.update` も止める（描くのは続ける）。
- `document.hidden` のあいだは `step` を呼ばない（`visibilitychange` で `paused` を立てる。`animate` の dt の上限だけでは 15 分の時計が裏で進む）。
- `w.over` が立ったら 1.2 秒（`clear` は敵が倒れる演出のため 2 秒）待って `onend(w)`。
- `LevelUp` の選択肢は `w.pending` が増えた時点で `choices(w)` を作り、選んだら `apply(w, c)`。まだ `pending` が残っていれば次の `choices(w)` を出す。

**`LevelUp.svelte`**

- props: `{ options: Choice[]; owned: World; onpick: (c: Choice) => void }`。
- 「LEVEL UP!」の見出しと、縦に並ぶカード。カードは `PixelIcon`・名前・`NEW` か `Lv N`・説明（武器の新規は `blurb`、強化は `upText`、パッシブは `blurb`、肉は「HP を 30% 回復」、袋は「経験値 +25」）。
- 出てきた直後の誤タップを防ぐため、`Settle`（`$lib/settle.svelte`）を出てきたときに `begin()` し、`active` のあいだカードを `pointer-events: none` にする。`listen` は `onMount` で。
- キーボードでも選べる（1〜4 キーと、矢印キーでのフォーカス移動。カードは `<button>`）。
- 角ばった枠（`border: 3px solid #24151f`、内側に 2 px の明るい線、角を 4 px 欠いた `clip-path`）と、`#2b1d3a` 地のレトロな見た目。書体はヒラギノの太字。

**`PixelIcon.svelte`**

- props: `{ art: Art; frame?: number; size: string }`。小さな `<canvas>` に `bake()` を描き、CSS の `image-rendering: pixelated` で拡大する。

**`meta.ts`・`Howto.svelte`・`games.ts`**

```ts
// meta.ts
import type { GameMeta } from '$lib/games';

export default {
  id: 'animal-survivors',
  name: 'Animal Survivors',
  description: '動物を選んで、押し寄せる大群を 15 分生き延びる。攻撃は自動、レベルアップで技を選ぶ',
  players: 1,
  levels: 1,
  minutes: '15分',
  load: async () => ({
    Game: (await import('./Survivors.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
```

`Howto.svelte` は gate-run の形（`howto-rule` 1 行と `howto-legend` 3 つ）で、「指を置いてずらした向きへ走る。攻撃は自動」「玉を集めてレベルアップ」「15 分生き延びる」。`games.ts` の `games` 配列の先頭に `animalSurvivors` を足す。

- [ ] **Step 1: 仮想画面の大きさのテストを書く**

```ts
// draw.test.ts
import { describe, expect, it } from 'vitest';
import { viewSize } from './draw';

describe('仮想画面', () => {
  it('幅が 260 ドット前後になる整数の倍率を選ぶ', () => {
    expect(viewSize(820, 1180, 2)).toEqual({ scale: 6, w: 274, h: 394 });
    expect(viewSize(390, 844, 3)).toEqual({ scale: 5, w: 234, h: 507 });
  });

  it('小さな画面でも倍率は 2 より下げない', () => {
    expect(viewSize(200, 300, 1).scale).toBe(2);
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors/draw.test.ts`
Expected: FAIL

- [ ] **Step 3: `font.ts`・`effects.ts`・`draw.ts`・`hud.ts`・`sounds.ts` を書く**

上の決まりのとおり。効果音は `$lib/audio.svelte` の `tone` と `noise` で、`hit` は `noise(25, 0.03)`、`kill` は `tone(880, 30, 'square', 0.025)`、`pickup(chain)` は `tone(1200 + Math.min(chain, 20) * 40, 40, 'square', 0.03)`、`levelup` は 3 音の上がる和音、`hurt` は `tone(160, 120, 'sawtooth', 0.08)`。

- [ ] **Step 4: テストを通す**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors/draw.test.ts`
Expected: PASS

- [ ] **Step 5: `Play.svelte`・`LevelUp.svelte`・`PixelIcon.svelte`・`Survivors.svelte`・`Howto.svelte`・`meta.ts` を書き、`games.ts` に足す**

`Survivors.svelte` はこの Task では `<Play animal="dog" onend={() => {}} />` だけを出す（Task 8 で画面を切り替える）。Svelte のファイルを書いたら `svelte-autofixer` で確かめる。

- [ ] **Step 6: headless Chrome で遊ばせて撮る**

`<scratchpad>/play.mjs` を [[headless-play-harness]] の形で作る。`http://localhost:5173/asobibako/games/animal-survivors` を `viewport: { width: 820, height: 1180 }, hasTouch: true, deviceScaleFactor: 2` で開き、`clock.install({ time: 0 })` → `goto(..., { waitUntil: 'networkidle' })` → `button.go` を押す。円を描く向きのキー入力（`keyboard.down('KeyD')` などを 1 秒ごとに入れ替える）で動かし、`page.evaluate` でレベルアップのカードの 1 枚目を押し続けるボットを入れて、`clock.runFor` で進めながら 0:20・3:00・8:00・14:00 とレベルアップの画面を撮る。撮った画像を Read で見て、絵がにじんでいないこと、自分の位置が大群の中で見えること、HUD がシェルの ✕ と ↻ に重ならないことを確かめる。敵の多い 14:00 の場面で、`requestAnimationFrame` の間隔を 3 秒測って fps を出す（目標 60、50 を下回ったら描画を軽くする）。

- [ ] **Step 7: 確かめて commit**

Run: `pnpm test:run && pnpm check && pnpm lint && pnpm vitals --diff`
Expected: すべて通る

```bash
git add src/lib/games.ts src/lib/games/animal-survivors
git commit -m "Make Animal Survivors playable: pixel-scaled canvas, forest ground, HUD, effects, sounds, touch stick, keys, gamepad, and level-up cards"
```

---

### Task 8: キャラ選択とリザルト

**Files:**

- Create: `CharSelect.svelte`, `Result.svelte`
- Modify: `Survivors.svelte`

**Interfaces:**

- Consumes: `ANIMALS`, `ANIMAL_ART`, `World`, `WEAPONS`, `PASSIVES`, `PixelIcon`
- Produces:
  - `CharSelect` props: `{ onpick: (id: AnimalId) => void; last?: AnimalId }`
  - `Result` props: `{ run: RunSummary; onagain: () => void; onselect: () => void }`
  - `interface RunSummary { animal: AnimalId; cleared: boolean; time: number; level: number; kills: number; xp: number; weapons: Owned[]; passives: Owned[] }`（`Survivors.svelte` が `World` から作る。`world.ts` に `summary(w: World): RunSummary` として置き、テストする）

**`Survivors.svelte`**

- `screen: 'select' | 'play' | 'result'`、`animal`、`run`、`round`（`{#key round}` で `Play` を作り直す）。
- 「もう一度」は同じ動物で `round += 1` して `play` へ。「キャラ選択へ」は `select` へ。
- 最後に選んだ動物は、この画面のあいだだけ覚える（保存しない）。

**`CharSelect.svelte`**

- 見出し「キャラクターを選ぶ」。3 匹のカードを縦に並べる（横向きの iPad でも盤面は縦長なので縦でよい）。カードは歩きのアニメ（`PixelIcon` の `frame` を 0.1 秒ごとに進める）・名前・型（「バランス型」など）・HP / 速さ / 攻撃力の棒（3 匹の最大を満タンに）・初期武器のアイコンと名前と説明。
- カード全体が `<button>`。押したら `onpick`。

**`Result.svelte`**

- 見出しは `cleared` なら「生存成功！」、そうでなければ「GAME OVER」。
- 生存時間（`mm:ss`）・Lv・撃破数（3 けたごとに `,`）・獲得経験値・使ったキャラ（ドット絵と名前）・取った武器とパッシブ（アイコンと Lv）。
- 「もう一度」「キャラ選択へ」のボタン。下側に並べる（シェルの ✕ と ↻ は上の隅）。
- 倒れたときは指が画面に残っていることが多いので、`Settle` を出てきたときに `begin()` し、`active` のあいだボタンを `pointer-events: none` にする。

- [ ] **Step 1: `summary` のテストを足す**

```ts
// world.test.ts に足す
import { summary } from './world';

it('summary はリザルトに要るものを World から写す', () => {
  const w = createWorld('cat', 1, VIEW);
  w.time = 763.4;
  w.kills = 2384;
  w.level = 18;
  w.xpTotal = 12450;
  w.over = 'dead';
  expect(summary(w)).toEqual({
    animal: 'cat',
    cleared: false,
    time: 763.4,
    level: 18,
    kills: 2384,
    xp: 12450,
    weapons: [{ id: 'paw', level: 1 }],
    passives: []
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors/world.test.ts`
Expected: FAIL（`summary` が無い）

- [ ] **Step 3: `summary` と 3 つの画面を書く**

`summary` の `weapons` は `cd` を外して `{ id, level }` だけにする。Svelte のファイルは `svelte-autofixer` で確かめる。

- [ ] **Step 4: テストを通し、headless Chrome で通しで撮る**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors`
Expected: PASS

Task 7 の `play.mjs` に、キャラ選択で猫を押す → 遊ぶ → HP を 0 にして（`clock.runFor` で敵に囲ませる）リザルト → 「キャラ選択へ」→ 狼で遊ぶ、を足して撮る。結果の画面が出た直後に、指を離した位置の合成 click でボタンが押されないこと（`pointerdown` を残したまま倒れ、`pointerup` を投げて画面が変わらないこと）も確かめる。

- [ ] **Step 5: 確かめて commit**

Run: `pnpm test:run && pnpm check && pnpm lint && pnpm vitals --diff`
Expected: すべて通る

```bash
git add src/lib/games/animal-survivors
git commit -m "Add Animal Survivors' character select and result screen"
```

---

### Task 9: バランス・一覧の絵・文書

**Files:**

- Create (scratchpad、commit しない): `<scratchpad>/vitest.config.mjs`, `<scratchpad>/survivors.sim.ts`
- Modify: 数値の表（`animals.ts`・`weapons.ts`・`enemies.ts`・`stages/forest.ts`）
- Modify: `scripts/thumbs/scenes.ts`、`static/thumbs/animal-survivors.webp`（生成）
- Modify: `CLAUDE.md`、`docs/superpowers/specs/2026-10-02-animal-survivors-design.md`（決めた数値と違いが出たところ）

- [ ] **Step 1: ボットを書く**

[[balance-sim-harness]] の形で scratchpad に `vitest.config.mjs`（`resolve.alias.$lib` をリポジトリの `src/lib` に、`test.include: ['**/*.sim.ts']`、`server.fs.strict: false`）を置く。`survivors.sim.ts` は 3 匹 × 20 種で、次のボットを `dt = 1/30` で 900 秒まで回す。

- 動き方は、半径 60 px 以内の敵から離れる向きと、いちばん近い玉へ向かう向きを足したもの。
- 3 択は「でたらめ」と「武器の強化を先に、なければパッシブ」の 2 通り。

結果（生存時間・Lv・撃破数の中央値と最小・最大）は `<scratchpad>/sim.json` に書く。

Run: `pnpm exec vitest run --config <scratchpad>/vitest.config.mjs --root <scratchpad> survivors.sim.ts`

- [ ] **Step 2: 数値を直す**

目安は、でたらめに選ぶと 8〜12 分で倒れ、考えて選ぶと半分以上が 15 分に届くこと。3 匹の生存時間の中央値の差は 2 分以内。直したら `data.test.ts` などの数値の期待も合わせる。

- [ ] **Step 3: 一覧の絵を撮る**

`scripts/thumbs/scenes.ts` に、gate-run と同じ形の場面を足す（`startSolo()` → キャラ選択で狼を押す → 指で円を描いて 40 秒ほど進め、敵と弾が多い場面）。

Run: `pnpm thumbs animal-survivors`、できた `static/thumbs/animal-survivors.webp` を Read で見る。

- [ ] **Step 4: 文書を書く**

`CLAUDE.md` の「構成」の段落の並び（ほかのゲームの段落のあと）に、Animal Survivors の段落を足す。書くのは、ルールとデータの分け方（`world.ts`・`arms.ts`・`drops.ts`・`choices.ts` と表）、ドット絵の格子と `bake()`、仮想画面の倍率の決め方、HUD を canvas に描くこと、遠い敵を回し直すこと、玉が 400 個であふれたら遠い玉に足すこと、3 択とリザルトが `Settle` を使うこと。spec は決めた数値と食い違うところを最新に直す。

- [ ] **Step 5: まとめて確かめて commit**

Run: `pnpm verify`
Expected: すべて通る

```bash
git add -A
git commit -m "Tune Animal Survivors with a bot, add its thumbnail, and document it"
```

- [ ] **Step 6: 利用者に渡して止まる**

ブランチを push し、遊べる版を main へ入れるか、PR にするかを利用者に聞く。実機で触ってもらい、手ざわり・テンポ・難しさの感想を待つ。ボス・宝箱・残りの武器と敵・追加の動物・ステージは、感想を直したあとで別の計画にする。
