# Plan 060: 偽の時計を後片付けし、乱数と日付に揺れないテストにし、CI に arm64 のテストを足す

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 36cc037..HEAD -- src/lib/net/party.svelte.test.ts src/lib/games/yappari-chameleon/Buttons.svelte.test.ts src/lib/games/yappari-chameleon/cpu/bot.test.ts src/lib/games/pet-house/engine.test.ts .github/workflows/ci.yml`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。ただし plan 053 が先に入っていると
> `engine.test.ts` に import 1 つとテスト 2 つが足されている。それは想定どおりなので、下の「うちに来た日」の抜粋が同じなら進めてよい。

## Status

| 項目       | 値                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------- |
| Priority   | P2                                                                                        |
| Effort     | S                                                                                         |
| Risk       | LOW（テスト 4 ファイルの後片付けと固定値、CI に任意のジョブを 1 つ足す。本体は触らない）  |
| Depends on | none（plan 053 と同じ `engine.test.ts` を触るが、別の describe なのでどちらが先でもよい） |
| Category   | tests                                                                                     |
| Planned at | commit `36cc037`, 2026-10-14                                                              |

## Why this matters

テストの揺れと、CI でだけ落ちる失敗を減らす。直すのは次の 4 つで、どれも小さい。

1. 偽の時計（`vi.useFakeTimers()`）をテストの最後の行で戻しているファイルが 2 つある。途中の `expect` が落ちると偽の時計が残り、
   同じファイルの後ろのテストが時間の止まった状態で走って、関係のない失敗がいくつも並ぶ。どれが本当の失敗かが分かりにくくなる
2. やっぱりカメレオンの CPU の子のテスト（`cpu/bot.test.ts`）は、CPU に乱数を渡さず `Math.random` で 60 秒ぶん回している。
   今は通っていても、走るたびに違う筋を通るので、落ちたときに再現できない。審判のほうはすでに固定の乱数を渡している
3. わんにゃんハウスの「うちに来た日」のテストは、作った日と `day(Date.now())` を別々に読む。日付の変わる瞬間をまたぐと落ちる
4. CI のテストは ubuntu（x64）でしか走らない。2026-10-08 には、手元の Mac（arm64）で通る延長戦のテストが CI の x64 でだけ
   浮動小数の最後の 1 ビットの差で落ち、7 コミットのあいだ配信が止まった（コミット `a8cd4ff` で直した）。PR のときに arm64 の
   結果も並べて見えるようにし、どちらかの CPU でだけ落ちるテストを同じ PR の中で見つける

## Current state

### 1. 偽の時計を最後の行で戻している 2 ファイル

`src/lib/net/party.svelte.test.ts:204-212` にある。

```ts
it('hello を送らない古い版の子は、3 秒で見切る', async () => {
  vi.useFakeTimers();
  const host = Party.host();
  const [a] = pipes();
  const result = host.add(a);
  vi.advanceTimersByTime(3000);
  expect(await result).toBe('mismatch');
  vi.useRealTimers();
});
```

同じファイルの `src/lib/net/party.svelte.test.ts:232-246`（`'断るときは、理由を送ってから少し待って閉じる'`）も、
`vi.useFakeTimers()` で始めて最後の行で `vi.useRealTimers()` する。このファイルの 1 行目は
`import { describe, expect, it, vi } from 'vitest';` で、`afterEach` は無い。

`src/lib/games/yappari-chameleon/Buttons.svelte.test.ts:184-213` の 2 つ（`'出てから 350ms は押せず、…'` と
`'戻る を押すと onquit を 1 回だけ呼ぶ'`）も同じで、最後に `vi.useRealTimers();` のあと `unmount(t.app);` する。
このファイルの 2 行目は `import { describe, expect, it, vi } from 'vitest';` で、`afterEach` は無い。

偽の時計を使うほかのファイルは、`afterEach` で戻すか（`src/lib/settle.svelte.test.ts` など 14 ファイル）、`try { … } finally { vi.useRealTimers(); }`
で戻している（`src/lib/games/pet-house/session.svelte.test.ts:283-302` と `:320-333`、`src/lib/coloring/PhotoMaker.svelte.test.ts`）。
これらは落ちても戻るので直さない。

### 2. CPU の子のテストの乱数

`src/lib/games/yappari-chameleon/cpu/bot.test.ts:11-35` の `table(n)` は、審判（`Host`）の 4 つめの引数に `() => 0` を渡すが、
CPU（`Bot`）には `rand` を渡さない（抜粋は中を省いた）。

```ts
async function table(n: number) {
  const clock = { ms: 0 };
  const party = Party.host();
  const host = new Host(
    party,
    (seed) => levelOf(mansion(seed)),
    () => clock.ms,
    () => 0
  );
  // …
    bots.push(new Bot(b, { strength: 'normal', index: i }));
```

`Bot` は渡されなければ `Math.random` を使う（`src/lib/games/yappari-chameleon/cpu/bot.ts:78`）。

```ts
this.#rand = o.rand ?? Math.random;
```

この乱数は隠れ場所選び（`pickSpot`）と探す CPU（`HunterBrain`）に渡る（`bot.ts:148-174`）。`table` は
`'ハンターの CPU は隠れタイムの始めに押し、…'` で `run(60)` などゲームの時計を長く進める。

種から作る乱数は `src/lib/games/yappari-chameleon/rng.ts` の `rng(seed)` にある。`cpu/hunter.test.ts:11` が
`import { rng } from '../rng';` で読み、`rng(3)` や `rng(5)` を渡している。

### 3. 「うちに来た日」のテスト

`src/lib/games/pet-house/engine.test.ts:362-378` にある。

```ts
describe('うちに来た日', () => {
  it('adopt したペットの来た日は今日', () => {
    const { pet } = withPet();
    expect(pet.since).toBe(day(Date.now()));
  });

  it('来た日の無い・壊れた保存は読み込んだ日を来た日にし、正しい日はそのまま残る', () => {
    const { save } = withPet();
    save.pets[0].since = '2020-01-01';
    writeSave(save);
    expect(loadSave()?.pets[0].since).toBe('2020-01-01');

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pets: [{ id: 'a', breed: 'shiba' }] }));
    expect(loadSave()?.pets[0].since).toBe(day(Date.now()));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pets: [{ id: 'a', breed: 'shiba', since: 'x' }] }));
    expect(loadSave()?.pets[0].since).toBe(day(Date.now()));
  });
```

`adopt()` は `since: day(Date.now())`（`src/lib/games/pet-house/engine.ts:340`）、`loadSave()` は中で `Date.now()` を 1 回読んで
`day(now)` を来た日にする。テストの `day(Date.now())` はそのあとに読むので、あいだで 0 時をまたぐと 1 日ずれる。
このファイルの 1 行目は `// @vitest-environment happy-dom`、2 行目は `import { beforeEach, describe, expect, it, vi } from 'vitest';`。
`withPet()` はファイルの頭で決めた過去の時刻 `NOW`（`Date.now() - 1000 * HOUR`）で `newSave` を作る。

### 4. CI

`.github/workflows/ci.yml:42-52` のテストのジョブは ubuntu だけで走る。

```yaml
test:
  runs-on: ubuntu-latest
  timeout-minutes: 10
  steps:
    - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      with:
        persist-credentials: false
    - name: Setup Node.js and dependencies
      uses: ./.github/workflows/setup-node
    - name: Run Vitest
      run: pnpm test:run
```

`./.github/workflows/setup-node` は composite の action で、`package.json` の `devEngines.runtime.version`（24.18.1）を `jq` で読み、
pnpm と Node を入れて `pnpm install --frozen-lockfile` する。macOS の runner にも `jq` と bash はある。

`main` にはリポジトリの ruleset「main: CI must pass」があり、必須のチェックは名前で `lint`・`check`・`test`・`build` の 4 つ。
`test` のジョブを matrix にすると、チェックの名前が `test (ubuntu-latest)` のように変わり、必須の `test` がいつまでも来ずに
PR が通らなくなる。そこで `test` はそのまま残し、別の名前のジョブを足す。リポジトリは public なので、GitHub の標準の
macOS の runner の時間は無料（private なら Linux の 10 倍で数える）。`macos-latest` は Apple silicon（arm64）。

### vitest の設定（変えない）

テストの設定は `vite.config.ts:72-95` の `test.projects`（node の `unit` と happy-dom の `dom`）で、`restoreMocks`・`unstubGlobals`・
`setupFiles` は無い。設定で `unstubGlobals: true` にすると、vitest は各テストの前に `vi.unstubAllGlobals()` を呼ぶので、ファイルの頭で
差し替えているテストが壊れる。`src/lib/coloring/ai-run.test.ts:21` の `vi.stubGlobal('Worker', FakeWorker);` と
`src/lib/games/oekaki-mori/prefs.test.ts:15` の `vi.stubGlobal('localStorage', { … })` がそれにあたる。偽の時計を戻す共通の
`setupFiles` も、2 ファイルに 1 行ずつ足すより大きいので作らない。`vi.stubGlobal` を本文の最後で戻しているテスト
（`pet-house/engine.test.ts`・`animal-survivors/coop.test.ts`・`animal-survivors/explore.test.ts`）は、落ちたときに同じファイルの中で
本物の localStorage が差し替わったまま残るだけで、ほかのファイルには漏れない（vitest はファイルごとに分けて走らせる）ので、この計画では直さない。

規約として、コメントは「コードから復元できない WHY」だけを日本語で書く（変更履歴やチケット番号は書かない）。テストの名前は日本語の文にする。

## Commands you will need

| Purpose    | Command                                                                                                                                                                                               | Expected on success           |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 直すテスト | `pnpm exec vitest run src/lib/net/party.svelte.test.ts src/lib/games/yappari-chameleon/Buttons.svelte.test.ts src/lib/games/yappari-chameleon/cpu/bot.test.ts src/lib/games/pet-house/engine.test.ts` | すべて pass                   |
| 全テスト   | `pnpm test:run`                                                                                                                                                                                       | exit 0                        |
| 型         | `pnpm check`                                                                                                                                                                                          | `0 ERRORS 0 WARNINGS`、exit 0 |
| lint       | `pnpm lint`                                                                                                                                                                                           | exit 0                        |
| YAML       | `pnpm exec prettier --check .github/workflows/ci.yml`                                                                                                                                                 | exit 0                        |
| 全部       | `pnpm verify`                                                                                                                                                                                         | exit 0                        |

## Scope

**In scope**

- `src/lib/net/party.svelte.test.ts`
- `src/lib/games/yappari-chameleon/Buttons.svelte.test.ts`
- `src/lib/games/yappari-chameleon/cpu/bot.test.ts`
- `src/lib/games/pet-house/engine.test.ts`（describe「うちに来た日」だけ）
- `.github/workflows/ci.yml`
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- `vite.config.ts` の vitest の設定 — 上の「vitest の設定（変えない）」のとおり、`unstubGlobals`・`restoreMocks`・`setupFiles` は足さない
- テストでない本体のファイル（`bot.ts`・`engine.ts`・`party.svelte.ts` など）
- `try … finally` や `afterEach` で戻しているほかのテスト、`vi.stubGlobal` を本文で戻しているテスト
- `.github/workflows/deploy.yml` — 配信の前のテストは ubuntu のままでよい（配信は x64 で通れば足りる）
- リポジトリの ruleset（必須のチェック）— 足すジョブを必須にするかは持ち主が決める。この計画では GitHub の設定を変えない
- `test` のジョブを matrix にすること — 必須のチェックの名前が変わって PR が通らなくなる

## Git workflow

- ブランチは `advisor/060-test-hygiene-and-arm64-ci`
- コミットは場所ごとに分けてよい。英語の命令形 1 文（例 `Restore real timers after each test in the party and chameleon button tests`、
  `Run the test job on macOS arm64 as well`）。Co-Authored-By などの trailer は付けない
- push しない（`main` への push は本番に配信される。CI の新しいジョブが動くのは、持ち主が push か PR を作ったとき）

## Steps

### Step 1: 偽の時計を `afterEach` で戻す

`src/lib/net/party.svelte.test.ts` の 1 行目を `import { afterEach, describe, expect, it, vi } from 'vitest';` にし、
`describe('Party', () => {` のすぐ上（ファイルの頭の関数と `settle` の定義の後ろ）に次の 2 行を足す。

```ts
// 途中の expect で落ちても、後ろのテストを止まった時計で走らせない
afterEach(() => vi.useRealTimers());
```

そして、`'hello を送らない古い版の子は、3 秒で見切る'` と `'断るときは、理由を送ってから少し待って閉じる'` の最後の
`vi.useRealTimers();` の行を消す。

`src/lib/games/yappari-chameleon/Buttons.svelte.test.ts` も同じにする。2 行目を
`import { afterEach, describe, expect, it, vi } from 'vitest';` にし、`describe('Buttons', () => {` のすぐ上に同じ 2 行を足し、
`'出てから 350ms は押せず、…'` と `'戻る を押すと onquit を 1 回だけ呼ぶ'` の `vi.useRealTimers();` の行を消す
（そのあとの `unmount(t.app);` は残す）。

**Verify**: `grep -c "useRealTimers" src/lib/net/party.svelte.test.ts src/lib/games/yappari-chameleon/Buttons.svelte.test.ts` →
どちらも `1`。`pnpm exec vitest run src/lib/net/party.svelte.test.ts src/lib/games/yappari-chameleon/Buttons.svelte.test.ts` → すべて pass。

### Step 2: CPU の子のテストに種から作る乱数を渡す

`src/lib/games/yappari-chameleon/cpu/bot.test.ts` の import に `import { rng } from '../rng';` を足し（`../referee` の下、
`./bot` の上）、`table(n)` の中の 1 行を次にする。

```ts
bots.push(new Bot(b, { strength: 'normal', index: i, rand: rng(i + 1) }));
```

**Verify**: 次を 3 回続けて実行し、3 回とも pass する。

```bash
for k in 1 2 3; do pnpm exec vitest run src/lib/games/yappari-chameleon/cpu/bot.test.ts || break; done
```

### Step 3: 「うちに来た日」の時計を昼に止める

`src/lib/games/pet-house/engine.test.ts` の 2 行目の import に `afterEach` を足す
（`import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';`）。`describe('うちに来た日', () => {` のすぐ内側の頭に
次を足す。テストの本文と期待は変えない。

```ts
// 来た日はペットを作るときと確かめるときに別々に今日を読むので、0 時をまたぐと 1 日ずれる。今日の昼で止める
beforeEach(() => {
  const noon = new Date();
  noon.setHours(12, 0, 0, 0);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(noon);
});
afterEach(() => vi.useRealTimers());
```

`toFake: ['Date']` にするのは、`setTimeout` などは本物のままにしておくため（このファイルのほかのテストと同じ動きにする）。

**Verify**: `pnpm exec vitest run src/lib/games/pet-house/engine.test.ts` → すべて pass。

### Step 4: CI に arm64 のテストのジョブを足す

`.github/workflows/ci.yml` の `test:` のジョブ（`run: pnpm test:run` まで）のすぐ後ろ、`build:` の前に次のジョブを足す。
`test` のジョブそのものは 1 文字も変えない。
下の抜粋は Markdown の整形で左に寄っている。`ci.yml` では `jobs:` の下なので、各行の頭に空白を 2 つ足し、`test:` と同じ深さに置く。

```yaml
# 手元の Mac（arm64）と CI（x64）で浮動小数の最後の 1 ビットが違い、長いシミュのテストが片方でだけ落ちたことがある。
# 両方の結果を PR に並べる。必須のチェックの名前（test）を変えないよう、matrix にせず別のジョブにする
test-arm64:
  runs-on: macos-latest
  timeout-minutes: 15
  steps:
    - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      with:
        persist-credentials: false
    - name: Setup Node.js and dependencies
      uses: ./.github/workflows/setup-node
    - name: Run Vitest
      run: pnpm test:run
```

**Verify**: `pnpm exec prettier --check .github/workflows/ci.yml` → exit 0。
`grep -c "runs-on: macos-latest" .github/workflows/ci.yml` → `1`。
`grep -c "^  test-arm64:" .github/workflows/ci.yml` → `1`（`jobs:` の下の深さにある）。
`grep -n "^  test:" .github/workflows/ci.yml` → 1 行（名前が `test` のジョブが残っている）。
`git diff -U0 .github/workflows/ci.yml | grep '^-' | grep -v '^---'` → 何も出ない（消した行が無い）。

### Step 5: 全体の確かめ

**Verify**: `pnpm verify` → exit 0。`git status --short` → in scope のファイルだけが変わっている。

## Test plan

- 新しいテストは書かない。直すのは既存のテストの後片付けと固定値
- 偽の時計の後片付けは、同じ形の `src/lib/settle.svelte.test.ts` などの `afterEach` に合わせる
- 種の乱数の渡し方は `cpu/hunter.test.ts` の `rng(3)` に合わせる
- CI のジョブは手元では走らせられない。YAML の形は prettier で、名前と runner は grep で確かめる。実際に macOS で通るかは、持ち主が
  PR を作ったときの `test-arm64` の結果で見る（手元の Mac で `pnpm test:run` が通っていれば、同じ arm64 なので通る見込み）

## Done criteria

- [ ] Commands の「直すテスト」が pass する
- [ ] `grep -c "useRealTimers" src/lib/net/party.svelte.test.ts src/lib/games/yappari-chameleon/Buttons.svelte.test.ts` がどちらも `1`
- [ ] `grep -c "rand: rng(i + 1)" src/lib/games/yappari-chameleon/cpu/bot.test.ts` が `1`
- [ ] `grep -c "setSystemTime" src/lib/games/pet-house/engine.test.ts` が `1`
- [ ] `grep -c "runs-on: macos-latest" .github/workflows/ci.yml` が `1`、`grep -c "^  test:" .github/workflows/ci.yml` が `1`
- [ ] `vite.config.ts` が変わっていない（`git diff --quiet vite.config.ts` が exit 0）
- [ ] `pnpm verify` が exit 0
- [ ] `git status` で in scope 以外のファイルが変わっていない
- [ ] `plans/README.md` の 060 の行を更新した

## STOP 条件

- 上の抜粋（偽の時計の 4 つのテスト、`table(n)` の `new Bot`、「うちに来た日」の 2 つ、`ci.yml` の `test` のジョブ）が今のコードと違う
- Step 2 で、種を渡したら bot.test.ts のテストが落ちる。別の種（`rng(i + 7)` など）で通しても、期待を変えて通してもいけない。
  落ちた種と落ちたテストの名前を報告する（今の期待が `Math.random` の当たりの筋に頼っていることになるため）
- Step 3 で、時計を止めたら「うちに来た日」のほかのテストまで落ちる
- `Bot` の options に `rand` が無い（`src/lib/games/yappari-chameleon/cpu/bot.ts` の `BotOptions` に `rand?: () => number` があるはず）
- 直すために、テストでないファイルや `vite.config.ts` を変えたくなった
- `ci.yml` の中のほかのジョブ名や必須のチェックの名前を変えたくなった

## Maintenance notes

- 偽の時計を使うテストを足すときは、ファイルに `afterEach(() => vi.useRealTimers())` があるかを見る。最後の行で戻さない
- `Bot` や `HunterBrain` を使うテストには、いつも種の乱数を渡す。`Math.random` のままだと、落ちたときに同じ筋をもう一度通せない
- `test-arm64` は必須のチェックではない。何度か緑が続いたら、持ち主が ruleset「main: CI must pass」の必須に `test-arm64` を足すかを決める。
  足したあとに x64 か arm64 の片方でだけ落ちるテストが出たら、期待の数字ではなくテストの前提（倒れない・時間が止まらないなど）を見直して直す
- `deploy.yml` は ubuntu でテストしてから配信する。arm64 でだけ落ちるテストがあっても配信は止まらないので、PR の `test-arm64` の赤は見落とさない
