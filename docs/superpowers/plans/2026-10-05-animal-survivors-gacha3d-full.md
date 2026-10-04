# Animal Survivors 3D のガチャ 2 段め Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 10 連も 3D の機械で見せ、レア度が高いほど豪華な割れ方と音、レア以上・伝説の確定演出と伝説の昇格を入れる。

**Architecture:** `gacha-show.ts` の段取りを複数のカプセルに広げ、確定演出（`cue`）・昇格（`upgrade`）・音の出来事（`events`）も段取りが決める。`gacha3d.ts` は段取りの状態からカプセルの並び・光り方・稲妻・割れ方の豪華さ（`TIER`）を描くだけ、`gacha-sounds.ts` が出来事を音に換え、`Gacha3D.svelte` が 10 この結果の並びと白い閃光を DOM で出す。

**Tech Stack:** SvelteKit（Svelte 5 runes）、TypeScript、three、vitest、headless の Chrome

**Spec:** `docs/superpowers/specs/2026-10-05-animal-survivors-gacha3d-design.md`（7 章）

## Global Constraints

- 割れる瞬間はレア度で豪華にする（ふつう＝白い柱、レア＝青い柱と筋と少し暗く、伝説＝金の太い柱・二重の筋・金の粒・真っ暗に金の照り・一瞬白く光る）。
- レア以上は転がり出たときに青く光ってキラキラの音。伝説があれば回し終えたとたんに暗転と金の稲妻。伝説の 4 回に 1 回は昇格（青 → 押すと震えてひび → 金）で、昇格は稲妻に数えない。
- 10 連は 1 回回して 10 こが 2 段に並び、押すと左から順に割れ、レア以上・伝説は間を長く取る。押すと早送り、「とばす」で全部割れ、最後に 10 この品を並べる。
- 音は音の波の組み合わせだけ（録音しない）。
- 点滅を 1 フレームごとに切り替えない（大群の画面と同じく、稲妻や光もなめらかに強めて弱める）。
- 前の段の決まり（引いてから記録に保存、three は開くときに読み込む、指 1 本、横向きの指の位置、WebGL が無いときは 2D、閉じる前に GUARD 待つ）はそのまま。
- コンポーネントは 200 行未満。コメントは非自明な WHY だけ。`pnpm verify` が通ること。

## Review Focus

- 10 連の途中で「とばす」を押すと、割れていないカプセルも全部割れて並びに出る（割れたものを 2 度数えない）。Task 1 のテストで固める。
- 昇格するカプセルは、ひびが入るまで青く、10 連でも稲妻と強い揺れを出さない（昇格を見破れない）。Task 1 のテストで固める。
- 割れていく途中で押しても、1 回の押しで 2 こ以上進まない（早送りは今のカプセルだけ）。Task 1 のテストで固める。
- 音が鳴らない設定（ミュート・wake 前）でも段取りは止まらない。Task 2 のテストで固める。
- 10 この並びが iPhone の幅でも画面に収まる。Task 4 の撮影で確かめる。

---

### Task 1: 段取りを複数のカプセル・確定演出・昇格・出来事に広げる

**Files:**

- Modify: `src/lib/games/animal-survivors/gacha-show.ts`
- Modify: `src/lib/games/animal-survivors/gacha-show.test.ts`（今のテストを新しい形に直して足す）

**Interfaces:**

- Produces:
  - `type Phase = 'ready' | 'spin' | 'storm' | 'drop' | 'wait' | 'crack' | 'open' | 'show' | 'list' | 'done'`
  - `type GachaEvent = 'click' | 'roll' | 'glow' | 'storm' | 'crack' | 'pop0' | 'pop1' | 'pop2'`
  - `interface Show { phase: Phase; t: number; angle: number; gears: GearKey[]; rarity: Rarity[]; upgrade: number; opened: number; guard: number; events: GachaEvent[] }`（`upgrade` は昇格するカプセルの番号、無ければ -1。`opened` は割れ終えた数＝今割っているカプセルの番号。`events` は画面が毎フレーム読んで空にする）
  - `TURN`・`SPIN`・`DROP`・`GUARD`（今のまま）、`STORM = 1.1`、`ROLL_GAP = 0.12`、`CRACK = 0.9`、`OPEN_TIME = [0.5, 0.9, 1.6]`、`UPGRADE = 0.25`
  - `makeShow(gears: GearKey[], rand?: () => number): Show`、`cue(s: Show): Rarity`（確定演出に使うレア度。昇格するカプセルはレアとして数える）、`glowOf(s: Show, i: number): Rarity`（そのカプセルが今光る色）、`dropTime(n: number): number`
  - `turn`・`tick`・`tap`・`skip`・`closing`・`angleDelta`・`handleDelta`（今の名前のまま、複数に広げる）

- [ ] **Step 1: テストを書く**（`gacha-show.test.ts` の `makeShow('owl:1')` は `makeShow(['owl:1'])` に直し、`'show'` を待つところは 1 こなら今のまま。次を足す）

```ts
const ten = (k: GearKey = 'owl:0'): GearKey[] => Array.from({ length: 10 }, () => k);

describe('確定演出と昇格', () => {
  it('伝説があれば 4 回に 1 回は最初の伝説が昇格になり、それ以外は昇格しない', () => {
    expect(makeShow(['owl:2'], () => 0.1).upgrade).toBe(0);
    expect(makeShow(['owl:2'], () => 0.5).upgrade).toBe(-1);
    expect(makeShow(['owl:1'], () => 0.1).upgrade).toBe(-1);
    const g = ten();
    g[3] = 'cat:2';
    g[7] = 'oni:2';
    expect(makeShow(g, () => 0.1).upgrade).toBe(3);
  });

  it('昇格するカプセルはレアとして数え、ひびが入るまで青く光る', () => {
    const s = makeShow(['owl:2'], () => 0.1);
    expect(cue(s)).toBe(1);
    expect(glowOf(s, 0)).toBe(1);
    turn(s, TURN);
    run(s, SPIN + 0.05);
    expect(s.phase).toBe('drop');
    run(s, dropTime(1) + 0.05);
    tap(s);
    expect(s.phase).toBe('crack');
    expect(s.events).toContain('crack');
    run(s, CRACK + 0.05);
    expect(glowOf(s, 0)).toBe(2);
    expect(s.phase).toBe('open');
  });

  it('昇格でない伝説があれば、回し終えたあとに稲妻が落ちる', () => {
    const s = makeShow(['owl:2'], () => 0.9);
    expect(cue(s)).toBe(2);
    turn(s, TURN);
    run(s, SPIN + 0.05);
    expect(s.phase).toBe('storm');
    expect(s.events).toContain('storm');
    run(s, STORM + 0.05);
    expect(s.phase).toBe('drop');
  });

  it('レア以上が転がり出たらキラキラの出来事、割れる瞬間はレア度ごとの出来事', () => {
    const s = makeShow(['owl:1']);
    turn(s, TURN);
    const seen: string[] = [];
    for (let t = 0; t < SPIN + dropTime(1) + 0.1; t += 1 / 60) {
      tick(s, 1 / 60);
      seen.push(...s.events.splice(0));
    }
    expect(seen).toContain('roll');
    expect(seen).toContain('glow');
    tap(s);
    expect(s.events).toContain('pop1');
  });

  it('回すとカチカチの出来事を出す', () => {
    const s = makeShow(['owl:0']);
    turn(s, 0.3);
    turn(s, 0.3);
    turn(s, 0.3);
    expect(s.events.filter((e) => e === 'click').length).toBe(1);
  });
});

describe('10 連', () => {
  it('転がり出るのに 1 こより長くかかり、押すと左から順に割れて、全部割れたら並べる', () => {
    const s = makeShow(ten());
    turn(s, TURN);
    run(s, SPIN + dropTime(1) + 0.05);
    expect(s.phase).toBe('drop');
    run(s, dropTime(10) - dropTime(1));
    expect(s.phase).toBe('wait');
    tap(s);
    expect(s.phase).toBe('open');
    run(s, OPEN_TIME[0] * 10 + 0.5);
    expect(s.opened).toBe(10);
    expect(s.phase).toBe('list');
  });

  it('伝説のカプセルは割れるのに長くかかる', () => {
    const g = ten();
    g[1] = 'cat:2';
    const s = makeShow(g, () => 0.9);
    skipTo(s, 'wait');
    tap(s);
    run(s, OPEN_TIME[0] + 0.02);
    expect(s.opened).toBe(1);
    run(s, OPEN_TIME[0] + 0.02);
    expect(s.opened).toBe(1);
    run(s, OPEN_TIME[2]);
    expect(s.opened).toBe(2);
  });

  it('割っている途中で押すと、今のカプセルだけを早送りする', () => {
    const s = makeShow(ten());
    skipTo(s, 'wait');
    tap(s);
    run(s, GUARD + 0.01);
    tap(s);
    run(s, 1 / 60);
    expect(s.opened).toBe(1);
  });

  it('とばすと割れていないものも全部割れて並べる', () => {
    const s = makeShow(ten());
    skipTo(s, 'wait');
    tap(s);
    run(s, OPEN_TIME[0] * 3);
    skip(s);
    expect(s.opened).toBe(10);
    expect(s.phase).toBe('list');
  });
});
```

`skipTo` はテストの中の助け（ハンドルを回して、段が `phase` になるまで `tick` を回す）。

```ts
function skipTo(s: Show, phase: Phase) {
  turn(s, TURN);
  for (let i = 0; i < 60 * 10 && s.phase !== phase; i++) tick(s, 1 / 60);
}
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm exec vitest run src/lib/games/animal-survivors/gacha-show.test.ts`
Expected: FAIL（`makeShow` が配列を受けない・`cue` が無い）

- [ ] **Step 3: 実装する**

```ts
import { parseKey, type GearKey, type Rarity } from './gear';

export type Phase = 'ready' | 'spin' | 'storm' | 'drop' | 'wait' | 'crack' | 'open' | 'show' | 'list' | 'done';
export type GachaEvent = 'click' | 'roll' | 'glow' | 'storm' | 'crack' | 'pop0' | 'pop1' | 'pop2';

export interface Show {
  phase: Phase;
  t: number;
  angle: number;
  gears: GearKey[];
  rarity: Rarity[];
  upgrade: number;
  opened: number;
  guard: number;
  events: GachaEvent[];
}

export const TURN = Math.PI * 1.5;
export const SPIN = 0.8;
export const DROP = 0.9;
export const STORM = 1.1;
export const ROLL_GAP = 0.12;
export const CRACK = 0.9;
/** 割れるのにかける秒。レア度が高いほど間を取って豪華に見せる */
export const OPEN_TIME = [0.5, 0.9, 1.6];
export const UPGRADE = 0.25;
export const GUARD = 0.35;
/** ハンドルがこの角度回るごとにカチッと鳴らす */
const CLICK = 0.5;

export function makeShow(gears: GearKey[], rand: () => number = Math.random): Show {
  const rarity = gears.map((k) => parseKey(k)?.rarity ?? 0);
  const first = rarity.indexOf(2);
  return {
    phase: 'ready',
    t: 0,
    angle: 0,
    gears,
    rarity,
    upgrade: first >= 0 && rand() < UPGRADE ? first : -1,
    opened: 0,
    guard: 0,
    events: []
  };
}

/** 昇格するカプセルはレアに見せる（稲妻や揺れで見破られないように） */
export const cue = (s: Show): Rarity => Math.max(0, ...s.rarity.map((r, i) => (i === s.upgrade ? 1 : r))) as Rarity;

/** 昇格するカプセルは、ひびが入り終えるまで青く光る */
export function glowOf(s: Show, i: number): Rarity {
  if (i !== s.upgrade) return s.rarity[i];
  return s.opened > i || (s.opened === i && s.phase === 'open') ? 2 : 1;
}

export const dropTime = (n: number) => DROP + ROLL_GAP * (n - 1);

const go = (s: Show, phase: Phase) => {
  s.phase = phase;
  s.t = 0;
};

/** 今のカプセルを割り始める。昇格するカプセルは先にひびを入れる */
function openNext(s: Show) {
  if (s.opened === s.upgrade) {
    go(s, 'crack');
    s.events.push('crack');
    return;
  }
  go(s, 'open');
  s.events.push(`pop${s.rarity[s.opened]}` as GachaEvent);
}

function finish(s: Show) {
  go(s, s.gears.length === 1 ? 'show' : 'list');
  s.guard = GUARD;
}

export function turn(s: Show, d: number): void {
  if (s.phase !== 'ready') return;
  const before = Math.floor(s.angle / CLICK);
  s.angle = Math.max(0, s.angle + d);
  if (Math.floor(s.angle / CLICK) > before) s.events.push('click');
  if (s.angle >= TURN) go(s, 'spin');
}

export function tick(s: Show, dt: number): void {
  s.t += dt;
  s.guard = Math.max(0, s.guard - dt);
  if (s.phase === 'spin') s.angle = TURN + (Math.PI * 2 - TURN) * Math.min(1, s.t / SPIN);
  if (s.phase === 'spin' && s.t >= SPIN) {
    if (cue(s) === 2) {
      go(s, 'storm');
      s.events.push('storm');
    } else {
      go(s, 'drop');
      s.events.push('roll');
    }
  } else if (s.phase === 'storm' && s.t >= STORM) {
    go(s, 'drop');
    s.events.push('roll');
  } else if (s.phase === 'drop' && s.t >= dropTime(s.gears.length)) {
    go(s, 'wait');
    if (cue(s) >= 1) s.events.push('glow');
  } else if (s.phase === 'crack' && s.t >= CRACK) {
    go(s, 'open');
    s.events.push('pop2');
  } else if (s.phase === 'open' && s.t >= OPEN_TIME[s.rarity[s.opened]]) {
    s.opened += 1;
    if (s.opened >= s.gears.length) finish(s);
    else openNext(s);
  }
}

export function tap(s: Show): void {
  if (s.guard > 0) return;
  if (s.phase === 'spin' || s.phase === 'storm' || s.phase === 'drop') {
    go(s, 'wait');
    if (cue(s) >= 1) s.events.push('glow');
  } else if (s.phase === 'wait') openNext(s);
  else if (s.phase === 'crack') s.t = CRACK;
  else if (s.phase === 'open') s.t = OPEN_TIME[s.rarity[s.opened]];
  else if (s.phase === 'show' || s.phase === 'list') go(s, 'done');
  else return;
  s.guard = GUARD;
}

export function skip(s: Show): void {
  s.opened = s.gears.length;
  finish(s);
}
```

（`closing`・`angleDelta`・`handleDelta` は今のまま残す。`tap` で早送りしたときに `s.t` を今の段の長さにするので、次の `tick` で 1 こだけ進む）

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm exec vitest run src/lib/games/animal-survivors/gacha-show.test.ts`
Expected: PASS

- [ ] **Step 5: Commit** `git commit -m "Extend the Animal Survivors gacha show to ten capsules, cues and upgrades"`（署名の行を付ける）

### Task 2: ガチャの音

**Files:**

- Create: `src/lib/games/animal-survivors/gacha-sounds.ts`
- Test: `src/lib/games/animal-survivors/gacha-sounds.test.ts`

**Interfaces:**

- Consumes: Task 1 の `GachaEvent`
- Produces: `playGacha(e: GachaEvent): void`

- [ ] **Step 1: テストを書く**

```ts
import { describe, expect, it, vi } from 'vitest';

const calls: string[] = [];
vi.mock('$lib/audio.svelte', () => ({
  tone: () => calls.push('tone'),
  sweep: () => calls.push('sweep'),
  noise: () => calls.push('noise')
}));
const { playGacha } = await import('./gacha-sounds');

describe('ガチャの音', () => {
  it('どの出来事も音を出し、伝説の割れる音はレアより音の数が多い', () => {
    const count = (e: Parameters<typeof playGacha>[0]) => {
      calls.length = 0;
      playGacha(e);
      return calls.length;
    };
    for (const e of ['click', 'roll', 'glow', 'storm', 'crack', 'pop0', 'pop1', 'pop2'] as const)
      expect(count(e)).toBeGreaterThan(0);
    expect(count('pop2')).toBeGreaterThan(count('pop1'));
    expect(count('pop1')).toBeGreaterThan(count('pop0'));
  });
});
```

（ミュート中と wake 前は `tone` などが自分で何もしないので、`playGacha` は気にせず呼んでよい。段取りは音と関係なく進む）

- [ ] **Step 2: 落ちることを確かめる** Run: `pnpm exec vitest run src/lib/games/animal-survivors/gacha-sounds.test.ts` Expected: FAIL（ファイルが無い）

- [ ] **Step 3: 実装する**

```ts
import { noise, sweep, tone } from '$lib/audio.svelte';
import type { GachaEvent } from './gacha-show';

const SOUNDS: Record<GachaEvent, () => void> = {
  click: () => tone(1800, 18, 'square', 0.025),
  roll: () => {
    for (let i = 0; i < 6; i++) tone(320 - i * 20, 40, 'triangle', 0.04, i * 70);
  },
  glow: () => {
    for (const [i, f] of [1568, 2093, 2637].entries()) tone(f, 120, 'triangle', 0.035, i * 60);
  },
  storm: () => {
    noise(900, 0.14);
    tone(55, 900, 'sawtooth', 0.08);
    sweep(2000, 200, 500, 0.05);
  },
  crack: () => {
    noise(60, 0.12);
    tone(2400, 60, 'square', 0.04, 300);
    noise(80, 0.14);
  },
  pop0: () => {
    noise(40, 0.08);
    tone(660, 90, 'triangle', 0.07);
  },
  pop1: () => {
    noise(40, 0.08);
    for (const [i, f] of [784, 988, 1175].entries()) tone(f, 200, 'triangle', 0.07, 40 + i * 50);
  },
  pop2: () => {
    noise(80, 0.12);
    for (const [i, f] of [523, 659, 784, 1047, 1319].entries()) tone(f, 260, 'square', 0.05, 60 + i * 110);
    tone(1047, 700, 'triangle', 0.06, 640);
    tone(1319, 700, 'triangle', 0.05, 640);
  }
};

export const playGacha = (e: GachaEvent) => SOUNDS[e]();
```

- [ ] **Step 4: 通ることを確かめる** Run: 同じ。Expected: PASS

- [ ] **Step 5: Commit** `git commit -m "Add the Animal Survivors gacha sounds"`

### Task 3: 場面を 10 この並び・光り方・稲妻・豪華さの段に広げる

**Files:**

- Modify: `src/lib/games/animal-survivors/gacha3d.ts`
- Modify: `src/lib/games/animal-survivors/gacha3d.test.ts`

**Interfaces:**

- Consumes: Task 1 の `Show`・`glowOf`・`cue`・`dropTime`・`ROLL_GAP`・`OPEN_TIME`・`STORM`・`CRACK`
- Produces:
  - `slotOf(i: number, n: number): THREE.Vector3`（1 こなら取り出し口、10 こなら手前に 5 こずつ 2 段）
  - `capsuleAt(s: Show, i: number): { x: number; y: number; z: number; open: number }`
  - `TIER: { beam: number; width: number; rays: number; dim: number; sparks: number }[]`（ふつう・レア・伝説の割れ方の豪華さ）
  - `GachaScene` の口は今のまま（`render(s, now)` が複数を描く）

- [ ] **Step 1: テストを書く**（今の `capsuleAt(s)` のテストは `capsuleAt(s, 0)` に直し、次を足す）

```ts
it('10 この置き場所は重ならず、2 段に並ぶ', () => {
  const slots = Array.from({ length: 10 }, (_, i) => slotOf(i, 10));
  for (let i = 0; i < 10; i++)
    for (let j = i + 1; j < 10; j++) expect(slots[i].distanceTo(slots[j])).toBeGreaterThan(0.25);
  expect(new Set(slots.map((v) => v.y.toFixed(2))).size).toBe(2);
});

it('割れ方はレア度が高いほど豪華になる', () => {
  for (const k of ['beam', 'width', 'rays', 'dim', 'sparks'] as const) {
    expect(TIER[1][k]).toBeGreaterThanOrEqual(TIER[0][k]);
    expect(TIER[2][k]).toBeGreaterThan(TIER[1][k]);
  }
});

it('10 連のカプセルは順に遅れて転がり出る', () => {
  const s = makeShow(Array.from({ length: 10 }, () => 'owl:0' as const));
  turn(s, TURN);
  for (let t = 0; t < SPIN + DROP * 0.5; t += 1 / 60) tick(s, 1 / 60);
  // 先のカプセルほど先へ進んでいる
  expect(capsuleAt(s, 0).z).toBeGreaterThan(capsuleAt(s, 9).z);
});
```

- [ ] **Step 2: 落ちることを確かめる** Run: `pnpm exec vitest run src/lib/games/animal-survivors/gacha3d.test.ts` Expected: FAIL（`slotOf`・`TIER` が無い）

- [ ] **Step 3: 実装する**

- `slotOf(i, n)`：`n === 1` なら `OUTLET`。それ以外は `col = i % 5`、`row = Math.floor(i / 5)` で `new THREE.Vector3(-0.72 + col * 0.36, 0.16 + row * 0.3, 0.95 - row * 0.12)`（後ろの段を少し上げて重ならないように見せる）。
- `capsuleAt(s, i)`：
  - `drop` では、`i` ごとに `ROLL_GAP * i` 秒遅れて、台の中（`OUTLET.x, 0.5, 0.1`）から `slotOf(i, n)` まで `DROP` 秒で弾みながら進む。
  - `wait` と、まだ割れていないカプセルは `slotOf` に止まる。
  - 割れ終えた（`i < s.opened`）は `open: 1`。
  - 今割っている（`i === s.opened` で `open`）は `open = t / OPEN_TIME[rarity]`。
  - 1 こ（`n === 1`）のときだけ、今と同じく割れながら `LIFT` へ持ち上がる。10 こは置き場所で割れ、品はその上に小さく浮かぶ。
- `TIER = [{ beam: 0.22, width: 0.08, rays: 0, dim: 0, sparks: 0 }, { beam: 0.32, width: 0.12, rays: 1, dim: 0.45, sparks: 0 }, { beam: 0.55, width: 0.2, rays: 2, dim: 0.85, sparks: 60 }]`。光の柱の濃さと太さ、光の筋の数（伝説は逆向きに回る 2 枚目）、暗い幕の濃さ、金の粒の数に使う。
- カプセルは 10 こ分を `machine()` で作っておき、`n` より後ろは隠す。
- カプセルの上半分の `emissive` を `glowOf(s, i)` の色にする（ふつうは 0、レアは青、伝説は金）。強さは `0.6 + 0.3 * pulse(now)`（`draw-boss.ts` の `pulse`）で、なめらかに明滅させる。
- `crack` の段では、そのカプセルを `sin(t * 40) * 0.02` で震わせる。光る色は `glowOf` が `crack` が終わるまで青のまま返す。
- `storm` の段の明かり。
  - 光源の強さを `1 - 0.85 * min(1, t / 0.3)` で落とす。
  - 機械の台の `emissive` を金（`#ffd84a`）にし、強さを `min(1, t / 0.4) * 0.6` で上げる。
- 稲妻。
  - 上から機械へ折れ線の板（`BufferGeometry` の太い折れ線を 2 本、加算の金）を置く。
  - 稲妻の濃さは `max(0, 1 - |t - 0.25| / 0.2) + max(0, 1 - |t - 0.6| / 0.2)` で、2 回なめらかに強めて弱める（1 フレームごとに切り替えない）。
  - `storm` が終わったら明かりを戻す。
- 割れたカプセルの光の柱・筋・幕・粒は `TIER[rarity]` の値で出す。
  - 粒は `THREE.Points` で `sparks` 個。上から降らせ、`show`・`list` のあいだも降らせる。
  - 10 連では、割っているカプセルの真上に柱を立てる。
  - 品の板は `i < opened` のカプセルごとに、`slotOf` の少し上に小さく出す。
- 10 連の `list` の段では場面を暗くする。品の並びは DOM が出す（Task 4）。

- [ ] **Step 4: 通ることを確かめる** Run: `pnpm exec vitest run src/lib/games/animal-survivors/gacha3d.test.ts` Expected: PASS

- [ ] **Step 5: Commit** `git commit -m "Draw ten capsules, glows, the storm and richer reveals in the Animal Survivors gacha"`

### Task 4: 重ねで 10 連・並び・閃光・音をつなぐ

**Files:**

- Modify: `src/lib/games/animal-survivors/Gacha3D.svelte`（props を `gears: GearKey[]` に。`list` の段で 10 この品の並び、伝説の `pop2` で白い閃光、出来事を `playGacha` に）
- Modify: `src/lib/games/animal-survivors/Gear.svelte`（10 連でも 3D を開く）
- Modify: `src/lib/games/animal-survivors/Gacha.svelte`（引いた品を 2D の `Capsule` で並べるのをやめる。結果は 3D の重ねか、その 2D の代わりが見せる）
- Modify: `src/lib/games/animal-survivors/gacha3d.svelte.test.ts`、`src/lib/games/animal-survivors/gear.svelte.test.ts`
- Create（行数が足りなければ）: `src/lib/games/animal-survivors/GachaList.svelte`（10 この品の並び。2D の代わりとも共用）

**Interfaces:**

- Consumes: Task 1〜3
- Produces: `Gacha3D.svelte` の props `{ gears: GearKey[]; onclose: () => void; scene?: ... }`

- [ ] **Step 1: テストを書く**（`gacha3d.svelte.test.ts` の `gear: 'owl:2'` を `gears: ['owl:2']` に直し、次を足す）

```ts
it('10 連をとばすと 10 この品を並べる', async () => {
  const fake = { resize() {}, render() {}, handle: () => ({ x: 0, y: 0 }), dispose() {} };
  const target = document.body.appendChild(document.createElement('div'));
  const gears = ['owl:0', 'cat:1', 'oni:2', 'owl:0', 'owl:0', 'owl:0', 'owl:0', 'owl:0', 'owl:0', 'owl:0'] as const;
  const app = mount(Gacha3D, { target, props: { gears: [...gears], onclose: () => {}, scene: async () => fake } });
  await tick();
  (target.querySelector('[data-skip]') as HTMLButtonElement).click();
  flushSync();
  expect(target.querySelectorAll('[data-got]').length).toBe(10);
  expect(target.textContent).toContain('鬼のツノ');
  unmount(app);
});

it('WebGL が作れない 10 連は 2D で 10 こ並べる', async () => {
  const target = document.body.appendChild(document.createElement('div'));
  const gears = Array.from({ length: 10 }, () => 'owl:0' as const);
  const app = mount(Gacha3D, {
    target,
    props: { gears, onclose: () => {}, scene: () => Promise.reject(new Error('x')) }
  });
  await tick();
  flushSync();
  expect(target.querySelectorAll('[data-got]').length).toBe(10);
  unmount(app);
});
```

`gear.svelte.test.ts` のコインで引くテストは、引いたあとに 3D の重ね（happy-dom では 2D の代わり）が開くので、記録の数だけを確かめる今の形のままでよい。

- [ ] **Step 2: 落ちることを確かめる** Run: `pnpm exec vitest run src/lib/games/animal-survivors/gacha3d.svelte.test.ts` Expected: FAIL

- [ ] **Step 3: 実装する**

- `Gacha3D.svelte` のループで `for (const e of show.events.splice(0)) playGacha(e)`。`pop2` のときは `flash = true` にし、0.4 秒の CSS のアニメで白い幕を薄くしてから消す（動きを減らす設定では出さない）。
- 2D の代わりも 10 連の並びも `GachaList.svelte`（`{ gears: GearKey[] }`。`GearIcon` と名前とレア度の札を 5 列で並べ、各札に `data-got`）で出す。2D の代わりは並びと「とじる」、3D の `list` の段は並びと「おして とじる」。
- 下の文は `wait` のときだけ数で変える（1 こ「カプセルを おしてね」、10 こ「おすと じゅんばんに ひらくよ」）。
- `Gear.svelte` の `onpull` で、引けたら（10 連も）`three = got` にする。`Gacha.svelte` からは引いた品の 2D の並び（`got`・`round`・`Capsule`）を消す。

- [ ] **Step 4: 通ることを確かめる** Run: `pnpm exec vitest run src/lib/games/animal-survivors` Expected: PASS。`wc -l` で 200 行未満。

- [ ] **Step 5: Commit** `git commit -m "Show ten-pulls, the item list, the flash and sounds in the Animal Survivors 3D gacha"`

### Task 5: 撮って確かめ、仕上げる

- [ ] **Step 1:** headless の Chrome で撮る（ハンドルの中心は `0.357, 0.667`、手で回すのと同じ円の動き）。
  - 1 回のふつう・レア・伝説・昇格。乱数は、伝説の券（金）を何度か引いて出す。昇格は `makeShow` の乱数の口を使えないので、伝説が出るまで引いて 4 回に 1 回を待つ。
  - 10 連の転がり出た並び・割れていく途中・並び。
  - 稲妻の途中。
  - 撮る大きさは iPad と iPhone。iPhone の幅で 10 この並びが収まるかも見る。
- [ ] **Step 2:** CLAUDE.md の 3D のガチャの文を、10 連・確定演出・昇格・豪華さの段・音に合わせて直す。`pnpm verify`、Commit。
- [ ] **Step 3:** 別の係にブランチを見てもらい、Critical と Important を直してから、撮った画面を見せて main へ push してよいかを聞く。
