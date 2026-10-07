# アニマルサバイバー ステージの探索 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ステージに、拾うとずっと効く遺物 8 つと、触れるとその回だけご利益のある祠を置く。

**Architecture:** 遺物の表と決まった置き場所は `relics.ts`、祠の置き方は障害物と同じ位置のハッシュで `shrines.ts` が持つ（どちらも DOM を使わない）。遺物は品（`Item` の `kind: 'relic'`）として始めに置き、拾うと `World.relics` に入って効き目がすぐ出て、`Prompts` が記録へすぐ書く。祠は使った区画を `World.shrinesUsed` に覚え、ご利益は動物ごとの `Hero.blessing` の時計で持つ。協力プレイは snap に遺物の番号・持っている遺物・使った祠・ご利益を足す。

**Tech Stack:** TypeScript、Svelte 5、vitest、canvas 2D

**Spec:** `docs/superpowers/specs/2026-10-08-animal-survivors-exploration-design.md`

## Global Constraints

- 遺物はステージごとに 2 つ、全部で 8 つ（古い地図・魔法のランプ／古い懐中時計・銀の鈴／雪の結晶・氷の鏡／炎の宝玉・黒曜石のかけら）。効き目は spec の表のとおり
- 1 つめは始めの位置から 700 ドットほど、2 つめは 1500 ドットほど。向きはステージごとに決め、毎回同じ場所。障害物の中には置かない
- 上を歩けば拾える（宝箱と同じ）。拾うと「遺物を手に入れた！」の帯。拾った時点で記録に入れ、倒れても・やめても残る。拾ったあとの回には置かない
- 遺物から 400 ドットほどに入ると画面の端にきらめく矢印。古い地図のあとはどの距離でも
- ステージを選ぶ画面の札に「遺物 N / 2」、図鑑に遺物のタブ（まだのものは影）
- ふたりで遊ぶときは、どちらが拾っても 2 人とももらえる
- 祠は 160 ドットの区画 10 個に 1 つほど、位置のハッシュで毎回同じ。始めの位置のまわりと障害物の上には置かない。2 台で同じ場所
- 祠は 5 種（力 30 秒攻撃 +30%・風 30 秒速さ +30%・知恵 30 秒経験値 2 倍・宝 その場に宝箱・癒し 全快）。触れると消え、その回は戻らない
- ご利益の時計は step の中で進む。同じご利益が続けば残りをのばす。氷の鏡で 1.5 倍。HUD に印と残りの秒
- ふたりで遊ぶときは、触れた動物にだけ効く。宝の祠の宝箱は触れた動物のもの
- 絵は見本で承認された 8 つの遺物と 5 つの祠（scratchpad の `explore/art.json`）。大群の中で点滅は使わない
- コードコメントは非自明な WHY だけ。コンポーネントは 200 行未満

## Review Focus

- 遺物を拾った回にアプリが閉じられても、記録に遺物が残る（拾った出来事で `Prompts` が記録へ書く。Task 4 のテスト）
- 記録に書いたあと、回の終わりの `record()` が古い記録の写しで遺物を消さない（`record()` が回のまとめの `relics` を足す。Task 2 のテスト）
- 協力プレイで子が拾った遺物が、子の端末の記録にも入る（snap の出来事と、子のまとめの `relics`。Task 2 のテスト）
- 祠に 2 匹が同じフレームで触れても、ご利益は 1 匹だけで、祠は 1 回で消える（Task 3 のテスト）
- 子の端末で、風の祠の速さが子の動物の動きに効く（`CoopGuest.move` が snap のご利益を読む。Task 3 のテスト）

---

## ファイルの分け方

| ファイル                              | 役目                                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `relics.ts`（新）                     | 遺物の表 `RELICS`・置き場所 `relicSpot()`・始めに置く `placeRelics()`・`hasRelic()`・拾う `takeRelic()`                              |
| `shrines.ts`（新）                    | 祠の置き方 `shrineAt()`・`shrinesNear()`・触れる `touchShrines()`・ご利益の時計 `stepBlessing()`・`BLESS_SECS`                       |
| `art/explore.ts`（新）                | 遺物 8 つと祠 5 つの絵                                                                                                               |
| `draw-explore.ts`（新）               | 祠を描く・地面の遺物を描く・遺物への矢印・HUD のご利益                                                                               |
| `RelicCount` は無し                   | ステージの札は `StageSelect.svelte` に 1 行                                                                                          |
| `world.ts`                            | `Options.relics`・`World.relics`・`relicsNow`・`shrinesUsed`・`RunSummary.relics`・step で祠に触れる・遺物の効き目（ランタン・溶岩） |
| `heroes.ts`                           | `HERO_KEYS` に `blessing`                                                                                                            |
| `drops.ts`                            | `Item.kind` に `relic`・`Item.relic`・拾う・時計の品の秒・知恵の祠の経験値                                                           |
| `arms.ts`                             | 力の祠の攻撃                                                                                                                         |
| `events.ts`                           | 銀の鈴の宝箱の秒                                                                                                                     |
| `chest.ts`                            | 炎の宝玉の中身の割合                                                                                                                 |
| `records.ts`                          | 記録の `relics`・すぐ書く `keepRelic()`・`record()` が回の `relics` を足す                                                           |
| `snap.ts`・`coop.ts`                  | 遺物の番号・持っている遺物・使った祠・ご利益・子の動きの速さ                                                                         |
| `prompts.svelte.ts`                   | 遺物と祠の帯、遺物を記録へすぐ書く                                                                                                   |
| `draw.ts`・`hud.ts`                   | 祠・遺物・矢印・ご利益を描く順に入れる                                                                                               |
| `StageSelect.svelte`                  | 「遺物 N / 2」                                                                                                                       |
| `book-view.ts`・`Book.svelte`         | 遺物のタブ                                                                                                                           |
| `Survivors.svelte`・`CoopRoom.svelte` | 持っている遺物を `createWorld` に渡す                                                                                                |
| `CLAUDE.md`                           | アニマルサバイバーの段落に探索の 2〜3 文                                                                                             |

---

### Task 1: 遺物の表と置き場所・祠の置き方

**Files:**

- Create: `src/lib/games/animal-survivors/relics.ts`
- Create: `src/lib/games/animal-survivors/shrines.ts`
- Create: `src/lib/games/animal-survivors/explore.test.ts`

**Interfaces:**

- Consumes: `obstacles.ts` の `CELL`・`hash`・`obstaclesNear`・`pushOut`・`type Ground`
- Produces:
  - `type RelicId = 'map' | 'lamp' | 'watch' | 'bell' | 'flake' | 'mirror' | 'orb' | 'shard'`
  - `interface RelicDef { id: RelicId; name: string; blurb: string; stage: string; angle: number; dist: number }`
  - `RELICS: RelicDef[]`、`RELIC_IDS: RelicId[]`
  - `relicSpot(def: RelicDef, g: Ground): { x: number; y: number }`
  - `type ShrineKind = 'power' | 'wind' | 'wisdom' | 'treasure' | 'heal'`
  - `interface Shrine { x: number; y: number; kind: ShrineKind; key: number }`
  - `shrineAt(g: Ground, cx: number, cy: number): Shrine | null`
  - `shrinesNear(g: Ground, x: number, y: number, r: number, out: Shrine[]): Shrine[]`
  - `SHRINE_NAME: Record<ShrineKind, string>`

- [ ] **Step 1: 失敗するテストを書く**

`explore.test.ts` を作る。

```ts
import { describe, expect, it } from 'vitest';
import { obstaclesNear, type Ground } from './obstacles';
import { relicSpot, RELICS } from './relics';
import { shrineAt, shrinesNear } from './shrines';
import { STAGES } from './stages';

const GROUNDS: Ground[] = ['forest', 'graveyard', 'snow', 'volcano'];

describe('遺物の置き場所', () => {
  it('ステージごとに 2 つで、全部で 8 つ', () => {
    expect(RELICS).toHaveLength(8);
    for (const s of STAGES) expect(RELICS.filter((r) => r.stage === s.id)).toHaveLength(2);
  });

  it('1 つめは 700 ドット、2 つめは 1500 ドットほど離れ、障害物の中に無い', () => {
    for (const s of STAGES) {
      const [a, b] = RELICS.filter((r) => r.stage === s.id).map((r) => relicSpot(r, s.art));
      expect(Math.hypot(a.x, a.y)).toBeGreaterThan(650);
      expect(Math.hypot(a.x, a.y)).toBeLessThan(760);
      expect(Math.hypot(b.x, b.y)).toBeGreaterThan(1430);
      expect(Math.hypot(b.x, b.y)).toBeLessThan(1570);
      for (const p of [a, b]) expect(obstaclesNear(s.art, p.x, p.y, 8, [])).toEqual([]);
    }
  });

  it('毎回同じ場所', () => {
    for (const r of RELICS) expect(relicSpot(r, 'forest')).toEqual(relicSpot(r, 'forest'));
  });
});

describe('祠の置き方', () => {
  it('およそ 10 区画に 1 つ（40 × 40 区画で 6〜15%）、5 種が出る', () => {
    for (const g of GROUNDS) {
      let n = 0;
      const kinds = new Set<string>();
      for (let cx = -20; cx < 20; cx++)
        for (let cy = -20; cy < 20; cy++) {
          const s = shrineAt(g, cx, cy);
          if (!s) continue;
          n++;
          kinds.add(s.kind);
        }
      expect(n / 1600).toBeGreaterThan(0.06);
      expect(n / 1600).toBeLessThan(0.15);
      expect(kinds.size).toBe(5);
    }
  });

  it('始めの位置から 120 ドットの中と、障害物の上には無い', () => {
    for (const g of GROUNDS) {
      expect(shrinesNear(g, 0, 0, 120, [])).toEqual([]);
      for (let cx = -15; cx < 15; cx++)
        for (let cy = -15; cy < 15; cy++) {
          const s = shrineAt(g, cx, cy);
          if (s) expect(obstaclesNear(g, s.x, s.y, 12, [])).toEqual([]);
        }
    }
  });

  it('区画の番号は祠ごとに違い、毎回同じ', () => {
    const keys = new Set<number>();
    for (let cx = -10; cx < 10; cx++)
      for (let cy = -10; cy < 10; cy++) {
        const s = shrineAt('forest', cx, cy);
        if (!s) continue;
        expect(keys.has(s.key)).toBe(false);
        keys.add(s.key);
        expect(shrineAt('forest', cx, cy)).toEqual(s);
      }
  });
});
```

（`STAGES` の import 元は `stages/index.ts`。名前が違えば合わせて台帳に書く。）

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/explore.test.ts`
Expected: FAIL（`./relics` が無い）

- [ ] **Step 3: 実装する**

`relics.ts`:

```ts
import { pushOut, type Ground } from './obstacles';

export type RelicId = 'map' | 'lamp' | 'watch' | 'bell' | 'flake' | 'mirror' | 'orb' | 'shard';

export interface RelicDef {
  id: RelicId;
  name: string;
  blurb: string;
  stage: string;
  /** 始めの位置から見た向き（ラジアン）と距離（ドット） */
  angle: number;
  dist: number;
}

const r = (id: RelicId, name: string, blurb: string, stage: string, angle: number, dist: number): RelicDef => ({
  id,
  name,
  blurb,
  stage,
  angle,
  dist
});

export const RELICS: RelicDef[] = [
  r('map', '古い地図', '遠くにある、まだ拾っていない遺物にも矢印が出る', 'forest', -0.6, 700),
  r('lamp', '魔法のランプ', '自分のまわりに灯るランタンが 1 つ増える', 'forest', 2.4, 1500),
  r('watch', '古い懐中時計', '時計の品で敵が止まる時間が 2 秒のびる', 'graveyard', 1.1, 700),
  r('bell', '銀の鈴', '宝の地図の宝箱が 10 秒長く残る', 'graveyard', -2.3, 1500),
  r('flake', '雪の結晶', '1 回ごとに、3 択の引き直しが 1 回ふえる', 'snow', 0.4, 700),
  r('mirror', '氷の鏡', '祠のご利益が 1.5 倍長く続く', 'snow', -1.8, 1500),
  r('orb', '炎の宝玉', '宝箱の中身が 3 つ以上になる割合が 1 割上がる', 'volcano', 2.0, 700),
  r('shard', '黒曜石のかけら', '溶岩の池から受けるダメージが半分になる', 'volcano', -0.9, 1500)
];

export const RELIC_IDS = RELICS.map((d) => d.id);

/** 置き場所。障害物に重なるときは外へずらす（障害物も位置で決まるので、毎回同じ場所になる） */
export function relicSpot(def: RelicDef, g: Ground): { x: number; y: number } {
  const at = { x: Math.cos(def.angle) * def.dist, y: Math.sin(def.angle) * def.dist };
  pushOut(g, at, 8);
  return at;
}
```

（黒曜石のかけらの文は、噴火には岩が無く溶岩の池だけなので「溶岩の池から受けるダメージ」にする。台帳に書く。）

`shrines.ts`:

```ts
import { CELL, hash, obstaclesNear, type Ground } from './obstacles';

export type ShrineKind = 'power' | 'wind' | 'wisdom' | 'treasure' | 'heal';
export interface Shrine {
  x: number;
  y: number;
  kind: ShrineKind;
  /** 区画ごとに違う番号。使った祠を覚えるのに使う */
  key: number;
}

const CHANCE = 0.1;
const EDGE = 30;
const CLEAR = 120;
const KINDS: ShrineKind[] = ['power', 'wind', 'wisdom', 'treasure', 'heal'];
export const SHRINE_NAME: Record<ShrineKind, string> = {
  power: '力の祠',
  wind: '風の祠',
  wisdom: '知恵の祠',
  treasure: '宝の祠',
  heal: '癒しの祠'
};

export function shrineAt(g: Ground, cx: number, cy: number): Shrine | null {
  // 障害物とも飾りとも別の値でハッシュを取る
  if (hash(cx * 29 + 11, cy * 31 + 3) >= CHANCE) return null;
  const x = cx * CELL + EDGE + hash(cx * 43 + 7, cy * 3 + 17) * (CELL - EDGE * 2);
  const y = cy * CELL + EDGE + hash(cx * 11 + 13, cy * 47 + 2) * (CELL - EDGE * 2);
  if (Math.hypot(x, y) < CLEAR || obstaclesNear(g, x, y, 12, []).length) return null;
  const kind = KINDS[Math.floor(hash(cx * 37 + 5, cy * 41 + 9) * KINDS.length)];
  return { x, y, kind, key: (cx + 32768) * 65536 + (cy + 32768) };
}

export function shrinesNear(g: Ground, x: number, y: number, r: number, out: Shrine[]): Shrine[] {
  out.length = 0;
  for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++)
    for (let cy = Math.floor((y - r) / CELL); cy <= Math.floor((y + r) / CELL); cy++) {
      const s = shrineAt(g, cx, cy);
      if (s && Math.hypot(s.x - x, s.y - y) < r) out.push(s);
    }
  return out;
}
```

- [ ] **Step 4: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/explore.test.ts`
Expected: PASS（量のテストが外れたら `CHANCE` を 0.08〜0.12 の中で直して台帳に書く。距離のテストが外れたら、その遺物の `angle` を 0.1 ずつずらす）

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/animal-survivors/relics.ts src/lib/games/animal-survivors/shrines.ts src/lib/games/animal-survivors/explore.test.ts
git commit -m "Place the Animal Survivors relics and shrines"
```

---

### Task 2: 遺物を置く・拾う・効き目・記録

**Files:**

- Modify: `relics.ts`（`placeRelics`・`hasRelic`・`takeRelic` を足す）
- Modify: `world.ts`（`Options`・`World`・`createWorld`・`summary`・`spawnProps`・`hurtPlayer`）
- Modify: `drops.ts`（`Item`・`collect`・時計の品）
- Modify: `events.ts`（宝の地図の宝箱の秒）
- Modify: `chest.ts`（中身の割合）
- Modify: `records.ts`（`relics`・`keepRelic`・`record`）
- Modify: `snap.ts`（品の行の遺物の番号、`relics`）
- Modify: `Survivors.svelte`・`CoopRoom.svelte`（持っている遺物を渡す）
- Modify: `explore.test.ts`

**Interfaces:**

- Consumes: `RELICS`・`RELIC_IDS`・`relicSpot`（Task 1）
- Produces:
  - `Options.relics?: RelicId[]`（持っている遺物）
  - `World.relics: RelicId[]`（持っている遺物とその回に拾った遺物。効き目はこれを見る）、`World.relicsNow: RelicId[]`
  - `RunSummary.relics?: RelicId[]`
  - `Item.kind` に `'relic'`、`Item.relic?: RelicId`
  - `hasRelic(w: World, id: RelicId): boolean`、`placeRelics(w: World): void`、`takeRelic(w: World, id: RelicId): void`
  - GameEvent `{ type: 'relic'; id: RelicId }`
  - `Records.relics: RelicId[]`、`keepRelic(id: RelicId): void`
  - `Snap.relics: RelicId[]`

- [ ] **Step 1: 失敗するテストを書く**

`explore.test.ts` に足す（`memoryStorage` は `coop.test.ts` と同じ形で、node の `localStorage` の代わりに `vi.stubGlobal` で入れる）。

```ts
import { vi } from 'vitest';
import { openChest } from './chest';
import { collect } from './drops';
import { startEvent } from './events';
import { keepRelic, loadRecords, record } from './records';
import { hasRelic, placeRelics } from './relics';
import { createWorld, hurtPlayer, spawnProps, step, summary, type World } from './world';

const VIEW = { w: 260, h: 380 };

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    }
  };
}

const walkTo = (w: World, x: number, y: number) => {
  w.player.x = x;
  w.player.y = y;
  collect(w, 1 / 30);
};

describe('遺物を拾う', () => {
  it('まだ持っていない遺物だけを、決まった場所に置く', () => {
    const w = createWorld('dog', 1, VIEW, {}, 'forest', { relics: ['map'] });
    const placed = w.items.filter((it) => it.alive && it.kind === 'relic').map((it) => it.relic);
    expect(placed).toEqual(['lamp']);
  });

  it('上を歩くと拾い、その回の効き目がすぐ出て、まとめに入る', () => {
    const w = createWorld('dog', 1, VIEW, {}, 'forest');
    const it = w.items.find((o) => o.kind === 'relic' && o.relic === 'map')!;
    walkTo(w, it.x, it.y);
    expect(it.alive).toBe(false);
    expect(hasRelic(w, 'map')).toBe(true);
    expect(w.events).toContainEqual({ type: 'relic', id: 'map' });
    expect(summary(w).relics).toEqual(['map']);
  });

  it('記録にすぐ書け、回の終わりの record() も古い写しで消さない', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const stale = loadRecords();
    keepRelic('map');
    expect(loadRecords().relics).toEqual(['map']);
    const w = createWorld('dog', 1, VIEW, {}, 'forest');
    const it = w.items.find((o) => o.kind === 'relic' && o.relic === 'map')!;
    walkTo(w, it.x, it.y);
    w.over = 'dead';
    record(stale, summary(w));
    expect(loadRecords().relics).toEqual(['map']);
    vi.unstubAllGlobals();
  });

  it('魔法のランプでランタンが 6 つまで灯る', () => {
    const w = createWorld('dog', 1, VIEW, {}, 'forest', { relics: ['lamp'] });
    for (let i = 0; i < 40; i++) spawnProps(w, 3);
    expect(w.enemies.filter((e) => e.alive && e.def.prop).length).toBe(6);
  });

  it('古い懐中時計で時計の品の止まる時間が 2 秒のびる', () => {
    const a = createWorld('dog', 1, VIEW, {}, 'graveyard');
    const b = createWorld('dog', 1, VIEW, {}, 'graveyard', { relics: ['watch'] });
    for (const w of [a, b]) {
      w.items.push({ alive: true, kind: 'clock', x: w.player.x, y: w.player.y, pulled: false });
      collect(w, 1 / 30);
    }
    expect(b.freeze - a.freeze).toBeCloseTo(2);
  });

  it('銀の鈴で宝の地図の宝箱が 10 秒長く残る', () => {
    const w = createWorld('dog', 1, VIEW, {}, 'graveyard', { relics: ['bell'] });
    startEvent(w, { at: 0, kind: 'treasure', enemy: '', count: 0, text: '' });
    expect(w.treasure!.life).toBe(40);
  });

  it('雪の結晶で引き直しが 1 回ふえ、その回に拾っても 1 回ふえる', () => {
    const a = createWorld('dog', 1, VIEW, {}, 'snow');
    const b = createWorld('dog', 1, VIEW, {}, 'snow', { relics: ['flake'] });
    expect(b.rerolls - a.rerolls).toBe(1);
    const it = a.items.find((o) => o.kind === 'relic' && o.relic === 'flake')!;
    const before = a.rerolls;
    walkTo(a, it.x, it.y);
    expect(a.rerolls).toBe(before + 1);
  });

  it('炎の宝玉で宝箱の中身が 1 つになる割合が 1 割下がる', () => {
    const count = (relics: 'orb'[]) => {
      let ones = 0;
      for (let seed = 1; seed <= 400; seed++) {
        const w = createWorld('dog', seed, VIEW, {}, 'volcano', { relics });
        w.chests = 1;
        if (openChest(w).length === 1) ones++;
      }
      return ones / 400;
    };
    expect(count([]) - count(['orb'])).toBeGreaterThan(0.06);
  });

  it('黒曜石のかけらで溶岩の池のダメージが半分になる', () => {
    const a = createWorld('dog', 1, VIEW, {}, 'volcano');
    const b = createWorld('dog', 1, VIEW, {}, 'volcano', { relics: ['shard'] });
    for (const w of [a, b]) {
      w.player.hp = 100;
      hurtPlayer(w, 20, 'lava');
    }
    expect(100 - b.player.hp).toBeCloseTo((100 - a.player.hp) / 2, 0);
  });
});
```

（`hurtPlayer` の防御の引き算が先に入るなら、半分にするのは引く前の値。テストは防御 0 の犬で見る。`startEvent` の引数の型が違えば合わせる。）

`coop-run.test.ts` に足す（子の動物のまとめにも遺物が入る）。

```ts
it('子のまとめにも、その回に拾った遺物が入る', () => {
  const w = createWorld('dog', 1, VIEW, {}, 'forest');
  addHero(w, 'cat');
  w.relicsNow.push('map');
  expect(heroRun(w, 1).part.relics).toEqual(['map']);
});
```

（`coop-run.test.ts` の今の import と `VIEW` に合わせる。`addHero` が無ければ import に足す。）

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/explore.test.ts src/lib/games/animal-survivors/coop-run.test.ts`
Expected: 新しいテストが FAIL（`Options.relics` が無い・品に遺物が無い）

- [ ] **Step 3: 実装する**

`drops.ts`:

- `Item.kind` に `'relic'` を足し、`/** 遺物の品だけが持つ、どの遺物か */ relic?: RelicId;` を足す。
- `collect` の `if (it.kind === 'ticket') {` の前に足す（遺物は吸い寄せずに歩いて拾う）。

```ts
if (it.kind === 'relic') {
  if ((it.x - w.player.x) ** 2 + (it.y - w.player.y) ** 2 < CHEST_PICK ** 2) {
    it.alive = false;
    takeRelic(w, it.relic!);
  }
  continue;
}
```

- 時計の品の `w.freeze = FREEZE + w.fx.freeze;` を `w.freeze = FREEZE + w.fx.freeze + (hasRelic(w, 'watch') ? WATCH_SECS : 0);` にし、上に `/** 古い懐中時計でのびる秒 */ const WATCH_SECS = 2;`。
- `dropItem` の `delete it.tier;` のあとに `delete it.relic;` を足す（使い回した枠に前の遺物が残らないように）。

`relics.ts` に足す。

```ts
import { eachHero } from './heroes';
import type { World } from './world';

export const hasRelic = (w: World, id: RelicId) => w.relics.includes(id);

/** まだ持っていない、このステージの遺物を品として置く */
export function placeRelics(w: World): void {
  for (const def of RELICS) {
    if (def.stage !== w.stage.id || hasRelic(w, def.id)) continue;
    const at = relicSpot(def, w.stage.art);
    w.items.push({ alive: true, kind: 'relic', relic: def.id, x: at.x, y: at.y, pulled: false });
  }
}

/** 拾った遺物は、その回からすぐ効く（記録へ書くのは Prompts） */
export function takeRelic(w: World, id: RelicId): void {
  if (hasRelic(w, id)) return;
  w.relics.push(id);
  w.relicsNow.push(id);
  if (id === 'flake') eachHero(w, () => (w.rerolls += 1));
  w.events.push({ type: 'relic', id });
}
```

（`heroes.ts` から `world.ts` への循環は今もある形と同じ。循環で落ちたら `eachHero` を使わずに `for (const h of w.heroes) h.rerolls += 1;` にする。）

`world.ts`:

- `GameEvent` に `| { type: 'relic'; id: RelicId }` を足す。
- `World` に `relics: RelicId[];`・`relicsNow: RelicId[];` を足す（どちらも 2 匹で共通なので `HERO_KEYS` には入れない）。
- `Options` に `/** 記録で持っている遺物 */ relics?: RelicId[];` を足す。
- `createWorld` で `relics: [...(o.relics ?? [])], relicsNow: []` を入れ、World ができたあと（`return` の前）に `placeRelics(w);` と、持っていれば `if (hasRelic(w, 'flake')) w.rerolls += 1;` を足す。
- `RunSummary` に `/** この回に拾った遺物 */ relics?: RelicId[];`、`summary` に `relics: [...w.relicsNow],`。
- `spawnProps` の `if (n >= LANTERNS) return;` を `if (n >= LANTERNS + (hasRelic(w, 'lamp') ? 1 : 0)) return;` にする。
- `hurtPlayer` の先頭で `if (from === 'lava' && hasRelic(w, 'shard')) raw *= SHARD;` を足し、上に `/** 黒曜石のかけらで溶岩の池から受けるダメージに掛ける */ const SHARD = 0.5;`。

`events.ts` の宝の地図の `life: TREASURE_LIFE` を `life: TREASURE_LIFE + (hasRelic(w, 'bell') ? BELL_SECS : 0)` にし、上に `/** 銀の鈴でのびる秒 */ const BELL_SECS = 10;`。

`chest.ts` の `one: Math.max(0, o.one - w.fx.chest)` を `one: Math.max(0, o.one - w.fx.chest - (hasRelic(w, 'orb') ? ORB_CHEST : 0))` にし、上に `/** 炎の宝玉で、中身が 1 つになる割合から引く */ const ORB_CHEST = 0.1;`。

`records.ts`:

- `Records` に `relics: RelicId[];`、空の記録に `relics: []`、読むときは `list(raw.relics, RELIC_IDS)`（今の `evolved` と同じ読み方）。
- `record()` で `for (const id of run.relics ?? []) if (!r.relics.includes(id)) r.relics.push(id);` を `evolved` を足すところの隣に足す。
- 足す。

```ts
/** 拾った遺物をすぐ記録へ書く（倒れた回・アプリが閉じた回でも残るように、回の終わりを待たない） */
export function keepRelic(id: RelicId): void {
  const r = loadRecords();
  if (r.relics.includes(id)) return;
  r.relics.push(id);
  saveRecords(r);
}
```

（保存する関数の名前は `records.ts` を読んで合わせる。）

`snap.ts`:

- 品の行の 5 つめを `it.kind === 'relic' ? RELIC_IDS.indexOf(it.relic!) : (it.tier ?? -1)` にし、読むときは `it.kind === 'relic'` なら `it.relic = RELIC_IDS[r[4]]` と `it.tier = undefined`、ほかは今のまま（`it.relic` は消す）。
- `Snap` に `relics: RelicId[]`、作るときに `relics: w.relics`、読むときに `view.relics = s.relics`。

`Survivors.svelte` は `createWorld` に渡す組（`pick`）に `relics: records.relics` を足す（組を作るところを読んで、そこに 1 項目足す）。`CoopRoom.svelte:68` の `createWorld` の 6 つめの引数に `relics: r.relics` を足す。

- [ ] **Step 4: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors`
Expected: PASS（記録の形を固めるテストが落ちたら `relics: []` を足して台帳に書く）

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/animal-survivors
git commit -m "Place relics as items, take them on contact, apply their effects and keep them in the records"
```

---

### Task 3: 祠に触れる・ご利益

**Files:**

- Modify: `shrines.ts`（`touchShrines`・`stepBlessing`・`BLESS_SECS`・`MIGHT`・`HASTE`・`WISDOM`）
- Modify: `heroes.ts`（`HERO_KEYS` に `blessing`）
- Modify: `world.ts`（`World.blessing`・`shrinesUsed`・`makeHero`・`step`）
- Modify: `arms.ts`（`power`）、`drops.ts`（経験値の玉）
- Modify: `snap.ts`（`shrines`・動物の行のご利益）、`coop.ts`（`CoopGuest.move`）
- Modify: `explore.test.ts`、`coop.test.ts`

**Interfaces:**

- Consumes: `shrinesNear`・`SHRINE_NAME`（Task 1）
- Produces:
  - `World.blessing: { might: number; speed: number; xp: number }`（動物ごと、残りの秒）
  - `World.shrinesUsed: number[]`（使った祠の `key`）
  - `touchShrines(w: World): void`（今の `cur` の動物で触れる）、`stepBlessing(w: World, dt: number): void`
  - `BLESS_SECS = 30`、`MIGHT = 1.3`、`HASTE = 1.3`、`WISDOM = 2`、`speedOf(w: World): number`（風の祠の倍率）
  - GameEvent `{ type: 'shrine'; kind: ShrineKind; hero?: number }`（`heroes.ts` の `OWN` に入れる）
  - `Snap.shrines: number[]`、動物の行の末尾に `blessing.might`・`blessing.speed`・`blessing.xp`

- [ ] **Step 1: 失敗するテストを書く**

`explore.test.ts` に足す。

```ts
import { addHero, makeEnemy } from './world';
import { BLESS_SECS, shrineAt, touchShrines, type Shrine } from './shrines';
import { ENEMIES } from './enemies';
import { power } from './arms';

function shrineOf(kind: string): Shrine {
  for (let c = 1; c < 400; c++)
    for (const [cx, cy] of [
      [c, 0],
      [0, c],
      [-c, 0],
      [0, -c],
      [c, c]
    ]) {
      const s = shrineAt('forest', cx, cy);
      if (s?.kind === kind) return s;
    }
  throw new Error(kind);
}

const quiet = (relics: 'mirror'[] = []) => {
  const w = createWorld('dog', 1, VIEW, {}, 'forest', { relics });
  w.stage = { ...w.stage, waves: [], bosses: [], chiefs: [], events: [] };
  w.metalAt = -1;
  w.propCd = 1e9;
  return w;
};

describe('祠', () => {
  it('力の祠: 触れると 30 秒攻撃 +30% で、祠は消える', () => {
    const w = quiet();
    const s = shrineOf('power');
    Object.assign(w.player, { x: s.x, y: s.y });
    const before = power(w, 10).dmg;
    touchShrines(w);
    expect(w.blessing.might).toBe(BLESS_SECS);
    expect(w.shrinesUsed).toContain(s.key);
    w.stats.crit = 0;
    expect(power(w, 10).dmg).toBeCloseTo(before * 1.3);
    w.blessing.might = 0;
    touchShrines(w);
    expect(w.blessing.might).toBe(0);
  });

  it('風の祠で速くなり、知恵の祠で拾う経験値が 2 倍', () => {
    const w = quiet();
    const wind = shrineOf('wind');
    Object.assign(w.player, { x: wind.x, y: wind.y });
    touchShrines(w);
    const x0 = w.player.x;
    step(w, { x: 1, y: 0 }, 0.1);
    expect(w.player.x - x0).toBeCloseTo(60 * w.stats.speed * 1.3 * 0.1, 1);
    const wis = shrineOf('wisdom');
    Object.assign(w.player, { x: wis.x, y: wis.y });
    touchShrines(w);
    const xp = w.xp;
    w.gems.push({ alive: true, x: w.player.x, y: w.player.y, value: 5, pulled: false });
    collect(w, 1 / 30);
    expect(w.xp - xp).toBe(10);
  });

  it('宝の祠はその場に宝箱、癒しの祠は全快', () => {
    const w = quiet();
    const t = shrineOf('treasure');
    Object.assign(w.player, { x: t.x, y: t.y });
    touchShrines(w);
    expect(w.items.some((it) => it.alive && it.kind === 'chest')).toBe(true);
    const h = shrineOf('heal');
    w.player.hp = 1;
    Object.assign(w.player, { x: h.x, y: h.y });
    touchShrines(w);
    expect(w.player.hp).toBe(w.stats.maxHp);
  });

  it('ご利益の時計は step で減り、続けて触れると残りがのび、氷の鏡で 1.5 倍', () => {
    const w = quiet(['mirror']);
    const s = shrineOf('power');
    Object.assign(w.player, { x: s.x, y: s.y });
    touchShrines(w);
    expect(w.blessing.might).toBe(BLESS_SECS * 1.5);
    step(w, { x: 0, y: 0 }, 1);
    expect(w.blessing.might).toBeCloseTo(BLESS_SECS * 1.5 - 1);
  });

  it('2 匹が同じフレームで触れても、ご利益は 1 匹だけで、祠は 1 回で消える', () => {
    const w = quiet();
    addHero(w, 'cat');
    const s = shrineOf('power');
    for (const h of w.heroes) Object.assign(h.player, { x: s.x, y: s.y });
    step(w, { x: 0, y: 0 }, 1 / 60);
    const got = w.heroes.filter((h) => h.blessing.might > 0).length;
    expect(got).toBe(1);
    expect(w.shrinesUsed.filter((k) => k === s.key)).toHaveLength(1);
  });
});
```

`coop.test.ts` の `describe('協力プレイのつなぎ'` に足す（`started()` を使う）。

```ts
it('風の祠のご利益は、子の端末での子の動物の動きにも効く', async () => {
  const { g, w, h } = await started();
  w.heroes[1].blessing.speed = 10;
  h.after(0.06);
  await settle();
  g.frame(performance.now() + 1000);
  const v = g.view!;
  const me = v.heroes[v.cur].player;
  const x0 = me.x;
  g.move({ x: 1, y: 0 }, 0.1);
  expect(me.x - x0).toBeCloseTo(60 * v.heroes[v.cur].stats.speed * 1.3 * 0.1, 1);
});
```

（`h.after` と `g.frame` の使い方は、このファイルの最初のテストと同じ。）

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/explore.test.ts src/lib/games/animal-survivors/coop.test.ts`
Expected: 新しいテストが FAIL（`touchShrines` が無い）

- [ ] **Step 3: 実装する**

`shrines.ts` に足す。

```ts
import { dropChest } from './drops';
import type { World } from './world';
import { hasRelic } from './relics';

export const BLESS_SECS = 30;
export const MIGHT = 1.3;
export const HASTE = 1.3;
export const WISDOM = 2;
const TOUCH = 12;
/** 氷の鏡でご利益の秒に掛ける */
const MIRROR = 1.5;

const found: Shrine[] = [];

/** 今の cur の動物で、触れている祠を使う。使った祠はその回は戻らない */
export function touchShrines(w: World): void {
  const p = w.player;
  for (const s of shrinesNear(w.stage.art, p.x, p.y, TOUCH, found)) {
    if (w.shrinesUsed.includes(s.key)) continue;
    w.shrinesUsed.push(s.key);
    const secs = BLESS_SECS * (hasRelic(w, 'mirror') ? MIRROR : 1);
    if (s.kind === 'power') w.blessing.might = Math.max(w.blessing.might, 0) + secs;
    else if (s.kind === 'wind') w.blessing.speed = Math.max(w.blessing.speed, 0) + secs;
    else if (s.kind === 'wisdom') w.blessing.xp = Math.max(w.blessing.xp, 0) + secs;
    else if (s.kind === 'treasure') dropChest(w, s.x, s.y + 10);
    else p.hp = w.stats.maxHp;
    w.events.push({ type: 'shrine', kind: s.kind });
  }
}

export function stepBlessing(w: World, dt: number): void {
  const b = w.blessing;
  b.might = Math.max(0, b.might - dt);
  b.speed = Math.max(0, b.speed - dt);
  b.xp = Math.max(0, b.xp - dt);
}

export const speedOf = (w: World) => (w.blessing.speed > 0 ? HASTE : 1);
```

（「同じご利益が続けば残りをのばす」は、残りの秒に新しい秒を足す形にする。テストの 30 は 1 回めなので `0 + 30`。）

`drops.ts` に、宝箱を置くだけの口を足す（`dropItem` は外へ出していないので、包む）。

```ts
/** 宝の祠の宝箱。歩いて拾う、ボスの宝箱と同じもの */
export const dropChest = (w: World, x: number, y: number) => void dropItem(w, 'chest', x, y);
```

`heroes.ts` の `HERO_KEYS` に `'blessing'` を足し、`OWN` に `'shrine'` を足す。

`world.ts`:

- `World` に `blessing: { might: number; speed: number; xp: number };`（動物ごと）と `shrinesUsed: number[];`（共通）を足す。`makeHero` に `blessing: { might: 0, speed: 0, xp: 0 }`、`createWorld` に `shrinesUsed: []`。
- `GameEvent` に `| { type: 'shrine'; kind: ShrineKind }`。
- `step` の自分の移動の `const speed = BASE_SPEED * w.stats.speed * (p.slow > 0 ? SLOW : 1);` に `* speedOf(w)` を掛ける。
- `step` の `eachHero(w, () => { const h = w.player; h.invuln -= dt; ...` の中に `stepBlessing(w, dt);` を足し、そのすぐあとに `eachHero(w, () => !w.heroes[w.cur].down && touchShrines(w));` を足す（倒れた動物は触れない）。

`arms.ts` の `power` の `dmg:` の式に `* (w.blessing.might > 0 ? MIGHT : 1)` を掛ける。

`drops.ts` の経験値の玉の `const v = g.value * (w.festival > 0 ? 2 : 1);` に `* (w.blessing.xp > 0 ? WISDOM : 1)` を掛ける（`w.cur` は玉に近い動物になっているので、拾った動物のご利益を見る）。

`snap.ts`:

- 動物の行の末尾に `r1(h.blessing.might), r1(h.blessing.speed), r1(h.blessing.xp)` を足し、読むときに `h.blessing = { might: r[17], speed: r[18], xp: r[19] }`（番号は今の行の長さを数えて合わせる）。
- `Snap` に `shrines: number[]`、作るときに `shrines: w.shrinesUsed`、読むときに `view.shrinesUsed = s.shrines`。

`coop.ts` の `CoopGuest.move` の `const speed = BASE_SPEED * h.stats.speed * (p.slow > 0 ? SLOW : 1);` に `* (h.blessing.speed > 0 ? HASTE : 1)` を掛ける。

- [ ] **Step 4: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/animal-survivors
git commit -m "Add shrines with per-animal blessings"
```

---

### Task 4: 絵・描き方・帯・記録へすぐ書く・ステージの札・図鑑

**Files:**

- Create: `art/explore.ts`、`draw-explore.ts`
- Modify: `draw.ts`（祠・遺物・矢印を描く順に入れる）、`hud.ts`（ご利益）
- Modify: `prompts.svelte.ts`（`take` に遺物と祠）
- Modify: `StageSelect.svelte`、`book-view.ts`、`Book.svelte`
- Modify: `pixels.test.ts`、`StageSelect.svelte.test.ts`、`book.test.ts`（または book-view を見ているテスト）、`explore.test.ts`

**Interfaces:**

- Consumes: Task 1〜3 のすべて
- Produces: `RELIC_ART: Record<RelicId, Art>`、`SHRINE_ART: Record<ShrineKind, Art>`、`drawShrines`・`relicGlow`・`relicArrows`・`blessings`（描く関数）、`Tab` に `'relics'`

- [ ] **Step 1: 失敗するテストを書く**

`pixels.test.ts` の import に `import { RELIC_ART, SHRINE_ART } from './art/explore';`、`all` の末尾に `...Object.entries(RELIC_ART), ...Object.entries(SHRINE_ART)`、`describe('ドット絵の格子'` に足す。

```ts
it('遺物 8 つと祠 5 つの絵がある', () => {
  expect(Object.keys(RELIC_ART)).toHaveLength(8);
  expect(Object.keys(SHRINE_ART)).toHaveLength(5);
});
```

`explore.test.ts` に足す（Prompts は `*.svelte.ts` なので、テストは `explore.svelte.test.ts` に分ける。happy-dom の project で `localStorage` がある）。

`explore.svelte.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Prompts } from './prompts.svelte';
import { loadRecords } from './records';
import { createWorld } from './world';

describe('遺物と祠の帯', () => {
  it('遺物を拾った出来事で帯を出し、記録へすぐ書く', () => {
    localStorage.clear();
    const w = createWorld('dog', 1, { w: 260, h: 380 }, {}, 'forest');
    const p = new Prompts(w);
    w.events.push({ type: 'relic', id: 'map' });
    p.take();
    expect(p.notice?.text).toContain('古い地図');
    expect(loadRecords().relics).toEqual(['map']);
  });

  it('祠に触れた出来事で、祠の名前の帯を出す', () => {
    const w = createWorld('dog', 1, { w: 260, h: 380 }, {}, 'forest');
    const p = new Prompts(w);
    w.events.push({ type: 'shrine', kind: 'power' });
    p.take();
    expect(p.notice?.text).toContain('力の祠');
  });
});
```

（`Prompts` の作り方は `prompts.svelte.ts` の constructor を読んで合わせる。）

`StageSelect.svelte.test.ts` に、遺物を 1 つ持っている記録で森の札に「遺物 1 / 2」が出るテストを足す（このファイルの今のテストの mount の形を写し、`records.relics = ['map']` にして `target.textContent` に `遺物 1 / 2` を探す）。

book-view を見ているテスト（`book.test.ts` か `arcana-book.test.ts` の `entries` を呼んでいるもの）に足す。

```ts
it('遺物のタブは 8 つで、持っている遺物だけ名前が出る', () => {
  const r = emptyRecords();
  r.relics = ['lamp'];
  const list = entries(r, 'relics');
  expect(list).toHaveLength(8);
  expect(list.filter((e) => e.known).map((e) => e.name)).toEqual(['魔法のランプ']);
});
```

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors`
Expected: 新しいテストが FAIL

- [ ] **Step 3: 絵を書き出す**

scratchpad の `explore/art.json`（`relics` と `shrines`）から `art/explore.ts` を書き出す node を、障害物の `obs/to-ts.mjs` と同じ形で書いて走らせる。遺物のキーは `map`・`lamp`・`watch`・`bell`・`flake`・`mirror`・`orb`・`shard`（見本の `map`・`lamp`・`watch`・`bell`・`flake`・`mirror`・`orb`・`shard` と同じ）、祠のキーは `power`・`wind`・`wisdom`・`treasure`・`heal`。黒曜石のかけらは `pal: { a: '#3b3537', A: '#24201f' }` を持つ。

```ts
import type { Art } from '../pixels';
import type { RelicId } from '../relics';
import type { ShrineKind } from '../shrines';

/** 遺物（12 ドット）。地面でも図鑑でも同じ絵 */
export const RELIC_ART: Record<RelicId, Art> = { ... };
/** 祠。屋根と箱は共通で、中の玉の色が種類 */
export const SHRINE_ART: Record<ShrineKind, Art> = { ... };
```

- [ ] **Step 4: 描き方を書く**

`draw-explore.ts`:

```ts
import { RELIC_ART, SHRINE_ART } from './art/explore';
import { PALETTE } from './art/palette';
import { CELL } from './obstacles';
import { bake } from './pixels';
import { hasRelic, RELICS } from './relics';
import { shrineAt, type Shrine } from './shrines';
import type { World } from './world';

const seen: Shrine[] = [];

/** 画面にかかる、まだ使っていない祠を描く（敵より先。祠は通れるので奥行きを合わせない） */
export function drawShrines(
  ctx: CanvasRenderingContext2D,
  w: World,
  cx: number,
  cy: number,
  vw: number,
  vh: number,
  q: (v: number) => number
): void {
  seen.length = 0;
  for (let gx = Math.floor((cx - 24) / CELL); gx <= Math.floor((cx + vw + 24) / CELL); gx++)
    for (let gy = Math.floor((cy - 24) / CELL); gy <= Math.floor((cy + vh + 40) / CELL); gy++) {
      const s = shrineAt(w.stage.art, gx, gy);
      if (s && !w.shrinesUsed.includes(s.key)) seen.push(s);
    }
  for (const s of seen) {
    const art = SHRINE_ART[s.kind];
    ctx.fillStyle = 'rgb(0 0 0 / 0.22)';
    ctx.fillRect(q(s.x - 9), q(s.y + 1), 18, 2);
    ctx.drawImage(bake(art), q(s.x - art.w / 2), q(s.y + 2 - art.h));
  }
}

/** 地面の遺物。足もとをうっすら光らせ、ゆっくり上下に揺らす（明滅はしない） */
export function drawRelic(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  id: keyof typeof RELIC_ART,
  now: number,
  q: (v: number) => number
): void {
  const art = RELIC_ART[id];
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = PALETTE.y;
  ctx.beginPath();
  ctx.ellipse(q(x), q(y + 2), 9, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  const bob = Math.sin(now * 2.5) * 1.5;
  ctx.drawImage(bake(art), q(x - art.w / 2), q(y - art.h - 2 + bob));
  // きらめきは遺物のまわりを回る 2 つの点
  ctx.fillStyle = PALETTE.w;
  for (const k of [0, Math.PI]) {
    const a = now * 1.6 + k;
    ctx.fillRect(q(x + Math.cos(a) * 9), q(y - 8 + Math.sin(a) * 5), 1, 1);
  }
}

/** 遺物への矢印。近い遺物だけ（古い地図があればどこでも）、画面の外にあるときに端へ出す */
export const RELIC_NEAR = 400;
export function relicTargets(w: World): { x: number; y: number; id: keyof typeof RELIC_ART }[] {
  const p = w.player;
  return w.items
    .filter(
      (it) => it.alive && it.kind === 'relic' && (hasRelic(w, 'map') || Math.hypot(it.x - p.x, it.y - p.y) < RELIC_NEAR)
    )
    .map((it) => ({ x: it.x, y: it.y, id: it.relic! }));
}

export { RELICS };
```

`draw-events.ts` に足す（`chiefArrows` と同じ矢印の口 `edgeArrow` を使う。名前が違えば合わせる）。

```ts
export function relicArrows(ctx: CanvasRenderingContext2D, w: World, vw: number, vh: number, top: number): void {
  for (const t of relicTargets(w)) {
    const at = edgeArrow(ctx, w, t, vw, vh, top);
    if (at) ctx.drawImage(bake(RELIC_ART[t.id]), at.x - 6, at.y + 6);
  }
}
```

`draw.ts`:

- `ground(ctx, w, cx, cy, v);` のあとに `drawShrines(ctx, w, cx, cy, v.w, v.h, q);`。
- `pickups` の品を描くところで、`it.kind === 'relic'` なら `drawRelic(ctx, it.x, it.y, it.relic!, now, q)` で描いて次へ（今の品の絵の引き方の前に足す）。
- 矢印のところ（`chiefArrows(...)` の隣）に `relicArrows(ctx, w, v.w, v.h, top);`。

`hud.ts` の、武器とパッシブの枠を描いたあとに、ご利益を描く（自分の動物のもの）。

```ts
const BLESS = [
  ['might', 'r'],
  ['speed', 'l'],
  ['xp', 'u']
] as const;

/** 祠のご利益の残りの秒。祠の玉と同じ色の丸と秒（x, y は左上） */
function blessings(ctx: CanvasRenderingContext2D, w: World, x: number, y: number): void {
  let i = 0;
  for (const [k, c] of BLESS) {
    const left = w.blessing[k];
    if (left <= 0) continue;
    const sx = x + i * 18;
    ctx.fillStyle = PALETTE.k;
    ctx.fillRect(sx, y, 5, 5);
    ctx.fillStyle = PALETTE[c];
    ctx.fillRect(sx + 1, y + 1, 3, 3);
    text(ctx, String(Math.ceil(left)), sx + 7, y, PALETTE.w);
    i++;
  }
}
```

置く場所は、`hud` の中で武器の枠の下（パッシブの枠の下の 1 行）を読んで決め、`blessings(ctx, w, x, y)` を呼ぶ。決めた場所は台帳に書く。

`prompts.svelte.ts` の `take` の出来事の枝に足す。

```ts
      else if (e.type === 'relic') {
        keepRelic(e.id);
        const name = RELICS.find((d) => d.id === e.id)!.name;
        this.notice = { text: `遺物を手に入れた！\n${name}`, key: w.time, until: w.time + NOTICE * 2 };
      } else if (e.type === 'shrine') this.notice = { text: `${SHRINE_NAME[e.kind]}！`, key: w.time, until: w.time + NOTICE };
```

（`keepRelic` は `./records`、`RELICS` は `./relics`、`SHRINE_NAME` は `./shrines` から import する。協力プレイの子の端末も snap の出来事を `take` するので、子も自分の記録へ書く。）

`StageSelect.svelte` の札に、そのステージの遺物の数を 1 行足す。

```svelte
<span class="relics"
  >遺物 {RELICS.filter((d) => d.stage === s.id && records.relics.includes(d.id)).length} / {RELICS.filter(
    (d) => d.stage === s.id
  ).length}</span
>
```

（`records` を受け取る props の名前と、札の中の行の並びを読んで、延長戦や釜の行と同じ見た目にする。）

`book-view.ts` の `Tab` に `'relics'` を足し、`entries` の先頭に足す。

```ts
if (tab === 'relics')
  return RELICS.map((d) => ({
    key: d.id,
    art: RELIC_ART[d.id],
    name: d.name,
    known: r.relics.includes(d.id),
    detail: [d.blurb],
    hint: `${stageOf(d.stage).name}のどこかにある`
  }));
```

（`stageOf` は `stages/index.ts`。`Tab` の型が `keyof typeof BOOK | 'arcana'` なので `| 'relics'` を足す。）`Book.svelte` の `TABS` に `['relics', '遺物']` を足す。

- [ ] **Step 5: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors`
Expected: PASS

- [ ] **Step 6: 画面で確かめる**

障害物のときの `obs/shot.mjs` と同じ形で（Play.svelte に一時的に `__w`。コミットしない）、森で、遺物の近く・遠く（古い地図あり）・祠の前・ご利益の HUD を撮る。見ること。

- 遺物の矢印と、地面の遺物の揺れとかすかな光が見える
- 祠の玉の色が分かる
- HUD の丸と秒が武器の枠と重ならない
- 帯の「遺物を手に入れた！」

- [ ] **Step 7: コミット**

```bash
git add src/lib/games/animal-survivors
git commit -m "Draw relics, shrines, relic arrows and blessings, and show relics on the stage cards and in the book"
```

---

### Task 5: ボットで確かめる

**Files:**

- Create（scratchpad、リポジトリには入れない）: `<scratchpad>/sim/explore.sim.ts`

- [ ] **Step 1: シミュレーションを書く**

`<scratchpad>/sim/unions.sim.ts` を写して `explore.sim.ts` にし、次を変える。

- `process.env.OFF === '1'` のときは `vi.mock('<repo>/src/lib/games/animal-survivors/shrines', async (orig) => ({ ...(await orig()), shrineAt: () => null, shrinesNear: (_g, _x, _y, _r, out) => ((out.length = 0), out) }))` で祠を消す
- ボットは 120 ドット以内の使っていない祠へ寄る力を足す（敵が近いときは寄らない）
- 結果に `shrines: w.shrinesUsed.length` と `relics: w.relicsNow` を入れる

- [ ] **Step 2: 回す**

森と夜の墓地、店を半分、動物 `dog,fox,panda`、`SEEDS=12`、`PICKER=pairs`、祠あり・なしの 4 本。

- [ ] **Step 3: 比べて決める**

- クリアの割合の差が 15 ポイント以内ならそのまま。祠ありが強すぎるなら `MIGHT`・`HASTE` を 1.2 に下げて回し直す（それでも超えたら利用者に数字を見せて聞く）
- 1 回で使う祠の数の平均を台帳に書く（0 に近ければ置く量か寄る距離を見直す）

- [ ] **Step 4: コミット**（数値を変えたときだけ）

```bash
git add src/lib/games/animal-survivors/shrines.ts
git commit -m "Tune the shrine blessings from the bot runs"
```

---

### Task 6: 文書と仕上げ

**Files:**

- Modify: `CLAUDE.md`（アニマルサバイバーの段落の、障害物の説明のあと）

- [ ] **Step 1: CLAUDE.md に書く**

```
ステージには遺物（`relics.ts` の 8 つ。ステージごとに 2 つを、始めの位置から 700 と 1500 ドットほどの決まった場所に、まだ持っていなければ品として置く）があり、歩いて拾うとその回からすぐ効き（`World.relics` と `hasRelic()`）、`Prompts` が拾った出来事で記録の `relics` へすぐ書く（倒れた回・アプリが閉じた回でも残る。回の終わりの `record()` も回のまとめの `relics` を足す）。遺物から 400 ドットに入るか古い地図を持っていると、画面の端に矢印を出す。野原には祠（`shrines.ts`。160 ドットの区画 10 個に 1 つほど、位置のハッシュで毎回同じ。障害物の上と始めの位置のまわりには置かない）があり、触れた動物にだけご利益（`Hero.blessing` の 30 秒の時計。力・風・知恵と、宝箱・全快）があって、使った祠は `World.shrinesUsed` に覚えてその回は戻さない。協力プレイの snap は、品の行の遺物の番号・持っている遺物・使った祠・動物ごとのご利益を運ぶ。
```

- [ ] **Step 2: まとめて確かめる**

Run: `pnpm verify > <workspace>/verify.txt 2>&1; tail -40 <workspace>/verify.txt`
Expected: すべて通る

- [ ] **Step 3: コミット**

```bash
git add CLAUDE.md
git commit -m "Describe the Animal Survivors relics and shrines"
```

- [ ] **Step 4: 枝全体の見直し（opus）と、Critical / Important の直し**

- [ ] **Step 5: 写真を利用者に送り、main への push を聞く**
