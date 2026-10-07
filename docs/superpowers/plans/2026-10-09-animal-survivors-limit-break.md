# アニマルサバイバー 限界突破 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 武器とパッシブが全部埋まったあとの 3 択と宝箱を、持っている武器の能力を 1 つずつ上げ続ける限界突破の札にする。

**Architecture:** DOM を使わない `limit.ts` が、能力の種類・上がり幅・武器ごとに出る能力・重みつきの引き方・上げた回数を武器の数値に掛ける `limitStats()` を持つ。上げた回数は武器の枠（`World.weapons` の 1 つ）の `limit` に能力ごとに持ち、`arms.ts` が撃つときと合わせ技の数値に掛ける。札の文は 3 択と宝箱で共用する `choice-view.ts` に移す。

**Tech Stack:** TypeScript、Svelte 5、vitest

**Spec:** `docs/superpowers/specs/2026-10-09-animal-survivors-limit-break-design.md`

## Global Constraints

- 武器とパッシブが全部 Lv の上限まで埋まると、3 択と宝箱の中身は「持っている武器 1 つ × 能力 1 つ」の限界突破の札。武器は進化形・合体武器・専用進化形も含む
- 上限なし。上がり幅は一定（ダメージ +10%・待ち時間 −5%（掛け算）・大きさ +8%・速さ +10%・時間 +10%・数 +1）
- 速さは動く攻撃だけ、時間は残る攻撃だけ。数はほかより出にくい
- 「最大 HP +10 と全回復」は候補に残す（肉が出ない回は回復なし）。「攻撃 +5%」と「コイン +20」はなくす
- 札に上げる武器・能力・今までに上げた回数（「今 +3 → +4」）
- 引き直す・飛ばすは使える。除外は出さない
- 合体武器は上げた能力が 2 つの部品の両方に効く
- 一時停止の武器の並びに上げた回数の合計「+12」
- 協力プレイは動物ごとに自分の武器を上げる
- コードコメントは非自明な WHY だけ。コンポーネントは 200 行未満（`LevelUp.svelte` は今 199 行）

## Review Focus

- 同じ武器の別の能力が 3 択に 2 枚並んでも、Svelte の each の key が重ならない（Task 3 のテスト）
- 札がすべて限界突破のときも引き直すが出る（今は「全部ごほうびなら引き直しを出さない」ので、限界突破を例外にする。Task 3 のテスト）
- 協力プレイの子の端末の一時停止にも「+12」が出る（snap の武器の行に回数を運ぶ。Task 2 のテスト）
- 合体武器の合わせ技（雷・ツタ・炎・骨・回るブーメラン）にも、上げたダメージが効く（Task 2 のテスト）
- 古い版の端末とつながない（snap の形を変えるので `COOP_VERSION` を 3 に。Task 2 のテスト）

---

## ファイルの分け方

| ファイル                                             | 役目                                                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `limit.ts`（新）                                     | `LIMIT_STATS`・`STEP`・`statsFor()`・`limitStats()`・`limitCards()`・`limitTotal()`・`LIMIT_TEXT` |
| `choices.ts`                                         | `Choice` に `limit`、全部埋まったときの札、`levelUp` で上げる、攻撃とコインの札を消す             |
| `chest.ts`                                           | 上げるものが無いときの中身を限界突破に                                                            |
| `arms.ts`                                            | 撃つときと合わせ技の数値に掛ける                                                                  |
| `world.ts`                                           | 武器の型に `limit`、`Owned` に `lb`、`summary`                                                    |
| `snap.ts`                                            | 武器の行に回数、`COOP_VERSION` を 3                                                               |
| `choice-view.ts`（新）                               | 3 択と宝箱の札の文（`LevelUp.svelte` の `info` と `rewards.ts` をまとめる）                       |
| `LevelUp.svelte`・`ChestOpen.svelte`・`Pause.svelte` | 札の文の読み口、each の key、引き直し、「+12」                                                    |
| `rewards.ts`                                         | `choice-view.ts` へ移して消す                                                                     |
| `CLAUDE.md`                                          | 全部埋まったあとのごほうびの文を限界突破に書き換え                                                |

---

### Task 1: limit.ts

**Files:**

- Create: `src/lib/games/animal-survivors/limit.ts`
- Create: `src/lib/games/animal-survivors/limit.test.ts`

**Interfaces:**

- Produces。
  - `type LimitStat = 'damage' | 'cooldown' | 'area' | 'speed' | 'duration' | 'amount'`
  - `LIMIT_STATS: LimitStat[]`（この並びで snap に書く）
  - `type Limit = Partial<Record<LimitStat, number>>`
  - `statsFor(def: WeaponDef): LimitStat[]`（合体武器は 2 つの部品の種類から）
  - `limitStats(s: WeaponStats, limit: Limit | undefined): WeaponStats`（新しい値を返す）
  - `limitTotal(limit: Limit | undefined): number`
  - `limitCards(w: World, n: number): Choice[]`（`Choice` は Task 2 で足す `{ kind: 'limit'; id: string; stat: LimitStat; now: number }` と `vigor`）
  - `LIMIT_TEXT: Record<LimitStat, string>`（「ダメージ +10%」など）

- [ ] **Step 1: 失敗するテストを書く**

`limit.test.ts`。

```ts
import { describe, expect, it } from 'vitest';
import { limitStats, limitTotal, statsFor } from './limit';
import { WEAPONS, weaponStats } from './weapons';

describe('限界突破の能力', () => {
  it('ダメージ・待ち時間・大きさ・数はどの武器にも、速さは動く攻撃、時間は残る攻撃だけ', () => {
    expect(statsFor(WEAPONS.woof)).toEqual(['damage', 'cooldown', 'area', 'speed', 'amount']);
    expect(statsFor(WEAPONS.flame)).toEqual(['damage', 'cooldown', 'area', 'duration', 'amount']);
    expect(statsFor(WEAPONS.feather)).toEqual(['damage', 'cooldown', 'area', 'speed', 'duration', 'amount']);
    expect(statsFor(WEAPONS.howl)).toEqual(['damage', 'cooldown', 'area', 'amount']);
  });

  it('合体武器は 2 つの部品の種類から選ぶ', () => {
    // 炎の疾走はダッシュ（動く）と炎（残る）
    expect(statsFor(WEAPONS.flameUn)).toEqual(['damage', 'cooldown', 'area', 'speed', 'duration', 'amount']);
  });

  it('上げた回数を一定の幅で掛け、待ち時間は掛け算で縮む', () => {
    const s = weaponStats(WEAPONS.woof, 5);
    const t = limitStats(s, { damage: 3, cooldown: 2, area: 1, speed: 1, duration: 1, amount: 2 });
    expect(t.damage).toBeCloseTo(s.damage * 1.3);
    expect(t.cooldown).toBeCloseTo(s.cooldown * 0.95 ** 2);
    expect(t.area).toBeCloseTo(s.area * 1.08);
    expect(t.speed).toBeCloseTo(s.speed * 1.1);
    expect(t.duration).toBeCloseTo(s.duration * 1.1);
    expect(t.amount).toBe(s.amount + 2);
    expect(limitStats(s, undefined)).toEqual(s);
  });

  it('合計の回数', () => {
    expect(limitTotal({ damage: 3, amount: 2 })).toBe(5);
    expect(limitTotal(undefined)).toBe(0);
  });
});
```

（引き方のテストは、World と `Choice` がそろう Task 2 で書く。）

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/limit.test.ts`
Expected: FAIL（`./limit` が無い）

- [ ] **Step 3: 実装する**

`limit.ts`。

```ts
import type { WeaponDef, WeaponKind, WeaponStats } from './weapons';
import { partDef } from './weapons';

export type LimitStat = 'damage' | 'cooldown' | 'area' | 'speed' | 'duration' | 'amount';
/** snap に書く並びでもある */
export const LIMIT_STATS: LimitStat[] = ['damage', 'cooldown', 'area', 'speed', 'duration', 'amount'];
export type Limit = Partial<Record<LimitStat, number>>;

/** 1 回の上がり幅。待ち時間は掛け算で縮める（足し引きだと 0 を下回る） */
export const STEP = { damage: 0.1, cooldown: 0.05, area: 0.08, speed: 0.1, duration: 0.1, amount: 1 };

export const LIMIT_TEXT: Record<LimitStat, string> = {
  damage: 'ダメージ +10%',
  cooldown: '待ち時間 −5%',
  area: '大きさ +8%',
  speed: '速さ +10%',
  duration: '時間 +10%',
  amount: '数 +1'
};

const MOVING: WeaponKind[] = ['shot', 'boomerang', 'homing', 'orbit', 'nova'];
// 輪は時間をのばすと広がるのが遅くなるだけなので、残る攻撃に入れない
const LASTING: WeaponKind[] = ['orbit', 'trail', 'snare'];

export function statsFor(def: WeaponDef): LimitStat[] {
  const kinds = def.union ? [partDef(def, 0).kind, partDef(def, 1).kind] : [def.kind];
  return LIMIT_STATS.filter(
    (k) =>
      (k !== 'speed' || kinds.some((x) => MOVING.includes(x))) &&
      (k !== 'duration' || kinds.some((x) => LASTING.includes(x)))
  );
}

export function limitStats(s: WeaponStats, limit: Limit | undefined): WeaponStats {
  if (!limit) return s;
  const n = (k: LimitStat) => limit[k] ?? 0;
  return {
    ...s,
    damage: s.damage * (1 + STEP.damage * n('damage')),
    cooldown: s.cooldown * (1 - STEP.cooldown) ** n('cooldown'),
    area: s.area * (1 + STEP.area * n('area')),
    speed: s.speed * (1 + STEP.speed * n('speed')),
    duration: s.duration * (1 + STEP.duration * n('duration')),
    amount: s.amount + STEP.amount * n('amount')
  };
}

export const limitTotal = (limit: Limit | undefined) => LIMIT_STATS.reduce((sum, k) => sum + (limit?.[k] ?? 0), 0);
```

（`WeaponKind` が `weapons.ts` から export されていなければ export する。`limitCards` は Task 2 で足す。）

- [ ] **Step 4: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/limit.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/animal-survivors/limit.ts src/lib/games/animal-survivors/limit.test.ts src/lib/games/animal-survivors/weapons.ts
git commit -m "Add the limit break stats"
```

---

### Task 2: 札を引く・上げる・撃つときに掛ける・宝箱・snap

**Files:**

- Modify: `limit.ts`（`limitCards`）、`choices.ts`、`chest.ts`、`arms.ts`、`world.ts`、`snap.ts`
- Modify: `limit.test.ts`、`coop.test.ts`、それに攻撃とコインの札を見ているテスト（`rewards.test.ts` ほか、Step 2 で落ちたもの）

**Interfaces:**

- Consumes: Task 1 のすべて
- Produces。
  - `Choice` に `{ kind: 'limit'; id: string; stat: LimitStat; now: number }`（`now` は上げる前の回数）
  - `Reward`（`chest.ts`）に同じ形
  - 武器の型 `(Owned & { cd: number; cd2?: number; limit?: Limit })`
  - `Owned.lb?: number`（`summary` の武器の上げた回数の合計）
  - `twistAt()` の戻り値に `limit: Limit | undefined`
  - `COOP_VERSION = 3`

- [ ] **Step 1: 失敗するテストを書く**

`limit.test.ts` に足す。

```ts
import { fire, hits } from './arms';
import { openChest } from './chest';
import { apply, choices } from './choices';
import { ENEMIES } from './enemies';
import { MAX_LEVEL } from './weapons';
import { PASSIVES, maxOf } from './passives';
import { createWorld, makeEnemy, summary, type World } from './world';

const VIEW = { w: 260, h: 380 };

/** 武器もパッシブも全部埋まった World */
function full(weapons = ['woof', 'paw', 'howl', 'boomerang', 'acorn', 'dash']): World {
  const w = createWorld('dog', 1, VIEW);
  w.weapons = weapons.map((id) => ({ id, level: MAX_LEVEL, cd: 0 }));
  w.passives = Object.keys(PASSIVES)
    .slice(0, 6)
    .map((id) => ({ id, level: maxOf(id) }));
  return w;
}

describe('限界突破の札', () => {
  it('全部埋まると、3 択は持っている武器の限界突破と最大 HP の札だけになる', () => {
    const w = full();
    for (let i = 0; i < 50; i++)
      for (const c of choices(w)) {
        expect(['limit', 'vigor']).toContain(c.kind);
        if (c.kind === 'limit') expect(w.weapons.map((o) => o.id)).toContain(c.id);
      }
  });

  it('同じ 3 択に同じ武器の同じ能力は 2 枚出ない', () => {
    const w = full(['woof']);
    for (let i = 0; i < 50; i++) {
      const keys = choices(w).map((c) => (c.kind === 'limit' ? `${c.id}:${c.stat}` : c.kind));
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('数の札はほかの能力より出にくい', () => {
    const w = full();
    const count: Record<string, number> = {};
    for (let i = 0; i < 3000; i++)
      for (const c of choices(w)) if (c.kind === 'limit') count[c.stat] = (count[c.stat] ?? 0) + 1;
    expect(count.amount).toBeLessThan(count.damage * 0.5);
  });

  it('選ぶと、その武器のその能力の回数が 1 つ上がり、札には上げる前の回数が出る', () => {
    const w = full(['woof']);
    w.pending = 2;
    const pick = () => choices(w).find((c) => c.kind === 'limit' && c.stat === 'damage');
    let c = pick();
    while (!c) c = pick();
    expect(c).toMatchObject({ id: 'woof', stat: 'damage', now: 0 });
    apply(w, c);
    expect(w.weapons[0].limit?.damage).toBe(1);
    c = pick();
    while (!c) c = pick();
    expect(c).toMatchObject({ now: 1 });
  });

  it('上げたダメージは撃った弾に効き、合体武器の 2 つめの部品にも効く', () => {
    const shotDamage = (limit?: { damage: number }) => {
      const w = full(['howlUn']);
      w.weapons[0] = { id: 'howlUn', level: MAX_LEVEL, cd: 0, cd2: 0, limit };
      w.enemies.push(makeEnemy(ENEMIES.caterpillar, 30, 0, 1e9));
      w.grid.clear();
      w.enemies.forEach((e, i) => w.grid.add(i, e.x, e.y));
      w.stats.crit = 0;
      fire(w, 1 / 60);
      hits(w, 1 / 60);
      return w.dealt.howlUn?.damage ?? 0;
    };
    expect(shotDamage({ damage: 5 })).toBeCloseTo(shotDamage() * 1.5, 0);
  });

  it('全部埋まった宝箱の中身も限界突破（か最大 HP）になる', () => {
    const w = full();
    w.chests = 1;
    for (const r of openChest(w)) expect(['limit', 'vigor']).toContain(r.kind);
  });

  it('攻撃 +5% とコイン +20 の札はもう出ない', () => {
    const w = full();
    for (let i = 0; i < 100; i++) for (const c of choices(w)) expect(['power', 'gold']).not.toContain(c.kind);
  });

  it('リザルトと一時停止のまとめに、武器ごとの上げた回数の合計が入る', () => {
    const w = full(['woof']);
    w.weapons[0].limit = { damage: 3, amount: 1 };
    expect(summary(w).weapons[0].lb).toBe(4);
  });
});
```

（`w.dealt` は `damageEnemy` が武器の id で数える。合体武器の 2 つめの部品の雷も `howlUn` で数えるので、2 つの部品の合計が 1.5 倍になる。ふつうに当たらない回があれば、`fire` の前に `w.weapons[0].cd2 = 0` を確かめ、敵を増やして台帳に書く。）

`coop.test.ts` の `describe('協力プレイのつなぎ'` に足す。

```ts
it('子の端末にも、武器ごとの限界突破の回数が届く', async () => {
  const { g, w, h } = await started();
  w.heroes[1].weapons[0].limit = { damage: 2, cooldown: 1 };
  h.after(0.06);
  await settle();
  g.frame(performance.now() + 1000);
  const v = g.view!;
  expect(v.heroes[v.cur].weapons[0].limit).toEqual({ damage: 2, cooldown: 1 });
});
```

`coop.test.ts` の版のテストの 2 を 3 にする。

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors`
Expected: 新しいテストが FAIL。前からの、攻撃 +5%・コイン +20 の札を見ているテストも落ちる（どのテストかを台帳に書く）

- [ ] **Step 3: 実装する**

`limit.ts` に足す。

```ts
import type { Choice } from './choices';
import { noMeat } from './drops';
import { WEAPONS } from './weapons';
import type { World } from './world';

/** 数は 1 回の伸びが大きいので出にくくする */
const WEIGHT: Record<LimitStat, number> = { damage: 1, cooldown: 1, area: 1, speed: 1, duration: 1, amount: 0.3 };

/** 全部埋まったあとの札。持っている武器 × 出る能力と、最大 HP の札から、重みで n 枚を重ならずに引く */
export function limitCards(w: World, n: number): Choice[] {
  const pool: { c: Choice; weight: number }[] = [{ c: { kind: 'vigor', heal: !noMeat(w) }, weight: 1 }];
  for (const o of w.weapons)
    for (const stat of statsFor(WEAPONS[o.id]))
      pool.push({ c: { kind: 'limit', id: o.id, stat, now: o.limit?.[stat] ?? 0 }, weight: WEIGHT[stat] });
  const out: Choice[] = [];
  while (out.length < n && pool.length) {
    let r = w.rand() * pool.reduce((s, p) => s + p.weight, 0);
    const i = pool.findIndex((p) => (r -= p.weight) < 0);
    out.push(pool.splice(i < 0 ? pool.length - 1 : i, 1)[0].c);
  }
  return out;
}
```

（`limit.ts` → `choices.ts` は型だけなので循環しない。`drops.ts` の `noMeat` で循環して落ちたら、`vigor` の `heal` を `choices.ts` の側で付ける。）

`choices.ts`。

- `Choice` の `power`・`gold` の行を消し、`| { kind: 'limit'; id: string; stat: LimitStat; now: number }` を足す。コメント「全部埋まったあとのごほうび。…」を「全部埋まったあとの札。限界突破と、最大 HP +10 と全回復（heal が false なら回復なし）」にする。
- `REWARDS`・`rewardsFor`・`POWER`・`GOLD` を消す（`VIGOR` は残す）。
- `choices()` の `if (list.length === 0) return rewardsFor(w);` を `if (list.length === 0) return limitCards(w, n);` にする。
- `levelUp` の `power`・`vigor` の枝を `vigor` だけにし、`gold` の枝を消して、`limit` の枝を足す。

```ts
  } else if (c.kind === 'limit') {
    const own = w.weapons.find((o) => o.id === c.id);
    if (own) own.limit = { ...own.limit, [c.stat]: (own.limit?.[c.stat] ?? 0) + 1 };
  } else if (c.kind === 'vigor') {
    w.boost = { ...w.boost, maxHp: (w.boost.maxHp ?? 0) + VIGOR / hpScaleOf(w) };
    w.stats = stats(w.animal, w.passives, w.boost, w.form, hpScaleOf(w));
    if (c.heal !== false) p.hp = w.stats.maxHp;
  }
```

（`isFiller` は weapon と passive 以外を札の埋め草とするので、限界突破も除外の対象から外れる。そのままにする。）

`chest.ts`。

- `Reward` の `| { kind: 'power' | 'gold' }` を消し、`| { kind: 'limit'; id: string; stat: LimitStat; now: number }` を足す。
- `rewardsFor(w)[Math.floor(w.rand() * 3)]` を `limitCards(w, 1)[0]` にする。

`world.ts`。

- `Owned` に `/** summary の武器だけ: 限界突破で上げた回数の合計 */ lb?: number;`。
- 武器の型を `(Owned & { cd: number; cd2?: number; limit?: Limit })[]`。
- `summary` の `weapons: w.weapons.map(({ id, level }) => ({ id, level })),` を `weapons: w.weapons.map(({ id, level, limit }) => ({ id, level, ...(limitTotal(limit) && { lb: limitTotal(limit) }) })),` にする。

`arms.ts`。

- `twistAt` の戻り値に `limit: own.limit` を足す（型も `limit: Limit | undefined`）。
- `partStats(w, def, k)` を `partStats(w, def, k, limit?: Limit)` にし、`weaponStats(...)` の結果を `limitStats(..., limit)` に通す。呼ぶところ（合わせ技の 6 か所）に `tw.limit` を渡す。
- `fireOne(w, def, level, slot)` に `limit?: Limit` を足し、`const s = limitStats(weaponStats(def, level), limit);` にする。`fire` から `own.limit` を渡す。

`snap.ts`。

- `COOP_VERSION` を 3。
- 武器の行を `h.weapons.map((o) => `${o.id}:${o.level}:${LIMIT_STATS.map((k) => o.limit?.[k] ?? 0).join('.')}`).join(',')` にする（パッシブは今のまま）。
- 読むときは、武器だけ `limit` を読む口を足す。

```ts
/** 武器の行は id:level:回数.回数…（回数は LIMIT_STATS の並び） */
const parsedWeapons = (s: string) =>
  s
    ? s.split(',').map((x) => {
        const [id, level, counts] = x.split(':');
        const limit: Limit = {};
        (counts ?? '').split('.').forEach((v, i) => {
          if (Number(v) > 0) limit[LIMIT_STATS[i]] = Number(v);
        });
        return { id, level: Number(level), cd: 0, ...(Object.keys(limit).length && { limit }) };
      })
    : [];
```

`h.weapons = parsed(r[14] as string).map((o) => ({ ...o, cd: 0 }));` を `h.weapons = parsedWeapons(r[14] as string);` にする。（武器の id に `:` は無い。今の `parsed` は id の中の `:` に備えて `lastIndexOf` を使っているが、武器の id は英数字だけ。）

攻撃 +5%・コイン +20 を見ていた前からのテストは、限界突破の札を見るように直す（「全部埋まったら REWARDS」を確かめているものは、`limit` と `vigor` だけが出ることを確かめる形にする）。直したテストは台帳に 1 行ずつ書く。

- [ ] **Step 4: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors`
Expected: `rewards.ts`・`LevelUp.svelte`・`ChestOpen.svelte` が `power`・`gold` を読んでいて `pnpm check` が落ちるのは Task 3 で直す。vitest は PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/animal-survivors
git commit -m "Draw limit break cards once everything is maxed, raise weapon stats with them and send the counts to the guest"
```

---

### Task 3: 札の文・3 択・宝箱・一時停止

**Files:**

- Create: `src/lib/games/animal-survivors/choice-view.ts`
- Delete: `src/lib/games/animal-survivors/rewards.ts`
- Modify: `LevelUp.svelte`、`ChestOpen.svelte`、`Pause.svelte`
- Modify: `LevelUp.svelte.test.ts`、`Pause.svelte.test.ts`、`ChestOpen.svelte.test.ts`

**Interfaces:**

- Consumes: `Choice`・`Reward` の `limit`（Task 2）、`LIMIT_TEXT`（Task 1）
- Produces: `cardInfo(c: Choice | Reward): { art: Art; name: string; tag: string; text: string; evo: boolean }`、`cardKey(c: Choice): string`

- [ ] **Step 1: 失敗するテストを書く**

`LevelUp.svelte.test.ts` に足す（このファイルの mount の形を写す）。

```ts
it('限界突破の札は、武器の名前・能力・回数を出し、同じ武器の札が並んでも出せ、引き直すも出る', () => {
  const target = document.body.appendChild(document.createElement('div'));
  const options = [
    { kind: 'limit' as const, id: 'woof', stat: 'damage' as const, now: 3 },
    { kind: 'limit' as const, id: 'woof', stat: 'cooldown' as const, now: 0 },
    { kind: 'vigor' as const }
  ];
  const app = mount(LevelUp, {
    target,
    props: {
      options,
      locked: false,
      tools: { rerolls: 2, skips: 0, banishes: 3 },
      onpick: () => {},
      ontool: () => {},
      onbanish: () => {}
    }
  });
  flushSync();
  const text = target.textContent ?? '';
  expect(text).toContain('ワンワンショット');
  expect(text).toContain('ダメージ +10%');
  expect(text).toContain('+3 → +4');
  expect(text).toContain('待ち時間 −5%');
  expect(text).toContain('引き直す 2');
  expect(text).not.toContain('除外');
  unmount(app);
});
```

`Pause.svelte.test.ts` に、まとめの武器に `lb: 12` があると武器の並びに「+12」が出るテストを足す（このファイルの今のテストの `run` の作り方を写し、`run.weapons[0].lb = 12` にして `textContent` に `+12` を探す）。

`ChestOpen.svelte.test.ts` に、`rewards: [{ kind: 'limit', id: 'woof', stat: 'area', now: 0 }]` で中身に「大きさ +8%」が出るテストを足す（このファイルの今のテストの mount と、ふたが開くまで待つ形を写す）。

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/LevelUp.svelte.test.ts src/lib/games/animal-survivors/Pause.svelte.test.ts src/lib/games/animal-survivors/ChestOpen.svelte.test.ts`
Expected: 新しいテストが FAIL

- [ ] **Step 3: 実装する**

`choice-view.ts`（`LevelUp.svelte` の `info` と `rewards.ts` の `reward` をまとめ、宝箱の中身の文も同じ口で出す）。

```ts
import { itemArt } from './art/evolved';
import { ITEM_ART } from './art/items';
import type { Reward } from './chest';
import { VIGOR, type Choice } from './choices';
import { LIMIT_TEXT } from './limit';
import { PASSIVES } from './passives';
import { upText, WEAPONS } from './weapons';

/** 3 択と宝箱の札の絵・名前・印・文 */
export function cardInfo(c: Choice | Reward) {
  if (c.kind === 'weapon') {
    const d = WEAPONS[c.id];
    const fresh = c.level === 1;
    return {
      art: itemArt(`weapon-${c.id}`),
      name: d.name,
      tag: fresh ? 'NEW' : `Lv ${c.level}`,
      text: fresh ? d.blurb : upText(d, c.level),
      evo: ('evo' in c && c.evo) || false
    };
  }
  if (c.kind === 'passive') {
    const d = PASSIVES[c.id];
    return {
      art: itemArt(`passive-${c.id}`),
      name: d.name,
      tag: c.level === 1 ? 'NEW' : `Lv ${c.level}`,
      text: d.blurb,
      evo: ('evo' in c && c.evo) || false
    };
  }
  if (c.kind === 'limit')
    return {
      art: itemArt(`weapon-${c.id}`),
      name: WEAPONS[c.id].name,
      tag: '限界突破',
      text: `${LIMIT_TEXT[c.stat]}（今 +${c.now} → +${c.now + 1}）`,
      evo: false
    };
  if (c.kind === 'meat') return { art: ITEM_ART.meat, name: '肉', tag: '', text: 'HP を 30% 回復', evo: false };
  if (c.kind === 'vigor')
    return {
      art: itemArt('passive-heart'),
      name: '元気のみなもと',
      tag: '',
      text: c.heal !== false ? `最大 HP +${VIGOR} と全回復` : `最大 HP +${VIGOR}`,
      evo: false
    };
  return { art: ITEM_ART.chest, name: '経験値の袋', tag: '', text: '経験値 +25', evo: false };
}

/** 同じ武器の別の能力が並んでも重ならない key */
export const cardKey = (c: Choice) =>
  c.kind === 'limit' ? `limit-${c.id}-${c.stat}` : c.kind + ('id' in c ? c.id : '');
```

（宝箱の `evolve`・`union` は今の `ChestOpen.svelte` の `info` の枝のまま残し、それ以外を `cardInfo` に任せる。）

`LevelUp.svelte`。

- `import { reward } from './rewards';` と `upText` と `info` 関数を消し、`import { cardInfo, cardKey } from './choice-view';`。`{@const d = info(c)}` を `{@const d = cardInfo(c)}`、`{#each options as c, i (c.kind + ('id' in c ? c.id : ''))}` を `{#each options as c, i (cardKey(c))}` にする。
- `const rerolls = $derived(options.every(isFiller) ? 0 : tools.rerolls);` を `const rerolls = $derived(options.every((c) => isFiller(c) && c.kind !== 'limit') ? 0 : tools.rerolls);` にし、上のコメントを「限界突破の札は引き直せば別の能力が出るので、ほかの埋め草の札だけのときに出さない」に直す。
- 札の印の CSS（`.tag.new` の隣）に `.tag` の「限界突破」用の色が要れば `.tag.limit` を足し、`class:limit={d.tag === '限界突破'}` を付ける。

`ChestOpen.svelte` の `info` で、`weapon`・`passive`・`meat`・`bag`・`vigor`・`limit` を `cardInfo(r)` に任せ（`evolve`・`union` だけ今の枝）、`import { reward } from './rewards';` を消す。

`rewards.ts` を消す（`git rm`）。

`Pause.svelte` の武器の並びで、`o.lb` があれば Lv の字のうしろに `+{o.lb}` を出す。

```svelte
              >{:else}{o.star ? '★' : o.level}{/if}{#if o.lb}<span class="lb">+{o.lb}</span>{/if}</span
```

`.lb` は小さめの字（Lv の字と同じ色で 0.8em）にする。

- [ ] **Step 4: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors && pnpm check`
Expected: PASS、型の誤り 0（`LevelUp.svelte` が 200 行未満であることも `wc -l` で確かめる）

- [ ] **Step 5: コミット**

```bash
git add -A src/lib/games/animal-survivors
git commit -m "Show limit break cards in the level-up and chest screens and their counts in the pause menu"
```

---

### Task 4: ボットで確かめる

**Files:**

- Create（scratchpad、リポジトリには入れない）: `<scratchpad>/sim/limit.sim.ts`

- [ ] **Step 1: 比べる元を用意する**

今の main（限界突破の前）を scratchpad に `git worktree add --detach <scratchpad>/base origin/main` で出し、`node_modules` を symlink する（memory の `animal-survivors-status` の「古い版との比べ」）。

- [ ] **Step 2: シミュレーションを書く**

scratchpad の今の sim（`sim/explore.sim.ts`）を写して `limit.sim.ts` にし、次を変える。

- import の道を `process.env.ROOT`（今の木か base）から作る
- クリアしたら延長戦へ進み（`startOvertime`）、倒れるまで遊ぶ
- 3 択の選び方は、限界突破の札ならダメージ・待ち時間・数を先に取り、無ければ最初の札
- 結果に `{ animal, seed, cleared, overtime: w.time - 600, coins: summary(w).coins, lb: 合計の回数 }`

- [ ] **Step 3: 回す**

森、店を全部、動物 `dog,fox,panda`、`SEEDS=12` を、今の木と base で 1 本ずつ。

- [ ] **Step 4: 比べて決める**

- 延長戦の秒の平均と 1 回のコインの平均を比べる。限界突破の側が 1.5 倍を超えるなら、`STEP` のダメージを 0.05、数の重みを 0.15 に下げて回し直す（それでも超えたら利用者に数字を見せて聞く）
- 数字と決めたことを台帳に書く
- 終わったら `git worktree remove <scratchpad>/base`

- [ ] **Step 5: コミット**（`STEP` か重みを変えたときだけ）

```bash
git add src/lib/games/animal-survivors/limit.ts
git commit -m "Tune the limit break steps from the bot runs"
```

---

### Task 5: 文書と仕上げ

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: CLAUDE.md を直す**

アニマルサバイバーの段落の「武器もパッシブも全部埋まると、3 択と宝箱の中身は「その回だけ攻撃 +5%（重なる）」「最大 HP +10 と全回復」（肉が出ない回は全回復なし、`rewardsFor()`）「コイン +20」のごほうび（`choices.ts` の `REWARDS`。ごほうびだけの 3 択では引き直しと除外を出さない。攻撃と HP は `World.boost` に足すので、パッシブや育ちで能力を作り直しても残る）になる。」を、次に置き換える。

```
武器もパッシブも全部埋まると、3 択と宝箱の中身は限界突破（`limit.ts`）になる。持っている武器（進化形・合体武器・専用進化形も）1 つ × 能力 1 つ（ダメージ +10%・待ち時間 −5% の掛け算・大きさ +8%・速さ +10%（動く攻撃）・時間 +10%（羽根・炎・ツタ）・数 +1（出にくい））を上限なく上げ、回数は武器の枠の `limit` に持って、撃つときと合わせ技の数値に `limitStats()` で掛ける（合体武器は 2 つの部品の両方）。「最大 HP +10 と全回復」（肉が出ない回は全回復なし。`World.boost` に足す）も同じ候補から引く。限界突破の札は引き直す・飛ばすが使え、除外は出さない。札の文は 3 択と宝箱で共用の `choice-view.ts`、一時停止の武器の並びに上げた回数の合計（`summary` の `lb`）を出し、協力プレイの snap は武器の行に能力ごとの回数を運ぶ。
```

（前の文の言い回しを読んで、置き換える範囲を確かめる。）

- [ ] **Step 2: まとめて確かめる**

Run: `pnpm verify > <workspace>/verify.txt 2>&1; tail -40 <workspace>/verify.txt`
Expected: すべて通る

- [ ] **Step 3: 画面で確かめる**

`obs/shot.mjs` と同じ形で（Play.svelte に一時的に `__w`。コミットしない）、武器とパッシブを全部埋めて Lv を上げ、限界突破の 3 択と、一時停止の「+N」を撮る。

- [ ] **Step 4: コミット**

```bash
git add CLAUDE.md
git commit -m "Describe the Animal Survivors limit break"
```

- [ ] **Step 5: 枝全体の見直し（opus）と、Critical / Important の直し**

- [ ] **Step 6: 写真を利用者に送り、main への push を聞く**
