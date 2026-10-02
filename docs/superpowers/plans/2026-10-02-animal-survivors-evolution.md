# Animal Survivors 進化・BGM・群れ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 武器の進化 12 組、3 曲の BGM、時刻ごとの群れの大波、リザルトの武器ごとのダメージ表を足す。

**Architecture:** 進化は `evolutions.ts` の表と `weapons.ts` の進化形で、宝箱（`chest.ts`）が入れ替える。進化形の絵は元の絵を金色にして ★ を重ねる `art/evolved.ts` の `itemArt()` が作る。BGM は共通の `$lib/music` にピコピコ音の楽器と伴奏 `drive` と繰り返し流す `Loop` を足し、ゲームの `songs.ts` を `Survivors.svelte` が流す。群れはステージの `events` を `world.ts` が時刻で出す。ダメージは `damageEnemy` に武器の id を渡して `World.dealt` に数える。

**Tech Stack:** SvelteKit（Svelte 5 runes）、TypeScript、canvas 2D、Web Audio（AudioBuffer に計算した波形）、vitest、playwright-core の headless Chrome（scratchpad の台本）

**Spec:** `docs/superpowers/specs/2026-10-02-animal-survivors-evolution-design.md`

## Global Constraints

- 強化なしの強さ（今の武器・動物・敵・パッシブの数値）は変えない。群れで強化なしの生存の中央値が大きく下がらないこと。
- 新しい絵は描く前に見本を見せて止まる。3 曲は WAV で聞いてもらって止まる。
- `$lib/music` への変更は足すだけ。わんにゃんハウスの曲・`Bgm` は変えない。
- コンポーネントは 200 行未満、props は 6 つまで（svelte-vitals）。`Result.svelte` は今 198 行、`Play.svelte` は 199 行。
- 絵文字は使わない（★ はドット絵か文字の「★」）。全角スペースは使わない（eslint）。
- 記録は `asobibako:animal-survivors` に足す。古い保存は足した項目を空で読む。
- コードコメントは非自明な WHY だけ。docs は最新の仕様だけ。
- `pnpm verify` が通ること。

## Review Focus

- 進化した武器の元の武器が、3 択に「新しい武器」としてまた出る。出てはいけない。Task 2 のテスト。
- 進化できる武器が 2 つあるときの宝箱。持っている順の最初の 1 つだけが進化し、残りは次の宝箱。Task 2 のテスト。
- 群れが 400 体の入れ物を使い切ったあと。ふつうの出現が止まるだけで、落ちない。Task 8 のテスト。
- ミュート中に WARNING が出てボスを倒した。戻したときに今の場面の曲（森）が流れる。Task 5 の `Loop` のテスト。
- 一時停止を開いたまま隠れて戻る。曲は小さいまま流れる（止まらない）。Task 7 の headless。

---

### Task 1: 進化形の絵の見本

**Files:**

- Create: `src/lib/games/animal-survivors/art/evolved.ts`
- Modify: `src/lib/games/animal-survivors/font.ts`（★ の 3×5 の字）
- Test: `src/lib/games/animal-survivors/pixels.test.ts`

**Interfaces:**

- Produces: `itemArt(key: string): Art`（`weapon-<id>Evo` は `weapon-<id>` を金色にして右上に ★ を重ねた絵を作って控え、ほかは `ITEM_ART[key]`）、`goldArt(art: Art): Art`（弾や炎を金色にした絵）、font の `'*'`（★ の形）

- [ ] **Step 1: 失敗するテストを書く**

`pixels.test.ts` に足す。

```ts
import { goldArt, itemArt } from './art/evolved';

it('進化形のアイコンは元の絵と同じ大きさで、色だけ金色になり、右上に星がある', () => {
  const base = ITEM_ART['weapon-woof'];
  const evo = itemArt('weapon-woofEvo');
  expect([evo.w, evo.h]).toEqual([base.w, base.h]);
  expect(itemArt('weapon-woofEvo')).toBe(evo);
  expect(evo.frames[0][1][base.w - 2]).toBe('*');
  expect(problems('weapon-woofEvo', evo, { ...PALETTE, ...evo.pal })).toEqual([]);
  expect(itemArt('meat')).toBe(ITEM_ART.meat);
});

it('goldArt は線を残して明るい色を金色にする', () => {
  const g = goldArt(ITEM_ART.bone);
  expect(g.pal?.k).toBe(PALETTE.k);
  expect(g.pal?.w).not.toBe(PALETTE.w);
  expect(goldArt(ITEM_ART.bone)).toBe(g);
});
```

（`problems` と `PALETTE` は pixels.test.ts の既存の import を使う。）

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/pixels.test.ts`
Expected: FAIL（`./art/evolved` が無い）

- [ ] **Step 3: 実装する**

`art/evolved.ts`:

```ts
import { goldOf, type Art } from '../pixels';
import { ITEM_ART } from './items';
import { PALETTE } from './palette';

const golds = new WeakMap<Art, Art>();

/** 線（k）は残し、ほかの色を明るさに応じた金色にする。文字はそのままで pal で色だけ差し替える。毎フレーム描く弾にも使うので控える */
export function goldArt(art: Art): Art {
  const had = golds.get(art);
  if (had) return had;
  const pal: Record<string, string> = {};
  for (const f of art.frames)
    for (const row of f) for (const ch of row) if (ch !== '.') pal[ch] ??= goldOf(art.pal?.[ch] ?? PALETTE[ch]);
  const g = { ...art, pal };
  golds.set(art, g);
  return g;
}

/** 右上の 3×3 に白い星（＋の形）を置く。星の文字は * で、色は pal で白にする */
function star(art: Art): Art {
  const w = art.w;
  const frames = art.frames.map((f) =>
    f.map((row, y) => {
      const put = (r: string, x: number) => r.slice(0, x) + '*' + r.slice(x + 1);
      if (y === 0 || y === 2) return put(row, w - 2);
      if (y === 1) return put(put(put(row, w - 3), w - 2), w - 1);
      return row;
    })
  );
  return { ...art, frames, pal: { ...art.pal, '*': '#ffffff' } };
}

const made = new Map<string, Art>();

/** ITEM_ART を引く。進化形のアイコン（weapon-<id>Evo）は元の武器の絵から作って控える */
export function itemArt(key: string): Art {
  const have = ITEM_ART[key];
  if (have) return have;
  let a = made.get(key);
  if (!a && key.startsWith('weapon-') && key.endsWith('Evo')) {
    a = star(goldArt(ITEM_ART[key.slice(0, -3)]));
    made.set(key, a);
  }
  if (!a) throw new Error(`絵が無い: ${key}`);
  return a;
}
```

`font.ts` の `GLYPHS` に `'*': '010111010101000'`（3×5 の小さな星）を足す。

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/pixels.test.ts`
Expected: PASS

- [ ] **Step 5: 見本を撮って止まる**

scratchpad の `evolved-sheet.mjs`（`progress-sheet.mjs` と同じ形）で、12 の武器のアイコンを左に元の絵、右に `itemArt('weapon-<id>Evo')` を 8 倍で並べ、下の段に `goldArt` の弾（`bone`・`acorn`・`fish`・`feather`・`flame`・`vine`）を元の絵と並べた PNG を作り、Read で見てから利用者に送って「この絵で進めてよいか」を聞いて止まる。

- [ ] **Step 6: Commit**

```bash
git add src/lib/games/animal-survivors/art/evolved.ts src/lib/games/animal-survivors/font.ts src/lib/games/animal-survivors/pixels.test.ts
git commit -m "Draw Animal Survivors' evolved weapon icons as gold versions with a star"
```

### Task 2: 進化形の表と、宝箱での進化

**Files:**

- Modify: `src/lib/games/animal-survivors/weapons.ts`
- Create: `src/lib/games/animal-survivors/evolutions.ts`
- Modify: `src/lib/games/animal-survivors/chest.ts`, `choices.ts`, `world.ts`
- Test: `src/lib/games/animal-survivors/evolution.test.ts`（新）

**Interfaces:**

- Produces:
  - `WeaponDef.evolved?: boolean`、`WeaponDef.drain?: number`
  - `EVOLUTIONS: { from: string; with: string; to: string }[]`、`baseOf(id: string): string`、`evolvable(w: World): Evolution | undefined`、`evolve(w: World, e: Evolution): void`
  - `Reward` に `{ kind: 'evolve'; from: string; id: string }`
  - `Choice` の weapon・passive に `evo?: boolean`（進化に使う札）
  - `World.evolvedNow: string[]`（この回に作った進化形）、`RunSummary.evolved: string[]`
  - `GameEvent` に `{ type: 'evolve'; id: string }`

- [ ] **Step 1: 失敗するテストを書く**

`evolution.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { openChest } from './chest';
import { choices } from './choices';
import { EVOLUTIONS, baseOf, evolvable } from './evolutions';
import { PASSIVES } from './passives';
import { MAX_LEVEL, WEAPONS } from './weapons';
import { createWorld, summary } from './world';

const VIEW = { w: 260, h: 380 };

describe('進化の表', () => {
  it('12 組あり、武器はどれも 1 度だけ、パッシブはどれも 1 組以上で使う', () => {
    expect(EVOLUTIONS).toHaveLength(12);
    const base = Object.keys(WEAPONS).filter((id) => !WEAPONS[id].evolved);
    expect(EVOLUTIONS.map((e) => e.from).sort()).toEqual(base.sort());
    for (const id of Object.keys(PASSIVES)) expect(EVOLUTIONS.some((e) => e.with === id)).toBe(true);
    for (const e of EVOLUTIONS) {
      expect(WEAPONS[e.to].evolved).toBe(true);
      expect(WEAPONS[e.to].kind).toBe(WEAPONS[e.from].kind);
      expect(WEAPONS[e.to].ups).toEqual([]);
      expect(baseOf(e.to)).toBe(e.from);
    }
    expect(baseOf('woof')).toBe('woof');
  });
});

describe('宝箱での進化', () => {
  function ready() {
    const w = createWorld('dog', 1, VIEW);
    w.weapons = [{ id: 'woof', level: MAX_LEVEL, cd: 0 }];
    w.passives = [{ id: 'fang', level: 1 }];
    return w;
  }

  it('Lv5 の武器と対のパッシブがあれば、宝箱の 1 つめで進化して同じ枠に入る', () => {
    const w = ready();
    expect(evolvable(w)?.to).toBe('woofEvo');
    w.chests = 1;
    const got = openChest(w);
    expect(got[0]).toEqual({ kind: 'evolve', from: 'woof', id: 'woofEvo' });
    expect(w.weapons[0]).toMatchObject({ id: 'woofEvo', level: MAX_LEVEL });
    expect(summary(w).evolved).toEqual(['woofEvo']);
    expect(w.events.some((e) => e.type === 'evolve')).toBe(true);
  });

  it('対のパッシブが無い・Lv5 でない武器は進化しない', () => {
    const w = ready();
    w.passives = [];
    expect(evolvable(w)).toBeUndefined();
    w.passives = [{ id: 'fang', level: 1 }];
    w.weapons[0].level = MAX_LEVEL - 1;
    expect(evolvable(w)).toBeUndefined();
  });

  it('進化できる武器が 2 つあれば、持っている順の最初の 1 つだけ', () => {
    const w = ready();
    w.weapons.push({ id: 'paw', level: MAX_LEVEL, cd: 0 });
    w.passives.push({ id: 'claw', level: 1 });
    w.chests = 1;
    openChest(w);
    expect(w.weapons.map((o) => o.id)).toEqual(['woofEvo', 'paw']);
    expect(evolvable(w)?.to).toBe('pawEvo');
  });

  it('進化形と、進化した元の武器は 3 択に出ない', () => {
    const w = ready();
    w.weapons[0].id = 'woofEvo';
    for (let i = 0; i < 40; i++)
      for (const c of choices(w)) {
        if (c.kind !== 'weapon') continue;
        expect(WEAPONS[c.id].evolved).toBeFalsy();
        expect(c.id).not.toBe('woof');
      }
  });

  it('進化に使う札には印が付く', () => {
    const w = createWorld('dog', 1, VIEW);
    w.weapons = [{ id: 'woof', level: 2, cd: 0 }];
    w.passives = [];
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++)
      for (const c of choices(w)) if ((c.kind === 'passive' || c.kind === 'weapon') && c.evo) seen.add(c.id);
    expect([...seen]).toEqual(['fang']);
    w.passives = [{ id: 'fang', level: 1 }];
    const marks = new Set<string>();
    for (let i = 0; i < 60; i++)
      for (const c of choices(w)) if ((c.kind === 'passive' || c.kind === 'weapon') && c.evo) marks.add(c.id);
    expect(marks.has('woof')).toBe(true);
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/evolution.test.ts`
Expected: FAIL（`./evolutions` が無い）

- [ ] **Step 3: `weapons.ts` に進化形を足す**

`WeaponDef` に足す。

```ts
  /** 進化形。3 択と宝箱の候補に出ず、それ以上は上がらない */
  evolved?: boolean;
  /** 当たるたびに戻す HP。1 秒に戻せる量には上限がある（world.ts の DRAIN） */
  drain?: number;
```

`w()` の下に進化形を作る `evo()` を足し、`WEAPONS` の配列の末尾に 12 個足す。数値は `[damage, cooldown, amount, area, speed, pierce, duration, knockback]`。

```ts
const evo = (
  id: string,
  name: string,
  blurb: string,
  kind: WeaponKind,
  stats: number[],
  extra: { drain?: number; size?: number } = {}
): WeaponDef => ({
  ...w(id, name, blurb, kind, stats, [], extra.size),
  evolved: true,
  ...(extra.drain && { drain: extra.drain })
});
```

```ts
(evo('woofEvo', 'ホネのあられ', '骨を 4 本ずつ投げ、敵を貫く', 'shot', [18, 0.5, 4, 1.2, 220, 3, 1.4, 50]),
  evo(
    'pawEvo',
    'ネコ百烈拳',
    '前と後ろを同時に引っかき、当たると少し回復',
    'swipe',
    [20, 0.35, 2, 1.6, 0, 99, 0.15, 70],
    { drain: 1 }
  ),
  evo('howlEvo', '月夜の大遠吠え', 'とても大きな輪で、強く吹き飛ばす', 'ring', [28, 2, 1, 2.2, 0, 99, 0.6, 140]),
  evo(
    'boomerangEvo',
    'つむじブーメラン',
    '3 本が飛んで戻り、どこまでも貫く',
    'boomerang',
    [24, 1.2, 3, 1.4, 170, 99, 1.6, 60]
  ),
  evo('featherEvo', '風切り羽の舞', '羽根が増え、ずっと回り続ける', 'orbit', [16, 0.1, 6, 1.4, 4.2, 99, 5, 40]),
  evo('thunderEvo', '雷雲の嵐', '画面の敵へ雷を次々と落とす', 'strike', [40, 0.9, 5, 1.6, 0, 99, 0.25, 30]),
  evo('fishEvo', 'サカナの群れ', '5 匹の魚が追いかけて弾ける', 'homing', [26, 0.9, 5, 1.6, 150, 1, 2.5, 40]),
  evo('clawEvo', '大熊の爪', '大きく重い爪で裂き、当たると少し回復', 'swipe', [24, 0.35, 3, 1.5, 0, 99, 0.12, 60], {
    drain: 1
  }),
  evo('dashEvo', 'はやて突進', '分身が速く多く駆け抜け、敵を貫く', 'shot', [40, 1.2, 3, 1.4, 340, 99, 0.6, 200], {
    size: 10
  }),
  evo('acornEvo', 'どんぐりの大樹', 'どんぐりを全方向へ倍の数で撃ち出す', 'nova', [16, 1, 16, 1.3, 150, 3, 1.6, 40]),
  evo('flameEvo', '燃える心臓', '太く長く残る炎で焼き、当たると少し回復', 'trail', [12, 0.2, 1, 1.8, 0, 99, 4, 0], {
    drain: 0.5
  }),
  evo('vineEvo', '森の守り', '広く長く絡むツタで足止めする', 'snare', [14, 2, 6, 1.6, 0, 99, 4, 0]));
```

`upText` は進化形では呼ばない（`ups` が空）。

- [ ] **Step 4: `evolutions.ts` を作る**

```ts
import { MAX_LEVEL } from './weapons';
import type { World } from './world';

export interface Evolution {
  from: string;
  /** 対のパッシブ。Lv は問わない */
  with: string;
  to: string;
}

export const EVOLUTIONS: Evolution[] = [
  { from: 'woof', with: 'fang', to: 'woofEvo' },
  { from: 'paw', with: 'claw', to: 'pawEvo' },
  { from: 'howl', with: 'roar', to: 'howlEvo' },
  { from: 'boomerang', with: 'paws', to: 'boomerangEvo' },
  { from: 'feather', with: 'whisker', to: 'featherEvo' },
  { from: 'thunder', with: 'drum', to: 'thunderEvo' },
  { from: 'fish', with: 'nose', to: 'fishEvo' },
  { from: 'claw', with: 'fur', to: 'clawEvo' },
  { from: 'dash', with: 'paws', to: 'dashEvo' },
  { from: 'acorn', with: 'leaf', to: 'acornEvo' },
  { from: 'flame', with: 'heart', to: 'flameEvo' },
  { from: 'vine', with: 'leaf', to: 'vineEvo' }
];

/** 進化形の id を元の武器の id にする（描き分けと、元の武器を 3 択に出さないため）。元の武器はそのまま */
export function baseOf(id: string): string {
  return EVOLUTIONS.find((e) => e.to === id)?.from ?? id;
}

/** 今の宝箱で進化できる組。持っている順の最初の 1 つ */
export function evolvable(w: World): Evolution | undefined {
  for (const o of w.weapons) {
    if (o.level < MAX_LEVEL) continue;
    const e = EVOLUTIONS.find((x) => x.from === o.id);
    if (e && w.passives.some((p) => p.id === e.with)) return e;
  }
  return undefined;
}

export function evolve(w: World, e: Evolution): void {
  const own = w.weapons.find((o) => o.id === e.from);
  if (!own) return;
  own.id = e.to;
  own.cd = 0;
  w.evolvedNow.push(e.to);
  w.events.push({ type: 'evolve', id: e.to });
}
```

- [ ] **Step 5: `chest.ts`・`choices.ts`・`world.ts`**

`world.ts`:

- `World` に `evolvedNow: string[];`、`createWorld` で `evolvedNow: []`。
- `GameEvent` に `| { type: 'evolve'; id: string }`。
- `RunSummary` に `evolved: string[];`、`summary()` に `evolved: [...w.evolvedNow]`。

`chest.ts`:

- `Reward` に `| { kind: 'evolve'; from: string; id: string }`。
- `openChest` で、`out` を作ったあと、ループの前に足す。

```ts
  let n = chestSize(w.rand());
  const e = evolvable(w);
  if (e) {
    evolve(w, e);
    out.push({ kind: 'evolve', from: e.from, id: e.to });
    n -= 1;
  }
  for (; n > 0; n--) {
```

（今の `for (let n = chestSize(w.rand()); n > 0; n--)` をこの形にする。`import { evolvable, evolve } from './evolutions';`。宝箱の乱数を引く順は変えない。）

`choices.ts`:

- `Choice` の weapon・passive に `evo?: boolean` を足す（`{ kind: 'weapon'; id: string; level: number; evo?: boolean }`）。
- `candidates` で、新しい武器は進化形と、進化して持っている元の武器を除く。

```ts
const had = new Set(w.weapons.map((o) => baseOf(o.id)));
```

武器の新しい候補を足す行を `for (const id of all) if (!owned.some((o) => o.id === id) && !(kind === 'weapon' && (WEAPONS[id].evolved || had.has(id)))) out.push(...)` にする。

- `choices()` の最後で印を付ける。

```ts
for (const c of out) {
  if (c.kind === 'passive') c.evo = EVOLUTIONS.some((e) => e.with === c.id && w.weapons.some((o) => o.id === e.from));
  else if (c.kind === 'weapon')
    c.evo = EVOLUTIONS.some((e) => e.from === c.id && w.passives.some((p) => p.id === e.with));
}
```

- `levelUp` の武器の分岐は変えない（進化形は 3 択に出ないので通らない）。

- [ ] **Step 6: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/`
Expected: PASS（world.test.ts の `summary` の期待に `evolved: []` を足す。roster.test.ts・progress.test.ts・Pause.svelte.test.ts の `RunSummary` を作るところにも `evolved: []` を足す）

- [ ] **Step 7: Commit**

```bash
git add src/lib/games/animal-survivors/
git commit -m "Evolve Animal Survivors' maxed weapons from chests with their paired passive"
```

### Task 3: 当たって回復と、進化の記録・実績

**Files:**

- Modify: `src/lib/games/animal-survivors/arms.ts`, `zones.ts`, `world.ts`, `records.ts`, `achievements.ts`
- Test: `src/lib/games/animal-survivors/evolution.test.ts`, `progress.test.ts`

**Interfaces:**

- Consumes: `WeaponDef.drain`（Task 2）、`RunSummary.evolved`（Task 2）
- Produces:
  - `damageEnemy(w, i, dmg, kx, ky, crit = false, source?: string)`（`source` は武器の id。Task 9 がダメージ表に使う）
  - `World.drainLeft: number`（今戻せる HP。毎秒 `DRAIN × 最大 HP` ずつ、`DRAIN × 最大 HP` まで戻る）、`export const DRAIN = 0.03`
  - `Records.evolved: string[]`、実績 `evolve1`・`evolveAll`

- [ ] **Step 1: 失敗するテストを書く**

`evolution.test.ts` に足す。

```ts
import { damageEnemy, makeEnemy, step, DRAIN } from './world';
import { ENEMIES } from './enemies';

describe('当たって回復', () => {
  it('drain のある武器で当てると HP が戻り、1 秒に最大 HP の 3% まで', () => {
    const w = createWorld('dog', 1, VIEW);
    w.player.hp = 10;
    for (let i = 0; i < 50; i++) w.enemies.push(makeEnemy(ENEMIES.rat, 10, 0, 999));
    for (let i = 0; i < 50; i++) damageEnemy(w, i, 1, 0, 0, false, 'pawEvo');
    expect(w.player.hp).toBeCloseTo(10 + w.stats.maxHp * DRAIN);
    w.stage = { ...w.stage, waves: [], bosses: [] };
    w.spawnAcc = [];
    w.weapons = [];
    w.enemies.length = 0;
    for (let i = 0; i < 60; i++) step(w, { x: 0, y: 0 }, 1 / 60);
    expect(w.drainLeft).toBeCloseTo(w.stats.maxHp * DRAIN);
  });

  it('drain の無い武器では戻らない', () => {
    const w = createWorld('dog', 1, VIEW);
    w.player.hp = 10;
    w.enemies.push(makeEnemy(ENEMIES.rat, 10, 0, 999));
    damageEnemy(w, 0, 1, 0, 0, false, 'woof');
    expect(w.player.hp).toBe(10);
  });
});
```

`progress.test.ts` の実績の数の確かめを 25 にし、足す。

```ts
it('進化を記録し、はじめての進化と 12 種すべての実績を渡す', () => {
  const r = emptyRecords();
  const got = record(r, run({ evolved: ['woofEvo'] }));
  expect(r.evolved).toEqual(['woofEvo']);
  expect(got.map((a) => a.id)).toContain('evolve1');
  const all = ACHIEVEMENTS.find((a) => a.id === 'evolveAll')!;
  expect(all.progress!(r)).toEqual([1, 12]);
  expect(parseRecords(JSON.stringify({ evolved: ['woofEvo', 'nope', 'woofEvo'] })).evolved).toEqual(['woofEvo']);
});
```

（progress.test.ts の `run()` に `evolved: []` を足しておく。）

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/evolution.test.ts src/lib/games/animal-survivors/progress.test.ts`
Expected: FAIL（`DRAIN` が無い、実績が 23 個）

- [ ] **Step 3: 実装する**

`world.ts`:

- `import { WEAPONS } from './weapons';`
- `export const DRAIN = 0.03;`
- `World` に `drainLeft: number;`、`createWorld` で `drainLeft: s.maxHp * DRAIN`。
- `damageEnemy` に `source?: string` を足し、`e.hp -= dmg;` の前に足す。

```ts
const heal = source ? (WEAPONS[source]?.drain ?? 0) : 0;
if (heal > 0 && w.drainLeft > 0) {
  const amt = Math.min(heal, w.drainLeft);
  w.drainLeft -= amt;
  w.player.hp = Math.min(w.stats.maxHp, w.player.hp + amt);
}
```

- `step` の自然回復の行の次に `w.drainLeft = Math.min(w.stats.maxHp * DRAIN, w.drainLeft + w.stats.maxHp * DRAIN * dt);`。

`arms.ts`:

- `strike(w, i, base, fx, fy, knock)` に `slot: number` を最後に足し、`damageEnemy(…, crit, w.weapons[slot]?.id)` にする。呼び出し 4 か所（swipe・bolt・hitShot・ring）に、それぞれの `slot`／`o.slot`／`f.slot` を渡す。

`zones.ts` の `damageEnemy(w, i, dmg, 0, 0, crit)` を `damageEnemy(w, i, dmg, 0, 0, crit, w.weapons[f.slot]?.id)` にする。

`records.ts`:

- `Records` に `/** 作った進化形 */ evolved: string[];`、`emptyRecords` に `evolved: []`、`parseRecords` に `evolved: list(raw.evolved, EVOLUTIONS.map((e) => e.to))`。
- `record()` に `for (const id of run.evolved) if (!r.evolved.includes(id)) r.evolved.push(id);`（`grant` の前）。

`achievements.ts` の表の末尾に足す。

```ts
  { id: 'evolve1', name: 'はじめての進化', coins: 100, done: (r) => r.evolved.length >= 1 },
  {
    id: 'evolveAll',
    name: '12 種すべて進化',
    coins: 500,
    done: (r) => r.evolved.length >= EVOLUTIONS.length,
    progress: (r) => [r.evolved.length, EVOLUTIONS.length]
  }
```

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/ && pnpm check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/games/animal-survivors/
git commit -m "Heal from Animal Survivors' draining evolutions and record evolutions as achievements"
```

### Task 4: 進化の見せ方

**Files:**

- Modify: `ChestOpen.svelte`, `LevelUp.svelte`, `hud.ts`, `draw-arms.ts`, `Pause.svelte`, `Result.svelte`, `effects.ts`, `sounds.ts`, `Trophies.svelte`
- Create: `src/lib/games/animal-survivors/Evolutions.svelte`
- Test: `src/lib/games/animal-survivors/Evolutions.svelte.test.ts`（新）、`LevelUp.svelte.test.ts`

**Interfaces:**

- Consumes: `itemArt`・`goldArt`（Task 1）、`EVOLUTIONS`・`baseOf`（Task 2）、`Records.evolved`（Task 3）
- Produces: `Evolutions.svelte` の props `{ evolved: string[] }`

- [ ] **Step 1: 失敗するテストを書く**

`Evolutions.svelte.test.ts`:

```ts
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Evolutions from './Evolutions.svelte';

describe('Evolutions', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('12 行あり、作った進化形だけ名前を出し、ほかは ？？？', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Evolutions, { target, props: { evolved: ['woofEvo'] } });
    flushSync();
    expect(target.querySelectorAll('li')).toHaveLength(12);
    expect(target.textContent).toContain('ホネのあられ');
    expect(target.textContent).not.toContain('ネコ百烈拳');
    expect(target.textContent).toContain('？？？');
    expect(target.textContent).toContain('するどい牙');
    unmount(app);
  });
});
```

`LevelUp.svelte.test.ts` に足す。

```ts
it('進化に使う札に「進化」の印を出す', () => {
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(LevelUp, {
    target,
    props: {
      options: [{ kind: 'passive', id: 'fang', level: 1, evo: true }],
      locked: false,
      rerolls: 0,
      onpick: () => {},
      onreroll: () => {}
    }
  });
  flushSync();
  expect(target.querySelector('.evo')?.textContent).toBe('進化');
  unmount(app);
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/Evolutions.svelte.test.ts src/lib/games/animal-survivors/LevelUp.svelte.test.ts`
Expected: FAIL（`Evolutions.svelte` が無い、`.evo` が無い）

- [ ] **Step 3: 実装する**

`Evolutions.svelte`:

```svelte
<script lang="ts">
  import { itemArt } from './art/evolved';
  import { EVOLUTIONS } from './evolutions';
  import { PASSIVES } from './passives';
  import PixelIcon from './PixelIcon.svelte';
  import { WEAPONS } from './weapons';

  let { evolved }: { evolved: string[] } = $props();
  const size = 'min(7cqw, 4cqh, 36px)';
</script>

<h3 class="head">進化 {evolved.length} / {EVOLUTIONS.length}</h3>
<ul>
  {#each EVOLUTIONS as e (e.to)}
    {@const got = evolved.includes(e.to)}
    <li class:got>
      <PixelIcon art={itemArt(`weapon-${e.from}`)} {size} />
      <span class="plus">+</span>
      <PixelIcon art={itemArt(`passive-${e.with}`)} {size} />
      <span class="plus">=</span>
      <span class="evo" class:hidden={!got}><PixelIcon art={itemArt(`weapon-${e.to}`)} {size} /></span>
      <span class="name"
        >{got ? WEAPONS[e.to].name : '？？？'}<small>{WEAPONS[e.from].name}・{PASSIVES[e.with].name}</small></span
      >
    </li>
  {/each}
</ul>

<style>
  .head {
    margin: 0;
    text-align: center;
    color: #ffd84a;
    font-size: min(4.6cqw, 2.8cqh, 24px);
  }

  ul {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    gap: 6px;
    align-items: center;
    padding: 4px 8px;
    background: #1f1530;
    color: #8a7aa8;
    font-size: min(3.4cqw, 2cqh, 17px);
  }

  li.got {
    background: #3a2a14;
    color: #fff3d6;
  }

  .plus {
    color: #8a7aa8;
  }

  .hidden {
    filter: brightness(0);
    opacity: 0.55;
  }

  .name {
    display: grid;
    margin-left: 4px;
  }

  small {
    font-size: 0.75em;
    color: #c9b8e8;
  }
</style>
```

`Trophies.svelte` の `</ul>` の後（もどるの前）に `<Evolutions evolved={r.evolved} />` を足す。

`LevelUp.svelte`:

- アイコンを `itemArt(\`weapon-${c.id}\`)`・`itemArt(\`passive-${c.id}\`)` から引く（`import { itemArt } from './art/evolved';`）。
- `info()` の返り値に `evo: c.evo ?? false` を足し、名前の行のタグの後に `{#if d.evo}<span class="tag evo">進化</span>{/if}` を足す。`.tag.evo { background: #e09a1c; }`。

`ChestOpen.svelte` の `info()` に足す。

```ts
if (r.kind === 'evolve')
  return { key: `e-${r.id}`, art: itemArt(`weapon-${r.id}`), name: WEAPONS[r.id].name, text: '進化！', evo: true };
```

ほかの返り値には `evo: false` を足し、`<li class:evo={d.evo}>` にして `.evo { background: #3a2a14; color: #ffd84a; border: 3px solid #ffd84a; }`。武器のアイコンも `itemArt` から引く。

`Pause.svelte` と `Result.svelte` の武器のアイコンを `itemArt(o.key)` にする（`ITEM_ART[o.key]` の置きかえ）。Result は Task 9 でダメージ表に置きかえるので、ここでは 1 行の差しかえだけにする。

`hud.ts` の `slots` を、`bake(itemArt(\`${prefix}-${o.id}\`))`と、Lv の字を`WEAPONS[o.id]?.evolved ? '*' : String(o.level)` にする（`prefix === 'weapon'`のときだけ`WEAPONS` を見る）。

`draw-arms.ts`:

- `const id = w.weapons[o.slot]?.id ?? ''; const weapon = baseOf(id); const gold = WEAPONS[id]?.evolved ?? false;` にし、`rotated()` に `gold` を渡して `bake(gold ? goldArt(art) : art)` で描く（`goldArt` は控えるので毎フレーム呼んでよい）。
- 炎とツタも、進化形なら `goldArt(ITEM_ART.flame)` で描く。
- 引っかきの `=== 'claw'` を `baseOf(...) === 'claw'` にする。進化形の輪・引っかきの線の色は `PALETTE.y`。

`effects.ts` の `take` に `evolve` を足す（自分の周りに金と白の粒を 40 個、`this.flash = 0.2`、`sounds.evolve()`）。`sounds.ts` に `evolve` を足す（`[523, 659, 784, 1047, 1319]` を 90ms おきに `square` で）。

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/ && pnpm check && pnpm vitals --diff && pnpm exec eslint src/lib/games/animal-survivors`
Expected: PASS

- [ ] **Step 5: headless で撮る**

`Play.svelte` に一時的に `(window as any).__w = world;` を入れ（commit しない）、犬で始めて `woof` を Lv5・`fang` を持たせて `w.chests = 1` にし、宝箱の画面（「進化！ ホネのあられ」）・閉じたあとの金色の骨と HUD の ★ を撮る。実績の画面の進化の表も撮る。Read で見てからフックを外す。

- [ ] **Step 6: Commit**

```bash
git add src/lib/games/animal-survivors/
git commit -m "Show Animal Survivors' evolutions in chests, cards, the HUD, and the achievements screen"
```

### Task 5: ピコピコ音の楽器と、繰り返し流す部品

**Files:**

- Modify: `src/lib/music/instruments.ts`, `src/lib/music/tune.ts`
- Create: `src/lib/music/loop.ts`
- Test: `src/lib/music/loop.test.ts`（新）

**Interfaces:**

- Produces:
  - 楽器 `pulse`・`tri`・`kick`・`hat`（`Instrument` に入る）
  - `Lead` に `'chip'`、`Style` に `'drive'`
  - `class Loop { constructor(get?: () => BaseAudioContext | undefined); play(song: Song | null, bpm: number, gain: number): void; tick(): void; stop(): void; get song(): Song | null }`

- [ ] **Step 1: 失敗するテストを書く**

`loop.test.ts` を作る。pet-house の bgm.test.ts の `fakeContext()` と `run()` を写して使い、`run` は `loop.tick()` を呼ぶ。

```ts
import { describe, expect, it } from 'vitest';
import { renderNote } from './instruments';
import { Loop } from './loop';
import type { Song } from './tune';

const A: Song = {
  beats: 4,
  lead: 'chip',
  style: 'drive',
  melody: 'c5 . e5 . g5 . e5 . | d5 - - - b4 - . .',
  chords: 'C G'
};
const B: Song = {
  beats: 4,
  lead: 'chip',
  style: 'drive',
  melody: 'a4 . c5 . e5 . c5 . | e5 - - - . . . .',
  chords: 'Am E'
};

// fakeContext と run は pet-house/bgm.test.ts と同じもの（ここに写す）

describe('ピコピコ音の楽器', () => {
  it('どれも音が出て、太鼓はすぐ消える', () => {
    for (const name of ['pulse', 'tri', 'kick', 'hat'] as const) {
      const d = renderNote(name, 220);
      expect(d.some((v) => Math.abs(v) > 0.05)).toBe(true);
      expect(d.every(Number.isFinite)).toBe(true);
    }
    const kick = renderNote('kick', 0);
    expect(Math.abs(kick[kick.length - 1])).toBeLessThan(0.01);
  });
});

describe('Loop', () => {
  it('曲を流し、別の曲に替えると替わり、null で止まる', () => {
    const fake = fakeContext();
    const loop = new Loop(() => fake.ctx);
    loop.play(A, 140, 1);
    expect(run(loop, fake, 2).length).toBeGreaterThan(10);
    expect(loop.song).toBe(A);
    loop.play(B, 160, 1);
    run(loop, fake, 0.1);
    expect(loop.song).toBe(B);
    loop.play(null, 0, 0);
    run(loop, fake, 0.1);
    expect(run(loop, fake, 1).filter((s) => s.t > fake.ctx.currentTime + 0.6)).toEqual([]);
  });

  it('ミュートのあいだは鳴らさず、戻すと今の曲を頭から流す', () => {
    const fake = fakeContext();
    let muted = false;
    const loop = new Loop(() => (muted ? undefined : fake.ctx));
    loop.play(A, 140, 1);
    run(loop, fake, 1);
    muted = true;
    loop.play(B, 160, 1);
    const at = fake.ctx.currentTime;
    expect(run(loop, fake, 2).filter((s) => s.t > at + 0.6)).toEqual([]);
    muted = false;
    run(loop, fake, 0.5);
    expect(loop.song).toBe(B);
  });

  it('同じ曲で大きさだけ変えても頭から流し直さない', () => {
    const fake = fakeContext();
    const loop = new Loop(() => fake.ctx);
    loop.play(A, 140, 1);
    run(loop, fake, 1);
    const before = loop.step;
    loop.play(A, 140, 0.4);
    run(loop, fake, 0.05);
    expect(loop.step).toBeGreaterThanOrEqual(before);
  });
});
```

（`Loop` に、確かめのための `get step(): number` を持たせる。）

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run src/lib/music/loop.test.ts`
Expected: FAIL（`./loop` が無い、`pulse` が無い）

- [ ] **Step 3: 楽器を足す**

`instruments.ts` の `DEFS` に足す（倍音を足して作るので、高い倍音が折り返さない）。

```ts
  /** ピコピコの旋律。デューティ 25% の矩形波を倍音で組む */
  pulse: {
    sec: 1.6,
    make: (d, sr, f) => {
      for (let n = 1; f * n < sr * 0.45 && n <= 40; n++) {
        const a = ((2 / (n * Math.PI)) * Math.sin(n * Math.PI * 0.25)) * 0.6;
        for (let i = 0; i < d.length; i++) d[i] += a * Math.sin((2 * Math.PI * f * n * i) / sr);
      }
      shape(d, sr, 0.004, 1.6);
    }
  },
  /** ピコピコの低音。三角波（奇数倍音を 1/n² で） */
  tri: {
    sec: 1.2,
    make: (d, sr, f) => {
      for (let n = 1; f * n < sr * 0.45 && n <= 15; n += 2) {
        const a = (8 / (Math.PI * Math.PI * n * n)) * (((n - 1) / 2) % 2 ? -1 : 1) * 0.8;
        for (let i = 0; i < d.length; i++) d[i] += a * Math.sin((2 * Math.PI * f * n * i) / sr);
      }
      shape(d, sr, 0.003, 1.2);
    }
  },
  /** バスドラム。高さが下がるドン */
  kick: {
    sec: 0.25,
    make: (d, sr) => {
      thump(d, sr, 0, 140, 1, 0.05, 0.9);
      click(d, sr, 0, 0.3, 1500, 4000);
    }
  },
  /** ハイハット。ごく短い高いシャッ */
  hat: {
    sec: 0.05,
    make: (d, sr) => hiss(d, sr, 0, 0.04, 6000, 12000, 0.5, (u) => (1 - u) ** 2)
  },
```

（`thump` を `./synth` の import に足す。）

- [ ] **Step 4: `tune.ts` に `chip` と `drive` を足す**

- `export type Lead = 'box' | 'mallet' | 'bubble' | 'brass' | 'flute' | 'chip';`、`export type Style = 'waltz' | 'bounce' | 'march' | 'gentle' | 'drive';`
- `LEADS` の型を `Record<Lead | 'pluck' | 'bass' | 'pad' | 'tri', Play>` にし、`chip: hold('pulse', 0.45, 0.03, 0.9)`、`tri: hold('tri', 1.1, 0.03, 0.9)` を足す。
- `playStep` の `switch` に足す。

```ts
    case 'drive':
      // 8 ビートで根音と 1 オクターブ上を交互に刻み、1・3 拍にキック、2・4 拍にスネア、裏にハイハット
      LEADS.tri(ctx, out, t, hz(low(c[0]) + (p % 2 ? 12 : 0)), sd * 0.9, BASS);
      if (p === 0 || p === 4) play(ctx, out, t, note(ctx, 'kick', 0), 0.35);
      if (p === 2 || p === 6) tick(ctx, out, t, 0.06);
      if (p % 2) play(ctx, out, t, note(ctx, 'hat', 0), 0.05);
      return;
```

- [ ] **Step 5: `loop.ts` を作る**

```ts
import { AHEAD, FADE, playStep, ramp, scoreOf, type Song } from './tune';
import { bgmOut } from './synth';

/**
 * 曲を繰り返し流す。毎フレーム（か 100ms ごとに）tick() を呼び、AudioContext の時計で AHEAD 秒先までを予約する。
 * get が音の口を返さない（ミュート・wake 前）か画面が隠れているあいだは消し、戻ったら今の曲を頭から流す
 */
export class Loop {
  #want: { song: Song; bpm: number; gain: number } | null = null;
  #now: { song: Song; ctx: BaseAudioContext; bus: GainNode; gain: number } | null = null;
  #step = 0;
  #next = 0;
  readonly #get: () => BaseAudioContext | undefined;

  constructor(get: () => BaseAudioContext | undefined) {
    this.#get = get;
  }

  play(song: Song | null, bpm: number, gain: number): void {
    this.#want = song ? { song, bpm, gain } : null;
  }

  stop(): void {
    this.#want = null;
    this.#release();
  }

  get song(): Song | null {
    return this.#now?.song ?? null;
  }

  get step(): number {
    return this.#step;
  }

  tick(): void {
    const ctx = this.#get();
    const want = this.#want;
    if (!ctx || !want || (typeof document !== 'undefined' && document.hidden)) return this.#release();
    const cur = this.#now;
    if (!cur || cur.ctx !== ctx || cur.song !== want.song) {
      this.#release();
      const b = ctx.createGain();
      b.gain.setValueAtTime(0, ctx.currentTime);
      b.gain.linearRampToValueAtTime(want.gain, ctx.currentTime + FADE);
      b.connect(bgmOut(ctx));
      this.#now = { song: want.song, ctx, bus: b, gain: want.gain };
      this.#step = 0;
      this.#next = ctx.currentTime + 0.05;
    } else if (cur.gain !== want.gain) {
      ramp(cur.bus.gain, ctx.currentTime, want.gain);
      cur.gain = want.gain;
    }
    const now = this.#now!;
    const sc = scoreOf(want.song);
    const sd = 30 / want.bpm;
    // 止まっていたあいだの拍は鳴らさない。まとめて予約すると一度にどっと鳴る
    if (this.#next < ctx.currentTime) this.#next = ctx.currentTime + 0.05;
    while (this.#next < ctx.currentTime + AHEAD) {
      playStep(ctx, now.bus, sc, this.#step, this.#next, sd);
      this.#next += sd;
      this.#step = (this.#step + 1) % sc.notes.length;
    }
  }

  #release() {
    const n = this.#now;
    if (!n) return;
    this.#now = null;
    ramp(n.bus.gain, n.ctx.currentTime, 0);
    setTimeout(() => n.bus.disconnect(), (AHEAD + FADE + 2) * 1000);
  }
}
```

（`ramp` は呼ぶたびに今の値から下げ直すので、目標の大きさが変わったときだけ呼ぶ。`gain.value` は自動の変化の途中の値を返すので、比べるのは `#now.gain` の目標。）

- [ ] **Step 6: 通ることを確かめる**

Run: `pnpm vitest run src/lib/music/ src/lib/games/pet-house/bgm.test.ts src/lib/games/pet-house/sounds.test.ts`
Expected: PASS（わんにゃんハウスの BGM のテストも通る）

- [ ] **Step 7: Commit**

```bash
git add src/lib/music/
git commit -m "Add chiptune instruments, an eight-beat accompaniment, and a looping player to the shared music parts"
```

### Task 6: 3 曲の楽譜と試聴

**Files:**

- Create: `src/lib/games/animal-survivors/songs.ts`
- Test: `src/lib/games/animal-survivors/songs.test.ts`（新）

**Interfaces:**

- Produces: `SONGS: Record<'menu' | 'field' | 'boss', { song: Song; bpm: number; gain: number }>`

- [ ] **Step 1: 失敗するテストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { score } from '$lib/music/tune';
import { SONGS } from './songs';

describe('BGM の楽譜', () => {
  it('3 曲とも小節とコードが読め、森は 16 小節', () => {
    for (const { song } of Object.values(SONGS)) expect(() => score(song)).not.toThrow();
    expect(score(SONGS.field.song).chords).toHaveLength(16);
    expect(SONGS.boss.bpm).toBeGreaterThan(SONGS.field.bpm);
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/songs.test.ts`
Expected: FAIL（`./songs` が無い）

- [ ] **Step 3: 楽譜を書く**

```ts
import type { Song } from '$lib/music/tune';

/** 画面ごとの BGM。書き方は $lib/music/tune の Song。効果音が聞こえるよう gain は小さめ */
export const SONGS: Record<'menu' | 'field' | 'boss', { song: Song; bpm: number; gain: number }> = {
  /** キャラ選択・店・実績・リザルト。軽く弾む */
  menu: {
    bpm: 110,
    gain: 0.5,
    song: {
      beats: 4,
      lead: 'chip',
      style: 'bounce',
      melody: `c5 . e5 . g5 - e5 . | a4 . c5 . e5 - . . | f4 . a4 . c5 . a4 . | g4 - b4 - d5 - . . |
        e5 . g5 . c6 . g5 . | a5 . e5 . c5 - . . | d5 . f5 . a5 . f5 . | g5 - - - . . . .`,
      chords: 'C Am F G C Am F G'
    }
  },
  /** 森。8 ビートで走る */
  field: {
    bpm: 140,
    gain: 0.55,
    song: {
      beats: 4,
      lead: 'chip',
      style: 'drive',
      melody: `e4 . g4 . c5 - b4 g4 | d5 - b4 . g4 . d4 . | c5 . e5 . a4 - g4 e4 | f4 - a4 . c5 - . . |
        e4 g4 c5 e5 d5 . c5 . | b4 . g4 . d5 - . . | a4 . c5 . f5 - e5 d5 | d5 - - - b4 - . . |
        a4 . c5 . e5 . c5 . | f5 - e5 d5 c5 - a4 . | g4 . c5 . e5 - g5 . | f5 . d5 . b4 - g4 . |
        a4 c5 f5 . e5 . c5 . | d5 . b4 . g4 a4 b4 d5 | c5 - e5 - g5 - e5 . | c5 - - - . . . .`,
      chords: 'C G Am F C G F G Am F C G F G C C'
    }
  },
  /** ボス。短調で速い */
  boss: {
    bpm: 160,
    gain: 0.6,
    song: {
      beats: 4,
      lead: 'chip',
      style: 'drive',
      melody: `a4 . a4 c5 e5 . a4 . | g4 . a4 . c5 b4 a4 . | f4 . a4 c5 f5 . e5 . | d5 . b4 . g4 - . . |
        a4 . c5 . e5 . a5 . | g5 . e5 . c5 . a4 . | g#4 . b4 . e5 - d5 . | b4 - - - g#4 - . . |
        e5 . e5 . f5 e5 d5 c5 | c5 . a4 . f4 . a4 . | d5 . d5 . e5 d5 c5 b4 | b4 . g4 . e4 - . . |
        a4 c5 f5 . e5 . c5 . | b4 d5 g5 . f5 . d5 . | e5 . g#5 . b5 - g#5 . | e5 - - - . . . .`,
      chords: 'Am Am F G Am Am E E Am F G Em F G E E'
    }
  }
};
```

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/songs.test.ts`
Expected: PASS

- [ ] **Step 5: WAV に書き出して止まる**

`pnpm dev` が 5173 で動いている前提で、scratchpad の `songs-wav.mjs` を作る。playwright の headless Chrome で `http://localhost:5173/asobibako/` を開き、`page.evaluate` の中で `await import('/asobibako/@fs/<worktree>/src/lib/games/animal-survivors/songs.ts')` と `/@fs/…/src/lib/music/tune.ts` を読み、曲ごとに `new OfflineAudioContext(2, 44100 * 秒, 44100)` へ、`playStep` を 1 周 × 2 回ぶん（`at = 0.05 + i × sd`）予約して `startRendering()` し、チャンネル 0 と 1 を 16bit PCM の配列にして返す。node 側で WAV のヘッダを付けて `scratchpad/song-<id>.wav` に書く（CSP で import が止まるなら、[[model-sheet-harness]] と同じく `bypassCSP: true` の context で開く）。3 つの WAV を利用者に送り、「この曲で進めてよいか」を聞いて止まる。直しが入ったら Step 3 に戻る。

- [ ] **Step 6: Commit**

```bash
git add src/lib/games/animal-survivors/songs.ts src/lib/games/animal-survivors/songs.test.ts
git commit -m "Write Animal Survivors' menu, forest, and boss songs"
```

### Task 7: BGM を画面につなぐ

**Files:**

- Modify: `src/lib/games/animal-survivors/prompts.svelte.ts`, `Play.svelte`, `Survivors.svelte`
- Test: `src/lib/games/animal-survivors/prompts.svelte.test.ts`

**Interfaces:**

- Consumes: `Loop`（Task 5）、`SONGS`（Task 6）
- Produces: `Prompts.boss`（`$state<boolean>`。WARNING で true、ボスを倒したら false）、`Play` の props に `onmusic: (m: { song: 'field' | 'boss'; quiet: boolean }) => void`

- [ ] **Step 1: 失敗するテストを書く**

`prompts.svelte.test.ts` に足す。

```ts
it('WARNING でボスの曲、ボスを倒すと森の曲に戻す', () => {
  const w = createWorld('dog', 1, { w: 274, h: 394 });
  const p = new Prompts(w);
  expect(p.boss).toBe(false);
  w.events = [{ type: 'warning', boss: 'bear' }];
  p.take();
  expect(p.boss).toBe(true);
  w.events = [{ type: 'bossdown', x: 0, y: 0 }];
  p.take();
  expect(p.boss).toBe(false);
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/prompts.svelte.test.ts`
Expected: FAIL（`p.boss` が undefined）

- [ ] **Step 3: 実装する**

`Prompts` に `boss = $state(false);` を足し、`take()` の `for` に `if (e.type === 'bossdown') this.boss = false;` と、`warning` の分岐で `this.boss = true;` を足す。

`Play.svelte`:

- props に `onmusic` を足す（6 つめ）。
- `$effect(() => onmusic({ song: prompts.boss ? 'boss' : 'field', quiet: menu }));`
- 200 行を越えたら、`leave()` と `pause()` を `pause.ts` の関数に寄せるか、`.probe` の CSS を `retro.css` に移す（`as-probe` の名前にする）。

`Survivors.svelte`:

- `import { bus } from '$lib/audio.svelte'; import { Loop } from '$lib/music/loop'; import { SONGS } from './songs';`
- `const loop = new Loop(bus);`、`let field = $state<{ song: 'field' | 'boss'; quiet: boolean }>({ song: 'field', quiet: false });`
- 曲を選ぶ。

```ts
$effect(() => {
  const t = SONGS[screen === 'play' ? field.song : 'menu'];
  loop.play(t.song, t.bpm, screen === 'play' && field.quiet ? t.gain * 0.4 : t.gain);
});
```

- `onMount` で `const id = setInterval(() => loop.tick(), 100);` を足し、返す片付けで `clearInterval(id); loop.stop();`。
- `<Play … onmusic={(m) => (field = m)} />`。`start()` で `field = { song: 'field', quiet: false }` に戻す。

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/ && pnpm check && pnpm vitals --diff`
Expected: PASS

- [ ] **Step 5: headless で確かめる**

scratchpad の台本で、キャラ選択 → 遊ぶ → `__w.time = 297`（一時的なフック、commit しない）で WARNING → 一時停止 → 隠れて戻る、のあいだ、`page.evaluate` で `AudioContext.prototype.createBufferSource` を数えるフックを足して、音が予約され続けていること（一時停止中も 0 にならない、隠れているあいだは増えない）を確かめる。headless で音が鳴らない場合は wake のために 1 度タップを送る。

- [ ] **Step 6: Commit**

```bash
git add src/lib/games/animal-survivors/
git commit -m "Play Animal Survivors' songs for the menus, the forest, and boss fights"
```

### Task 8: 群れの大波

**Files:**

- Modify: `src/lib/games/animal-survivors/stages/forest.ts`, `world.ts`, `prompts.svelte.ts`, `PromptLayer.svelte`, `sounds.ts`, `effects.ts`
- Test: `src/lib/games/animal-survivors/swarm.test.ts`（新）

**Interfaces:**

- Produces:
  - `Stage.events: { at: number; kind: 'swarm' | 'ring'; enemy: string; count: number; text: string }[]`
  - `Enemy.drift: number`（まっすぐ飛ぶ残りの秒。0 より大きいあいだは追わず、`dx`・`dy` へ進み、0 になったら消える）
  - `World.eventNext: number`、`GameEvent` に `{ type: 'swarm'; text: string }`
  - `spawnEvents(w: World): void`、`addEnemy(w, def, x, y): Enemy | null`
  - `Prompts.notice`（`$state<{ text: string; key: number; until: number } | null>`）

- [ ] **Step 1: 失敗するテストを書く**

`swarm.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ENEMIES } from './enemies';
import { FOREST } from './stages/forest';
import { MAX_ENEMIES, createWorld, spawnEvents, step } from './world';

const VIEW = { w: 274, h: 394 };

function quiet() {
  const w = createWorld('dog', 1, VIEW);
  w.stage = { ...w.stage, waves: [], bosses: [] };
  w.spawnAcc = [];
  w.weapons = [];
  return w;
}

describe('群れの大波', () => {
  it('森の出来事は時刻の順で、ボスの時刻を避ける', () => {
    const at = FOREST.events.map((e) => e.at);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    for (const b of FOREST.bosses) for (const t of at) expect(Math.abs(t - b.at)).toBeGreaterThan(20);
  });

  it('横切る群れは同じ向きにまっすぐ進み、抜けたら消えて倒した数に入らない', () => {
    const w = quiet();
    w.stage = { ...w.stage, events: [{ at: 1, kind: 'swarm', enemy: 'bat', count: 20, text: 'コウモリの大群！' }] };
    w.time = 1;
    spawnEvents(w);
    const flock = w.enemies.filter((e) => e.alive);
    expect(flock).toHaveLength(20);
    expect(new Set(flock.map((e) => `${e.dx.toFixed(3)},${e.dy.toFixed(3)}`)).size).toBe(1);
    expect(w.events.some((e) => e.type === 'swarm')).toBe(true);
    w.player.invuln = 999;
    for (let i = 0; i < 60 * 20; i++) step(w, { x: 0, y: 0 }, 1 / 60);
    expect(w.enemies.filter((e) => e.alive)).toHaveLength(0);
    expect(w.kills).toBe(0);
  });

  it('迫る輪は自分を囲んで出る', () => {
    const w = quiet();
    w.stage = { ...w.stage, events: [{ at: 1, kind: 'ring', enemy: 'rat', count: 40, text: 'ネズミに囲まれた！' }] };
    w.time = 1;
    spawnEvents(w);
    const ring = w.enemies.filter((e) => e.alive);
    expect(ring).toHaveLength(40);
    const d = ring.map((e) => Math.hypot(e.x - w.player.x, e.y - w.player.y));
    expect(Math.max(...d) - Math.min(...d)).toBeLessThan(1);
    const quads = new Set(ring.map((e) => `${e.x > w.player.x}${e.y > w.player.y}`));
    expect(quads.size).toBe(4);
  });

  it('入れ物が足りなければ出せる分だけ出し、落ちない', () => {
    const w = quiet();
    w.stage = { ...w.stage, events: [{ at: 1, kind: 'ring', enemy: 'rat', count: MAX_ENEMIES + 50, text: '' }] };
    w.time = 1;
    spawnEvents(w);
    expect(w.enemies.length).toBe(MAX_ENEMIES);
    expect(() => step(w, { x: 0, y: 0 }, 1 / 60)).not.toThrow();
  });

  it('同じ出来事は 1 度だけ', () => {
    const w = quiet();
    w.stage = { ...w.stage, events: [{ at: 1, kind: 'ring', enemy: 'rat', count: 5, text: '' }] };
    w.time = 1;
    spawnEvents(w);
    spawnEvents(w);
    expect(w.enemies.filter((e) => e.alive)).toHaveLength(5);
  });

  it('体力はそのときの toughness を掛ける', () => {
    const w = quiet();
    w.stage = { ...w.stage, events: [{ at: 600, kind: 'ring', enemy: 'rat', count: 1, text: '' }] };
    w.time = 600;
    spawnEvents(w);
    expect(w.enemies[0].hp).toBeCloseTo(ENEMIES.rat.hp * w.stage.toughness(600));
  });
});
```

`prompts.svelte.test.ts` に足す。

```ts
it('群れの帯をゲームの時間で 2 秒出す', () => {
  const w = createWorld('dog', 1, { w: 274, h: 394 });
  const p = new Prompts(w);
  w.time = 90;
  w.events = [{ type: 'swarm', text: 'コウモリの大群！' }];
  p.take();
  expect(p.notice?.text).toBe('コウモリの大群！');
  w.events = [];
  w.time = 92.1;
  p.take();
  expect(p.notice).toBeNull();
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/swarm.test.ts src/lib/games/animal-survivors/prompts.svelte.test.ts`
Expected: FAIL（`spawnEvents` が無い、`FOREST.events` が無い）

- [ ] **Step 3: ステージの表**

`stages/forest.ts` の `Stage` に足す。

```ts
/** 時刻ごとの出来事。swarm は群れが画面を横切り、ring は輪になって迫る */
events: {
  at: number;
  kind: 'swarm' | 'ring';
  enemy: string;
  count: number;
  text: string;
}
[];
```

`FOREST` に足す。

```ts
  events: [
    { at: 90, kind: 'swarm', enemy: 'bat', count: 30, text: 'コウモリの大群！' },
    { at: 180, kind: 'ring', enemy: 'rat', count: 40, text: 'ネズミに囲まれた！' },
    { at: 270, kind: 'swarm', enemy: 'bat', count: 50, text: 'コウモリの大群！' },
    { at: 390, kind: 'swarm', enemy: 'boar', count: 12, text: 'イノシシの突進！' },
    { at: 480, kind: 'ring', enemy: 'caterpillar', count: 40, text: 'イモムシに囲まれた！' },
    { at: 660, kind: 'swarm', enemy: 'bat', count: 80, text: 'コウモリの大群！' },
    { at: 750, kind: 'ring', enemy: 'snake', count: 60, text: 'ヘビに囲まれた！' },
    { at: 840, kind: 'swarm', enemy: 'boar', count: 20, text: 'イノシシの突進！' }
  ],
```

- [ ] **Step 4: `world.ts`**

- `Enemy` に `/** まっすぐ飛ぶ残りの秒（群れ）。0 になったら消え、倒した数には入らない */ drift: number;`、`makeEnemy` で `drift: 0`。
- `World` に `eventNext: number;`、`createWorld` で `eventNext: 0`。`GameEvent` に `| { type: 'swarm'; text: string }`。
- 今の `spawn()` の入れ物を探すところを `addEnemy` に出す。

```ts
/** 入れ物に敵を 1 体置く。400 体を使い切っていれば null */
export function addEnemy(w: World, def: EnemyDef, x: number, y: number): Enemy | null {
  const hp = def.hp * w.stage.toughness(w.time);
  const free = w.enemies.find((e) => !e.alive);
  if (free) Object.assign(free, makeEnemy(def, x, y, hp), { hit: free.hit.fill(-1) });
  else if (w.enemies.length < MAX_ENEMIES) w.enemies.push(makeEnemy(def, x, y, hp));
  else return null;
  const e = free ?? w.enemies[w.enemies.length - 1];
  e.phase = w.rand() * Math.PI * 2;
  return e;
}
```

（`spawn()` は `addEnemy(w, def, at.x, at.y)` を呼ぶだけにする。ボスの `spawnBosses` が `toughness` を掛けない作りなら、そちらは触らない。）

- 出来事を出す。

```ts
const SWARM_SPEED = 1.5;

export function spawnEvents(w: World): void {
  const list = w.stage.events;
  while (w.eventNext < list.length && list[w.eventNext].at <= w.time) {
    const ev = list[w.eventNext++];
    const def = ENEMIES[ev.enemy];
    const p = w.player;
    const r = Math.hypot(w.view.w, w.view.h) / 2 + 24;
    if (ev.kind === 'ring') {
      for (let i = 0; i < ev.count; i++) {
        const a = (i / ev.count) * Math.PI * 2;
        if (!addEnemy(w, def, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r)) break;
      }
    } else {
      // 画面の外の片側に、進む向きと直角に帯になって並び、反対側へ抜ける
      const a = w.rand() * Math.PI * 2;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      const life = (2 * r + 60) / (def.speed * SWARM_SPEED);
      for (let i = 0; i < ev.count; i++) {
        const side = (i / Math.max(1, ev.count - 1) - 0.5) * r * 1.6;
        const back = w.rand() * 40;
        const e = addEnemy(w, def, p.x - dx * (r + back) - dy * side, p.y - dy * (r + back) + dx * side);
        if (!e) break;
        Object.assign(e, { dx, dy, drift: life });
      }
    }
    w.events.push({ type: 'swarm', text: ev.text });
  }
}
```

- `moveEnemy` の先頭（`const move = e.def.move;` の前）に足す。

```ts
if (e.drift > 0) {
  e.drift -= dt;
  if (e.drift <= 0) e.alive = false;
  e.x += e.dx * e.def.speed * SWARM_SPEED * dt;
  e.y += e.dy * e.def.speed * SWARM_SPEED * dt;
  e.t += dt;
  e.flash -= dt;
  return;
}
```

- `step` の遠すぎる敵の置き直しを `if (e.drift <= 0 && …)` にする。`spawnBosses(w);` の次に `spawnEvents(w);`。
- 吹き飛ばし（`kx`・`ky`）は群れにも効かせない（`drift` のあいだは移動を自分で書くので無視される）。

`prompts.svelte.ts` に `notice = $state<{ text: string; key: number; until: number } | null>(null);` を足し、`take()` で `if (e.type === 'swarm' && e.text) this.notice = { text: e.text, key: w.time, until: w.time + 2 };`、`if (this.notice && w.time >= this.notice.until) this.notice = null;`。

`PromptLayer.svelte` の先頭に足す。

```svelte
{#if prompts.notice}
  {#key prompts.notice.key}
    <p class="notice" role="status">{prompts.notice.text}</p>
  {/key}
{/if}

<style>
  .notice {
    position: absolute;
    top: 20%;
    left: 50%;
    z-index: 3;
    margin: 0;
    padding: 4px 16px;
    border: 3px solid #24151f;
    background: #ffd84a;
    color: #24151f;
    font-weight: 900;
    font-size: min(4.6cqw, 2.8cqh, 24px);
    translate: -50% 0;
    pointer-events: none;
    animation: slide 300ms steps(3);
  }

  @keyframes slide {
    from {
      translate: -50% -40px;
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .notice {
      animation: none;
    }
  }
</style>
```

`sounds.ts` に `swarm: () => sweep(200, 600, 300, 0.07)` を足し、`effects.ts` の `take` で `else if (e.type === 'swarm') sounds.swarm();`。

- [ ] **Step 5: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/ && pnpm check`
Expected: PASS

- [ ] **Step 6: headless で撮る**

一時的なフックで `__w.time = 89` から進め、コウモリの群れが横切る画面と帯、`__w.time = 179` からネズミの輪を撮る。Read で見てからフックを外す。

- [ ] **Step 7: Commit**

```bash
git add src/lib/games/animal-survivors/
git commit -m "Send swarms and closing rings through Animal Survivors' forest on a timeline"
```

### Task 9: リザルトの武器ごとのダメージ表

**Files:**

- Modify: `src/lib/games/animal-survivors/world.ts`, `Result.svelte`
- Create: `src/lib/games/animal-survivors/DamageTable.svelte`
- Test: `src/lib/games/animal-survivors/evolution.test.ts`, `src/lib/games/animal-survivors/DamageTable.svelte.test.ts`（新）

**Interfaces:**

- Consumes: `damageEnemy(…, source)`（Task 3）
- Produces: `World.dealt: Record<string, { damage: number; kills: number }>`、`RunSummary.dealt: { id: string; damage: number; kills: number }[]`（ダメージの多い順）、`DamageTable.svelte` の props `{ run: RunSummary }`

- [ ] **Step 1: 失敗するテストを書く**

`evolution.test.ts` に足す。

```ts
describe('ダメージ表', () => {
  it('武器ごとにダメージ（残りの HP を越えない）と倒した数を数え、多い順に並べる', () => {
    const w = createWorld('dog', 1, VIEW);
    for (let i = 0; i < 3; i++) w.enemies.push(makeEnemy(ENEMIES.rat, 10, 0, 10));
    damageEnemy(w, 0, 25, 0, 0, false, 'woof');
    damageEnemy(w, 1, 4, 0, 0, false, 'paw');
    damageEnemy(w, 2, 30, 0, 0, false, 'paw');
    expect(summary(w).dealt).toEqual([
      { id: 'paw', damage: 14, kills: 1 },
      { id: 'woof', damage: 10, kills: 1 }
    ]);
  });

  it('クリアの一掃はどの武器にも数えない', () => {
    const w = createWorld('dog', 1, VIEW);
    w.enemies.push(makeEnemy(ENEMIES.rat, 10, 0, 10));
    w.time = w.stage.length;
    step(w, { x: 0, y: 0 }, 1 / 60);
    expect(summary(w).dealt).toEqual([]);
  });
});
```

`DamageTable.svelte.test.ts`:

```ts
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import DamageTable from './DamageTable.svelte';
import type { RunSummary } from './world';

const run: RunSummary = {
  animal: 'dog',
  cleared: false,
  time: 300,
  level: 10,
  kills: 50,
  xp: 0,
  weapons: [
    { id: 'woofEvo', level: 5 },
    { id: 'paw', level: 3 }
  ],
  passives: [{ id: 'fang', level: 2 }],
  bosses: [],
  coins: 0,
  opened: 0,
  evolved: ['woofEvo'],
  dealt: [
    { id: 'woofEvo', damage: 1200, kills: 40 },
    { id: 'paw', damage: 300, kills: 10 }
  ]
};

describe('DamageTable', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('武器ごとに名前・Lv（進化形は ★）・ダメージ・倒した数を、多い順に出す', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(DamageTable, { target, props: { run } });
    flushSync();
    const rows = [...target.querySelectorAll('tbody tr')].map((r) => r.textContent?.replace(/\s+/g, ' ').trim());
    expect(rows[0]).toContain('ホネのあられ');
    expect(rows[0]).toContain('★');
    expect(rows[0]).toContain('1,200');
    expect(rows[1]).toContain('Lv3');
    unmount(app);
  });
});
```

（world.test.ts・roster.test.ts・progress.test.ts・Pause.svelte.test.ts の `RunSummary` にも `dealt: []` を足す。）

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/evolution.test.ts src/lib/games/animal-survivors/DamageTable.svelte.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装する**

`world.ts`:

- `World` に `dealt: Record<string, { damage: number; kills: number }>;`、`createWorld` で `dealt: {}`。
- `damageEnemy` で、`e.hp -= dmg;` の前に `const real = Math.max(0, Math.min(dmg, e.hp));`、後に `if (source) { const d = (w.dealt[source] ??= { damage: 0, kills: 0 }); d.damage += real; }`。倒したとき（`w.kills += 1;` の次）に `if (source) w.dealt[source].kills += 1;`。
- `RunSummary` に `dealt: { id: string; damage: number; kills: number }[];`、`summary()` で `dealt: Object.entries(w.dealt).map(([id, d]) => ({ id, damage: Math.round(d.damage), kills: d.kills })).sort((a, b) => b.damage - a.damage)`。

`DamageTable.svelte`:

```svelte
<script lang="ts">
  import { itemArt } from './art/evolved';
  import PixelIcon from './PixelIcon.svelte';
  import { WEAPONS } from './weapons';
  import type { RunSummary } from './world';

  let { run }: { run: RunSummary } = $props();

  const top = $derived(Math.max(1, ...run.dealt.map((d) => d.damage)));
  const level = (id: string) => run.weapons.find((o) => o.id === id)?.level ?? 0;
  const n = (v: number) => v.toLocaleString('ja-JP');
</script>

<table>
  <thead>
    <tr><th>武器</th><th>ダメージ</th><th>撃破</th></tr>
  </thead>
  <tbody>
    {#each run.dealt as d (d.id)}
      <tr style:--r={d.damage / top}>
        <td class="name">
          <PixelIcon art={itemArt(`weapon-${d.id}`)} size="min(6cqw, 3.6cqh, 32px)" />
          {WEAPONS[d.id].name}<small>{WEAPONS[d.id].evolved ? '★' : `Lv${level(d.id)}`}</small>
        </td>
        <td>{n(d.damage)}</td>
        <td>{n(d.kills)}</td>
      </tr>
    {/each}
  </tbody>
</table>
<ul class="passives" aria-label="取ったパッシブ">
  {#each run.passives as o (o.id)}
    <li><PixelIcon art={itemArt(`passive-${o.id}`)} size="min(7cqw, 4cqh, 36px)" /><span>{o.level}</span></li>
  {/each}
</ul>

<style>
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: min(3.4cqw, 2cqh, 17px);
  }

  th {
    color: #c9b8e8;
    font-weight: 700;
    text-align: right;
  }

  th:first-child,
  .name {
    text-align: left;
  }

  td {
    padding: 3px 6px;
    text-align: right;
    color: #ffd84a;
  }

  tr {
    background: linear-gradient(90deg, rgb(216 70 60 / 0.35) calc(var(--r, 0) * 100%), transparent 0);
  }

  .name {
    display: flex;
    gap: 6px;
    align-items: center;
    color: #fff3d6;
  }

  small {
    color: #ffd84a;
  }

  .passives {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .passives li {
    position: relative;
    padding: 3px;
    background: #1f1530;
  }

  .passives span {
    position: absolute;
    right: 2px;
    bottom: 0;
    color: #ffd84a;
    font-size: min(3cqw, 1.8cqh, 14px);
  }
</style>
```

`Result.svelte` の「取った武器とパッシブ」の `<ul class="owned">` と `owned` の `$derived`、`.owned`・`.slot`・`.lv` の CSS を消し、`<DamageTable {run} />` に置きかえる（倒した武器が無い回でも、表の見出しとパッシブは出る）。

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/ && pnpm check && pnpm vitals --diff && pnpm exec markuplint "src/lib/games/animal-survivors/*.svelte"`
Expected: PASS

- [ ] **Step 5: headless で撮る**

一時的なフックで 5 分ほど遊ばせて（`__w.time = 301; __w.player.hp = 1`）、リザルトの表を撮る。iPhone の幅（390×844）でも撮る。

- [ ] **Step 6: Commit**

```bash
git add src/lib/games/animal-survivors/
git commit -m "Show damage and kills per weapon on Animal Survivors' result"
```

### Task 10: ボットで確かめて、文書を最新にする

**Files:**

- Modify: `src/lib/games/animal-survivors/weapons.ts`・`stages/forest.ts`（数値を直すときだけ）
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-10-02-animal-survivors-evolution-design.md`

- [ ] **Step 1: ボットで測る**

scratchpad の `sim/survivors.sim.ts` を、宝箱で `openChest` を呼ぶときに進化も起きる今のまま、`OUT=` を変えて 2 通り回す（`RANKS` なし・`RANKS=max`、7 匹 × 2 つの選び方 × 8 回）。`sum.mjs` に「進化した回の割合」と「進化形のダメージの割合」（`dealt` から）を足す。

- 強化なしの生存の中央値が前の結果（609〜900 秒）から 1 分以上下がったら、群れの数を減らす。
- 進化した回でも全部最大でも、生存が今より極端に延びすぎない（強化なしでクリアが 8/8 にならない）こと。延びすぎる進化形があれば、その数値を下げる。

- [ ] **Step 2: 文書を直す**

`CLAUDE.md` の Animal Survivors の段落に、進化（`evolutions.ts`・宝箱の 1 つめ・進化形は同じ動き方の強い武器で `evolved`・`drain` の上限・絵は `art/evolved.ts` の金色と ★・元の武器は 3 択に出ない）、BGM（`songs.ts`・`$lib/music/loop.ts`・WARNING でボスの曲・一時停止で小さく）、群れ（ステージの `events`・`drift` の敵は置き直さず、抜けたら消えて数えない）、ダメージ表（`damageEnemy` の `source`・`World.dealt`）を足す。`$lib/music` の説明（わんにゃんハウスの段落）に、ピコピコ音の楽器と `drive` と `Loop` を足す。spec は直した数値に合わせ、「## 6. 調整の結果」に測った数を書く。

- [ ] **Step 3: まとめて確かめる**

Run: `pnpm verify`
Expected: 全部 PASS

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-10-02-animal-survivors-evolution-design.md src/lib/games/animal-survivors/
git commit -m "Check Animal Survivors' evolutions and swarms with the bot and document them"
```

- [ ] **Step 5: 全体を見てもらう**

別の係（最も強いモデル）にブランチ全体を見てもらい、Critical と Important を直してから、main へ push してよいかを聞く。
