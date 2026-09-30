# メガホンダッシュ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 背中側から見る 3D の 3 レーンのランゲーム「メガホンダッシュ」を、1 人用 15 面のゲームとして一覧に足す。

**Architecture:** ルールは DOM も three も使わない `course.ts`（面の表と道の並べ方）・`engine.ts`（`step()`）・`gesture.ts`（指の見分け）に閉じて vitest で固める。画面は `world3d.ts`（three）と `effects.ts`（重ね描きの 2D canvas）に描き、`director.ts` が出来事を両者と `sounds.ts` へ振り分ける。`MegaphoneDash.svelte` は配線だけを持つ。

**Tech Stack:** SvelteKit（Svelte 5 runes）、TypeScript、three、vitest、playwright-core（確かめる台本だけ）

**Spec:** `docs/superpowers/specs/2026-09-30-megaphone-dash-design.md`

## Global Constraints

- ゲームは `src/lib/games/megaphone-dash/` に閉じ、ほかのゲームのファイルを import しない（`$lib/*` の共通部品は使ってよい）。
- 触る共通ファイルは `src/lib/games.ts` への 1 行と `scripts/thumbs/scenes.ts` への場面 1 つだけ。`board-input.ts`・`SoloShell.svelte`・共通の結果画面には手を入れない。
- `meta` は `players: 1`、`levels: 15`、`minutes: '1分'`。`ownResult` と `anyOrder` は使わない。
- コンポーネント（`.svelte`）は 200 行未満。
- 絵文字は使わない。アイコンは `$lib/icons.ts` の既存の名前（`tap`・`arrow`・`kid`）。
- HUD の大きさは `cqh` / `cqw` で書く（`dvh` は使わない）。3D と重ね描きの大きさは `BoardInput` の `px(1, 1)`（盤面そのものの大きさ）から取る。
- 効果音は `$lib/audio.svelte` の `tone` / `sweep` / `noise` と `sfx` だけで鳴らす。音のファイルは使わない。
- 入力は `pointerId` ごとに扱う（`BoardInput` の `down` / `up` と、毎フレームの `input.fingers.all`）。
- コメントは非自明な WHY だけ。変更履歴やタスクの番号は書かない。
- 数字の初期値は spec のとおり。基本の速さ 5 m/s、撃つ間隔 0.25 秒、届く距離 15 m、跳ぶ 0.6 秒、よろけ 1 秒で ×0.3、通行人 1 m/s、列どうし 10 m 以上、ボスは 20 m 先、印は 1.5 秒前で 12 m 先に落ちる、倒したら 30 m 先に校門、スワイプは 30px。
- コンボの段階は 0〜4 で ×1.0、5〜9 で ×1.2、10〜19 で ×1.5、20 以上で ×2.0。フォロワーは「10 ＋ 2 × 伸ばしたあとのコンボ」。点は「フォロワー ＋ 残り秒（切り捨て） × 20 ＋ 最大コンボ × 10」。ランクはうまいボットの点に対して S 90%・A 70%・B 50%。
- commit の末尾には `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` を付ける。

## Review Focus

1. 横向きの iPad（`.stage` が 90 度回る）でも、指を画面の左右へ動かすとレーンが左右に動くこと。`gesture.ts` には `input.px()` で盤面の座標に直したピクセルだけを渡す（Task 7 の配線と、Task 9 の横向きの確かめ）。
2. 片方の指で押さえたまま別の指でタップしても、撃てて、押さえている指が勝手にレーンを動かさないこと（Task 3 のテスト）。
3. ↻（やりなおし）を何度も押しても WebGL のコンテキストが尽きず、古いタイマーが `onfinish` を呼ばないこと（Task 7 の `dispose`・`clearTimeout`、Task 9 で 12 回押して確かめる）。
4. ランクのカードを見せている 2 秒のあいだに ✕ で抜けても、遅れた `onfinish` が別の画面を壊さないこと（`SoloShell.finish` が捨てる。Task 7 で `clearTimeout` もする）。
5. 1 面を撃たずに走るだけの子どもでも、時間内に着けること（Task 8 のゆっくりのボット）。

---

## ファイルの地図

| ファイル                                            | 役目                                                                      | 作る Task |
| --------------------------------------------------- | ------------------------------------------------------------------------- | --------- |
| `src/lib/games/megaphone-dash/models.ts`            | 3D の部品（走る子・通行人・障害物・ボス・町並み・校門・印）とカメラの数字 | 1         |
| `src/lib/games/megaphone-dash/course.ts`            | 面の表 `rule()` と道の並べ方 `course()`                                   | 2         |
| `src/lib/games/megaphone-dash/course.test.ts`       | 並べ方のテスト                                                            | 2         |
| `src/lib/games/megaphone-dash/gesture.ts`           | 指 1 本ごとの 撃つ・左・右・跳ぶ の見分け                                 | 3         |
| `src/lib/games/megaphone-dash/gesture.test.ts`      | 見分けのテスト                                                            | 3         |
| `src/lib/games/megaphone-dash/engine.ts`            | 状態と `step()`、点とランク                                               | 4, 5      |
| `src/lib/games/megaphone-dash/engine.test.ts`       | ルールのテスト                                                            | 4, 5      |
| `src/lib/games/megaphone-dash/world3d.ts`           | three の場面 `RunWorld`                                                   | 6         |
| `src/lib/games/megaphone-dash/effects.ts`           | 重ね描きの演出 `RunFx`                                                    | 6         |
| `src/lib/games/megaphone-dash/sounds.ts`            | 効果音                                                                    | 6         |
| `src/lib/games/megaphone-dash/director.ts`          | 出来事の振り分け `direct()`                                               | 6         |
| `src/lib/games/megaphone-dash/Hud.svelte`           | 残り時間・コンボ・フォロワー・ボスの体力                                  | 7         |
| `src/lib/games/megaphone-dash/Howto.svelte`         | タイトルの遊び方                                                          | 7         |
| `src/lib/games/megaphone-dash/MegaphoneDash.svelte` | 配線                                                                      | 7         |
| `src/lib/games/megaphone-dash/meta.ts`              | 一覧の情報と `load()`                                                     | 7         |
| `src/lib/games.ts`                                  | 一覧に 1 行足す                                                           | 7         |
| `scripts/thumbs/scenes.ts`                          | 一覧の絵の台本                                                            | 7         |
| `static/thumbs/megaphone-dash.webp`                 | 一覧の絵                                                                  | 7         |

scratchpad（`$SCRATCH` と書く。セッションの scratchpad のディレクトリ）に置くもの（commit しない）は、`sheet/megaphone-sheet.mjs`（Task 1）・`sim/vitest.config.mjs` と `sim/megaphone.sim.ts`（Task 8）・`play/megaphone-play.mjs`（Task 9）。

`$REPO` はこの worktree の絶対パス（`/Users/oekazuma/localRepo/asobibako/.claude/worktrees/level-selection-ui-a6f9e5`）。

---

### Task 1: 3D の部品と見本のシート（ユーザーの承認で止まる）

**Files:**

- Create: `src/lib/games/megaphone-dash/models.ts`
- Create（commit しない）: `$SCRATCH/sheet/megaphone-sheet.mjs`

**Interfaces:**

- Consumes: `three`
- Produces:
  - `CAMERA: { fov: number; back: number; up: number; look: number; lookUp: number }`
  - `LANE_W: number`（レーン 1 本の幅 m）、`ROAD_W: number`（車道の幅 m）、`SEG: number`（町並み 1 区間の長さ m）
  - `mat(color: string, extra?: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial`
  - `interface Figure { group: THREE.Group; legs: THREE.Object3D[]; arms: THREE.Object3D[]; body: THREE.Mesh }`
  - `runner(): Figure`（-z が前。メガホンは右腕の先）
  - `walker(seed: number): Figure`（+z を向く。服と髪の色は `seed` で変わる）
  - `cheer(fig: Figure): void`（ファンの色に塗り替える）
  - `barricade(): THREE.Group`（低い）、`fence(): THREE.Group`・`pole(): THREE.Group`（高い）
  - `boss(): { group: THREE.Group; eyes: THREE.Mesh[] }`（+z を向く）
  - `street(index: number): THREE.Group`（原点から -z へ `SEG` m の車道・歩道・家・木・電柱）
  - `gate(): { group: THREE.Group; dispose: () => void }`（校門）
  - `warnRing(): THREE.Mesh`（落ちる場所の印）
  - `wave(): THREE.Mesh`（メガホンから前へ飛ぶ音の輪）

- [ ] **Step 1: `models.ts` を書く**

```ts
import * as THREE from 'three';

/**
 * メガホンダッシュの 3D の部品。単位は m。x が横、y が高さ、走る向きは -z。
 * 人は頭の大きいデフォルメで、球・円柱・カプセル・箱だけで組む
 */

/** 走る子の後ろ上から見るカメラ。world3d と見本のシートが同じ数字を使う */
export const CAMERA = { fov: 55, back: 4.2, up: 2.7, look: 8, lookUp: 0.7 };
export const LANE_W = 1.7;
export const ROAD_W = LANE_W * 3 + 0.8;
export const SEG = 20;

const materials = new Map<string, THREE.MeshStandardMaterial>();

export function mat(color: string, extra: THREE.MeshStandardMaterialParameters = {}) {
  const key = color + JSON.stringify(extra);
  let m = materials.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });
    materials.set(key, m);
  }
  return m;
}

const geometries = new Map<string, THREE.BufferGeometry>();

/** 同じ形の geometry は 1 つを使い回す。人と障害物は面全体で数百個になるので GPU に上げる回数を減らす */
function geo(key: string, make: () => THREE.BufferGeometry) {
  let g = geometries.get(key);
  if (!g) {
    g = make();
    geometries.set(key, g);
  }
  return g;
}

const sphere = (r: number) => geo(`s:${r}`, () => new THREE.SphereGeometry(r, 20, 14));
const cyl = (r1: number, r2: number, h: number, seg = 16) =>
  geo(`c:${r1}:${r2}:${h}:${seg}`, () => new THREE.CylinderGeometry(r1, r2, h, seg));
const capsule = (r: number, l: number) => geo(`p:${r}:${l}`, () => new THREE.CapsuleGeometry(r, l, 6, 14));
const box = (w: number, h: number, d: number) => geo(`b:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
const torus = (r: number, t: number) => geo(`t:${r}:${t}`, () => new THREE.TorusGeometry(r, t, 8, 20));

function mesh(g: THREE.BufferGeometry, color: string | THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(g, typeof color === 'string' ? mat(color) : color);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/** 腕と脚は付け根の Group を回して振る */
function joint(parent: THREE.Object3D, x: number, y: number, z = 0) {
  const j = new THREE.Group();
  j.position.set(x, y, z);
  parent.add(j);
  return j;
}

export interface Figure {
  group: THREE.Group;
  legs: THREE.Object3D[];
  arms: THREE.Object3D[];
  body: THREE.Mesh;
}

const SKIN = '#ffd9bd';

/** 頭の大きい 2 頭身の人。前は -z */
function chibi(o: { shirt: string; bottom: string; hair: string; skirt: boolean }): Figure {
  const group = new THREE.Group();
  const legs: THREE.Object3D[] = [];
  const arms: THREE.Object3D[] = [];
  for (const dx of [-0.1, 0.1]) {
    const hip = joint(group, dx, 0.46);
    hip.add(mesh(capsule(0.065, 0.24), SKIN, 0, -0.2));
    hip.add(mesh(cyl(0.07, 0.07, 0.12), '#ffffff', 0, -0.33));
    hip.add(mesh(box(0.13, 0.08, 0.2), '#5b3a29', 0, -0.42, -0.03));
    legs.push(hip);
  }
  group.add(mesh(o.skirt ? cyl(0.15, 0.3, 0.22) : cyl(0.17, 0.2, 0.2), o.bottom, 0, 0.52));
  const body = mesh(cyl(0.19, 0.21, 0.32), o.shirt, 0, 0.74);
  group.add(body);
  group.add(mesh(box(0.14, 0.07, 0.04), '#e0304a', 0, 0.86, -0.19));
  for (const side of [-1, 1]) {
    const shoulder = joint(group, side * 0.25, 0.86);
    shoulder.add(mesh(capsule(0.055, 0.2), o.shirt, 0, -0.14));
    shoulder.add(mesh(sphere(0.06), SKIN, 0, -0.3));
    arms.push(shoulder);
  }
  group.add(mesh(sphere(0.3), SKIN, 0, 1.18));
  const hair = mesh(sphere(0.32), o.hair, 0, 1.23, 0.05);
  hair.scale.set(1.02, 0.95, 1);
  group.add(hair);
  for (const dx of [-0.11, 0.11]) group.add(mesh(sphere(0.045), '#3a2230', dx, 1.15, -0.27));
  return { group, legs, arms, body };
}

/** 主人公。緑の髪のツインテール、緑のめがね、右手にメガホン */
export function runner(): Figure {
  const fig = chibi({ shirt: '#ffb6c9', bottom: '#34426b', hair: '#23433b', skirt: true });
  const g = fig.group;
  for (const side of [-1, 1]) {
    const tail = mesh(capsule(0.1, 0.5), '#23433b', side * 0.33, 0.95, 0.16);
    tail.rotation.z = side * 0.25;
    g.add(tail);
    g.add(mesh(sphere(0.06), '#ff4d5e', side * 0.3, 1.24, 0.1));
  }
  const tuft = mesh(torus(0.07, 0.02), '#23433b', 0, 1.58, 0);
  tuft.rotation.y = Math.PI / 2;
  g.add(tuft);
  for (const dx of [-0.11, 0.11]) {
    const lens = mesh(torus(0.075, 0.014), '#39c28a', dx, 1.15, -0.29);
    g.add(lens);
  }
  const hand = fig.arms[1];
  const horn = new THREE.Group();
  horn.position.set(0, -0.32, -0.08);
  horn.rotation.x = -Math.PI / 2;
  horn.add(mesh(cyl(0.05, 0.15, 0.3), '#f4f4f7', 0, 0.15));
  horn.add(mesh(torus(0.15, 0.025), '#ff3d8b', 0, 0.3).rotateX(Math.PI / 2));
  horn.add(mesh(box(0.06, 0.14, 0.08), '#ffc233', 0, -0.02, 0.05));
  hand.add(horn);
  return fig;
}

const SHIRTS = ['#ffffff', '#7fb8ff', '#ffd166', '#9be3a8', '#c7a6ff', '#ff9f80'];
const HAIRS = ['#3b2a20', '#1d1d24', '#8a5a2b', '#d9a441'];
const BOTTOMS = ['#34426b', '#3e3e46', '#6b5a48'];

/** 通行人。こちらへ歩いてくるので +z を向ける */
export function walker(seed: number): Figure {
  const fig = chibi({
    shirt: SHIRTS[seed % SHIRTS.length],
    bottom: BOTTOMS[seed % BOTTOMS.length],
    hair: HAIRS[(seed * 7) % HAIRS.length],
    skirt: seed % 3 === 0
  });
  fig.group.rotation.y = Math.PI;
  return fig;
}

/** ファンになった通行人は、光るピンクの服になって後ろを走る */
export function cheer(fig: Figure): void {
  fig.body.material = mat('#ff7eb6', { emissive: '#ff3d8b', emissiveIntensity: 0.35 });
  fig.group.rotation.y = 0;
}

/** 低いバリケード。黄と黒のしましまの板 2 枚 */
export function barricade(): THREE.Group {
  const g = new THREE.Group();
  const w = LANE_W * 0.86;
  const n = 6;
  for (const y of [0.22, 0.46])
    for (let i = 0; i < n; i++)
      g.add(mesh(box(w / n, 0.16, 0.06), i % 2 ? '#2b2d42' : '#ffc233', -w / 2 + (w / n) * (i + 0.5), y));
  for (const side of [-1, 1]) g.add(mesh(box(0.06, 0.56, 0.3), '#ffffff', side * (w / 2 - 0.05), 0.28));
  return g;
}

/** 高い柵。オレンジの工事の柵で、跳んでも越えられない高さ */
export function fence(): THREE.Group {
  const g = new THREE.Group();
  const w = LANE_W * 0.9;
  g.add(mesh(box(w, 1.3, 0.08), '#ff8a3d', 0, 0.95));
  for (const y of [0.6, 1.0, 1.4]) g.add(mesh(box(w, 0.1, 0.1), '#ffffff', 0, y));
  for (const side of [-1, 1]) {
    g.add(mesh(box(0.08, 1.7, 0.08), '#e0e0e0', side * (w / 2), 0.85));
    g.add(mesh(box(0.3, 0.1, 0.5), '#555a66', side * (w / 2), 0.05));
  }
  return g;
}

/** 道に立つ電柱。根もとに黄と黒の巻き */
export function pole(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.16, 0.2, 4), '#a3a8b0', 0, 2));
  for (let i = 0; i < 5; i++) g.add(mesh(cyl(0.21, 0.21, 0.2), i % 2 ? '#2b2d42' : '#ffc233', 0, 0.1 + i * 0.2));
  return g;
}

/** ボス。濃い青の丸い鬼で、赤い角と光る赤い目。こちら（+z）を向く */
export function boss(): { group: THREE.Group; eyes: THREE.Mesh[] } {
  const group = new THREE.Group();
  const skin = '#3d5a80';
  const head = mesh(sphere(1.05), skin, 0, 0);
  head.scale.set(1.1, 0.95, 1);
  group.add(head);
  const eyes: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const eye = mesh(
      sphere(0.2),
      mat('#ff2a3d', { emissive: '#ff2a3d', emissiveIntensity: 0.9 }),
      side * 0.38,
      0.15,
      0.9
    );
    eyes.push(eye);
    group.add(eye);
    const horn = mesh(cyl(0.03, 0.16, 0.9), '#d62839', side * 0.6, 0.95, 0);
    horn.rotation.z = -side * 0.5;
    group.add(horn);
    const arm = mesh(capsule(0.14, 0.9), skin, side * 0.95, -0.9, 0.3);
    arm.rotation.z = side * 0.3;
    group.add(arm);
  }
  group.add(mesh(box(0.9, 0.22, 0.2), '#1a1a24', 0, -0.4, 0.93));
  for (let i = 0; i < 4; i++)
    group.add(mesh(cyl(0, 0.07, 0.18, 8), '#ffffff', -0.3 + i * 0.2, -0.33, 1.0).rotateZ(Math.PI));
  return { group, eyes };
}

const WALLS = ['#e8e1d5', '#cfd8dc', '#b0bec5', '#f1e3c8', '#d7ccc8', '#c5cae9'];

/** 道ばたの家。side は道のどちら側か（-1 が左）で、窓を道の側に付ける */
function house(seed: number, side: number): THREE.Group {
  const g = new THREE.Group();
  const h = 3.5 + (seed % 4) * 1.2;
  g.add(mesh(box(4, h, 8), WALLS[seed % WALLS.length], 0, h / 2));
  g.add(mesh(box(4.2, 0.25, 8.2), '#6d6f7a', 0, h + 0.1));
  for (let row = 0; row < Math.floor(h / 1.6); row++)
    for (const z of [-2.2, 0, 2.2]) g.add(mesh(box(0.05, 0.8, 1.2), '#9fd3ff', -side * 2.01, 1.2 + row * 1.6, z));
  return g;
}

function tree(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.12, 0.16, 1.6), '#8a5a3c', 0, 0.8));
  g.add(mesh(sphere(0.9), '#5cbf6a', 0, 2.1));
  g.add(mesh(sphere(0.6), '#72d17f', 0.35, 2.6, 0.2));
  return g;
}

/** 車道・白い点線・歩道・点字ブロック・両側の家・木。原点から -z へ SEG m */
export function street(index: number): THREE.Group {
  const g = new THREE.Group();
  const road = new THREE.Mesh(box(ROAD_W, 0.1, SEG), mat('#8a9098'));
  road.position.set(0, -0.05, -SEG / 2);
  road.receiveShadow = true;
  g.add(road);
  for (const x of [-LANE_W / 2, LANE_W / 2])
    for (let z = 1; z < SEG; z += 4) {
      const dash = new THREE.Mesh(box(0.1, 0.02, 1.6), mat('#ffffff'));
      dash.position.set(x, 0.01, -z);
      g.add(dash);
    }
  for (const side of [-1, 1]) {
    const walk = new THREE.Mesh(box(2.6, 0.2, SEG), mat('#cfc8bb'));
    walk.position.set(side * (ROAD_W / 2 + 1.3), 0.05, -SEG / 2);
    walk.receiveShadow = true;
    g.add(walk);
    const bumps = new THREE.Mesh(box(0.35, 0.21, SEG), mat('#f2c230'));
    bumps.position.set(side * (ROAD_W / 2 + 0.6), 0.05, -SEG / 2);
    g.add(bumps);
    for (const [k, z] of [5, 15].entries()) {
      const h = house(index * 4 + k * 2 + (side > 0 ? 1 : 0), side);
      h.position.set(side * (ROAD_W / 2 + 2.6 + 2.2), 0, -z);
      g.add(h);
    }
    const t = (index + (side > 0 ? 1 : 0)) % 2 ? tree() : pole();
    t.position.set(side * (ROAD_W / 2 + 2.2), 0.1, -10);
    g.add(t);
  }
  return g;
}

/** 校門。2 本の柱と「がっこう」の看板 */
export function gate(): { group: THREE.Group; dispose: () => void } {
  const group = new THREE.Group();
  for (const side of [-1, 1]) group.add(mesh(box(0.6, 2.6, 0.6), '#b8bcc4', side * (ROAD_W / 2 + 0.3), 1.3));
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const x = c.getContext('2d')!;
  x.fillStyle = '#ffc233';
  x.fillRect(0, 0, 512, 128);
  x.fillStyle = '#2b2d42';
  x.font = "800 84px 'Hiragino Maru Gothic ProN', system-ui";
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText('がっこう', 256, 68);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  const signMat = new THREE.MeshStandardMaterial({ map: texture });
  const sign = new THREE.Mesh(box(ROAD_W * 0.6, ROAD_W * 0.15, 0.15), signMat);
  sign.position.set(0, 2.9, 0);
  group.add(sign);
  return {
    group,
    dispose: () => {
      texture.dispose();
      signMat.dispose();
    }
  };
}

/** メガホンから前へ飛ぶ音の輪。当たりは撃った瞬間に決まり、これは見た目だけ */
export function wave(): THREE.Mesh {
  return new THREE.Mesh(
    torus(0.35, 0.05),
    mat('#ff7eb6', { emissive: '#ff3d8b', emissiveIntensity: 0.9, transparent: true, opacity: 0.8 })
  );
}

/** ボスの投げたものが落ちる場所の赤い輪 */
export function warnRing(): THREE.Mesh {
  const ring = new THREE.Mesh(
    geo('ring', () => new THREE.RingGeometry(0.45, 0.65, 32)),
    mat('#ff2a3d', { emissive: '#ff2a3d', emissiveIntensity: 0.8, transparent: true, opacity: 0.85 })
  );
  ring.rotation.x = -Math.PI / 2;
  return ring;
}
```

- [ ] **Step 2: 型と lint を通す**

Run: `pnpm check && pnpm exec eslint src/lib/games/megaphone-dash/models.ts`
Expected: エラー 0。

- [ ] **Step 3: 見本のシートの台本を書く**

dev サーバーを `preview_start` の `dev`（`http://localhost:5173/asobibako/`）で起こしておく。built-in browser は使わず、node の playwright で撮る。`$SCRATCH/sheet/megaphone-sheet.mjs` を次の中身で作る（`$REPO` と `$SCRATCH` は実際の絶対パスに置き換える）。

```js
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

const REPO = '$REPO';
const OUT = '$SCRATCH/sheet/megaphone-sheet.png';
const require = createRequire(`${REPO}/package.json`);
const { chromium } = require('playwright-core');

const browser = await chromium.launch({ channel: 'chrome' });
// ページの CSP が import() した部品の実行を止めるので外す
const context = await browser.newContext({ bypassCSP: true, viewport: { width: 1200, height: 900 } });
const page = await context.newPage();
page.on('console', (m) => console.log('[page]', m.text()));
await page.goto('http://localhost:5173/asobibako/');
const data = await page.evaluate(async (repo) => {
  const THREE = await import(`/asobibako/@fs${repo}/node_modules/three/build/three.module.js`);
  const M = await import(`/asobibako/@fs${repo}/src/lib/games/megaphone-dash/models.ts`);
  const W = 400;
  const H = 440;
  const sheet = document.createElement('canvas');
  sheet.width = W * 3;
  sheet.height = H * 2;
  const out = sheet.getContext('2d');
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H);
  renderer.shadowMap.enabled = true;

  function stage() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#a9d6f5');
    scene.add(new THREE.HemisphereLight('#eaf6ff', '#b9b2a6', 2.2));
    const sun = new THREE.DirectionalLight('#fff4e0', 2.4);
    sun.position.set(4, 10, 4);
    sun.castShadow = true;
    scene.add(sun);
    return scene;
  }
  function shot(scene, camera, i) {
    renderer.render(scene, camera);
    out.drawImage(renderer.domElement, (i % 3) * W, Math.floor(i / 3) * H);
  }
  const lane = (n) => (n - 1) * M.LANE_W;

  // 0: 本番のカメラ。道・走る子・通行人・障害物・ボス
  {
    const scene = stage();
    scene.fog = new THREE.Fog('#cfe6f7', 45, 105);
    for (let i = 0; i < 6; i++) {
      const s = M.street(i);
      s.position.z = -i * M.SEG + M.SEG;
      scene.add(s);
    }
    const hero = M.runner();
    hero.legs[0].rotation.x = 0.7;
    hero.legs[1].rotation.x = -0.7;
    scene.add(hero.group);
    const place = (obj, n, z) => {
      obj.position.set(lane(n), obj.position.y, -z);
      scene.add(obj);
    };
    place(M.walker(1).group, 1, 9);
    place(M.walker(2).group, 0, 13);
    place(M.walker(3).group, 2, 17);
    place(M.barricade(), 0, 7);
    place(M.fence(), 2, 11);
    place(M.pole(), 1, 22);
    const b = M.boss();
    b.group.position.set(lane(1), 2.2, -30);
    scene.add(b.group);
    const ring = M.warnRing();
    ring.position.set(lane(2), 0.03, -14);
    scene.add(ring);
    const cam = new THREE.PerspectiveCamera(M.CAMERA.fov, W / H, 0.1, 140);
    cam.position.set(0, M.CAMERA.up, M.CAMERA.back);
    cam.lookAt(0, M.CAMERA.lookUp, -M.CAMERA.look);
    shot(scene, cam, 0);
  }
  // 1: 走る子を前から  2: 走る子を斜め後ろから
  for (const [i, pos] of [
    [1, [1.2, 1.3, -2.6]],
    [2, [1.6, 1.8, 2.8]]
  ]) {
    const scene = stage();
    const hero = M.runner();
    scene.add(hero.group);
    const cam = new THREE.PerspectiveCamera(35, W / H, 0.1, 50);
    cam.position.set(...pos);
    cam.lookAt(0, 0.9, 0);
    shot(scene, cam, i);
  }
  // 3: ボス  4: 通行人とファン  5: 障害物
  {
    const scene = stage();
    const b = M.boss();
    b.group.position.y = 1.5;
    scene.add(b.group);
    const cam = new THREE.PerspectiveCamera(40, W / H, 0.1, 50);
    cam.position.set(1.5, 1.8, 5.5);
    cam.lookAt(0, 1.3, 0);
    shot(scene, cam, 3);
  }
  {
    const scene = stage();
    for (let k = 0; k < 4; k++) {
      const w = M.walker(k);
      if (k === 3) M.cheer(w);
      w.group.position.x = -1.5 + k;
      scene.add(w.group);
    }
    const cam = new THREE.PerspectiveCamera(40, W / H, 0.1, 50);
    cam.position.set(0, 1.6, 5.5);
    cam.lookAt(0, 0.8, 0);
    shot(scene, cam, 4);
  }
  {
    const scene = stage();
    const items = [M.barricade(), M.fence(), M.pole()];
    items.forEach((o, k) => {
      o.position.x = (k - 1) * 2;
      scene.add(o);
    });
    const cam = new THREE.PerspectiveCamera(45, W / H, 0.1, 50);
    cam.position.set(0, 2.2, 7);
    cam.lookAt(0, 1, 0);
    shot(scene, cam, 5);
  }
  return sheet.toDataURL('image/png');
}, REPO);
writeFileSync(OUT, Buffer.from(data.split(',')[1], 'base64'));
await browser.close();
console.log(OUT);
```

- [ ] **Step 4: 撮って、自分で見る**

Run: `node $SCRATCH/sheet/megaphone-sheet.mjs`
Expected: `megaphone-sheet.png` のパスが出る。Read で画像を開き、6 枚それぞれで形が崩れていないか（部品が浮いている・めり込む・向きが逆・カメラに入っていない）を見て、崩れていれば `models.ts` を直して撮り直す。本番のカメラ（左上）で、走る子が画面の下 3 分の 1 に背中を見せて立ち、奥の 3 レーンが見分けられることを確かめる。

- [ ] **Step 5: commit する**

```bash
git add src/lib/games/megaphone-dash/models.ts
git commit -m "Add the 3D parts for メガホンダッシュ

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: ユーザーに見本を見せて止まる**

`SendUserFile` で `megaphone-sheet.png` を送り、「走る子・通行人・障害物・ボスの見た目の方向はこれでよいか」を聞く。ユーザーが認めるまで Task 2 以降に進まない。直してほしいと言われたら `models.ts` を直し、Step 4 から繰り返す。

---

### Task 2: 面の表と道の並べ方

**Files:**

- Create: `src/lib/games/megaphone-dash/course.ts`
- Test: `src/lib/games/megaphone-dash/course.test.ts`

**Interfaces:**

- Consumes: `$lib/levels` の `difficulty(level, levels)`・`lerp(a, b, d)`・`Rng`（`new Rng(seed).next()` が 0 以上 1 未満）
- Produces:
  - `LANES = 3`、`LEVELS = 15`、`BASE_SPEED = 5`、`ROW_GAP = 10`、`RUNUP = 25`
  - `type Kind = 'low' | 'high'`
  - `interface Block { lane: number; z: number; kind: Kind; look: number }`（`look` は高い障害物の見た目。0 が柵、1 が電柱）
  - `interface Spot { lane: number; z: number }`
  - `interface BossRule { hp: number; moveEvery: number; throwEvery: number; kinds: Kind[] }`
  - `interface LevelRule { length: number; time: number; walkers: number; rows: number; high: number; double: number; boss: BossRule | null; best: number }`
  - `rule(level: number): LevelRule`
  - `course(level: number): { length: number; walkers: Spot[]; blocks: Block[] }`

- [ ] **Step 1: 落ちるテストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { course, LEVELS, ROW_GAP, rule, RUNUP } from './course';

const levels = Array.from({ length: LEVELS }, (_, i) => i + 1);

describe('course', () => {
  it('どの列にも通れるレーンが残る', () => {
    for (const level of levels) {
      const rows = new Map<number, number>();
      for (const b of course(level).blocks) rows.set(b.z, (rows.get(b.z) ?? 0) + 1);
      for (const n of rows.values()) expect(n).toBeLessThanOrEqual(2);
    }
  });

  it('列どうしは ROW_GAP 以上あく', () => {
    for (const level of levels) {
      const zs = [...new Set(course(level).blocks.map((b) => b.z))].sort((a, b) => a - b);
      for (let i = 1; i < zs.length; i++) expect(zs[i] - zs[i - 1]).toBeGreaterThanOrEqual(ROW_GAP);
    }
  });

  it('1〜2 面は低いバリケードが 1 レーンずつだけ', () => {
    for (const level of [1, 2]) {
      const blocks = course(level).blocks;
      expect(blocks.length).toBeGreaterThan(0);
      expect(blocks.every((b) => b.kind === 'low')).toBe(true);
      expect(new Set(blocks.map((b) => b.z)).size).toBe(blocks.length);
    }
  });

  it('あとの面ほど高い障害物が混ざる', () => {
    expect(course(12).blocks.some((b) => b.kind === 'high')).toBe(true);
  });

  it('同じ面は毎回同じ道になる', () => {
    expect(course(7)).toEqual(course(7));
    expect(course(7)).not.toEqual(course(8));
  });

  it('障害物と通行人は助走のあと、道のりの中に置く', () => {
    for (const level of levels) {
      const c = course(level);
      for (const p of [...c.blocks, ...c.walkers]) {
        expect(p.z).toBeGreaterThanOrEqual(RUNUP);
        expect(p.z).toBeLessThanOrEqual(c.length - 10);
        expect([0, 1, 2]).toContain(p.lane);
      }
    }
  });

  it('通行人は同じレーンの障害物から 4 m 以上離す', () => {
    for (const level of levels) {
      const c = course(level);
      for (const w of c.walkers)
        for (const b of c.blocks) if (b.lane === w.lane) expect(Math.abs(b.z - w.z)).toBeGreaterThanOrEqual(4);
    }
  });

  it('ボスは 5・10・15 面だけで、あとの面ほど強い', () => {
    expect(levels.filter((n) => rule(n).boss).sort((a, b) => a - b)).toEqual([5, 10, 15]);
    expect(rule(5).boss!.kinds).toEqual(['low']);
    expect(rule(15).boss!.hp).toBeGreaterThan(rule(5).boss!.hp);
  });

  it('範囲外の面の番号は端に丸める', () => {
    expect(rule(0)).toEqual(rule(1));
    expect(rule(99)).toEqual(rule(LEVELS));
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm exec vitest run --project unit src/lib/games/megaphone-dash/course.test.ts`
Expected: FAIL（`./course` が見つからない）

- [ ] **Step 3: `course.ts` を書く**

```ts
import { difficulty, lerp, Rng } from '$lib/levels';

export const LANES = 3;
export const LEVELS = 15;
/** コンボの倍率が ×1.0 のときの速さ（m/s） */
export const BASE_SPEED = 5;
/** 障害物の列どうしの最小の間（m）。×2.0 でも 1 秒あり、2 レーン先の空きへ移りきれる */
export const ROW_GAP = 10;
/** 走り出してから最初の障害物・通行人までの助走（m） */
export const RUNUP = 25;

export type Kind = 'low' | 'high';

export interface Block {
  lane: number;
  z: number;
  kind: Kind;
  /** 高い障害物の見た目。0 が柵、1 が電柱 */
  look: number;
}

/** 通行人の最初の位置 */
export interface Spot {
  lane: number;
  z: number;
}

export interface BossRule {
  hp: number;
  /** レーンを移る間隔（秒） */
  moveEvery: number;
  /** 障害物を投げる間隔（秒） */
  throwEvery: number;
  kinds: Kind[];
}

export interface LevelRule {
  /** 道のりの長さ（m）。ボスの面はここでボスが現れる */
  length: number;
  /** 制限時間（秒） */
  time: number;
  /** 100 m あたりの通行人 */
  walkers: number;
  /** 100 m あたりの障害物の列 */
  rows: number;
  /** 障害物が高いものになる割合 */
  high: number;
  /** 列が 2 レーンをふさぐ割合 */
  double: number;
  boss: BossRule | null;
  /** うまいボットの点。ランクはこれに対する割合で決める */
  best: number;
}

const BOSSES: Partial<Record<number, BossRule>> = {
  5: { hp: 20, moveEvery: 2.6, throwEvery: 2.4, kinds: ['low'] },
  10: { hp: 30, moveEvery: 2.2, throwEvery: 2, kinds: ['low', 'high'] },
  15: { hp: 40, moveEvery: 1.8, throwEvery: 1.5, kinds: ['low', 'high'] }
};

export function rule(level: number): LevelRule {
  const n = Math.min(LEVELS, Math.max(1, Math.round(level)));
  const d = difficulty(n, LEVELS);
  // はじめの 2 面は跳ぶことを覚える面なので、低いバリケードを 1 レーンずつだけ置く
  const easy = n <= 2;
  const length = Math.round(lerp(200, 450, d) / 10) * 10;
  const boss = BOSSES[n] ?? null;
  const time = Math.round((length / BASE_SPEED) * 1.3) + (boss ? 30 : 0);
  return {
    length,
    time,
    walkers: lerp(5, 9, d),
    rows: lerp(3, 7, d),
    high: easy ? 0 : lerp(0.25, 0.6, d),
    double: easy ? 0 : lerp(0.15, 0.5, d),
    boss,
    best: Math.round(length * 6 + time * 10)
  };
}

export function course(level: number): { length: number; walkers: Spot[]; blocks: Block[] } {
  const r = rule(level);
  const rng = new Rng(Math.round(level) * 101 + 13);
  const pick = (n: number) => Math.floor(rng.next() * n);
  const end = r.length - 10;

  const blocks: Block[] = [];
  const count = Math.max(1, Math.round((r.length / 100) * r.rows));
  const step = Math.max(ROW_GAP, (end - RUNUP) / count);
  // 各列は自分の枠 [z, z + step - ROW_GAP] の中でずらすので、隣の列とは必ず ROW_GAP 以上あく
  for (let z = RUNUP; z <= end; z += step) {
    const at = Math.min(end, Math.round(z + rng.next() * (step - ROW_GAP)));
    const lanes = [0, 1, 2];
    const n = rng.next() < r.double ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const lane = lanes.splice(pick(lanes.length), 1)[0];
      blocks.push({ lane, z: at, kind: rng.next() < r.high ? 'high' : 'low', look: pick(2) });
    }
  }

  const walkers: Spot[] = [];
  const people = Math.round((r.length / 100) * r.walkers);
  for (let i = 0; i < people; i++) {
    for (let tries = 0; tries < 8; tries++) {
      const spot = { lane: pick(3), z: Math.round(RUNUP + rng.next() * (end - RUNUP)) };
      if (blocks.some((b) => b.lane === spot.lane && Math.abs(b.z - spot.z) < 4)) continue;
      walkers.push(spot);
      break;
    }
  }
  walkers.sort((a, b) => a.z - b.z);
  return { length: r.length, walkers, blocks };
}
```

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm exec vitest run --project unit src/lib/games/megaphone-dash/course.test.ts`
Expected: PASS（9 件）

- [ ] **Step 5: commit する**

```bash
git add src/lib/games/megaphone-dash/course.ts src/lib/games/megaphone-dash/course.test.ts
git commit -m "Lay out the メガホンダッシュ courses from a per-level table

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: 指の見分け

**Files:**

- Create: `src/lib/games/megaphone-dash/gesture.ts`
- Test: `src/lib/games/megaphone-dash/gesture.test.ts`

**Interfaces:**

- Consumes: なし（盤面の中のピクセル座標を受け取る）
- Produces:
  - `SWIPE = 30`
  - `type Gesture = 'shoot' | 'left' | 'right' | 'jump'`
  - `class Gestures { down(id: number, x: number, y: number): Gesture[]; move(id: number, x: number, y: number): Gesture[]; up(id: number, x: number, y: number): Gesture[] }`

- [ ] **Step 1: 落ちるテストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { Gestures } from './gesture';

describe('Gestures', () => {
  it('触れただけなら撃つだけ', () => {
    const g = new Gestures();
    expect(g.down(1, 100, 100)).toEqual(['shoot']);
    expect(g.move(1, 110, 95)).toEqual([]);
    expect(g.up(1, 110, 95)).toEqual([]);
  });

  it('横へ 30px で 1 レーン、続けてずらすと続けて動く', () => {
    const g = new Gestures();
    g.down(1, 100, 100);
    expect(g.move(1, 131, 100)).toEqual(['right']);
    expect(g.move(1, 150, 100)).toEqual([]);
    expect(g.move(1, 162, 100)).toEqual(['right']);
    expect(g.move(1, 100, 100)).toEqual(['left', 'left']);
  });

  it('1 フレームで大きく動いたぶんをまとめて返す', () => {
    const g = new Gestures();
    g.down(1, 100, 100);
    expect(g.move(1, 35, 100)).toEqual(['left', 'left']);
  });

  it('上へ 30px で跳ぶのは 1 本の指につき 1 回', () => {
    const g = new Gestures();
    g.down(1, 100, 100);
    expect(g.move(1, 100, 69)).toEqual(['jump']);
    expect(g.move(1, 100, 20)).toEqual([]);
  });

  it('縦は最初に触れた位置から測る', () => {
    const g = new Gestures();
    g.down(1, 100, 100);
    expect(g.move(1, 131, 100)).toEqual(['right']);
    expect(g.move(1, 131, 60)).toEqual(['jump']);
  });

  it('斜めはずれの大きい向きを取る', () => {
    const g = new Gestures();
    g.down(1, 100, 100);
    expect(g.move(1, 140, 65)).toEqual(['right']);
    const h = new Gestures();
    h.down(1, 100, 100);
    expect(h.move(1, 132, 50)).toEqual(['jump']);
  });

  it('跳んだあとは、上へずれたままでも横でレーンを移れる', () => {
    const g = new Gestures();
    g.down(1, 100, 100);
    expect(g.move(1, 100, 50)).toEqual(['jump']);
    expect(g.move(1, 140, 50)).toEqual(['right']);
  });

  it('横が大きいスワイプは、少し上へ流れても跳ばない', () => {
    const g = new Gestures();
    g.down(1, 100, 100);
    expect(g.move(1, 160, 68)).toEqual(['right', 'right']);
    expect(g.move(1, 165, 66)).toEqual([]);
  });

  it('下へのずれは何もしない', () => {
    const g = new Gestures();
    g.down(1, 100, 100);
    expect(g.move(1, 100, 200)).toEqual([]);
  });

  it('速いフリックは離したときに拾う', () => {
    const g = new Gestures();
    g.down(1, 100, 100);
    expect(g.up(1, 170, 100)).toEqual(['right', 'right']);
  });

  it('2 本の指を別々に見分け、押さえている指は動かさない', () => {
    const g = new Gestures();
    g.down(1, 100, 100);
    expect(g.down(2, 300, 300)).toEqual(['shoot']);
    expect(g.move(1, 102, 101)).toEqual([]);
    expect(g.move(2, 340, 300)).toEqual(['right']);
    expect(g.up(2, 340, 300)).toEqual([]);
    expect(g.move(1, 60, 100)).toEqual(['left']);
  });

  it('知らない指の move と up は何も返さない', () => {
    const g = new Gestures();
    expect(g.move(9, 0, 0)).toEqual([]);
    expect(g.up(9, 0, 0)).toEqual([]);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm exec vitest run --project unit src/lib/games/megaphone-dash/gesture.test.ts`
Expected: FAIL（`./gesture` が見つからない）

- [ ] **Step 3: `gesture.ts` を書く**

```ts
/** 指をこれだけ（盤面の中のピクセル）ずらすと 1 レーン移る・跳ぶ */
export const SWIPE = 30;

export type Gesture = 'shoot' | 'left' | 'right' | 'jump';

interface Track {
  /** 横の起点。1 レーン移るたびにその向きへ SWIPE ずらす */
  x: number;
  /** 最初に触れた位置。縦のずれと、斜めの向きの見分けはここから測る */
  x0: number;
  y: number;
  jumped: boolean;
}

/** 指 1 本ごとに、触れた瞬間の「撃つ」と、そのあとのスワイプを見分ける */
export class Gestures {
  readonly #tracks = new Map<number, Track>();

  down(id: number, x: number, y: number): Gesture[] {
    this.#tracks.set(id, { x, x0: x, y, jumped: false });
    return ['shoot'];
  }

  move(id: number, x: number, y: number): Gesture[] {
    const t = this.#tracks.get(id);
    if (!t) return [];
    const out: Gesture[] = [];
    const up = t.y - y;
    const side = Math.abs(x - t.x0);
    // 跳んだあとの指は上へずれたままなので、横だけで見る
    while (Math.abs(x - t.x) >= SWIPE && (t.jumped || side >= up)) {
      const dir = Math.sign(x - t.x);
      t.x += dir * SWIPE;
      out.push(dir > 0 ? 'right' : 'left');
    }
    if (!t.jumped && up >= SWIPE && up > side) {
      t.jumped = true;
      out.push('jump');
    }
    return out;
  }

  up(id: number, x: number, y: number): Gesture[] {
    const out = this.move(id, x, y);
    this.#tracks.delete(id);
    return out;
  }
}
```

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm exec vitest run --project unit src/lib/games/megaphone-dash/gesture.test.ts`
Expected: PASS（12 件）

- [ ] **Step 5: commit する**

```bash
git add src/lib/games/megaphone-dash/gesture.ts src/lib/games/megaphone-dash/gesture.test.ts
git commit -m "Tell taps, lane swipes and jumps apart per finger for メガホンダッシュ

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 走る・撃つ・よける・着く のルール

**Files:**

- Create: `src/lib/games/megaphone-dash/engine.ts`
- Test: `src/lib/games/megaphone-dash/engine.test.ts`

**Interfaces:**

- Consumes: Task 2 の `LANES`・`BASE_SPEED`・`course(level)`・`rule(level)`・`Block`・`Kind`・`LevelRule`、`$lib/levels` の `Rng`
- Produces:
  - 定数 `SHOT_RANGE = 15`、`SHOT_GAP = 0.25`、`JUMP_TIME = 0.6`、`STUMBLE_TIME = 1`、`STUMBLE_SLOW = 0.3`、`WALK_SPEED = 1`、`DEPTH = 0.6`、`BOSS_AHEAD = 20`、`GATE_AFTER_BOSS = 30`、`WARN_TIME = 1.5`、`DROP_AHEAD = 12`
  - `interface Walker { lane: number; z: number; fan: boolean; passed: boolean }`
  - `interface Obstacle extends Block { hit: boolean }`
  - `interface Drop { lane: number; z: number; kind: Kind; t: number }`
  - `interface Boss { hp: number; max: number; lane: number; moveIn: number; throwIn: number; drops: Drop[]; phase: 'wait' | 'fight' | 'gone' }`
  - `interface RunState { level; rule: LevelRule; rng: Rng; z; lane; air; stumble; cooldown; combo; maxCombo; followers; time; bossAt; goal; walkers: Walker[]; blocks: Obstacle[]; boss: Boss | null; result: 'clear' | 'fail' | null }`（数はすべて `number`）
  - `interface RunInput { shoot?: boolean; move?: number; jump?: boolean }`
  - `type RunEvent`（下のコードのとおり）
  - `tier(combo: number): number`、`speed(s: RunState): number`
  - `createState(level: number): RunState`、`step(s: RunState, dt: number, input?: RunInput): RunEvent[]`
  - `type Rank = 'S' | 'A' | 'B' | 'C'`、`score(s: RunState): number`、`rank(points: number, best: number): Rank`

- [ ] **Step 1: 落ちるテストを書く**

```ts
import { describe, expect, it } from 'vitest';
import {
  createState,
  DEPTH,
  JUMP_TIME,
  rank,
  score,
  SHOT_GAP,
  speed,
  step,
  STUMBLE_TIME,
  tier,
  type Obstacle,
  type RunState,
  type Walker
} from './engine';

/** 障害物も通行人もない 1 面。テストごとに置きたいものだけ置く */
function empty(level = 1): RunState {
  const s = createState(level);
  s.walkers = [];
  s.blocks = [];
  return s;
}
const walker = (lane: number, z: number): Walker => ({ lane, z, fan: false, passed: false });
const block = (lane: number, z: number, kind: 'low' | 'high'): Obstacle => ({ lane, z, kind, look: 0, hit: false });

describe('レーン', () => {
  it('真ん中から始まり、端より外へは出ない', () => {
    const s = empty();
    expect(s.lane).toBe(1);
    step(s, 0.01, { move: -5 });
    expect(s.lane).toBe(0);
    step(s, 0.01, { move: 9 });
    expect(s.lane).toBe(2);
  });
});

describe('撃つ', () => {
  it('同じレーンの 15 m 以内でいちばん近い通行人に当たる', () => {
    const s = empty();
    const far = walker(1, 14);
    const near = walker(1, 6);
    const side = walker(0, 3);
    s.walkers = [far, near, side];
    const events = step(s, 0.01, { shoot: true });
    expect(near.fan).toBe(true);
    expect(far.fan).toBe(false);
    expect(side.fan).toBe(false);
    expect(events).toContainEqual({ type: 'hit', walker: near, gain: 12, combo: 1 });
  });

  it('15 m より遠いと外れで、損はない', () => {
    const s = empty();
    s.walkers = [walker(1, 16)];
    const events = step(s, 0.01, { shoot: true });
    expect(s.walkers[0].fan).toBe(false);
    expect(events).toEqual([{ type: 'shot', lane: 1 }]);
    expect(s.combo).toBe(0);
  });

  it('撃つ間隔は 0.25 秒以上', () => {
    const s = empty();
    s.walkers = [walker(1, 5), walker(1, 8)];
    step(s, 0.01, { shoot: true });
    step(s, 0.1, { shoot: true });
    expect(s.walkers[1].fan).toBe(false);
    step(s, SHOT_GAP);
    step(s, 0.01, { shoot: true });
    expect(s.walkers[1].fan).toBe(true);
  });

  it('当てるとコンボとフォロワーが式どおりに増える', () => {
    const s = empty();
    s.combo = 17;
    s.walkers = [walker(1, 5)];
    step(s, 0.01, { shoot: true });
    expect(s.combo).toBe(18);
    expect(s.maxCombo).toBe(18);
    expect(s.followers).toBe(46);
  });
});

describe('速さ', () => {
  it('コンボの段階で速さの倍率が変わる', () => {
    expect([0, 4, 5, 9, 10, 19, 20, 50].map(tier)).toEqual([1, 1, 1.2, 1.2, 1.5, 1.5, 2, 2]);
  });

  it('基本は 5 m/s で、倍率ぶん速く進む', () => {
    const s = empty();
    step(s, 1);
    expect(s.z).toBeCloseTo(5);
    s.combo = 20;
    step(s, 1);
    expect(s.z).toBeCloseTo(15);
  });
});

describe('通行人とのすれ違い', () => {
  it('通行人は 1 m/s でこちらへ歩く', () => {
    const s = empty();
    s.walkers = [walker(0, 30)];
    step(s, 1);
    expect(s.walkers[0].z).toBeCloseTo(29);
  });

  it('同じレーンのまますれ違うとコンボが切れる', () => {
    const s = empty();
    s.combo = 7;
    const w = walker(1, 1);
    s.walkers = [w];
    const events = step(s, 0.5);
    expect(s.combo).toBe(0);
    expect(events).toContainEqual({ type: 'miss', walker: w });
  });

  it('ほかのレーンの通行人とのすれ違いでは切れない', () => {
    const s = empty();
    s.combo = 7;
    s.walkers = [walker(2, 1)];
    const events = step(s, 0.5);
    expect(s.combo).toBe(7);
    expect(events.some((e) => e.type === 'miss')).toBe(false);
    expect(s.walkers[0].passed).toBe(true);
  });
});

describe('障害物', () => {
  it('ぶつかるとコンボが切れ、1 秒 ×0.3 になる', () => {
    const s = empty();
    s.combo = 12;
    const o = block(1, 0.5, 'low');
    s.blocks = [o];
    const events = step(s, 0.01);
    expect(events).toContainEqual({ type: 'bump', obstacle: o });
    expect(s.combo).toBe(0);
    expect(s.stumble).toBe(STUMBLE_TIME);
    expect(speed(s)).toBeCloseTo(5 * 0.3);
  });

  it('同じ障害物には 1 回しかぶつからない', () => {
    const s = empty();
    s.blocks = [block(1, DEPTH, 'high')];
    const first = step(s, 0.01);
    const second = step(s, 0.01);
    expect(first.filter((e) => e.type === 'bump')).toHaveLength(1);
    expect(second.filter((e) => e.type === 'bump')).toHaveLength(0);
  });

  it('よろけているあいだに別の障害物にぶつかると 1 秒を数え直す', () => {
    const s = empty();
    s.blocks = [block(1, 0.3, 'low'), block(1, 0.9, 'low')];
    step(s, 0.01);
    step(s, 0.5);
    expect(s.stumble).toBe(STUMBLE_TIME);
  });

  it('よろけているあいだも撃てて移れる', () => {
    const s = empty();
    s.stumble = 0.8;
    s.walkers = [walker(0, 5)];
    step(s, 0.01, { move: -1, shoot: true });
    expect(s.lane).toBe(0);
    expect(s.walkers[0].fan).toBe(true);
  });

  it('低いバリケードは跳べばよけられる', () => {
    const s = empty();
    s.blocks = [block(1, 1.2, 'low')];
    step(s, 0.01, { jump: true });
    for (let i = 0; i < 20; i++) step(s, 0.02);
    expect(s.blocks[0].hit).toBe(false);
  });

  it('高い柵は跳んでもぶつかる', () => {
    const s = empty();
    s.blocks = [block(1, 1.2, 'high')];
    step(s, 0.01, { jump: true });
    for (let i = 0; i < 20; i++) step(s, 0.02);
    expect(s.blocks[0].hit).toBe(true);
  });

  it('ほかのレーンの障害物にはぶつからない', () => {
    const s = empty();
    s.blocks = [block(0, 0.5, 'high')];
    step(s, 0.2);
    expect(s.blocks[0].hit).toBe(false);
  });

  it('大きな dt でも障害物をすり抜けない', () => {
    const s = empty();
    s.combo = 20;
    s.blocks = [block(1, 1, 'high')];
    step(s, 0.05);
    expect(s.blocks[0].hit).toBe(true);
  });
});

describe('跳ぶ', () => {
  it('0.6 秒空中にいて、空中の跳ぶは無視する', () => {
    const s = empty();
    const first = step(s, 0.01, { jump: true });
    expect(first).toContainEqual({ type: 'jump' });
    step(s, 0.3);
    const again = step(s, 0.01, { jump: true });
    expect(again.some((e) => e.type === 'jump')).toBe(false);
    expect(s.air).toBeCloseTo(JUMP_TIME - 0.32);
    step(s, 0.3);
    expect(s.air).toBe(0);
  });

  it('空中でもレーンを移れて撃てる', () => {
    const s = empty();
    s.walkers = [walker(2, 5)];
    step(s, 0.01, { jump: true });
    step(s, 0.01, { move: 1, shoot: true });
    expect(s.lane).toBe(2);
    expect(s.walkers[0].fan).toBe(true);
  });
});

describe('時間とゴール', () => {
  it('時間切れでしっぱい', () => {
    const s = empty();
    s.time = 0.05;
    const events = step(s, 0.1);
    expect(s.result).toBe('fail');
    expect(s.time).toBe(0);
    expect(events).toContainEqual({ type: 'timeout' });
    expect(step(s, 0.1)).toEqual([]);
  });

  it('ボスのない面は道のりの終わりでクリア', () => {
    const s = empty(1);
    s.z = s.goal - 0.01;
    const events = step(s, 0.1);
    expect(s.result).toBe('clear');
    expect(events).toContainEqual({ type: 'goal' });
  });
});

describe('ランク', () => {
  it('点はフォロワー ＋ 残り秒（切り捨て）× 20 ＋ 最大コンボ × 10', () => {
    const s = empty();
    s.followers = 300;
    s.time = 12.9;
    s.maxCombo = 8;
    expect(score(s)).toBe(300 + 12 * 20 + 80);
  });

  it('うまいボットの点に対して S 90%・A 70%・B 50%', () => {
    expect(rank(900, 1000)).toBe('S');
    expect(rank(899, 1000)).toBe('A');
    expect(rank(700, 1000)).toBe('A');
    expect(rank(500, 1000)).toBe('B');
    expect(rank(499, 1000)).toBe('C');
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm exec vitest run --project unit src/lib/games/megaphone-dash/engine.test.ts`
Expected: FAIL（`./engine` が見つからない）

- [ ] **Step 3: `engine.ts` を書く（ボスの動き `boss()` は Task 5 で足す。ここでは `Boss` の型、`createState` の組み立て、ボスに当てる `hitBoss()` までを書く）**

```ts
import { Rng } from '$lib/levels';
import { BASE_SPEED, course, LANES, rule, type Block, type Kind, type LevelRule } from './course';

/** 撃ったときに当たる、前方の距離（m） */
export const SHOT_RANGE = 15;
export const SHOT_GAP = 0.25;
export const JUMP_TIME = 0.6;
export const STUMBLE_TIME = 1;
export const STUMBLE_SLOW = 0.3;
export const WALK_SPEED = 1;
/** 障害物の前後の厚み（m）。この範囲に同じレーンでいるとぶつかる */
export const DEPTH = 0.6;
export const BOSS_AHEAD = 20;
export const GATE_AFTER_BOSS = 30;
/** 投げた障害物が落ちるまでの秒。そのあいだ落ちる場所に印を出す */
export const WARN_TIME = 1.5;
/** 投げた障害物が落ちる、そのときの走る子からの距離（m） */
export const DROP_AHEAD = 12;

export interface Walker {
  lane: number;
  z: number;
  fan: boolean;
  passed: boolean;
}

export interface Obstacle extends Block {
  hit: boolean;
}

export interface Drop {
  lane: number;
  z: number;
  kind: Kind;
  /** 落ちるまでの秒 */
  t: number;
}

export interface Boss {
  hp: number;
  max: number;
  lane: number;
  moveIn: number;
  throwIn: number;
  drops: Drop[];
  phase: 'wait' | 'fight' | 'gone';
}

export interface RunState {
  level: number;
  rule: LevelRule;
  /** ボスの動きに使う。面ごとに決まった列 */
  rng: Rng;
  /** 走った距離（m） */
  z: number;
  lane: number;
  /** 空中にいる残りの秒 */
  air: number;
  stumble: number;
  cooldown: number;
  combo: number;
  maxCombo: number;
  followers: number;
  /** 残りの秒 */
  time: number;
  /** ボスが現れる距離 */
  bossAt: number;
  /** 校門の距離。ボスの面は倒すまで Infinity */
  goal: number;
  walkers: Walker[];
  blocks: Obstacle[];
  boss: Boss | null;
  result: 'clear' | 'fail' | null;
}

/** move は右を正にした、このフレームで移るレーンの数 */
export interface RunInput {
  shoot?: boolean;
  move?: number;
  jump?: boolean;
}

export type RunEvent =
  | { type: 'shot'; lane: number }
  | { type: 'hit'; walker: Walker; gain: number; combo: number }
  | { type: 'miss'; walker: Walker }
  | { type: 'jump' }
  | { type: 'bump'; obstacle: Obstacle }
  | { type: 'boss-in' }
  | { type: 'boss-hit'; damage: number; combo: number }
  | { type: 'boss-down' }
  | { type: 'throw'; drop: Drop }
  | { type: 'land'; obstacle: Obstacle }
  | { type: 'goal' }
  | { type: 'timeout' };

export const tier = (combo: number): number => (combo >= 20 ? 2 : combo >= 10 ? 1.5 : combo >= 5 ? 1.2 : 1);

export const speed = (s: RunState): number => BASE_SPEED * tier(s.combo) * (s.stumble > 0 ? STUMBLE_SLOW : 1);

export function createState(level: number): RunState {
  const r = rule(level);
  const c = course(level);
  return {
    level,
    rule: r,
    rng: new Rng(Math.round(level) * 7919 + 1),
    z: 0,
    lane: 1,
    air: 0,
    stumble: 0,
    cooldown: 0,
    combo: 0,
    maxCombo: 0,
    followers: 0,
    time: r.time,
    bossAt: c.length,
    goal: r.boss ? Infinity : c.length,
    walkers: c.walkers.map((w) => ({ lane: w.lane, z: w.z, fan: false, passed: false })),
    blocks: c.blocks.map((b) => ({ ...b, hit: false })),
    boss: r.boss
      ? {
          hp: r.boss.hp,
          max: r.boss.hp,
          lane: 1,
          moveIn: r.boss.moveEvery,
          throwIn: r.boss.throwEvery,
          drops: [],
          phase: 'wait'
        }
      : null,
    result: null
  };
}

function addCombo(s: RunState) {
  s.combo += 1;
  s.maxCombo = Math.max(s.maxCombo, s.combo);
}

function shoot(s: RunState, events: RunEvent[]) {
  s.cooldown = SHOT_GAP;
  events.push({ type: 'shot', lane: s.lane });
  if (s.boss?.phase === 'fight') {
    hitBoss(s, s.boss, events);
    return;
  }
  let target: Walker | null = null;
  for (const w of s.walkers) {
    if (w.fan || w.lane !== s.lane) continue;
    const d = w.z - s.z;
    if (d < 0 || d > SHOT_RANGE) continue;
    if (!target || w.z < target.z) target = w;
  }
  if (!target) return;
  target.fan = true;
  addCombo(s);
  const gain = 10 + 2 * s.combo;
  s.followers += gain;
  events.push({ type: 'hit', walker: target, gain, combo: s.combo });
}

function hitBoss(s: RunState, b: Boss, events: RunEvent[]) {
  if (b.lane !== s.lane) return;
  addCombo(s);
  const damage = tier(s.combo);
  b.hp = Math.max(0, b.hp - damage);
  events.push({ type: 'boss-hit', damage, combo: s.combo });
  if (b.hp > 0) return;
  b.phase = 'gone';
  b.drops = [];
  s.goal = s.z + GATE_AFTER_BOSS;
  events.push({ type: 'boss-down' });
}

function pass(s: RunState, events: RunEvent[]) {
  for (const w of s.walkers) {
    if (w.fan || w.passed || w.z > s.z) continue;
    w.passed = true;
    if (w.lane !== s.lane) continue;
    s.combo = 0;
    events.push({ type: 'miss', walker: w });
  }
}

/** from から今の位置までに通った範囲で見る。速いときの 1 フレームで障害物を飛び越さないため */
function bump(s: RunState, from: number, events: RunEvent[]) {
  for (const o of s.blocks) {
    if (o.hit || o.lane !== s.lane) continue;
    if (o.z < from - DEPTH || o.z > s.z + DEPTH) continue;
    if (o.kind === 'low' && s.air > 0) continue;
    o.hit = true;
    s.combo = 0;
    s.stumble = STUMBLE_TIME;
    events.push({ type: 'bump', obstacle: o });
  }
}

export function step(s: RunState, dt: number, input: RunInput = {}): RunEvent[] {
  const events: RunEvent[] = [];
  if (s.result) return events;
  if (input.move) s.lane = Math.max(0, Math.min(LANES - 1, s.lane + input.move));
  if (input.jump && s.air <= 0) {
    s.air = JUMP_TIME;
    events.push({ type: 'jump' });
  }
  if (input.shoot && s.cooldown <= 0) shoot(s, events);
  s.cooldown = Math.max(0, s.cooldown - dt);
  s.stumble = Math.max(0, s.stumble - dt);
  s.time -= dt;
  if (s.time <= 0) {
    s.time = 0;
    s.result = 'fail';
    events.push({ type: 'timeout' });
    return events;
  }
  const from = s.z;
  s.z += speed(s) * dt;
  for (const w of s.walkers) if (!w.fan) w.z -= WALK_SPEED * dt;
  pass(s, events);
  bump(s, from, events);
  s.air = Math.max(0, s.air - dt);
  if (s.z >= s.goal) {
    s.result = 'clear';
    events.push({ type: 'goal' });
  }
  return events;
}

export type Rank = 'S' | 'A' | 'B' | 'C';

export const score = (s: RunState): number => s.followers + Math.floor(s.time) * 20 + s.maxCombo * 10;

export function rank(points: number, best: number): Rank {
  const r = points / best;
  return r >= 0.9 ? 'S' : r >= 0.7 ? 'A' : r >= 0.5 ? 'B' : 'C';
}
```

注意点。`s.air` は当たり判定のあとで減らす（跳んだフレームの判定で空中として扱うため）。撃つ間隔の `cooldown` は、撃ったあとで同じフレームの `dt` を引く。テスト「撃つ間隔は 0.25 秒以上」は `0.01` のあと `0.1` では撃てず、撃たずに `SHOT_GAP` 進めてから撃つと当たる。

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm exec vitest run --project unit src/lib/games/megaphone-dash/engine.test.ts`
Expected: PASS。「0.6 秒空中にいて」のテストが `air` の値で落ちたら、`air` を減らす位置（当たり判定のあと）を確かめる。

- [ ] **Step 5: commit する**

```bash
git add src/lib/games/megaphone-dash/engine.ts src/lib/games/megaphone-dash/engine.test.ts
git commit -m "Add the running, shooting and dodging rules for メガホンダッシュ

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: ボス

**Files:**

- Modify: `src/lib/games/megaphone-dash/engine.ts`（`boss()` を足し、`step()` から呼ぶ）
- Test: `src/lib/games/megaphone-dash/engine.test.ts`（末尾に足す）

**Interfaces:**

- Consumes: Task 4 の `RunState`・`Boss`・`Drop`・`RunEvent`・`speed`・`hitBoss`
- Produces: `step()` がボスの面で `boss-in`・`throw`・`land`・`boss-hit`・`boss-down` を返すようになる

- [ ] **Step 1: 落ちるテストを足す**

```ts
describe('ボス', () => {
  /** 5 面を、ボスが現れる直前まで進めた状態 */
  function atBoss(): RunState {
    const s = empty(5);
    s.z = s.bossAt - 0.01;
    return s;
  }

  it('道のりの終わりで現れ、それまで校門はない', () => {
    const s = atBoss();
    expect(s.goal).toBe(Infinity);
    const events = step(s, 0.01);
    expect(events).toContainEqual({ type: 'boss-in' });
    expect(s.boss!.phase).toBe('fight');
  });

  it('同じレーンのときだけ倍率ぶん減り、当てるとコンボが伸びる', () => {
    const s = atBoss();
    step(s, 0.01);
    s.boss!.lane = 0;
    step(s, 0.01, { shoot: true });
    expect(s.boss!.hp).toBe(s.boss!.max);
    s.lane = 0;
    s.combo = 9;
    s.cooldown = 0;
    const events = step(s, 0.01, { shoot: true });
    expect(events).toContainEqual({ type: 'boss-hit', damage: 1.5, combo: 10 });
    expect(s.boss!.hp).toBe(s.boss!.max - 1.5);
  });

  it('ボスのあいだの撃つは通行人に当たらない', () => {
    const s = atBoss();
    step(s, 0.01);
    s.boss!.lane = 2;
    s.walkers = [walker(1, s.z + 5)];
    step(s, 0.01, { shoot: true });
    expect(s.walkers[0].fan).toBe(false);
  });

  it('0 にすると去り、30 m 先に校門が出る', () => {
    const s = atBoss();
    step(s, 0.01);
    s.boss!.hp = 1;
    s.boss!.lane = s.lane;
    const events = step(s, 0.01, { shoot: true });
    expect(events).toContainEqual({ type: 'boss-down' });
    expect(s.boss!.phase).toBe('gone');
    expect(s.goal).toBeCloseTo(s.z + 30, 0);
  });

  it('いまのレーンへ投げ、1.5 秒前から印を出して、およそ 12 m 先に落とす', () => {
    const s = atBoss();
    step(s, 0.01);
    s.boss!.lane = 2;
    s.boss!.moveIn = 99;
    s.boss!.throwIn = 0.005;
    const thrown = step(s, 0.01);
    const t = thrown.find((e) => e.type === 'throw');
    expect(t && t.type === 'throw' && t.drop.lane).toBe(2);
    expect(s.boss!.drops).toHaveLength(1);
    let landed: Obstacle | null = null;
    for (let i = 0; i < 16 && !landed; i++) for (const e of step(s, 0.1)) if (e.type === 'land') landed = e.obstacle;
    expect(landed).not.toBeNull();
    expect(landed!.kind).toBe('low');
    expect(landed!.z - s.z).toBeGreaterThan(10);
    expect(landed!.z - s.z).toBeLessThan(14);
    expect(s.blocks).toContain(landed);
    expect(s.boss!.drops).toHaveLength(0);
  });

  it('決まった間隔でほかのレーンへ移る', () => {
    const s = atBoss();
    step(s, 0.01);
    s.boss!.throwIn = 99;
    const lane = s.boss!.lane;
    step(s, s.rule.boss!.moveEvery);
    expect(s.boss!.lane).not.toBe(lane);
  });

  it('ボスのない面ではボスは出ない', () => {
    const s = empty(4);
    s.z = s.bossAt + 1;
    expect(step(s, 0.01).some((e) => e.type === 'boss-in')).toBe(false);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm exec vitest run --project unit src/lib/games/megaphone-dash/engine.test.ts -t ボス`
Expected: FAIL（`boss-in` が出ない）

- [ ] **Step 3: `boss()` を書く**

`engine.ts` の `bump()` のあとに次の関数を足し、`step()` の `s.air = Math.max(0, s.air - dt);` の次の行に `boss(s, dt, events);` を足す（校門の判定より前）。

```ts
function boss(s: RunState, dt: number, events: RunEvent[]) {
  const b = s.boss;
  const r = s.rule.boss;
  if (!b || !r || b.phase === 'gone') return;
  if (b.phase === 'wait') {
    if (s.z < s.bossAt) return;
    b.phase = 'fight';
    events.push({ type: 'boss-in' });
    return;
  }
  b.moveIn -= dt;
  if (b.moveIn <= 0) {
    b.moveIn += r.moveEvery;
    b.lane = (b.lane + 1 + Math.floor(s.rng.next() * (LANES - 1))) % LANES;
  }
  b.throwIn -= dt;
  if (b.throwIn <= 0) {
    b.throwIn += r.throwEvery;
    const kind = r.kinds[Math.floor(s.rng.next() * r.kinds.length)];
    // 落ちるときにおよそ DROP_AHEAD 先になるよう、いまの速さで WARN_TIME ぶん先へ置く
    const drop: Drop = { lane: b.lane, z: s.z + DROP_AHEAD + speed(s) * WARN_TIME, kind, t: WARN_TIME };
    b.drops.push(drop);
    events.push({ type: 'throw', drop });
  }
  for (const d of b.drops) {
    d.t -= dt;
    if (d.t > 0) continue;
    const obstacle: Obstacle = { lane: d.lane, z: d.z, kind: d.kind, look: 0, hit: false };
    s.blocks.push(obstacle);
    events.push({ type: 'land', obstacle });
  }
  b.drops = b.drops.filter((d) => d.t > 0);
}
```

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm exec vitest run --project unit src/lib/games/megaphone-dash/`
Expected: PASS（course・gesture・engine のすべて）

- [ ] **Step 5: commit する**

```bash
git add src/lib/games/megaphone-dash/engine.ts src/lib/games/megaphone-dash/engine.test.ts
git commit -m "Add the boss fight to メガホンダッシュ

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: 3D の場面・重ね描きの演出・効果音・振り分け

**Files:**

- Create: `src/lib/games/megaphone-dash/world3d.ts`
- Create: `src/lib/games/megaphone-dash/effects.ts`
- Create: `src/lib/games/megaphone-dash/sounds.ts`
- Create: `src/lib/games/megaphone-dash/director.ts`

**Interfaces:**

- Consumes: Task 1 の `models.ts` の全部、Task 4・5 の `engine.ts`（`RunState`・`RunEvent`・`Walker`・`Obstacle`・`Drop`・`JUMP_TIME`・`BOSS_AHEAD`・`speed`・`Rank`）、`course.ts` の `LANES`、`$lib/fx` の `Particles`・`Floaters`・`Shake`・`label`・`CONFETTI`・`Projector`、`$lib/audio.svelte` の `tone`・`sweep`・`noise`・`sfx`
- Produces:
  - `class RunWorld { constructor(canvas: HTMLCanvasElement, s: RunState); resize(w: number, h: number): void; precompile(): Promise<unknown>; handle(e: RunEvent): void; update(s: RunState, dt: number): void; render(): void; project(lane: number, dist: number, height: number, w: number, h: number): [number, number, number]; dispose(): void }`
  - `type Ending = { kind: 'rank'; rank: Rank; points: number } | { kind: 'timeout' }`
  - `class RunFx { readonly shake: Shake; handle(e: RunEvent, s: RunState): void; end(ending: Ending): void; step(dt: number): void; draw(ctx: CanvasRenderingContext2D, to: Projector, w: number, h: number): void }`
  - `sounds: Record<'shot' | 'hit' | 'miss' | 'jump' | 'bump' | 'bossIn' | 'bossHit' | 'bossDown' | 'throw' | 'timeout', (combo?: number) => void>`
  - `direct(events: RunEvent[], s: RunState, world: RunWorld | undefined, fx: RunFx): void`

- [ ] **Step 1: `world3d.ts` を書く**

```ts
import * as THREE from 'three';
import { LANES } from './course';
import {
  BOSS_AHEAD,
  JUMP_TIME,
  speed,
  type Drop,
  type Obstacle,
  type RunEvent,
  type RunState,
  type Walker
} from './engine';
import {
  barricade,
  boss,
  CAMERA,
  cheer,
  fence,
  gate,
  LANE_W,
  pole,
  runner,
  SEG,
  street,
  walker,
  warnRing,
  wave,
  type Figure
} from './models';

/** 町並みの区間の数。SEG × この数が見える奥行きになる（先は霧で消す） */
const SEGS = 7;
/** 通行人と障害物は、この距離より先と、後ろのこの距離より手前だけ組み立てておく */
const AHEAD = 110;
// すれ違ったものはすぐ消す。カメラと走る子のあいだに残ると画面の下を大きくふさぐ
const BEHIND = 1.5;
/** 後ろをついて走るファンの見える数 */
const FANS = 20;
/** 音の輪が飛ぶ速さ（m/s）と、消えるまでの秒 */
const WAVE_SPEED = 40;
const WAVE_LIFE = 0.35;

const laneX = (lane: number) => (lane - (LANES - 1) / 2) * LANE_W;

/** 走る子の足の振り。振る速さは走る速さに合わせる */
function swing(fig: Figure, phase: number, amount: number) {
  const a = Math.sin(phase) * amount;
  fig.legs[0].rotation.x = a;
  fig.legs[1].rotation.x = -a;
  fig.arms[0].rotation.x = -a * 0.8;
  fig.arms[1].rotation.x = a * 0.8;
}

export class RunWorld {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, 0.1, 140);
  readonly #sun = new THREE.DirectionalLight('#fff4e0', 2.4);
  readonly #hero = runner();
  #heroX = laneX(1);
  #phase = 0;
  #t = 0;
  #made = 0;
  readonly #segments: THREE.Group[] = [];
  readonly #walkers = new Map<Walker, Figure>();
  readonly #blocks = new Map<Obstacle, THREE.Group>();
  readonly #fans: Figure[] = [];
  readonly #rings = new Map<Drop, THREE.Mesh>();
  readonly #waves: { mesh: THREE.Mesh; age: number }[] = [];
  readonly #boss = boss();
  #bossX = laneX(1);
  readonly #gate = gate();

  constructor(canvas: HTMLCanvasElement, s: RunState) {
    // デフォルメのローポリなので、iPad の dpr 2 + MSAA は見た目に効かず描画だけ重い
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.renderer.setPixelRatio(Math.min(1.5, devicePixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene.background = new THREE.Color('#a9d6f5');
    this.scene.fog = new THREE.Fog('#cfe6f7', 45, 105);
    this.scene.add(new THREE.HemisphereLight('#eaf6ff', '#b9b2a6', 2.2));
    this.#sun.castShadow = true;
    this.#sun.shadow.mapSize.set(1024, 1024);
    const c = this.#sun.shadow.camera;
    c.left = c.bottom = -10;
    c.right = c.top = 10;
    c.near = 1;
    c.far = 30;
    this.scene.add(this.#sun, this.#sun.target);
    for (let i = 0; i < SEGS; i++) {
      const seg = street(i);
      this.#segments.push(seg);
      this.scene.add(seg);
    }
    this.#boss.group.visible = false;
    this.#gate.group.visible = false;
    this.scene.add(this.#hero.group, this.#boss.group, this.#gate.group);
    this.update(s, 0);
  }

  resize(w: number, h: number): void {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** シェーダーの準備。済むまで走り出さない */
  precompile(): Promise<unknown> {
    // compileAsync は見えているものしか準備しない。隠してある校門とボスもこのときだけ見せる（次の update で戻る）
    this.#gate.group.visible = true;
    this.#boss.group.visible = true;
    return this.renderer.compileAsync(this.scene, this.camera);
  }

  handle(e: RunEvent): void {
    if (e.type === 'shot') {
      const mesh = wave();
      mesh.position.set(this.#heroX, 0.9, this.#hero.group.position.z - 0.6);
      this.scene.add(mesh);
      this.#waves.push({ mesh, age: 0 });
      return;
    }
    if (e.type !== 'hit') return;
    const fig = this.#walkers.get(e.walker);
    if (!fig) return;
    this.#walkers.delete(e.walker);
    if (this.#fans.length >= FANS) {
      this.scene.remove(fig.group);
      return;
    }
    cheer(fig);
    fig.group.scale.setScalar(0.75);
    this.#fans.push(fig);
  }

  update(s: RunState, dt: number): void {
    this.#t += dt;
    const v = speed(s);
    this.#phase += dt * (4 + v * 1.4);
    const z = -s.z;
    this.#heroX += (laneX(s.lane) - this.#heroX) * Math.min(1, dt * 14);
    const air = s.air > 0 ? 1 - s.air / JUMP_TIME : 0;
    const hero = this.#hero;
    hero.group.position.set(this.#heroX, air > 0 ? 3.6 * air * (1 - air) : 0, z);
    hero.group.rotation.z = s.stumble > 0 ? Math.sin(this.#t * 30) * 0.2 : 0;
    swing(hero, this.#phase, s.result ? 0 : air > 0 ? 0.3 : 0.9);

    const camX = this.#heroX * 0.6;
    this.camera.position.set(camX, CAMERA.up, z + CAMERA.back);
    this.camera.lookAt(camX, CAMERA.lookUp, z - CAMERA.look);
    this.#sun.position.set(this.#heroX + 4, 12, z + 4);
    this.#sun.target.position.set(this.#heroX, 0, z - 6);

    const base = Math.floor(s.z / SEG) - 1;
    this.#segments.forEach((seg, i) => {
      const k = base + ((((i - base) % SEGS) + SEGS) % SEGS);
      seg.position.z = -k * SEG;
    });

    this.#syncWalkers(s);
    this.#syncBlocks(s);
    this.#fans.forEach((fig, i) => {
      // 走る子とカメラのあいだに入ると画面の下をふさぐので、左右の脇に寄せて並べる
      const side = i % 2 ? 1 : -1;
      const col = Math.floor(i / 2);
      const tx = this.#heroX + side * (0.9 + (col % 3) * 0.45);
      const tz = z + 0.2 + Math.floor(col / 3) * 0.7;
      const p = fig.group.position;
      const k = Math.min(1, dt * 6);
      p.set(p.x + (tx - p.x) * k, Math.abs(Math.sin(this.#phase + i)) * 0.12, p.z + (tz - p.z) * k);
      swing(fig, this.#phase + i, 0.8);
    });

    const b = s.boss;
    this.#boss.group.visible = b?.phase === 'fight';
    if (b?.phase === 'fight') {
      this.#bossX += (laneX(b.lane) - this.#bossX) * Math.min(1, dt * 4);
      this.#boss.group.position.set(this.#bossX, 2.2 + Math.sin(this.#t * 2) * 0.25, z - BOSS_AHEAD);
    }
    this.#syncRings(b?.drops ?? []);
    for (const w of this.#waves) {
      w.age += dt;
      w.mesh.position.z -= WAVE_SPEED * dt;
      w.mesh.scale.setScalar(1 + w.age * 4);
      if (w.age > WAVE_LIFE) this.scene.remove(w.mesh);
    }
    this.#waves.splice(0, this.#waves.length, ...this.#waves.filter((w) => w.age <= WAVE_LIFE));

    this.#gate.group.visible = Number.isFinite(s.goal);
    if (Number.isFinite(s.goal)) this.#gate.group.position.z = -s.goal;
  }

  #syncWalkers(s: RunState) {
    for (const w of s.walkers) {
      if (w.fan) continue;
      const ahead = w.z - s.z;
      let fig = this.#walkers.get(w);
      if (ahead > AHEAD || ahead < -BEHIND) {
        if (fig) {
          this.scene.remove(fig.group);
          this.#walkers.delete(w);
        }
        continue;
      }
      if (!fig) {
        fig = walker(this.#made++);
        this.#walkers.set(w, fig);
        this.scene.add(fig.group);
      }
      // 同じレーンですれ違う通行人は、ぶつからずに脇へよけてくれる
      const dodge = w.lane === s.lane && ahead < 3 ? (1 - Math.max(0, ahead) / 3) * 0.8 * (w.lane === 0 ? 1 : -1) : 0;
      fig.group.position.set(laneX(w.lane) + dodge, 0, -w.z);
      swing(fig, this.#phase * 0.5 + w.z, 0.5);
    }
  }

  #syncBlocks(s: RunState) {
    for (const o of s.blocks) {
      const ahead = o.z - s.z;
      let g = this.#blocks.get(o);
      if (ahead > AHEAD || ahead < -BEHIND) {
        if (g) {
          this.scene.remove(g);
          this.#blocks.delete(o);
        }
        continue;
      }
      if (!g) {
        g = o.kind === 'low' ? barricade() : o.look ? pole() : fence();
        this.#blocks.set(o, g);
        this.scene.add(g);
      }
      g.position.set(laneX(o.lane), 0, -o.z);
      // ぶつかったものは倒れて見せる
      g.rotation.x = o.hit ? -0.5 : 0;
    }
  }

  #syncRings(drops: Drop[]) {
    for (const [d, ring] of this.#rings)
      if (!drops.includes(d)) {
        this.scene.remove(ring);
        this.#rings.delete(d);
      }
    for (const d of drops) {
      let ring = this.#rings.get(d);
      if (!ring) {
        ring = warnRing();
        this.#rings.set(d, ring);
        this.scene.add(ring);
      }
      ring.position.set(laneX(d.lane), 0.03, -d.z);
      ring.scale.setScalar(1 + Math.sin(this.#t * 12) * 0.12);
    }
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /** レーン・距離・高さ（m）を、画面のピクセルと、そこでの 1 m あたりのピクセル数へ */
  project(lane: number, dist: number, height: number, w: number, h: number): [number, number, number] {
    const p = new THREE.Vector3(laneX(lane), height, -dist).project(this.camera);
    const q = new THREE.Vector3(laneX(lane) + 1, height, -dist).project(this.camera);
    return [((p.x + 1) / 2) * w, ((1 - p.y) / 2) * h, (Math.abs(q.x - p.x) / 2) * w];
  }

  dispose(): void {
    // mat() の material と geometry はモジュールで共有していて次の面でも使うので、ここで作った看板だけ捨てる
    this.#gate.dispose();
    this.renderer.dispose();
    // dispose() だけではコンテキストが残り、Safari は十数個で古いものを失う
    this.renderer.forceContextLoss();
  }
}
```

- [ ] **Step 2: `effects.ts` を書く**

```ts
import { CONFETTI, Floaters, label, Particles, Shake, type Projector } from '$lib/fx';
import { BOSS_AHEAD, type Rank, type RunEvent, type RunState } from './engine';

export type Ending = { kind: 'rank'; rank: Rank; points: number } | { kind: 'timeout' };

const RANK_COLOR: Record<Rank, string> = { S: '#ffb300', A: '#ff4d8b', B: '#1f9bff', C: '#58c46b' };

/**
 * 3D の上に重ねる演出。粒と浮かぶ文字は (レーン, 距離) で持ち、描くときに画面へ写す。
 * 帯の文字と終わりのカードは画面のピクセルで描く
 */
export class RunFx {
  readonly particles = new Particles();
  readonly floaters = new Floaters();
  readonly shake = new Shake();
  #banner: { text: string; age: number } | null = null;
  #ending: (Ending & { age: number }) | null = null;

  handle(e: RunEvent, s: RunState): void {
    const p = this.particles;
    if (e.type === 'hit') {
      this.floaters.add(`+${e.gain}`, e.walker.lane, e.walker.z, 0.8, '#ff3d8b');
      p.burst(e.walker.lane, e.walker.z, {
        count: 14,
        color: ['#ff7eb6', '#7fe3ff', '#ffffff'],
        speed: 1.2,
        size: 0.12,
        life: 0.5
      });
    } else if (e.type === 'miss') this.floaters.add('にげられた', e.walker.lane, s.z + 7, 0.35, '#7a7f8c');
    else if (e.type === 'bump') {
      this.floaters.add('ドン！', s.lane, s.z + 6, 0.5, '#ff4d5e');
      this.shake.add(0.6);
    } else if (e.type === 'boss-in') this.#banner = { text: 'ボスが あらわれた！', age: 0 };
    else if (e.type === 'boss-hit' && s.boss) {
      const at = s.z + BOSS_AHEAD;
      this.floaters.add(`-${e.damage}`, s.boss.lane, at, 1.2, '#ffffff');
      p.burst(s.boss.lane, at, {
        count: 10,
        color: ['#ff7eb6', '#ffffff'],
        speed: 1.5,
        size: 0.25,
        life: 0.4,
        glow: true
      });
    } else if (e.type === 'boss-down') {
      this.#banner = { text: 'やっつけた！', age: 0 };
      p.burst(1, s.z + BOSS_AHEAD, { count: 40, color: CONFETTI, speed: 2.5, size: 0.3, life: 1 });
    } else if (e.type === 'goal')
      for (let lane = 0; lane < 3; lane++)
        p.burst(lane, s.z + 6, { count: 24, color: CONFETTI, speed: 1.5, size: 0.2, life: 1.2 });
  }

  end(ending: Ending): void {
    this.#ending = { ...ending, age: 0 };
  }

  step(dt: number): void {
    this.particles.step(dt);
    this.floaters.step(dt);
    if (this.#banner) {
      this.#banner.age += dt;
      if (this.#banner.age > 1.6) this.#banner = null;
    }
    if (this.#ending) this.#ending.age += dt;
  }

  draw(ctx: CanvasRenderingContext2D, to: Projector, w: number, h: number): void {
    this.particles.draw(ctx, to);
    this.floaters.draw(ctx, to);
    const size = Math.min(w, h);
    if (this.#banner) {
      ctx.globalAlpha = Math.min(1, (1.6 - this.#banner.age) * 3);
      label(ctx, this.#banner.text, w / 2, h * 0.3, size * 0.08, '#ff4d5e');
      ctx.globalAlpha = 1;
    }
    const end = this.#ending;
    if (!end) return;
    const pop = Math.min(1, end.age / 0.25);
    ctx.fillStyle = `rgb(255 255 255 / ${0.55 * pop})`;
    ctx.fillRect(0, 0, w, h);
    if (end.kind === 'timeout') {
      label(ctx, 'じかんぎれ…', w / 2, h * 0.45, size * 0.1 * pop, '#7a7f8c');
      return;
    }
    label(ctx, 'がっこうに ついた！', w / 2, h * 0.3, size * 0.07, '#1f9bff');
    label(ctx, end.rank, w / 2, h * 0.47, size * 0.3 * (0.6 + pop * 0.4), RANK_COLOR[end.rank]);
    label(ctx, `てんすう ${end.points}`, w / 2, h * 0.64, size * 0.06, '#2b2d42');
  }
}
```

- [ ] **Step 3: `sounds.ts` を書く**

```ts
import { noise, sfx, sweep, tone } from '$lib/audio.svelte';

export const sounds = {
  shot: () => sweep(520, 880, 90, 0.05),
  /** コンボが伸びるほど音を上げる */
  hit: (combo = 1) => {
    const f = 660 * 2 ** (Math.min(combo, 24) / 24);
    tone(f, 90, 'triangle', 0.1);
    tone(f * 1.5, 120, 'triangle', 0.08, 60);
  },
  miss: () => tone(330, 160, 'sine', 0.06),
  jump: () => sweep(400, 900, 140, 0.06),
  bump: () => {
    noise(140, 0.25);
    sweep(300, 90, 200, 0.1);
  },
  bossIn: () => {
    tone(196, 300, 'square', 0.06);
    tone(147, 500, 'square', 0.06, 280);
  },
  bossHit: () => {
    sweep(900, 400, 80, 0.06);
    noise(60, 0.12);
  },
  bossDown: () => sfx.finish(),
  throw: () => sweep(700, 250, 400, 0.05),
  timeout: () => {
    tone(392, 180);
    tone(330, 180, 'triangle', 0.14, 170);
    tone(262, 380, 'triangle', 0.14, 340);
  }
};
```

- [ ] **Step 4: `director.ts` を書く**

```ts
import { sfx } from '$lib/audio.svelte';
import type { RunFx } from './effects';
import type { RunEvent, RunState } from './engine';
import { sounds } from './sounds';
import type { RunWorld } from './world3d';

/** engine の出来事を 3D・重ね描き・音へ配る */
export function direct(events: RunEvent[], s: RunState, world: RunWorld | undefined, fx: RunFx): void {
  for (const e of events) {
    world?.handle(e);
    fx.handle(e, s);
    if (e.type === 'shot') sounds.shot();
    else if (e.type === 'hit') sounds.hit(e.combo);
    else if (e.type === 'miss') sounds.miss();
    else if (e.type === 'jump') sounds.jump();
    else if (e.type === 'bump') sounds.bump();
    else if (e.type === 'boss-in') sounds.bossIn();
    else if (e.type === 'boss-hit') sounds.bossHit();
    else if (e.type === 'boss-down') sounds.bossDown();
    else if (e.type === 'throw') sounds.throw();
    else if (e.type === 'goal') sfx.finish();
    else if (e.type === 'timeout') sounds.timeout();
  }
}
```

- [ ] **Step 5: 型と lint を通す**

Run: `pnpm check && pnpm exec eslint src/lib/games/megaphone-dash`
Expected: エラー 0。

- [ ] **Step 6: commit する**

```bash
git add src/lib/games/megaphone-dash/world3d.ts src/lib/games/megaphone-dash/effects.ts src/lib/games/megaphone-dash/sounds.ts src/lib/games/megaphone-dash/director.ts
git commit -m "Draw and sound メガホンダッシュ: 3D street, overlay effects and event routing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: 画面の配線と一覧への登録

**Files:**

- Create: `src/lib/games/megaphone-dash/Hud.svelte`
- Create: `src/lib/games/megaphone-dash/Howto.svelte`
- Create: `src/lib/games/megaphone-dash/MegaphoneDash.svelte`
- Create: `src/lib/games/megaphone-dash/meta.ts`
- Modify: `src/lib/games.ts`（import 1 行と `games` 配列の先頭に 1 行）
- Modify: `scripts/thumbs/scenes.ts`（`snow-camp` の場面のあとに 1 つ足す）
- Create: `static/thumbs/megaphone-dash.webp`（`pnpm thumbs megaphone-dash` が作る）

**Interfaces:**

- Consumes: Task 2〜6 のすべて、`$lib/board-input` の `BoardInput`、`$lib/loop` の `animate`、`$lib/games` の `SoloProps`・`GameMeta`、`$lib/components/Icon.svelte`
- Consumes（一覧の絵）: `scripts/thumbs/stage.ts` の `Stage`（`startSolo()`・`touch(id, 'down' | 'move' | 'up', x, y)`・`drag(id, path, ms)`・`wait(ms)`）
- Produces: 一覧から遊べるゲーム `megaphone-dash` と、一覧のカード・タイトルの額の絵

- [ ] **Step 1: `Hud.svelte` を書く**

```svelte
<script lang="ts">
  let {
    level,
    time,
    combo,
    followers,
    mps,
    boss
  }: {
    level: number;
    time: number;
    combo: number;
    followers: number;
    mps: number;
    boss: { hp: number; max: number } | null;
  } = $props();
</script>

<div class="hud">
  <div class="row">
    <span class="chip sticker">レベル {level}</span>
    <span class="chip time" class:low={time <= 10}>のこり {time.toFixed(1)}</span>
    <span class="chip fans">フォロワー {followers}</span>
  </div>
  {#if boss}
    <div
      class="bar"
      role="meter"
      aria-label="ボスの体力"
      aria-valuemin="0"
      aria-valuemax={boss.max}
      aria-valuenow={boss.hp}
    >
      <span style:width="{(boss.hp / boss.max) * 100}%"></span>
    </div>
  {/if}
</div>
<div class="combo" aria-live="polite">
  <b>{combo}</b>
  <small>コンボ {mps.toFixed(1)} m/s</small>
</div>

<style>
  .hud {
    position: absolute;
    top: 14px;
    left: 72px;
    right: 72px;
    display: grid;
    gap: 8px;
    justify-items: center;
    pointer-events: none;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }

  .chip {
    padding: 4px 14px;
    border: 3px solid #fff;
    border-radius: 999px;
    background: rgb(255 255 255 / 0.85);
    box-shadow: 0 3px 0 rgb(43 45 66 / 0.12);
    font-size: min(2.2cqh, 4cqw);
    font-weight: 800;
  }

  .fans {
    background: #ffd6e7;
  }

  .low {
    background: var(--p2);
    color: #fff;
  }

  .bar {
    width: min(60cqw, 420px);
    height: min(1.6cqh, 3cqw);
    border: 3px solid #fff;
    border-radius: 999px;
    background: rgb(43 45 66 / 0.5);
    overflow: hidden;
  }

  .bar span {
    display: block;
    height: 100%;
    background: #ff2a3d;
    transition: width 0.15s;
  }

  .combo {
    position: absolute;
    left: 5cqw;
    top: 52%;
    display: grid;
    justify-items: center;
    color: #fff;
    text-shadow:
      0 3px 0 rgb(43 45 66 / 0.35),
      0 0 6px rgb(43 45 66 / 0.4);
    pointer-events: none;
  }

  .combo b {
    font-size: min(8cqh, 14cqw);
    line-height: 1;
  }

  .combo small {
    font-size: min(1.8cqh, 3.2cqw);
    font-weight: 800;
  }
</style>
```

- [ ] **Step 2: `Howto.svelte` を書く**

```svelte
<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
</script>

<span class="howto-rule"
  >タップでメガホンを撃って、通行人をファンにしよう。指を左右にずらしてよけ、上にずらして跳ぶ</span
>
<span class="howto-legend">
  <span class="howto-item"><span class="howto-mark"><Icon name="tap" /></span>タップで撃つ</span>
  <span class="howto-item"><span class="howto-mark"><Icon name="arrow" rotate={90} /></span>左右でよける</span>
  <span class="howto-item"><span class="howto-mark"><Icon name="kid" /></span>当て続けると速くなる</span>
</span>
```

- [ ] **Step 3: `MegaphoneDash.svelte` を書く**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { BoardInput } from '$lib/board-input';
  import type { SoloProps } from '$lib/games';
  import { animate } from '$lib/loop';
  import { direct } from './director';
  import { RunFx } from './effects';
  import { createState, rank, score, speed, step, type RunInput } from './engine';
  import { Gestures, type Gesture } from './gesture';
  import Hud from './Hud.svelte';
  import { RunWorld } from './world3d';

  let { level, onfinish }: SoloProps = $props();

  let gl: HTMLCanvasElement;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let world: RunWorld | undefined;
  // level はゲームごと作り直されるので、最初の値だけ使えばよい
  const fresh = () => createState(level);
  const game = fresh();
  const fx = new RunFx();
  const gestures = new Gestures();
  /** 次の step() に渡す入力。指の出来事はフレームの合間に届くので、ここへためる */
  let pending: RunInput = {};
  let ready = $state(false);
  let time = $state(game.time);
  let combo = $state(0);
  let followers = $state(0);
  let mps = $state(0);
  let boss = $state<{ hp: number; max: number } | null>(null);
  let endTimer: ReturnType<typeof setTimeout> | undefined;

  function apply(list: Gesture[]) {
    for (const g of list) {
      if (g === 'shoot') pending.shoot = true;
      else if (g === 'jump') pending.jump = true;
      else pending.move = (pending.move ?? 0) + (g === 'right' ? 1 : -1);
    }
  }

  const input = new BoardInput({
    down: (event, x, y) => apply(gestures.down(event.pointerId, ...input.px(x, y))),
    up: (event, _finger, x, y) => apply(gestures.up(event.pointerId, ...input.px(x, y)))
  });

  function resize() {
    const [w, h] = input.px(1, 1);
    const dpr = devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx = canvas.getContext('2d');
    world?.resize(w, h);
  }

  function finish() {
    if (game.result === 'clear') {
      fx.end({ kind: 'rank', rank: rank(score(game), game.rule.best), points: score(game) });
      endTimer = setTimeout(() => onfinish(true), 2000);
    } else {
      fx.end({ kind: 'timeout' });
      endTimer = setTimeout(() => onfinish(false), 1000);
    }
  }

  /** Svelte の状態は変わったときだけ書く。残り時間は 0.1 秒ごとに間引く */
  function syncHud() {
    const t = Math.ceil(game.time * 10) / 10;
    if (time !== t) time = t;
    if (combo !== game.combo) combo = game.combo;
    if (followers !== game.followers) followers = game.followers;
    const v = Math.round(speed(game) * 10) / 10;
    if (mps !== v) mps = v;
    const b = game.boss?.phase === 'fight' ? game.boss : null;
    if (!b) boss = null;
    else if (boss?.hp !== b.hp) boss = { hp: b.hp, max: b.max };
  }

  function frame(dt: number) {
    for (const [id, f] of input.fingers.all) apply(gestures.move(id, ...input.px(f.x, f.y)));
    if (!ready) {
      pending = {};
      return;
    }
    if (!game.result) {
      const events = step(game, dt, pending);
      pending = {};
      direct(events, game, world, fx);
      if (game.result) finish();
    } else pending = {};
    syncHud();
    fx.step(dt);
    world?.update(game, dt);
    world?.render();
    if (!ctx || !world) return;
    const [w, h] = input.px(1, 1);
    const dpr = devicePixelRatio || 1;
    const [sx, sy] = fx.shake.offset(dt, 10);
    ctx.setTransform(dpr, 0, 0, dpr, sx * dpr, sy * dpr);
    ctx.clearRect(-20, -20, w + 40, h + 40);
    fx.draw(ctx, (lane, dist) => world!.project(lane, dist, 1.3, w, h), w, h);
  }

  onMount(() => {
    world = new RunWorld(gl, game);
    resize();
    let alive = true;
    const go = () => {
      if (alive) ready = true;
    };
    // compileAsync が落ちても始められるよう、先に見切りのタイマーを仕掛ける
    const giveUp = setTimeout(go, 1500);
    world.precompile().then(go, go);
    const stop = animate(frame);
    return () => {
      alive = false;
      stop();
      clearTimeout(giveUp);
      clearTimeout(endTimer);
      world?.dispose();
    };
  });
</script>

<div class="board" use:input.board={resize} role="application" aria-label="メガホンダッシュの通学路">
  <canvas bind:this={gl}></canvas>
  <canvas bind:this={canvas}></canvas>
  <Hud {level} {time} {combo} {followers} {mps} {boss} />
  {#if !ready}
    <p class="wait sticker">じゅんびちゅう…</p>
  {/if}
</div>

<style>
  .board {
    position: absolute;
    inset: 0;
    overflow: hidden;
    touch-action: none;
    background: #a9d6f5;
  }

  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .wait {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    margin: 0;
    font-size: min(4cqh, 7cqw);
    background: rgb(255 255 255 / 0.6);
  }
</style>
```

`ready` が `false` のあいだは `step()` を呼ばないので、制限時間は数えない。

- [ ] **Step 4: `meta.ts` を書き、一覧に足す**

`src/lib/games/megaphone-dash/meta.ts`

```ts
import type { GameMeta } from '$lib/games';

export default {
  id: 'megaphone-dash',
  name: 'メガホンダッシュ',
  description: 'メガホンで通行人をファンにしながら、学校までダッシュ。当て続けるほど速くなり、ボスもやっつける',
  players: 1,
  levels: 15,
  minutes: '1分',
  load: async () => ({
    Game: (await import('./MegaphoneDash.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
```

`src/lib/games.ts` の import の並び（アルファベット順）の `import lightning from './games/lightning/meta';` のあとに `import megaphoneDash from './games/megaphone-dash/meta';` を足し、`export const games: GameMeta[] = [` の直後の行に `megaphoneDash,` を足す。

- [ ] **Step 5: 一覧の絵の台本を足す**

`scripts/thumbs/scenes.ts` の `snow-camp` の場面の `},` のあとに足す。

```ts
  {
    id: 'megaphone-dash',
    level: 3,
    clip: band(440),
    play: async (s) => {
      await s.startSolo();
      // 3D の準備（最長 1.5 秒）が済んで走り出すのを待つ
      await s.wait(2500);
      // 通行人のいるレーンは面ごとに違うので、レーンを行き来しながら撃ってファンと「+N」を写す
      for (let i = 0; i < 16; i++) {
        if (i % 4 === 3) {
          const to: [number, number] = [i % 8 === 3 ? 350 : 418, 760];
          await s.drag(1, [[384, 760], to], 120);
          await s.touch(1, 'up', ...to);
        } else {
          await s.touch(1, 'down', 384, 760);
          await s.touch(1, 'up', 384, 760);
        }
        await s.wait(220);
      }
    }
  },
```

- [ ] **Step 6: 一覧の絵を撮って見る**

Run: `pnpm thumbs megaphone-dash`
Expected: `static/thumbs/megaphone-dash.webp` ができる。Read で開き、走る子・ファン・「+N」・町並みが枠に収まっているかを見る。ファンが写っていなければ、ループの回数を増やして撮り直す。走る子が切れていれば `band(440)` の数を変えて撮り直す。

- [ ] **Step 7: 型・lint・テストを通す**

Run: `pnpm check && pnpm lint && pnpm test:run`
Expected: すべて通る（`src/lib/games.test.ts` は一覧の絵があることを確かめるので、Step 6 のあとに走らせる）。`MegaphoneDash.svelte` が 200 行未満であること（`wc -l`）。`architecture/component-size` や markuplint で落ちたら、指摘どおりに直す。

- [ ] **Step 8: dev で遊べることを確かめる**

`preview_start` の `dev` を起こし、Task 9 の Step 1 と同じ形の node スクリプト（headless Chrome、`viewport: { width: 820, height: 1180 }`、`hasTouch: true`）で `http://localhost:5173/asobibako/games/megaphone-dash` を開く。ページは `reducedMotion: 'reduce'` で開き（タイトルの `button.go` は揺れ続けるので、そのままでは Playwright の click が待ち続ける）、`goto` は `waitUntil: 'networkidle'` で待つ。`button.go` を押したら `.board canvas` が出るのを待ち、3 秒待って画面の真ん中を 5 回タップしてから `page.screenshot` を撮る。Read で見て、町並み・走る子・HUD が出て、「じゅんびちゅう」が消え、走り出していることを確かめる。コンソールにエラーがないことも見る。

- [ ] **Step 9: commit する**

```bash
git add src/lib/games/megaphone-dash src/lib/games.ts scripts/thumbs/scenes.ts static/thumbs/megaphone-dash.webp
git commit -m "Wire up メガホンダッシュ and add it to the game list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: ボットで制限時間とランクの基準を決める

**Files:**

- Create（commit しない）: `$SCRATCH/sim/vitest.config.mjs`、`$SCRATCH/sim/megaphone.sim.ts`
- Modify: `src/lib/games/megaphone-dash/course.ts`（`rule()` の `time` と `best` を表から引く）
- Modify: `src/lib/games/megaphone-dash/course.test.ts`（表の長さを確かめる 1 件を足す）

**Interfaces:**

- Consumes: `engine.ts` の `createState`・`step`・`score`・`speed`・`SHOT_RANGE`・`DEPTH`、`course.ts` の `LEVELS`
- Produces: `course.ts` の `TIME: number[]` と `BEST: number[]`（長さ 15、面の番号 - 1 で引く）

- [ ] **Step 1: scratchpad の vitest 設定を書く**

`$SCRATCH/sim/vitest.config.mjs`。scratchpad からは `vitest/config` を import できない（`node_modules` がない）ので、素のオブジェクトを書き出す。

```js
const REPO = '$REPO';
export default {
  resolve: { alias: { $lib: `${REPO}/src/lib` } },
  server: { fs: { strict: false } },
  test: { include: ['**/*.sim.ts'] }
};
```

- [ ] **Step 2: ボットと集計を書く**

`$SCRATCH/sim/megaphone.sim.ts`（`$REPO` は絶対パスに置き換える）

```ts
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { LEVELS } from '$REPO/src/lib/games/megaphone-dash/course';
import {
  createState,
  DEPTH,
  score,
  SHOT_RANGE,
  speed,
  step,
  type RunInput,
  type RunState
} from '$REPO/src/lib/games/megaphone-dash/engine';

interface Skill {
  name: string;
  /** 判断の間隔（秒）。反応の遅れの代わり */
  every: number;
  /** 当てられる通行人を撃つ割合 */
  shoot: number;
  /** 障害物を見落とす割合 */
  slip: number;
}

const SKILLS: Skill[] = [
  { name: 'うまい', every: 0, shoot: 1, slip: 0 },
  { name: 'ふつう', every: 0.3, shoot: 0.8, slip: 0.1 },
  { name: 'ゆっくり', every: 0.6, shoot: 0.5, slip: 0.2 },
  { name: 'はしるだけ', every: 0.6, shoot: 0, slip: 0.2 }
];

/** 決まった乱数。ボットの失敗も毎回同じにする */
function rng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function danger(s: RunState, lane: number, window: number) {
  let cost = 0;
  for (const o of s.blocks) {
    const d = o.z - s.z;
    if (o.hit || o.lane !== lane || d < -DEPTH || d > window) continue;
    cost += o.kind === 'high' ? 100 : 5;
  }
  for (const d of s.boss?.drops ?? []) if (d.lane === lane) cost += d.kind === 'high' ? 100 : 5;
  return cost;
}

function decide(s: RunState, skill: Skill, r: () => number): RunInput {
  const v = speed(s);
  const window = v * (0.8 + skill.every);
  let best = s.lane;
  let bestCost = Infinity;
  for (let lane = 0; lane < 3; lane++) {
    let cost = danger(s, lane, window) + Math.abs(lane - s.lane) * 2;
    if (s.boss?.phase === 'fight' && s.boss.lane === lane) cost -= 8;
    if (s.walkers.some((w) => !w.fan && w.lane === lane && w.z - s.z > 0 && w.z - s.z < 20)) cost -= 6;
    if (cost < bestCost) {
      bestCost = cost;
      best = lane;
    }
  }
  if (r() < skill.slip) best = s.lane;
  const input: RunInput = { move: Math.sign(best - s.lane) };
  const low = s.blocks.find(
    (o) => !o.hit && o.lane === s.lane && o.kind === 'low' && o.z - s.z > 0 && o.z - s.z < v * 0.25 + DEPTH
  );
  if (low && r() >= skill.slip) input.jump = true;
  const target =
    s.boss?.phase === 'fight'
      ? s.boss.lane === s.lane
      : s.walkers.some((w) => !w.fan && w.lane === s.lane && w.z >= s.z && w.z - s.z <= SHOT_RANGE);
  if (target && r() < skill.shoot) input.shoot = true;
  return input;
}

function run(level: number, skill: Skill, time?: number) {
  const s = createState(level);
  if (time !== undefined) s.time = time;
  else s.time = 9999;
  const r = rng(level * 31 + skill.every * 100);
  const dt = 1 / 60;
  let wait = 0;
  let t = 0;
  while (!s.result && t < 600) {
    wait -= dt;
    let input: RunInput = {};
    if (wait <= 0) {
      input = decide(s, skill, r);
      wait = skill.every;
    }
    step(s, dt, input);
    t += dt;
  }
  return { cleared: s.result === 'clear', used: t, points: score(s) };
}

it('メガホンダッシュの制限時間とランクの基準', () => {
  const rows = [];
  const time: number[] = [];
  const best: number[] = [];
  for (let level = 1; level <= LEVELS; level++) {
    const used = Object.fromEntries(SKILLS.map((k) => [k.name, run(level, k).used]));
    // ふつうがぎりぎり着ける時間。1 面だけは、撃たずに走るだけの子どもでも着けるようにする
    const need = level === 1 ? Math.max(used['ふつう'], used['ゆっくり'], used['はしるだけ']) : used['ふつう'];
    const limit = Math.ceil(need * 1.08);
    const results = Object.fromEntries(SKILLS.map((k) => [k.name, run(level, k, limit)]));
    time.push(limit);
    best.push(results['うまい'].points);
    rows.push({ level, limit, used, results });
  }
  writeFileSync(new URL('./megaphone-result.json', import.meta.url), JSON.stringify({ time, best, rows }, null, 2));
});
```

- [ ] **Step 3: 走らせる**

Run: `pnpm exec vitest run --config $SCRATCH/sim/vitest.config.mjs --root $SCRATCH/sim megaphone.sim.ts`
Expected: PASS。`$SCRATCH/sim/megaphone-result.json` ができる。`--root /` は使わない（ファイルシステム全体をなめて返らなくなる）。

- [ ] **Step 4: 結果を読み、客観的な問題だけ直す**

`megaphone-result.json` を読み、次を確かめる。

| 見ること           | 満たすべきこと                                                 |
| ------------------ | -------------------------------------------------------------- |
| うまいボット       | 全 15 面で `cleared: true`                                     |
| ふつうのボット     | 全 15 面で `cleared: true`（ぎりぎり）                         |
| ゆっくりのボット   | 1 面で `cleared: true`                                         |
| はしるだけのボット | 1 面で `cleared: true`                                         |
| 制限時間           | 面が進むほど大きく外れて逆転していない（ボスの面は長くてよい） |

うまいボットが着けない面があれば、`course.ts` の並べ方（`double` や `high` の割合）を下げる。好みで決まる調整（全体の難しさ）は数字を添えてユーザーに聞く。

- [ ] **Step 5: 落ちるテストを足す**

`course.test.ts` に足す。

```ts
it('制限時間とランクの基準は面ごとに決めてある', () => {
  for (const level of levels) {
    expect(rule(level).time).toBeGreaterThan(20);
    expect(rule(level).best).toBeGreaterThan(0);
  }
  expect(rule(5).time).toBeGreaterThan(rule(4).time);
});
```

Run: `pnpm exec vitest run --project unit src/lib/games/megaphone-dash/course.test.ts`
Expected: この時点では通ることもある（式の初期値のため）。通っても次へ進む。

- [ ] **Step 6: 表を `course.ts` に写す**

`course.ts` の `LevelRule` の定義の前に、`megaphone-result.json` の `time` と `best` の配列をそのまま写す。

```ts
/** 面ごとの制限時間（秒）。ふつうのボットがぎりぎり着ける時間で、ボットに走らせて決めた。面の番号 - 1 で引く */
const TIME = [/* megaphone-result.json の time の 15 個 */];
/** 面ごとのうまいボットの点。ランクの基準。面の番号 - 1 で引く */
const BEST = [/* megaphone-result.json の best の 15 個 */];
```

（コメントの中の `/* … */` は写すときに実際の数の並びで置き換え、残さない。）

`rule()` の `const time = Math.round((length / BASE_SPEED) * 1.3) + (boss ? 30 : 0);` を `const time = TIME[n - 1];` に、`best: Math.round(length * 6 + time * 10)` を `best: BEST[n - 1]` に変える。

- [ ] **Step 7: 全部のテストを通す**

Run: `pnpm exec vitest run --project unit src/lib/games/megaphone-dash/`
Expected: PASS。`engine.test.ts` の「時間切れ」などは `s.time` を直接書くので、表の値に左右されない。

- [ ] **Step 8: commit する**

```bash
git add src/lib/games/megaphone-dash/course.ts src/lib/games/megaphone-dash/course.test.ts
git commit -m "Set メガホンダッシュ time limits and rank bars from bot runs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: 遊ばせて撮る確かめ・verify

**Files:**

- Create（commit しない）: `$SCRATCH/play/megaphone-play.mjs`

**Interfaces:**

- Consumes: Task 8 までの遊べるゲーム
- Produces: 確かめた画面の画像（commit しない）

- [ ] **Step 1: 遊ばせて撮る台本を書く**

`$SCRATCH/play/megaphone-play.mjs`（`$REPO` と `$SCRATCH` は絶対パスに置き換える）

```js
import { createRequire } from 'node:module';

const REPO = '$REPO';
const OUT = '$SCRATCH/play';
const require = createRequire(`${REPO}/package.json`);
const { chromium } = require('playwright-core');
const URL = 'http://localhost:5173/asobibako/games/megaphone-dash';

const browser = await chromium.launch({ channel: 'chrome' });
const errors = [];

async function open(viewport, level) {
  // タイトルの button.go は揺れ続けるので、動きを止めないと Playwright の click が待ち続ける
  const page = await browser.newPage({ viewport, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text());
  });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate((n) => localStorage.setItem('asobibako:reached:megaphone-dash', String(n)), level);
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('button.go');
  await page.waitForSelector('.board canvas');
  await page.waitForFunction(() => !document.querySelector('.wait'), null, { timeout: 5000 });
  return page;
}

/** pointerId 付きのタッチを盤面へ投げる */
async function touch(page, id, type, x, y) {
  await page.evaluate(
    ([id, type, x, y]) => {
      const el = document.elementFromPoint(x, y);
      el?.dispatchEvent(
        new PointerEvent(type, {
          pointerId: id,
          pointerType: 'touch',
          clientX: x,
          clientY: y,
          bubbles: true,
          isPrimary: id === 1
        })
      );
    },
    [id, type, x, y]
  );
}

async function tap(page, x, y) {
  await touch(page, 1, 'pointerdown', x, y);
  await touch(page, 1, 'pointerup', x, y);
}

async function swipe(page, id, from, to) {
  await touch(page, id, 'pointerdown', ...from);
  for (let k = 1; k <= 6; k++)
    await touch(page, id, 'pointermove', from[0] + ((to[0] - from[0]) * k) / 6, from[1] + ((to[1] - from[1]) * k) / 6);
  await touch(page, id, 'pointerup', ...to);
}

// 縦: 走る・撃つ・よける
{
  const page = await open({ width: 820, height: 1180 }, 3);
  for (let i = 0; i < 10; i++) {
    await tap(page, 410, 800);
    await page.waitForTimeout(250);
  }
  await page.screenshot({ path: `${OUT}/run.png` });
  await swipe(page, 2, [410, 900], [340, 900]);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/swipe-left.png` });
  // 1 フレームの時間を測る
  const frame = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const times = [];
        let last = performance.now();
        const tick = (now) => {
          times.push(now - last);
          last = now;
          if (times.length < 120) requestAnimationFrame(tick);
          else resolve(times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)]);
        };
        requestAnimationFrame(tick);
      })
  );
  console.log('frame p95 ms', frame);
  await page.close();
}

// ボス（5 面）とランク
{
  const page = await open({ width: 820, height: 1180 }, 5);
  const start = Date.now();
  let boss = false;
  while (Date.now() - start < 120000) {
    await tap(page, 410, 800);
    await page.waitForTimeout(200);
    if (!boss && (await page.$('[aria-label="ボスの体力"]'))) {
      boss = true;
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${OUT}/boss.png` });
    }
    if (await page.$('.result, button.again')) break;
  }
  await page.screenshot({ path: `${OUT}/end.png` });
  await page.close();
}

// 横向き: 盤面は時計回りに回るので、画面の下へのスワイプが盤面の右になる
{
  const page = await open({ width: 1180, height: 820 }, 3);
  await page.screenshot({ path: `${OUT}/landscape.png` });
  await swipe(page, 2, [590, 300], [590, 380]);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/landscape-swipe.png` });
  await page.close();
}

// ↻ を 12 回押しても WebGL のコンテキストが尽きない
{
  const page = await open({ width: 820, height: 1180 }, 1);
  for (let i = 0; i < 12; i++) {
    await page.click('button.retry');
    await page.waitForTimeout(400);
  }
  await page.waitForSelector('.board canvas');
  await page.waitForFunction(() => !document.querySelector('.wait'), null, { timeout: 5000 });
  await page.screenshot({ path: `${OUT}/retry.png` });
  await page.close();
}

console.log('errors', JSON.stringify(errors, null, 2));
await browser.close();
```

ボスの場面は、クリアしないと出ない。1 面ずつ進めなくてよいよう、`asobibako:reached:megaphone-dash`（`src/lib/levels.ts` の `levelKey`）にたどり着いた面を書いてから読み直す。タイトルはたどり着いた面から始まる。タップだけではボスに当たらないこともあるので、ボスの場面が撮れなければ、ボスの体力が出た時点でもよい。

- [ ] **Step 2: 走らせて見る**

Run: `node $SCRATCH/play/megaphone-play.mjs`
Expected: `frame p95 ms` が 20 前後以下。`errors` に `WebGL` や `Too many active WebGL contexts` がない。`run.png`・`swipe-left.png`・`boss.png`・`end.png`・`landscape.png`・`landscape-swipe.png`・`retry.png` を Read で見て、次を確かめる。

| 画像                  | 確かめること                                                     |
| --------------------- | ---------------------------------------------------------------- |
| `run.png`             | ファンが後ろをついて走り、「+N」が出て、コンボの数が増えている   |
| `swipe-left.png`      | 走る子が 1 レーン左へ移っている                                  |
| `boss.png`            | ボスが前に浮かび、体力のバーが出ている                           |
| `end.png`             | ランクのカードか、共通の結果画面                                 |
| `landscape.png`       | 盤面が縦長のまま回っている                                       |
| `landscape-swipe.png` | 画面の下へのスワイプ（回した盤面の右）で、走る子が右へ移っている |
| `retry.png`           | 作り直したあとも町並みが描けている                               |

崩れていれば、原因のファイルを直して Task 7 の Step 7 から繰り返し、直したファイルを commit する。

- [ ] **Step 3: まとめて確かめる**

Run: `pnpm verify`
Expected: lint / check / test:run / vitals / build がすべて通る。

- [ ] **Step 4: ユーザーに見せる**

`SendUserFile` で `run.png`・`boss.png`・`end.png` を送り、遊べるようになったことを伝える。
