# Plan 073: アニマルサバイバーの毎フレームの重い所を、結果を 1 ビットも変えずに軽くする

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat ea56ff6..HEAD -- src/lib/games/animal-survivors/effects.ts src/lib/games/animal-survivors/grid.ts src/lib/games/animal-survivors/heroes.ts src/lib/games/animal-survivors/obstacles.ts src/lib/games/animal-survivors/drops.ts src/lib/games/animal-survivors/world.ts src/lib/games/animal-survivors/storm.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                                                    |
| ---------- | ------------------------------------------------------------------------------------- |
| Priority   | P2                                                                                    |
| Effort     | M                                                                                     |
| Risk       | MED（種で決まる World の結果を 1 ビットも変えてはいけない。演出の 2 つは World の外） |
| Depends on | none                                                                                  |
| Category   | perf                                                                                  |
| Planned at | commit `ea56ff6`, 2026-10-14                                                          |

## Why this matters

アニマルサバイバーは 10 分で 8000 体ほどを倒し、延長戦では 20〜30 分続く。十字架・連携の技・10:00 のクリアの一掃は
1 フレームで 200〜400 体を倒し、そのフレームだけ止まって見える。調べると、次の 7 か所が毎フレームか出来事ごとに
余計な仕事をしている。

1. 倒した敵の粒（`effects.ts` の `#bit`）が、空きを 600 個の並びから `find` で探す。1 体で 8 粒なので、400 体を倒した
   フレームでは約 100 万回の判定になる
2. 当たり判定の格子（`grid.ts`）の `Map` が、通ったことのある 32 ドットのセルを全部覚えたまま減らない（延長戦で増え続ける）
3. `nearestHero`（`heroes.ts`）が敵・玉・品ごとに毎フレーム `forEach` の閉包を作る
4. 障害物（`obstacles.ts`）が、押し出す敵ごとに毎フレーム同じ区画のハッシュと `hypot` を計算し直し、障害物の物を作り直す
5. 遠い品を消す判定（`drops.ts` の `collect`）が、品ごとに毎フレーム `filter` で並びを作る
6. ダメージの数字（`effects.ts` の `take`）が、1 フレームに何百の `hit` でも全部の文字列と物を作る。残るのは後ろの 60 個だけ
7. 敵ごとの `Math.pow(1e-4, dt)`、吹雪のない面での `Math.hypot`、玉が上限に届いていないときの一番遠い玉の距離の計算

World は種から作る乱数（`rng.ts`）で進み、長いシミュレーションのテストが正確な結果を見ている。以前、CI（Linux x64）と
手元（arm64）の浮動小数の 1 ulp の差で筋が分かれ、テストが落ちて配信が止まったことがある。だからこの計画では、
**式の中の計算の順番・`w.rand()` と `w.loot()` を呼ぶ回数と順番・同じ近さのときにどれを選ぶか** を一切変えない。
まず手元で変える前の World の結果を数にして控え、項目ごとに同じ数になることを確かめながら進める。

## Current state

ファイルはどれも `src/lib/games/animal-survivors/` の下にある。

### 1. 粒の空き探し（`effects.ts`）

`effects.ts:62-82`。粒は見た目だけのもので、速さと寿命に `Math.random()`（種の乱数ではない）を使う。

```ts
export class Effects {
  readonly #bits: Bit[] = [];
  readonly #numbers: Floater[] = [];
  ...
  #bit(x: number, y: number, vx: number, vy: number, life: number, color: string, size = 2) {
    let b = this.#bits.find((o) => o.life <= 0);
    if (!b) {
      if (this.#bits.length >= MAX_BITS) return;
      this.#bits.push((b = { x, y, vx, vy, life, max: life, color, size }));
    }
    Object.assign(b, { x, y, vx, vy, life, max: life, color, size });
  }
```

`MAX_BITS = 600`（`effects.ts:27`）。倒した 1 体で 8 粒（`effects.ts:106-119`）。粒を減らすのは `update()` だけ
（`effects.ts:231-243`）。

```ts
  update(dt: number): void {
    this.#clock += dt;
    this.hurt = Math.max(0, this.hurt - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.edge = Math.max(0, this.edge - dt);
    for (const b of this.#bits) {
      if (b.life <= 0) continue;
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vx *= 0.9;
      b.vy = b.vy * 0.9 + 80 * dt;
    }
```

粒の `life` は作るときいつも正（0.35〜0.8）なので、生きている粒が 0 以下になるのは `update()` の中だけ。

### 6. ダメージの数字（`effects.ts`）

`effects.ts:84-105`。`MAX_NUMBERS = 60`（`effects.ts:28`）。

```ts
  #number(t: string, x: number, y: number, color: string, size: 1 | 2) {
    if (this.#numbers.length >= MAX_NUMBERS) this.#numbers.shift();
    this.#numbers.push({ text: t, x, y, age: 0, color, size });
  }

  take(w: World): void {
    let hit = false;
    let coin = false;
    let kill = false;
    // 育つ演出のあいだは効果の時計が止まるので、同じフレームの光と粒は止まったまま演出を覆う。演出が光を出す
    const growing = w.events.some((e) => e.type === 'grow' && ownEvent(w, e));
    for (const e of w.events) {
      if (!ownEvent(w, e)) continue;
      if (e.type === 'hit') {
        hit = true;
        this.#number(
          String(Math.max(1, Math.round(e.dmg))),
          e.x + (Math.random() - 0.5) * 6,
          e.y,
          e.crit ? PALETTE.y : PALETTE.w,
          e.crit ? 2 : 1
        );
      } else if (e.type === 'kill') {
```

`for` の中身はこの `if … else if …` の 1 つの並びだけで、その後ろに続く文は無い（`effects.ts:224` で `for` が閉じる）。
`#number` を呼ぶのは `hit` のほかに `heal` と `coin`（値が 1 より大きいとき）だけ。後ろに 60 個以上の `#number` が続く
`hit` の数字は、同じフレームのうちに必ず `shift()` で押し出される。だから「自分の `hit` の後ろから 60 個」以外の数字を
作らなくても、フレームの終わりの `#numbers` の中身は同じになる。

### 2. 格子（`grid.ts`）

`grid.ts:1-26`。

```ts
/** 当たり判定の格子。毎フレーム作り直すので、セルの配列は使い回して空にするだけにする */
export class Grid {
  readonly #cell: number;
  readonly #cells = new Map<number, number[]>();
  readonly #used: number[][] = [];
  ...
  clear() {
    for (const list of this.#used) list.length = 0;
    this.#used.length = 0;
  }

  add(i: number, x: number, y: number) {
    const k = this.#key(Math.floor(x / this.#cell), Math.floor(y / this.#cell));
    let list = this.#cells.get(k);
    if (!list) this.#cells.set(k, (list = []));
    if (list.length === 0) this.#used.push(list);
    list.push(i);
  }
```

`near()`（`grid.ts:29-38`）はセルを順に見て、セルの中は足した順に返す。`Map` を作り直しても、空のセルを捨てても、
返す番号と順番は変わらない。`clear()` を呼ぶのは `world.ts:1043` の 1 か所。

### 3. `nearestHero`（`heroes.ts`）

`heroes.ts:101-114`。

```ts
/** 倒れていない中でいちばん近い動物。全員倒れていれば 0 */
export function nearestHero(w: World, x: number, y: number): number {
  let best = 0;
  let bd = Infinity;
  w.heroes.forEach((h, i) => {
    if (h.down) return;
    const d = (h.player.x - x) ** 2 + (h.player.y - y) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}
```

呼ぶのは `world.ts:1047`（敵ごと）、`drops.ts:293`（玉ごと）、`drops.ts:310`（品ごと）、`draw.ts:366`。同じ近さなら
`<` なので番号の小さいほうが残る。

### 4. 障害物（`obstacles.ts`）

`obstacles.ts:82-103`。

```ts
export function obstacleAt(g: Ground, cx: number, cy: number): Obstacle | null {
  // 飾りの並びと重ならないよう、地面と飾りとは別の値でハッシュを取る
  if (hash(cx * 13 + 5, cy * 11 + 7) >= CHANCE) return null;
  const x = cx * CELL + EDGE + hash(cx * 17 + 1, cy * 3 + 9) * (CELL - EDGE * 2);
  const y = cy * CELL + EDGE + hash(cx * 5 + 2, cy * 19 + 4) * (CELL - EDGE * 2);
  if (Math.hypot(x, y) < CLEAR + REACH) return null;
  return { x, y, kind: KINDS[g][hash(cx * 7 + 3, cy * 23 + 1) < 0.5 ? 0 : 1] };
}

export function obstaclesNear(g: Ground, x: number, y: number, r: number, out: Obstacle[]): Obstacle[] {
  out.length = 0;
  for (let cx = Math.floor((x - r - REACH) / CELL); cx <= Math.floor((x + r + REACH) / CELL); cx++)
    for (let cy = Math.floor((y - r - REACH) / CELL); cy <= Math.floor((y + r + REACH) / CELL); cy++) {
      const o = obstacleAt(g, cx, cy);
      if (
        o &&
        SHAPES[o.kind].circles.some(([dx, dy, cr]) => Math.hypot(x - o.x - dx, (y - o.y - dy) / SQUASH) < r + cr)
      )
        out.push(o);
    }
  return out;
}
```

`obstacleAt` は地面（`Ground`、`w.stage.art`）と区画の番号だけで決まる純粋な関数。地面ごとに種類が違う
（`KINDS`、`obstacles.ts:66-71`）ので、控えは地面ごとに分ける。呼ぶのは `obstaclesNear`・`draw-obstacles.ts:22` の
`inView`・テスト。返した `Obstacle` の `x`・`y`・`kind` を書き換えている所は無い（`grep` で確かめてある）。
`pushOut`（`obstacles.ts:108-127`）は `world.ts:1064-1065` で障害物で止まる敵ごとに毎フレーム呼ばれる。

```ts
for (const e of w.enemies)
  if (e.alive && blocked(e)) pushOut(w.stage.art, e, e.def.chief ? Math.min(e.def.r, CHIEF_PUSH) : e.def.r);
```

### 5. 遠い品（`drops.ts`）

`drops.ts:300-309`。

```ts
  const far2 = (FAR_ITEM * Math.hypot(w.view.w, w.view.h)) ** 2;
  for (const it of w.items) {
    if (!it.alive) continue;
    if (
      !KEEP.has(it.kind) &&
      w.heroes.filter((h) => !h.gone).every((h) => (it.x - h.player.x) ** 2 + (it.y - h.player.y) ** 2 > far2)
    ) {
      it.alive = false;
      continue;
    }
```

全員が `gone` なら `[].every(...)` は `true` なので品は消える。距離が `NaN` なら `NaN > far2` は `false` なので消えない。
置き換える形もこの 2 つを同じにする。

### 7. 小さな 3 つ（`world.ts`・`storm.ts`・`drops.ts`）

`world.ts:810-814`（`moveEnemy` の終わり。`moveEnemy` を呼ぶのは `world.ts:1049` の 1 か所で、`step` の `dt` は途中で
書き換えない）。

```ts
const decay = Math.pow(1e-4, dt);
e.x += (vx + e.kx) * dt;
e.y += (vy + e.ky) * dt;
e.kx *= decay;
e.ky *= decay;
```

`world.ts:1043-1049`。

```ts
  w.grid.clear();
  w.enemies.forEach((e, i) => {
    if (!e.alive) return;
    // 敵の動き（ボスの攻撃も）は w.player を狙うので、近いほうの動物を cur にしてから動かす
    w.cur = nearestHero(w, e.x, e.y);
    const q = w.player;
    moveEnemy(w, i, dt);
```

`storm.ts:35-40`。

```ts
/** 動く向きが風と近いほど速く、逆なら遅くする倍率 */
export function windFactor(w: World, vx: number, vy: number): number {
  const sp = Math.hypot(vx, vy);
  if (w.storm.left <= 0 || sp === 0) return 1;
  return 1 + (STORM_WIND * (vx * w.storm.wx + vy * w.storm.wy)) / sp;
}
```

`drops.ts:167-195`。`MAX_GEMS = 400`（`drops.ts:34`）。

```ts
export function dropGem(w: World, x: number, y: number, value: number): void {
  const at = { x, y };
  pushOut(w.stage.art, at, 4);
  ({ x, y } = at);
  let count = 0;
  let far: Gem | undefined;
  let fd = -1;
  let free: Gem | undefined;
  const p = w.player;
  for (const g of w.gems) {
    if (!g.alive) {
      free ??= g;
      continue;
    }
    count++;
    const d = (g.x - p.x) ** 2 + (g.y - p.y) ** 2;
    if (d > fd) {
      fd = d;
      far = g;
    }
  }
  if (count >= MAX_GEMS && far) {
    far.value += value;
    return;
  }
  const g = free ?? (w.gems[w.gems.length] = { alive: false, x: 0, y: 0, value: 0, pulled: false });
  Object.assign(g, { alive: true, x, y, value, pulled: false });
}
```

### テストと規約

- vitest は `src/**/*.test.ts` を node で、`src/**/*.svelte.test.ts` を happy-dom で回す（`vite.config.ts:73-91`）
- 長いシミュレーションのテストのお手本は `overtime.test.ts:13-42`。`step()` は 3 択か宝箱が残っていると何もしない
  （`world.ts:952`）ので、ループの中で毎回片付ける
- `Effects` のテストは `help-fx.test.ts` のように `$lib/audio.svelte` を `vi.mock` で差し替える
- コメントは「コードから復元できない WHY」だけを日本語で書く。変更の経緯は書かない。テストの名前は日本語の文
- この計画は `.svelte` を触らない。ゲームの `CLAUDE.md` に書いてある遊びの決まりも変わらないので、`CLAUDE.md` は触らない

## Commands you will need

| Purpose       | Command                                                                         | Expected on success           |
| ------------- | ------------------------------------------------------------------------------- | ----------------------------- |
| 結果の控え    | `pnpm exec vitest run src/lib/games/animal-survivors/determinism.local.test.ts` | すべて pass                   |
| ゲームの試験  | `pnpm exec vitest run src/lib/games/animal-survivors/`                          | すべて pass                   |
| 全テスト      | `pnpm test:run`                                                                 | exit 0                        |
| 型            | `pnpm check`                                                                    | `0 ERRORS 0 WARNINGS`、exit 0 |
| lint          | `pnpm lint`                                                                     | exit 0                        |
| svelte-vitals | `pnpm vitals --diff`                                                            | 警告 0                        |
| 全部          | `pnpm verify`                                                                   | exit 0                        |

## Scope

**In scope**

- `src/lib/games/animal-survivors/effects.ts`
- `src/lib/games/animal-survivors/grid.ts`
- `src/lib/games/animal-survivors/heroes.ts`
- `src/lib/games/animal-survivors/obstacles.ts`
- `src/lib/games/animal-survivors/drops.ts`
- `src/lib/games/animal-survivors/world.ts`
- `src/lib/games/animal-survivors/storm.ts`
- 足すテスト。`effects.test.ts`（作る）、`grid.test.ts`（作る）、`heroes.test.ts`・`obstacles.test.ts`・`drops.test.ts`
  （`it` を足すだけ。今ある `it` は 1 文字も変えない）
- `src/lib/games/animal-survivors/determinism.local.test.ts`（手元だけで作り、コミットせず、最後に消す）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- 今あるテストの書き換え。落ちたら直すのはコードで、テストではない（落ちたら STOP）
- 玉・品・コインの数に上限を足すこと。遊びが変わる
- `heroes.ts` の `tagged()` の `push` の包み（2 匹のとき出来事ごとに並びを作る）。速くできそうだが今回の調べの外
- `world.ts` のほかの `forEach`、`draw.ts`・`draw-obstacles.ts`・`coop.ts`
- 乱数（`rng.ts`）と `hash()` の中身、障害物の置き方の式
- `vitest bench` の設定を足すこと。計測は手元の使い捨てのテストで `performance.now()` を使う

## Git workflow

- ブランチは `advisor/073-survivors-hot-paths`（`git switch -c advisor/073-survivors-hot-paths`）
- 上の 7 項目を 1 項目 1 コミットにする。メッセージは英語の命令形 1 文で、`Co-Authored-By` などの署名の行は付けない。
  例は Steps の各項目に書いてある
- `determinism.local.test.ts` は一度も `git add` しない（`git add -A` と `git commit -a` を使わず、ファイルを名指しで足す）
- push しない（`main` への push は本番に配信される）

## Steps

### Step 0: 変える前の World の結果を数にして控える（コミットしない）

`src/lib/games/animal-survivors/determinism.local.test.ts` を次の中身で作る。5 つの場面で World を種から進め、
最後の状態を `JSON.stringify`（数は往復できる最短の表記なので 1 ulp の差も文字に出る）にして FNV-1a の 32 ビットの数にする。
最後に `w.rand()` と `w.loot()` を 1 回ずつ呼んで混ぜるので、乱数を呼んだ回数がずれても数が変わる。場面は、
1 匹の森・相棒が途中で抜ける 2 匹の墓地・吹雪の雪山・噴火の火山の 2 匹・10:00 のクリアの一掃を含む森。

このファイルは CI に載せない。CI の Linux x64 と手元の arm64 では `Math.sin` などの最後の 1 ビットが違うことがあり、
手元で決めた数は CI では合わないことがあるため。手元で「前と後が同じ」を見るためだけに使う。

```ts
import { describe, expect, it, vi } from 'vitest';
import { openChest } from './chest';
import { apply, choices } from './choices';
import { Effects } from './effects';
import { Grid } from './grid';
import { pushOut } from './obstacles';
import { addHero, createWorld, step, type World } from './world';

vi.mock('$lib/audio.svelte', () => ({
  audio: { muted: false },
  toggleMute: () => {},
  bus: () => null,
  tone: () => {},
  sweep: () => {},
  noise: () => {}
}));

const VIEW = { w: 274, h: 394 };
const DT = 1 / 30;

/** [ステージ, 種, 始める時刻, 進める秒, 相棒あり] */
const CASES: [string, number, number, number, boolean][] = [
  ['forest', 1, 0, 240, false],
  ['graveyard', 2, 0, 200, true],
  ['snow', 3, 90, 150, false],
  ['volcano', 4, 90, 60, true],
  ['forest', 5, 590, 15, false]
];

/** Step 0 で表示された 5 つの数をここに貼る。空のあいだは比べない */
const EXPECTED: number[] = [];

function fnv(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

function settle(w: World) {
  for (let k = 0; k < w.heroes.length; k++) {
    w.cur = k;
    while (w.pending > 0) apply(w, choices(w)[0]);
    while (w.chests > 0) openChest(w);
  }
  w.cur = 0;
  for (const h of w.heroes) if (!h.gone) h.player.hp = h.stats.maxHp = 1e9;
}

function run([stage, seed, from, secs, mate]: (typeof CASES)[number]): number {
  const w = createWorld('dog', seed, VIEW, {}, stage);
  if (mate) addHero(w, 'cat');
  w.time = from;
  const n = Math.round(secs / DT);
  for (let i = 0; i < n; i++) {
    settle(w);
    if (mate && i === Math.floor(n / 2)) w.heroes[1].gone = w.heroes[1].down = true;
    if (mate && !w.heroes[1].gone) {
      w.heroes[1].player.x = Math.cos(i / 70) * 120;
      w.heroes[1].player.y = Math.sin(i / 50) * 90;
    }
    step(w, { x: Math.cos(i / 90), y: Math.sin(i / 120) }, DT);
  }
  return fnv(
    JSON.stringify({
      t: w.time,
      kills: w.kills,
      xp: w.xpTotal,
      level: w.level,
      coins: w.coins,
      over: w.over,
      gemSlots: w.gems.length,
      heroes: w.heroes.map((h) => [h.player.x, h.player.y, h.down]),
      enemies: w.enemies.filter((e) => e.alive).map((e) => [e.def.id, e.x, e.y, e.hp]),
      gems: w.gems.filter((g) => g.alive).map((g) => [g.x, g.y, g.value]),
      items: w.items.filter((o) => o.alive).map((o) => [o.kind, o.x, o.y]),
      rand: w.rand(),
      loot: w.loot()
    })
  );
}

describe('手元だけの控え', () => {
  it('種から進めた World の結果が変える前と同じ', () => {
    const got: number[] = [];
    for (const c of CASES) {
      const t0 = performance.now();
      got.push(run(c));
      console.log(`${c[0]} seed ${c[1]}: ${got.at(-1)} (${Math.round(performance.now() - t0)} ms)`);
    }
    console.log(JSON.stringify(got));
    if (EXPECTED.length) expect(got).toEqual(EXPECTED);
  }, 600_000);

  it('計測 粒と数字', () => {
    const w = createWorld('dog', 1, VIEW);
    for (let i = 0; i < 400; i++) w.events.push({ type: 'kill', x: i, y: 0, enemy: 'rat' });
    for (let i = 0; i < 400; i++) w.events.push({ type: 'hit', x: i, y: 0, dmg: i, crit: false });
    const fx = new Effects();
    const t0 = performance.now();
    for (let k = 0; k < 200; k++) {
      fx.take(w);
      fx.update(1 / 60);
    }
    console.log(`bench effects: ${Math.round(performance.now() - t0)} ms`);
  });

  it('計測 格子', () => {
    const g = new Grid();
    const out: number[] = [];
    const t0 = performance.now();
    for (let f = 0; f < 60_000; f++) {
      g.clear();
      const cx = f * 1.5;
      for (let i = 0; i < 300; i++) g.add(i, cx + ((i * 37) % 300) - 150, ((i * 53) % 400) - 200);
      g.near(cx, 0, 40, out);
    }
    console.log(`bench grid: ${Math.round(performance.now() - t0)} ms`);
  });

  it('計測 障害物', () => {
    const o = { x: 0, y: 0 };
    const t0 = performance.now();
    for (let k = 0; k < 300_000; k++) {
      o.x = (k % 1000) * 3 + 200;
      o.y = Math.floor(k / 1000) * 3 + 200;
      pushOut('forest', o, 8);
    }
    console.log(`bench obstacles: ${Math.round(performance.now() - t0)} ms`);
  });
});
```

実行して、表示された 5 つの数（`[…]` の行）を `EXPECTED` に貼る。計測の 3 つの ms と、場面ごとの ms も控えておく
（最後の報告で前と後を並べる）。もう一度実行して同じ 5 つの数が出ること（同じ手元で毎回同じになること）を確かめる。

`apply(w, choices(w)[0])` か `openChest(w)` で例外が出たときは、`settle` の 3 択と宝箱の 2 行を、`overtime.test.ts` と同じ
`w.pending = 0; w.chests = 0;`（全員ぶん、`w.cur` を回して）に替えて作り直す。

**Verify**: `pnpm exec vitest run src/lib/games/animal-survivors/determinism.local.test.ts` → 4 つとも pass し、2 回続けて
同じ 5 つの数が出る。`git status --short` → `?? src/lib/games/animal-survivors/determinism.local.test.ts` の 1 行だけ。

**以降の項目ごとの共通の確かめ**（Step 1〜7 のそれぞれの最後に必ず行う）

1. `pnpm exec vitest run src/lib/games/animal-survivors/determinism.local.test.ts` → pass（`EXPECTED` と同じ 5 つの数）
2. `pnpm exec vitest run src/lib/games/animal-survivors/` → すべて pass
3. 足したテストのファイルと変えたソースだけを名指しで `git add` してコミットする

### Step 1: 粒の空きを番号の山で持つ（項目 1）

`effects.ts` を次のようにする。

1. `#bits` の下に、消えた粒の番号の山を足す

   ```ts
   /** 消えた粒の番号。大群を一度に倒すと 1 フレームに数千の粒を足すので、600 個の並びをなめて空きを探さない */
   readonly #free: number[] = [];
   ```

2. `#bit` を、山から取れれば使い、取れなければ並びが上限未満のときだけ足す形にする

   ```ts
   #bit(x: number, y: number, vx: number, vy: number, life: number, color: string, size = 2) {
     const i = this.#free.pop();
     if (i !== undefined) {
       Object.assign(this.#bits[i], { x, y, vx, vy, life, max: life, color, size });
       return;
     }
     if (this.#bits.length >= MAX_BITS) return;
     this.#bits.push({ x, y, vx, vy, life, max: life, color, size });
   }
   ```

3. `update()` の粒のループを番号つきにし、生きていた粒が 0 以下になった瞬間にだけ番号を山へ積む（すでに 0 以下の粒は
   今までどおり飛ばすので、同じ番号を 2 度積まない）

   ```ts
   for (let i = 0; i < this.#bits.length; i++) {
     const b = this.#bits[i];
     if (b.life <= 0) continue;
     b.life -= dt;
     b.x += b.vx * dt;
     b.y += b.vy * dt;
     b.vx *= 0.9;
     b.vy = b.vy * 0.9 + 80 * dt;
     if (b.life <= 0) this.#free.push(i);
   }
   ```

使い回す粒の場所が「いちばん前の空き」から「最後に消えた空き」に変わり、重なった粒の描く順が少し変わることがある。
粒は見た目だけで World に触らないので構わない。

`effects.test.ts` を作り、次のテストを書く（`draw()` の `fillRect` の回数で生きている粒の数を数える）。

```ts
import { describe, expect, it, vi } from 'vitest';
import { Effects } from './effects';
import { createWorld, type World } from './world';

vi.mock('$lib/audio.svelte', () => ({
  audio: { muted: false },
  toggleMute: () => {},
  bus: () => null,
  tone: () => {},
  sweep: () => {},
  noise: () => {}
}));

const VIEW = { w: 274, h: 394 };

function kills(w: World, n: number) {
  w.events.length = 0;
  for (let i = 0; i < n; i++) w.events.push({ type: 'kill', x: i, y: 0, enemy: 'rat' });
}

function drawn(fx: Effects): number {
  const ctx = { globalAlpha: 1, fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
  fx.draw(ctx as unknown as CanvasRenderingContext2D, 1);
  return ctx.fillRect.mock.calls.length;
}

describe('倒した敵の粒', () => {
  it('600 粒で頭打ちになり、消えた粒の場所を使い回し、同じ場所を 2 度は渡さない', () => {
    const w = createWorld('dog', 1, VIEW);
    const fx = new Effects();
    kills(w, 100);
    fx.take(w);
    expect(drawn(fx)).toBe(600);
    fx.update(1);
    expect(drawn(fx)).toBe(0);
    kills(w, 10);
    fx.take(w);
    fx.take(w);
    expect(drawn(fx)).toBe(160);
    fx.update(1);
    fx.update(1);
    kills(w, 100);
    fx.take(w);
    expect(drawn(fx)).toBe(600);
  });
});
```

**Verify**: `pnpm exec vitest run src/lib/games/animal-survivors/effects.test.ts` → pass。`grep -n "#bits.find" src/lib/games/animal-survivors/effects.ts`
→ 何も出ない。共通の確かめ 1〜3。コミットは `Reuse dead particles from a free list instead of scanning the pool`。

### Step 2: 格子のセルが増え続けないようにする（項目 2）

`grid.ts` の `clear()` で、空にしたあと `Map` が大きければ捨てる。ファイルの先頭のコメントも今の振る舞いに合わせる。

```ts
/** 当たり判定の格子。毎フレーム作り直すので、セルの配列は使い回して空にするだけにする */
```

を

```ts
/**
 * 当たり判定の格子。毎フレーム作り直すので、セルの配列は使い回して空にするだけにする。
 * 歩いた先のセルを覚え続けると延長戦で増え続けるので、多くなったらまとめて捨てる
 */
const KEEP_CELLS = 4096;
```

にし、`clear()` を次の形にする。

```ts
  clear() {
    for (const list of this.#used) list.length = 0;
    this.#used.length = 0;
    if (this.#cells.size > KEEP_CELLS) this.#cells.clear();
  }
```

`grid.test.ts` を作る。

```ts
import { describe, expect, it } from 'vitest';
import { Grid } from './grid';

describe('当たり判定の格子', () => {
  it('たくさんのセルを通ったあとも、そのフレームに足した番号だけを返す', () => {
    const g = new Grid();
    const out: number[] = [];
    for (let f = 0; f < 200; f++) {
      g.clear();
      for (let i = 0; i < 50; i++) g.add(i, f * 32 * 50 + i * 32, 0);
    }
    g.clear();
    g.add(7, 10, 10);
    g.add(8, 20, 20);
    expect(g.near(15, 15, 10, out)).toEqual([7, 8]);
    expect(g.near(199 * 32 * 50, 0, 10, out)).toEqual([]);
  });
});
```

**Verify**: `pnpm exec vitest run src/lib/games/animal-survivors/grid.test.ts` → pass。共通の確かめ 1〜3。
コミットは `Drop grid cells once the map grows past 4096 entries`。

### Step 3: `nearestHero` を番号のループにする（項目 3）

`heroes.ts` の `nearestHero` の中身だけを次にする。`best = 0` から始め、倒れた動物を飛ばし、`d < bd`（等しいときは前の番号が
残る）を変えない。

```ts
export function nearestHero(w: World, x: number, y: number): number {
  let best = 0;
  let bd = Infinity;
  const hs = w.heroes;
  for (let i = 0; i < hs.length; i++) {
    const h = hs[i];
    if (h.down) continue;
    const d = (h.player.x - x) ** 2 + (h.player.y - y) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}
```

`heroes.test.ts` の末尾に次の `describe` を足し、ファイルの先頭に `import { nearestHero } from './heroes';` を足す。

```ts
describe('いちばん近い動物', () => {
  it('同じ近さなら番号の小さい動物を選び、倒れた動物は飛ばし、全員倒れていれば 0', () => {
    const w = createWorld('dog', 1, { w: 274, h: 394 });
    addHero(w, 'cat');
    w.heroes[0].player.x = w.heroes[1].player.x = 10;
    w.heroes[0].player.y = w.heroes[1].player.y = 0;
    expect(nearestHero(w, 0, 0)).toBe(0);
    w.heroes[0].down = true;
    expect(nearestHero(w, 0, 0)).toBe(1);
    w.heroes[1].down = true;
    expect(nearestHero(w, 0, 0)).toBe(0);
  });
});
```

**Verify**: `pnpm exec vitest run src/lib/games/animal-survivors/heroes.test.ts` → pass。
`sed -n '/export function nearestHero/,/^}/p' src/lib/games/animal-survivors/heroes.ts | grep -c forEach` → `0`。共通の確かめ 1〜3。コミットは `Find the nearest hero with an indexed loop`。

### Step 4: 障害物を区画ごとに覚え、丸の当たりを閉包なしで見る（項目 4）

`obstacles.ts` を次のようにする。

1. 今の `obstacleAt` の中身をそのまま `function place(g: Ground, cx: number, cy: number): Obstacle | null` に移す
   （式・コメントは 1 文字も変えない。`export` は付けない）
2. 地面ごとの控えと、新しい `obstacleAt` を書く。`null`（障害物の無い区画）も覚える。返す物は凍らせ、どこかで書き換えると
   例外になるようにする（控えを共有するので）

   ```ts
   /** 区画ごとの障害物の控え。押し出す敵ごとに毎フレーム同じ区画を聞くので、地面ごとに覚える */
   const memo = new Map<Ground, Map<number, Obstacle | null>>();
   /** 延長戦で歩き続けても増え続けないよう、多くなったらその地面の控えをまとめて捨てる */
   const MEMO_MAX = 4096;

   export function obstacleAt(g: Ground, cx: number, cy: number): Obstacle | null {
     let m = memo.get(g);
     if (!m) memo.set(g, (m = new Map()));
     const k = (cx + 32768) * 65536 + (cy + 32768);
     const known = m.get(k);
     if (known !== undefined) return known;
     if (m.size >= MEMO_MAX) m.clear();
     const o = place(g, cx, cy);
     m.set(k, o && Object.freeze(o));
     return o;
   }
   ```

3. `obstaclesNear` の `.some(...)` を、同じ式のループに替える。比べる式
   `Math.hypot(x - o.x - dx, (y - o.y - dy) / SQUASH) < r + cr` は 1 文字も変えない

   ```ts
   export function obstaclesNear(g: Ground, x: number, y: number, r: number, out: Obstacle[]): Obstacle[] {
     out.length = 0;
     for (let cx = Math.floor((x - r - REACH) / CELL); cx <= Math.floor((x + r + REACH) / CELL); cx++)
       for (let cy = Math.floor((y - r - REACH) / CELL); cy <= Math.floor((y + r + REACH) / CELL); cy++) {
         const o = obstacleAt(g, cx, cy);
         if (!o) continue;
         for (const [dx, dy, cr] of SHAPES[o.kind].circles)
           if (Math.hypot(x - o.x - dx, (y - o.y - dy) / SQUASH) < r + cr) {
             out.push(o);
             break;
           }
       }
     return out;
   }
   ```

`obstacles.test.ts` の末尾に次の `describe` を足す（`GROUNDS` と `obstacleAt` はこのファイルの先頭にもうある）。

```ts
describe('障害物の控え', () => {
  it('同じ区画でも地面ごとにその地面の種類を返し、たくさん聞いたあとも前と同じ障害物を返す', () => {
    const first = new Map<string, unknown>();
    for (const g of GROUNDS)
      for (let c = -40; c < 40; c++) first.set(`${g} ${c}`, structuredClone(obstacleAt(g, c, c * 3)));
    for (const g of GROUNDS) for (let cx = 0; cx < 100; cx++) for (let cy = 0; cy < 50; cy++) obstacleAt(g, cx, cy);
    for (const g of GROUNDS)
      for (let c = -40; c < 40; c++) expect(obstacleAt(g, c, c * 3)).toEqual(first.get(`${g} ${c}`));
  });

  it('返した障害物は書き換えられない', () => {
    let o: Obstacle | null = null;
    for (let k = 1; !o; k++) o = obstacleAt('forest', k, 0);
    expect(() => {
      (o as Obstacle).x = 1;
    }).toThrow();
  });
});
```

1 つめのテストの 2 段目のループは 5000 区画を聞くので、`MEMO_MAX` を超えて控えを捨てる道も通る。

**Verify**: `pnpm exec vitest run src/lib/games/animal-survivors/obstacles.test.ts` → pass。
`grep -n "circles.some" src/lib/games/animal-survivors/obstacles.ts` → 何も出ない。共通の確かめ 1〜3。
Step 0 の「計測 障害物」の ms を控える。前より 20% 以上速くなっていなければ、2 の控えをやめて（`obstacleAt` を
1 の `place` の中身に戻し、`memo` と `MEMO_MAX` を消す）3 のループだけを残し、そのことを報告に書く。
コミットは `Remember obstacles per cell and test shapes without closures`（控えをやめたときは
`Test obstacle shapes without closures`）。

### Step 5: 遠い品の判定で並びを作らない（項目 5）

`drops.ts` の `collect` の上に次の関数を足す。`!(d > far2)` の形にするのは、距離が `NaN` のときも今の `every` と同じ答え
（遠くない）にするため。抜けていない動物が 1 匹もいなければ `true`（今の `[].every` と同じ）。

```ts
/** 抜けていない全員から far2 より遠いか（`!(… > far2)` は距離が NaN のときも遠くないとみなす今の判定に合わせる） */
function farFromAll(w: World, x: number, y: number, far2: number): boolean {
  for (const h of w.heroes) if (!h.gone && !((x - h.player.x) ** 2 + (y - h.player.y) ** 2 > far2)) return false;
  return true;
}
```

`collect` の条件を次にする。

```ts
    if (!KEEP.has(it.kind) && farFromAll(w, it.x, it.y, far2)) {
```

`drops.test.ts` の末尾に次の `describe` を足し、先頭の `import { createWorld } from './world';` を
`import { addHero, createWorld } from './world';` にする。

```ts
describe('遠い品を消す', () => {
  it('抜けた動物のそばの品は、残った動物から遠ければ消え、残った動物に近ければ残る', () => {
    const w = createWorld('dog', 1, { w: 274, h: 394 });
    addHero(w, 'cat');
    const mate = w.heroes[1];
    mate.gone = mate.down = true;
    mate.player.x = 5000;
    mate.player.y = 0;
    const p = w.heroes[0].player;
    w.items.push({ alive: true, kind: 'magnet', x: 5000, y: 0, pulled: false });
    w.items.push({ alive: true, kind: 'magnet', x: p.x + 1000, y: p.y, pulled: false });
    collect(w, 1 / 60);
    expect(w.items.at(-2)!.alive).toBe(false);
    expect(w.items.at(-1)!.alive).toBe(true);
  });
});
```

（`FAR_ITEM` は 3 で、画面の対角線は約 480 なので、消える距離は約 1440。`magnet` は `KEEP` に入っていない。）

**Verify**: `pnpm exec vitest run src/lib/games/animal-survivors/drops.test.ts` → pass。
`grep -n "filter((h) => !h.gone).every" src/lib/games/animal-survivors/drops.ts` → 何も出ない。共通の確かめ 1〜3。
コミットは `Check item distance to remaining heroes without allocating`。

### Step 6: 押し出される数字を作らない（項目 6）

`effects.ts` の `take()` で、`growing` の行の下に自分の `hit` の数を数える 2 行を足し、`hit` の枝で前のほうを飛ばす。
音（`hit = true`）は飛ばしても立てる。

```ts
// 1 フレームに何百の数字が出ても残るのは後ろの MAX_NUMBERS 個だけなので、押し出される数字は作らない
let skip = -MAX_NUMBERS;
for (const e of w.events) if (e.type === 'hit' && ownEvent(w, e)) skip++;
```

```ts
      if (e.type === 'hit') {
        hit = true;
        if (skip-- > 0) continue;
        this.#number(
```

飛ばした `hit` の位置のずらしに使う `Math.random()` の回数は減るが、これは種の乱数ではなく演出だけのもの。

`effects.test.ts` に次のテストを足す。文字を描く `./font` の `text` を差し替えて、描いた数字の文字列を見る
（ファイルの先頭の `vi.mock` の並びに足す）。

```ts
vi.mock('./font', () => ({ text: vi.fn(() => 0) }));
```

```ts
import { text } from './font';

describe('ダメージの数字', () => {
  it('1 フレームに 200 回当たっても、後ろの 60 個を古い順に出す', () => {
    const w = createWorld('dog', 1, VIEW);
    const fx = new Effects();
    for (let i = 1; i <= 200; i++) w.events.push({ type: 'hit', x: 0, y: 0, dmg: i, crit: false });
    fx.take(w);
    vi.mocked(text).mockClear();
    drawn(fx);
    expect(vi.mocked(text).mock.calls.map((c) => c[1])).toEqual(Array.from({ length: 60 }, (_, i) => String(141 + i)));
  });
});
```

（`import { text } from './font';` はファイルの先頭の import の並びに置く。）このテストは今のコードでも通る
（振る舞いを固めるテスト）。

**Verify**: `pnpm exec vitest run src/lib/games/animal-survivors/effects.test.ts` → 2 つとも pass。共通の確かめ 1〜3
（このステップは World に触らないので、控えの 5 つの数は当然そのまま）。コミットは
`Skip damage numbers that would be pushed out in the same frame`。

### Step 7: 小さな 3 つ（項目 7）

1. `world.ts` の `moveEnemy` に引数 `decay: number` を足し（`function moveEnemy(w: World, i: number, dt: number, decay: number)`）、
   中の `const decay = Math.pow(1e-4, dt);` を消す。`step` の `w.enemies.forEach((e, i) => {` のすぐ上に
   `const decay = Math.pow(1e-4, dt);` を置き、呼び出しを `moveEnemy(w, i, dt, decay);` にする。`dt` は同じ値なので
   `decay` も同じ値になる（節の敵の早い `return` の道では使わないだけ）
2. `storm.ts` の `windFactor` を、吹雪が無ければ `hypot` の前に返す形にする。式は変えない

   ```ts
   export function windFactor(w: World, vx: number, vy: number): number {
     if (w.storm.left <= 0) return 1;
     const sp = Math.hypot(vx, vy);
     if (sp === 0) return 1;
     return 1 + (STORM_WIND * (vx * w.storm.wx + vy * w.storm.wy)) / sp;
   }
   ```

3. `drops.ts` の `dropGem` を、数えるのと空きを探すのを 1 回目、上限に届いたときだけ一番遠い玉を 2 回目に探す形にする。
   2 回目は今と同じ順で同じ `d > fd` を使うので、同じ距離なら前の玉が選ばれるのも変わらない

   ```ts
   export function dropGem(w: World, x: number, y: number, value: number): void {
     const at = { x, y };
     pushOut(w.stage.art, at, 4);
     ({ x, y } = at);
     let count = 0;
     let free: Gem | undefined;
     for (const g of w.gems) {
       if (!g.alive) free ??= g;
       else count++;
     }
     if (count >= MAX_GEMS) {
       let far: Gem | undefined;
       let fd = -1;
       const p = w.player;
       for (const g of w.gems) {
         if (!g.alive) continue;
         const d = (g.x - p.x) ** 2 + (g.y - p.y) ** 2;
         if (d > fd) {
           fd = d;
           far = g;
         }
       }
       if (far) {
         far.value += value;
         return;
       }
     }
     const g = free ?? (w.gems[w.gems.length] = { alive: false, x: 0, y: 0, value: 0, pulled: false });
     Object.assign(g, { alive: true, x, y, value, pulled: false });
   }
   ```

   関数の上のコメント（`drops.ts:167`）はそのまま残す。

**Verify**: `grep -c "Math.pow(1e-4, dt)" src/lib/games/animal-survivors/world.ts` → `1`。
`pnpm exec vitest run src/lib/games/animal-survivors/storm.test.ts src/lib/games/animal-survivors/drops.test.ts` → pass。
共通の確かめ 1〜3。コミットは `Hoist enemy knockback decay and skip needless scans in wind and gem drops`。

### Step 8: 計測を控え、手元のファイルを消して全体を確かめる

1. `pnpm exec vitest run src/lib/games/animal-survivors/determinism.local.test.ts` をもう一度実行し、5 つの数が `EXPECTED` と
   同じことと、計測の 3 つの ms と場面ごとの ms を控える（Step 0 の値と並べて報告する）
2. `rm src/lib/games/animal-survivors/determinism.local.test.ts`

**Verify**: `git status --short` → 何も出ない。`pnpm verify` → exit 0。

## Test plan

- 足すテストは 6 つ。`effects.test.ts`（作る）に粒の頭打ちと使い回しで 1 つ・数字の後ろの 60 個で 1 つ、`grid.test.ts`（作る）に
  1 つ、`heroes.test.ts` に同じ近さの選び方で 1 つ、`obstacles.test.ts` に控えで 2 つ、`drops.test.ts` に抜けた動物のそばの品で 1 つ
  （合わせて 7 つの `it`）
- どれも浮動小数の細かい値に頼らないので、CI の x64 でも手元と同じに通る
- 「結果が 1 ビットも変わらない」ことは、手元だけの `determinism.local.test.ts` で項目ごとに確かめる（CI には載せない）
- お手本は `help-fx.test.ts`（`Effects` と音の差し替え）と `overtime.test.ts`（長いシミュの回し方）
- 今あるテストは 1 つも変えない。`pnpm test:run` → exit 0

## Done criteria

- [ ] `git log --oneline ea56ff6..HEAD` が 7 つのコミット（Step 4 で控えをやめたときもコミットは 7 つ）
- [ ] 7 つのコミットのそれぞれで、`determinism.local.test.ts` の 5 つの数が Step 0 の `EXPECTED` と同じだった（報告に書く）
- [ ] `grep -n "#bits.find" src/lib/games/animal-survivors/effects.ts` が何も返さない
- [ ] `grep -n "filter((h) => !h.gone).every" src/lib/games/animal-survivors/drops.ts` が何も返さない
- [ ] `grep -c "Math.pow(1e-4, dt)" src/lib/games/animal-survivors/world.ts` が `1`
- [ ] 今あるテストは行を足しただけ。`git diff ea56ff6..HEAD -- src/lib/games/animal-survivors/heroes.test.ts src/lib/games/animal-survivors/obstacles.test.ts src/lib/games/animal-survivors/drops.test.ts | grep "^-[^-]"` が `drops.test.ts` の `import { createWorld } from './world';` の 1 行だけを返す
- [ ] `git status --short` が何も返さない（`determinism.local.test.ts` が残っていない）
- [ ] `pnpm verify` が exit 0
- [ ] 報告に、計測（粒・格子・障害物・5 つの場面）の前と後の ms を並べた
- [ ] `plans/README.md` の 073 の行を更新し、`pnpm exec prettier --write plans/README.md` を通した

## STOP 条件

- Step 0 の 5 つの数が、変える前のコードのまま 2 回の実行で違う（手元でも結果が揺れるので、この確かめ方が使えない）
- どれかの項目のあとで 5 つの数のどれかが `EXPECTED` と違う。直そうとして式の順番を変えたり `EXPECTED` を貼り直したりしない。
  その項目の変更を `git restore` で戻して報告する
- 今あるテストが落ちる（特に `overtime.test.ts`・`audit-balance.test.ts` などの長いシミュ）。テストは直さない
- Step 4 で `Object.freeze` のために今あるテストかゲームのコードが例外を出す（どこかが障害物を書き換えている。報告する）
- 上の抜粋（`#bit`・`take`・`Grid.clear`・`nearestHero`・`obstacleAt`/`obstaclesNear`・`collect`・`moveEnemy`・`windFactor`・
  `dropGem`）が今のコードと違う
- `moveEnemy` を呼ぶ所が `world.ts` の 1 か所でない、または `step` の中で `dt` を書き換えている
- 玉・品・コインの数に上限を足したくなった（遊びが変わるので範囲の外）

## Maintenance notes

- `obstacleAt` は地面ごとに控えるので、障害物の置き方（`place` の式・`KINDS`・`SHAPES`）を変えるときは、控えの鍵が地面と区画の
  番号だけで足りるかを見直す。区画の番号は ±32768 の中で鍵がぶつからない（約 520 万ドット。延長戦 30 分でも届かない）
- 返す障害物は凍らせてあるので、障害物を動かしたり壊したりする仕掛けを足すときは、控えを使わずに作り直す道を別に作る
- 粒の番号の山は `update()` だけが積む。粒を `update()` の外で消す処理（たとえば画面を変えたときにまとめて消す）を足すときは、
  そこでも番号を積むこと
- 見送ったもの。`heroes.ts` の `tagged()` は 2 匹のとき出来事を積むたびに並びと物を作る。大群を倒すフレームで効くかもしれないが、
  今回の調べの外なので、計測してから別の計画にする
- レビューでは、各コミットで計算の式が並べ替えられていないか（`git diff` で式の行が同じか）と、選び方の `<`・`>` が変わって
  いないかを見る
