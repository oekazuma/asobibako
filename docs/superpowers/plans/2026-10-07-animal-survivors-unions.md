# アニマルサバイバー 武器の合体 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 決まった 2 つの武器を宝箱で 1 つの合体武器にまとめ、2 つの攻撃と組ごとの合わせ技を 1 つの枠から出す。

**Architecture:** 合体武器は `WEAPONS` の 1 項目（`union: { parts, twist }`）で、元の 2 つの武器の進化形の数値を少し強めた「部品」を 2 つ持つ。1 つの枠に 2 つの待ち時間（`cd`・`cd2`）を持ち、2 つめの部品の弾と効果は枠の番号に `PART_B` を足した番号で出して、当たりの時計を 1 つめと分ける。まとめる決まりは `unions.ts`、合わせ技は `arms.ts` と `zones.ts` の、弾や効果が生まれる・当たる・戻るところで、枠の番号から合体武器を引いて起こす。

**Tech Stack:** TypeScript、Svelte 5、vitest、canvas 2D

**Spec:** `docs/superpowers/specs/2026-10-07-animal-survivors-unions-design.md`

## Global Constraints

- 組は 6 つ。遠吠え＋雷撃、どんぐり＋ツタ、ダッシュアタック＋野生の炎、爪＋ネコパンチ、ワンワンショット＋魚ミサイル、骨ブーメラン＋羽根の嵐。動物だけの武器は組に入れない
- まとまるのは、組の 2 つの武器がどちらも Lv5（進化形でもよい）で宝箱を開けたとき。中身の 1 つがまとめになる
- 進化とまとめが同じ宝箱で両方できるときは進化を先にする
- 合体武器は 1 つめの武器の枠に入り、2 つめの枠は空く。合体武器はそれ以上上がらない
- 元の 2 つの武器とその進化形は、まとめたあと 3 択と宝箱に出ない
- 動物の専用進化形はまとめない。専用進化より先に最初の武器をまとめた回は専用進化が起きない
- 強さは元の武器の進化形を少し上回るくらい（ダメージ 1.15 倍）
- HUD の Lv は「+」。アイコンは見本で承認された 6 枚（scratchpad の `union/unions.json`）。弾と効果は金色の版
- 実績を 2 つ足す（はじめての合体・6 種すべての合体）。実績の画面の進化の表の下に「合体」の表
- コードコメントは非自明な WHY だけ。コンポーネントは 200 行未満

## Review Focus

- まとめた瞬間に飛んでいる弾・残っている炎やツタが、別の武器の絵や持ち主に化けない（まとめた 2 つの枠の弾と効果は消し、うしろの枠の弾と効果の番号を 1 つ詰める。Task 2 のテスト）
- 2 つめの部品の当たりの時計が 1 つめと取り合わない（`PART_B` で番号を分ける。Task 1 のテスト）
- 協力プレイの 2 匹めの合体武器でも、合わせ技と描き分けが持ち主の動物で起きる（`heroOf` が `PART_B` の番号でも動物を返す。Task 1 のテスト）
- 合体のあと、元の武器が 3 択にまた出て 2 つめの枠を埋め直せてしまわない（Task 4 のテスト）
- 3 つ以上の中身の宝箱で、進化とまとめが同じ宝箱で両方起きる（Task 4 のテスト）

---

## ファイルの分け方

| ファイル                              | 役目                                                                                               |
| ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `heroes.ts`                           | 枠の番号の広さ（`SLOT_COUNT`・`PART_B`）と、`heroOf`・`weaponAt` が 2 つめの部品の番号も読むこと   |
| `world.ts`                            | `ZONE_HIT` を `SLOT_COUNT * 2` に、`hit` の長さを `ZONE_HIT * 2` に。武器の型に `cd2`              |
| `weapons.ts`                          | 合体武器 6 つの定義（`union`）と、部品の定義を返す `partDef()`                                     |
| `unions.ts`（新）                     | 組の表 `UNIONS`・まとめられる組を探す `unitable()`・まとめる `unite()`・元の武器を返す `partsOf()` |
| `arms.ts`                             | 合体武器の 2 つの部品を撃つこと（`fire`）と 6 つの合わせ技                                         |
| `zones.ts`                            | どんぐりの当たった場所にツタを生やす `vineAt()`                                                    |
| `draw-arms.ts`                        | 部品ごとの描き分け（`kindOf` が部品の元の武器を返す）と、回るブーメラン                            |
| `chest.ts`                            | 宝箱の中身にまとめ（`kind: 'union'`）                                                              |
| `choices.ts`                          | まとめた元の武器を 3 択に出さない                                                                  |
| `hud.ts`                              | Lv の「+」                                                                                         |
| `ChestOpen.svelte`                    | 「合体！」                                                                                         |
| `art/items.ts`                        | アイコン 6 枚                                                                                      |
| `Evolutions.svelte`                   | 合体の表                                                                                           |
| `achievements.ts`・`trophy-groups.ts` | 実績 2 つ                                                                                          |
| `CLAUDE.md`                           | アニマルサバイバーの段落に合体の 2〜3 文                                                           |

---

### Task 1: 枠の番号を 2 つめの部品のぶん広げる

**Files:**

- Modify: `src/lib/games/animal-survivors/heroes.ts:45-49`
- Modify: `src/lib/games/animal-survivors/world.ts`（`ZONE_HIT` 265 行、`hit` 450 行、`weapons` の型 158 行）
- Create: `src/lib/games/animal-survivors/unions.test.ts`

**Interfaces:**

- Produces:
  - `SLOT_COUNT = HERO_SLOTS * MAX_HEROES`（12）
  - `PART_B = SLOT_COUNT`（2 つめの部品の弾と効果の枠の番号に足す数）
  - `heroOf(slot)` は `Math.floor((slot % SLOT_COUNT) / HERO_SLOTS)`
  - `weaponAt(w, slot)` は `w.heroes[heroOf(slot)]?.weapons[slot % HERO_SLOTS]`（今と同じ式で、`PART_B` を足した番号でも同じ枠を返す）
  - `ZONE_HIT = SLOT_COUNT * 2`、`Enemy.hit` の長さ `ZONE_HIT * 2`
  - `World.weapons: (Owned & { cd: number; cd2?: number })[]`

- [ ] **Step 1: 失敗するテストを書く**

`unions.test.ts` を作る。

```ts
import { describe, expect, it } from 'vitest';
import { ENEMIES } from './enemies';
import { heroOf, PART_B, SLOT_COUNT, weaponAt } from './heroes';
import { addHero, createWorld, makeEnemy, ZONE_HIT } from './world';

const VIEW = { w: 260, h: 380 };

describe('合体武器の枠の番号', () => {
  it('2 つめの部品の番号は、1 つめと同じ動物と枠を指す', () => {
    const w = createWorld('dog', 1, VIEW);
    addHero(w, 'cat');
    w.heroes[1].weapons.push({ id: 'howl', level: 1, cd: 0 });
    for (const slot of [0, 1, 7]) {
      expect(heroOf(slot + PART_B)).toBe(heroOf(slot));
      expect(weaponAt(w, slot + PART_B)).toBe(weaponAt(w, slot));
    }
    expect(PART_B).toBe(SLOT_COUNT);
  });

  it('当たりの時計は、2 つめの部品と炎・ツタのぶんまで分かれている', () => {
    const e = makeEnemy(ENEMIES.caterpillar, 0, 0, 10);
    expect(ZONE_HIT).toBe(SLOT_COUNT * 2);
    expect(e.hit).toHaveLength(ZONE_HIT * 2);
  });
});
```

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/unions.test.ts`
Expected: FAIL（`PART_B`・`SLOT_COUNT` が無い）

- [ ] **Step 3: 実装する**

`heroes.ts` の 45〜49 行を次にする。

```ts
/** 1 匹が持てる武器の枠。弾や効果の枠の番号は、動物をまたいで重ならない通しの番号（cur * HERO_SLOTS + 枠）にする */
export const HERO_SLOTS = 6;
export const MAX_HEROES = 2;
export const SLOT_COUNT = HERO_SLOTS * MAX_HEROES;
/** 合体武器の 2 つめの部品は、枠の番号にこれを足して出す（当たりの時計を 1 つめの部品と分ける） */
export const PART_B = SLOT_COUNT;
export const heroOf = (slot: number) => Math.floor((slot % SLOT_COUNT) / HERO_SLOTS);
export const weaponAt = (w: World, slot: number) => w.heroes[heroOf(slot)]?.weapons[slot % HERO_SLOTS];
```

（`MAX_HEROES` の定義が別の行にあれば、そこを消してここにまとめる。）

`world.ts` の `export const ZONE_HIT = HERO_SLOTS * MAX_HEROES;` を `export const ZONE_HIT = SLOT_COUNT * 2;` にし、import に `SLOT_COUNT` を足す。`hit: new Float64Array(ZONE_HIT * 2).fill(-1)` は今のままでよい（`ZONE_HIT` が倍になる）。`hit` のコメントを「武器の枠ごと（2 つめの部品は PART_B から）に最後に当たった時刻。後ろの ZONE_HIT からは同じ番号の炎とツタの時計」にする。158 行の型を `weapons: (Owned & { cd: number; cd2?: number })[];` にする。

- [ ] **Step 4: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors`
Expected: PASS（全体も通る）

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/animal-survivors/heroes.ts src/lib/games/animal-survivors/world.ts src/lib/games/animal-survivors/unions.test.ts
git commit -m "Widen the Animal Survivors slot numbers for a union's second part"
```

---

### Task 2: 合体武器の定義・まとめる決まり・2 つの部品を撃つ

**Files:**

- Modify: `src/lib/games/animal-survivors/weapons.ts`（`WeaponDef` 17〜40 行、`WEAPONS` のあと）
- Create: `src/lib/games/animal-survivors/unions.ts`
- Modify: `src/lib/games/animal-survivors/arms.ts`（`fire` 302〜335 行）
- Modify: `src/lib/games/animal-survivors/draw-arms.ts:15-16`
- Modify: `src/lib/games/animal-survivors/unions.test.ts`

**Interfaces:**

- Consumes: `PART_B`・`heroOf`・`weaponAt`（Task 1）
- Produces:
  - `WeaponDef.union?: { parts: [string, string]; twist: Twist }`
  - `type Twist = 'ringBolt' | 'acornVine' | 'dashFlame' | 'clawRoot' | 'fishBones' | 'boomerangOrbit'`
  - `UNION_BOOST = 1.15`
  - `partDef(def: WeaponDef, k: 0 | 1): WeaponDef`（元の武器の進化形を写し、ダメージに `UNION_BOOST` を掛けたもの）
  - `unions.ts`: `UNIONS: { parts: [string, string]; to: string }[]`、`partsOf(id: string): readonly [string, string] | null`、`unitable(w: World): Union | undefined`、`unite(w: World, u: Union): void`
  - `arms.ts`: `twistAt(w: World, slot: number): { twist: Twist; part: 0 | 1; def: WeaponDef } | null`

- [ ] **Step 1: 失敗するテストを書く**

`unions.test.ts` に足す。

```ts
import { fire } from './arms';
import { partDef, WEAPONS } from './weapons';
import { partsOf, unitable, unite, UNIONS } from './unions';
import { step } from './world';

const quiet = () => {
  const w = createWorld('dog', 1, VIEW);
  w.stage = { ...w.stage, waves: [], bosses: [], chiefs: [], events: [] };
  w.metalAt = -1;
  w.propCd = 1e9;
  return w;
};

describe('まとめる決まり', () => {
  it('6 組で、ふつうの 12 種の武器が 1 つずつ入り、動物だけの武器は入らない', () => {
    const all = UNIONS.flatMap((u) => u.parts).sort();
    expect(UNIONS).toHaveLength(6);
    expect(new Set(all).size).toBe(12);
    for (const id of all) expect(WEAPONS[id].exclusive).toBeFalsy();
    for (const u of UNIONS) expect(partsOf(u.to)).toEqual(u.parts);
  });

  it('2 つとも Lv5 ならまとめられ、片方が Lv4 ならまとめられない', () => {
    const w = quiet();
    w.weapons = [
      { id: 'howl', level: 5, cd: 0 },
      { id: 'thunder', level: 4, cd: 0 }
    ];
    expect(unitable(w)).toBeUndefined();
    w.weapons[1].level = 5;
    expect(unitable(w)?.to).toBe('howlUn');
  });

  it('進化形もまとめられるが、専用進化形はまとめない', () => {
    const w = quiet();
    w.weapons = [
      { id: 'howlEvo', level: 5, cd: 0 },
      { id: 'thunder', level: 5, cd: 0 }
    ];
    expect(unitable(w)?.to).toBe('howlUn');
    w.weapons[0].id = 'howlSp';
    expect(unitable(w)).toBeUndefined();
  });

  it('まとめると 1 つめの枠に入り、2 つめの枠は空き、うしろの武器が詰まる', () => {
    const w = quiet();
    w.weapons = [
      { id: 'woof', level: 3, cd: 0 },
      { id: 'thunder', level: 5, cd: 0 },
      { id: 'fish', level: 2, cd: 0 },
      { id: 'howl', level: 5, cd: 0 }
    ];
    unite(w, unitable(w)!);
    expect(w.weapons.map((o) => o.id)).toEqual(['woof', 'howlUn', 'fish']);
    expect(w.weapons[1].level).toBe(5);
    expect(w.evolvedNow).toContain('howlUn');
  });

  it('まとめた枠の弾と効果は消え、うしろの枠の弾と効果は番号が 1 つ詰まる', () => {
    const w = quiet();
    w.weapons = [
      { id: 'howl', level: 5, cd: 0 },
      { id: 'thunder', level: 5, cd: 0 },
      { id: 'fish', level: 2, cd: 0 }
    ];
    w.enemies.push(makeEnemy(ENEMIES.caterpillar, 40, 0, 1e9));
    fire(w, 1);
    const fishShots = () => w.shots.filter((o) => o.alive && o.slot % 6 === 2).length;
    expect(fishShots()).toBeGreaterThan(0);
    unite(w, unitable(w)!);
    expect(w.shots.filter((o) => o.alive && o.slot % 6 === 1).length).toBeGreaterThan(0);
    expect(w.shots.some((o) => o.alive && o.slot % 6 === 2)).toBe(false);
    expect(w.effects.some((f) => f.alive && f.slot % 6 === 0)).toBe(false);
  });

  it('部品は元の武器の進化形を写し、ダメージだけ 1.15 倍', () => {
    const d = WEAPONS.howlUn;
    expect(partDef(d, 0).kind).toBe('ring');
    expect(partDef(d, 1).kind).toBe('strike');
    expect(partDef(d, 0).base.damage).toBeCloseTo(WEAPONS.howlEvo.base.damage * 1.15);
    expect(partDef(d, 1).base.cooldown).toBe(WEAPONS.thunderEvo.base.cooldown);
  });
});

describe('合体武器を撃つ', () => {
  it('1 つの枠から 2 つの部品の攻撃が出て、2 つめは PART_B を足した番号になる', () => {
    const w = quiet();
    w.weapons = [{ id: 'howlUn', level: 5, cd: 0, cd2: 0 }];
    w.enemies.push(makeEnemy(ENEMIES.caterpillar, 30, 0, 1e9));
    w.grid.clear();
    w.enemies.forEach((e, i) => w.grid.add(i, e.x, e.y));
    fire(w, 1 / 60);
    expect(w.effects.some((f) => f.alive && f.kind === 'ring' && f.slot === 0)).toBe(true);
    expect(w.effects.some((f) => f.alive && f.kind === 'bolt' && f.slot === PART_B)).toBe(true);
    expect(w.weapons[0].cd).toBeGreaterThan(0);
    expect(w.weapons[0].cd2).toBeGreaterThan(0);
  });

  it('2 つの部品の待ち時間は別々に進む', () => {
    const w = quiet();
    w.weapons = [{ id: 'howlUn', level: 5, cd: 5, cd2: 0 }];
    w.enemies.push(makeEnemy(ENEMIES.caterpillar, 30, 0, 1e9));
    fire(w, 1 / 60);
    expect(w.effects.some((f) => f.alive && f.kind === 'ring')).toBe(false);
    expect(w.effects.some((f) => f.alive && f.kind === 'bolt')).toBe(true);
  });

  it('合体武器を持って 30 秒遊んでも落ちない', () => {
    const w = quiet();
    w.stage = createWorld('dog', 1, VIEW).stage;
    w.weapons = Object.values(UNIONS).map((u) => ({ id: u.to, level: 5, cd: 0, cd2: 0 }));
    w.stats.maxHp = w.player.hp = 1e9;
    for (let i = 0; i < 900; i++) step(w, { x: Math.cos(i / 40), y: Math.sin(i / 40) }, 1 / 30);
    expect(w.kills).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/unions.test.ts`
Expected: FAIL（`./unions` が無い、`partDef` が無い）

- [ ] **Step 3: 武器の定義を足す**

`weapons.ts` の `WeaponDef` に足す。

```ts
  /** 合体武器。parts の 2 つの武器の進化形を部品にして 1 つの枠から撃ち、twist の合わせ技を起こす */
  union?: { parts: [string, string]; twist: Twist };
```

ファイルの上に足す。

```ts
export type Twist = 'ringBolt' | 'acornVine' | 'dashFlame' | 'clawRoot' | 'fishBones' | 'boomerangOrbit';
/** 合体武器の部品は、元の武器の進化形のダメージにこれを掛ける */
export const UNION_BOOST = 1.15;
```

`WEAPONS` の定義のあとに足す（合体武器は進化形の数値から作るので、`WEAPONS` ができてから入れる）。

```ts
const UNION_DEFS: [string, string, string, [string, string], Twist][] = [
  ['howlUn', '雷鳴の遠吠え', '輪が広がるたびに、輪の中の敵へ雷が落ちる', ['howl', 'thunder'], 'ringBolt'],
  ['acornUn', '芽吹きの森', 'どんぐりが当たった場所からツタが生え、敵を足止めする', ['acorn', 'vine'], 'acornVine'],
  ['flameUn', '炎の疾走', '分身が駆け抜けた道に炎が残る', ['dash', 'flame'], 'dashFlame'],
  ['pawUn', 'しびれ爪', '引っかいた敵が少しのあいだ動けなくなる', ['claw', 'paw'], 'clawRoot'],
  ['woofUn', '骨の魚群', '魚が弾けると、骨が 4 方向に飛び散る', ['woof', 'fish'], 'fishBones'],
  [
    'featherUn',
    '風のブーメラン',
    '戻ってきたブーメランが、自分のまわりを 1 周回ってから消える',
    ['boomerang', 'feather'],
    'boomerangOrbit'
  ]
];
for (const [id, name, blurb, parts, twist] of UNION_DEFS) {
  const a = WEAPONS[`${parts[0]}Evo`];
  WEAPONS[id] = {
    ...a,
    id,
    name,
    blurb,
    evolved: true,
    union: { parts, twist },
    base: { ...a.base, damage: a.base.damage * UNION_BOOST }
  };
}

/** 合体武器の k 番めの部品。元の武器の進化形を写し、ダメージを UNION_BOOST 倍にする */
export function partDef(def: WeaponDef, k: 0 | 1): WeaponDef {
  const evo = WEAPONS[`${def.union!.parts[k]}Evo`];
  return { ...evo, base: { ...evo.base, damage: evo.base.damage * UNION_BOOST } };
}
```

- [ ] **Step 4: まとめる決まりを書く**

`unions.ts` を作る。

```ts
import { baseOf } from './evolutions';
import { heroOf, HERO_SLOTS } from './heroes';
import { MAX_LEVEL, WEAPONS } from './weapons';
import type { World } from './world';

export interface Union {
  parts: [string, string];
  to: string;
}

export const UNIONS: Union[] = Object.values(WEAPONS)
  .filter((d) => d.union)
  .map((d) => ({ parts: d.union!.parts, to: d.id }));

export const partsOf = (id: string) => WEAPONS[id]?.union?.parts ?? null;

/** 専用進化形はその子だけの強さなのでまとめない */
const ready = (o: { id: string; level: number }) =>
  !WEAPONS[o.id].special && !WEAPONS[o.id].union && (WEAPONS[o.id].evolved || o.level >= MAX_LEVEL);

/** 今の宝箱でまとめられる組。表の順の最初の 1 つ */
export function unitable(w: World): Union | undefined {
  return UNIONS.find((u) => u.parts.every((p) => w.weapons.some((o) => baseOf(o.id) === p && ready(o))));
}

export function unite(w: World, u: Union): void {
  const at = u.parts.map((p) => w.weapons.findIndex((o) => baseOf(o.id) === p && ready(o)));
  if (at.some((i) => i < 0)) return;
  const keep = Math.min(...at);
  const drop = Math.max(...at);
  w.weapons[keep] = { id: u.to, level: MAX_LEVEL, cd: 0, cd2: 0 };
  w.weapons.splice(drop, 1);
  // まとめた 2 つの枠の弾と効果は、別の武器の絵や持ち主に化けないよう消し、うしろの枠のものは番号を詰める
  for (const list of [w.shots, w.effects])
    for (const o of list) {
      if (!o.alive || heroOf(o.slot) !== w.cur) continue;
      const local = o.slot % HERO_SLOTS;
      if (local === keep || local === drop) o.alive = false;
      else if (local > drop) o.slot -= 1;
    }
  w.evolvedNow.push(u.to);
  w.events.push({ type: 'evolve', id: u.to });
}
```

- [ ] **Step 5: 2 つの部品を撃つ**

`arms.ts` の import に `PART_B` と `partDef`・`type Twist` を足し、`fire` を次にする（今の 1 つの武器の処理を `fireOne` に移す）。

```ts
/** 枠の番号の弾や効果が合体武器のものなら、その合わせ技と部品の番号 */
export function twistAt(w: World, slot: number): { twist: Twist; part: 0 | 1; def: WeaponDef } | null {
  const own = weaponAt(w, slot);
  const def = own && WEAPONS[own.id];
  if (!def?.union) return null;
  return { twist: def.union.twist, part: slot >= PART_B ? 1 : 0, def };
}

/** 撃ったら待ち時間を返す。撃てなければ null */
function fireOne(w: World, def: WeaponDef, level: number, slot: number): number | null {
  const s = weaponStats(def, level);
  s.amount += Math.floor(w.stats.amount);
  s.duration *= w.stats.duration;
  if (!launch(w, def, s, slot)) return null;
  const wait = attackWait(w, s.cooldown);
  // 羽根は回り終えてから待ち時間を数える
  return def.kind === 'orbit' ? s.duration + wait : wait;
}

export function fire(w: World, dt: number): void {
  w.weapons.forEach((own, slot) => {
    const def = WEAPONS[own.id];
    const parts: [WeaponDef, 'cd' | 'cd2', number][] = def.union
      ? [
          [partDef(def, 0), 'cd', 0],
          [partDef(def, 1), 'cd2', PART_B]
        ]
      : [[def, 'cd', 0]];
    for (const [d, key, add] of parts) {
      own[key] = (own[key] ?? 0) - dt;
      if ((own[key] ?? 0) > 0) continue;
      const wait = fireOne(w, d, own.level, slot + w.cur * HERO_SLOTS + add);
      if (wait === null) {
        own[key] = 0.25;
        continue;
      }
      own[key] = wait;
      // 炎は足もとに置くだけで、しかも間が短いので、攻撃の格好にすると歩く動きが見えなくなる
      if (d.kind === 'trail') continue;
      w.player.attack = 0.15;
      w.events.push({ type: 'fire', weapon: own.id });
    }
  });
}
```

（今の `fire` の中身を読み、上と違う処理があれば `fireOne` か `fire` に残す。違いは台帳に書く。）

`draw-arms.ts` の 15〜16 行を次にする。

```ts
/** 進化形と合体武器の弾・炎・ツタ・線は金色で描く */
const isGold = (w: World, slot: number) => WEAPONS[weaponAt(w, slot)?.id ?? '']?.evolved ?? false;
/** 描き分けに使う元の武器。合体武器は部品ごとの元の武器 */
const kindOf = (w: World, slot: number) => {
  const id = weaponAt(w, slot)?.id ?? '';
  const parts = WEAPONS[id]?.union?.parts;
  return parts ? parts[slot >= PART_B ? 1 : 0] : baseOf(id);
};
```

- [ ] **Step 6: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/unions.test.ts`
Expected: PASS（合わせ技はまだ無いので、雷鳴の遠吠えの雷は 2 つめの部品の雷撃から出る）

- [ ] **Step 7: 全体を回してコミット**

Run: `pnpm vitest run src/lib/games/animal-survivors`
Expected: PASS（`WEAPONS` の数を数えるテストが落ちたら、合体武器 6 つを足した数に直し、台帳に書く）

```bash
git add src/lib/games/animal-survivors
git commit -m "Define the six union weapons, unite pairs and fire both parts from one slot"
```

---

### Task 3: 6 つの合わせ技

**Files:**

- Modify: `src/lib/games/animal-survivors/arms.ts`（`Shot` 9〜30 行、`shoot` 119 行、`launch` の `ring`・`swipe`、`moveShot`、`hitShot`）
- Modify: `src/lib/games/animal-survivors/zones.ts`（`vineAt` を足す）
- Modify: `src/lib/games/animal-survivors/draw-arms.ts`（回るブーメラン）
- Modify: `src/lib/games/animal-survivors/unions.test.ts`

**Interfaces:**

- Consumes: `twistAt`・`partDef`・`PART_B`（Task 2）
- Produces: `Shot.drop: number`（炎の疾走が次に炎を置く年齢）、`zones.ts` の `vineAt(w, slot, x, y, scale, s)`、`shoot()` の 7 つめの引数 `from?: { x: number; y: number }`

- [ ] **Step 1: 失敗するテストを書く**

`unions.test.ts` に足す。テストの組は、敵を置いて `fire` と `hits` を数フレーム回し、合わせ技で生まれたものを数える。

```ts
import { hits } from './arms';

function arena(id: string, foes: [number, number][]) {
  const w = quiet();
  w.weapons = [{ id, level: 5, cd: 0, cd2: 99 }];
  for (const [x, y] of foes) w.enemies.push(makeEnemy(ENEMIES.caterpillar, x, y, 1e9));
  const tick = (n: number) => {
    for (let i = 0; i < n; i++) {
      w.grid.clear();
      w.enemies.forEach((e, k) => e.alive && w.grid.add(k, e.x, e.y));
      fire(w, 1 / 30);
      hits(w, 1 / 30);
      w.time += 1 / 30;
    }
  };
  return { w, tick };
}

describe('合わせ技', () => {
  it('雷鳴の遠吠え: 輪を出すと、輪の中の敵へ雷が落ちる（雷撃の部品は待ち時間中でも）', () => {
    const { w, tick } = arena('howlUn', [
      [20, 0],
      [-30, 10]
    ]);
    tick(1);
    expect(w.effects.filter((f) => f.alive && f.kind === 'bolt' && f.slot === PART_B).length).toBeGreaterThan(0);
  });

  it('芽吹きの森: どんぐりが当たった敵の足もとにツタが生える', () => {
    const { w, tick } = arena('acornUn', [[25, -6]]);
    tick(20);
    expect(w.effects.some((f) => f.alive && f.kind === 'vine' && f.slot === PART_B)).toBe(true);
  });

  it('炎の疾走: 分身が駆け抜けた道に炎が並ぶ', () => {
    const { w, tick } = arena('flameUn', [[120, 0]]);
    tick(15);
    expect(w.effects.filter((f) => f.alive && f.kind === 'flame' && f.slot === PART_B).length).toBeGreaterThan(2);
  });

  it('しびれ爪: 引っかいた敵が動けなくなり、ボスは止めない', () => {
    const { w, tick } = arena('pawUn', [[14, -6]]);
    const boss = makeEnemy(ENEMIES.bear, -14, -6, 1e9);
    w.enemies.push(boss);
    tick(2);
    expect(w.enemies[0].root).toBeGreaterThan(0);
    expect(boss.root).toBeLessThanOrEqual(0);
  });

  it('骨の魚群: 魚が弾けると、骨が 4 本その場所から飛ぶ', () => {
    const { w, tick } = arena('woofUn', [[60, 0]]);
    w.weapons[0] = { id: 'woofUn', level: 5, cd: 99, cd2: 0 };
    let bones = 0;
    for (let i = 0; i < 60 && bones < 4; i++) {
      tick(1);
      bones = w.shots.filter((o) => o.alive && o.kind === 'shot' && o.slot === 0).length;
    }
    expect(bones).toBeGreaterThanOrEqual(4);
  });

  it('風のブーメラン: 戻ったブーメランが自分のまわりを回る', () => {
    const { w, tick } = arena('featherUn', [[50, 0]]);
    let circled = false;
    for (let i = 0; i < 120 && !circled; i++) {
      tick(1);
      circled = w.shots.some((o) => o.alive && o.kind === 'orbit' && o.slot === 0);
    }
    expect(circled).toBe(true);
  });
});
```

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/unions.test.ts -t 合わせ技`
Expected: 6 つとも FAIL（雷鳴の遠吠えは `cd2: 99` なので雷撃の部品が撃たず、雷が無い）

- [ ] **Step 3: 実装する**

`zones.ts` に足す。

```ts
/** (x, y) にツタを 1 本生やす（芽吹きの森で、どんぐりが当たった場所） */
export function vineAt(w: World, slot: number, x: number, y: number, scale: number, s: WeaponStats): void {
  zone(w, slot, 'vine', x, y, VINE_R * scale, s);
}
```

`arms.ts` の変更。

1. `Shot` に `/** 炎の疾走が次に炎を置く年齢 */ drop: number;` を足し、`newShot` に `drop: 0`、`shoot` の `Object.assign` に `drop: 0` を足す。
2. `shoot` に 7 つめの引数 `from = { x: w.player.x, y: w.player.y - 6 }` を足し、`x: from.x, y: from.y` にする。
3. 2 つめの部品の数値を出す口を足す。

```ts
/** 合わせ技でもう一方の部品の攻撃を出すときの数値（範囲と効く時間の強化も受ける） */
function partStats(w: World, def: WeaponDef, k: 0 | 1): WeaponStats {
  const s = weaponStats(partDef(def, k), MAX_LEVEL);
  s.amount += Math.floor(w.stats.amount);
  s.duration *= w.stats.duration;
  return s;
}
```

（`MAX_LEVEL` を `./weapons` から import する。）

4. `strike` の case の雷を落とす処理を関数にして、範囲を渡せるようにする。

```ts
/** (x, y) から r の中の敵へ、数のぶんだけ雷を落とす。中に敵がいなければ false */
function bolts(
  w: World,
  slot: number,
  s: WeaponStats,
  area: number,
  x: number,
  y: number,
  rx: number,
  ry: number
): boolean {
  const seen = w.enemies.filter(
    (e) => e.alive && !e.def.prop && !airborne(e) && Math.abs(e.x - x) < rx && Math.abs(e.y - y) < ry
  );
  if (seen.length === 0) return false;
  for (let i = 0; i < s.amount && seen.length > 0; i++) {
    const t = seen.splice(Math.floor(w.rand() * seen.length), 1)[0];
    const r = SIZE.strike * area;
    effect(w, slot, 'bolt', t.x, t.y, r, s.duration, 0, 0, 0);
    for (const j of within(w, t.x, t.y, r, targets)) strike(w, j, s.damage, t.x, t.y - 1, s.knockback, slot);
  }
  return true;
}
```

`case 'strike'` は `return bolts(w, slot, s, area, p.x, p.y, w.view.w / 2, w.view.h / 2);` にする。

5. `case 'ring'` の `return true;` の前に足す。

```ts
const tw = twistAt(w, slot);
if (tw?.twist === 'ringBolt') {
  const r = SIZE.ring * area;
  bolts(w, slot + PART_B, partStats(w, tw.def, 1), area, p.x, p.y - 6, r, r);
}
```

6. `case 'swipe'` の `strike(...)` のあとに足す（その枠が合体武器かは、ループの前に 1 回だけ引く）。

```ts
if (root && !e.def.boss && !e.def.part) e.root = Math.max(e.root, CLAW_ROOT);
```

ループの前に `const root = twistAt(w, slot)?.twist === 'clawRoot';`、ファイルの上に `/** しびれ爪で敵が止まる秒 */ const CLAW_ROOT = 0.5;`。

7. `moveShot` の `boomerang` の戻りで `if (d < 8) o.alive = false;` を次にする。

```ts
if (d < 8) {
  const tw = twistAt(w, o.slot);
  if (tw?.twist === 'boomerangOrbit' && o.kind === 'boomerang') {
    // 風のブーメラン: 戻ったら自分のまわりを 1 周回ってから消える
    const s = partStats(w, tw.def, 1);
    o.kind = 'orbit';
    o.vx = SIZE.orbit * s.area * w.stats.area;
    o.speed = s.speed;
    o.angle = Math.atan2(o.y - (p.y - 6), o.x - p.x);
    o.life = o.age + (Math.PI * 2) / s.speed;
    return;
  }
  o.alive = false;
}
```

8. `moveShot` の最後（`o.angle = Math.atan2(o.vy, o.vx);` のあと）に足す。

```ts
if (o.kind === 'shot' && o.age >= o.drop) {
  const tw = twistAt(w, o.slot);
  if (tw?.twist === 'dashFlame' && tw.part === 0) {
    // 炎の疾走: 駆け抜けた道に一定の間で炎を置く
    o.drop = o.age + DASH_FLAME_EVERY;
    const s = partStats(w, tw.def, 1);
    flameAt(w, o.slot + PART_B, o.x, o.y + 4, 0.8 * s.area * w.stats.area, { ...s, duration: 1.2 * w.stats.duration });
  }
}
```

ファイルの上に `/** 炎の疾走が炎を置く間（秒） */ const DASH_FLAME_EVERY = 0.08;`。

9. `hitShot` の `shot` の枝で、`strike(...)` のあとに足す。

```ts
if (o.hits.length === 1) {
  const tw = twistAt(w, o.slot);
  // 芽吹きの森: どんぐりは最初に当たった敵の足もとにだけツタを生やす（貫いた先まで生やすと画面がツタで埋まる）
  if (tw?.twist === 'acornVine' && tw.part === 0) {
    const s = partStats(w, tw.def, 1);
    vineAt(w, o.slot + PART_B, e.x, e.y, s.area * w.stats.area, s);
  }
}
```

10. `hitShot` の `homing` の枝で、`o.alive = false;` の前に足す。

```ts
const tw = twistAt(w, o.slot);
if (tw?.twist === 'fishBones' && tw.part === 1) {
  // 骨の魚群: 弾けた場所から骨を 4 方向へ
  const s = partStats(w, tw.def, 0);
  const slotA = o.slot - PART_B;
  for (let k = 0; k < 4; k++) shoot(w, slotA, 'shot', s, (k / 4) * Math.PI * 2, SIZE.shot * s.area * w.stats.area, o);
}
```

`zones.ts` から `vineAt` を import する。

`draw-arms.ts` の `shots` で、`else if (o.kind === 'boomerang')` を `else if (o.kind === 'boomerang' || weapon === 'boomerang')` にする（風のブーメランは回っているあいだも骨の絵）。この行は `weapon === 'fireFeather'` の行より後ろなので、火の羽根の描き方は変わらない。

- [ ] **Step 4: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/unions.test.ts`
Expected: PASS

- [ ] **Step 5: 全体を回してコミット**

Run: `pnpm vitest run src/lib/games/animal-survivors`
Expected: PASS

```bash
git add src/lib/games/animal-survivors
git commit -m "Add the six union twists"
```

---

### Task 4: 宝箱・3 択・HUD・宝箱の画面・アイコン・合体の表・実績

**Files:**

- Modify: `chest.ts`（`Reward` 1〜8 行、`openChest` 32〜37 行）
- Modify: `choices.ts:40`
- Modify: `hud.ts:47`
- Modify: `ChestOpen.svelte`（`info` 19 行、`tick` 53 行）
- Modify: `art/items.ts`（アイコン 6 枚）
- Modify: `Evolutions.svelte`
- Modify: `achievements.ts`（119〜126 行のあと）、`trophy-groups.ts`
- Modify: `pixels.test.ts`、`progress.test.ts:119-121`、`Evolutions.svelte.test.ts`
- Modify: `unions.test.ts`

**Interfaces:**

- Consumes: `unitable`・`unite`・`partsOf`・`UNIONS`（Task 2）
- Produces: `Reward` に `{ kind: 'union'; parts: [string, string]; id: string }`、実績 `union1`・`unionAll`

- [ ] **Step 1: 失敗するテストを書く**

`unions.test.ts` に足す。

```ts
import { openChest } from './chest';
import { choices } from './choices';
import { ACHIEVEMENTS } from './achievements';
import { emptyRecords } from './records';

describe('宝箱と 3 択', () => {
  it('組がそろって宝箱を開けると、中身の 1 つがまとめになる', () => {
    const w = quiet();
    w.weapons = [
      { id: 'howl', level: 5, cd: 0 },
      { id: 'thunder', level: 5, cd: 0 }
    ];
    w.chests = 1;
    const got = openChest(w);
    expect(got[0]).toEqual({ kind: 'union', parts: ['howl', 'thunder'], id: 'howlUn' });
    expect(w.weapons.map((o) => o.id)).toEqual(['howlUn']);
  });

  it('進化とまとめが両方できるときは進化が先で、中身が 3 つ以上ならまとめも同じ宝箱で起きる', () => {
    const w = quiet();
    w.weapons = [
      { id: 'howl', level: 5, cd: 0 },
      { id: 'thunder', level: 5, cd: 0 }
    ];
    w.passives = [{ id: 'roar', level: 1 }];
    w.chests = 1;
    // 宝箱の中身が 1 つになる割合から引くので、1 にすると必ず 3 つ以上
    w.fx.chest = 1;
    const got = openChest(w);
    expect(got[0]).toEqual({ kind: 'evolve', from: 'howl', id: 'howlEvo' });
    expect(got[1]).toEqual({ kind: 'union', parts: ['howl', 'thunder'], id: 'howlUn' });
  });

  it('まとめたあと、元の武器は 3 択に新しい武器として出ない', () => {
    const w = quiet();
    w.weapons = [{ id: 'howlUn', level: 5, cd: 0, cd2: 0 }];
    for (let i = 0; i < 50; i++) {
      const ids = choices(w).map((c) => ('id' in c ? c.id : ''));
      expect(ids).not.toContain('howl');
      expect(ids).not.toContain('thunder');
    }
  });

  it('専用進化より先に最初の武器をまとめた回は、専用進化が起きない', () => {
    const w = quiet();
    w.form = 2;
    w.weapons = [
      { id: 'woof', level: 5, cd: 0 },
      { id: 'fish', level: 5, cd: 0 }
    ];
    unite(w, unitable(w)!);
    w.chests = 1;
    openChest(w);
    expect(w.weapons.some((o) => o.id === 'woofSp')).toBe(false);
  });

  it('はじめての合体と 6 種すべての合体の実績がある', () => {
    const r = emptyRecords();
    const one = ACHIEVEMENTS.find((a) => a.id === 'union1')!;
    const all = ACHIEVEMENTS.find((a) => a.id === 'unionAll')!;
    expect(one.done(r, undefined as never)).toBe(false);
    r.evolved.push('howlUn');
    expect(one.done(r, undefined as never)).toBe(true);
    expect(all.done(r, undefined as never)).toBe(false);
    r.evolved.push(...UNIONS.map((u) => u.to));
    expect(all.done(r, undefined as never)).toBe(true);
  });
});
```

（`w.fx.chest` は装備の効き目で、`openChest` が中身 1 つの割合から引く。1 にすると 1 つの割合が 0 になる。）

`Evolutions.svelte.test.ts` に足す。

```ts
it('合体の表は 6 行で、作った合体武器だけ名前を出す', () => {
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Evolutions, { target, props: { evolved: ['howlUn'] } });
  flushSync();
  expect(target.querySelectorAll('.unions li')).toHaveLength(6);
  expect(target.textContent).toContain('雷鳴の遠吠え');
  expect(target.textContent).not.toContain('骨の魚群');
  expect(target.textContent).toContain('合体 1 / 6');
  unmount(app);
});
```

`progress.test.ts` の 46 を 48 にする。`pixels.test.ts` の `describe('ドット絵の格子'` に足す。

```ts
it('合体武器のアイコンが 6 枚ある', () => {
  for (const id of ['howlUn', 'acornUn', 'flameUn', 'pawUn', 'woofUn', 'featherUn'])
    expect(ITEM_ART[`weapon-${id}`]).toBeDefined();
});
```

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/unions.test.ts src/lib/games/animal-survivors/Evolutions.svelte.test.ts src/lib/games/animal-survivors/progress.test.ts src/lib/games/animal-survivors/pixels.test.ts`
Expected: 新しいテストが FAIL（宝箱は Lv5 の武器を上げられずにごほうびを出す、合体の表が無い、実績が 46 個、アイコンが無い）

- [ ] **Step 3: 宝箱と 3 択を直す**

`chest.ts` の `Reward` に `| { kind: 'union'; parts: [string, string]; id: string }` を足し、import に `unitable, unite` を `./unions` から足す。`openChest` の進化のブロックのあとに足す。

```ts
const u = n > 0 ? unitable(w) : undefined;
if (u) {
  unite(w, u);
  out.push({ kind: 'union', parts: u.parts, id: u.to });
  n -= 1;
}
```

`choices.ts` の 40 行を次にする。

```ts
// 進化した武器の元の武器・進化形そのもの・まとめた 2 つの武器は、新しい武器として出さない
const had = new Set(w.weapons.flatMap((o) => [baseOf(o.id), ...(partsOf(o.id) ?? [])]));
```

（`partsOf` を `./unions` から import する。）

`hud.ts` の 47 行を次にする。

```ts
const lv = def?.union ? '+' : def?.special ? '^' : def?.evolved ? '*' : String(o.level);
```

- [ ] **Step 4: 宝箱の画面・アイコン・合体の表を直す**

`ChestOpen.svelte` の `info` の先頭に足す。

```ts
if (r.kind === 'union')
  return { key: `u-${r.id}`, art: itemArt(`weapon-${r.id}`), name: WEAPONS[r.id].name, text: '合体！', evo: true };
```

`tick` の `if (rewards[shown - 1]?.kind === 'evolve') sounds.evolve();` を `const k = rewards[shown - 1]?.kind; if (k === 'evolve' || k === 'union') sounds.evolve();` にし、そのうえのコメントを「進化とまとめの出来事は…」にする。

`art/items.ts` に、scratchpad の `union/unions.json` の 6 枚を `'weapon-howlUn'` などの名前で足す（`w: 12, h: 12, frames`。`pal` は無い）。書き出しは次の node で行う。

```bash
node -e "const a=require('<scratchpad>/union/unions.json');for(const [k,v] of Object.entries(a))console.log(\`  'weapon-\${k}': { w: 12, h: 12, frames: [\${JSON.stringify(v.frames[0])}] },\`)"
```

出た 6 行を `ITEM_ART` の `'weapon-breath'` の項目のあとに貼り、`pnpm prettier --write` で整える。

`Evolutions.svelte` の専用進化の表のあとに足す（`UNIONS` を `./unions` から import する）。

```svelte
<h3 class="head">合体 {UNIONS.filter((u) => evolved.includes(u.to)).length} / {UNIONS.length}</h3>
<ul class="unions">
  {#each UNIONS as u (u.to)}
    {@const got = evolved.includes(u.to)}
    <li class:got>
      <PixelIcon art={itemArt(`weapon-${u.parts[0]}`)} {size} />
      <span class="plus">+</span>
      <PixelIcon art={itemArt(`weapon-${u.parts[1]}`)} {size} />
      <span class="plus">=</span>
      <span class:hidden={!got}><PixelIcon art={itemArt(`weapon-${u.to}`)} {size} /></span>
      <span class="name"
        >{got ? WEAPONS[u.to].name : '？？？'}<small>{WEAPONS[u.parts[0]].name}・{WEAPONS[u.parts[1]].name}</small
        ></span
      >
    </li>
  {/each}
</ul>
```

（`.pairs` の行の見た目を `ul` と `li` で共有していれば、そのまま同じ見た目になる。`.pairs` だけに付いた style があれば `.unions` にも付ける。）

- [ ] **Step 5: 実績を足す**

`achievements.ts` の `evolveAll` のあとに足す（`UNIONS` を import）。

```ts
  { id: 'union1', name: 'はじめての合体', coins: 150, done: (r) => r.evolved.some((id) => UNIONS.some((u) => u.to === id)) },
  {
    id: 'unionAll',
    name: '6 種すべての合体',
    coins: 500,
    done: (r) => unitedCount(r) >= UNIONS.length,
    progress: (r) => [unitedCount(r), UNIONS.length]
  },
```

`evolvedCount` の下に `const unitedCount = (r: Records) => r.evolved.filter((id) => UNIONS.some((u) => u.to === id)).length;` を足す。`trophy-groups.ts` を読み、`evolve1`・`evolveAll` と同じ見出し（「育てる」）に `union1`・`unionAll` を入れる。`unions.ts` → `achievements.ts` の import が循環しないか（`unions.ts` は `weapons`・`evolutions`・`heroes` しか読まない）を確かめる。

- [ ] **Step 6: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors`
Expected: PASS

- [ ] **Step 7: コミット**

```bash
git add src/lib/games/animal-survivors
git commit -m "Unite pairs in chests, keep their parts out of the picks, and show unions in the HUD, chest, table and trophies"
```

---

### Task 5: ボットで確かめる

**Files:**

- Create（scratchpad、リポジトリには入れない）: `<scratchpad>/sim/unions.sim.ts`

- [ ] **Step 1: シミュレーションを書く**

`<scratchpad>/sim/obstacles.sim.ts` を写して `unions.sim.ts` にし、次を変える。

- `process.env.OFF === '1'` のときは `vi.mock('<repo>/src/lib/games/animal-survivors/unions', async (orig) => ({ ...(await orig()), unitable: () => undefined }))` で合体を止める
- 3 択の選び方は 2 通り。`PICKER=weapons`（今の、武器を先に取る）と `PICKER=pairs`（持っている武器の組の相手を最優先し、無ければ武器、無ければ最初の札）
- 障害物を避ける力と中に入らない数の数え方は消す
- 結果に `unions: [{ id, at }]`（`w.events` の `evolve` で、id が合体武器のものとその時刻）を入れる

- [ ] **Step 2: 回す**

森と夜の墓地、店を半分、動物 `dog,fox,panda`、`SEEDS=12`、`PICKER=pairs` で、合体あり・なしの 4 本。さらに森の `PICKER=weapons` の合体ありを 1 本。

- [ ] **Step 3: 比べて決める**

- 合体ありの `pairs` で、10 分のうちに合体が 1 回以上起きる回が半分を超えるか。超えなければ、起きた時刻と、そろわなかった理由（Lv5 に届かない・宝箱が足りない）を見て台帳に書く
- クリアの割合の差が 15 ポイント以内ならそのまま。超えて合体ありが強すぎるなら `UNION_BOOST` を 1.0 に下げて回し直す（それでも超えたら利用者に数字を見せて聞く）
- 数字と決めたことを台帳に書く

- [ ] **Step 4: コミット**（`UNION_BOOST` を変えたときだけ）

```bash
git add src/lib/games/animal-survivors/weapons.ts
git commit -m "Tune the union strength from the bot runs"
```

---

### Task 6: 文書と仕上げ

**Files:**

- Modify: `CLAUDE.md`（アニマルサバイバーの段落の、進化の説明「…実績の画面の進化の表で組み合わせと一緒に見せる。」のあと）

- [ ] **Step 1: CLAUDE.md に書く**

```
決まった 2 つの武器（`unions.ts` の 6 組。ふつうの 12 種が 1 つずつ入る）がどちらも Lv5（進化形でもよい。専用進化形は除く）で宝箱を開けると、進化のあとに中身の 1 つがまとめになり、1 つめの武器の枠に合体武器（`weapons.ts` の `union`）が入って 2 つめの枠が空く（まとめた 2 つの枠の弾と効果は消し、うしろの枠の番号を詰める）。合体武器は 2 つの武器の進化形を `UNION_BOOST` 倍にした部品（`partDef`）を 1 つの枠から別々の待ち時間（`cd`・`cd2`）で撃ち、2 つめの部品の弾と効果は枠の番号に `PART_B` を足して当たりの時計を分ける。組ごとの合わせ技（`twist`）は、弾や効果が生まれる・当たる・戻るところで `twistAt()` が枠の番号から引いて起こす。元の 2 つの武器は 3 択に出さず、HUD の Lv は「+」、作ったものは記録の `evolved` に残して実績の画面の合体の表に出す。
```

- [ ] **Step 2: まとめて確かめる**

Run: `pnpm verify > <workspace>/verify.txt 2>&1; tail -40 <workspace>/verify.txt`
Expected: lint / check / test / vitals / build がすべて通る

- [ ] **Step 3: 画面で確かめる**

障害物のときの `obs/shot.mjs` と同じ形で（Play.svelte に一時的に `__w` を入れ、コミットしない）、合体武器を 6 つ持たせて敵を置き、合わせ技が見えるところと HUD の「+」を撮る。宝箱の画面の「合体！」も撮る。

- [ ] **Step 4: コミット**

```bash
git add CLAUDE.md
git commit -m "Describe the Animal Survivors weapon unions"
```

- [ ] **Step 5: 枝全体の見直し（opus）と、Critical / Important の直し**

- [ ] **Step 6: 写真を利用者に送り、main への push を聞く**
