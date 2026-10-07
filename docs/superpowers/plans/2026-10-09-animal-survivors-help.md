# アニマルサバイバー 助け合い 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 協力プレイで、相棒を起こすと 2 匹とも力と風のご利益を 10 秒もらい、起き上がる瞬間を 2 人の画面で見せ、相棒のピンチを赤い丸・赤い輪と HUD の相棒の行で知らせる。

**Architecture:** ルールは `heroes.ts` の `raise()` に足し、起こした動物を見つけてご利益を足し、持ち主の付かない出来事 `raising`（1 秒ごと）と `raised`（起き上がった）を積む。演出は `effects.ts`・`sounds.ts`・`prompts.svelte.ts` がその出来事から出す。ピンチの判定は `heroes.ts` の `inPinch()` で、絵は `draw-events.ts`、相棒の行は `hud.ts`、ボスの体力バーの位置は `draw-boss.ts` の `barsTop`。

**Tech Stack:** TypeScript、Svelte 5、vitest、playwright-core（画面の撮影）

**Spec:** `docs/superpowers/specs/2026-10-09-animal-survivors-help-design.md`

## Global Constraints

- 1 人で遊ぶときは何も変えない
- 起こした瞬間、起こした動物と起き上がった動物の 2 匹ともに、力と風のご利益（祠と同じ、攻撃と速さ 1.3 倍）を 10 秒足す。残りがあれば足す
- 店の復活・火の鳥のひなのよみがえり・不死鳥の羽根のように自分で起き上がったときは出さない
- 起こしているあいだは 1 秒ごとに少しずつ高くなる音
- 起き上がったら、両方の画面で起きた動物の場所に赤と白の粒、帯で「復活！」とご利益（力と風 10 秒）。白く光らせるのは起きた本人の画面だけ。画面は揺らさない
- ピンチは HP が 3 割を切ったときか倒れているあいだ
- 画面の外の相棒は端の矢印と顔のうしろに赤い丸、画面の中の相棒は足もとに赤い輪。なめらかに明滅（1 フレームごとに消したり切り替えたりしない）
- 倒れた相棒の顔は薄くしない
- HUD の自分の HP と連携のゲージの下に、相棒の顔と小さな HP のバーを 1 行。倒れていればバーは空で、顔の横に起こす輪の進み具合
- 協力プレイのボスの体力バーはその行のぶん下げる（`barsTop`）
- snap の形は変えない（`COOP_VERSION` は 4 のまま）
- コードコメントは非自明な WHY だけ

## Review Focus

- 起こした瞬間に起こした側が倒れていたら（同じフレームで被弾した）、ご利益は起き上がった側にだけ入る、または起こさない（Task 1 のテスト）
- 子の端末でも `raised` が届き、白く光るのは起きた本人の画面だけ（Task 2 のテスト）
- 抜けた相棒（`gone`）はピンチにならず、HUD の行も出さない（Task 1・Task 3 のテスト）
- 1 人のときのボスの体力バーの位置は変わらない（Task 3 のテスト）
- 起こしている途中で離れたとき、1 秒ごとの音は始めからやり直す（同じ段の音を 2 回鳴らさない。Task 1 のテスト）

---

### Task 1: 起こしたごほうびと出来事・ピンチの判定

**Files:**

- Modify: `src/lib/games/animal-survivors/heroes.ts`（`raise()`、`RAISE_BLESS`、`PINCH`、`inPinch`）
- Modify: `src/lib/games/animal-survivors/world.ts`（`GameEvent` に `raising`・`raised`）
- Test: `src/lib/games/animal-survivors/help.test.ts`

**Interfaces:**

- Produces
  - `heroes.ts`: `RAISE_BLESS = 10`、`PINCH = 0.3`、`inPinch(h: Hero): boolean`
  - `GameEvent` の `{ type: 'raising'; who: number; step: number }` と `{ type: 'raised'; who: number; by: number }`（`who` は起きる動物、`by` は起こした動物、`step` は 1・2）
  - `raise()` は起き上がったときに `revive` を積まず、`raised` を積む

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/games/animal-survivors/help.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { inPinch, PINCH, RAISE_BLESS, RAISE_SECS } from './heroes';
import { addHero, createWorld, hurtPlayer, step, type World } from './world';

const VIEW = { w: 260, h: 380 };
const still = { x: 0, y: 0 };

/** 2 匹めが倒れていて、1 匹めがそばにいる */
function rescue(): World {
  const w = createWorld('dog', 5, VIEW);
  addHero(w, 'cat');
  w.stage = { ...w.stage, waves: [] };
  w.spawnAcc = [];
  w.heroes[0].player.x = 190;
  w.heroes[1].player.x = 200;
  w.heroes[1].down = true;
  w.heroes[1].player.hp = 0;
  return w;
}

/** 起こし終わるまで進め、そのあいだの出来事をためる */
function untilRaised(w: World) {
  const seen: World['events'] = [];
  for (let i = 0; i < 200 && w.heroes[1].down; i++) {
    step(w, still, 1 / 60);
    seen.push(...w.events);
  }
  return seen;
}

describe('起こしたごほうび', () => {
  it('起こすと 2 匹とも力と風のご利益が 10 秒増え、残りがあれば足される', () => {
    const w = rescue();
    w.heroes[0].blessing.might = 4;
    untilRaised(w);
    expect(w.heroes[1].down).toBe(false);
    expect(w.heroes[0].blessing.might).toBeCloseTo(4 + RAISE_BLESS - RAISE_SECS, 0);
    expect(w.heroes[0].blessing.speed).toBeGreaterThan(RAISE_BLESS - 0.1);
    expect(w.heroes[1].blessing.might).toBeGreaterThan(RAISE_BLESS - 0.1);
    expect(w.heroes[1].blessing.speed).toBeGreaterThan(RAISE_BLESS - 0.1);
  });

  it('起き上がると持ち主の付かない raised が出て、revive は出ない', () => {
    const w = rescue();
    const seen = untilRaised(w);
    const r = seen.filter((e) => e.type === 'raised');
    expect(r).toEqual([{ type: 'raised', who: 1, by: 0 }]);
    expect(seen.some((e) => e.type === 'revive')).toBe(false);
  });

  it('自分で起き上がったとき（店の復活）はご利益が増えない', () => {
    const w = createWorld('dog', 5, VIEW);
    addHero(w, 'cat');
    w.revives = 1;
    w.player.hp = 1;
    hurtPlayer(w, 999);
    expect(w.player.hp).toBeGreaterThan(0);
    expect(w.heroes[0].blessing.might).toBe(0);
    expect(w.heroes[1].blessing.might).toBe(0);
  });

  it('起こしているあいだは 1 秒ごとに raising が出て、離れたら始めから数え直す', () => {
    const w = rescue();
    const seen: World['events'] = [];
    for (let i = 0; i < 70; i++) {
      step(w, still, 1 / 60);
      seen.push(...w.events);
    }
    expect(seen.filter((e) => e.type === 'raising')).toEqual([{ type: 'raising', who: 1, step: 1 }]);
    w.heroes[0].player.x = 0;
    step(w, still, 1 / 60);
    w.heroes[0].player.x = 190;
    seen.length = 0;
    for (let i = 0; i < 70; i++) {
      step(w, still, 1 / 60);
      seen.push(...w.events);
    }
    expect(seen.filter((e) => e.type === 'raising')).toEqual([{ type: 'raising', who: 1, step: 1 }]);
  });

  it('起こす側が倒れていれば起き上がらず、ご利益も出ない', () => {
    const w = rescue();
    w.heroes[0].down = true;
    for (let i = 0; i < 200; i++) step(w, still, 1 / 60);
    expect(w.heroes[1].down).toBe(true);
    expect(w.heroes[1].blessing.might).toBe(0);
  });
});

describe('ピンチ', () => {
  it('HP が 3 割を切ったときと倒れているあいだだけピンチ、抜けた動物はピンチにしない', () => {
    const w = createWorld('dog', 5, VIEW);
    addHero(w, 'cat');
    const h = w.heroes[1];
    h.player.hp = h.stats.maxHp * PINCH;
    expect(inPinch(h)).toBe(false);
    h.player.hp = h.stats.maxHp * PINCH - 1;
    expect(inPinch(h)).toBe(true);
    h.player.hp = h.stats.maxHp;
    h.down = true;
    expect(inPinch(h)).toBe(true);
    h.gone = true;
    expect(inPinch(h)).toBe(false);
  });
});
```

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/help.test.ts`
Expected: FAIL（`inPinch`・`PINCH`・`RAISE_BLESS` が無い）

- [ ] **Step 3: 実装する**

`world.ts` の `GameEvent` の `| { type: 'link'; ... }` の下に足す。

```ts
  /** 倒れた動物を起こしている（1 秒ごと。who は起きる動物、step はそこまでの秒） */
  | { type: 'raising'; who: number; step: number }
  /** 相棒がそばで起こした（who が起きた動物、by が起こした動物） */
  | { type: 'raised'; who: number; by: number }
```

`heroes.ts` の `RAISE_REACH` の下から `raise()` の終わりまでを次に置き換える。

```ts
/** 起こした 2 匹に足す、力と風のご利益の秒 */
export const RAISE_BLESS = 10;
/** 相棒の HP がこの割合を切ると、自分の画面でピンチを知らせる */
export const PINCH = 0.3;

export const inPinch = (h: Hero) => !h.gone && (h.down || h.player.hp < h.stats.maxHp * PINCH);

/** 倒れた動物の起こす時計を進め、届いたら HP 半分で起こし、2 匹にご利益を足す */
export function raise(w: World, dt: number): void {
  w.heroes.forEach((h, i) => {
    if (!h.down || h.gone) return;
    const by = w.heroes.findIndex(
      (o) => !o.down && (o.player.x - h.player.x) ** 2 + (o.player.y - h.player.y) ** 2 < RAISE_REACH ** 2
    );
    const was = h.revive;
    h.revive = by >= 0 ? h.revive + dt : 0;
    if (h.revive < RAISE_SECS) {
      if (Math.floor(h.revive) > Math.floor(was))
        w.events.push({ type: 'raising', who: i, step: Math.floor(h.revive) });
      return;
    }
    h.down = false;
    h.revive = 0;
    h.player.hp = Math.round(h.stats.maxHp / 2);
    h.player.invuln = 2;
    for (const k of [i, by]) {
      const b = w.heroes[k].blessing;
      b.might = Math.max(0, b.might) + RAISE_BLESS;
      b.speed = Math.max(0, b.speed) + RAISE_BLESS;
    }
    w.events.push({ type: 'raised', who: i, by });
  });
}
```

`raising` と `raised` は `OWN` に入れない（両方の画面に届ける）。

- [ ] **Step 4: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/help.test.ts src/lib/games/animal-survivors/coop-world.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/animal-survivors/heroes.ts src/lib/games/animal-survivors/world.ts src/lib/games/animal-survivors/help.test.ts
git commit -m "Bless both heroes when one raises the other and mark a partner in a pinch

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 起き上がる演出（粒・音・帯）

**Files:**

- Modify: `src/lib/games/animal-survivors/effects.ts`、`sounds.ts`、`prompts.svelte.ts`
- Test: `src/lib/games/animal-survivors/help-fx.test.ts`、`src/lib/games/animal-survivors/help.svelte.test.ts`、`src/lib/games/animal-survivors/coop.test.ts`

**Interfaces:**

- Consumes: Task 1 の `raising`・`raised`・`RAISE_BLESS`
- Produces: `sounds.raising(step: number)`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/games/animal-survivors/help-fx.test.ts`

```ts
import { describe, expect, it, vi } from 'vitest';
import { Effects } from './effects';
import { addHero, createWorld } from './world';

vi.mock('$lib/audio.svelte', () => ({
  audio: { muted: false },
  toggleMute: () => {},
  bus: () => null,
  tone: () => {},
  sweep: () => {},
  noise: () => {}
}));

describe('起き上がる演出', () => {
  it('白く光るのは起きた本人の画面だけで、起こした側の画面は光らない', () => {
    const w = createWorld('dog', 1, { w: 260, h: 380 });
    addHero(w, 'cat');
    const fx = new Effects();
    w.events.push({ type: 'raised', who: 1, by: 0 });
    fx.take(w);
    expect(fx.flash).toBe(0);
    w.cur = 1;
    fx.take(w);
    expect(fx.flash).toBeGreaterThan(0);
  });
});
```

`src/lib/games/animal-survivors/help.svelte.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { RAISE_BLESS } from './heroes';
import { Prompts } from './prompts.svelte';
import { addHero, createWorld } from './world';

describe('復活の帯', () => {
  it('raised で、起こした側にも起きた側にも「復活！」とご利益の帯が出る', () => {
    for (const cur of [0, 1]) {
      const w = createWorld('dog', 1, { w: 260, h: 380 });
      addHero(w, 'cat');
      w.cur = cur;
      const p = new Prompts(w);
      w.events.push({ type: 'raised', who: 1, by: 0 });
      p.take();
      expect(p.notice?.text).toContain('復活！');
      expect(p.notice?.text).toContain(`${RAISE_BLESS} 秒`);
    }
  });
});
```

`coop.test.ts` の `describe` に足す（`started()` を使うほかのテストと同じ並び）。

```ts
it('親の World で子の動物が起き上がると、子の画面にも raised が届く', async () => {
  const { g, w, h } = await started();
  w.heroes[1].down = true;
  w.heroes[1].player.hp = 0;
  w.heroes[1].player.x = w.heroes[0].player.x + 5;
  w.heroes[1].player.y = w.heroes[0].player.y;
  let seen = false;
  for (let i = 0; i < 200 && !seen; i++) {
    step(w, { x: 0, y: 0 }, 1 / 60);
    seen = w.events.some((e) => e.type === 'raised');
    h.after(0.06);
  }
  expect(seen).toBe(true);
  await settle();
  g.frame(performance.now() + 1000);
  expect(g.view!.events.some((e) => e.type === 'raised')).toBe(true);
});
```

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/help-fx.test.ts src/lib/games/animal-survivors/help.svelte.test.ts src/lib/games/animal-survivors/coop.test.ts`
Expected: FAIL（`fx.flash` が増えない、帯が出ない）。coop のテストは、Task 1 で `raised` を積むので通ってもよい（届くことの守り）

- [ ] **Step 3: 実装する**

`sounds.ts` の `revive` の下に足す。

```ts
  /** 起こしているあいだ 1 秒ごと。段が進むほど高くする */
  raising: (step: number) => tone(523 + step * 131, 90, 'triangle', 0.06),
```

`effects.ts` の `} else if (e.type === 'revive') {` の上に足す。

```ts
      } else if (e.type === 'raised') {
        // 起こした相棒の画面にも、起きた動物の場所で粒をはじけさせる（白く光らせるのは起きた本人だけ）
        const p = w.heroes[e.who].player;
        if (e.who === w.cur) this.flash = 0.3;
        for (let i = 0; i < 40; i++) {
          const a = (i / 40) * Math.PI * 2;
          this.#bit(p.x, p.y, Math.cos(a) * 140, Math.sin(a) * 140, 0.6, i % 2 ? PALETTE.r : PALETTE.w, 3);
        }
        sounds.revive();
      } else if (e.type === 'raising') sounds.raising(e.step);
```

`prompts.svelte.ts`

1. import に `RAISE_BLESS` を足す（`./heroes` からの import があればそこへ、無ければ `import { RAISE_BLESS } from './heroes';`）。
2. `take()` の `else if (e.type === 'link') ...` の下に足す。

```ts
      else if (e.type === 'raised')
        this.notice = { text: `復活！\n力と風のご利益 ${RAISE_BLESS} 秒`, key: w.time, until: w.time + NOTICE * 2 };
```

- [ ] **Step 4: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/help-fx.test.ts src/lib/games/animal-survivors/help.svelte.test.ts src/lib/games/animal-survivors/coop.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/animal-survivors/effects.ts src/lib/games/animal-survivors/sounds.ts src/lib/games/animal-survivors/prompts.svelte.ts src/lib/games/animal-survivors/help-fx.test.ts src/lib/games/animal-survivors/help.svelte.test.ts src/lib/games/animal-survivors/coop.test.ts
git commit -m "Show the raise on both screens with a burst, rising ticks and a band

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: ピンチの赤と HUD の相棒の行

**Files:**

- Modify: `src/lib/games/animal-survivors/draw-events.ts`（`partnerArrows` に `now`、`pinchRing`）
- Modify: `src/lib/games/animal-survivors/draw.ts`（呼び出し）
- Modify: `src/lib/games/animal-survivors/hud.ts`（相棒の行）
- Modify: `src/lib/games/animal-survivors/draw-boss.ts`（`barsTop`）
- Test: `src/lib/games/animal-survivors/link-hud.test.ts`

**Interfaces:**

- Consumes: Task 1 の `inPinch(h)`、`RAISE_SECS`
- Produces
  - `partnerArrows(ctx, w, vw, vh, top, now: number)`
  - `pinchRing(ctx: CanvasRenderingContext2D, w: World, i: number, now: number): void`
  - `MATE_ROW = 21`（`draw-boss.ts`。相棒の行の高さ）

- [ ] **Step 1: 失敗するテストを書く**

`link-hud.test.ts` の中身を次に置き換える。

```ts
import { describe, expect, it } from 'vitest';
import { barsTop, MATE_ROW } from './draw-boss';
import { addHero, createWorld } from './world';

describe('ボスの体力バーの位置', () => {
  it('1 匹のときは今の位置、2 匹のときは連携のゲージと相棒の行の下へずらす', () => {
    const solo = createWorld('dog', 1, { w: 260, h: 380 });
    expect(barsTop(solo, 24)).toBe(24 + 22);
    const two = createWorld('dog', 1, { w: 260, h: 380 });
    addHero(two, 'cat');
    // 相棒の顔は top + 23 から 16 ドット。BOSS の字はバーの 1 つ上の行から書く
    expect(barsTop(two, 24) - 1).toBeGreaterThan(24 + 23 + 16 - 1);
    expect(barsTop(two, 24)).toBe(24 + 22 + MATE_ROW);
  });
});
```

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/link-hud.test.ts`
Expected: FAIL（`MATE_ROW` が無く、ずれが 5 のまま）

- [ ] **Step 3: 実装する**

`draw-boss.ts` の `barsTop` を次に置き換える。

```ts
/** 2 匹のときの、HP の下の連携のゲージと相棒の行の高さ */
export const MATE_ROW = 21;

/** ボスの体力バーの 1 本めの高さ。2 匹のときは連携のゲージと相棒の行と重ならないよう下げる */
export const barsTop = (w: World, top: number) => top + 22 + (w.heroes.length > 1 ? MATE_ROW : 0);
```

`hud.ts`

1. import に `import { ANIMAL_ART } from './art/animals';` と `import { RAISE_SECS } from './heroes';` を足す。
2. 連携のゲージの `if (w.heroes.length > 1) { ... }` の下に足す。

```ts
// 相棒の顔と HP。倒れていればバーは空で、顔の横に起こす輪の進み具合を出す
const mate = w.heroes.length > 1 ? w.heroes[w.cur === 0 ? 1 : 0] : null;
if (mate && !mate.gone) {
  const y = top + 23;
  ctx.drawImage(bake(ANIMAL_ART[mate.animal.id].forms[0].walk), 6, y);
  bar(ctx, 24, y + 7, 62, 3, mate.down ? 0 : mate.player.hp / mate.stats.maxHp, PALETTE.r, PALETTE.R);
  if (mate.down && mate.revive > 0) {
    ctx.strokeStyle = PALETTE.y;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(94, y + 8, 4, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * mate.revive) / RAISE_SECS);
    ctx.stroke();
  }
}
```

`draw-events.ts`

1. import に `import { inPinch } from './heroes';` を足す。
2. `partnerArrows` を次に置き換える（コメントも）。

```ts
/** 相棒のピンチの赤。ゆっくり強めて弱める（大群の中で点滅させない） */
function pinchAlpha(now: number): number {
  return 0.35 + 0.45 * pulse(now);
}

/**
 * 画面の外の相棒への矢印。宝箱やヌシの矢印と見分けるよう、相棒の顔を画面の内側へ添える。
 * ピンチ（HP 3 割未満か倒れている）なら矢印と顔のうしろに赤い丸を出す
 */
export function partnerArrows(
  ctx: CanvasRenderingContext2D,
  w: World,
  vw: number,
  vh: number,
  top: number,
  now: number
): void {
  for (const i of partners(w)) {
    const h = w.heroes[i];
    const near = edgeAt(w, h.player, vw, vh, top);
    if (!near) continue;
    const face = ANIMAL_ART[h.animal.id].forms[0].walk;
    const y = near.y > vh / 2 ? near.y - 6 - face.h : near.y + 6;
    const x = Math.min(vw - face.w - 2, Math.max(2, near.x - Math.floor(face.w / 2)));
    if (inPinch(h)) {
      ctx.globalAlpha = pinchAlpha(now);
      ctx.fillStyle = PALETTE.r;
      ctx.beginPath();
      ctx.arc(near.x, near.y, 9, 0, Math.PI * 2);
      ctx.arc(x + face.w / 2, y + face.h / 2, face.w / 2 + 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    edgeArrow(ctx, w, h.player, vw, vh, top);
    ctx.drawImage(bake(face), x, y);
  }
}

/** 画面の中のピンチの相棒の足もとの赤い輪（自分の動物には出さない） */
export function pinchRing(ctx: CanvasRenderingContext2D, w: World, i: number, now: number): void {
  const h = w.heroes[i];
  if (i === w.cur || !inPinch(h)) return;
  const p = h.player;
  ctx.globalAlpha = pinchAlpha(now);
  ctx.strokeStyle = PALETTE.r;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 8, 12, 5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}
```

`edgeAt` が `draw-events.ts` の中にあり `export` されていないときも、同じファイルなのでそのまま使える。

`draw.ts`

1. `draw-events` の import に `pinchRing` を足す。
2. 動物を描くループの `player(ctx, w, now);` の上に `pinchRing(ctx, w, i, now);` を足す（ループの中では `w.cur` を `i` に切り替えているので、自分を見分けるために、ループの前の `const me = w.cur;` を使う形にする）。

```ts
w.cur = me;
pinchRing(ctx, w, i, now);
w.cur = i;
player(ctx, w, now);
```

3. `partnerArrows(ctx, w, v.w, v.h, top);` を `partnerArrows(ctx, w, v.w, v.h, top, now);` にする。

- [ ] **Step 4: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/link-hud.test.ts && pnpm check`
Expected: PASS、型のエラーなし

Run: `pnpm test:run src/lib/games/animal-survivors`
Expected: 全部 PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/animal-survivors/draw-events.ts src/lib/games/animal-survivors/draw.ts src/lib/games/animal-survivors/hud.ts src/lib/games/animal-survivors/draw-boss.ts src/lib/games/animal-survivors/link-hud.test.ts
git commit -m "Show a partner in a pinch in red and add the partner row to the co-op HUD

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 説明と画面の確かめ

**Files:**

- Modify: `CLAUDE.md`
- Modify: `<scratchpad>/link/shot.mjs` の写し `<scratchpad>/help/shot.mjs`（commit しない）

- [ ] **Step 1: CLAUDE.md に足す**

アニマルサバイバーの段落の「2 匹以上のときに HP が尽きた動物は `down` になって動かず撃たず、そばに相棒が 3 秒（`RAISE_SECS`）いると HP 半分で起き上がり（`raise`。倒れた子のまわりに満ちていく輪）、全員が倒れたら終わる。」の後ろに足す。

```text
相棒が起こすと 2 匹とも力と風のご利益が 10 秒（`RAISE_BLESS`）増え（自分で起き上がった店の復活・よみがえり・不死鳥の羽根では増えない）、起こしているあいだは 1 秒ごとに高くなる音（出来事 `raising`）、起き上がると両方の画面で粒と「復活！」の帯（`raised`。持ち主を付けないので両方に届き、白く光るのは起きた本人の画面だけ）を出す。相棒の HP が 3 割（`PINCH`）を切るか倒れているあいだは、画面の外なら端の矢印と顔のうしろ、画面の中なら足もとに赤をなめらかに明滅させ（`draw-events.ts` の `partnerArrows`・`pinchRing`）、HUD の HP と連携のゲージの下に相棒の顔と HP の行を出す（ボスの体力バーはそのぶん下げる、`draw-boss.ts` の `barsTop`）。
```

- [ ] **Step 2: 2 ページの通しで撮る**

`<scratchpad>/link/shot.mjs` を `<scratchpad>/help/shot.mjs` に写し、`CoopPlay.svelte` に一時的な口（`const world = given;` の下に `(globalThis as any).__w = world; // TEMP-OBS`）を入れて、始めたあとの親のページで次を順に撮る。

1. 相棒（子の動物）の HP を 2 割にし、画面の中に置く（足もとの赤い輪、HUD の相棒の行）

```js
await host.evaluate(() => {
  const w = globalThis.__w;
  w.stage = { ...w.stage, waves: [] };
  w.heroes[0].stats.maxHp = w.heroes[0].player.hp = 1e9;
  const m = w.heroes[1];
  m.player.hp = m.stats.maxHp * 0.2;
  m.player.x = w.heroes[0].player.x + 40;
  m.player.y = w.heroes[0].player.y;
});
```

2. 相棒を画面の外（`x + 400`）へ置き、倒す（`down = true`、`hp = 0`）。親の画面の端の矢印と顔の赤い丸
3. 相棒をそば（`x + 5`）へ戻し、1.5 秒待つ（HUD の起こす輪）
4. 起き上がった瞬間の親と子の画面（粒と「復活！」の帯、HUD のご利益の印）

子の動物の位置は子の端末から届くので、2 と 3 は子のページでも `globalThis.__w`（子の描くための World）の自分の動物を同じ位置に置く。撮り終えたら `sed -i '' '/TEMP-OBS/d' src/lib/games/animal-survivors/CoopPlay.svelte` で口を外す。

- [ ] **Step 3: 全体を通す**

Run: `pnpm verify`
Expected: exit 0

- [ ] **Step 4: コミット**

```bash
git add CLAUDE.md
git commit -m "Describe the Animal Survivors co-op help

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
