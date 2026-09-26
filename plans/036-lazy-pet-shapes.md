# Plan 036: 飼っていない種類の形は、使う場面に入る前に読む

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 12aa152..HEAD -- src/lib/games/pet-house/meta.ts src/lib/games/pet-house/activity.ts src/lib/games/pet-house/modes.ts src/lib/games/pet-house/session.svelte.ts src/lib/games/pet-house/plaza.svelte.ts src/lib/games/pet-house/walk.svelte.ts src/lib/games/pet-house/session.svelte.test.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                                            |
| ---------- | ----------------------------------------------------------------------------- |
| Priority   | P2                                                                            |
| Effort     | S                                                                             |
| Risk       | MED（形を読む前に組み立てが走ると、その種類を作り直す数百 ms の止まりが出る） |
| Depends on | 035（ひろばに入るときの止まりが先に消えていると、効果を測り分けられる）       |
| Category   | perf                                                                          |
| Planned at | commit `12aa152`, 2026-09-26                                                  |

## Why this matters

わんにゃんハウスは、組み立てた犬と猫の形（頂点の配列）を IndexedDB（`asobibako-pet-house`）に控え、ゲームを開くときに
タイトルのあいだに **全 15 種類** を読む。headless Chrome で測ると、読み込んだ直後の ArrayBuffer は 1.1MB から 44.0MB に
増え、部屋で飼っている 2 匹に使うのは 5.5MB だけだった。残りの約 37MB は、ふれあいひろばかおさんぽで使われるまで
メモリに残る。iPad の Safari はメモリの上限が厳しく、メモリが足りずにアプリが終わらされると localStorage が消えることが
ある（2026-09-26 に全記録を失った）。

飼っていない種類の形を使うのは、ふれあいひろば（`plaza.svelte.ts`、犬猫 8 匹と「ほかの子たち」）と、おさんぽで出会う
ほかの犬（`walk.svelte.ts`）だけ。タイトルでは飼っている種類だけを読み、この 2 つの場面へ移るときに残りを読むようにする。
移るときは今も「いどうちゅう…」を出して 2 フレーム待ってから組み立てるので、その待ちのあいだに読み終える。

## Current state

`src/lib/games/pet-house/meta.ts:16-25`

```ts
/** 前に作ったペットの形の控え（IndexedDB）を、タイトルのあいだに読んでおく。無ければ遊ぶときに作る */
async function warmShapes() {
  const [{ loadShapes }, { BREED_IDS }, { graphics }] = await Promise.all([
    import('./models'),
    import('./breeds'),
    import('$lib/graphics.svelte')
  ]);
  // iOS の IndexedDB は開くところで止まることがある。控えは速くするためだけのものなので、待ちきれなければ遊ぶときに作る
  await Promise.race([loadShapes(BREED_IDS, graphics.quality), new Promise((ok) => setTimeout(ok, 1500))]);
}
```

`loadShapes(ids, q)`（`models.ts`）は、まだ組み立てていない種類の控えを読んで `saved` に入れる。何度呼んでもよい
（組み立て済み・読み込み済みのものは飛ばす）。保存（`engine.ts` の `loadSave()`）の `pets[].breed` が飼っている種類。

`src/lib/games/pet-house/session.svelte.ts:647-652`（場面を移る。`run` は 2 フレーム後に呼ばれる）

```ts
  /** 重ねて押されたら、あとのほうは捨てる */
  #go(label: string, run: () => void) {
    if (this.#move) return;
    this.moving = label;
    this.#move = { run, wait: 2 };
    sounds.door();
  }
```

同じファイルの `frame(dt)` の先頭（`:372-379`）

```ts
  frame(dt: number): void {
    const m = this.#move;
    if (m && --m.wait <= 0) {
      const run = m.run;
      [m.run, m.wait] = [null, 3];
      if (run) run();
      else [this.#move, this.moving] = [null, null];
    }
```

`src/lib/games/pet-house/modes.ts` — 遊びのモードの出入り。`Stage` の口（`:14`）は `go(label: string, run: () => void): void`。
`start(activity, going)`（`:39-51`）と `visit(mode, going)`（`:53-61`）が `this.#stage.go(going, () => { ... activity.enter(...) })`
を呼ぶ。Session は `#stage` に `go: (label, run) => this.#go(label, run)` を渡している（`grep -n "go: (" src/lib/games/pet-house/session.svelte.ts`）。

`src/lib/games/pet-house/activity.ts:42-62` — `Activity` と `Visit` の口（`enter`・`frame`・`exit?` など）。ファイル先頭の
コメントが口の使い方の説明（新しい口を足したら、ここにも 1 行足す）。

`src/lib/games/pet-house/plaza.svelte.ts` — `Plaza`（Visit）。`enter` で `roster(...)` の 8 種類を `host.cast` する。
「ほかの子たち」でも別の種類に入れ替える。どちらも `breeds.ts` の `BREED_IDS` から選ぶ。

`src/lib/games/pet-house/walk.svelte.ts:31,284-293` — おさんぽ（Activity）。道の途中で `DOGS`（`BREED_IDS` の犬）から
1 種類を選んで `createPet(breed, graphics.quality)` する。

テスト: `src/lib/games/pet-house/session.svelte.test.ts` が Session と遊びのモードの出入りを、world3d をモックして確かめている
（`h.cast([], [guest])` など）。見本にする。

## Commands you will need

| Purpose             | Command                                        | Expected on success  |
| ------------------- | ---------------------------------------------- | -------------------- |
| Install（worktree） | `pnpm install --frozen-lockfile`               | exit 0               |
| 対象テスト          | `pnpm exec vitest run src/lib/games/pet-house` | all pass             |
| 全テスト            | `pnpm test:run`                                | all pass             |
| 型                  | `pnpm check`                                   | 0 errors, 0 warnings |
| lint                | `pnpm lint`                                    | exit 0               |

## Scope

In scope は Drift check に並べた 7 ファイルと `CLAUDE.md`（わんにゃんハウスの段落の、形の控えの 1 文だけ）。

Out of scope は次のとおり。

- `models.ts`（`loadShapes` はそのまま使う。組み立てた形 `bodies` を捨てる処理は足さない。捨てると GPU の側の後始末が要り、
  形は全種類でも頭打ちになることを測って確かめてある）
- 初めてその種類を組み立てるときの数秒の止まり（端末と版ごとに 1 回だけで、2 回目からは控えを読む）

## Git workflow

- ステップごとにコミットしてよい。メッセージは英語の命令形 1 行（例 `Load other breeds' shapes only before the plaza or a walk`）。
  末尾に Co-Authored-By を 1 行
- push しない

## Steps

### Step 1: 場面を移るとき、準備が済むまで待てるようにする

- `modes.ts` の `Stage.go` を `go(label: string, run: () => void, ready?: Promise<unknown>): void` にする
- `session.svelte.ts` の `#go` も `ready` を受け取る。`#move` に `ready: boolean` を持たせ、`ready` が無ければ最初から true、
  あれば `ready.finally(() => (move.ready = true))`（失敗しても進む。形の控えは速くするためだけのもの）。
  待ちすぎないよう、1.5 秒で true にするタイマーも置く（`meta.ts` の見切りと同じ長さ。iOS の IndexedDB は開くところで止まることがある）
- `frame` の先頭の条件を `if (m && m.ready && --m.wait <= 0)` にする（準備が済むまでは「いどうちゅう…」を出したまま）
- `#stage` に渡す `go` は `(label, run, ready) => this.#go(label, run, ready)` にする

**Verify**: `pnpm check` → 0 errors。`pnpm exec vitest run src/lib/games/pet-house/session.svelte.test.ts` → all pass

### Step 2: 遊びのモードが「入る前の準備」を持てるようにする

- `activity.ts` の `Activity` に `prepare?(): Promise<unknown>;` を足す（JSDoc「場面に入る前に済ませたいこと。いどうちゅうのあいだに
  待つ（最長 1.5 秒）」）。`Visit` は `Omit<Activity, 'enter'>` なので自動で持つ。ファイル先頭の説明にも 1 行足す
- `modes.ts` の `start` と `visit` で、`this.#stage.go(going, () => {...}, activity.prepare?.())`（visit は `mode.prepare?.()`）にする

**Verify**: `pnpm check` → 0 errors

### Step 3: ひろばとおさんぽが、使う種類の形を先に読む

- `plaza.svelte.ts` の `Plaza` に `prepare()` を足し、`loadShapes(BREED_IDS, graphics.quality)` を返す（「ほかの子たち」でも
  どの種類が出るか分からないので全種類）
- `walk.svelte.ts` のおさんぽの Activity に `prepare()` を足し、`loadShapes(DOGS, graphics.quality)` を返す
- どちらも `loadShapes` は `./models`、`graphics` は `$lib/graphics.svelte` から import する（既に import していればそれを使う）

**Verify**: `pnpm check` → 0 errors

### Step 4: タイトルでは飼っている種類だけを読む

`meta.ts` の `warmShapes` を、`./engine` の `loadSave()` を読み、`save?.pets.map((p) => p.breed)`（重複を除く）だけを
`loadShapes` に渡す形にする。飼っていなければ何も読まない（1 匹目はひろばで選ぶので、ひろばの `prepare` が読む）。
JSDoc を「飼っている種類の形の控えを、タイトルのあいだに読んでおく。ほかの種類はひろばとおさんぽに入る前に読む」にする。

`engine.ts` の `loadSave` は DOM も three も使わないので、ここで import してよい（一覧の画面のチャンクには入らない。
`warmShapes` の中の動的 import にする）。

**Verify**: `pnpm check` → 0 errors。`pnpm build` → exit 0

### Step 5: テストを書く

`session.svelte.test.ts` に 2 本足す（見本は同じファイルのモードの出入りのテスト）。

1. `prepare` が解決しない Visit で `session.visit(mode, 'いくよ')` → フレームを何度か進めても `mode.enter` は呼ばれず、
   `session.moving` は `'いくよ'` のまま → `prepare` を解決 → 数フレームで `enter` が呼ばれ、やがて `moving` が null
2. `prepare` がずっと解決しない Visit でも、fake timers で 1.5 秒進めると `enter` が呼ばれる

**Verify**: `pnpm exec vitest run src/lib/games/pet-house/session.svelte.test.ts` → all pass（2 本増える）

### Step 6: CLAUDE.md の形の控えの説明を今の仕様にする

わんにゃんハウスの段落の「組み立てたペットの形は重いので、版ごとに IndexedDB（`asobibako-pet-house`）へ控え、タイトルの
あいだに読む。」を、「…へ控える。タイトルのあいだに読むのは飼っている種類だけで、ほかの種類は、ひろばとおさんぽが
`prepare()` で、いどうちゅうのあいだに読む（最長 1.5 秒）。」のように今の仕様にする。経緯は書かない。

**Verify**: `grep -c "prepare()" CLAUDE.md` → 1 以上。`pnpm lint` → exit 0

### Step 7: 全体の確認

**Verify**: `pnpm test:run` → all pass。`pnpm check` → 0 errors。`pnpm lint` → exit 0。`pnpm vitals --diff` → exit 0

## Test plan

`session.svelte.test.ts` に 2 本（Step 5）。メモリと止まる時間はレビュー担当が headless Chrome で測り直す（タイトルの
ArrayBuffer が 44MB から飼っている種類ぶんへ下がり、ひろばとおさんぽに入る時間が悪くなっていないこと）。

## Done criteria

- [ ] `grep -n "BREED_IDS" src/lib/games/pet-house/meta.ts` が 0 行
- [ ] `grep -n "prepare" src/lib/games/pet-house/plaza.svelte.ts src/lib/games/pet-house/walk.svelte.ts src/lib/games/pet-house/modes.ts src/lib/games/pet-house/activity.ts` が 4 ファイルで出る
- [ ] `pnpm test:run` / `pnpm check` / `pnpm lint` / `pnpm vitals --diff` が通る
- [ ] `git diff --name-only 12aa152` が In scope のファイル（+ 先に入った計画のファイル、`plans/README.md`）だけ

## STOP conditions

- 抜粋と今のコードが違う
- 飼っていない種類の形を使う場面が、ひろばとおさんぽのほかにも見つかった（`grep -rn "createPet(\|cast(" src/lib/games/pet-house`
  で確かめる。コンテストなどが使っていたら、どのモードかを報告する）
- `#go` の待ちを変えると、既存のテスト（場面の出入り・重ねて押したときに捨てる）が落ちる

## Maintenance notes

- 飼っていない種類を出す遊びを足すときは、その Activity / Visit に `prepare()` を足して形を読む。忘れると、その場面で
  種類ごとに数百 ms 止まる（控えがあるのに組み立て直す）
- 読んだ形は `saved` に残り、使われると `bodies` に移る。ひろばに一度入れば、以前と同じく全種類ぶんを持つ（頭打ちは約 74MB）
