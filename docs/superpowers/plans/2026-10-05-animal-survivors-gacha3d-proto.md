# Animal Survivors 3D のガチャ 試作 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1 回ずつ引くガチャを、ハンドルを指で回すガチャガチャの機械の 3D の演出（カプセル 1 こが転がり出て、押すと割れてレア度の色の光と品のアイコンが出る）にし、実機で触ってもらえる試作にする。

**Architecture:** 演出の段取りは DOM も three も使わない `gacha-show.ts` の小さな状態機械に閉じて vitest で確かめる。three の場面は `gacha3d.ts` の `GachaScene` が段取りの状態を受けて描くだけにし、`Gacha3D.svelte` が全画面の重ね・指の入力・ループ・three の読み込みと、WebGL が無いときの 2D への切り替えを持つ。

**Tech Stack:** SvelteKit（Svelte 5 runes）、TypeScript、three（今の依存）、vitest、headless の Chrome（playwright-core）

**Spec:** `docs/superpowers/specs/2026-10-05-animal-survivors-gacha3d-design.md`（この計画は 5 章の「1. 試作」だけ。前ぶれ・10 連・早送りの細部・音は実機の感想のあとに別の計画にする）

## Global Constraints

- 引いた品は演出を開く前に記録へ保存する（今の `Gear.svelte` の `onpull` のまま）。
- 描く大きさは画面の 3 分の 1、拡大はぼかさない（`image-rendering: pixelated`）。品のアイコンは `art/gear.ts` のドット絵。
- three は演出を開くときに動的 import する。装備の画面と一覧には載せない。
- WebGL が使えないときと動きを減らす設定では、今の 2D のカプセル（`Capsule.svelte`）で結果を見せる。
- ハンドルは 4 分の 3 回ったら止まらずに 1 回転する。画面を押すと今の動きを早送り、「とばす」で結果へ。
- 演出を閉じたら three の場面を捨てる。
- 入力は `pointerdown` と `pointerId`。コンポーネントは 200 行未満。コメントは非自明な WHY だけ。`pnpm verify` が通ること。

## Review Focus

- 逆向きに回したり行ったり来たりしても始まらず、時計回りに合わせて 4 分の 3 回したときだけ始まる。Task 1 のテストで固める。
- 回し始めた指とは別の指が触れても、回す角度が飛ばない（`pointerId` で 1 本だけ追う）。Task 3 で `Gacha3D.svelte` の入力を 1 本の指に限る。
- 割れた直後の合成 click で閉じない（押した指が離れてから次の押しを受ける）。Task 1 のテストで、押してから一定の時間がたつまで `tap` を受けないことを固める。
- 演出の途中で装備の画面に戻っても three のループと場面が残らない。Task 3 の `onDestroy` で止め、テストで `dispose` が呼ばれることを固める。
- WebGL が作れない端末で真っ白にならず、2D で結果が出る。Task 3 のテストで固める。

---

### Task 1: 段取りの状態機械

**Files:**

- Create: `src/lib/games/animal-survivors/gacha-show.ts`
- Test: `src/lib/games/animal-survivors/gacha-show.test.ts`

**Interfaces:**

- Produces:
  - `type Phase = 'ready' | 'spin' | 'drop' | 'wait' | 'open' | 'show' | 'done'`
  - `interface Show { phase: Phase; t: number; angle: number; gear: GearKey; guard: number }`（`t` は今の段の経過秒、`angle` はハンドルの角度（ラジアン、時計回りが正）、`guard` は次の押しを受けるまでの残り秒）
  - `TURN = Math.PI * 1.5`、`SPIN = 0.8`、`DROP = 0.9`、`OPEN = 0.6`、`GUARD = 0.35`
  - `makeShow(gear: GearKey): Show`、`turn(s: Show, d: number): void`、`tick(s: Show, dt: number): void`、`tap(s: Show): void`、`skip(s: Show): void`
  - `angleDelta(cx: number, cy: number, x0: number, y0: number, x1: number, y1: number): number`（中心から見た 2 点の角度の差。-π〜π）

- [ ] **Step 1: テストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { angleDelta, DROP, GUARD, makeShow, OPEN, SPIN, tap, tick, TURN, turn, skip } from './gacha-show';

const run = (s: ReturnType<typeof makeShow>, secs: number) => {
  for (let t = 0; t < secs; t += 1 / 60) tick(s, 1 / 60);
};

describe('ガチャの段取り', () => {
  it('時計回りに 4 分の 3 回すと回り始め、逆に回しても戻るだけで始まらない', () => {
    const s = makeShow('owl:1');
    turn(s, -1);
    expect(s.angle).toBe(0);
    turn(s, TURN * 0.5);
    turn(s, -TURN * 0.25);
    expect(s.phase).toBe('ready');
    expect(s.angle).toBeCloseTo(TURN * 0.25);
    turn(s, TURN * 0.8);
    expect(s.phase).toBe('spin');
  });

  it('回り終えるとカプセルが転がり、止まったら押すのを待つ', () => {
    const s = makeShow('owl:1');
    turn(s, TURN);
    run(s, SPIN + 0.05);
    expect(s.phase).toBe('drop');
    run(s, DROP + 0.05);
    expect(s.phase).toBe('wait');
  });

  it('待っているときに押すと割れて、割れ終えると品を見せ、もう一度押すと終わる', () => {
    const s = makeShow('owl:1');
    turn(s, TURN);
    run(s, SPIN + DROP + 0.1);
    tap(s);
    expect(s.phase).toBe('open');
    run(s, OPEN + 0.05);
    expect(s.phase).toBe('show');
    run(s, GUARD + 0.05);
    tap(s);
    expect(s.phase).toBe('done');
  });

  it('回っているときと転がっているときに押すと、押すのを待つところまで早送りする', () => {
    const s = makeShow('owl:1');
    turn(s, TURN);
    tap(s);
    expect(s.phase).toBe('wait');
  });

  it('押した直後は次の押しを受けない（指を離した合成 click で進みすぎない）', () => {
    const s = makeShow('owl:1');
    turn(s, TURN);
    run(s, SPIN + DROP + 0.1);
    tap(s);
    run(s, OPEN + 0.01);
    expect(s.phase).toBe('show');
    tap(s);
    expect(s.phase).toBe('show');
  });

  it('とばすとすぐ品を見せる', () => {
    const s = makeShow('owl:1');
    skip(s);
    expect(s.phase).toBe('show');
  });

  it('中心から見た角度の差は、時計回りが正で -π〜π', () => {
    // 画面の座標は y が下向きなので、右から下へ回るのが時計回り
    expect(angleDelta(0, 0, 1, 0, 0, 1)).toBeCloseTo(Math.PI / 2);
    expect(angleDelta(0, 0, 0, 1, 1, 0)).toBeCloseTo(-Math.PI / 2);
    expect(Math.abs(angleDelta(0, 0, -1, 0.01, -1, -0.01))).toBeLessThan(0.1);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm exec vitest run src/lib/games/animal-survivors/gacha-show.test.ts`
Expected: FAIL（`./gacha-show` が無い）

- [ ] **Step 3: 実装する**

```ts
import type { GearKey } from './gear';

/** ready はハンドルを待つ、spin は 1 回転、drop はカプセルが転がる、wait は押すのを待つ、open は割れる、show は品を見せる */
export type Phase = 'ready' | 'spin' | 'drop' | 'wait' | 'open' | 'show' | 'done';

export interface Show {
  phase: Phase;
  t: number;
  angle: number;
  gear: GearKey;
  guard: number;
}

export const TURN = Math.PI * 1.5;
export const SPIN = 0.8;
export const DROP = 0.9;
export const OPEN = 0.6;
/** 押してから次の押しを受けるまでの秒。押した指を離した合成 click で 2 段進まないように */
export const GUARD = 0.35;

export const makeShow = (gear: GearKey): Show => ({ phase: 'ready', t: 0, angle: 0, gear, guard: 0 });

const go = (s: Show, phase: Phase) => {
  s.phase = phase;
  s.t = 0;
};

/** 逆に回すと戻るだけ（0 より下へは戻らない）。4 分の 3 回ったら残りは機械が回す */
export function turn(s: Show, d: number): void {
  if (s.phase !== 'ready') return;
  s.angle = Math.max(0, s.angle + d);
  if (s.angle >= TURN) go(s, 'spin');
}

export function tick(s: Show, dt: number): void {
  s.t += dt;
  s.guard = Math.max(0, s.guard - dt);
  if (s.phase === 'spin') s.angle = TURN + (Math.PI * 2 - TURN) * Math.min(1, s.t / SPIN);
  if (s.phase === 'spin' && s.t >= SPIN) go(s, 'drop');
  else if (s.phase === 'drop' && s.t >= DROP) go(s, 'wait');
  else if (s.phase === 'open' && s.t >= OPEN) {
    go(s, 'show');
    // 割れ終えた瞬間に、割るときに押した指の合成 click で閉じないように
    s.guard = GUARD;
  }
}

export function tap(s: Show): void {
  if (s.guard > 0) return;
  if (s.phase === 'spin' || s.phase === 'drop') go(s, 'wait');
  else if (s.phase === 'wait') go(s, 'open');
  else if (s.phase === 'open') go(s, 'show');
  else if (s.phase === 'show') go(s, 'done');
  else return;
  s.guard = GUARD;
}

export function skip(s: Show): void {
  go(s, 'show');
  s.guard = GUARD;
}

export function angleDelta(cx: number, cy: number, x0: number, y0: number, x1: number, y1: number): number {
  let d = Math.atan2(y1 - cy, x1 - cx) - Math.atan2(y0 - cy, x0 - cx);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
```

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm exec vitest run src/lib/games/animal-survivors/gacha-show.test.ts`
Expected: PASS（7 件）

- [ ] **Step 5: Commit** `git add src/lib/games/animal-survivors/gacha-show.ts src/lib/games/animal-survivors/gacha-show.test.ts && git commit -m "Add the Animal Survivors gacha show steps"`（署名の行を付ける）

### Task 2: three の場面（機械・カプセル・光・品）

**Files:**

- Create: `src/lib/games/animal-survivors/gacha3d.ts`
- Test: `src/lib/games/animal-survivors/gacha3d.test.ts`

**Interfaces:**

- Consumes: Task 1 の `Show`・`SPIN`・`DROP`・`OPEN`
- Produces:
  - `class GachaScene { constructor(canvas: HTMLCanvasElement); resize(w: number, h: number): void; render(s: Show, now: number): void; handle(): { x: number; y: number }; dispose(): void }`（`handle()` はハンドルの中心の、canvas の CSS ピクセルの座標）
  - `machine(): { group: THREE.Group; handle: THREE.Group; capsule: THREE.Group; top: THREE.Mesh; bottom: THREE.Mesh }`（場面の部品。テストで形を確かめる）
  - `capsuleAt(s: Show): { x: number; y: number; z: number; open: number }`（転がるカプセルの位置と割れ具合 0〜1。純粋な関数）
  - `RARITY_COLOR = ['#fff8ec', '#5ab0ff', '#ffd84a']`

- [ ] **Step 1: テストを書く**（three は node でも場面の木を作れるので、WebGL を使わない部品だけを確かめる）

```ts
import { describe, expect, it } from 'vitest';
import { capsuleAt, machine } from './gacha3d';
import { DROP, makeShow, SPIN, tick, TURN, turn } from './gacha-show';

describe('ガチャの機械', () => {
  it('台・ガラスの球・ハンドル・カプセルがある', () => {
    const m = machine();
    expect(m.group.getObjectByName('base')).toBeTruthy();
    expect(m.group.getObjectByName('dome')).toBeTruthy();
    expect(m.group.getObjectByName('handle')).toBe(m.handle);
    expect(m.capsule.children).toContain(m.top);
    expect(m.capsule.children).toContain(m.bottom);
  });

  it('カプセルは転がるあいだに取り出し口へ進み、待つときは止まり、割れると上下が離れる', () => {
    const s = makeShow('owl:2');
    const start = capsuleAt(s);
    turn(s, TURN);
    for (let t = 0; t < SPIN + DROP * 0.5; t += 1 / 60) tick(s, 1 / 60);
    const mid = capsuleAt(s);
    for (let t = 0; t < DROP; t += 1 / 60) tick(s, 1 / 60);
    const end = capsuleAt(s);
    expect(mid.y).toBeLessThan(start.y);
    expect(end.y).toBeLessThanOrEqual(mid.y);
    expect(end.open).toBe(0);
    s.phase = 'open';
    s.t = 0.6;
    expect(capsuleAt(s).open).toBeCloseTo(1);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm exec vitest run src/lib/games/animal-survivors/gacha3d.test.ts`
Expected: FAIL（`./gacha3d` が無い）

- [ ] **Step 3: 実装する**

`gacha3d.ts` の中身。

- 色の決まり。台は赤（`#d8463c`）、取り出し口は濃い赤（`#8e2430`）、ハンドルは白（`#fff8ec`）。中のカプセルは上半分が赤・青・黄・緑・桃の 5 色で、下半分は白。ガラスの球は `MeshPhysicalMaterial`（`transmission` は使わず、`transparent: true, opacity: 0.25`）。
- `machine()` は次の部品を作る。
  - 台（名前 `base`）：`BoxGeometry(1.2, 0.9, 0.9)`、`y = 0.45`。
  - 首（名前 `neck`）：円柱。
  - ガラスの球（名前 `dome`）：`SphereGeometry(0.62, 16, 12)`、`y = 1.45`。
  - 中のカプセル 14 こ：上下 2 色の半球を組み、球の中へ重ならないよう置く。
  - ハンドル（名前 `handle`）：円板と握り。台の前面、`z = 0.46`、`y = 0.55`。
  - 取り出し口：台の前の下の、くぼんだ箱。
  - 転がるカプセル（`capsule`）：上の半球 `top` と下の半球 `bottom`。
- `capsuleAt(s)` は段ごとにカプセルの置き場所を決める。
  - `ready`・`spin` では台の中（`y = 0.9`、`z = 0`、見えない位置）。
  - `drop` では `t / DROP` に合わせて、取り出し口（`x = 0.35`、`y = 0.15`、`z = 0.6`）まで弾むように進む（`1 - (1 - u) ** 3`）。
  - `wait` では取り出し口に止まる。
  - `open` では `open = min(1, t / OPEN)`。
  - `show` では `open = 1`。
- `GachaScene`
  - 作り方。`WebGLRenderer({ canvas, antialias: false })` で、`setPixelRatio(1)`。`resize` は `setSize(Math.ceil(w / 3), Math.ceil(h / 3), false)` にし、CSS の大きさは `Gacha3D.svelte` が 100% にする。
  - 場面。`HemisphereLight` と `DirectionalLight` を置く。カメラは `PerspectiveCamera(35)` で、`(0.4, 1.4, 4.2)` から `(0, 1.0, 0)` を見る。背景は `#2a2240`。
  - `render` での動かし方。
    - ハンドルは `rotation.z = -s.angle` で回す。
    - 中のカプセルは `spin` のあいだ `sin(now * 30 + i)` で小さく揺らす。
    - 転がるカプセルは `capsuleAt` に置き、`open` で上下を離す。
    - 光の柱は `CylinderGeometry` に `AdditiveBlending` で、`RARITY_COLOR[rarity]` の色にする。`open` と `show` だけで見せ、`show` ではゆっくり回す。
    - 品は板（`PlaneGeometry`）を `show` のときだけ浮かべる。絵は `CanvasTexture(bake(GEAR_ART[id]))` で、`magFilter = NearestFilter`。
  - `handle()` は `handle.getWorldPosition` を `project` して、canvas の CSS ピクセルに直す。
  - `dispose` は、場面の geometry・material・texture をたどって `dispose` し、`renderer.dispose()` を呼ぶ。

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm exec vitest run src/lib/games/animal-survivors/gacha3d.test.ts`
Expected: PASS

- [ ] **Step 5: Commit** `git commit -m "Build the Animal Survivors gacha machine in three"`（新しいファイルを `git add` してから）

### Task 3: 全画面の重ねと入力、装備の画面からつなぐ

**Files:**

- Create: `src/lib/games/animal-survivors/Gacha3D.svelte`
- Modify: `src/lib/games/animal-survivors/Gacha.svelte`（1 回ずつの引き方のあとに `Gacha3D` を開く。10 連は今の 2D のまま）
- Test: `src/lib/games/animal-survivors/gacha3d.svelte.test.ts`

**Interfaces:**

- Consumes: Task 1 の段取り、Task 2 の `GachaScene`
- Produces: `Gacha3D.svelte` の props `{ gear: GearKey; onclose: () => void; scene?: (canvas: HTMLCanvasElement) => Promise<SceneLike> }`。`SceneLike` は `GachaScene` の public な口と同じ形で、テストで差し替えるために使う。既定の値は `import('./gacha3d')` から作る。

- [ ] **Step 1: テストを書く**

```ts
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Gacha3D from './Gacha3D.svelte';

vi.mock('$lib/audio.svelte', () => ({ audio: { muted: false }, toggleMute: () => {} }));

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('3D のガチャの重ね', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('WebGL が作れないときは 2D で品を見せ、押すと閉じる', async () => {
    const closed: string[] = [];
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Gacha3D, {
      target,
      props: { gear: 'owl:2', onclose: () => closed.push('x'), scene: () => Promise.reject(new Error('no webgl')) }
    });
    await tick();
    flushSync();
    expect(target.textContent).toContain('知恵のふくろう');
    (target.querySelector('[data-close]') as HTMLButtonElement).click();
    expect(closed).toEqual(['x']);
    unmount(app);
  });

  it('閉じると場面を捨てる', async () => {
    const dispose = vi.fn();
    const fake = { resize() {}, render() {}, handle: () => ({ x: 0, y: 0 }), dispose };
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Gacha3D, { target, props: { gear: 'owl:2', onclose: () => {}, scene: async () => fake } });
    await tick();
    unmount(app);
    expect(dispose).toHaveBeenCalled();
  });

  it('とばすで品を見せる', async () => {
    const fake = { resize() {}, render() {}, handle: () => ({ x: 0, y: 0 }), dispose() {} };
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Gacha3D, { target, props: { gear: 'owl:2', onclose: () => {}, scene: async () => fake } });
    await tick();
    (target.querySelector('[data-skip]') as HTMLButtonElement).click();
    flushSync();
    expect(target.textContent).toContain('知恵のふくろう');
    unmount(app);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm exec vitest run src/lib/games/animal-survivors/gacha3d.svelte.test.ts`
Expected: FAIL（`Gacha3D.svelte` が無い）

- [ ] **Step 3: 実装する**

`Gacha3D.svelte` の作り。

- 置き方。全画面の重ね（`position: fixed; inset: 0; z-index: 30`）にし、中に canvas（CSS で 100% × 100%、`image-rendering: pixelated`、`touch-action: none`）を置く。
- 案内の文。右上に「とばす」（`data-skip`）を置き、下に段ごとの文を出す。
  - `ready` は「ハンドルを まわしてね」。
  - `wait` は「カプセルを おしてね」。
  - `show` は品の名前とレア度と「おして とじる」。
- 始まり方。`onMount` で `scene(canvas)` を待ってから `loop.ts` の `startLoop` で回す。動きを減らす設定（`matchMedia('(prefers-reduced-motion: reduce)')`）なら、場面を作らずにすぐ 2D にする。
- 失敗したとき。`scene` が失敗したら 2D に切り替える。2D は `Capsule.svelte` の品の札と、閉じるボタン（`data-close`）。
- 指の入力。
  - `pointerdown` で、その指の `pointerId` と位置を覚える（2 本めの指は無視）。
  - `pointermove` では、`angleDelta(handle().x, handle().y, 前の位置, 今の位置)` を `turn` に渡す。
  - `pointerup` では、動いた量が 12px より小さければ `tap` にする。
  - `setPointerCapture` は try/catch で包む。
- 終わり方。`phase` が `done` になったら `onclose()` を呼ぶ。`onDestroy` でループを止めて `dispose()` する。
- `Gacha.svelte` からのつなぎ。`go(way)` で、1 こ（`way !== 'ten'`）を引けたら `three = k[0]` にして `<Gacha3D gear={three} onclose={() => (three = null)} />` を出す。閉じたあとは、今の `got` の並びに引いた品を見せる。

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm exec vitest run src/lib/games/animal-survivors`
Expected: PASS（今の `gear.svelte.test.ts` のコインで引くテストは、happy-dom に WebGL が無いので 2D で出て通る）

- [ ] **Step 5: Commit** `git commit -m "Open the Animal Survivors 3D gacha after a single pull"`

### Task 4: 画面を撮って、実機で触ってもらう

- [ ] **Step 1:** headless の Chrome（WebGL は SwiftShader で動く）で、装備の画面から券で 1 回引き、ハンドルを回す途中・回り終えた直後・カプセルが止まったところ・割れる途中・品を見せたところを撮る。指の動きは `page.mouse` の円を描く動きで出す。iPad と iPhone の大きさで撮る。
- [ ] **Step 2:** `pnpm verify` を通し、CLAUDE.md の装備の段落に 3D の演出（`gacha-show.ts`・`gacha3d.ts`・`Gacha3D.svelte`、2D への切り替え）を足して Commit。
- [ ] **Step 3:** 撮った画面を `SendUserFile` で見せ、main へ push してよいかを聞く。push したら実機で回す手ざわり（回しやすさ・回す量・待ち時間・光の気持ちよさ）を聞き、感想で次の計画（前ぶれ・10 連・音・仕上げ）を書く。
