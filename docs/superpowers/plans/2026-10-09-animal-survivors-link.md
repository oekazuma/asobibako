# アニマルサバイバー 連携の技 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 協力プレイで、2 匹が近くで倒した敵で共通のゲージがたまり、満タンで 2 人が 1.5 秒以内に押すと 2 匹の半分の技が合わさった大技が出るようにする。

**Architecture:** ルールは DOM を使わない `link.ts`（ゲージ・押した時刻・止める秒）と `link-halves.ts`（10 匹の半分の形と当たり）に置き、`world.ts` は倒したところと `step` の頭から呼ぶ。技を出す前の 1 秒の止めは World の中で持つ（`step` が早く返す）ので、親の画面も子の画面も同じように止まる。協力プレイは snap に `link` を足して `COOP_VERSION` を 4 にし、子の押しは `{ t: 'link' }` で親へ送る。画面はボタン（`LinkButton.svelte`）・帯（`LinkCutIn.svelte`）・HUD のゲージ・技の絵（`draw-link.ts`）。

**Tech Stack:** TypeScript、Svelte 5、vitest、playwright-core（画面の撮影）

**Spec:** `docs/superpowers/specs/2026-10-09-animal-survivors-link-design.md`

## Global Constraints

- 1 人で遊ぶときは何も変えない（ゲージ・ボタン・帯を出さない）
- 「近く」は 2 匹のあいだが 80 ドット以内
- ヌシは多め、ボスはもっと多めにたまる
- 使うたびに次に要る量を増やし、続けて使えるまで 45 秒以上空ける。1 回で 2〜3 回使える目安で、2 匹のボットで決める
- 片方が倒れている・抜けたときはたまらない
- ボタンは右端の真ん中、PC ではスペースキー
- 先に押した人は「相棒を待っています」、相手は光って「相棒が押した！」
- 2 人の押しが 1.5 秒以内で技。間に合わなければ満タンのまま押し直せる。決めるのは親の端末
- 技の名前は「A × B」、同じ動物どうしは「ダブル A」
- 出す前に 1 秒ゲームを止めて 2 匹の顔の帯。画面は揺らさない。動きを減らす設定では帯だけ
- ふつうの敵とヌシは倒れる、ボスには最大 HP の 1 割
- 出したあと 2 匹とも 2 秒は攻撃が当たらない
- 技の絵は最初の武器の絵を金色で大きく。新しいドット絵は作らない
- snap の形が変わるので `COOP_VERSION` は 4
- コードコメントは非自明な WHY だけ。コンポーネントは 200 行未満（`CoopPlay.svelte` は今 187 行、`CoopOverlay.svelte` は 101 行）
- 大群の中で点滅させない（明滅はなめらかに強めて弱める）

## Review Focus

- 片方が押したあとに相棒が倒れた・抜けたら、ボタンは消え、起き上がったあとに古い押しで技が出ない（Task 2 のテスト）
- 親が一時停止しているあいだに届いた子の押しは数えない（再開後の押しと合わせて出ないように。Task 3 のテスト）
- 技で倒した敵ではゲージがたまらない（出した直後に満タンへ近づかない。Task 2 のテスト）
- 止めているあいだ（1 秒）にもう一度押しても 2 回出ない（Task 2 のテスト）
- 大ヘビの体の節を巻き込んでも、頭のボスの体力は 1 割しか減らない（Task 1 のテスト）

---

### Task 1: 10 匹の半分と技の当たり

**Files:**

- Create: `src/lib/games/animal-survivors/link-halves.ts`
- Create: `src/lib/games/animal-survivors/link.ts`（この Task では型・定数・`fireLink` だけ）
- Modify: `src/lib/games/animal-survivors/world.ts`（`World.link`、`createWorld`、`GameEvent` に `link`）
- Test: `src/lib/games/animal-survivors/link.test.ts`

**Interfaces:**

- Produces:
  - `link-halves.ts`
    - `type HalfShape = { kind: 'ring'; r: number } | { kind: 'beams'; angles: number[]; len: number; width: number } | { kind: 'cone'; spread: number; len: number }`
    - `interface Half { name: string; shape: HalfShape }`
    - `HALVES: Record<AnimalId, Half>`
    - `linkName(a: AnimalId, b: AnimalId): string`
    - `inHalf(shape: HalfShape, ox: number, oy: number, angle: number, x: number, y: number, r: number): boolean`
  - `link.ts`
    - `interface LinkShow { hero: number; animal: AnimalId; x: number; y: number; angle: number; t: number }`
    - `interface Link { charge: number; need: number; uses: number; cool: number; press: [number, number]; armed: boolean; fuse: number; firing: boolean; shows: LinkShow[] }`
    - 定数 `LINK_NEAR = 80`・`LINK_WINDOW = 1.5`・`LINK_COOL = 45`・`LINK_FUSE = 1`・`LINK_INVULN = 2`・`LINK_BOSS = 0.1`・`LINK_SHOW = 0.8`・`LINK_BASE = 300`・`LINK_GROW = 1.6`・`NEVER = -1e9`
    - `calmLink(): Link`
    - `fireLink(w: World): void`
  - `world.ts` の `World.link: Link` と `GameEvent` の `{ type: 'link'; a: AnimalId; b: AnimalId; name: string }`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/games/animal-survivors/link.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { ENEMIES } from './enemies';
import { HALVES, inHalf, linkName } from './link-halves';
import { fireLink, LINK_BOSS, LINK_INVULN } from './link';
import { addHero, createWorld, makeEnemy, type World } from './world';

const VIEW = { w: 260, h: 380 };

/** 2 匹を (0,0) と (20,0) に置いた、敵のいない World */
function pair(a: 'wolf' | 'dog' | 'cat' = 'wolf', b: 'wolf' | 'dog' | 'cat' = 'wolf'): World {
  const w = createWorld(a, 1, VIEW);
  addHero(w, b);
  w.stage = { ...w.stage, waves: [] };
  w.heroes[0].player.x = 0;
  w.heroes[0].player.y = 0;
  w.heroes[1].player.x = 20;
  w.heroes[1].player.y = 0;
  return w;
}

describe('半分の形', () => {
  it('10 匹ぶんの半分がある', () => {
    expect(Object.keys(HALVES).sort()).toEqual(
      ['bear', 'cat', 'chick', 'dog', 'drake', 'fox', 'panda', 'rabbit', 'tiger', 'wolf'].sort()
    );
  });

  it('輪は半径と敵の大きさまで、帯は向きと長さと幅の中、扇は開きの中だけ当たる', () => {
    expect(inHalf({ kind: 'ring', r: 100 }, 0, 0, 0, 105, 0, 8)).toBe(true);
    expect(inHalf({ kind: 'ring', r: 100 }, 0, 0, 0, 120, 0, 8)).toBe(false);
    const beam = { kind: 'beams' as const, angles: [0], len: 200, width: 20 };
    expect(inHalf(beam, 0, 0, 0, 150, 5, 4)).toBe(true);
    expect(inHalf(beam, 0, 0, 0, 150, 30, 4)).toBe(false);
    expect(inHalf(beam, 0, 0, Math.PI / 2, 0, 150, 4)).toBe(true);
    expect(inHalf(beam, 0, 0, 0, -50, 0, 4)).toBe(false);
    const cone = { kind: 'cone' as const, spread: Math.PI / 2, len: 200 };
    expect(inHalf(cone, 0, 0, 0, 100, 30, 4)).toBe(true);
    expect(inHalf(cone, 0, 0, 0, 0, 100, 4)).toBe(false);
  });

  it('名前は 2 つの半分を並べ、同じ動物どうしはダブル', () => {
    expect(linkName('wolf', 'cat')).toBe(`${HALVES.wolf.name} × ${HALVES.cat.name}`);
    expect(linkName('dog', 'dog')).toBe(`ダブル${HALVES.dog.name}`);
  });
});

describe('技の当たり', () => {
  it('当たったふつうの敵とヌシは倒れ、外の敵は残る', () => {
    const w = pair();
    w.enemies.push(
      makeEnemy(ENEMIES.croc, 100, 0, 9999),
      makeEnemy({ ...ENEMIES.boar, chief: true }, -60, 40, 99999),
      makeEnemy(ENEMIES.croc, 600, 0, 50)
    );
    fireLink(w);
    expect(w.enemies.map((e) => e.alive)).toEqual([false, false, true]);
  });

  it('ボスは 2 匹の半分が両方当たっても、最大 HP の 1 割だけ減る', () => {
    const w = pair();
    const max = 1000;
    w.enemies.push(makeEnemy({ ...ENEMIES.bear, hp: max }, 40, 0, max));
    fireLink(w);
    expect(w.enemies[0].hp).toBeCloseTo(max * (1 - LINK_BOSS));
  });

  it('大ヘビの体の節をいくつ巻き込んでも、頭の体力は 1 割だけ減る', () => {
    const w = pair();
    const max = 2000;
    w.enemies.push(makeEnemy({ ...ENEMIES.bigSnake, hp: max }, 30, 0, max));
    for (let k = 1; k <= 5; k++) {
      const seg = makeEnemy(ENEMIES.snakeSeg, 30 + k * 10, 0, 1);
      seg.turn = 0;
      w.enemies.push(seg);
    }
    fireLink(w);
    expect(w.enemies[0].hp).toBeCloseTo(max * (1 - LINK_BOSS));
  });

  it('出したあと、2 匹とも 2 秒は攻撃が当たらず、絵が 2 つ出る', () => {
    const w = pair('dog', 'cat');
    fireLink(w);
    for (const h of w.heroes) expect(h.player.invuln).toBeGreaterThanOrEqual(LINK_INVULN);
    expect(w.link.shows.map((s) => s.animal)).toEqual(['dog', 'cat']);
  });

  it('倒れている動物の半分は出ない', () => {
    const w = pair('dog', 'cat');
    w.heroes[1].down = true;
    fireLink(w);
    expect(w.link.shows.map((s) => s.animal)).toEqual(['dog']);
  });
});
```

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/link.test.ts`
Expected: FAIL（`./link-halves` と `./link` が無い）

- [ ] **Step 3: 実装する**

`src/lib/games/animal-survivors/link-halves.ts`

```ts
import type { AnimalId } from './animals';

/** 角度は技を向ける向き（いちばん近い敵の向き）からの差 */
export type HalfShape =
  | { kind: 'ring'; r: number }
  | { kind: 'beams'; angles: number[]; len: number; width: number }
  | { kind: 'cone'; spread: number; len: number };

export interface Half {
  name: string;
  shape: HalfShape;
}

const Q = Math.PI / 4;

/** 動物ごとの連携の技の半分。形は最初の武器に似せる */
export const HALVES: Record<AnimalId, Half> = {
  dog: {
    name: 'ホネの大嵐',
    shape: { kind: 'beams', angles: [0, 1, 2, 3, 4, 5, 6, 7].map((k) => k * Q), len: 180, width: 20 }
  },
  cat: { name: '百裂ネコパンチ', shape: { kind: 'ring', r: 90 } },
  wolf: { name: '大遠吠え', shape: { kind: 'ring', r: 150 } },
  fox: { name: '狐火の十字', shape: { kind: 'beams', angles: [0, 2 * Q, 4 * Q, 6 * Q], len: 200, width: 28 } },
  bear: { name: '大熊の爪', shape: { kind: 'beams', angles: [0], len: 240, width: 64 } },
  rabbit: { name: '疾風ダッシュ', shape: { kind: 'beams', angles: [0, 4 * Q], len: 260, width: 40 } },
  panda: { name: '竹林の檻', shape: { kind: 'ring', r: 120 } },
  tiger: { name: '雷虎の十字斬り', shape: { kind: 'beams', angles: [Q, 3 * Q, 5 * Q, 7 * Q], len: 220, width: 32 } },
  drake: { name: '竜の大息吹', shape: { kind: 'cone', spread: (2 * Math.PI) / 3, len: 220 } },
  chick: { name: '火の鳥の羽ばたき', shape: { kind: 'ring', r: 130 } }
};

export function linkName(a: AnimalId, b: AnimalId): string {
  return a === b ? `ダブル${HALVES[a].name}` : `${HALVES[a].name} × ${HALVES[b].name}`;
}

/** (x, y) にいる半径 r の敵に、(ox, oy) から angle へ向けた形が当たるか */
export function inHalf(
  shape: HalfShape,
  ox: number,
  oy: number,
  angle: number,
  x: number,
  y: number,
  r: number
): boolean {
  const dx = x - ox;
  const dy = y - oy;
  const d = Math.hypot(dx, dy);
  if (shape.kind === 'ring') return d <= shape.r + r;
  if (shape.kind === 'cone') {
    if (d <= r) return true;
    if (d > shape.len + r) return false;
    const off = Math.abs(((Math.atan2(dy, dx) - angle + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
    return off <= shape.spread / 2 + r / d;
  }
  return shape.angles.some((a) => {
    const c = Math.cos(angle + a);
    const s = Math.sin(angle + a);
    const along = dx * c + dy * s;
    const across = -dx * s + dy * c;
    return along >= -r && along <= shape.len + r && Math.abs(across) <= shape.width / 2 + r;
  });
}
```

`src/lib/games/animal-survivors/link.ts`

```ts
import type { AnimalId } from './animals';
import { eachHero } from './heroes';
import { HALVES, inHalf } from './link-halves';
import { damageEnemy, type World } from './world';

export interface LinkShow {
  hero: number;
  animal: AnimalId;
  x: number;
  y: number;
  angle: number;
  /** 出てからの秒（LINK_SHOW で消す） */
  t: number;
}

/** 協力プレイの連携の技。2 匹で共通に 1 つ持つ */
export interface Link {
  charge: number;
  need: number;
  uses: number;
  /** 次に使えるまでの秒 */
  cool: number;
  /** 2 人が押したゲームの時刻（押していなければ NEVER） */
  press: [number, number];
  /** 2 人がそろった。次の step で止めを始める（押しは step の外で起き、step は出来事を消してから進むので、出来事は step の中で積む） */
  armed: boolean;
  /** 技を出す前に止めている残りの秒 */
  fuse: number;
  /** 技の当たりを入れているあいだ（技で倒した敵ではたまらない） */
  firing: boolean;
  shows: LinkShow[];
}

export const LINK_NEAR = 80;
export const LINK_WINDOW = 1.5;
export const LINK_COOL = 45;
export const LINK_FUSE = 1;
export const LINK_INVULN = 2;
export const LINK_BOSS = 0.1;
export const LINK_SHOW = 0.8;
export const LINK_BASE = 300;
export const LINK_GROW = 1.6;
/** JSON で送れるよう -Infinity の代わりに使う */
export const NEVER = -1e9;

export function calmLink(): Link {
  return {
    charge: 0,
    need: LINK_BASE,
    uses: 0,
    cool: 0,
    press: [NEVER, NEVER],
    armed: false,
    fuse: 0,
    firing: false,
    shows: []
  };
}

/** 技を向ける向き。いちばん近い敵、いなければ進む向き */
function aim(w: World, x: number, y: number, ax: number, ay: number): number {
  let best = Infinity;
  let angle = Math.atan2(ay, ax);
  for (const e of w.enemies) {
    if (!e.alive || e.def.prop || e.def.part) continue;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d < best) {
      best = d;
      angle = Math.atan2(e.y - y, e.x - x);
    }
  }
  return angle;
}

/** 2 匹の半分を同時に当てる。ボスは 2 つの半分が両方当たっても 1 回だけ */
export function fireLink(w: World): void {
  const bosses = new Set<number>();
  w.link.firing = true;
  try {
    eachHero(w, (k) => {
      const h = w.heroes[k];
      const p = h.player;
      const angle = aim(w, p.x, p.y, p.aimX, p.aimY);
      const shape = HALVES[h.animal.id].shape;
      w.link.shows.push({ hero: k, animal: h.animal.id, x: p.x, y: p.y, angle, t: 0 });
      w.enemies.forEach((e, i) => {
        // 節に当てると頭へ回るので、頭だけを数える
        if (!e.alive || e.def.part || !inHalf(shape, p.x, p.y, angle, e.x, e.y, e.def.r)) return;
        if (e.def.boss) {
          if (bosses.has(i)) return;
          bosses.add(i);
          damageEnemy(w, i, e.def.hp * LINK_BOSS, 0, 0);
        } else damageEnemy(w, i, e.hp, 0, 0);
      });
      p.invuln = Math.max(p.invuln, LINK_INVULN);
    });
  } finally {
    w.link.firing = false;
  }
}
```

`world.ts` の変更。

1. 先頭の import に足す。

```ts
import { calmLink, type Link } from './link';
```

2. `GameEvent` の最後の行（`| { type: 'chief'; i: number; name: string }`）の下に足す。

```ts
  /** 連携の技を出す前の止めが始まった（2 匹の動物と技の名前） */
  | { type: 'link'; a: AnimalId; b: AnimalId; name: string }
```

3. `World` の `heroes: Hero[];` の上に足す。

```ts
/** 協力プレイの連携の技（1 匹のときは使わない） */
link: Link;
```

4. `createWorld` の `shrinesUsed: []` を `shrinesUsed: [],` にし、その下に `link: calmLink()` を足す。

- [ ] **Step 4: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/link.test.ts`
Expected: PASS（8 件）。`pnpm check` で型の崩れが無い（`world.test.ts` の World の形の比べで落ちたら、そのテストの期待に `link` を足す）。

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/animal-survivors/link.ts src/lib/games/animal-survivors/link-halves.ts src/lib/games/animal-survivors/link.test.ts src/lib/games/animal-survivors/world.ts
git commit -m "Add the link move halves and hits for Animal Survivors co-op

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: ゲージ・せーの・止め

**Files:**

- Modify: `src/lib/games/animal-survivors/link.ts`
- Modify: `src/lib/games/animal-survivors/world.ts`（`damageEnemy` と `step`）
- Test: `src/lib/games/animal-survivors/link.test.ts`

**Interfaces:**

- Consumes: Task 1 の `Link`・`calmLink`・`fireLink`・定数・`linkName`
- Produces（`link.ts`）
  - `together(w: World): boolean`
  - `chargeLink(w: World, e: Enemy): void`
  - `linkReady(w: World): boolean`
  - `pressLink(w: World, hero: 0 | 1): boolean`（数えたら true）
  - `type LinkState = 'none' | 'ready' | 'waiting' | 'partner'`
  - `linkState(w: World, me: number): LinkState`
  - `stepLink(w: World, dt: number): boolean`（止めているあいだ true。step はそのとき進まずに返す）

- [ ] **Step 1: 失敗するテストを書く**

`link.test.ts` の先頭の import を次に置き換える。

```ts
import { describe, expect, it } from 'vitest';
import { ENEMIES } from './enemies';
import { HALVES, inHalf, linkName } from './link-halves';
import {
  fireLink,
  LINK_BASE,
  LINK_BOSS,
  LINK_COOL,
  LINK_FUSE,
  LINK_GROW,
  LINK_INVULN,
  LINK_WINDOW,
  linkReady,
  linkState,
  pressLink
} from './link';
import { addHero, createWorld, damageEnemy, makeEnemy, step, type World } from './world';
```

ファイルの末尾に足す。

```ts
/** i 番の敵を 1 体倒す */
function kill(w: World, def = ENEMIES.caterpillar): void {
  w.enemies.push(makeEnemy(def, 500, 500, 1));
  damageEnemy(w, w.enemies.length - 1, 99);
}

/** ゲージを満たす */
function fill(w: World): void {
  w.link.charge = w.link.need;
}

describe('ゲージ', () => {
  it('2 匹が近いときに倒した敵だけでたまり、ヌシとボスは多めに入る', () => {
    const w = pair();
    kill(w);
    expect(w.link.charge).toBe(1);
    w.heroes[1].player.x = 200;
    kill(w);
    expect(w.link.charge).toBe(1);
    w.heroes[1].player.x = 20;
    kill(w, { ...ENEMIES.boar, chief: true });
    const chief = w.link.charge - 1;
    kill(w, { ...ENEMIES.bear, hp: 1 });
    const boss = w.link.charge - 1 - chief;
    expect(chief).toBeGreaterThan(1);
    expect(boss).toBeGreaterThan(chief);
  });

  it('1 匹のとき、片方が倒れているとき、抜けたときはたまらない', () => {
    const solo = createWorld('dog', 1, VIEW);
    kill(solo);
    expect(solo.link.charge).toBe(0);
    const w = pair();
    w.heroes[1].down = true;
    kill(w);
    w.heroes[1].down = false;
    w.heroes[1].gone = true;
    kill(w);
    expect(w.link.charge).toBe(0);
  });

  it('要る量を超えてはたまらない', () => {
    const w = pair();
    w.link.charge = w.link.need - 1;
    kill(w, { ...ENEMIES.bear, hp: 1 });
    expect(w.link.charge).toBe(w.link.need);
  });
});

describe('せーの', () => {
  it('満タンでないと押せず、1 匹のときもボタンは出ない', () => {
    const w = pair();
    expect(linkState(w, 0)).toBe('none');
    expect(pressLink(w, 0)).toBe(false);
    const solo = createWorld('dog', 1, VIEW);
    solo.link.charge = solo.link.need;
    expect(linkReady(solo)).toBe(false);
  });

  it('先に押した人は待っていて、相手には相棒が押したと出る', () => {
    const w = pair();
    fill(w);
    expect(linkState(w, 0)).toBe('ready');
    pressLink(w, 0);
    expect(linkState(w, 0)).toBe('waiting');
    expect(linkState(w, 1)).toBe('partner');
  });

  it('1.5 秒以内にそろうと 1 秒止めてから技が出て、要る量が増え、45 秒は使えない', () => {
    const w = pair();
    w.enemies.push(makeEnemy(ENEMIES.croc, 60, 0, 9999));
    fill(w);
    pressLink(w, 0);
    w.time += LINK_WINDOW - 0.1;
    expect(pressLink(w, 1)).toBe(true);
    const t0 = w.time;
    step(w, { x: 0, y: 0 }, 1 / 60);
    expect(w.events.some((e) => e.type === 'link')).toBe(true);
    for (let i = 0; i < 30; i++) step(w, { x: 0, y: 0 }, 1 / 60);
    expect(w.time).toBe(t0);
    expect(w.enemies[0].alive).toBe(true);
    for (let i = 0; i < 40; i++) step(w, { x: 0, y: 0 }, 1 / 60);
    expect(w.enemies[0].alive).toBe(false);
    expect(w.link.need).toBe(Math.round(LINK_BASE * LINK_GROW));
    fill(w);
    expect(linkReady(w)).toBe(false);
    w.link.cool = 0;
    expect(linkReady(w)).toBe(true);
    expect(LINK_COOL).toBeGreaterThanOrEqual(45);
    expect(LINK_FUSE).toBe(1);
  });

  it('間に合わなければ出ず、満タンのまま押し直せる', () => {
    const w = pair();
    fill(w);
    pressLink(w, 0);
    w.time += LINK_WINDOW + 0.1;
    pressLink(w, 1);
    expect(w.link.armed).toBe(false);
    expect(linkState(w, 0)).toBe('partner');
    expect(pressLink(w, 0)).toBe(true);
    expect(w.link.armed).toBe(true);
  });

  it('技で倒した敵ではたまらない', () => {
    const w = pair();
    for (let k = 0; k < 20; k++) w.enemies.push(makeEnemy(ENEMIES.caterpillar, 30 + k, 0, 50));
    fill(w);
    pressLink(w, 0);
    pressLink(w, 1);
    for (let i = 0; i < 80; i++) step(w, { x: 0, y: 0 }, 1 / 60);
    expect(w.enemies.every((e) => !e.alive)).toBe(true);
    expect(w.link.charge).toBe(0);
  });

  it('止めているあいだにもう一度押しても 2 回は出ない', () => {
    const w = pair();
    fill(w);
    pressLink(w, 0);
    pressLink(w, 1);
    step(w, { x: 0, y: 0 }, 1 / 60);
    expect(pressLink(w, 0)).toBe(false);
    expect(pressLink(w, 1)).toBe(false);
    for (let i = 0; i < 80; i++) step(w, { x: 0, y: 0 }, 1 / 60);
    expect(w.link.uses).toBe(1);
    expect(w.link.shows.length).toBeLessThanOrEqual(2);
  });

  it('片方が押したあとに相棒が倒れたらボタンは消え、起き上がったあとに古い押しでは出ない', () => {
    const w = pair();
    fill(w);
    pressLink(w, 0);
    w.heroes[1].down = true;
    expect(linkState(w, 0)).toBe('none');
    expect(linkState(w, 1)).toBe('none');
    w.time += LINK_WINDOW + 1;
    w.heroes[1].down = false;
    pressLink(w, 1);
    expect(w.link.armed).toBe(false);
  });
});
```

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/link.test.ts`
Expected: FAIL（`linkReady`・`linkState`・`pressLink` が無い）

- [ ] **Step 3: 実装する**

`link.ts` に足す（import に `linkName` と `type Enemy` を足す）。

```ts
import { HALVES, inHalf, linkName } from './link-halves';
import { damageEnemy, type Enemy, type World } from './world';
```

```ts
/** 1 体で入る量。危ない相手に寄って倒すほど早くたまる */
const worth = (e: Enemy) => (e.def.boss ? 80 : e.def.chief ? 40 : e.def.elite ? 4 : 1);

/** 2 匹がどちらも立っていて、近くにいる */
export function together(w: World): boolean {
  const [a, b] = w.heroes;
  if (!b || a.down || b.down || a.gone || b.gone) return false;
  return Math.hypot(a.player.x - b.player.x, a.player.y - b.player.y) <= LINK_NEAR;
}

/** 倒したところで呼ぶ */
export function chargeLink(w: World, e: Enemy): void {
  const l = w.link;
  if (l.firing || l.armed || l.fuse > 0 || !together(w)) return;
  l.charge = Math.min(l.need, l.charge + worth(e));
}

export function linkReady(w: World): boolean {
  const l = w.link;
  return (
    w.heroes.length > 1 &&
    w.heroes.every((h) => !h.down && !h.gone) &&
    !l.armed &&
    l.fuse <= 0 &&
    l.cool <= 0 &&
    l.charge >= l.need
  );
}

/** 押した。2 人の押しが LINK_WINDOW 以内にそろえば、次の step で止めを始める */
export function pressLink(w: World, hero: 0 | 1): boolean {
  if (!linkReady(w)) return false;
  const l = w.link;
  l.press[hero] = w.time;
  if (w.time - l.press[1 - hero] > LINK_WINDOW) return true;
  l.armed = true;
  l.press = [NEVER, NEVER];
  l.charge = 0;
  l.uses += 1;
  l.need = Math.round(l.need * LINK_GROW);
  l.cool = LINK_COOL;
  return true;
}

export type LinkState = 'none' | 'ready' | 'waiting' | 'partner';

/** me の端末のボタンの見た目 */
export function linkState(w: World, me: number): LinkState {
  if (!linkReady(w)) return 'none';
  const l = w.link;
  if (w.time - l.press[me] <= LINK_WINDOW) return 'waiting';
  if (w.time - l.press[1 - me] <= LINK_WINDOW) return 'partner';
  return 'ready';
}

/** step の頭で呼ぶ。止めているあいだは true を返し、step はそのまま返す */
export function stepLink(w: World, dt: number): boolean {
  const l = w.link;
  if (l.armed) {
    l.armed = false;
    l.fuse = LINK_FUSE;
    const [a, b] = w.heroes;
    w.events.push({ type: 'link', a: a.animal.id, b: b.animal.id, name: linkName(a.animal.id, b.animal.id) });
    return true;
  }
  if (l.fuse > 0) {
    l.fuse -= dt;
    if (l.fuse > 0) return true;
    l.fuse = 0;
    fireLink(w);
    return false;
  }
  l.cool = Math.max(0, l.cool - dt);
  for (const s of l.shows) s.t += dt;
  l.shows = l.shows.filter((s) => s.t < LINK_SHOW);
  return false;
}
```

`world.ts` の変更。

1. import を `import { calmLink, chargeLink, stepLink, type Link } from './link';` にする。
2. `damageEnemy` の `countKill(w, e);` の下に `chargeLink(w, e);` を足す。
3. `step` の `if (w.over || anyPending(w) || anyChest(w)) return;` の下に足す。

```ts
// 連携の技の前の止めは World の中で持つので、親の画面も子の画面も同じだけ止まる
if (stepLink(w, dt)) return;
```

- [ ] **Step 4: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/link.test.ts`
Expected: PASS（17 件）

Run: `pnpm test:run src/lib/games/animal-survivors`
Expected: 全部 PASS（1 匹の回は `link` を使わないので、ほかのテストは変わらない）

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/animal-survivors/link.ts src/lib/games/animal-survivors/link.test.ts src/lib/games/animal-survivors/world.ts
git commit -m "Charge the link gauge near the partner and fire it when both press in time

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: 協力プレイの通信

**Files:**

- Modify: `src/lib/games/animal-survivors/snap.ts`
- Modify: `src/lib/games/animal-survivors/coop.ts`
- Test: `src/lib/games/animal-survivors/snap.test.ts`、`src/lib/games/animal-survivors/coop.test.ts`

**Interfaces:**

- Consumes: Task 2 の `pressLink(w, hero)`・`Link`
- Produces
  - `Snap.link: Link`
  - `COOP_VERSION = 4`
  - `CoopHost.link(): void`（親が押した）
  - `CoopGuest.link(): void`（子が押した。親へ `{ t: 'link' }`）

- [ ] **Step 1: 失敗するテストを書く**

`snap.test.ts` の `describe('snap', ...)` の中に足す。

```ts
it('連携の技のゲージと押した時刻と絵を運ぶ', () => {
  const w = createWorld('dog', 1, VIEW);
  addHero(w, 'cat');
  w.link.charge = 120;
  w.link.press = [3.5, -1e9];
  w.link.fuse = 0.4;
  w.link.shows.push({ hero: 0, animal: 'dog', x: 1, y: 2, angle: 0.5, t: 0.1 });
  const s = JSON.parse(JSON.stringify(makeSnap(w, [])));
  const view = guestView();
  applySnap(view, s);
  expect(view.link).toEqual(w.link);
});
```

`coop.test.ts` の、版を見るテストを置き換える。

```ts
it('snap の形を変えたので、つなぎ方の版は 4（古い版の端末とはつながない）', () => {
  expect(COOP_VERSION).toBe(4);
});
```

`coop.test.ts` の同じ `describe` に足す（`started()` を使うほかのテストと同じ並び）。

```ts
it('子の押しが親の World で数えられ、親も押すと技が出る', async () => {
  const { g, w, h } = await started();
  w.heroes[1].player.x = w.heroes[0].player.x + 10;
  w.heroes[1].player.y = w.heroes[0].player.y;
  w.link.charge = w.link.need;
  g.link();
  await settle();
  expect(w.link.press[1]).toBe(w.time);
  h.link();
  expect(w.link.armed).toBe(true);
});

it('親が一時停止しているあいだに届いた子の押しは数えない', async () => {
  const { guest, w, h } = await started();
  w.link.charge = w.link.need;
  h.pause();
  // 子の端末の止まった印を待たずに届いた押し（親の側で数えないことを見る）
  guest.act({ t: 'link' });
  await settle();
  expect(w.link.press[1]).toBe(-1e9);
});
```

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/snap.test.ts src/lib/games/animal-survivors/coop.test.ts`
Expected: FAIL（`view.link` が届かない、版が 3、`g.link` が無い）

- [ ] **Step 3: 実装する**

`snap.ts`

1. import に `import type { Link } from './link';` を足す。
2. `COOP_VERSION` を `4` にする。
3. `Snap` の `shrines: number[];` の下に `link: Link;` を足す。
4. `makeSnap` の `shrines: w.shrinesUsed,` の下に足す。

```ts
    link: { ...w.link, press: [...w.link.press] as [number, number], shows: w.link.shows.map((s) => ({ ...s })) },
```

5. `applySnap` の `view.shrinesUsed = s.shrines;` の下に `view.link = s.link;` を足す。

`coop.ts`

1. import に `import { pressLink } from './link';` を足す。
2. `CoopHost` の constructor の `else if (m.t === 'pause') this.#pause('guest');` の上に足す。

```ts
      else if (m.t === 'link') {
        // 止めているあいだはゲームの時刻が進まないので、そのあいだの押しを数えると再開後の押しと合わさってしまう
        if (this.#w?.heroes[1] && !this.paused) pressLink(this.#w, 1);
      }
```

3. `CoopHost` の `pause()` の上に足す。

```ts
  /** 親が連携の技のボタンを押した */
  link(): void {
    if (this.#w && !this.paused) pressLink(this.#w, 0);
  }
```

4. `CoopGuest` の `pause()` の上に足す。

```ts
  /** 連携の技のボタンを押した。そろったかは親が決める */
  link(): void {
    if (!this.paused) this.#party.act({ t: 'link' });
  }
```

- [ ] **Step 4: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/snap.test.ts src/lib/games/animal-survivors/coop.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/animal-survivors/snap.ts src/lib/games/animal-survivors/coop.ts src/lib/games/animal-survivors/snap.test.ts src/lib/games/animal-survivors/coop.test.ts
git commit -m "Carry the link gauge in co-op snaps and send the guest's press to the host

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 画面（ボタン・帯・ゲージ・技の絵）

**Files:**

- Create: `src/lib/games/animal-survivors/LinkButton.svelte`
- Create: `src/lib/games/animal-survivors/LinkCutIn.svelte`
- Create: `src/lib/games/animal-survivors/draw-link.ts`
- Modify: `src/lib/games/animal-survivors/CoopOverlay.svelte`、`CoopPlay.svelte`、`PromptLayer.svelte`、`prompts.svelte.ts`、`hud.ts`、`draw.ts`
- Test: `src/lib/games/animal-survivors/link.svelte.test.ts`

**Interfaces:**

- Consumes: `linkState(w, me)`・`LinkState`・`LINK_FUSE`・`LINK_SHOW`・`HALVES`・`CoopHost.link()`・`CoopGuest.link()`
- Produces
  - `LinkButton.svelte` の props `{ mode: LinkState; onpress: () => void }`
  - `LinkCutIn.svelte` の props `{ a: AnimalId; b: AnimalId; name: string }`
  - `Prompts.link: { a: AnimalId; b: AnimalId; name: string; t: number } | null`
  - `CoopOverlay.svelte` の新しい props `link?: LinkState`（無ければ `'none'`）
  - `drawLink(ctx: CanvasRenderingContext2D, w: World): void`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/games/animal-survivors/link.svelte.test.ts`

```ts
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LinkButton from './LinkButton.svelte';
import { LINK_FUSE, LINK_SHOW } from './link';
import { Prompts } from './prompts.svelte';
import { addHero, createWorld } from './world';

vi.mock('$lib/audio.svelte', () => ({ audio: { muted: false }, toggleMute: () => {}, bus: () => null }));

describe('いっしょに！のボタン', () => {
  afterEach(() => (document.body.innerHTML = ''));

  function show(mode: 'none' | 'ready' | 'waiting' | 'partner') {
    let pressed = 0;
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(LinkButton, { target, props: { mode, onpress: () => (pressed += 1) } });
    flushSync();
    return { target, app, pressed: () => pressed };
  }

  it('満タンでなければ出ない', () => {
    const { target, app } = show('none');
    expect(target.querySelector('[data-link]')).toBeNull();
    unmount(app);
  });

  it('押せるときは「いっしょに！」で、押すと onpress', () => {
    const { target, app, pressed } = show('ready');
    const b = target.querySelector('[data-link]') as HTMLButtonElement;
    expect(b.textContent).toContain('いっしょに！');
    b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(pressed()).toBe(1);
    unmount(app);
  });

  it('自分が押したあとは「相棒を待っています」で、もう押せない', () => {
    const { target, app, pressed } = show('waiting');
    const b = target.querySelector('[data-link]') as HTMLButtonElement;
    expect(b.textContent).toContain('相棒を待っています');
    b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(pressed()).toBe(0);
    unmount(app);
  });

  it('相棒が押したら「相棒が押した！」で光り、押せる', () => {
    const { target, app, pressed } = show('partner');
    const b = target.querySelector('[data-link]') as HTMLButtonElement;
    expect(b.textContent).toContain('相棒が押した！');
    expect(b.classList.contains('partner')).toBe(true);
    b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(pressed()).toBe(1);
    unmount(app);
  });

  it('スペースキーでも押せる', () => {
    const { app, pressed } = show('ready');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(pressed()).toBe(1);
    unmount(app);
  });
});

describe('連携の帯', () => {
  it('出来事 link で帯を出し、止めと絵のぶんが過ぎたら消す。帯のあいだも選ぶ画面にはならない', () => {
    const w = createWorld('dog', 1, { w: 260, h: 380 });
    addHero(w, 'cat');
    const p = new Prompts(w);
    w.events.push({ type: 'link', a: 'dog', b: 'cat', name: 'X × Y' });
    p.take();
    expect(p.link?.name).toBe('X × Y');
    expect(p.busy).toBe(false);
    p.next(null, LINK_FUSE + LINK_SHOW + 0.01);
    expect(p.link).toBeNull();
  });
});
```

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/link.svelte.test.ts`
Expected: FAIL（`LinkButton.svelte` が無い、`p.link` が無い）

- [ ] **Step 3: 実装する**

`src/lib/games/animal-survivors/LinkButton.svelte`

```svelte
<script lang="ts">
  import type { LinkState } from './link';

  let { mode, onpress }: { mode: LinkState; onpress: () => void } = $props();

  const can = $derived(mode === 'ready' || mode === 'partner');
  const label = $derived(
    mode === 'waiting' ? '相棒を待っています' : mode === 'partner' ? '相棒が押した！' : 'いっしょに！'
  );

  // 2 人で「せーの」と合わせるので、指が触れた瞬間に数える（click は指を離すまで遅れる）
  function press(event: PointerEvent) {
    event.preventDefault();
    if (can) onpress();
  }

  function key(event: KeyboardEvent) {
    if (event.key !== ' ' || !can) return;
    event.preventDefault();
    onpress();
  }
</script>

<svelte:window onkeydown={key} />

{#if mode !== 'none'}
  <button class="link as-card" class:partner={mode === 'partner'} data-link disabled={!can} onpointerdown={press}>
    {label}
  </button>
{/if}

<style>
  .link {
    position: absolute;
    top: 50%;
    right: max(12px, env(safe-area-inset-right));
    z-index: 5;
    width: min(26cqw, 140px);
    min-height: min(14cqw, 76px);
    justify-content: center;
    padding: 6px;
    translate: 0 -50%;
    background: #ffd84a;
    color: #24151f;
    font-size: min(4.4cqw, 2.6cqh, 22px);
    font-weight: 900;
    line-height: 1.2;
    white-space: normal;
  }

  .link:disabled {
    opacity: 0.75;
    font-size: min(3.4cqw, 2cqh, 17px);
  }

  .partner {
    animation: glow 900ms ease-in-out infinite alternate;
  }

  @keyframes glow {
    from {
      box-shadow: 0 0 0 0 rgb(255 216 74 / 0.4);
    }
    to {
      box-shadow: 0 0 18px 8px rgb(255 216 74 / 0.9);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .partner {
      animation: none;
      box-shadow: 0 0 12px 6px rgb(255 216 74 / 0.8);
    }
  }
</style>
```

`src/lib/games/animal-survivors/LinkCutIn.svelte`

```svelte
<script lang="ts">
  import type { AnimalId } from './animals';
  import { ANIMAL_ART } from './art/animals';
  import PixelIcon from './PixelIcon.svelte';

  let { a, b, name }: { a: AnimalId; b: AnimalId; name: string } = $props();
</script>

<div class="plate" role="alert">
  <span class="faces">
    <PixelIcon art={ANIMAL_ART[a].forms[0].walk} size="min(14cqw, 8cqh, 72px)" />
    <b>×</b>
    <PixelIcon art={ANIMAL_ART[b].forms[0].walk} size="min(14cqw, 8cqh, 72px)" />
  </span>
  <strong>{name}</strong>
</div>

<style>
  .plate {
    position: absolute;
    top: 36%;
    left: 50%;
    z-index: 4;
    display: grid;
    place-items: center;
    gap: 6px;
    padding: min(1.4cqh, 10px) min(5cqw, 28px);
    border: 4px solid #24151f;
    background: rgb(36 21 31 / 0.88);
    box-shadow: 0 0 0 3px #ffd84a;
    color: #fff;
    font-weight: 900;
    max-width: calc(100% - 24px);
    translate: -50% 0;
    pointer-events: none;
    animation: enter 300ms steps(5);
  }

  .faces {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .faces b {
    color: #ffd84a;
    font-size: min(7cqw, 4.2cqh, 40px);
  }

  strong {
    text-align: center;
    font-size: min(5.4cqw, 3.2cqh, 32px);
    letter-spacing: 0.04em;
    text-shadow:
      3px 3px 0 #e09a1c,
      -2px -2px 0 #24151f;
  }

  @keyframes enter {
    from {
      scale: 1.5;
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .plate {
      animation: none;
    }
  }
</style>
```

`prompts.svelte.ts`

1. import に `import type { AnimalId } from './animals';` と `import { LINK_FUSE, LINK_SHOW } from './link';` を足す。
2. `chief = $state<...>` の下に足す。

```ts
/** 連携の技の帯。t は端末の時間で進める（止めているあいだもゲームの時計は進まない） */
link = $state<{ a: AnimalId; b: AnimalId; name: string; t: number } | null>(null);
```

3. `take()` の `else if (e.type === 'chief') ...` の下に足す。

```ts
      else if (e.type === 'link') this.link = { a: e.a, b: e.b, name: e.name, t: 0 };
```

4. `next()` の `const w = this.#w;` の下（`let left = dt;` の上）に足す。

```ts
if (this.link) {
  this.link.t += dt;
  if (this.link.t >= LINK_FUSE + LINK_SHOW) this.link = null;
}
```

`PromptLayer.svelte`

1. import に `import LinkCutIn from './LinkCutIn.svelte';` を足す。
2. `{#if prompts.intro && prompts.named}` の上に足す。

```svelte
{#if prompts.link}
  <LinkCutIn a={prompts.link.a} b={prompts.link.b} name={prompts.link.name} />
{/if}
```

`CoopOverlay.svelte`

1. import に `import type { LinkState } from './link';` と `import LinkButton from './LinkButton.svelte';` を足す。
2. props の分解に `link = 'none',` を、型に `/** 連携の技のボタンの見た目 */ link?: LinkState;` を足す。
3. 一時停止のボタンの `{#if}` の下に足す。

```svelte
{#if !result && !world.over && !paused && !busy}
  <LinkButton mode={link} onpress={() => side?.link()} />
{/if}
```

`CoopPlay.svelte`

1. import に `import { linkState, type LinkState } from './link';` を足す。
2. `let paused = $state<Pauser>(null);` の下に `let link = $state<LinkState>('none');` を足す。
3. `frame` の `paused = side?.paused ?? null;` の下に `link = linkState(world, world.cur);` を足す（親の World は `cur` が 0、子の描くための World は `cur` が 1）。
4. `<CoopOverlay` の props に `{link}` を足す。

`hud.ts`

1. `hud()` の HP の数字を書いた行の下に足す。

```ts
// 連携の技のゲージ（2 匹のときだけ）。満タンで使えるあいだは明るい黄色にする
if (w.heroes.length > 1) {
  const l = w.link;
  bar(ctx, 6, top + 19, 80, 2, l.charge / l.need, l.cool > 0 ? PALETTE.Y : PALETTE.y, PALETTE.M);
}
```

`src/lib/games/animal-survivors/draw-link.ts`

```ts
import { animal } from './animals';
import { goldArt } from './art/evolved';
import { ITEM_ART } from './art/items';
import { PALETTE } from './art/palette';
import { LINK_SHOW } from './link';
import { HALVES } from './link-halves';
import { bake } from './pixels';
import type { World } from './world';

const ICON = 36;

/** 連携の技の絵。広がりながら薄くなる金色の形と、動物の最初の武器の絵を金色で大きく（点滅させない） */
export function drawLink(ctx: CanvasRenderingContext2D, w: World): void {
  for (const s of w.link.shows) {
    const k = Math.min(1, s.t / LINK_SHOW);
    const shape = HALVES[s.animal].shape;
    ctx.save();
    ctx.globalAlpha = 0.55 * (1 - k);
    ctx.fillStyle = PALETTE.y;
    ctx.strokeStyle = PALETTE.y;
    ctx.translate(s.x, s.y);
    if (shape.kind === 'ring') {
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, shape.r * (0.3 + 0.7 * k), 0, Math.PI * 2);
      ctx.stroke();
    } else if (shape.kind === 'cone') {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, shape.len * (0.3 + 0.7 * k), s.angle - shape.spread / 2, s.angle + shape.spread / 2);
      ctx.closePath();
      ctx.fill();
    } else
      for (const a of shape.angles) {
        ctx.save();
        ctx.rotate(s.angle + a);
        ctx.fillRect(0, -shape.width / 2, shape.len * (0.3 + 0.7 * k), shape.width);
        ctx.restore();
      }
    ctx.restore();
    ctx.globalAlpha = 1 - k;
    const art = bake(goldArt(ITEM_ART[`weapon-${animal(s.animal).weapon}`]));
    ctx.drawImage(art, Math.round(s.x - ICON / 2), Math.round(s.y - ICON - 10 * k), ICON, ICON);
    ctx.globalAlpha = 1;
  }
}
```

`draw.ts`

1. import に `import { drawLink } from './draw-link';` を足す。
2. `draw()` の `swipes(ctx, w, q);` の下に `drawLink(ctx, w);` を足す。

- [ ] **Step 4: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/link.svelte.test.ts src/lib/games/animal-survivors/coop-play.svelte.test.ts`
Expected: PASS

Run: `pnpm check && pnpm lint`
Expected: エラーなし。`CoopPlay.svelte` と `CoopOverlay.svelte` は 200 行未満（`wc -l` で見る）

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/animal-survivors/LinkButton.svelte src/lib/games/animal-survivors/LinkCutIn.svelte src/lib/games/animal-survivors/draw-link.ts src/lib/games/animal-survivors/link.svelte.test.ts src/lib/games/animal-survivors/CoopOverlay.svelte src/lib/games/animal-survivors/CoopPlay.svelte src/lib/games/animal-survivors/PromptLayer.svelte src/lib/games/animal-survivors/prompts.svelte.ts src/lib/games/animal-survivors/hud.ts src/lib/games/animal-survivors/draw.ts
git commit -m "Show the link button, cut-in, gauge and move art in co-op

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 2 匹のボットで要る量を決める

**Files:**

- Create: `<scratchpad>/sim/link.sim.ts`（commit しない）
- Modify: `src/lib/games/animal-survivors/link.ts`（`LINK_BASE`・`LINK_GROW` の値だけ）
- Test: `src/lib/games/animal-survivors/link.test.ts`（値を変えても通ること）

**Interfaces:**

- Consumes: `createWorld`・`addHero`・`step`・`choices`・`apply`・`openChest`・`linkReady`・`pressLink`・`UPGRADES`

- [ ] **Step 1: ボットを書く**

`<scratchpad>` はこのセッションの scratchpad。`<scratchpad>/vitest.config.mjs` が無ければ作る（[[balance-sim-harness]] の形）。

```js
export default {
  resolve: {
    alias: { $lib: '/Users/oekazuma/localRepo/asobibako/.claude/worktrees/level-selection-ui-a6f9e5/src/lib' }
  },
  server: { fs: { strict: false } },
  test: { include: ['**/*.sim.ts'] }
};
```

`<scratchpad>/sim/link.sim.ts`

```ts
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
const G =
  '/Users/oekazuma/localRepo/asobibako/.claude/worktrees/level-selection-ui-a6f9e5/src/lib/games/animal-survivors';
const { createWorld, addHero, step } = await import(`${G}/world`);
const { choices, apply } = await import(`${G}/choices`);
const { openChest } = await import(`${G}/chest`);
const { linkReady, pressLink } = await import(`${G}/link`);
const { UPGRADES } = await import(`${G}/upgrades`);

const half = Object.fromEntries(UPGRADES.map((u: { id: string; max: number }) => [u.id, Math.floor(u.max / 2)]));
const DT = 1 / 30;

/** 敵から逃げ、近い玉へ寄る。相棒は 1 匹めのそばを回る（gap がそばの距離） */
function run(seed: number, stage: string, ranks: object, gap: number) {
  const w = createWorld('dog', seed, { w: 260, h: 380 }, ranks, stage);
  addHero(w, 'cat', ranks);
  let t = 0;
  while (!w.over && t < 700) {
    for (let k = 0; k < w.heroes.length; k++) {
      w.cur = k;
      while (w.chests > 0) openChest(w);
      while (w.pending > 0) apply(w, choices(w)[0]);
    }
    w.cur = 0;
    const p = w.player;
    let fx = 0;
    let fy = 0;
    for (const e of w.enemies) {
      if (!e.alive || e.def.prop) continue;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d2 = dx * dx + dy * dy + 1;
      if (d2 > 120 * 120) continue;
      fx += dx / d2;
      fy += dy / d2;
    }
    let gem = null;
    let gd = Infinity;
    for (const g of w.gems) {
      if (!g.alive) continue;
      const d = (g.x - p.x) ** 2 + (g.y - p.y) ** 2;
      if (d < gd) {
        gd = d;
        gem = g;
      }
    }
    if (gem && gd < 150 * 150) {
      fx += ((gem.x - p.x) / Math.sqrt(gd)) * 0.004;
      fy += ((gem.y - p.y) / Math.sqrt(gd)) * 0.004;
    }
    const len = Math.hypot(fx, fy) || 1;
    const b = w.heroes[1];
    if (!b.down) {
      b.player.x = p.x + Math.cos(t * 0.7) * gap;
      b.player.y = p.y + Math.sin(t * 0.7) * gap;
    }
    if (linkReady(w)) {
      pressLink(w, 0);
      pressLink(w, 1);
    }
    step(w, { x: fx / len, y: fy / len }, DT);
    t += DT;
  }
  return { time: Math.round(w.time), clear: w.over === 'clear', uses: w.link.uses, need: w.link.need };
}

it('link uses per run', () => {
  const out: Record<string, unknown>[] = [];
  for (const stage of ['forest', 'graveyard'])
    for (const [name, ranks] of [
      ['none', {}],
      ['half', half]
    ] as const)
      for (const gap of [30, 70])
        for (let seed = 1; seed <= 8; seed++)
          out.push({ stage, ranks: name, gap, seed, ...run(seed, stage, ranks, gap) });
  writeFileSync(`${import.meta.dirname}/link.json`, JSON.stringify(out));
}, 1_800_000);
```

- [ ] **Step 2: 回して数を読む**

Run: `pnpm exec vitest run --config <scratchpad>/vitest.config.mjs --root <scratchpad> sim/link.sim.ts`

読み方。`<scratchpad>/sim/link.json` を、ステージ・店・gap ごとに uses の中央値と、10 分まで生きた回の uses の中央値にまとめる（node の 1 行で集める）。
Expected: 店を半分・gap 30 で 10 分クリアした回の uses の中央値が 2〜3

- [ ] **Step 3: 外れたら値を変えて回し直す**

中央値が 2 未満なら `LINK_BASE` を下げ、4 以上なら上げる（同時に `LINK_GROW` を 1.4〜2.0 で動かしてよい）。回すたびに ledger に `LINK_BASE`・`LINK_GROW`・中央値を 1 行で残す。2〜3 に入ったら止める。決めた値と数字は、利用者への報告に表で出す。

- [ ] **Step 4: テストが値に寄っていないことを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/link.test.ts`
Expected: PASS（テストは `LINK_BASE`・`LINK_GROW` を定数から読む）

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/animal-survivors/link.ts
git commit -m "Tune the link gauge so a run gets two to three link moves

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

（値を変えなかったときはコミットせず、ledger に「変えなかった」と数字を残す）

---

### Task 6: 説明と画面の確かめ

**Files:**

- Modify: `CLAUDE.md`（アニマルサバイバーの協力プレイの段落）
- Create: `<scratchpad>/link/shot.mjs`（commit しない）

- [ ] **Step 1: CLAUDE.md に足す**

アニマルサバイバーの段落の「画面の外に出た相棒は、画面の端に向きの矢印と相棒の顔を出す（`draw-events.ts` の `partnerArrows`）。」の後ろに足す。

```text
2 匹が近く（80 ドット以内、`link.ts` の `LINK_NEAR`）で倒した敵で共通のゲージ（`World.link`、HUD の HP の下）がたまり（ヌシ・ボスは多め。技で倒した敵と、片方が倒れている・抜けたときは入らない）、満タンで両方の端末の右端に「いっしょに！」（`LinkButton.svelte`。PC はスペースキー）を出す。指が触れた瞬間に数え、2 人の押しがゲームの時刻で 1.5 秒以内にそろうと（決めるのは親の World の `pressLink`、子は `{ t: 'link' }` を送る。親が止めているあいだの子の押しは数えない）、World が自分で 1 秒止まって（`stepLink`。押しは step の外で起きるので、出来事 `link` は次の step で積む）2 匹の顔の帯（`LinkCutIn.svelte`）を出し、2 匹の半分（`link-halves.ts` の `HALVES`。動物ごとの輪・帯・扇の形）を同時に当てる。ふつうの敵とヌシは倒れ、ボスは最大 HP の 1 割（2 つの半分が両方当たっても 1 回、大ヘビの節は数えない）。出したあと 2 匹とも 2 秒は当たらず、次に要る量は `LINK_GROW` 倍、45 秒は使えない。技の絵は最初の武器の絵を金色で大きく描く（`draw-link.ts`）。
```

- [ ] **Step 2: 2 ページの通しで撮る**

[[net-play-harness]] の形（同じ context に 2 ページ、偽カメラで QR を渡す）で、`pnpm dev`（`preview_start` の `dev`）の `/asobibako/games/animal-survivors` を開き、2 ページで「ふたりで遊ぶ」からつないで同じステージで始める。始めたら親のページで、`Play` と同じく一時的な口を入れた World（`CoopPlay.svelte` の `const world = given;` の下に `(globalThis as any).__w = world; // TEMP-OBS`）を使い、相棒を近くに寄せてゲージを満たす。

```js
await host.evaluate(() => {
  const w = globalThis.__w;
  for (const h of w.heroes) h.stats.maxHp = h.player.hp = 1e9;
  w.heroes[1].player.x = w.heroes[0].player.x + 20;
  w.heroes[1].player.y = w.heroes[0].player.y;
  w.link.charge = w.link.need;
});
```

撮るもの。

1. 両方のページの「いっしょに！」（`[data-link]`）
2. 親だけ押したあとの、親の「相棒を待っています」と子の「相棒が押した！」
3. 子も押したあとの帯（`LinkCutIn`）
4. 帯が消えたあとの技の絵（親の画面）

撮り終えたら `sed -i '' '/TEMP-OBS/d' src/lib/games/animal-survivors/CoopPlay.svelte` で口を外す（commit しない）。

- [ ] **Step 3: 全体を通す**

Run: `pnpm verify`
Expected: exit 0

- [ ] **Step 4: コミット**

```bash
git add CLAUDE.md
git commit -m "Describe the Animal Survivors link move

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
