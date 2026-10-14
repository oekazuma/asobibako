# Plan 063: カメレオンのつないだ試合の空いた席に、CPU を 1 人足せる試作を作る（iPad で触ってもらうまで）

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。これは試作の計画で、最後のステップ
> 「iPad で触ってもらう」で止まる。見た目や言葉の作り込みはしない。終わったら `plans/README.md` の自分の行の Status を
> 更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 36cc037..HEAD -- src/lib/games/yappari-chameleon/cpu/crew.ts src/lib/games/yappari-chameleon/cpu/crew.test.ts src/lib/games/yappari-chameleon/Yappari.svelte src/lib/games/yappari-chameleon/Lobby.svelte src/lib/games/yappari-chameleon/Lobby.svelte.test.ts src/lib/games/yappari-chameleon/Overlay.svelte src/lib/games/yappari-chameleon/Overlay.svelte.test.ts src/lib/games/yappari-chameleon/Settings.svelte src/lib/games/yappari-chameleon/Settings.svelte.test.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。CLAUDE.md は毎日変わるので drift check に
> 入れていない。Step 7 で直す文は grep で探す。

## Status

| 項目       | 値                                                                                    |
| ---------- | ------------------------------------------------------------------------------------- |
| Priority   | P2                                                                                    |
| Effort     | M                                                                                     |
| Risk       | MED（つないだ試合の席の割り当てにかかわる。`Party` と `Host` と知らせの形は変えない） |
| Depends on | none                                                                                  |
| Category   | direction（試作）                                                                     |
| Planned at | commit `36cc037`, 2026-10-14                                                          |

## Why this matters

やっぱりカメレオンは、2〜3 人がそれぞれの iPad を QR でつないで遊ぶかくれんぼ。家族 2 人で遊ぶと「ハンター 1 人と隠れる人 1 人」になり、
最初の 1 発が当たった時点で試合が終わる。3 つめの席に CPU を座らせれば「ハンター 1 人と隠れる人 2 人」（または人 2 人で探す）になり、
1 回の試合が長く続く。

CPU と遊ぶの設計書（`docs/superpowers/specs/2026-10-10-yappari-chameleon-cpu-design.md:15`）は
「人と CPU を混ぜて遊ぶ（2〜3 人のつないだ試合の空いた席に CPU を足す）のは次の段にする。この段の作りは、CPU を席に座らせる形にしてそれを妨げない」
と書いている。持ち主の方針は「手ざわりで面白さが決まるものは、最小の試作を iPad で触ってもらってから作り込む」なので、
この計画は動く最小の形までを作り、iPad で触ってもらう所で止める。

## Current state

### CPU を席に座らせる仕組み（`src/lib/games/yappari-chameleon/cpu/crew.ts`）

CPU は「手元でつないだ見えない子」で、`Party.add` に手元の管を渡して子と同じ手順で座る。`Crew` がそれを束ねる。
コンストラクタはロビーの台を切る（`cpu/crew.ts:33-39`）。

```ts
  constructor(party: Party, host: Host, rand: () => number = Math.random) {
    this.#party = party;
    this.#host = host;
    this.#rand = rand;
    // ハンターは CPU の設定の役で決めるので、ロビーの台はハンター希望に使わない
    host.podium = false;
  }
```

人数を合わせる `#seat`（`cpu/crew.ts:61-81`）は、減らすときに閉じた席が顔ぶれから抜け終わるまで待つ。

```ts
  /** 減らすときは、閉じた席が顔ぶれから抜け終わるまで待つ */
  async #seat(c: CpuChoice): Promise<void> {
    while (this.bots.length > c.count) {
      const bot = this.bots.pop()!;
      bot.close();
      await bot.gone;
    }
    while (this.bots.length < c.count && !this.#stopped) {
      const [a, b] = pipes();
      const bot = new Bot(b, {
        strength: c.strength,
        index: this.bots.length,
        rand: this.#rand,
        senses: () => this.#senses
      });
      this.bots.push(bot);
      // 抜けたあとは Party が管を閉じて席を返さない。そこでやめる
      if (typeof (await this.#party.add(a)) !== 'number') return;
    }
    for (const bot of this.bots) bot.strength = c.strength;
  }
```

席替えと始めるのは `#next`（`cpu/crew.ts:45-49`）で 1 本の列に載せ、呼ばれた順に 1 つずつ進める。`CpuChoice.count` の型は `1 | 2`
（`cpu/levels.ts:89-98`）、強さの型は `Strength = 'weak' | 'normal' | 'strong'`（`cpu/levels.ts:1`）。

`Bot`（`cpu/bot.ts`）は `Party.guest(pipe, { look: 'cpu' })` で入る。`was` は渡さない。役は届いた試合の様子で決まり、
ロビーではロビーの席の場所（`SPAWNS.lobby`）に立ち、隠れる役なら隠れタイムに隠れて塗り、ハンターなら探索で探す（`cpu/bot.ts:134-166`）。
ロビーの席の場所は台の中心から 4.5m 離れている（`mansion/lobby.ts:9` の `PODIUM.at` が `[0, 0, -60]`、`:69` の `LOBBY_SPAWNS` は z が −64.5）ので、
CPU が台の上に立ってハンター希望になることは無い。

### 席の決め方（`src/lib/net/party.svelte.ts:112-129`）

```ts
  #seat(pipe: Pipe, was: Seat | null, look: string | null): Seat | null {
    const free = (s: Seat) => !this.#pipes.has(s);
    const back = was !== null && this.away.includes(was) && free(was) ? was : undefined;
    const seat = back ?? this.away.find(free) ?? ([2, 3] as const).find((s) => free(s) && !this.away.includes(s));
```

番号を持たない子（`was` が null。CPU はいつもこれ）は、切れた人の席（`away`）があれば**そこに先に座る**。だから人が切れているあいだに
CPU を足すと、戻ってくる人の席を CPU が取ってしまう。この計画では「切れた人がいるあいだは CPU を足さない」で防ぐ（`Party` は変えない）。

子の管が閉じると `#drop`（`party.svelte.ts:168-175`）がその席を `away` に入れる。CPU を外したときもそうなるので、そのままだと
「よびなおす」に CPU の席が出る。`away` と `looks`（席 → 動物。CPU は `'cpu'`）は `Party` の公開の `$state` で、親の端末で書ける。
`looks` を消さないと、あとでその席に来た人が「CPU 2」と呼ばれる（`match.svelte.ts:19-20` の `nameOf` は `looks[seat] === 'cpu'` を見る）。

`Party.add` は子を 2 つまでしか受けない（`party.svelte.ts:83`）ので、3 人そろっていれば CPU は足せない。

### 親になる流れ（`src/lib/games/yappari-chameleon/Yappari.svelte`）

「なかまを呼ぶ」の親は `Entry` の `onhost={hosting}` で審判を作り（`Yappari.svelte:35-48`）、子を迎えたら `joined` でつないだ画面へ移る。
「CPU と遊ぶ」は `cpu()`（`Yappari.svelte:51-61`）が `hosting(p)` のあとに `new Crew(p, host!)` を作る。

```ts
  async function cpu(choice: CpuChoice) {
    const p = Party.host();
    hosting(p);
    const c = new Crew(p, host!);
    crew = c;
```

審判のループ（`hosting` の `animate`）は `crew?.step(dt, now)` で CPU を進め、`unhost()` が `crew?.stop()` で止める。
画面は `<Entry ... onhost={hosting} ... />`（`Yappari.svelte:104`）。

つないだ画面 `Online.svelte:65-71` は、3D ができたとき `crew` があれば CPU の目（`Senses3d`）を作って渡す。

```ts
if (crew) {
  senses = new Senses3d(world, (seat) => s.rigOf(seat));
  crew.useSenses(senses);
  // 目の絵の shader を作る 1 秒ほどの止まりを、紹介の前に済ませる
  senses.warm();
  crew.go();
}
```

目が無いと、隠れる CPU は塗らない（`cpu/hider.ts:126` の `if (ctx.view.phase !== 'hide' || this.done || !senses) return;`）。
だから人の試合でも `Crew` は Online ができる前（親になったとき）に作っておく。`crew.go()` は何も積んでいなければ何もしない。

### 「crew があれば CPU と遊ぶ」と読んでいる所

- `Lobby.svelte:19` の `const players = $derived(crew ? choice.count + 1 : party.members.length);`
- `Lobby.svelte:23-26` の許可の `$effect`（`const on = crew ? choice.petit : settings.petit;`）
- `Lobby.svelte:39-42` の `begin()`（`if (crew) void crew.play(...) else session.start(settings);`）
- `Lobby.svelte:59-65` のボタン（`{#if crew}` で「CPU の設定」、`{:else if party.members.length < 3}` で「なかまを呼ぶ」）
- `Lobby.svelte:74` の `<Settings ... cpu={!!crew} ... />`
- `Overlay.svelte:92-95` の「よびなおす」

```svelte
<!-- CPU と遊ぶで人数を減らすと、閉じた CPU の席が切れた席として残るので、呼び直しを出さない -->
{#if session.party.host && !crew}
  <Invite away={session.party.away} bind:open={inviting} onlink={(link) => session.invite(link)} />
{/if}
```

人の試合に CPU を足す `Crew` は、これらでは「CPU と遊ぶ」と扱わない。区別のため `Crew` に `mixed` を足す。テストの偽物の crew
（`{ play }` だけ）は `mixed` が `undefined` なので、今までどおり「CPU と遊ぶ」と読まれ、今のテストは変えずに通る。

### 役の決め方

人の試合は `session.start(settings)` → `Host.start(settings)`（ハンターを渡さない）→ `rules.start` の `pickHunters` で、
台の希望の人から選び、足りなければ乱数で選ぶ（`referee.ts:144-154`）。CPU は台に乗らないので希望にならず、
ハンターが足りないときだけ乱数でハンターになりうる。CPU はどちらの役でも動く。この試作はこの決め方をそのまま使う
（`Host.start` に決め打ちのハンターを渡さない）。

ダブルは CPU と遊ぶでは選べない（CPU はダブルの「残した体を探す」を知らない）。CPU が座っているあいだはダブルを選べなくし、
保存した設定がダブルでも増え鬼で始める。

### 確かめの道具

ブラウザ 2 台の通しの台本（偽カメラで QR を渡す）はリポジトリに無い（前の作業の一時置き場にあったが消えている）。
`cpu/crew.test.ts` の `table()`（`cpu/crew.test.ts:27-89`）が、本物の `Party.host()`・`Host`・`Crew` を node で同じ時計で進める
道具で、手元の管（`cpu/pipe.ts` の `pipes()`）で人の子も作れる。この計画の確かめはこれで行う。

### 規約

- コメントは「コードから復元できない WHY」だけを日本語で書く（変更履歴やタスク番号は書かない）
- `.svelte` は 200 行未満（svelte-vitals の `architecture/component-size`）。今は `Lobby.svelte` 111 行、`Overlay.svelte` 127 行、
  `Settings.svelte` 170 行、`Yappari.svelte` 106 行
- テストの名前は日本語の文にする
- 画面の言葉は大人向けの漢字まじりにそろえる（CPU の強さは「弱い」「普通」「強い」）

## Commands you will need

| Purpose        | Command                                                                                                                                                                                    | Expected on success           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| CPU の席       | `pnpm exec vitest run src/lib/games/yappari-chameleon/cpu/crew.test.ts`                                                                                                                    | すべて pass                   |
| ロビーと画面   | `pnpm exec vitest run src/lib/games/yappari-chameleon/Lobby.svelte.test.ts src/lib/games/yappari-chameleon/Overlay.svelte.test.ts src/lib/games/yappari-chameleon/Settings.svelte.test.ts` | すべて pass                   |
| カメレオン全部 | `pnpm exec vitest run src/lib/games/yappari-chameleon/`                                                                                                                                    | すべて pass                   |
| 型             | `pnpm check`                                                                                                                                                                               | `0 ERRORS 0 WARNINGS`、exit 0 |
| 行数           | `wc -l src/lib/games/yappari-chameleon/{Lobby,Overlay,Settings,Yappari}.svelte`                                                                                                            | どれも 200 未満               |
| 全部           | `pnpm verify`                                                                                                                                                                              | exit 0                        |

## Scope

**In scope**

- `src/lib/games/yappari-chameleon/cpu/crew.ts`（`mixed` と `fillSeat`、外した席を忘れる）
- `src/lib/games/yappari-chameleon/cpu/crew.test.ts`（`table()` に引数を 1 つ足し、テストを足す）
- `src/lib/games/yappari-chameleon/Yappari.svelte`（なかまを呼ぶ親にも CPU のいない `Crew` を作る）
- `src/lib/games/yappari-chameleon/Lobby.svelte` と `Lobby.svelte.test.ts`（「CPU を足す」「CPU を外す」、CPU と遊ぶとの区別）
- `src/lib/games/yappari-chameleon/Overlay.svelte` と `Overlay.svelte.test.ts`（人の試合では CPU がいても「よびなおす」を出す）
- `src/lib/games/yappari-chameleon/Settings.svelte` と `Settings.svelte.test.ts`（ダブルを押せなくする `nodouble`）
- `CLAUDE.md`（やっぱりカメレオンの段落の 1 文）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**（iPad で触ってもらってから決める）

- `src/lib/net/party.svelte.ts` — おえかきのもりとアニマルサバイバーと共用。CPU が切れた席を取らないことは足す側で防ぐ
- `host.ts` / `referee.ts` / `net.ts` — 知らせの形も当たりも変えないので `CHAMELEON_VERSION` は上げない
- `cpu/bot.ts` / `cpu/hider.ts` / `cpu/hunter.ts` — CPU の頭脳は変えない
- 強さを選ぶ画面。足す CPU の強さは、入口の「CPU と遊ぶ」の CPU の設定で最後に選んだ強さ（`readCpu().strength`）を使う
- 呼び名。席 3 の CPU は 1 人でも「CPU 2」と出る（`nameOf` は席の番号から決める）
- 試合の途中に足す・外す。ロビーのあいだだけ
- CPU を 2 人足す（人 1 人と CPU 2 人は今の「CPU と遊ぶ」で遊べる）
- 切れた人がいるあいだに足せない理由の説明。ボタンを押せなくするだけ
- ダブルで CPU を動かすこと

## Git workflow

- ブランチは `advisor/063-chameleon-cpu-fills-empty-seat-spike`
- コミットは英語の命令形 1 文で、Co-Authored-By などの trailer は付けない（例 `Let the host seat one CPU in an empty seat of a linked match`）。ステップごとに分けてよい
- push しない（`main` への push は本番に自動デプロイされる。iPad で触ってもらうための push は持ち主が決める）

## Steps

### Step 1: CPU の席のテストを先に書く（落ちる）

`cpu/crew.test.ts` を次のように変える。

1. `function table()` を `function table(mixed = false)` にし、中の `new Crew(party, host, rand)` を `new Crew(party, host, rand, mixed)` にする。
2. import に `import { PODIUM } from '../mansion/lobby';` を足す。
3. ファイルの最後に次の describe を足す。

```ts
describe('人の試合の空いた席の CPU', () => {
  it('ロビーの台は使い続け、空いた席に CPU を 1 人座らせて外せる。外した席は切れた席にも CPU の名前にも残さない', async () => {
    const t = table(true);
    expect(t.host.podium).toBe(true);
    const [a, b] = pipes();
    Party.guest(b);
    expect(await t.party.add(a)).toBe(2);
    await t.crew.fillSeat('normal');
    expect(t.party.members).toEqual([1, 2, 3]);
    expect(t.party.looks[3]).toBe('cpu');
    await t.crew.fillSeat('normal');
    expect(t.crew.bots).toHaveLength(1);
    await t.crew.fillSeat(null);
    expect(t.party.members).toEqual([1, 2]);
    expect(t.party.away).toEqual([]);
    expect(t.party.looks[3]).toBeUndefined();
  });

  it('切れた人がいるあいだは CPU を足さず、戻った人は元の席に戻る', async () => {
    const t = table(true);
    const [a, b] = pipes();
    Party.guest(b);
    await t.party.add(a);
    b.close();
    await settle();
    expect(t.party.away).toEqual([2]);
    await t.crew.fillSeat('normal');
    expect(t.crew.bots).toHaveLength(0);
    expect(t.party.members).toEqual([1]);
    const [a2, b2] = pipes();
    Party.guest(b2, { was: 2 });
    expect(await t.party.add(a2)).toBe(2);
    await t.crew.fillSeat('normal');
    expect(t.party.members).toEqual([1, 2, 3]);
  });

  it('CPU が座ったあとに人が切れても、戻った人は元の席に戻り、CPU は席を動かない', async () => {
    const t = table(true);
    const [a, b] = pipes();
    Party.guest(b);
    await t.party.add(a);
    await t.crew.fillSeat('normal');
    b.close();
    await settle();
    expect(t.party.away).toEqual([2]);
    const [a2, b2] = pipes();
    Party.guest(b2, { was: 2 });
    expect(await t.party.add(a2)).toBe(2);
    expect(t.party.members).toEqual([1, 2, 3]);
    expect(t.party.looks[3]).toBe('cpu');
  });

  it('試合が始まったあとは足しも外しもしない', async () => {
    const t = table(true);
    await t.crew.fillSeat('normal');
    t.host.start(SET);
    await t.crew.fillSeat(null);
    expect(t.crew.bots).toHaveLength(1);
    expect(t.party.members).toEqual([1, 2]);
  });

  it('ふつうの始め方では台の希望でハンターを決め、隠れる役の CPU が塗って押す', async () => {
    const t = table(true);
    await t.crew.fillSeat('strong');
    t.setPlayer({ pos: [PODIUM.at[0], PODIUM.h, PODIUM.at[2]] });
    t.run(0.2);
    expect(t.host.match.wishes).toEqual([1]);
    t.host.start({ ...SET, mode: 'normal' });
    expect(t.host.match.roles).toEqual({ 1: 'hunter', 2: 'hider' });
    t.setPlayer(t.hunterMe);
    t.run(INTRO + 0.1);
    expect(t.until(() => t.host.match.ready.includes(2), SET.hide)).toBe(true);
    expect(t.of('dabs', 2).length).toBeGreaterThan(0);
  });
});
```

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/cpu/crew.test.ts` → 型のエラー（`fillSeat` が無い・`Crew` の引数が多い）で
FAIL する。足す前からあるテストを消したり変えたりしていない（`git diff` で `table` の 2 行と import と新しい describe だけ）。

### Step 2: `Crew` に人の試合の使い方を足す

`cpu/crew.ts` を次のように変える。

1. import に `type Strength` を足す（`import type { CpuChoice, Strength } from './levels';`）。
2. フィールドに `mixed` を足し、コンストラクタに 4 つめの引数を足す。

```ts
  /** 人のつないだ試合の空いた席に CPU を足す使い方。ハンターは人の試合と同じくロビーの台の希望で決める */
  readonly mixed: boolean;

  constructor(party: Party, host: Host, rand: () => number = Math.random, mixed = false) {
    this.#party = party;
    this.#host = host;
    this.#rand = rand;
    this.mixed = mixed;
    // CPU と遊ぶではハンターを CPU の設定の役で決めるので、ロビーの台はハンター希望に使わない
    if (!mixed) host.podium = false;
  }
```

3. `#seat` の引数の型を `{ count: number; strength: Strength }` にする（`CpuChoice` はそのまま渡せる）。減らすループで、閉じた席を忘れる。

```ts
while (this.bots.length > c.count) {
  const bot = this.bots.pop()!;
  const seat = bot.party.me;
  bot.close();
  await bot.gone;
  this.#forget(seat);
}
```

4. `#seat` の下に足す。

```ts
  /**
   * 閉じた CPU の席を、切れた席（呼び直しの番号）と CPU の名前から外す。残すと「よびなおす」に CPU の席が出て、
   * 次にその席に来た人も CPU と呼ばれる
   */
  #forget(seat: Seat) {
    const p = this.#party;
    if (seat === 1) return;
    p.away = p.away.filter((s) => s !== seat);
    const looks = { ...p.looks };
    delete looks[seat];
    p.looks = looks;
  }

  /**
   * 人の試合の空いた席に CPU を 1 人座らせる（strength）か外す（null）。ロビーのあいだだけ。
   * Party は番号を持たない子を切れた人の席へ先に座らせるので、切れた人がいるあいだは足さない（戻る人の席を取らない）
   */
  fillSeat(strength: Strength | null): Promise<void> {
    return this.#next(async () => {
      const p = this.#party;
      if (this.#host.match.phase !== 'lobby') return;
      if (strength && (p.away.length > 0 || p.members.length >= 3)) return;
      await this.#seat({ count: strength ? 1 : 0, strength: strength ?? 'normal' });
    });
  }
```

`Seat` の型は `import type { Party, Seat } from '$lib/net/party.svelte';` ですでに読んでいる。

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/cpu/crew.test.ts` → すべて pass（足した 5 つと、
「CPU と遊ぶでは、ロビーの台をハンター希望に使わない」「人数を 2 → 1 → 2 と変えても、…」を含む）。

### Step 3: なかまを呼ぶ親にも、CPU のいない `Crew` を作る

`Yappari.svelte` の `cpu()` の上に足し、`<Entry ... onhost={hosting} ... />` を `onhost={hostParty}` にする。

```ts
/** なかまを呼ぶ親。CPU の目は 3D ができたときに Crew へ渡るので、空いた席に CPU を足せるよう先に作っておく */
function hostParty(p: Party) {
  const stop = hosting(p);
  crew = new Crew(p, host!, Math.random, true);
  return stop;
}
```

`hosting` の戻り値（迎えそこねたときの片付け）は `unhost()` を呼び、`unhost()` は `crew?.stop()` と `crew = null` をするので、片付けは足さない。

**Verify**: `pnpm check` → `0 ERRORS 0 WARNINGS`。`wc -l src/lib/games/yappari-chameleon/Yappari.svelte` → 200 未満。

### Step 4: ロビーのボタンと、CPU と遊ぶとの区別

1. `Lobby.svelte.test.ts` に足す（`showCpu` の上あたりに新しい関数とテスト）。

```ts
function showMixed(members = [1, 2], looks: Record<number, string> = {}, away: number[] = []) {
  const fillSeat = vi.fn();
  const start = vi.fn();
  const match = new Match(() => 1);
  const session = {
    party: { host: true, members, looks, away },
    match,
    start,
    allow: vi.fn(),
    dress: vi.fn()
  } as unknown as Session;
  const target = document.body.appendChild(document.createElement('div'));
  const crew = { mixed: true, fillSeat, play: vi.fn() } as unknown as Crew;
  const app = mount(Lobby, { target, props: { session, crew, oninvite: vi.fn() } });
  flushSync();
  const button = (text: string) =>
    [...target.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) as HTMLButtonElement | undefined;
  return { target, fillSeat, start, button, done: () => unmount(app) };
}

it('人の試合では、なかまを呼ぶと並べて「CPU を足す」を出し、最後に選んだ強さで足す', () => {
  localStorage.setItem(CPU_KEY, JSON.stringify({ strength: 'strong' }));
  const { button, fillSeat, done } = showMixed();
  expect(button('なかまを呼ぶ')).toBeDefined();
  expect(button('CPU の設定')).toBeUndefined();
  button('CPU を足す')!.click();
  expect(fillSeat).toHaveBeenCalledWith('strong');
  done();
});

it('CPU が座っていれば「CPU を外す」、切れた人がいるあいだは「CPU を足す」を押せない', () => {
  const seated = showMixed([1, 2, 3], { 3: 'cpu' });
  seated.button('CPU を外す')!.click();
  expect(seated.fillSeat).toHaveBeenCalledWith(null);
  expect(seated.button('CPU を足す')).toBeUndefined();
  seated.done();
  const away = showMixed([1], {}, [2]);
  expect(away.button('CPU を足す')!.disabled).toBe(true);
  away.done();
});

it('人の試合は CPU が座っていても session.start で始め、保存がダブルなら増え鬼で始める', () => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...DEFAULTS, mode: 'double' }));
  const { button, start, done } = showMixed([1, 2, 3], { 3: 'cpu' });
  button('マップの設定')!.click();
  flushSync();
  expect(button('ダブル')!.disabled).toBe(true);
  button('ゲームを始める')!.click();
  expect(start).toHaveBeenCalledWith(expect.objectContaining({ mode: 'infect' }));
  done();
});
```

2. `Lobby.svelte` を次のように変える。

- スクリプトに足す。

```ts
// crew が人の試合の空いた席の CPU（mixed）なら、ロビーの台・なかまを呼ぶ・マップの設定は人の試合のまま使う
const solo = $derived(!!crew && !crew.mixed);
const cpuSeat = $derived(crew?.mixed ? party.members.find((s) => party.looks[s] === 'cpu') : undefined);
```

- `players` と許可の `$effect` と `begin()` と `<Settings>` の `crew` の読みを `solo` に替える。`begin()` は次の形にする。

```ts
function begin() {
  if (solo) void crew!.play($state.snapshot(choice), $state.snapshot(settings));
  // CPU はダブルの残した体を探せないので、CPU が座っているあいだは増え鬼で始める
  else if (cpuSeat && settings.mode === 'double') session.start({ ...settings, mode: 'infect' });
  else session.start(settings);
}
```

`crew!` が lint（`@typescript-eslint/no-non-null-assertion`）で落ちたら、`if (solo && crew) void crew.play(...)` にする。

- 親のボタン（59-65 行）を次の形にする。

```svelte
  {#if party.host}
    <button onclick={() => (open = true)}>マップの設定</button>
    {#if solo}
      <button onclick={() => (picking = true)}>CPU の設定</button>
    {:else}
      {#if party.members.length < 3}<button onclick={oninvite}>なかまを呼ぶ</button>{/if}
      {#if cpuSeat}
        <button onclick={() => void crew?.fillSeat(null)}>CPU を外す</button>
      {:else if crew?.mixed && party.members.length < 3}
        <!-- 切れた人がいるあいだに足すと、戻る人の席を CPU が取る -->
        <button disabled={party.away.length > 0} onclick={() => void crew?.fillSeat(choice.strength)}>CPU を足す</button>
      {/if}
    {/if}
  {:else}
```

- `<Settings ... cpu={solo} nodouble={!!cpuSeat} ... />` にする（`nodouble` は Step 5 で足す）。

`party.looks` と `party.away` は人の試合の親でだけ読むので、今のテストの偽物（`{ host, members }` だけ）では読まれない。

**Verify**: Step 5 のあとでまとめて見る（`Settings` の `nodouble` がまだ無いので、ここでは `pnpm check` が落ちてよい）。

### Step 5: マップの設定でダブルを押せなくする

1. `Settings.svelte` の props に `nodouble = false` を足す（型は `nodouble?: boolean`）。ダブルのボタン（32 行）に `disabled={nodouble}` を足す。
2. `Settings.svelte.test.ts` に足す。

```ts
it('CPU が座っているあいだは、ダブルを押せない', () => {
  const settings = $state<S>({ ...DEFAULTS });
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Settings, {
    target,
    props: { settings, players: 3, nodouble: true, onstart: vi.fn(), onclose: vi.fn() }
  });
  flushSync();
  const double = [...target.querySelectorAll('button')].find((b) => b.textContent === 'ダブル')!;
  expect(double.disabled).toBe(true);
  unmount(app);
});
```

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/Lobby.svelte.test.ts src/lib/games/yappari-chameleon/Settings.svelte.test.ts` → すべて pass
（足した 4 つと、今の「CPU と遊ぶ」のテストを含む）。`pnpm check` → `0 ERRORS 0 WARNINGS`。

### Step 6: 人の試合では、CPU がいても「よびなおす」を出す

1. `Overlay.svelte` の 92-95 行を次の形にする。

```svelte
<!-- CPU と遊ぶ（1 台）は QR で人を迎えないので、呼び直しを出さない -->
{#if session.party.host && !(crew && !crew.mixed)}
```

2. `Overlay.svelte.test.ts` の「CPU と遊ぶでは「よびなおす」を出さず、ロビーに CPU の設定を出す」のあとに足す（同じ `show` を使う）。

```ts
it('人の試合の空いた席に CPU がいても、親には「よびなおす」を出す', () => {
  const party = { host: true, members: [1, 3], away: [2], looks: { 3: 'cpu' } };
  const mixed = show(
    'hider',
    { phase: 'lobby' },
    1,
    { party },
    { crew: { mixed: true, play: vi.fn(), fillSeat: vi.fn() } }
  );
  expect(mixed.labels()).toContain('よびなおす');
  expect(mixed.labels()).not.toContain('CPU の設定');
  mixed.done();
});
```

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/Overlay.svelte.test.ts` → すべて pass。
`wc -l src/lib/games/yappari-chameleon/{Lobby,Overlay,Settings,Yappari}.svelte` → どれも 200 未満。

### Step 7: CLAUDE.md の 1 文を直す

`grep -n "CPU と遊ぶでは「なかまを呼ぶ」と「よびなおす」を出さない。" CLAUDE.md` で 1 行出ることを見てから、その文の直後に次の文を足す。

```text
なかまを呼ぶ親は、ロビーのあいだ空いた席に CPU を 1 人足せる（上の帯の「CPU を足す」「CPU を外す」、`cpu/crew.ts` の `Crew` を `mixed` で作り `fillSeat` で座らせる。強さは CPU の設定で最後に選んだもの）。役は人の試合と同じく台の希望で決め、CPU が座っているあいだはダブルを選べない（保存がダブルなら増え鬼で始める）。Party は番号を持たない子を切れた人の席へ先に座らせるので、切れた人がいるあいだは足せず、外した CPU の席は `away` と `looks` から消す。
```

grep で行が出なければ STOP（CLAUDE.md の文が変わっている）。

**Verify**: `grep -c "fillSeat" CLAUDE.md` → 1。

### Step 8: 全体の確かめ

**Verify**: `pnpm verify` → exit 0。

### Step 9: iPad で触ってもらう（ここで止まる）

ここから先は持ち主が iPad で触る。実装はここで止め、次のことを報告に書く。

- できたこと（親のロビーの「CPU を足す」「CPU を外す」、役は台の希望、ダブルは選べない）と、足したテストの数
- iPad 2 台で見てほしいこと
  1. 2 台をつないで、親がロビーで「CPU を足す」を押すと、子の画面にも CPU の人形が出て、上の帯に「CPU 2」が並ぶ
  2. 親が台に乗って「通常」で始めると、子と CPU が隠れ、CPU が隠れ場所で塗る（隠れる人が 2 人になり、1 発目で終わらない）
  3. 台に誰も乗らずに始めると、CPU がハンターになることがある。そのとき CPU が人 2 人を探して撃つ
  4. 試合のあとロビーに戻っても CPU が残り、「CPU を外す」で消える
  5. 子の Wi-Fi を切ってから戻すと、子は元の席に戻る（CPU が席を取らない）。切れているあいだは「CPU を足す」が押せない
  6. 親の iPad の重さ（CPU の目の絵を描く分、親だけ重くなる）
- 作り込みの候補（触ってもらってから選ぶ）は、足す CPU の強さを選ぶ、呼び名を「CPU」だけにする、
  切れた人がいるとき押せない理由を出す、ダブルでも CPU を動かす、CPU を台に乗せて希望させる、の 5 つ

**Verify**: 報告に上の 6 つの見てほしいことと、`pnpm verify` が exit 0 だったことを書いた。

## Test plan

- `cpu/crew.test.ts` に 5 つ。足して外す（台は使い続け、外した席を忘れる）・切れた人がいれば足さない・CPU がいても人は元の席へ・試合中は変えない・
  台の希望でハンターを決め隠れる CPU が塗って押す
- `Lobby.svelte.test.ts` に 3 つ、`Settings.svelte.test.ts` に 1 つ、`Overlay.svelte.test.ts` に 1 つ
- 「CPU と遊ぶ」の今のテスト（`cpu/crew.test.ts` の全部、`Lobby.svelte.test.ts` の `showCpu` のテスト、`Overlay.svelte.test.ts` の
  「CPU と遊ぶでは「よびなおす」を出さず…」）が変えずに pass すること
- 型にするテストは `cpu/crew.test.ts` の「探す（CPU の隠れる人 1 人・通常）は、CPU が塗って押し、…」
- `pnpm exec vitest run src/lib/games/yappari-chameleon/` → すべて pass

## Done criteria

- [ ] `pnpm exec vitest run src/lib/games/yappari-chameleon/` が pass し、上の新しいテスト 10 個を含む
- [ ] `grep -n "fillSeat" src/lib/games/yappari-chameleon/cpu/crew.ts` が出る
- [ ] `git diff 36cc037 --stat -- src/lib/net/ src/lib/games/yappari-chameleon/host.ts src/lib/games/yappari-chameleon/referee.ts src/lib/games/yappari-chameleon/net.ts src/lib/games/yappari-chameleon/cpu/bot.ts` が何も出さない
- [ ] `wc -l` で `Lobby.svelte`・`Overlay.svelte`・`Settings.svelte`・`Yappari.svelte` がどれも 200 未満
- [ ] `grep -c "fillSeat" CLAUDE.md` が 1
- [ ] `pnpm verify` が exit 0
- [ ] `git status` で in scope 以外のファイルが変わっていない
- [ ] 報告に Step 9 の iPad で見てほしいことを書いた
- [ ] `plans/README.md` の 063 の行を更新し、`pnpm exec prettier --write plans/README.md` を通した

## STOP 条件

- `cpu/crew.ts` の `constructor` / `#seat`、`Party.#seat` の座らせる順（`back ?? this.away.find(free) ?? ...`）、`Yappari.svelte` の `hosting` / `cpu`、
  `Lobby.svelte` の `players` / `begin` / ボタン、`Overlay.svelte` の `Invite` の条件が上の抜粋と違う
- `await bot.gone` のあとで `party.away` にまだ CPU の席が入っていない（`#drop` より先に `gone` が解けている。`#forget` が先に走り、あとから `away` に戻る）
- Step 1 の「ふつうの始め方では…」で、CPU が隠れタイムのうちに塗りを送らない（`t.of('dabs', 2)` が空）。目（`fake`）が CPU に渡っていない読み違い
- 直すのに `party.svelte.ts`・`host.ts`・`referee.ts`・`cpu/bot.ts` を変えたくなった
- 今の「CPU と遊ぶ」のテストが落ち、`mixed` の無い偽物の crew を CPU と遊ぶとして扱えていない
- どれかの `.svelte` が 200 行以上になる

## Maintenance notes

- `Party.#seat` を「番号の無い子は新しい席から先に座らせる」形に変えれば、`fillSeat` の切れた人の確かめは要らなくなる。`Party` はおえかきのもりと
  アニマルサバイバーと共用なので、変えるならその 2 本の「よびなおす」のテストも見る
- CPU が台に乗らないのは、ロビーの席の場所（`LOBBY_SPAWNS`）が台から離れているから。席の場所を動かすときは、CPU が台の上に立たないことを確かめる
- 逆算チキンレース（別の計画）が入ったら、CPU が座っているあいだは逆算チキンレースも選べなくする（CPU は番の回り方を知らない）
- なかまを呼ぶ親はいつも `Crew` を持つので、`Online.svelte` がロビーに入るときに CPU の目の shader を作る（`senses.warm()`、1 秒ほど止まる）。
  CPU を足さない試合でも止まるので、iPad で気になると言われたら、`fillSeat` で初めて CPU を座らせるときに warm するよう移す
- 押した瞬間に人が切れると、`fillSeat` の確かめのあとで `away` が増えることがある。試作では起きにくいとして扱わない
