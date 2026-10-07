# アニマルサバイバー 2 人の記録とごほうび 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 協力プレイの回のまとめに 2 人の数を足し、リザルトに「ふたりの活躍」、2 人のクリアにボーナス、記録に「ふたり」の欄と記録帳、実績を 5 つ足す。

**Architecture:** 数は World と Hero に足し（`Hero.raises`・`World.carried`）、`summary()` が `RunSummary.coop` にまとめる。ボーナスは `summary()` がクリアの回のコインと券に足し、延長戦の 2 回めの記録（`overtimeRun`）は延長戦のぶんの差だけを持つ。記録は `records.ts` の `Records.coop` に `record()` が足し、実績は `achievements.ts` の表に 5 行足す。画面は `CoopStats.svelte`（リザルト）と `CoopBook.svelte`（ふたりで遊ぶ画面）。称号は DOM を使わない `coop-stats.ts`。

**Tech Stack:** TypeScript、Svelte 5、vitest、playwright-core（画面の撮影）

**Spec:** `docs/superpowers/specs/2026-10-09-animal-survivors-coop-records-design.md`

## Global Constraints

- 1 人で遊ぶときは何も変えない（まとめに `coop` を入れない）
- 2 匹それぞれの倒した数・ダメージ（`dealt` の合計）・起こした回数、2 人で共通の連携の技の回数・運んだ重い宝箱の数
- 称号は「いちばん倒した」「いちばんダメージ」「いちばん助けた」。多いほうに付け、同じ数なら付けない
- 2 人で 10:00 をクリアしたときだけ、その回のコインに +20% と銅の券 1 枚。リザルトに「ふたりのボーナス」。延長戦のぶんには掛けない
- 記録の「ふたり」は、遊んだ回数・クリアした回数・いちばん長い生存の秒・起こした回数と連携の技と運んだ宝箱の合計・組み合わせ（並びの順によらない）。端末ごとに取る
- 記録帳は「ふたりで遊ぶ」の画面のつなぐ前のところ。組んだ 2 匹の顔を並べ、55 通りのうちいくつかを出す
- 実績 5 つ（ふたりでクリア 300・息ぴったり 200・たすけあい 200・はこびや 200・いろんな相棒 300）。53 → 58。見出し「ふたりで」
- `COOP_VERSION` は 5 のまま。古い記録は「ふたり」の欄を 0 と空で読む
- コードコメントは非自明な WHY だけ。コンポーネントは 200 行未満（`Result.svelte` は今 185 行、`CoopRoom.svelte` は 178 行）

## Review Focus

- 延長戦まで遊んだ回は、記録の「ふたり」の遊んだ回数・クリアの回数を 2 度数えず、連携の技と起こした回数は延長戦のぶんだけを 2 度めに足す（Task 2 のテスト）
- 子の端末のまとめ（`heroRun(w, 1)`）でも、`coop.me` が 1 になり、ボーナスは子の強欲で掛けた子のコインから出す（Task 1 のテスト）
- 途中で子が抜けた回は、2 人で遊んだ回に数えるが、クリアしてもボーナスは出さない（Task 1 のテスト）
- 壊れた「ふたり」の欄（型ちがい・知らない動物の組み合わせ）を読んでも落ちない（Task 2 のテスト）
- 1 人の回のリザルトに「ふたりの活躍」とボーナスが出ない（Task 3 のテスト）

---

### Task 1: その回の 2 人の数とボーナス

**Files:**

- Modify: `src/lib/games/animal-survivors/world.ts`（`World.raises`・`World.carried`、`RunSummary.coop`、`summary()`、`makeHero`、`createWorld`、`overtime.base` の型）
- Modify: `src/lib/games/animal-survivors/heroes.ts`（`HERO_KEYS` に `raises`、`raise()` が数える）
- Modify: `src/lib/games/animal-survivors/carry.ts`（届いたら `w.carried += 1`）
- Modify: `src/lib/games/animal-survivors/overtime.ts`（`base` に 2 人の数、`overtimeRun` が差にする）
- Test: `src/lib/games/animal-survivors/coop-records.test.ts`

**Interfaces:**

- Produces（`world.ts`）
  - `interface CoopRun { me: number; heroes: { animal: AnimalId; kills: number; damage: number; raises: number }[]; links: number; carries: number; bonus: number }`
  - `RunSummary.coop?: CoopRun`
  - `DUO_BONUS = 0.2`
  - `World.raises: number`（`HERO_KEYS`。その動物が相棒を起こした回数）、`World.carried: number`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/games/animal-survivors/coop-records.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { startCarry, stepCarry } from './carry';
import { heroRun } from './coop-run';
import { startOvertime } from './overtime';
import { overtimeRun } from './overtime';
import { addHero, createWorld, DUO_BONUS, step, summary, type World } from './world';

const VIEW = { w: 260, h: 380 };

function duo(): World {
  const w = createWorld('dog', 5, VIEW);
  addHero(w, 'cat');
  w.stage = { ...w.stage, waves: [] };
  w.spawnAcc = [];
  return w;
}

describe('その回の 2 人の数', () => {
  it('1 人の回のまとめには coop が入らない', () => {
    expect(summary(createWorld('dog', 1, VIEW)).coop).toBeUndefined();
  });

  it('2 匹それぞれの倒した数・ダメージ・起こした回数と、連携の技・運んだ数が入る', () => {
    const w = duo();
    w.heroes[0].dealt = { woof: { damage: 120.4, kills: 7 }, howl: { damage: 30, kills: 2 } };
    w.heroes[1].dealt = { paw: { damage: 50, kills: 3 } };
    w.heroes[1].down = true;
    w.heroes[1].player.hp = 0;
    w.heroes[0].player.x = 190;
    w.heroes[1].player.x = 200;
    for (let i = 0; i < 200 && w.heroes[1].down; i++) step(w, { x: 0, y: 0 }, 1 / 60);
    w.link.uses = 2;
    startCarry(w);
    const c = w.carry!;
    c.x = c.ax;
    c.y = c.ay;
    stepCarry(w, 0.01);
    const s = summary(w);
    expect(s.coop).toEqual({
      me: 0,
      heroes: [
        { animal: 'dog', kills: 9, damage: 150, raises: 1 },
        { animal: 'cat', kills: 3, damage: 50, raises: 0 }
      ],
      links: 2,
      carries: 1,
      bonus: 0
    });
  });

  it('子の端末のまとめでは me が 1 になる', () => {
    const w = duo();
    expect(heroRun(w, 1).part.coop?.me).toBe(1);
  });
});

describe('ふたりのボーナス', () => {
  it('2 人でクリアしたときだけ、その回のコインに 2 割と銅の券 1 枚が足される', () => {
    const w = duo();
    w.coins = 1000;
    w.over = 'clear';
    const base = summary(createWorldClear());
    const s = summary(w);
    expect(s.coop!.bonus).toBe(Math.floor((s.coins - s.coop!.bonus) * DUO_BONUS));
    expect(s.coop!.bonus).toBeGreaterThan(0);
    expect(s.tickets![0]).toBe(w.tickets[0] + 1);
    expect(base.coop).toBeUndefined();
  });

  it('倒れた回・子が抜けた回・延長戦の 2 回めにはボーナスが無い', () => {
    const dead = duo();
    dead.coins = 1000;
    dead.over = 'dead';
    expect(summary(dead).coop!.bonus).toBe(0);
    const left = duo();
    left.coins = 1000;
    left.heroes[1].gone = left.heroes[1].down = true;
    left.over = 'clear';
    expect(summary(left).coop!.bonus).toBe(0);
    const ot = duo();
    ot.coins = 1000;
    ot.over = 'clear';
    startOvertime(ot);
    ot.over = 'dead';
    expect(overtimeRun(ot).coop!.bonus).toBe(0);
  });

  it('子のボーナスは子の強欲で掛けた子のコインから出す', () => {
    const w = duo();
    w.coins = 1000;
    w.heroes[1].greed = 2;
    w.over = 'clear';
    const host = heroRun(w, 0).part;
    const guest = heroRun(w, 1).part;
    expect(guest.coop!.bonus).toBeGreaterThan(host.coop!.bonus);
  });

  it('延長戦の 2 回めのまとめは、連携の技と起こした回数を延長戦のぶんだけ持つ', () => {
    const w = duo();
    w.link.uses = 2;
    w.heroes[0].raises = 1;
    w.over = 'clear';
    startOvertime(w);
    w.link.uses = 3;
    w.heroes[0].raises = 4;
    w.over = 'dead';
    const c = overtimeRun(w).coop!;
    expect(c.links).toBe(1);
    expect(c.heroes[0].raises).toBe(3);
  });
});

function createWorldClear(): World {
  const w = createWorld('dog', 1, VIEW);
  w.coins = 1000;
  w.over = 'clear';
  return w;
}
```

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/coop-records.test.ts`
Expected: FAIL（`DUO_BONUS` が無い、`coop` が undefined）

- [ ] **Step 3: 実装する**

`world.ts`

1. `RunSummary` の `shrines?: number;` の下に足す。

```ts
  /** 協力プレイの回の 2 人の数（1 人の回には無い）。me はこのまとめの動物の番号 */
  coop?: CoopRun;
```

2. `RunSummary` の定義の上に足す。

```ts
export interface CoopRun {
  me: number;
  heroes: { animal: AnimalId; kills: number; damage: number; raises: number }[];
  links: number;
  carries: number;
  /** 2 人でクリアしたときに足したコイン（銅の券 1 枚もいっしょに足してある） */
  bonus: number;
}

/** 2 人でクリアした回のコインに足す割合 */
export const DUO_BONUS = 0.2;
```

3. `World` の `big: number;` の下に足す。

```ts
/** その動物が相棒を起こした回数 */
raises: number;
/** 2 匹で祭壇まで運んだ重い宝箱の数 */
carried: number;
```

4. `createWorld` の `carry: null,` の下に `carried: 0,` を、`makeHero` の `big: 0,` の下に `raises: 0,` を足す。
5. `overtime` の型の `base` の `tickets: number[];` の下に足す。

```ts
      links: number;
      raises: number[];
```

6. `summary()` を次の形にする（`return { ... }` を `const s: RunSummary = { ... }` にし、最後に足す）。

```ts
export function summary(w: World): RunSummary {
  const s: RunSummary = {
    // （今の中身のまま）
  };
  if (w.heroes.length < 2) return s;
  const duo = w.over === 'clear' && !w.overtime && w.heroes.every((h) => !h.gone);
  const bonus = duo ? Math.floor(s.coins * DUO_BONUS) : 0;
  s.coop = {
    me: w.cur,
    heroes: w.heroes.map((h) => {
      const d = Object.values(h.dealt);
      return {
        animal: h.animal.id,
        kills: d.reduce((n, x) => n + x.kills, 0),
        damage: Math.round(d.reduce((n, x) => n + x.damage, 0)),
        raises: h.raises
      };
    }),
    links: w.link.uses,
    carries: w.carried,
    bonus
  };
  if (bonus) {
    s.coins += bonus;
    s.tickets = [(s.tickets?.[0] ?? 0) + 1, s.tickets?.[1] ?? 0, s.tickets?.[2] ?? 0];
  }
  return s;
}
```

`heroes.ts`

1. `HERO_KEYS` の `'big',` の下に `'raises',` を足す。
2. `raise()` の `w.events.push({ type: 'raised', who: i, by });` の上に `w.heroes[by].raises += 1;` を足す。

`carry.ts` の届いたところの `addCoins(w, CARRY_COINS);` の下に `w.carried += 1;` を足す。

`overtime.ts`

1. `startOvertime` の `base: { ... }` の `tickets` の行の下に足す。

```ts
      links: w.link.uses,
      raises: w.heroes.map((h) => h.raises),
```

2. `overtimeRun` の `return { ...s, ... }` に足す。

```ts
    // 記録は 10:00 のクリアで 1 度入れているので、2 度めは延長戦のぶんの差だけにする
    ...(s.coop && {
      coop: {
        ...s.coop,
        links: s.coop.links - base.links,
        carries: 0,
        heroes: s.coop.heroes.map((h, i) => ({ ...h, raises: h.raises - (base.raises[i] ?? 0) })),
        bonus: 0
      }
    }),
```

- [ ] **Step 4: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/coop-records.test.ts`
Expected: PASS

Run: `pnpm test:run src/lib/games/animal-survivors && pnpm check`
Expected: 全部 PASS（まとめを丸ごと比べるテストが 2 匹の回で落ちたら、期待に `coop` を足す）

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/animal-survivors/world.ts src/lib/games/animal-survivors/heroes.ts src/lib/games/animal-survivors/carry.ts src/lib/games/animal-survivors/overtime.ts src/lib/games/animal-survivors/coop-records.test.ts
git commit -m "Count each hero's part in co-op runs and add the duo clear bonus

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 記録の「ふたり」と協力の実績

**Files:**

- Modify: `src/lib/games/animal-survivors/records.ts`（`Records.coop`、`emptyRecords`、`parseRecords`、`record()`）
- Modify: `src/lib/games/animal-survivors/achievements.ts`（5 行）
- Modify: `src/lib/games/animal-survivors/trophy-groups.ts`（見出し「ふたりで」）
- Modify: `src/lib/games/animal-survivors/progress.test.ts`（53 → 58）
- Test: `src/lib/games/animal-survivors/coop-records.test.ts`

**Interfaces:**

- Consumes: Task 1 の `RunSummary.coop`
- Produces（`records.ts`）
  - `interface CoopRecords { runs: number; clears: number; best: number; raises: number; links: number; carries: number; pairs: string[] }`
  - `Records.coop: CoopRecords`
  - `pairKey(a: AnimalId, b: AnimalId): string`（id の小さいほうを先に `a+b`）

- [ ] **Step 1: 失敗するテストを書く**

`coop-records.test.ts` の import に足す。

```ts
import { ACHIEVEMENTS } from './achievements';
import { emptyRecords, pairKey, parseRecords, record } from './records';
```

ファイルの末尾に足す。

```ts
describe('記録の「ふたり」', () => {
  it('回ごとに遊んだ回数・クリア・最長・起こした回数・連携・運んだ数・組み合わせが増える', () => {
    const r = emptyRecords();
    const w = duo();
    w.time = 300;
    w.link.uses = 2;
    w.heroes[0].raises = 1;
    w.heroes[1].raises = 2;
    w.carried = 1;
    record(r, summary(w));
    expect(r.coop).toEqual({
      runs: 1,
      clears: 0,
      best: 300,
      raises: 3,
      links: 2,
      carries: 1,
      pairs: [pairKey('dog', 'cat')]
    });
    const v = createWorld('cat', 2, VIEW);
    addHero(v, 'dog');
    v.over = 'clear';
    v.time = 600;
    record(r, summary(v));
    expect(r.coop.runs).toBe(2);
    expect(r.coop.clears).toBe(1);
    expect(r.coop.best).toBe(600);
    expect(r.coop.pairs).toHaveLength(1);
  });

  it('1 人の回では増えない', () => {
    const r = emptyRecords();
    record(r, summary(createWorld('dog', 1, VIEW)));
    expect(r.coop.runs).toBe(0);
  });

  it('延長戦の 2 回めの記録では、遊んだ回数とクリアを 2 度数えない', () => {
    const r = emptyRecords();
    const w = duo();
    w.link.uses = 2;
    w.over = 'clear';
    w.time = 600;
    record(r, summary(w));
    startOvertime(w);
    w.link.uses = 3;
    w.time = 700;
    w.over = 'dead';
    record(r, overtimeRun(w));
    expect(r.coop.runs).toBe(1);
    expect(r.coop.clears).toBe(1);
    expect(r.coop.links).toBe(3);
    expect(r.coop.best).toBe(700);
  });

  it('古い記録と壊れた欄は、0 と空で読み、知らない組み合わせは捨てる', () => {
    expect(parseRecords(JSON.stringify({ coins: 5 })).coop).toEqual(emptyRecords().coop);
    const r = parseRecords(
      JSON.stringify({ coop: { runs: 'x', clears: 2, pairs: ['cat+dog', 'dog+ufo', 3], best: -1 } })
    );
    expect(r.coop).toEqual({ ...emptyRecords().coop, clears: 2, pairs: ['cat+dog'] });
  });

  it('組み合わせは並びの順によらない', () => {
    expect(pairKey('dog', 'cat')).toBe(pairKey('cat', 'dog'));
    expect(pairKey('dog', 'dog')).toBe('dog+dog');
  });
});

describe('協力の実績', () => {
  const done = (id: string, r = emptyRecords()) => ACHIEVEMENTS.find((a) => a.id === id)!.done(r, null);

  it('5 つの条件', () => {
    const r = emptyRecords();
    expect(['coopClear', 'coopLink10', 'coopRaise10', 'coopCarry5', 'coopPairs10'].map((id) => done(id, r))).toEqual([
      false,
      false,
      false,
      false,
      false
    ]);
    r.coop = {
      runs: 3,
      clears: 1,
      best: 600,
      raises: 10,
      links: 10,
      carries: 5,
      pairs: Array.from({ length: 10 }, (_, i) => `p${i}`)
    };
    expect(['coopClear', 'coopLink10', 'coopRaise10', 'coopCarry5', 'coopPairs10'].map((id) => done(id, r))).toEqual([
      true,
      true,
      true,
      true,
      true
    ]);
  });
});
```

`progress.test.ts` の実績の数のテストを 58 にする。

```ts
  it('58 個あり、id は重ならない', () => {
    expect(ACHIEVEMENTS).toHaveLength(58);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(58);
```

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/coop-records.test.ts src/lib/games/animal-survivors/progress.test.ts`
Expected: FAIL（`pairKey` が無い、`r.coop` が undefined、実績が 53）

- [ ] **Step 3: 実装する**

`records.ts`

1. `Records` の `byAnimal: ...;` の下に足す。

```ts
/** 2 人で遊んだ記録（端末ごと） */
coop: CoopRecords;
```

2. `Records` の定義の上に足す。

```ts
export interface CoopRecords {
  runs: number;
  clears: number;
  /** 2 人で遊んだ回のいちばん長い生存の秒 */
  best: number;
  raises: number;
  links: number;
  carries: number;
  /** 組んだ 2 匹（pairKey） */
  pairs: string[];
}

const emptyCoop = (): CoopRecords => ({ runs: 0, clears: 0, best: 0, raises: 0, links: 0, carries: 0, pairs: [] });

/** 組み合わせの名前。どちらが親でも同じ組になるよう、id の並びを決める */
export const pairKey = (a: AnimalId, b: AnimalId) => (a <= b ? `${a}+${b}` : `${b}+${a}`);

function coopOf(v: unknown, ids: AnimalId[]): CoopRecords {
  if (!v || typeof v !== 'object') return emptyCoop();
  const c = v as Record<string, unknown>;
  const known = (p: unknown) => {
    if (typeof p !== 'string') return false;
    const [a, b] = p.split('+');
    return ids.includes(a as AnimalId) && ids.includes(b as AnimalId) && p === pairKey(a as AnimalId, b as AnimalId);
  };
  return {
    runs: Math.floor(num(c.runs)),
    clears: Math.floor(num(c.clears)),
    best: num(c.best),
    raises: Math.floor(num(c.raises)),
    links: Math.floor(num(c.links)),
    carries: Math.floor(num(c.carries)),
    pairs: Array.isArray(c.pairs) ? [...new Set(c.pairs.filter(known) as string[])] : []
  };
}
```

`num` が `coopOf` より下で定義されているときは、`coopOf` を `num` の定義の下に置く。

3. `emptyRecords` の `byAnimal: {}` を `byAnimal: {},` にし、その下に `coop: emptyCoop()` を足す。
4. `parseRecords` の `byAnimal: byAnimalOf(raw.byAnimal, ids),` の下に `coop: coopOf(raw.coop, ids),` を足す。
5. `record()` の `run.bookCoins = addBook(r, run);` の上に足す。

```ts
const c = run.coop;
if (c) {
  const o = r.coop;
  // 延長戦の 2 回めの記録（killsBefore がある）は、回とクリアを 10:00 の記録で数えてある
  if (run.killsBefore === undefined) {
    o.runs += 1;
    if (run.cleared) o.clears += 1;
  }
  o.best = Math.max(o.best, run.time);
  o.raises += c.heroes.reduce((n, h) => n + h.raises, 0);
  o.links += c.links;
  o.carries += c.carries;
  const key = pairKey(c.heroes[0].animal, c.heroes[1].animal);
  if (!o.pairs.includes(key)) o.pairs.push(key);
}
```

`achievements.ts` の `ACHIEVEMENTS` の終わりの `];` の上に足す。

```ts
  { id: 'coopClear', name: 'ふたりでクリア', coins: 300, done: (r) => r.coop.clears >= 1 },
  {
    id: 'coopLink10',
    name: '息ぴったり（連携の技を合計 10 回）',
    coins: 200,
    done: (r) => r.coop.links >= 10,
    progress: (r) => [Math.min(r.coop.links, 10), 10]
  },
  {
    id: 'coopRaise10',
    name: 'たすけあい（相棒を合計 10 回起こす）',
    coins: 200,
    done: (r) => r.coop.raises >= 10,
    progress: (r) => [Math.min(r.coop.raises, 10), 10]
  },
  {
    id: 'coopCarry5',
    name: 'はこびや（重い宝箱を合計 5 つ運ぶ）',
    coins: 200,
    done: (r) => r.coop.carries >= 5,
    progress: (r) => [Math.min(r.coop.carries, 5), 5]
  },
  {
    id: 'coopPairs10',
    name: 'いろんな相棒（10 通りの組み合わせで遊ぶ）',
    coins: 300,
    done: (r) => r.coop.pairs.length >= 10,
    progress: (r) => [Math.min(r.coop.pairs.length, 10), 10]
  }
```

`trophy-groups.ts` の最後の見出しの下に足す。

```ts
['ふたりで', ['coopClear', 'coopLink10', 'coopRaise10', 'coopCarry5', 'coopPairs10']];
```

- [ ] **Step 4: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/coop-records.test.ts src/lib/games/animal-survivors/progress.test.ts src/lib/games/animal-survivors/trophy-groups.test.ts src/lib/games/animal-survivors/trophies.svelte.test.ts`
Expected: PASS

Run: `pnpm test:run src/lib/games/animal-survivors && pnpm check`
Expected: 全部 PASS（記録を丸ごと比べるテストが落ちたら、期待に `coop` を足す）

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/animal-survivors/records.ts src/lib/games/animal-survivors/achievements.ts src/lib/games/animal-survivors/trophy-groups.ts src/lib/games/animal-survivors/progress.test.ts src/lib/games/animal-survivors/coop-records.test.ts
git commit -m "Record co-op runs per device and add five co-op achievements

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: ふたりの活躍の枠と記録帳

**Files:**

- Create: `src/lib/games/animal-survivors/coop-stats.ts`（称号）
- Create: `src/lib/games/animal-survivors/CoopStats.svelte`
- Create: `src/lib/games/animal-survivors/CoopBook.svelte`
- Modify: `src/lib/games/animal-survivors/Result.svelte`、`CoopRoom.svelte`
- Test: `src/lib/games/animal-survivors/coop-stats.svelte.test.ts`

**Interfaces:**

- Consumes: `CoopRun`、`CoopRecords`、`pairKey`
- Produces
  - `coop-stats.ts`: `titles(c: CoopRun): string[][]`（動物ごとの称号の並び）
  - `CoopStats.svelte` の props `{ coop: CoopRun }`
  - `CoopBook.svelte` の props `{ coop: CoopRecords }`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/games/animal-survivors/coop-stats.svelte.test.ts`

```ts
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CoopBook from './CoopBook.svelte';
import CoopStats from './CoopStats.svelte';
import { titles } from './coop-stats';
import { emptyRecords } from './records';
import Result from './Result.svelte';
import { addHero, createWorld, summary, type CoopRun } from './world';

vi.mock('$lib/audio.svelte', () => ({ audio: { muted: false }, toggleMute: () => {}, bus: () => null }));

const run = (over: Partial<CoopRun> = {}): CoopRun => ({
  me: 0,
  heroes: [
    { animal: 'dog', kills: 120, damage: 5000, raises: 0 },
    { animal: 'cat', kills: 90, damage: 7000, raises: 2 }
  ],
  links: 3,
  carries: 1,
  bonus: 0,
  ...over
});

function show<P extends Record<string, unknown>>(C: Parameters<typeof mount>[0], props: P) {
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(C, { target, props });
  flushSync();
  return { target, app };
}

describe('称号', () => {
  it('多いほうに付き、同じ数なら付かない', () => {
    expect(titles(run())).toEqual([['いちばん倒した'], ['いちばんダメージ', 'いちばん助けた']]);
    const tie = run();
    tie.heroes[1] = { ...tie.heroes[1], kills: 120, raises: 0 };
    expect(titles(tie)).toEqual([[], ['いちばんダメージ']]);
  });
});

describe('ふたりの活躍', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('2 匹の数と称号、連携の技と運んだ数を出す', () => {
    const { target, app } = show(CoopStats, { coop: run() });
    const text = target.textContent ?? '';
    expect(text).toContain('ふたりの活躍');
    expect(text).toContain('120');
    expect(text).toContain('7,000');
    expect(text).toContain('いちばん助けた');
    expect(text).toContain('連携の技 3');
    expect(text).toContain('重い宝箱 1');
    unmount(app);
  });

  it('リザルトには 2 人の回だけ出し、ボーナスがあれば「ふたりのボーナス」を出す', () => {
    const solo = createWorld('dog', 1, { w: 260, h: 380 });
    solo.over = 'dead';
    const base = { got: [], total: 0, locked: false, onagain: () => {}, onselect: () => {} };
    const a = show(Result, { ...base, run: summary(solo) });
    expect(a.target.textContent).not.toContain('ふたりの活躍');
    unmount(a.app);
    const w = createWorld('dog', 1, { w: 260, h: 380 });
    addHero(w, 'cat');
    w.coins = 1000;
    w.over = 'clear';
    const b = show(Result, { ...base, run: summary(w) });
    expect(b.target.textContent).toContain('ふたりの活躍');
    expect(b.target.textContent).toContain('ふたりのボーナス');
    unmount(b.app);
  });
});

describe('ふたりの記録帳', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('遊んだ回数・クリア・最長と、組んだ組み合わせの数を出す', () => {
    const coop = { ...emptyRecords().coop, runs: 4, clears: 1, best: 615, pairs: ['cat+dog', 'dog+wolf'] };
    const { target, app } = show(CoopBook, { coop });
    const text = target.textContent ?? '';
    expect(text).toContain('4');
    expect(text).toContain('10:15');
    expect(text).toContain('2 / 55');
    expect(target.querySelectorAll('[data-pair]')).toHaveLength(2);
    unmount(app);
  });
});
```

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/coop-stats.svelte.test.ts`
Expected: FAIL（`./CoopBook.svelte` が無い）

- [ ] **Step 3: 実装する**

`src/lib/games/animal-survivors/coop-stats.ts`

```ts
import type { CoopRun } from './world';

const TITLES = [
  ['kills', 'いちばん倒した'],
  ['damage', 'いちばんダメージ'],
  ['raises', 'いちばん助けた']
] as const;

/** 動物ごとの称号。多いほうに付け、同じ数（どちらも 0 も）なら付けない */
export function titles(c: CoopRun): string[][] {
  const out: string[][] = c.heroes.map(() => []);
  for (const [k, name] of TITLES) {
    const [a, b] = c.heroes.map((h) => h[k]);
    if (a > b) out[0].push(name);
    else if (b > a) out[1].push(name);
  }
  return out;
}
```

`src/lib/games/animal-survivors/CoopStats.svelte`

```svelte
<script lang="ts">
  import { animal } from './animals';
  import { ANIMAL_ART } from './art/animals';
  import { titles } from './coop-stats';
  import PixelIcon from './PixelIcon.svelte';
  import type { CoopRun } from './world';

  let { coop }: { coop: CoopRun } = $props();

  const names = $derived(titles(coop));
  const n = (v: number) => v.toLocaleString('ja-JP');
</script>

<section class="duo" aria-label="ふたりの活躍">
  <h3>ふたりの活躍</h3>
  <div class="cols">
    {#each coop.heroes as h, i (i)}
      <div class="col" class:me={i === coop.me}>
        <PixelIcon art={ANIMAL_ART[h.animal].forms[0].walk} size="min(10cqw, 6cqh, 56px)" />
        <b>{animal(h.animal).name}</b>
        <span>撃破 {n(h.kills)}</span>
        <span>ダメージ {n(h.damage)}</span>
        <span>起こした {h.raises}</span>
        {#each names[i] as t (t)}<em>{t}</em>{/each}
      </div>
    {/each}
  </div>
  <p>連携の技 {coop.links}・重い宝箱 {coop.carries}</p>
</section>

<style>
  .duo {
    display: grid;
    gap: 6px;
    padding: 8px;
    border: 3px solid #24151f;
    background: #fff3d6;
    color: #24151f;
  }

  h3,
  p {
    margin: 0;
    text-align: center;
    font-size: min(4cqw, 2.4cqh, 20px);
  }

  .cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .col {
    display: grid;
    justify-items: center;
    gap: 2px;
    font-size: min(3.6cqw, 2.2cqh, 18px);
  }

  .col.me b {
    color: #2a64c8;
  }

  em {
    padding: 0 6px;
    background: #ffd84a;
    font-style: normal;
    font-weight: 800;
  }
</style>
```

`src/lib/games/animal-survivors/CoopBook.svelte`

```svelte
<script lang="ts">
  import type { AnimalId } from './animals';
  import { ANIMAL_ART } from './art/animals';
  import { clock } from './hud';
  import PixelIcon from './PixelIcon.svelte';
  import type { CoopRecords } from './records';

  let { coop }: { coop: CoopRecords } = $props();

  /** 10 匹から 2 匹（同じ動物どうしも）の組み合わせの数 */
  const ALL = 55;
  const pairs = $derived(coop.pairs.map((p) => p.split('+') as [AnimalId, AnimalId]));
</script>

<section class="book" aria-label="ふたりの記録帳">
  <h3>ふたりの記録帳</h3>
  <p>
    あそんだ {coop.runs} 回・クリア {coop.clears} 回・最長 {clock(coop.best)}<br />起こした {coop.raises}・連携の技 {coop.links}・重い宝箱
    {coop.carries}
  </p>
  <p>組んだ相棒 {pairs.length} / {ALL}</p>
  <div class="pairs">
    {#each pairs as [a, b] (`${a}+${b}`)}
      <span class="pair" data-pair>
        <PixelIcon art={ANIMAL_ART[a].forms[0].walk} size="min(6cqw, 3.6cqh, 32px)" />
        <PixelIcon art={ANIMAL_ART[b].forms[0].walk} size="min(6cqw, 3.6cqh, 32px)" />
      </span>
    {/each}
  </div>
</section>

<style>
  .book {
    display: grid;
    gap: 6px;
    padding: 8px;
    border: 3px solid #24151f;
    background: #fff3d6;
    color: #24151f;
  }

  h3,
  p {
    margin: 0;
    text-align: center;
    font-size: min(3.8cqw, 2.3cqh, 19px);
  }

  .pairs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
  }

  .pair {
    display: flex;
    padding: 2px;
    background: rgb(36 21 31 / 0.1);
  }
</style>
```

`Result.svelte`

1. import に `import CoopStats from './CoopStats.svelte';` を足す。
2. `{#if run.daily?.paid}...{/if}` の下に `{#if run.coop?.bonus}<span class="book">ふたりのボーナス +{run.coop.bonus}</span>{/if}` を足す。
3. `<RunKit {run} />` の上に `{#if run.coop}<CoopStats coop={run.coop} />{/if}` を足す。

`CoopRoom.svelte`

1. import に `import CoopBook from './CoopBook.svelte';` を足す。
2. つなぐ前の `<button class="as-card" onclick={() => (joining = 'guest')}>なかまに はいる</button>` の下に `<CoopBook coop={records.coop} />` を足す。

- [ ] **Step 4: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/coop-stats.svelte.test.ts`
Expected: PASS

Run: `pnpm check && pnpm lint && wc -l src/lib/games/animal-survivors/Result.svelte src/lib/games/animal-survivors/CoopRoom.svelte`
Expected: エラーなし、どちらも 200 行未満

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/animal-survivors/coop-stats.ts src/lib/games/animal-survivors/CoopStats.svelte src/lib/games/animal-survivors/CoopBook.svelte src/lib/games/animal-survivors/Result.svelte src/lib/games/animal-survivors/CoopRoom.svelte src/lib/games/animal-survivors/coop-stats.svelte.test.ts
git commit -m "Show the duo's part in co-op results and a co-op record book

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 説明と画面の確かめ

**Files:**

- Modify: `CLAUDE.md`
- Create: `<scratchpad>/records/shot.mjs`（commit しない）

- [ ] **Step 1: CLAUDE.md に足す**

アニマルサバイバーの段落の「知らせの版は `COOP_VERSION`」の文の上に足す。

```text
協力プレイの回のまとめには `RunSummary.coop`（2 匹それぞれの倒した数・ダメージは `dealt` の合計、相棒を起こした回数 `Hero.raises`、2 人で共通の連携の技の回数と運んだ重い宝箱の数 `World.carried`）が入り、リザルトに「ふたりの活躍」（`CoopStats.svelte`。多いほうに「いちばん倒した」などの称号、`coop-stats.ts`）を出す。2 人とも残って 10:00 をクリアした回だけ、その回のコインに 2 割（`DUO_BONUS`。強欲を掛けたあとの、その端末の動物のコイン）と銅の券 1 枚を足す（延長戦のぶんには掛けない）。記録の `coop`（遊んだ回数・クリア・最長・起こした回数・連携・運んだ数・組み合わせ `pairKey`）は端末ごとに `record()` が足し（延長戦の 2 回めは回とクリアを数えず、`overtimeRun` が延長戦のぶんの差だけを持つ）、ふたりで遊ぶ画面のつなぐ前に記録帳（`CoopBook.svelte`）として出す。実績の見出し「ふたりで」に 5 つ。
```

`CLAUDE.md` の「実績は `achievements.ts` の 53 個の表で」を「58 個の表で」にする。

- [ ] **Step 2: 2 ページの通しで撮る**

`<scratchpad>/carry/shot.mjs` を `<scratchpad>/records/shot.mjs` に写し、つなぐまでの手順はそのままにする（親は「なかまを よぶ」を押す前に、記録帳の枠が見える画面で 1 枚撮る）。始めたあとに `CoopPlay.svelte` の一時的な口（`(globalThis as any).__w = world; // TEMP-OBS`）で親の World を 10:00 の手前（`w.time = w.stage.length - 0.2`、敵を消して HP を大きく）にし、数を入れてクリアさせ、両方のリザルトの「ふたりの活躍」と「ふたりのボーナス」を撮る。

```js
await host.evaluate(() => {
  const w = globalThis.__w;
  w.stage = { ...w.stage, waves: [] };
  for (const h of w.heroes) h.stats.maxHp = h.player.hp = 1e9;
  w.heroes[0].dealt = { woof: { damage: 41200, kills: 812 } };
  w.heroes[1].dealt = { paw: { damage: 38800, kills: 905 } };
  w.heroes[1].raises = 2;
  w.link.uses = 3;
  w.carried = 1;
  w.coins = 600;
  w.time = w.stage.length - 0.2;
});
// 延長戦を聞く画面が出たら親で「おわる」を押す
await host.waitForTimeout(2500);
await click(host, 'button', { hasText: 'おわる' });
await host.waitForTimeout(1500);
await host.screenshot({ path: `${OUT}/2-host-result.png`, fullPage: true });
await guest.screenshot({ path: `${OUT}/2-guest-result.png`, fullPage: true });
```

撮り終えたら `sed -i '' '/TEMP-OBS/d' src/lib/games/animal-survivors/CoopPlay.svelte` で口を外す。

- [ ] **Step 3: 全体を通す**

Run: `pnpm verify`
Expected: exit 0

- [ ] **Step 4: コミット**

```bash
git add CLAUDE.md
git commit -m "Describe the Animal Survivors co-op records

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
