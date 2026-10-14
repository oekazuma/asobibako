# Plan 065: カメレオンに本家の「逆算チキンレース」の試作を入れる（番に隠れ、姿を見せてから探す。iPad で触ってもらうまで）

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。これは試作の計画で、最後のステップ
> 「iPad で触ってもらう」で止まる。見た目や点の付け方の作り込みはしない。終わったら `plans/README.md` の自分の行の
> Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Depends on 064**: 先に `plans/064-chameleon-ammo-limit.md`（弾数制限）が入っていること。
> `grep -n "misses" src/lib/games/yappari-chameleon/referee.ts` が何も出さなければ STOP（064 が入っていない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 36cc037..HEAD -- src/lib/games/yappari-chameleon/referee.ts src/lib/games/yappari-chameleon/referee.test.ts src/lib/games/yappari-chameleon/host.ts src/lib/games/yappari-chameleon/host.test.ts src/lib/games/yappari-chameleon/net.ts src/lib/games/yappari-chameleon/session.svelte.ts src/lib/games/yappari-chameleon/session.svelte.test.ts src/lib/games/yappari-chameleon/match.svelte.ts src/lib/games/yappari-chameleon/match.svelte.test.ts src/lib/games/yappari-chameleon/Intro.svelte src/lib/games/yappari-chameleon/Ranking.svelte src/lib/games/yappari-chameleon/Overlay.svelte src/lib/games/yappari-chameleon/Overlay.svelte.test.ts src/lib/games/yappari-chameleon/Settings.svelte src/lib/games/yappari-chameleon/Settings.svelte.test.ts src/lib/games/yappari-chameleon/prefs.test.ts`
> 064 の変更（`ammo`・`misses`・`missed`・版 5 など）は出てよい。それ以外の変更が出たら「Current state」の抜粋と今のコードを見比べ、
> 食い違えば STOP。行番号は 36cc037 のもので、064 のあとは少しずれている。記号の名前で探す。CLAUDE.md は drift check に入れていない（Step 9 で grep する）。

## Status

| 項目       | 値                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| Priority   | P3                                                                                                      |
| Effort     | L                                                                                                       |
| Risk       | MED（新しいモードで、試合の流れ（答え合わせから次の番へ）と知らせの形が変わる。ほかのモードは変えない） |
| Depends on | plans/064-chameleon-ammo-limit.md                                                                       |
| Category   | direction（試作）                                                                                       |
| Planned at | commit `36cc037`, 2026-10-14                                                                            |

## Why this matters

やっぱりカメレオンは 2〜3 人がそれぞれの iPad で遊ぶかくれんぼ。本家の仕様書は、2〜3 人だと増え鬼やダブルはすぐ終わるので
「交代で隠れ・探す（ラウンド制）」などの点の付け方の調整が要る、と書いている
（`docs/superpowers/specs/2026-10-08-yappari-chameleon-original.md:256`）。

本家の「逆算チキンレース」（v2.4.0）はまさにその形で、1 人ずつ番が回り、隠れる人の塗った見た目とポーズを先に全員に見せてから探し、
早く見つけるほど点が高く、隠れる人は見落としポイントで稼ぎ、合計点で勝つ（同 195 行）。設計書は 3 段めにこのモードを挙げている
（`docs/superpowers/specs/2026-10-08-yappari-chameleon-design.md:151` の表の「3 段めで逆算チキンレース」）。

持ち主の方針は「手ざわりで面白さが決まるものは、最小の試作を iPad で触ってもらってから作り込む」。この計画は親の審判と画面に最小の形を入れ、
iPad で触ってもらう所で止める。

## Current state

### 本家の仕様（`docs/superpowers/specs/2026-10-08-yappari-chameleon-original.md:195`）

> 逆算チキンレース（v2.4.0）: 1 人ずつ番が回る個人戦。隠れる人の塗った見た目とポーズを先に全員に見せてから探し始める。ハンターは見た目から場所を逆算して、早く見つけるほど点が高い（見つけた人の点 1000 → 500 に v2.4.1 で下げた）。隠れる人は見落としポイントで稼ぐ。探す時間は 1 分ほど。合計点がいちばん多い人の勝ち

「1000 → 500」は版の変更（見つけた人の点を 1000 から 500 に下げた）で、時間でどう減るかは書かれていない。この試作では
**見つけた人の点 = 切り上げ(500 × 見つけた瞬間の残り秒 ÷ 60)**（探索の始めに見つければ 500、終わり際は 1 に近い）を仮に使い、
iPad で遊んでから決める。500 は本家の値、時間での減り方は仮。隠れる人の点は、その番の全ハンターの見落としポイントの合計（切り捨て）。
探す時間は 60 秒（`LIMITS.search` の下限と同じ）に固定する。紹介の説明 2 行と「この姿を探せ」の字は本家の字が仕様書に無いので仮。

### 試合のルール（`src/lib/games/yappari-chameleon/referee.ts`）

DOM と three を使わない純粋なルール。モードは `referee.ts:5` の `export type GameMode = 'normal' | 'infect' | 'double';`、
勝者は `:9` の `export type Winner = 'chameleon' | 'hunter' | 'double';`（`double` は勝った人を `champ` で持つ）。

`fit`（`:55-66`）はモードを `s.mode === 'normal' || s.mode === 'double' ? s.mode : 'infect'` で読む。

`start`（`:165-205`）は役を決めて `Object.assign(m, { phase: 'intro', ... })` する。ダブルなら最初のハンターはいない。

```ts
const double = s.mode === 'double';
const chosen = (hunters ?? []).filter((seat) => members.includes(seat)).sort((a, b) => a - b);
const fixed = chosen.length > 0 && chosen.length < members.length;
// ダブルは全員が隠れてから全員で探すので、最初のハンターはいない
const picked = double ? [] : fixed ? chosen : pickHunters(m.wishes, members, s.hunters, rand);
```

フェーズの切り替え `enter`（`:207-241`）と次のフェーズの表 `NEXT`（`:257`）。

```ts
const NEXT: Record<Phase, Phase> = { lobby: 'lobby', intro: 'hide', hide: 'search', search: 'reveal', reveal: 'lobby' };
```

`enter` の `search` は `m.left = m.settings.search;`、`reveal` は勝者を決める（`:215-221`）。

```ts
  } else if (phase === 'reveal') {
    m.left = m.settings.reveal;
    m.buried = {};
    if (m.settings.mode === 'double') {
      m.winner = 'double';
      m.champ ??= leader(m);
    } else m.winner ??= hiding(m).length ? 'chameleon' : 'hunter';
```

`intro` へは今は `start` の `Object.assign` だけで入り、`enter(m, 'intro')` は呼ばれない。この計画では、答え合わせから次の番へ進むときだけ
`enter(m, 'intro')` を使う。

時計の `tick`（`:260-276`）の最後は `if (m.left === 0) enter(m, NEXT[m.phase]);`、もうええよの `settle`（`:285-288`）は
`enter(m, NEXT[m.phase])`。発見 `hit(m, seat)`（`:324-333`）は撃った人を知らない。`leave`（`:295-310`）は切れた人を扱う。
`view`（`:429-466`）が各端末へ配る形 `View`（`:397-427`）を作る。

新しいフェーズは足さない。足すとフェーズで分かれる所（`Intro.svelte`・`Overlay.svelte`・`match.svelte.ts` の `word`・`bgm.ts`・`host.ts` の `#watch`・
`session.svelte.ts` の `#place` / `#fit`・`referee.ts` の `ready` / `settle` / `leave` / `bury`）を全部直すことになる。
姿を見せるのは「隠れタイムの最後の 5 秒」とする（ハンターはそのあいだ控室にいて、銃を持っていない）。

### 姿を見せる仕組み（ダブルの「残した体」を使い回す）

親（`host.ts`）は、ダブルの探索に入るとき、隠れた人の体と塗りを `#left` に控え、`left` の知らせで全員へ配る（`host.ts:330-337`）。

```ts
// 持ち主は探索の様子を受けると塗りを白に戻すので、残した体はその前に写させる
if (phase === 'search' && m.settings.mode === 'double')
  for (const seat of m.hid) {
    const body = this.#lines.get(seat)?.last();
    if (!body) continue;
    this.#left.set(seat, { body, log: [...(this.#logs.get(seat) ?? [])] });
    this.#port.tell('all', { t: 'left', seat, body });
  }
```

戻った子へは `welcome`（`host.ts:187-202`）が `left` と `leftDabs` で送り直す。`#entered`（`host.ts:322-343`）は `intro` に入るたびに
`#logs`・`#found`・`#left` を空にし、答え合わせに入るとき隠れた場所を `m.spots` に入れる（`:338-342`）。

```ts
if (phase === 'reveal')
  for (const seat of m.hid) {
    const at = this.#left.get(seat)?.body ?? this.#found.get(seat) ?? this.#lines.get(seat)?.last();
    if (at) m.spots[seat] = at.pos;
  }
```

逆算チキンレースでは `#left` に「見せた瞬間の体」が入るので、答え合わせの場所には使わない（ダブルのときだけ使う）。
`#hidden()`・`#leftTargets` はダブルのときだけ `#left` を読むので、そのままでよい。

各端末（`session.svelte.ts`）は `left` を `#onLeft`（`:376-380`）で受け、その人の今の塗りを写した 2 つめの体（`#pins`）と体（`#lefts`）を持つ。
毎フレーム `frame` の中で置く（`:450-457`）。

```ts
for (const [seat, body] of this.#lefts)
  this.#pins.get(seat)?.update(dt, now, {
    pin: body,
    visible: !this.#caught(seat),
    armed: false,
    shine: this.#leftShine(seat),
    scale: this.#pinScale(seat)
  });
```

`#reset`（`:198-212`）が紹介とロビーに入るたびに `#pins` と `#lefts` を空にする。戻った子には `left` が試合の様子より先に届くので、
「逆算チキンレースなら控室に立たせる」の判断は `#onLeft` ではなく、この `frame` の中でする。

控室は `mansion/layout.ts:263` の `ROOM = { min: [-2, 0, -32], max: [2, 3, -28] }`、ハンターの始める場所は `:281` の
`room: { 1: [0, 0, -30.8], 2: [-0.9, 0, -29.3], 3: [0.9, 0, -29.3] }` で、どれも北（+z）を向く。体の向き `yaw` は
`move.ts:315` の `b.yaw = Math.atan2(-wall.nx, -wall.nz)` のとおり `atan2(x, z)` の向きなので、`Math.PI` で −z（控室のハンターのほう）を向く。

### 画面

- `match.svelte.ts:5-14` の `MODES` はモードごとの名前・説明 2 行・色。`Intro.svelte:5` と `Hud.svelte:10` が `MODES[match.view.settings.mode]` で引くので、
  モードを足したら必ず足す
- `match.svelte.ts:23-27` の `winnerText` は `winner === 'double'` なら `champ` の名前で「勝者 プレイヤーN!」を出す。最後の番の決着はこれを使う
- `match.svelte.ts:114-122` の `ranking` はダブルの順位表、`Ranking.svelte`（43 行）がそれを `{r.got}/{r.need}` で出す
- `Overlay.svelte:82` は `{#if match.double && (phase === 'search' || phase === 'reveal')}<Ranking {match} />{/if}`
- `Intro.svelte`（90 行）は紹介の黒い帯と、隠れタイムの始めの「隠れタイム」
- `Settings.svelte`（064 のあと 172 行前後）のゲームモードのボタンは 30-32 行、ハンターの人数の行はダブルで薄くして押せない（36-49 行）

### 知らせの版（`net.ts`）

064 で `CHAMELEON_VERSION` は 5 になっている。`View` に項目を足すので 6 に上げる。

### CPU

CPU と遊ぶでは、マップの設定にゲームモードの行が出ず（`Settings.svelte` の `cpu`）、`cpu/crew.ts` の `cpuSettings` がモードを通常か増え鬼に決め直すので、
逆算チキンレースは選べない。この試作では CPU を扱わない。

### 規約

- コメントは「コードから復元できない WHY」だけを日本語で書く（変更履歴やタスク番号は書かない）
- `.svelte` は 200 行未満（svelte-vitals の `architecture/component-size`）
- テストの名前は日本語の文にする。画面の言葉は本家に合わせ、大人向けの漢字まじりにする

## Commands you will need

| Purpose        | Command                                                                                                                                                                                                                                                                                         | Expected on success           |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 審判           | `pnpm exec vitest run src/lib/games/yappari-chameleon/referee.test.ts`                                                                                                                                                                                                                          | すべて pass                   |
| 親             | `pnpm exec vitest run src/lib/games/yappari-chameleon/host.test.ts`                                                                                                                                                                                                                             | すべて pass                   |
| 端末と画面     | `pnpm exec vitest run src/lib/games/yappari-chameleon/session.svelte.test.ts src/lib/games/yappari-chameleon/match.svelte.test.ts src/lib/games/yappari-chameleon/Overlay.svelte.test.ts src/lib/games/yappari-chameleon/Settings.svelte.test.ts src/lib/games/yappari-chameleon/prefs.test.ts` | すべて pass                   |
| カメレオン全部 | `pnpm exec vitest run src/lib/games/yappari-chameleon/`                                                                                                                                                                                                                                         | すべて pass                   |
| 型             | `pnpm check`                                                                                                                                                                                                                                                                                    | `0 ERRORS 0 WARNINGS`、exit 0 |
| 行数           | `wc -l src/lib/games/yappari-chameleon/{Intro,Ranking,Overlay,Settings}.svelte`                                                                                                                                                                                                                 | どれも 200 未満               |
| 全部           | `pnpm verify`                                                                                                                                                                                                                                                                                   | exit 0                        |

## Scope

**In scope**

- `src/lib/games/yappari-chameleon/referee.ts` と `referee.test.ts`（モード・番・点・次の番へ・見せる 5 秒）
- `src/lib/games/yappari-chameleon/host.ts` と `host.test.ts`（姿を配る・発見の点・答え合わせの場所・版のテスト）
- `src/lib/games/yappari-chameleon/net.ts`（`CHAMELEON_VERSION` を 6 に）
- `src/lib/games/yappari-chameleon/session.svelte.ts` と `session.svelte.test.ts`（控室に姿を立たせる）
- `src/lib/games/yappari-chameleon/match.svelte.ts` と `match.svelte.test.ts`（`MODES`・`race`・`previewing`・順位）
- `src/lib/games/yappari-chameleon/Intro.svelte`（番の表示と「この姿を探せ」）
- `src/lib/games/yappari-chameleon/Ranking.svelte`（点の表示）
- `src/lib/games/yappari-chameleon/Overlay.svelte` と `Overlay.svelte.test.ts`（順位表を出す条件）
- `src/lib/games/yappari-chameleon/Settings.svelte` と `Settings.svelte.test.ts`（モードのボタン）
- `src/lib/games/yappari-chameleon/prefs.test.ts`（覚えるテストだけ。`prefs.ts` は `fit` を通すので変えない）
- `CLAUDE.md`（やっぱりカメレオンの段落に 1 文足し、モードの並びを直す）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**（iPad で触ってもらってから決める）

- 新しいフェーズを足すこと（姿は隠れタイムの最後の 5 秒で見せる）
- CPU（`cpu/` のすべて、`CpuSetup.svelte`）。CPU と遊ぶでは選べないまま
- 抜けて戻った人を番に戻すこと（抜けた人の番は飛ばし、戻ると観戦）
- 点の付け方の作り込み（見つけた人の時間の減り方・隠れる人の点の重み・同点の扱い）
- 探索時間の行を逆算チキンレースで薄くすること（設定に関係なく 60 秒）
- 弾数制限との組み合わせの調整（そのまま効く）
- 番の結果を出す専用の画面や演出、BGM の変更
- `bgm.ts` / `Hud.svelte` / `mansion/` / `prefs.ts`

## Git workflow

- ブランチは `advisor/065-chameleon-countdown-race-prototype`
- コミットは英語の命令形 1 文で、Co-Authored-By などの trailer は付けない（例 `Add a countdown race prototype mode to the chameleon match`）。ステップごとに分けてよい
- push しない（`main` への push は本番に自動デプロイされる。iPad で触ってもらうための push は持ち主が決める）

## Steps

### Step 1: 審判のテストを先に書く（落ちる）

`referee.test.ts` の import に `PREVIEW` と `RACE_SEARCH` を足し（`overlooked`・`ready`・`leave`・`hit` はもう読んでいる）、最後に次の describe を足す。
`begun(settings, wishes)` は `start(m, [1, 2, 3], ...)` で始め、`run(m, secs)` は 0.1 秒ずつ進める。

```ts
describe('逆算チキンレース', () => {
  it('1 人ずつ番に隠れ、ほかの全員が探す。台の希望は使わず、探索は 60 秒', () => {
    const m = begun({ mode: 'race' }, [3]);
    expect(fit({ ...DEFAULTS, mode: 'race' }, 3).mode).toBe('race');
    expect(m.roles).toEqual({ 1: 'hider', 2: 'hunter', 3: 'hunter' });
    expect(m.order).toEqual([1, 2, 3]);
    expect(m.turn).toBe(0);
    run(m, 3 + 60);
    expect(m.phase).toBe('search');
    expect(m.left).toBeCloseTo(RACE_SEARCH, 0);
  });

  it('見つけた人には残り時間に応じた点を足す（探索の始めは 500、半分たてば 250 ほど）', () => {
    const a = begun({ mode: 'race' });
    run(a, 3 + 60);
    hit(a, 1, 2);
    expect(a.scores[2]).toBeGreaterThanOrEqual(499);
    const b = begun({ mode: 'race' });
    run(b, 3 + 60 + 30);
    hit(b, 1, 3);
    expect(b.scores[3]).toBeCloseTo(250, -1);
  });

  it('隠れた人には、答え合わせで見落としポイントの合計を切り捨てて足す', () => {
    const m = begun({ mode: 'race' });
    run(m, 3 + 60);
    overlooked(m, 2, 1, 12.7);
    overlooked(m, 3, 1, 3.6);
    run(m, RACE_SEARCH + 0.1);
    expect(m.phase).toBe('reveal');
    expect(m.scores[1]).toBe(16);
  });

  it('答え合わせのあと次の番の紹介へ進み、最後の番のあとはロビーへ。最後の答え合わせは合計点のいちばん多い人の勝ち', () => {
    const m = begun({ mode: 'race', reveal: 10 });
    run(m, 3 + 60);
    hit(m, 1, 2);
    expect(m.winner).toBe('hunter');
    run(m, 10.1);
    expect(m.phase).toBe('intro');
    expect(m.turn).toBe(1);
    expect(m.roles).toEqual({ 1: 'hunter', 2: 'hider', 3: 'hunter' });
    expect(m.found).toEqual([]);
    run(m, 3 + 60 + 30);
    hit(m, 2, 3);
    run(m, 10.1);
    expect(m.roles).toEqual({ 1: 'hunter', 2: 'hunter', 3: 'hider' });
    run(m, 3 + 60 + 45);
    hit(m, 3, 1);
    expect(m.phase).toBe('reveal');
    expect(m.winner).toBe('double');
    expect(m.champ).toBe(2);
    run(m, 10.1);
    expect(m.phase).toBe('lobby');
  });

  it('隠れタイムを全員で飛ばしても、隠れた姿を見せる 5 秒は残す', () => {
    const m = begun({ mode: 'race' });
    run(m, 3 + 1);
    for (const s of ALL) ready(m, s, ALL);
    expect(m.phase).toBe('hide');
    expect(m.left).toBe(PREVIEW);
    run(m, PREVIEW + 0.1);
    expect(m.phase).toBe('search');
  });

  it('抜けた人の番は飛ばす。今の番の人が抜けたら、次の番は次の人で、抜けた人は観戦', () => {
    const m = begun({ mode: 'race', reveal: 10 });
    run(m, 3 + 1);
    leave(m, 1, [2, 3]);
    expect(m.order).toEqual([2, 3]);
    expect(m.phase).toBe('hide');
    run(m, 59 + RACE_SEARCH + 10 + 0.1);
    expect(m.phase).toBe('intro');
    expect(m.roles).toEqual({ 1: 'out', 2: 'hider', 3: 'hunter' });
  });

  it('ほかのモードの hit は撃った人を渡しても点を付けない', () => {
    const m = begun({ mode: 'normal' });
    run(m, 3 + 60);
    hit(m, 1, 3);
    expect(m.scores).toEqual({});
  });
});
```

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/referee.test.ts` → `PREVIEW` / `RACE_SEARCH` が無いことや型のエラーで FAIL する
（ファイル全体が落ちてよい）。足す前からあるテストは変えていない。

### Step 2: 審判に逆算チキンレースを入れる

`referee.ts` を次のように変える。

1. 型と定数。

```ts
export type GameMode = 'normal' | 'infect' | 'double' | 'race';
/** double はダブルと逆算チキンレースの最後の番の決着。勝った人は Match.champ（null なら勝者なし） */
export type Winner = 'chameleon' | 'hunter' | 'double';
```

`SHATTER_SECS` の下に足す。

```ts
/** 逆算チキンレースの探す時間（秒）。本家は 1 分ほど */
export const RACE_SEARCH = 60;
/** 逆算チキンレースで見つけた人の点の上限。本家 v2.4.1 の値。残り時間で減らすのは仮 */
export const RACE_FIND = 500;
/** 逆算チキンレースで、隠れタイムの終わりに隠れた姿をハンターに見せる秒 */
export const PREVIEW = 5;
```

2. `fit` のモードを `mode: s.mode === 'normal' || s.mode === 'double' || s.mode === 'race' ? s.mode : 'infect',` にする。
3. `Match` に足し、`newMatch` に `order: [], turn: 0, scores: {}` を足す。

```ts
  /** 逆算チキンレースで隠れる番の順。抜けた人は外す */
  order: Seat[];
  /** 逆算チキンレースの今の番（order の番号） */
  turn: number;
  /** 逆算チキンレースの合計点 */
  scores: Partial<Record<Seat, number>>;
```

4. `start` で、逆算チキンレースは席の順の最初の人が隠れ、ほかの全員が探す。`picked` を次の形にし、`Object.assign` に
   `order: race ? [...members] : [], turn: 0, scores: {}` を足す（`const race = s.mode === 'race';` を `double` の下に置く）。

```ts
const picked = double ? [] : race ? members.slice(1) : fixed ? chosen : pickHunters(m.wishes, members, s.hunters, rand);
```

`members` は `Party` が並べた昇順の席なので、`members[0]` が最初に隠れる。

5. 次のフェーズを決める関数を `NEXT` の下に足し、`tick` と `settle` の `enter(m, NEXT[m.phase])` を `enter(m, next(m))` にする。

```ts
/** 逆算チキンレースは、番が残っていれば答え合わせから次の番の紹介へ進む */
const next = (m: Match): Phase =>
  m.phase === 'reveal' && m.settings.mode === 'race' && m.turn + 1 < m.order.length ? 'intro' : NEXT[m.phase];
```

6. `settle` を、逆算チキンレースの隠れタイムでは見せる 5 秒を残す形にする。

```ts
function settle(m: Match, present: Seat[]): void {
  if (!((m.phase === 'hide' || m.phase === 'reveal') && present.every((s) => m.ready.includes(s)))) return;
  // 逆算チキンレースは隠れタイムの終わりに隠れた姿を見せるので、飛ばしても見せる間は残す
  if (m.phase === 'hide' && m.settings.mode === 'race' && m.left > PREVIEW + EPS) m.left = PREVIEW;
  else enter(m, next(m));
}
```

7. `enter` に次の番の紹介を足し（`intro` へは `start` か、番が残った答え合わせからだけ入る）、`search` の秒と `reveal` の決着を変える。

```ts
  if (phase === 'intro') nextTurn(m);
  else if (phase === 'hide') m.left = m.settings.hide;
  else if (phase === 'search') {
    m.left = m.settings.mode === 'race' ? RACE_SEARCH : m.settings.search;
    ...（ダブルの行はそのまま）
  } else if (phase === 'reveal') {
    m.left = m.settings.reveal;
    m.buried = {};
    if (m.settings.mode === 'race') scoreRace(m);
    else if (m.settings.mode === 'double') {
      m.winner = 'double';
      m.champ ??= leader(m);
    } else m.winner ??= hiding(m).length ? 'chameleon' : 'hunter';
  } else if (phase === 'lobby') { ...（そのまま） }
```

`enter` の下に足す。

```ts
/** 逆算チキンレースの次の番。番の順の全員が探し、次の人だけが隠れる（抜けた人と途中で来た人は観戦） */
function nextTurn(m: Match): void {
  m.turn += 1;
  const hider = m.order[m.turn];
  const roles: Match['roles'] = Object.fromEntries(Object.keys(m.roles).map((s) => [s, 'out']));
  for (const s of m.order) roles[s] = s === hider ? 'hider' : 'hunter';
  Object.assign(m, {
    left: INTRO,
    roles,
    first: m.order.filter((s) => s !== hider),
    found: [],
    winner: null,
    taunts: { [hider]: m.settings.taunt },
    shots: {},
    toots: {},
    hid: [hider],
    caught: {},
    reached: {},
    champ: null,
    likes: {},
    buried: {},
    overlook: {},
    spots: {},
    misses: {}
  } satisfies Partial<Match>);
}

/** 逆算チキンレースの答え合わせ。隠れた人に見落としポイントの合計を足し、最後の番なら合計点のいちばん多い人の勝ち */
function scoreRace(m: Match): void {
  for (const h of m.hid) {
    const pts = Object.values(m.overlook).reduce((n, row) => n + (row?.[h] ?? 0), 0);
    m.scores[h] = (m.scores[h] ?? 0) + Math.floor(pts);
  }
  if (m.turn + 1 < m.order.length) {
    m.winner ??= hiding(m).length ? 'chameleon' : 'hunter';
    return;
  }
  m.winner = 'double';
  m.champ = m.order.reduce<Seat | null>(
    (best, s) => (best === null || (m.scores[s] ?? 0) > (m.scores[best] ?? 0) ? s : best),
    null
  );
}
```

8. `hit` に撃った人を足し、逆算チキンレースなら点を付ける（`m.found = [...]` のすぐ下。答え合わせに入る前の残り秒で数える）。

```ts
export function hit(m: Match, seat: Seat, by?: Seat): boolean {
  ...
  m.found = [...m.found, seat];
  if (m.settings.mode === 'race' && by !== undefined)
    m.scores[by] = (m.scores[by] ?? 0) + Math.ceil((RACE_FIND * m.left) / RACE_SEARCH);
```

9. `leave` の `if (m.phase === 'lobby') return;` の下に足す。

```ts
if (m.settings.mode === 'race') {
  const i = m.order.indexOf(seat);
  // 抜けた人の番は飛ばす。今の番より前（今の番を含む）なら、次の番の位置を 1 つ戻す
  if (i >= 0) {
    m.order = m.order.filter((s) => s !== seat);
    if (i <= m.turn) m.turn -= 1;
  }
}
```

10. `View` に `order: Seat[]; turn: number; scores: Partial<Record<Seat, number>>;` を足し（それぞれ 1 行の説明つき）、`view(m)` の戻り値に
    `order: m.order, turn: m.turn, scores: m.scores` を足す。

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/referee.test.ts` → すべて pass（足した 7 つと、064 の弾数制限を含む今のテスト）。
`pnpm check` → 型のエラーが出たら、`View` を手で作っているテストの偽物に `order: [], turn: 0, scores: {}` を足す（`view(newMatch())` を広げている所は直さなくてよい）。

### Step 3: 親が姿を配り、見つけた人に点を付ける

1. `host.test.ts` の import に `INTRO` と `PREVIEW` を足し（`./referee` から）、最後に次の describe を足す。

```ts
describe('Host の逆算チキンレース', () => {
  it('隠れタイムの残りが見せる秒になると、隠れた人の体と塗りを left で全員へ配り、戻った子へも送り直す', () => {
    const { act, told, host } = setup([1, 2, 3]);
    host.start({ ...DEFAULTS, mode: 'race', hide: 60 });
    act(me(0, [0, 0, 5], { pose: 'curl' }), 1);
    act({ t: 'dabs', at: 0, d: packDabs(paint(3)) }, 1);
    for (let i = 0; i < (INTRO + 60 - PREVIEW - 1) * 10; i++) host.tick(0.1);
    expect(of(told, 'left')).toEqual([]);
    for (let i = 0; i < 20; i++) host.tick(0.1);
    expect(of(told, 'left')).toEqual([
      expect.objectContaining({ seat: 1, body: expect.objectContaining({ pos: [0, 0, 5], pose: 'curl' }) })
    ]);
    told.length = 0;
    host.welcome(2);
    expect(of(told, 'leftDabs')).toHaveLength(1);
  });

  it('見つけた人に点を足し、答え合わせの場所は見せたときではなく今の体で、そのあと次の番の紹介へ', () => {
    const { act, told, host, clock } = setup([1, 2, 3]);
    host.start({ ...DEFAULTS, mode: 'race', hide: 60, reveal: 10 });
    act(me(0, [0, 0, 4]), 1);
    for (let i = 0; i < (INTRO + 60) * 10 + 1; i++) host.tick(0.1);
    expect(lastView(told).phase).toBe('search');
    // 親の時計も体の時刻にそろえる（撃った時刻の体を引くので、時刻の同じ 2 つの体を残さない）
    clock.ms = 1000;
    act(me(1000, [0, 0, 5]), 1);
    act(me(1000, [0, 0, 0]), 2);
    act({ ...SHOT, ms: 1000 }, 2);
    expect(lastView(told).phase).toBe('reveal');
    expect(lastView(told).scores[2]).toBeGreaterThan(490);
    expect(lastView(told).spots[1]).toEqual([0, 0, 5]);
    for (let i = 0; i < 10 * 10 + 1; i++) host.tick(0.1);
    expect(lastView(told)).toMatchObject({ phase: 'intro', turn: 1, roles: { 1: 'hunter', 2: 'hider', 3: 'hunter' } });
  });

  it('逆算チキンレースの前の子（版 5）は迎えない', () => {
    const { act, told } = setup([1, 2]);
    act({ t: 'leave' }, 2);
    act({ t: 'hi', v: 5 }, 2);
    expect(told.at(-1)).toEqual({ to: 2, m: { t: 'chameleon-mismatch' } });
  });
});
```

2. `net.ts` の `CHAMELEON_VERSION` を 6 にする。
3. `host.ts` を次のように変える。

- `tick` の `this.#watch(dt);` の前に `this.#preview();` を足し、`#watch` の上に足す。

```ts
  /** 逆算チキンレースの隠れタイムの終わりに、隠れた人の今の体と塗りを全員へ配る。ハンターは控室でその姿を見る */
  #preview() {
    const m = this.match;
    if (m.settings.mode !== 'race' || m.phase !== 'hide' || m.left > rules.PREVIEW + EPS || this.#left.size) return;
    for (const seat of m.hid) {
      const body = this.#lines.get(seat)?.last();
      if (!body) continue;
      this.#left.set(seat, { body, log: [...(this.#logs.get(seat) ?? [])] });
      this.#port.tell('all', { t: 'left', seat, body });
    }
  }
```

- `#shot` の `if (!rules.hit(this.match, seat)) continue;` を `if (!rules.hit(this.match, seat, from)) continue;` にする。
- `#entered` の答え合わせの場所を、ダブルのときだけ `#left` を見る形にする。

```ts
// 逆算チキンレースの #left は見せた瞬間の体で、そのあと動いていることがある
const left = m.settings.mode === 'double' ? this.#left.get(seat)?.body : undefined;
const at = left ?? this.#found.get(seat) ?? this.#lines.get(seat)?.last();
```

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/host.test.ts` → すべて pass（足した 3 つと、ダブルの今のテストを含む）。

### Step 4: 端末が控室に姿を立たせる

1. `session.svelte.test.ts` の import に `PREVIEW_AT`（`./session.svelte` から）と `PREVIEW`（`./referee` から）を足し、ダブルの describe のあとに次のテストを足す（`made` はこのファイルの偽物の記録）。

```ts
describe('Session の逆算チキンレース', () => {
  it('隠れた人の姿を控室のハンターの前に、張り付きを外して同じポーズで立たせ、隠れタイムのあいだだけ見せる', () => {
    const race = { ...DEFAULTS, mode: 'race' } as const;
    const roles = { 1: 'hunter', 2: 'hider', 3: 'hunter' } as const;
    const { tell, frames } = setup(3);
    tell(meMsg(2, { pos: [4, 2, 6], cling: { kind: 'ceiling' }, pose: 'curl' }));
    tell(at('hide', { settings: race, roles, first: [1, 3], hid: [2], left: PREVIEW }));
    const before = made.remotes.length;
    tell({ t: 'left', seat: 2, body: body({ pos: [4, 2, 6], cling: { kind: 'ceiling' }, pose: 'curl' }) });
    frames(0.1);
    const pin = made.remotes[before];
    expect(pin.lastShow?.visible).toBe(true);
    expect(pin.lastShow?.shine).toBeNull();
    expect(pin.lastShow?.pin).toMatchObject({ pos: [...PREVIEW_AT], yaw: Math.PI, cling: null, pose: 'curl' });
    tell(at('search', { settings: race, roles, first: [1, 3], hid: [2] }));
    frames(0.1);
    expect(pin.lastShow?.visible).toBe(false);
  });
});
```

2. `session.svelte.ts` の上の方（import の下）に足し、`frame` の `#lefts` のループを次の形にする。

```ts
/** 逆算チキンレースで隠れた姿を立たせる所。控室（ROOM）の北の壁ぎわで、ハンターの始める場所（北向き）の正面 */
export const PREVIEW_AT: V3 = [0, 0, -28.4];
```

```ts
const race = m.view.settings.mode === 'race';
for (const [seat, body] of this.#lefts)
  this.#pins.get(seat)?.update(dt, now, {
    // 逆算チキンレースは張り付きを外し、同じポーズで控室のハンターのほう（−z）へ向けて立たせる
    pin: race ? { ...body, pos: PREVIEW_AT, yaw: Math.PI, cling: null } : body,
    visible: race ? m.phase === 'hide' : !this.#caught(seat),
    armed: false,
    shine: race ? null : this.#leftShine(seat),
    scale: this.#pinScale(seat)
  });
```

`m` は `frame` の先頭の `const m = this.match;`。`V3` はこのファイルで import 済み（`$lib/sculpt`）。

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/session.svelte.test.ts` → すべて pass（足した 1 つと、ダブルの残した体のテストを含む）。

### Step 5: 試合の様子の読み口と順位

1. `match.svelte.test.ts` に足す（import に `PREVIEW` が要れば `./referee` から足す）。

```ts
it('逆算チキンレースの順位は合計点の多い順で、番の順の全員を出す', () => {
  const m = new Match(() => 1);
  m.receive({
    ...view(newMatch()),
    settings: { ...DEFAULTS, mode: 'race' },
    phase: 'search',
    order: [1, 2, 3],
    scores: { 2: 480, 3: 120 }
  });
  expect(m.race).toBe(true);
  expect(m.ranking.map((r) => [r.seat, r.got])).toEqual([
    [2, 480],
    [3, 120],
    [1, 0]
  ]);
});

it('逆算チキンレースの隠れタイムの残りが見せる秒になると previewing', () => {
  const m = new Match(() => 1);
  m.receive({ ...view(newMatch()), settings: { ...DEFAULTS, mode: 'race' }, phase: 'hide', left: PREVIEW + 1 });
  expect(m.previewing).toBe(false);
  m.advance(1.5);
  expect(m.previewing).toBe(true);
});
```

2. `match.svelte.ts` を次のように変える。

- `MODES` に足す（説明 2 行は本家の字が分からないので仮）。

```ts
  race: {
    name: '逆算チキンレース',
    lines: ['1人ずつ順番に隠れ、その姿を見せてから探す。', '早く見つけるほど高得点。合計点で勝負'],
    color: '#7cc243'
  }
```

- `get double()` の下に足す。

```ts
  get race(): boolean {
    return this.view.settings.mode === 'race';
  }

  /** 逆算チキンレースで、ハンターに隠れた姿を見せている（隠れタイムの終わりの PREVIEW 秒） */
  get previewing(): boolean {
    return this.race && this.phase === 'hide' && this.left <= PREVIEW;
  }
```

`PREVIEW` を `./referee` の import に足す。

- `ranking` の先頭に足す。

```ts
if (v.settings.mode === 'race')
  return v.order
    .map((seat) => ({ seat, got: v.scores[seat] ?? 0, need: 0 }))
    .sort((a, b) => b.got - a.got || a.seat - b.seat);
```

`const v = this.view;` の行の下に置く。

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/match.svelte.test.ts` → すべて pass。

### Step 6: 画面（紹介・順位表・モードのボタン）

1. `Intro.svelte` の紹介の説明 2 行の下に番を足し、`{/if}` のあとに見せる字を足す。

```svelte
{#if match.race}
  <p>{match.name(match.view.hid[0])}が隠れる番（{match.view.turn + 1}/{match.view.order.length}）</p>
{/if}
```

```svelte
{#if match.previewing && match.role === 'hunter'}<p class="look" role="status">この姿を探せ</p>{/if}
```

`<style>` に足す。

```css
.look {
  position: absolute;
  top: 14cqh;
  right: 0;
  left: 0;
  margin: 0;
  color: #fff;
  font-family: 'Hiragino Mincho ProN', serif;
  font-size: min(7cqh, 5cqw);
  text-align: center;
  text-shadow: 0 2px 6px #000;
  pointer-events: none;
}
```

2. `Ranking.svelte` の点の表示を `<span class="num">{match.race ? `${r.got}点` : `${r.got}/${r.need}`}</span>` にする。
3. `Overlay.svelte` の順位表の条件を `{#if (match.double || match.race) && (phase === 'search' || phase === 'reveal')}<Ranking {match} />{/if}` にする。
4. `Overlay.svelte.test.ts` の「ダブルの探索と答え合わせでは、左に順位表を出す」のあとに足す。

```ts
it('逆算チキンレースの探索と答え合わせでは、左に合計点の順位表を出す', () => {
  const settings = { ...DEFAULTS, mode: 'race' } as const;
  const roles = { 1: 'hunter', 2: 'hider' } as const;
  const { target, done } = show(
    'hunter',
    { phase: 'search', settings, roles, hid: [2], order: [1, 2], scores: { 2: 480 } },
    1
  );
  const rows = [...target.querySelectorAll('.ranking li')].map((li) => li.textContent?.replace(/\s+/g, ''));
  expect(rows).toEqual(['#1プレイヤー2480点', '#2プレイヤー10点']);
  done();
});
```

5. `Settings.svelte` のゲームモードに `<button class:on={settings.mode === 'race'} onclick={() => (settings.mode = 'race')}>逆算チキンレース</button>` を
   ダブルの次に足す。ハンターの人数の行の `settings.mode === 'double'`（`class:dim` と 2 つの `disabled`）を、スクリプトに足した
   `const fixed = $derived(settings.mode === 'double' || settings.mode === 'race');` の `fixed` に替える（逆算チキンレースのハンターは番で決まる）。
6. `Settings.svelte.test.ts` に足す。

```ts
it('ゲームモードで逆算チキンレースを選べ、選ぶとハンターの人数を押せない', () => {
  const { target, settings, done } = show(false);
  const pick = (text: string) => [...target.querySelectorAll('button')].find((b) => b.textContent === text)!;
  pick('逆算チキンレース').click();
  flushSync();
  expect(settings.mode).toBe('race');
  expect(target.querySelector<HTMLButtonElement>('[aria-label="増やす"]')!.disabled).toBe(true);
  done();
});
```

7. `prefs.test.ts` の「ダブルと見逃しランキングの設定も覚え、…」の下に足す（`prefs.ts` は `fit` を通すので変えない）。

```ts
it('逆算チキンレースも覚えて読む', () => {
  saveSettings({ ...DEFAULTS, mode: 'race' });
  expect(readSettings().mode).toBe('race');
});
```

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/Overlay.svelte.test.ts src/lib/games/yappari-chameleon/Settings.svelte.test.ts src/lib/games/yappari-chameleon/prefs.test.ts` → すべて pass。
`wc -l src/lib/games/yappari-chameleon/{Intro,Ranking,Overlay,Settings}.svelte` → どれも 200 未満。

### Step 7: CPU と遊ぶで選べないことを確かめる

`grep -n "mode: c.side === 'hide' ? 'normal' : c.mode" src/lib/games/yappari-chameleon/cpu/crew.ts` で 1 行出ることを見る（`cpuSettings` がモードを決め直す）。

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/cpu/` → すべて pass。grep が何も出さなければ STOP（CPU が逆算チキンレースで始まりうる）。

### Step 8: カメレオン全部と型

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/` → すべて pass。`pnpm check` → `0 ERRORS 0 WARNINGS`。

### Step 9: CLAUDE.md を直す

1. `grep -n "モードは通常・増え鬼・ダブルで、" CLAUDE.md` で 1 行出ることを見てから、その部分を「モードは通常・増え鬼・ダブル・逆算チキンレース（試作）で、」にする。
2. `grep -n "探す CPU は制限のあいだ試し撃ちをしない。" CLAUDE.md`（064 で足した文）で 1 行出ることを見てから、その直後に次の文を足す。

```text
逆算チキンレース（試作）は、席の順に 1 人ずつ隠れ、ほかの全員が探す（`referee.ts` の `order`・`turn`。答え合わせのあと番が残っていれば次の番の紹介へ進み、抜けた人の番は飛ばす）。隠れタイムの最後の `PREVIEW`（5 秒）に、親が隠れた人の今の体と塗りを `left` で配り（ダブルの残した体と同じ口）、各端末は控室の北の壁ぎわ（`session.svelte.ts` の `PREVIEW_AT`）に張り付きを外して同じポーズで立たせ、ハンターには「この姿を探せ」を出す（全員で飛ばしても見せる 5 秒は残す）。探す時間は 60 秒（`RACE_SEARCH`）で、見つけた人には切り上げ(500 × 残り秒 ÷ 60)、隠れた人には答え合わせで見落としポイントの合計を足し、最後の番の答え合わせで合計点のいちばん多い人の勝ち（`winner` は `double`、順位表は合計点）。点の付け方と言葉は仮で、CPU と遊ぶでは選べない。
```

どちらかの grep で行が出なければ STOP（CLAUDE.md の文が変わっている）。

**Verify**: `grep -c "逆算チキンレース（試作）は" CLAUDE.md` → 1。

### Step 10: 全体の確かめ

**Verify**: `pnpm verify` → exit 0。

### Step 11: iPad で触ってもらう（ここで止まる）

ここから先は持ち主が iPad で触る。実装はここで止め、次のことを報告に書く。

- できたこと（番の回り方・最後の 5 秒の姿・点の付け方は仮・CPU では選べない）と、足したテストの数
- iPad 2〜3 台で見てほしいこと
  1. マップの設定で「逆算チキンレース」を選んで始めると、紹介に「プレイヤー1が隠れる番（1/3）」が出る
  2. 隠れタイムの最後の 5 秒、控室のハンターの前に隠れた人の姿（塗りとポーズ）が立ち、「この姿を探せ」が出る。張り付いていた人の姿は立って見える
  3. 探索は 60 秒で、見つけると左の順位表の点が増える（早いほど多い）。見つからなければ隠れた人に見落としポイントの点が入る
  4. 答え合わせのあと次の人の番の紹介へ進み、全員の番が終わると「勝者 プレイヤーN!」でロビーへ戻る
  5. 姿の向き（背中が見えていないか）と、5 秒が短すぎないか
  6. 点の付け方が遊んでいて納得できるか（見つけた人 500 からの減り方、隠れた人の見落としポイントとの釣り合い）
- 作り込みの候補（触ってもらってから選ぶ）は、点の付け方、番の結果を出す画面、見せる時間と見せ方（姿を回して見せるなど）、
  紹介の説明の字、探索時間の行を薄くする、抜けて戻った人を番に戻す、の 6 つ

**Verify**: 報告に上の 6 つの見てほしいことと、`pnpm verify` が exit 0 だったことを書いた。

## Test plan

- 審判（`referee.test.ts`）に 7 つ。番と役・見つけた人の点・隠れた人の点・次の番と最後の勝者・飛ばしても 5 秒・抜けた人の番・ほかのモードは点なし
- 親（`host.test.ts`）に 3 つ。姿を配る（戻った子へも）・見つけた人の点と答え合わせの場所と次の番・版 5 を断る
- 端末（`session.svelte.test.ts`）に 1 つ、読み口（`match.svelte.test.ts`）に 2 つ、画面（`Overlay`・`Settings`）に 1 つずつ、保存（`prefs.test.ts`）に 1 つ
- ダブル・通常・増え鬼の今のテスト（特に `referee.test.ts` の「ダブル」、`host.test.ts` の戻った子、`session.svelte.test.ts` のダブルの残した体）が変えずに pass すること
- `pnpm exec vitest run src/lib/games/yappari-chameleon/` → すべて pass

## Done criteria

- [ ] `pnpm exec vitest run src/lib/games/yappari-chameleon/` が pass し、上の新しいテスト 16 個を含む
- [ ] `grep -n "CHAMELEON_VERSION = 6" src/lib/games/yappari-chameleon/net.ts` が 1 行出す
- [ ] `grep -n "'race'" src/lib/games/yappari-chameleon/referee.ts` が `GameMode` の行を含む
- [ ] `git diff --stat -- src/lib/games/yappari-chameleon/cpu/ src/lib/games/yappari-chameleon/bgm.ts src/lib/games/yappari-chameleon/Hud.svelte` が何も出さない（064 のあとからの差分で見る）
- [ ] `wc -l` で `Intro.svelte`・`Ranking.svelte`・`Overlay.svelte`・`Settings.svelte` がどれも 200 未満
- [ ] `grep -c "逆算チキンレース（試作）は" CLAUDE.md` が 1
- [ ] `pnpm verify` が exit 0
- [ ] `git status` で in scope 以外のファイルが変わっていない
- [ ] 報告に Step 11 の iPad で見てほしいことを書いた
- [ ] `plans/README.md` の 065 の行を更新し、`pnpm exec prettier --write plans/README.md` を通した

## STOP 条件

- 064 が入っていない（`misses` が無い、`CHAMELEON_VERSION` が 5 でない）
- `referee.ts` の `NEXT` / `enter` / `settle` / `tick` / `hit` / `leave`、`host.ts` の `#entered` / `#shot` / `welcome`、`session.svelte.ts` の `#onLeft` と `frame` の `#lefts` のループが上の抜粋と違う
- どこかで `enter(m, 'intro')` がすでに呼ばれている（`grep -n "enter(m, 'intro')" src/lib/games/yappari-chameleon/referee.ts` が Step 2 の前に何か出す）。`nextTurn` が別の入り方でも走ってしまう
- Step 1 の審判のテストのどれかで、フェーズが進まず止まる（同じフェーズのまま `run` が終わる）か、番が 2 回目の答え合わせで終わらない
- ダブルの今のテスト（残した体・答え合わせの場所・戻った子）が落ちる
- 直すのに `cpu/`・`bgm.ts`・`Hud.svelte`・`mansion/` を変えたくなった
- どれかの `.svelte` が 200 行以上になる

## Maintenance notes

- 見せる姿は隠れタイムの最後の 5 秒の体と塗りの写しで、そのあと隠れた人が動いたり塗り直したりしても変わらない。本家が見せたあと隠れる人を止めるかは分からないので、
  iPad で「見せたあと動くのはずるい」と言われたら、探索のあいだ隠れる人の移動と塗りを止めるか決める
- `winner` の `double` を最後の番の決着に使い回している。逆算チキンレースの結果の画面を作るときは `Winner` に `race` を足して `winnerText` を分ける
- `PREVIEW_AT` は控室の形（`mansion/layout.ts` の `ROOM` と `SPAWNS.room`）に合わせた所。控室を動かしたら合わせ直す
- 人と CPU を混ぜる試作（`plans/063-chameleon-cpu-fills-empty-seat-spike.md`）が入っていれば、CPU が座っているあいだは逆算チキンレースも選べなくする（今の `nodouble` と同じ扱い）。CPU の頭脳は番の回り方を想定していない
- 同点は番の順で先の人が勝つ。点の付け方を決めるときに見直す
