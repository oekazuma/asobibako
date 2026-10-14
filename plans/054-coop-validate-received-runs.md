# Plan 054: 協力プレイで相手の端末から届いた記録・選んだもの・位置の形を確かめてから使う

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 36cc037..HEAD -- src/lib/games/animal-survivors/coop.ts src/lib/games/animal-survivors/coop-run.ts src/lib/games/animal-survivors/records.ts src/lib/games/animal-survivors/coop.test.ts src/lib/games/animal-survivors/coop-run.test.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。`records.ts` は計画 062 も 233 行めを触る。
> 062 が先に入っていても、この計画で触る `ranksOf` の行と重ならなければ続けてよい。

## Status

| 項目       | 値                                                                                      |
| ---------- | --------------------------------------------------------------------------------------- |
| Priority   | P2                                                                                      |
| Effort     | S（形を確かめる関数を 3 つ足し、受け取る 4 か所で使う）                                 |
| Risk       | LOW（正しい知らせの扱いは変えない。既存の協力プレイのテストが正しい形を通すことを守る） |
| Depends on | none（045 は main に入っている）                                                        |
| Category   | bug                                                                                     |
| Planned at | commit `36cc037`, 2026-10-14                                                            |

## Why this matters

アニマルサバイバーの協力プレイは 2 台の iPad をつなぎ、親の端末が World を進める。子の端末は、決着したときに親から届く
「自分の動物のぶんのまとめ」（`HeroRun`）をそのまま自分の記録に足して保存する。まとめに欠けた数や文字が入っていると、
`record()` の足し算が `NaN` や文字列になり、保存し直した記録を読むと `parseRecords` がその値を 0 にする。つまり、
子どもが貯めたコインや最長の生存時間が黙って 0 に戻る。親の側も、子から届いた動物・段・装備（`pick`）と位置（`move`）を
確かめずに共通の World へ書く。知らない動物の id は `addHero` で落ち、文字の位置は子の動物の座標を文字列にする。

相手は同じ版の家族の端末なので、起きるのは版の食い違いや送る側の不具合のときだけ。ただし起きたときの害が「記録が消える」で、
戻す手段が無い。やっぱりカメレオンの審判は届いた体の形を `isMe`（`yappari-chameleon/host.ts:33-41`）で確かめてから使う。
同じ考え方で、受け取る 4 か所に形の確かめを入れ、形の違う知らせは捨てる。

## Current state

### 子が受け取るまとめ（直す）

`src/lib/games/animal-survivors/coop.ts:45-51` が記録に入れる口。

```ts
/** 届いたまとめを記録に入れて保存する。延長戦の 2 回めは first に足して見せる */
function store(sent: HeroRun, first: Outcome | null): Outcome {
  const r = loadRecords();
  const out = recordRun(r, sent, first?.run ?? null, first?.got ?? []);
  saveRecords(r);
  return out;
}
```

`src/lib/games/animal-survivors/coop.ts:340-349` は `CoopGuest` の受け取り。`record` と `keep` の `m.run` を確かめずに使う。

```ts
      } else if (m.t === 'record') {
        if (this.done) return;
        const out = store(m.run as HeroRun, this.#first);
        this.kept = null;
        if (m.final) {
          this.result = out;
          this.done = true;
        } else this.#first = out;
      } else if (m.t === 'end') this.result = this.#first;
      else if (m.t === 'keep') this.kept = m.run as HeroRun;
```

`kept` は親が切れたときに `#give()`（`coop.ts:392-396`）が `store(this.kept, this.#first)` で記録する。

### 記録に足す処理（読むだけ、変えない）

`src/lib/games/animal-survivors/records.ts:292-345` の `record(r, run)` は、まとめの値を次のように使う（抜粋）。

```ts
  r.best = Math.max(r.best, run.time);
  const mine = r.byAnimal[run.animal];
  ...
  r.kills += run.kills - (run.killsBefore ?? 0);
  for (const b of run.bosses) if (!r.bosses.includes(b)) r.bosses.push(b);
  if (run.cleared) {
    r.clears += 1;
    r.coins += run.heat.bet;
    r.heat[run.stage] = Math.max(r.heat[run.stage] ?? 0, run.heat.level);
  ...
  r.chests += run.opened;
  r.lavaKills += run.lavaKills ?? 0;
  r.tickets = r.tickets.map((n, i) => n + (run.tickets?.[i] ?? 0)) as Records['tickets'];
  r.coins += run.coins;
  ...
  if (run.overtime) r.overtime[run.stage] = Math.max(r.overtime[run.stage] ?? 0, run.overtime.secs);
  ...
    r.coins += run.daily.bonus;
  ...
    o.raises += c.heroes.reduce((n, h) => n + h.raises, 0);
    o.links += c.links;
    o.carries += c.carries;
    const key = pairKey(c.heroes[0].animal, c.heroes[1].animal);
  ...
  run.bookCoins = addBook(r, run);
  r.coins += run.bookCoins;
  return grant(r, run);
```

`addBook`（`book.ts:84-112`）は `run.book.kills` の値を足し、`run.book.bosses` の `secs` を比べ、`elites`・`chiefs`・
`forms`・`items` を数え上げる。`grant`（`achievements.ts:249-269`）の条件は `run.kills`・`run.level`・`run.bosses`・
`run.evolved`・`run.metal`・`run.shrines`・`run.weapons`（`o.level` と `o.lb`）を読む。`recordRun`（`coop-run.ts:33-54`）は
`part` を記録に入れ、`full` と `first.coop.bonus` で画面に見せるまとめを作る。

コインが消える道筋は次のとおり。JSON は `NaN` を `null` にして運ぶので、`r.coins += null` は 0 を足すだけで害が無い。
害が出るのは、欠けた値（`r.coins += undefined` が `NaN`）と文字（`r.coins += 'x'` が文字列）。保存は `JSON.stringify` なので
`NaN` は `null` になり、次に読むと `records.ts:120` の `num` が 0 にする。

```ts
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
```

`records.ts:247` には数かどうかだけを見る `isNum` もある（非公開）。

### 親が受け取る選んだものと位置（直す）

`src/lib/games/animal-survivors/coop.ts:98-108`

```ts
    party.onAct((m, from) => {
      if (m.t === 'hi') {
        version = m.v === COOP_VERSION;
        if (!version) party.tell(from, { t: 'coop-mismatch' });
      } else if (m.t === 'pick') {
        if (!version) return;
        this.guest = { animal: m.animal as AnimalId, ranks: m.ranks as Ranks, gear: m.gear as GearKey[] };
        this.ready = true;
        party.tell(from, { t: 'picked' });
      } else if (m.t === 'move') {
        if (!this.paused) this.#moves.push(m.ms as number, performance.now(), m as unknown as Move);
```

`this.guest` は `start()`（`coop.ts:223-234`）で `addHero(w, this.guest.animal, this.guest.ranks, this.guest.gear)` に渡る。
位置は `before()`（`coop.ts:237-248`）が `p.x = m.a.x + (m.b.x - m.a.x) * m.t` のように親の World の子の動物へ書く。
`Move` は `coop.ts:62-69` の `{ x, y, facing: 1 | -1, aimX, aimY, moving }`。`Timeline.push(src, local, v)` の `src` に
数でない値が入ると、`offset()` の `Math.min` が `NaN` になり、以後の位置がすべて壊れる（`src/lib/net/timeline.ts:7-17`）。

段と装備には、記録を読むときの確かめがすでにある。段は `records.ts:281-290` の `ranksOf`（非公開）。

```ts
/** 知らない品と数でない段は読み飛ばし、段は 0〜最大の整数にする */
function ranksOf(v: unknown): Ranks {
  const out: Ranks = {};
  if (!v || typeof v !== 'object') return out;
  for (const d of UPGRADES) {
    const n = Math.min(d.max, Math.floor(num((v as Record<string, unknown>)[d.id])));
    if (n > 0) out[d.id] = n;
  }
  return out;
}
```

装備は `gear.ts:133-144` の `keyOf` と `parseKey`（崩れた名前は `null`）。`gacha.ts:183-186` が保存の読み込みで
`parseKey` → `keyOf` の順に使っている。動物の一覧は `animals.ts:33` の `ANIMALS`、面の一覧は `stages/index.ts:6` の `STAGES`。

### お手本

`src/lib/games/yappari-chameleon/host.ts:33-41`

```ts
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const v3 = (v: unknown): v is V3 => Array.isArray(v) && v.length === 3 && v.every(num);
const isMe = (m: Message): boolean =>
  num(m.ms) &&
  v3(m.pos) &&
  num(m.yaw) &&
  typeof m.pose === 'string' &&
  Array.isArray(m.look) &&
  m.look.length === 2 &&
  (m.eye === undefined || m.eye === null || v3(m.eye));
```

### テストの道具

`src/lib/games/animal-survivors/coop.test.ts` に、手元でつないだ管の `pipes()`、つないで「はじめる」まで進める `started()`
（`{ host, guest, w, h, g, told, pipe }` を返す。`host` と `guest` は `Party`）、`pair()`、メモリの `memoryStorage()`、
`settle()` がある。親から子へ偽の知らせを送るには `host.tell(2, {...})`、子から親へは `guest.act({...})`
（`coop.test.ts:259-270` の版ちがいのテストが `guest.act` で `hi` を送る）。記録を見るテストは
`vi.stubGlobal('localStorage', memoryStorage())` と `localStorage.setItem(RECORDS_KEY, ...)` で始め、
`vi.unstubAllGlobals()` で終える（`coop.test.ts:393-407`）。

規約は次のとおり。

- コメントは「コードから復元できない WHY」だけを日本語で書く。WHAT・変更履歴・チケット番号は書かない
- テストの名前は日本語の文にする
- `.svelte` は触らない

## Commands you will need

| Purpose    | Command                                                                                                            | Expected on success           |
| ---------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| 足すテスト | `pnpm exec vitest run src/lib/games/animal-survivors/coop.test.ts src/lib/games/animal-survivors/coop-run.test.ts` | すべて pass                   |
| 全テスト   | `pnpm test:run`                                                                                                    | exit 0                        |
| 型         | `pnpm check`                                                                                                       | `0 ERRORS 0 WARNINGS`、exit 0 |
| lint       | `pnpm lint`                                                                                                        | exit 0                        |
| 全部       | `pnpm verify`                                                                                                      | exit 0                        |

## Scope

**In scope**

- `src/lib/games/animal-survivors/coop-run.ts`（`runOf` を足す）
- `src/lib/games/animal-survivors/coop.ts`（受け取る 4 か所と、`meOf`・`isMove`）
- `src/lib/games/animal-survivors/records.ts`（`ranksOf` に `export` を付けるだけ）
- `src/lib/games/animal-survivors/coop.test.ts`（テストを足す）
- `src/lib/games/animal-survivors/coop-run.test.ts`（テストを足す）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- `record()`・`recordRun()`・`addBook()`・`grant()` の中身 — 1 人で遊ぶ回も通る。受け取る口で止めれば足りる
- `CoopGuest` の `start`（`coop.ts:329-331`、`m.animal` と `m.stage` を確かめずに `createWorld` へ渡す）と、`snap`・`offer`・
  `rewards` の受け取り — 記録を消さない。落ちても `last-error` に残るだけ（Maintenance notes に残す）
- 確かめに落ちたときに画面へ何か出すこと — 知らせを捨てるだけにする
- `src/lib/net/` の全部（`Party`・`link.ts` の `JSON.parse`）
- `COOP_VERSION` を上げること — 送る形は変えない

## Git workflow

- ブランチは `advisor/054-coop-validate-received-runs`
- コミットは 1 つか、Step ごと。英語の命令形 1 文（例 `Validate coop runs, picks and moves received from the other device`）。
  Co-Authored-By などの trailer は付けない
- push しない（`main` への push は本番に出る）

## Steps

### Step 1: 落ちるテストを先に書く

`coop.test.ts` の import に `heroRun`（`./coop-run`）と `UPGRADES`（`./upgrades`）を足し、`describe('協力プレイのつなぎ', ...)`
の中の最後に次の 3 つを足す。

```ts
it('親から届いたまとめにコインが欠けていたら、子は記録に入れず、貯めたコインを消さない', async () => {
  vi.stubGlobal('localStorage', memoryStorage());
  localStorage.setItem(RECORDS_KEY, JSON.stringify({ ...emptyRecords(), coins: 500 }));
  const { host, w, g } = await started();
  w.over = 'dead';
  const run = JSON.parse(JSON.stringify(heroRun(w, 1)));
  delete run.part.coins;
  delete run.full.coins;
  host.tell(2, { t: 'record', run, final: true });
  await settle();
  expect(loadRecords().coins).toBe(500);
  expect(g.result).toBeNull();
  // 形の正しいまとめは、そのあとでも記録する
  host.tell(2, { t: 'record', run: heroRun(w, 1), final: true });
  await settle();
  expect(g.result?.run.animal).toBe('cat');
  expect(loadRecords().coins).toBeGreaterThanOrEqual(500);
  vi.unstubAllGlobals();
});

it('子が知らない動物を選んだら受け取らず、段と装備は知っているものだけにする', async () => {
  const { host, guest } = await pair();
  const h = new CoopHost(host);
  guest.act({ t: 'hi', v: COOP_VERSION });
  guest.act({ t: 'pick', animal: 'dragon', ranks: {}, gear: [] });
  await settle();
  expect(h.ready).toBe(false);
  guest.act({ t: 'pick', animal: 'cat', ranks: { might: 99, nope: 3 }, gear: ['hachimaki:2', 'nope:2', 7] });
  await settle();
  const max = UPGRADES.find((d) => d.id === 'might')!.max;
  expect(h.guest).toEqual({ animal: 'cat', ranks: { might: max }, gear: ['hachimaki:2'] });
});

it('子から届いた位置が数でなければ、親の World の子の動物を動かさない', async () => {
  const { guest, w, h } = await started();
  const x = w.heroes[1].player.x;
  guest.act({ t: 'move', ms: performance.now(), x: 'a', y: 0, facing: 1, aimX: 1, aimY: 0, moving: true });
  await settle();
  h.before(performance.now() + 1000);
  expect(w.heroes[1].player.x).toBe(x);
});
```

1 つめの最後の式が「500 以上」なのは、正しいまとめを記録すると図鑑と実績のコインが足されるから。

**Verify**: `pnpm exec vitest run src/lib/games/animal-survivors/coop.test.ts` → 足した 3 つが落ちる。1 つめは
`expected 0 to be 500`、2 つめは `expected true to be false`、3 つめは `x` が文字列になって等しくない。ほかは pass。

### Step 2: `coop-run.ts` に `runOf` を足す

`coop-run.ts` の import に `ANIMALS`（`./animals`）と `STAGES`（`./stages`）を足し、`recordRun` の下に次を足す。
受け取ったものは直さずに、形が違えば丸ごと断る（`num` のように 0 にすると、コインの無い回として黙って記録してしまう）。

```ts
const ANIMAL_IDS: readonly unknown[] = ANIMALS.map((a) => a.id);
const STAGE_IDS: readonly unknown[] = STAGES.map((s) => s.id);
/** 記録に足す数。欠けた値・文字・負の数を足すと、保存し直したときに parseRecords が 0 に戻す */
const n = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const obj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const strs = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === 'string');
const opt = (v: unknown, ok: (x: unknown) => boolean) => v === undefined || ok(v);

function coopOk(c: unknown): boolean {
  return (
    obj(c) &&
    [c.links, c.carries, c.bonus].every(n) &&
    Array.isArray(c.heroes) &&
    c.heroes.length === 2 &&
    c.heroes.every((h) => obj(h) && ANIMAL_IDS.includes(h.animal) && n(h.raises))
  );
}

/** record()・図鑑・実績が足し算と鍵と数え上げに使う値だけを見る。見せるだけの値は見ない */
function summaryOk(s: unknown): boolean {
  if (!obj(s) || !obj(s.heat) || !obj(s.book)) return false;
  const { heat, book } = s;
  return (
    ANIMAL_IDS.includes(s.animal) &&
    STAGE_IDS.includes(s.stage) &&
    typeof s.cleared === 'boolean' &&
    [s.time, s.level, s.kills, s.coins, s.opened, heat.level, heat.bet].every(n) &&
    [s.killsBefore, s.lavaKills, s.shrines].every((v) => opt(v, n)) &&
    strs(s.bosses) &&
    strs(s.evolved) &&
    opt(s.relics, strs) &&
    opt(s.tickets, (t) => Array.isArray(t) && t.every(n)) &&
    Array.isArray(s.weapons) &&
    s.weapons.every((o) => obj(o) && typeof o.id === 'string' && n(o.level) && opt(o.lb, n)) &&
    opt(s.overtime, (o) => obj(o) && n(o.secs)) &&
    opt(s.daily, (d) => obj(d) && typeof d.date === 'string' && n(d.bonus)) &&
    obj(book.kills) &&
    Object.values(book.kills).every(n) &&
    [book.elites, book.chiefs, book.forms, book.items].every(strs) &&
    Array.isArray(book.bosses) &&
    book.bosses.every((b) => obj(b) && typeof b.id === 'string' && n(b.secs)) &&
    opt(s.coop, coopOk)
  );
}

/** 相手の端末から届いたまとめ。形が違えば null（記録に入れると、コインや最長の秒が 0 に戻る） */
export function runOf(v: unknown): HeroRun | null {
  return obj(v) && summaryOk(v.part) && summaryOk(v.full) ? (v as unknown as HeroRun) : null;
}
```

`STAGE_IDS` で面の id を確かめるのは、`r.heat[run.stage]` のような鍵に `__proto__` などが入らないようにするため。
`n` の名前が `record` の中の変数とぶつかるなど lint に当たったら、`fin` などに変えてよい。

**Verify**: `pnpm check` → `0 ERRORS 0 WARNINGS`。

### Step 3: `coop-run.test.ts` に `runOf` のテストを足す

`coop-run.test.ts` の import に `runOf` を足し、`describe` の中に次を足す（`cleared()` はこのファイルにある）。

```ts
it('相手の端末から届いたまとめは、正しい形なら通し、欠けた数や知らない面は断る', () => {
  const w = cleared();
  const sent = () => JSON.parse(JSON.stringify(heroRun(w, 1)));
  expect(runOf(sent())).not.toBeNull();
  startOvertime(w);
  w.over = 'dead';
  expect(runOf(sent())).not.toBeNull();
  const noCoins = sent();
  delete noCoins.part.coins;
  expect(runOf(noCoins)).toBeNull();
  const text = sent();
  text.full.kills = '9999';
  expect(runOf(text)).toBeNull();
  const proto = sent();
  proto.part.stage = '__proto__';
  expect(runOf(proto)).toBeNull();
  expect(runOf(null)).toBeNull();
});
```

**Verify**: `pnpm exec vitest run src/lib/games/animal-survivors/coop-run.test.ts` → すべて pass。

### Step 4: 子の受け取りで `runOf` を使う

`coop.ts` の import を `import { heroRun, recordRun, runOf, type HeroRun } from './coop-run';` にし、`coop.ts:340-349` を
次の形にする。

```ts
      } else if (m.t === 'record') {
        const run = runOf(m.run);
        if (this.done || !run) return;
        const out = store(run, this.#first);
        this.kept = null;
        if (m.final) {
          this.result = out;
          this.done = true;
        } else this.#first = out;
      } else if (m.t === 'end') this.result = this.#first;
      // 形の違うまとめは捨て、前に届いた正しいまとめを残す
      else if (m.t === 'keep') this.kept = runOf(m.run) ?? this.kept;
```

`#give()` は `kept` しか記録しないので、そのままでよい。

**Verify**: `pnpm exec vitest run src/lib/games/animal-survivors/coop.test.ts -t "コインが欠けていたら"` → pass。

### Step 5: 親の受け取りで、選んだものと位置を確かめる

1. `records.ts:282` の `function ranksOf` を `export function ranksOf` にする（中身は変えない）
2. `coop.ts` の import を次のように変える
   - `import type { AnimalId } from './animals';` を `import { ANIMALS, type AnimalId } from './animals';` に
   - `import { loadRecords, saveRecords } from './records';` を `import { loadRecords, ranksOf, saveRecords } from './records';` に
   - `import type { GearKey } from './gear';` を `import { keyOf, parseKey, type GearKey } from './gear';` に
   - `import type { Ranks } from './upgrades';` は `Me` の型で使っているので残す（使われなくなったら lint が教えるので外す）
3. `interface Move { ... }`（`coop.ts:62-69`）の下に次を足す

```ts
const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
/** 子から届いた位置。数でない値が入ると、親の World の子の動物の座標と、届いた時刻の並び（Timeline）が壊れる */
const isMove = (m: Message): m is Message & Move & { ms: number } =>
  fin(m.ms) &&
  fin(m.x) &&
  fin(m.y) &&
  fin(m.aimX) &&
  fin(m.aimY) &&
  (m.facing === 1 || m.facing === -1) &&
  typeof m.moving === 'boolean';

/** 子が選んだもの。知らない動物は断り、段と装備は保存を読むときと同じく知っているものだけにする */
function meOf(m: Message): Me | null {
  if (!ANIMALS.some((a) => a.id === m.animal)) return null;
  const gear = (Array.isArray(m.gear) ? m.gear : []).flatMap((k) => {
    const p = typeof k === 'string' ? parseKey(k) : null;
    return p ? [keyOf(p.def.id, p.rarity)] : [];
  });
  return { animal: m.animal as AnimalId, ranks: ranksOf(m.ranks), gear };
}
```

4. `coop.ts:102-108` を次の形にする

```ts
      } else if (m.t === 'pick') {
        const me = meOf(m);
        if (!version || !me) return;
        this.guest = me;
        this.ready = true;
        party.tell(from, { t: 'picked' });
      } else if (m.t === 'move') {
        if (!this.paused && isMove(m)) this.#moves.push(m.ms, performance.now(), m);
```

**Verify**: `pnpm exec vitest run src/lib/games/animal-survivors/coop.test.ts src/lib/games/animal-survivors/coop-run.test.ts`
→ すべて pass（Step 1 の 3 つと、もとからある `子が動物を選ぶまでは始められず…`（`ranks: { might: 2 }`）・
`倒れて終わると…`・`親が切れたら…`・`延長戦の途中で子がやめると…` を含む）。

### Step 6: 全体の確かめ

**Verify**: `grep -n "as HeroRun\|as unknown as Move\|m.ranks as Ranks" src/lib/games/animal-survivors/coop.ts` → 何も出ない。
`pnpm verify` → exit 0。

## Test plan

- `coop.test.ts` に 3 つ（コインの欠けたまとめを記録しない・知らない動物と崩れた段と装備・数でない位置）
- `coop-run.test.ts` に 1 つ（10:00 のまとめと延長戦のまとめは通り、欠けた数・文字の数・`__proto__` の面・`null` は断る）
- 正しい形を誤って断っていないことは、もとからある記録のテスト（`coop.test.ts` の `倒れて終わると…`・
  `クリアで延長戦を選ばなければ…`・`親が切れたら…`・`子がやめると…`・`延長戦の途中で子がやめると…`）が守る
- 型にするのは `coop.test.ts:393-407` と `coop.test.ts:259-270`

## Done criteria

- [ ] Commands の「足すテスト」が pass し、足した 4 つを含む
- [ ] Step 6 の grep が何も返さない
- [ ] `pnpm verify` が exit 0
- [ ] `git status` で in scope 以外のファイルが変わっていない
- [ ] `plans/README.md` の 054 の行を更新し、`pnpm exec prettier --write plans/README.md` を通した

## STOP 条件

- 上の抜粋（`coop.ts` の受け取り 2 か所、`record()`、`ranksOf`）が今のコードと違う
- もとからある協力プレイの記録のテストが `runOf` を入れたあとに落ちる（正しいまとめを断っている。どの項目で落ちたかを
  `summaryOk` を 1 行ずつ外して見つけ、その項目を `RunSummary`（`world.ts:1092-1138`）の型と見比べて報告する。条件をゆるめて
  通さない）
- `summaryOk` が 60 行を超えそう、または `RunSummary` の全部の項目を確かめたくなった（記録に足す値だけを見る計画）
- 確かめを `record()` や `store()` の中に入れたくなった（1 人で遊ぶ回の記録の道を変える）
- `COOP_VERSION` を上げたくなった

## Maintenance notes

- `record()` で新しくまとめの値を足し算や鍵に使うときは、`coop-run.ts` の `summaryOk` にも足す。足し忘れても協力プレイの
  正しい回は通るが、その値は確かめられない
- 形の違う最後の `record` を捨てた子は、リザルトが出ないまま待つ。抜けるのは一時停止の「やめる」で、`#give()` が最後に届いた
  正しい `keep` を記録する。画面に理由を出すのはこの計画の外
- 子の `start` の `m.animal`・`m.stage` と、`snap`・`offer`・`rewards` の形は確かめていない。落ちても記録は消えない
- レビューでは、`summaryOk` が `heroRun` の作るまとめ（`world.ts:1145-1215` の `summary` と `overtime.ts` の `overtimeRun`）を
  全部通すか、とくに `book.bosses[].secs` と `coop.heroes` が 2 匹そろう前提を見る
