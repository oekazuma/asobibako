# アニマルサバイバー 仕上げのまとめ 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 残った手ざわり・不具合・見た目のずれを直し、新しい仕組みの実績・図鑑の手がかり・初めての説明を足す。

**Architecture:** ルールの直しは `world.ts`・`arms.ts`・`limit.ts`・`drops.ts` の該当の数行に定数を足して入れる。協力プレイの直しは `prompts.svelte.ts` に「選ぶ画面が出ている」口を足し、`CoopPlay.svelte`・`CoopOverlay.svelte` から使う。実績と手がかりは今の表（`achievements.ts`・`trophy-groups.ts`・`book-view.ts`）に足し、初めての説明は記録の `tips` に覚えて `Prompts` が帯に出す。

**Tech Stack:** TypeScript、Svelte 5、vitest

**Spec:** `docs/superpowers/specs/2026-10-09-animal-survivors-polish-design.md`

## Global Constraints

- 合わせ技のツタと炎は合体武器 1 つにつき同時に 24 個まで
- 限界突破で縮める待ち時間は元の 4 割より短くしない
- 協力プレイで画面が隠れたら一時停止（3 択・宝箱のあいだは止めない）
- 子の端末では育つ演出とボスの登場のあいだも動ける
- 延長戦を聞く画面の親の ✕ は「延長戦へ進まない」
- 倒れた動物は吹雪で流さない
- 2 人の同時の一時停止は変えず、テストを足す
- ヌシの障害物の押し出しの丸は半径 16 まで
- 動物のどちらからも画面の対角線 3 つぶん以上離れた品は消す（宝箱・ガチャ券・遺物・ボスの大袋は消さない）
- 合体武器の印は一時停止とダメージ表でも「+」
- 宝箱で合体したときは「遠吠え＋雷撃の合体！」
- 遺物の矢印が画面の下半分なら、遺物の絵を矢印の上に
- 祠のご利益の印の間は 3 けたでも重ならない広さ
- 火の羽根の折り返しの炎にも限界突破の大きさ
- 実績 5 つ（はじめての遺物 100・遺物をすべて 500・祠めぐり 200・合体の名手 300・限界の先へ 300）。48 → 53
- 図鑑の遺物の手がかりに、ステージ・だいたいの向き（画面の上が北）・遠さ
- 合体・遺物・祠・限界突破が初めて起きたときだけ帯でひとこと説明。出したかを記録に覚える
- コードコメントは非自明な WHY だけ。コンポーネントは 200 行未満（`CoopPlay.svelte` は今 194 行）

## Review Focus

- 遠くの品を消すとき、宝の地図の宝箱（`w.treasure`）や、2 匹のうち片方の近くにある品を消さない（Task 1 のテスト）
- 子の端末で、3 択や宝箱が出ているあいだは今までどおり動けない（Task 2 のテスト）
- 初めての説明は、協力プレイの子の端末でも 1 回だけ出る（記録は端末ごと。Task 4 のテスト）
- 限界の先へ・合体の名手・祠めぐりは、その回のまとめが無い店の画面での判定（`run` が undefined）で落ちない（Task 4 のテスト）
- 図鑑の手がかりの向きが、遺物の表の角度と合っている（Task 4 のテスト）

---

### Task 1: ルールの直し

**Files:**

- Modify: `arms.ts`（合わせ技のツタと炎の数、`flameTurn`）、`limit.ts`（待ち時間の下限）、`world.ts`（吹雪・ヌシの丸）、`drops.ts`（遠くの品）
- Create: `polish.test.ts`

**Interfaces:**

- Produces: `TWIST_ZONES = 24`（arms.ts）、`COOL_FLOOR = 0.4`（limit.ts）、`CHIEF_PUSH = 16`（world.ts）、`FAR_ITEM = 3`（drops.ts、画面の対角線の何倍か）

- [ ] **Step 1: 失敗するテストを書く**

`polish.test.ts`。

```ts
import { describe, expect, it } from 'vitest';
import { fire, hits } from './arms';
import { collect } from './drops';
import { ENEMIES } from './enemies';
import { limitStats } from './limit';
import { obstacleAt } from './obstacles';
import { MAX_LEVEL, WEAPONS, weaponStats } from './weapons';
import { addHero, chiefOf, createWorld, makeEnemy, step, type World } from './world';

const VIEW = { w: 260, h: 380 };

function quiet(stage = 'forest'): World {
  const w = createWorld('dog', 1, VIEW, {}, stage);
  w.stage = { ...w.stage, waves: [], bosses: [], chiefs: [], events: [] };
  w.metalAt = -1;
  w.propCd = 1e9;
  w.items.length = 0;
  return w;
}

describe('合わせ技のツタと炎の数', () => {
  it('芽吹きの森のツタは、合体武器 1 つにつき同時に 24 本まで', () => {
    const w = quiet();
    w.weapons = [{ id: 'acornUn', level: MAX_LEVEL, cd: 0, cd2: 99, limit: { amount: 40 } }];
    for (let i = 0; i < 60; i++)
      w.enemies.push(makeEnemy(ENEMIES.caterpillar, Math.cos(i) * 40, Math.sin(i) * 40, 1e9));
    for (let k = 0; k < 90; k++) {
      w.grid.clear();
      w.enemies.forEach((e, i) => w.grid.add(i, e.x, e.y));
      fire(w, 1 / 30);
      hits(w, 1 / 30);
      w.time += 1 / 30;
    }
    expect(w.effects.filter((f) => f.alive && f.kind === 'vine').length).toBeLessThanOrEqual(24);
  });
});

describe('限界突破の待ち時間の下限', () => {
  it('何回上げても、待ち時間は元の 4 割より短くならない', () => {
    const s = weaponStats(WEAPONS.woof, MAX_LEVEL);
    expect(limitStats(s, { cooldown: 100 }).cooldown).toBeCloseTo(s.cooldown * 0.4);
  });
});

describe('吹雪とヌシ', () => {
  it('倒れた動物は吹雪で流されない', () => {
    const w = quiet('snow');
    addHero(w, 'cat');
    w.heroes[0].down = true;
    Object.assign(w.storm, { left: 100, wx: 1, wy: 0, next: 99 });
    const x0 = w.player.x;
    step(w, { x: 0, y: 0 }, 1);
    expect(w.player.x).toBe(x0);
  });

  it('大きなヌシも、隣り合う障害物のすき間を通れる（押し出しの丸は半径 16 まで）', () => {
    const w = quiet();
    let o = null;
    for (let c = 1; !o; c++) o = obstacleAt(w.stage.art, c, 0);
    const chief = makeEnemy(chiefOf(ENEMIES.croc), o.x, o.y, 1e9);
    w.enemies.push(chief);
    Object.assign(w.player, { x: o.x + 200, y: o.y });
    step(w, { x: 0, y: 0 }, 1 / 30);
    // 半径 16 の丸で押し出したなら、障害物の中心からの距離は大きくても 16 + 当たりの丸
    expect(Math.hypot(chief.x - o.x, (chief.y - o.y) / 0.55)).toBeLessThan(16 + 24 + 1);
  });
});

describe('遠くの品', () => {
  it('どちらの動物からも遠い品は消え、宝箱・券・遺物・大袋と、片方の近くの品は残る', () => {
    const w = quiet();
    addHero(w, 'cat');
    w.heroes[1].player.x = 5000;
    const far = 3 * Math.hypot(VIEW.w, VIEW.h) + 50;
    const keep = ['chest', 'ticket', 'relic', 'purse'] as const;
    w.items.push(
      { alive: true, kind: 'coin', x: -far, y: 0, pulled: false },
      { alive: true, kind: 'meat', x: 5000, y: 30, pulled: false },
      ...keep.map((kind) => ({
        alive: true,
        kind,
        x: -far,
        y: 0,
        pulled: false,
        relic: kind === 'relic' ? ('map' as const) : undefined
      }))
    );
    collect(w, 1 / 30);
    expect(w.items[0].alive).toBe(false);
    expect(w.items[1].alive).toBe(true);
    for (const it of w.items.slice(2)) expect(it.alive).toBe(true);
  });
});
```

（`chiefOf`・`ENEMIES.croc` が無ければ、`world.ts` と `enemies.ts` を読んで、半径のいちばん大きいヌシに合わせて台帳に書く。ヌシのテストは「押し出しの丸を小さくした」ことを、押し出したあとの距離で確かめる。今は半径 27 で押し出すので、距離が 16 + 24 + 1 を超えて落ちる。）

`limit.test.ts` に火の羽根のテストを足す。

```ts
it('火の羽根の折り返しの炎にも、限界突破の大きさが効く', () => {
  const size = (area?: number) => {
    const w = createWorld('chick', 1, VIEW);
    w.items.length = 0;
    w.weapons = [{ id: 'fireFeather', level: MAX_LEVEL, cd: 0, ...(area && { limit: { area } }) }];
    w.enemies.push(makeEnemy(ENEMIES.caterpillar, 60, 0, 1e9));
    for (let i = 0; i < 90; i++) {
      w.grid.clear();
      w.enemies.forEach((e, k) => w.grid.add(k, e.x, e.y));
      fire(w, 1 / 30);
      hits(w, 1 / 30);
      w.time += 1 / 30;
      const f = w.effects.find((x) => x.alive && x.kind === 'flame');
      if (f) return f.r;
    }
    return 0;
  };
  expect(size(5)).toBeCloseTo(size() * 1.5, 1);
});
```

（`chick` の最初の武器が `fireFeather` でなければ、`animals.ts` を見て合わせる。）

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/polish.test.ts src/lib/games/animal-survivors/limit.test.ts`
Expected: 新しい 6 つが FAIL

- [ ] **Step 3: 実装する**

`arms.ts`。

- 上に `/** 芽吹きの森と炎の疾走が、合体武器 1 つにつき同時に置けるツタと炎の数（増やしすぎると端末が重くなる） */ const TWIST_ZONES = 24;`
- 置く口を足す。

```ts
const zonesAt = (w: World, slot: number) =>
  w.effects.filter((f) => f.alive && f.slot === slot && (f.kind === 'vine' || f.kind === 'flame')).length;
```

- 芽吹きの森の `vineAt(...)` の前に `if (zonesAt(w, o.slot + PART_B) < TWIST_ZONES)` を付け、炎の疾走の `flameAt(...)` の前にも同じ条件を付ける（`o.drop` はどちらでも進める）。
- `flameTurn` の `const s = weaponStats(def, own.level);` を `const s = limitStats(weaponStats(def, own.level), own.limit);` にする。

`limit.ts`。

- `/** 限界突破で縮める待ち時間の下限（元の何割まで）。上限なしで上げると撃つ間が 0 に近づく */ const COOL_FLOOR = 0.4;`
- `cooldown: s.cooldown * (1 - STEP.cooldown) ** n('cooldown'),` を `cooldown: s.cooldown * Math.max(COOL_FLOOR, (1 - STEP.cooldown) ** n('cooldown')),` にする。

`world.ts`。

- 吹雪の `if (w.storm.left > 0 && w.freeze <= 0) {` を `if (w.storm.left > 0 && w.freeze <= 0 && !w.heroes[0].down) {` にする。
- `/** ヌシは体が大きく、隣り合う障害物のすき間で引っかかるので、障害物から押し出す丸だけを小さくする */ const CHIEF_PUSH = 16;`
- `for (const e of w.enemies) if (e.alive && blocked(e)) pushOut(w.stage.art, e, e.def.r);` を `for (const e of w.enemies) if (e.alive && blocked(e)) pushOut(w.stage.art, e, e.def.chief ? Math.min(e.def.r, CHIEF_PUSH) : e.def.r);` にする。

`drops.ts` の `collect` の品のループの先頭（`if (!it.alive) continue;` のあと）に足す。

```ts
if (!KEEP.has(it.kind) && w.heroes.every((h) => (it.x - h.player.x) ** 2 + (it.y - h.player.y) ** 2 > far2)) {
  it.alive = false;
  continue;
}
```

ループの前に `const far2 = (FAR_ITEM * Math.hypot(w.view.w, w.view.h)) ** 2;`、ファイルの上に足す。

```ts
/** 遠くへ置いていった品は、長い延長戦でたまり続けるので消す（画面の対角線の何倍か） */
const FAR_ITEM = 3;
/** 遠くても消さない品。取りに戻る値打ちがある */
const KEEP = new Set<Item['kind']>(['chest', 'ticket', 'relic', 'purse']);
```

（`w.heroes` に `gone` の動物がいれば、その動物は距離に数えない: `w.heroes.filter((h) => !h.gone).every(...)`。）

- [ ] **Step 4: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/animal-survivors
git commit -m "Cap twist zones, floor limit cooldowns, keep downed heroes out of storms, let chiefs pass narrow gaps and drop far items"
```

---

### Task 2: 協力プレイの直し

**Files:**

- Modify: `prompts.svelte.ts`（`picking`）、`CoopPlay.svelte`（子の移動・親の ✕）、`CoopOverlay.svelte`（画面が隠れたら止める）
- Modify: `coop.test.ts`、`coop-play.svelte.test.ts`

**Interfaces:**

- Produces: `Prompts.picking: boolean`（3 択・宝箱・札・延長戦を聞く画面のどれかが出ている）

- [ ] **Step 1: 失敗するテストを書く**

`coop.test.ts` の `describe('協力プレイのつなぎ'` に足す。

```ts
it('2 人が同時に一時停止を押しても、両方の端末の止めた人がそろう', async () => {
  const { g, h } = await started();
  h.pause();
  g.pause();
  await settle();
  expect(h.paused).toBe('host');
  expect(g.paused).toBe('host');
});
```

`prompts` の口のテストを `explore.svelte.test.ts` か新しい `polish.svelte.test.ts` に足す。

```ts
import { describe, expect, it } from 'vitest';
import { Prompts } from './prompts.svelte';
import { createWorld } from './world';

describe('選ぶ画面', () => {
  it('育つ演出とボスの登場は picking に入らず、3 択・宝箱・延長戦を聞く画面は入る', () => {
    const w = createWorld('dog', 1, { w: 260, h: 380 });
    const p = new Prompts(w);
    p.evolve = { from: 'a', to: 'b', fromForm: 0, form: 1, t: 0 };
    expect(p.busy).toBe(true);
    expect(p.picking).toBe(false);
    p.evolve = null;
    p.ask(null);
    expect(p.picking).toBe(true);
  });
});
```

`coop-play.svelte.test.ts` に、画面が隠れたら一時停止を頼むテストを足す。

```ts
it('画面が隠れたら一時停止を頼み、選ぶ画面が出ているあいだは頼まない', () => {
  let asked = 0;
  const side = { pause: () => (asked += 1) } as never;
  const target = document.body.appendChild(document.createElement('div'));
  const props = {
    me: 'guest' as const,
    side,
    world: createWorld('dog', 1, { w: 260, h: 380 }),
    paused: null,
    waiting: '',
    result: null,
    locked: false,
    busy: false,
    onend: () => {},
    onquit: () => {}
  };
  const app = mount(CoopOverlay, { target, props });
  flushSync();
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  document.dispatchEvent(new Event('visibilitychange'));
  expect(asked).toBe(1);
  unmount(app);
  const busyApp = mount(CoopOverlay, { target, props: { ...props, busy: true } });
  flushSync();
  document.dispatchEvent(new Event('visibilitychange'));
  expect(asked).toBe(1);
  unmount(busyApp);
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
});
```

（親の ✕ が延長戦を聞く画面で「進まない」になることは、`CoopPlay.svelte` を mount する仕掛けが重いので、Step 3 の実装を `coop-quit.ts` の小さな関数に出して node のテストで確かめる。次の形。）

`polish.test.ts` に足す。

```ts
import { quitAction } from './coop-quit';

describe('協力プレイの ✕', () => {
  it('親は、延長戦を聞く画面では「進まない」、遊んでいるあいだは終える、終わったあとは何もしない', () => {
    expect(quitAction({ host: true, over: 'clear', overtime: false, asking: true })).toBe('decline');
    expect(quitAction({ host: true, over: null, overtime: false, asking: false })).toBe('end');
    expect(quitAction({ host: true, over: 'dead', overtime: false, asking: false })).toBe('none');
    expect(quitAction({ host: false, over: 'clear', overtime: false, asking: true })).toBe('leave');
  });
});
```

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/coop.test.ts src/lib/games/animal-survivors/polish.test.ts src/lib/games/animal-survivors/polish.svelte.test.ts src/lib/games/animal-survivors/coop-play.svelte.test.ts`
Expected: 同時の一時停止のテストは PASS（今もそろう）。ほかは FAIL

- [ ] **Step 3: 実装する**

`prompts.svelte.ts` の `busy` の近くに足す。

```ts
  /** 指で選ぶ画面が出ている。子の端末はこのあいだだけ動きを止める（育つ演出とボスの登場は、親の World が子のためには止まらないので動ける） */
  get picking(): boolean {
    return this.options !== null || this.rewards !== null || this.cards !== null || this.asking;
  }
```

`coop-quit.ts`。

```ts
/** 協力プレイの ✕ が何をするか。親は遊んでいるあいだはその回を終え、延長戦を聞く画面では進まないを選び、子はいつでも抜ける */
export function quitAction(s: {
  host: boolean;
  over: string | null;
  overtime: boolean;
  asking: boolean;
}): 'end' | 'decline' | 'leave' | 'none' {
  if (!s.host) return 'leave';
  if (s.asking) return 'decline';
  return s.over ? 'none' : 'end';
}
```

`CoopPlay.svelte`。

- `quit()` を `quitAction` で分ける。

```ts
function quit() {
  const a = quitAction({ host: !!host, over: world.over, overtime: !!world.overtime, asking: !!prompts?.asking });
  if (a === 'decline') {
    prompts?.answered();
    return host?.end();
  }
  if (a === 'end') {
    // 自分で終えたので、延長戦なら引き上げたことにする（1 人で遊ぶときと同じ）
    if (world.overtime) world.overtime.retreat = true;
    world.over = 'dead';
  }
  guest?.quit();
}
```

- 子の移動の `if (!prompts?.busy && !guest.paused) guest.move(move, dt);` を `if (!prompts?.picking && !guest.paused) guest.move(move, dt);` にする。
- 200 行を超えたら、`waitText` など、ファイルの中で閉じている小さな関数を `coop-quit.ts` へ移して台帳に書く。

`CoopOverlay.svelte` に足す。

```svelte
<!-- 画面が隠れたら止める（1 人で遊ぶときと同じ。選ぶ画面のあいだは止めない） -->
<svelte:document onvisibilitychange={() => document.hidden && !busy && !paused && !world.over && side?.pause()} />
```

- [ ] **Step 4: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors && pnpm check`
Expected: PASS、型の誤り 0

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/animal-survivors
git commit -m "Pause co-op when hidden, let the guest move during its own grow, make the host quit decline overtime"
```

---

### Task 3: 見た目のずれ

**Files:**

- Modify: `Pause.svelte`、`DamageTable.svelte`、`ChestOpen.svelte`、`draw-events.ts`（`relicArrows`）、`draw-explore.ts`（`blessings`）
- Modify: `Pause.svelte.test.ts`、`DamageTable.svelte.test.ts`、`ChestOpen.svelte.test.ts`、`polish.test.ts`

**Interfaces:**

- Produces: `relicIconY(atY: number, vh: number): number`（draw-events.ts）、`BLESS_GAP = 26`（draw-explore.ts）

- [ ] **Step 1: 失敗するテストを書く**

`Pause.svelte.test.ts` に、`run.weapons` に `{ id: 'howlUn', level: 5 }` を入れると武器の並びに `+` が出て `★` が出ないテストを足す（今のテストの `show()` を使い、終わったら `run.weapons` を戻す）。

```ts
it('合体武器の印は、HUD と同じ「+」', () => {
  run.weapons.push({ id: 'howlUn', level: 5 });
  const { target, app } = show();
  const slots = [...target.querySelectorAll('.owned .slot')];
  expect(slots.at(-1)?.textContent).toContain('+');
  expect(slots.at(-1)?.textContent).not.toContain('★');
  run.weapons.pop();
  unmount(app);
});
```

（パッシブが後ろに並ぶので、`slots.at(-1)` が合体武器にならないときは、`run.passives` が空のこのテストの `run` のままで確かめる。）

`DamageTable.svelte.test.ts` に、`howlUn` の行で `+` が出て `★` が出ないテストを足す（今のテストの mount の形を写す）。

`ChestOpen.svelte.test.ts` に足す。

```ts
it('合体の中身は、元の 2 つの武器の名前を出す', () => {
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(ChestOpen, {
    target,
    props: { rewards: [{ kind: 'union', parts: ['howl', 'thunder'], id: 'howlUn' }], locked: false, onclose: () => {} }
  });
  flushSync();
  vi.advanceTimersByTime(700);
  flushSync();
  expect(target.textContent).toContain('遠吠え＋雷撃の合体！');
  unmount(app);
});
```

`polish.test.ts` に足す。

```ts
import { relicIconY } from './draw-events';
import { BLESS_GAP } from './draw-explore';

describe('HUD の重なり', () => {
  it('遺物の絵は、矢印が画面の下半分なら矢印の上、上半分なら下に出す', () => {
    expect(relicIconY(300, 380)).toBeLessThan(300);
    expect(relicIconY(40, 380)).toBeGreaterThan(40);
  });

  it('ご利益の印の間は、印（5）と 3 けたの秒（3 × 4 ドット）より広い', () => {
    expect(BLESS_GAP).toBeGreaterThan(5 + 2 + 3 * 4);
  });
});
```

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors`
Expected: 新しいテストが FAIL

- [ ] **Step 3: 実装する**

`Pause.svelte` の `owned` の武器に `union: WEAPONS[o.id]?.union !== undefined` を足し、Lv の字を `{o.union ? '+' : o.star ? '★' : o.level}` にする（`crown` の枝はそのまま前）。

`DamageTable.svelte` の `{WEAPONS[d.id].evolved ? '★' : `Lv${level(d.id)}`}` を `{WEAPONS[d.id].union ? '+' : WEAPONS[d.id].evolved ? '★' : `Lv${level(d.id)}`}` にする。

`ChestOpen.svelte` の合体の枝の `text: '合体！'` を `text: `${WEAPONS[r.parts[0]].name}＋${WEAPONS[r.parts[1]].name}の合体！`` にする。

`draw-events.ts`。

```ts
/** 遺物の絵を添える高さ。下半分では HUD の武器の枠に重ならないよう、矢印の上に出す */
export const relicIconY = (atY: number, vh: number) => (atY > vh / 2 ? atY - 18 : atY + 6);
```

`relicArrows` の `at.y + 6` を `relicIconY(at.y, vh)` にする。

`draw-explore.ts` の `const sx = x + i * 18;` を `const sx = x + i * BLESS_GAP;` にし、`/** ご利益の印どうしの間（印 5 ドット・すき間・3 けたの秒が入る） */ export const BLESS_GAP = 26;` を足す。

- [ ] **Step 4: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors && pnpm check`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/animal-survivors
git commit -m "Mark unions with + everywhere, name both parts in the chest, lift relic icons above bottom arrows and widen blessing slots"
```

---

### Task 4: 実績・図鑑の手がかり・初めての説明

**Files:**

- Modify: `world.ts`（`RunSummary.shrines`・`summary`）、`achievements.ts`、`trophy-groups.ts`、`book-view.ts`、`records.ts`（`tips`・`firstTip`）、`prompts.svelte.ts`
- Modify: `progress.test.ts`（48 → 53）、`arcana-book.test.ts`、`polish.test.ts`、`polish.svelte.test.ts`

**Interfaces:**

- Produces。
  - `RunSummary.shrines?: number`
  - 実績 `relic1`・`relicAll`・`shrine10`・`union3`・`limit50`
  - `relicHint(def: RelicDef): string`（book-view.ts）
  - `Records.tips: TipId[]`、`type TipId = 'union' | 'relic' | 'shrine' | 'limit'`、`firstTip(id: TipId): boolean`（records.ts。初めてなら記録に書いて true）、`TIP: Record<TipId, string>`（prompts.svelte.ts）

- [ ] **Step 1: 失敗するテストを書く**

`polish.test.ts` に足す。

```ts
import { ACHIEVEMENTS } from './achievements';
import { relicHint } from './book-view';
import { emptyRecords } from './records';
import { RELICS } from './relics';
import { summary } from './world';

describe('新しい実績', () => {
  const done = (id: string, r = emptyRecords(), run?: Parameters<(typeof ACHIEVEMENTS)[number]['done']>[1]) =>
    ACHIEVEMENTS.find((a) => a.id === id)!.done(r, run as never);

  it('遺物の 2 つは記録の遺物の数で決まり、店の画面（回のまとめなし）でも落ちない', () => {
    const r = emptyRecords();
    expect(done('relic1', r)).toBe(false);
    r.relics = ['map'];
    expect(done('relic1', r)).toBe(true);
    expect(done('relicAll', r)).toBe(false);
    r.relics = RELICS.map((d) => d.id);
    expect(done('relicAll', r)).toBe(true);
    for (const id of ['shrine10', 'union3', 'limit50']) expect(done(id, r, undefined)).toBe(false);
  });

  it('祠めぐり・合体の名手・限界の先へは、その回のまとめで決まる', () => {
    const w = quiet();
    w.shrinesUsed = Array.from({ length: 10 }, (_, i) => i);
    w.evolvedNow.push('howlUn', 'acornUn', 'pawUn');
    w.weapons = [{ id: 'woof', level: 5, cd: 0, limit: { damage: 50 } }];
    const run = summary(w);
    expect(run.shrines).toBe(10);
    expect(done('shrine10', emptyRecords(), run)).toBe(true);
    expect(done('union3', emptyRecords(), run)).toBe(true);
    expect(done('limit50', emptyRecords(), run)).toBe(true);
  });
});

describe('図鑑の遺物の手がかり', () => {
  it('ステージと、画面の上を北とした向きと、遠さを出す', () => {
    const map = RELICS.find((d) => d.id === 'map')!; // 角度 -0.6（右上）、700
    const lamp = RELICS.find((d) => d.id === 'lamp')!; // 角度 2.4（左下）、1500
    expect(relicHint(map)).toBe('森の北東の少し離れたところ');
    expect(relicHint(lamp)).toBe('森の南西の遠く');
  });
});
```

（`relics.ts` の角度が変わっていれば、向きの答えを台帳に書いて合わせる。`-0.6` ラジアンは右上なので北東、`2.4` は左下なので南西。）

`polish.svelte.test.ts` に足す。

```ts
import { loadRecords } from './records';

describe('初めての説明', () => {
  it('遺物・祠・合体・限界突破は、初めてのときだけ説明の帯を出し、記録に覚える', () => {
    localStorage.clear();
    const w = createWorld('dog', 1, { w: 260, h: 380 });
    const p = new Prompts(w);
    w.events.push({ type: 'shrine', kind: 'power' });
    p.take();
    expect(p.notice?.text).toContain('30 秒');
    expect(loadRecords().tips).toContain('shrine');
    w.events.length = 0;
    w.events.push({ type: 'shrine', kind: 'wind' });
    p.take();
    expect(p.notice?.text).not.toContain('30 秒');
    w.events.length = 0;
    w.events.push({ type: 'evolve', id: 'howlUn' });
    p.take();
    expect(p.notice?.text).toContain('枠が 1 つ空いた');
    w.events.length = 0;
    w.events.push({ type: 'evolve', id: 'woofEvo' });
    p.take();
    expect(loadRecords().tips).not.toContain('evolve');
  });
});
```

`progress.test.ts` の 48 を 53 にする。

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors`
Expected: 新しいテストが FAIL

- [ ] **Step 3: 実装する**

`world.ts` の `RunSummary` に `/** この回に使った祠の数 */ shrines?: number;`、`summary` に `shrines: w.shrinesUsed.length,`。

`achievements.ts`（`UNIONS` と `RELICS` を import）。

```ts
  { id: 'relic1', name: 'はじめての遺物', coins: 100, done: (r) => r.relics.length >= 1 },
  {
    id: 'relicAll',
    name: '遺物をすべて',
    coins: 500,
    done: (r) => r.relics.length >= RELICS.length,
    progress: (r) => [r.relics.length, RELICS.length]
  },
  { id: 'shrine10', name: '祠めぐり', coins: 200, done: (_r, run) => (run?.shrines ?? 0) >= 10 },
  {
    id: 'union3',
    name: '合体の名手',
    coins: 300,
    done: (_r, run) => (run?.evolved.filter((id) => UNIONS.some((u) => u.to === id)).length ?? 0) >= 3
  },
  {
    id: 'limit50',
    name: '限界の先へ',
    coins: 300,
    done: (_r, run) => (run?.weapons.reduce((n, o) => n + (o.lb ?? 0), 0) ?? 0) >= 50
  },
```

（`done` の 2 つめの引数の名前と型は、今の実績の書き方に合わせる。条件の文がほかの実績で `blurb` などの項目にあるなら、同じ形で足す。）

`trophy-groups.ts` の「ステージ」の並びに `'relic1', 'relicAll', 'shrine10'`、「育てる」の並びに `'union3', 'limit50'` を足す。

`book-view.ts`。

```ts
const COMPASS = ['東', '南東', '南', '南西', '西', '北西', '北', '北東'];

/** まだ拾っていない遺物の手がかり。画面の上を北として、向きは 8 方位、遠さは 2 段 */
export function relicHint(def: RelicDef): string {
  const i = ((Math.round(def.angle / (Math.PI / 4)) % 8) + 8) % 8;
  const far = def.dist >= 1000 ? '遠く' : '少し離れたところ';
  return `${stageOf(def.stage).name}の${COMPASS[i]}の${far}`;
}
```

遺物のタブの `hint: `${stageOf(d.stage).name}のどこかにある`` を `hint: relicHint(d)` にする（`RelicDef` を `./relics` から import）。

`records.ts`。

```ts
export type TipId = 'union' | 'relic' | 'shrine' | 'limit';
const TIP_IDS: TipId[] = ['union', 'relic', 'shrine', 'limit'];

/** 初めての説明をまだ出していなければ、出したことを記録に書いて true（端末ごと） */
export function firstTip(id: TipId): boolean {
  const r = loadRecords();
  if (r.tips.includes(id)) return false;
  r.tips.push(id);
  saveRecords(r);
  return true;
}
```

`Records` に `tips: TipId[]`、空の記録に `tips: []`、読むときに `tips: list(raw.tips, TIP_IDS)`。

`prompts.svelte.ts`。

```ts
const TIP: Record<TipId, string> = {
  union: '2 つの武器が 1 つになり、枠が 1 つ空いた',
  relic: '遺物は次の回からもずっと効く。図鑑で見られる',
  shrine: 'ご利益は 30 秒。HUD の印が残りの秒',
  limit: 'ここからは武器の能力を上げ続けられる'
};
```

`take()` の出来事の枝を次のようにする。

- 遺物: `this.notice = { text: `遺物を手に入れた！ ${name}${firstTip('relic') ? `\n${TIP.relic}` : ''}`, ... NOTICE * 2 }`（1 行めは名前まで、2 行めに説明）
- 祠: `const tip = firstTip('shrine'); this.notice = { text: `${SHRINE_NAME[e.kind]}！${tip ? `\n${TIP.shrine}` : ''}`, key: w.time, until: w.time + NOTICE * (tip ? 2 : 1) };`
- 合体: `else if (e.type === 'evolve' && WEAPONS[e.id]?.union && firstTip('union')) this.notice = { text: `合体！\n${TIP.union}`, key: w.time, until: w.time + NOTICE * 2 };`（`evolve` の出来事は持ち主の付かない出来事なので、協力プレイでは 2 台とも出る。どちらの端末も初めてなら出す）

限界突破は、3 択を作るところ（`this.options = choices(w);` の直後、2 か所あれば両方）に足す。

```ts
if (this.options.some((c) => c.kind === 'limit') && firstTip('limit'))
  this.notice = { text: `限界突破！\n${TIP.limit}`, key: w.time, until: w.time + NOTICE * 2 };
```

（子の端末の 3 択は親から届くので、届いた 3 択を出すところ（`offer` を受けるところ）にも同じ 2 行を足す。）

- [ ] **Step 4: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors && pnpm check`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/animal-survivors
git commit -m "Add relic, shrine, union and limit achievements, relic hints in the book and first-time tips"
```

---

### Task 5: 文書と仕上げ

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: CLAUDE.md を直す**

アニマルサバイバーの段落で次を直す。

- 「実績は `achievements.ts` の 48 個の表」を 53 個に。
- 遺物の文のあとに「図鑑の遺物のタブは、まだ拾っていない遺物に `relicHint()` の手がかり（ステージ・画面の上を北とした 8 方位・遠さ）を出す。合体・遺物・祠・限界突破が初めて起きたときだけ、`Prompts` が帯にひとこと説明を足す（出したかは記録の `tips`、端末ごと）。」を足す。
- 合わせ技の文に「芽吹きの森のツタと炎の疾走の炎は合体武器 1 つにつき 24 個まで（`TWIST_ZONES`）」、限界突破の文に「待ち時間は元の 4 割まで（`COOL_FLOOR`）」、障害物の文に「ヌシは押し出しの丸を半径 16 まで（`CHIEF_PUSH`）」、品の文に「どちらの動物からも画面の対角線 3 つぶん以上離れた品は消す（宝箱・券・遺物・大袋は残す）」、協力プレイの文に「画面が隠れたら一時停止を頼み、子は選ぶ画面（`Prompts.picking`）のあいだだけ動きを止め、親の ✕ は延長戦を聞く画面では進まないを選ぶ（`coop-quit.ts`）」を足す。

- [ ] **Step 2: まとめて確かめる**

Run: `pnpm verify > <workspace>/verify.txt 2>&1; tail -40 <workspace>/verify.txt`
Expected: すべて通る

- [ ] **Step 3: 画面で確かめる**

一時的に Play.svelte に `__w` を入れ（コミットしない）、合体の宝箱・一時停止の「+」・図鑑の遺物の手がかり・初めての祠の帯を撮る。

- [ ] **Step 4: コミット**

```bash
git add CLAUDE.md
git commit -m "Describe the Animal Survivors polish"
```

- [ ] **Step 5: 枝全体の見直し（opus）と、Critical / Important の直し**

- [ ] **Step 6: 写真を利用者に送り、main への push を聞く**
