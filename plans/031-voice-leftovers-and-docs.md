# Plan 031: 声の機能の残りを消し、CLAUDE.md のずれを直す

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 4c06cf0..HEAD -- src/lib/games/pet-house/behavior.ts src/lib/games/pet-house/behavior.test.ts src/lib/games/pet-house/social.ts src/lib/games/pet-house/toys.ts src/lib/games/pet-house/session.svelte.ts src/lib/games/pet-house/Tools.svelte src/lib/games/pet-house/training.ts src/lib/games/pet-house/activity.ts CLAUDE.md`
> Step 0 で 027 のブランチを取り込んだあとは、027 が触ったファイル（`session.svelte.ts` など）の差分だけが出る **はず**。
> それ以外の差分は「Current state」と見比べる。

## Status

| 項目       | 値                                                                                  |
| ---------- | ----------------------------------------------------------------------------------- |
| Priority   | P3                                                                                  |
| Effort     | S                                                                                   |
| Risk       | LOW（どの呼び出し元からも届かない分岐とコメントだけを消す）                         |
| Depends on | 027（`session.svelte.ts` の隣り合う行を触る。027 のブランチを取り込んでから始める） |
| Category   | tech-debt / docs                                                                    |
| Planned at | commit `4c06cf0`, 2026-09-26                                                        |

## Why this matters

2026-09-26 にわんにゃんハウスの声の機能（マイクで命令する）を外したが、声専用だった命令・状態・メソッド・コメントが
残っている。1891 行の `behavior.ts` に、どこからも立たない状態（`stay`・`bedtime`・`romp`）と届かない分岐が約 60 行
混ざり、コメントは「声で呼ぶ」「マイクの前に呼ぶ」と、もう無い機能を説明している。エージェントも人も、コメントを
読んで「声の機能がある」と誤解する。死んだ分岐のテストも約 110 行、保守の対象として残っている。

あわせて、エージェントが毎回読む CLAUDE.md に、実態とずれた記述が 3 か所ある。

## Current state

本番で `command()` に渡される命令は `call`・`trick`・`stroke`・`brush`・`wake`（`stretch` なし）の 5 種類だけ
（呼び出し元は `modes.ts:47`、`plaza.svelte.ts`、`rubbing.ts:56`、`session.svelte.ts` の数か所、`training.ts:22`）。
監査で `grep -rnE "type: '(sleep|stay|scold|play|face|wake)'" src/lib/games/pet-house | grep -v test` を流し、命令として
使っているのは `modes.ts:47` の `{ type: 'wake' }` だけだと確かめた（`behavior.ts:209-210,347,875` の `sleep`/`wake` は
`BehaviorEvent` で、命令ではない。残す）。

`src/lib/games/pet-house/behavior.ts`

- `:162-167` — `Actor` の `bedtime` / `stay` / `romp`（それぞれの JSDoc は「ねんね」「まて」「あそぼ」と声の命令の説明）
- `:181-192` — `Command` の `wake` の `stretch?`（「声の『おきて』」）、`sleep`・`stay`・`scold`・`play`・`face`
- `:325-327` — `createActor`（名前は実物を確かめる）の初期値 `bedtime: false, stay: false, romp: 0`
- `:416-478` — `apply()`。`wake` の `stretch` 分岐（`:420-423`）、`stroke`/`brush` の `a.stay` 条件（`:428`）、
  `scold`（`:435`）、`call` の `[a.stay, a.bedtime] = [false, false]`（`:438`）、`:450-472` の `face`・`sleep`・`stay`・`play`
- `:480-496` — `scolded()` と `export const naughty`（`naughty` はテストからしか呼ばれない）
- `:789` — `needs()` の `(a.bedtime || s.energy < ...)`
- `:870` — `fallAsleep()` の `a.bedtime = false;`
- `:1100` — `[a.stay, a.romp] = [false, 0];`
- `:1172-1177` — `case 'idle':` の `if (a.stay) { ... }`
- `:1217` — `a.romp > 0 ||`、`:1221` — `if (a.romp > 0 && --a.romp > 0) return ...`、`:1450` — `if (a.next === 'idle' && a.romp > 0) return ...`
- `STRETCH`（`:341`）は `:1274` で眠りから自然に起きるときにも使う。**残す**
- `toldAt`（`:161`）は `social.ts:160` が読む。**残す**

`src/lib/games/pet-house/social.ts:152-155` — `free` の `!a.stay &&`

`src/lib/games/pet-house/toys.ts:130-152` — `toss()`（JSDoc「声の『とってこい』」）。呼び出し元なし

`src/lib/games/pet-house/session.svelte.ts:344-351`

```ts
  /**
   * 条件の多くはハート・芸・持ちものなど save から数えるので、書くたび（1 秒に 1 回まで）にまとめて確かめる。
   * 閉じる・隠れるときは押しても見せられないので確かめず、次に開いたときに押す
   */
  /** いまの記録をすぐ書く。固まるおそれのある操作（マイク）の前に呼ぶ */
  flush() {
    this.#write(false);
  }
```

`flush()` は呼び出し元なし。上の JSDoc は `#write` の説明で、`flush` のせいで宙に浮いている。

古いコメント

- `src/lib/games/pet-house/Tools.svelte:25` — `/** 声で呼ぶボタンが芸や呼ぶを頼む先 */`（`session` prop は `:52,60,65` で
  おふろ・投げたおもちゃに使っているので、prop は残し、説明だけ直す）
- `src/lib/games/pet-house/training.ts:7` — 「なでるか声でほめる」
- `src/lib/games/pet-house/activity.ts:32` — 「しつけのボタンと声の芸（session.trick）」

`src/lib/games/pet-house/behavior.test.ts:500-613` — `describe('声の頼みごと', ...)`。中の 7 本はどれも上の死んだ命令
（`sleep`・`wake` の `stretch`・`stay`・`scold`・`play`・`face`）か `naughty` を使う。import の `naughty`（`:6`）も消す。

CLAUDE.md のずれ

- `:13` — `pnpm test:run                 # vitest 一括実行（unit プロジェクト、happy-dom）。pnpm test で watch`。
  実際は `vite.config.ts` の `unit`（node）と `dom`（happy-dom）の 2 project
- `:38` — 「bomb-relay と hockey は…はじく速さは `fingers.ts` の `velocity()` で出す」。`velocity()` を使うのは
  `bomb-relay/BombRelay.svelte` と `pet-house/touch.ts`。hockey は `engine.ts` の `updateMallets` が前のフレームの
  位置から速さを出す
- 「更新」の節の「`/about` は更新（`AppUpdate.svelte`）・アプリの状態・3D の画質（`GraphicsSetting.svelte`）・データの扱いの
  カードを縦に並べる」。実際はその下にバックアップのカード（`Backup.svelte`）もある（`src/routes/about/+page.svelte:68-71`）

## Commands you will need

| Purpose             | Command                                        | Expected on success  |
| ------------------- | ---------------------------------------------- | -------------------- |
| Install（worktree） | `pnpm install --frozen-lockfile`               | exit 0               |
| 対象テスト          | `pnpm exec vitest run src/lib/games/pet-house` | all pass             |
| 全テスト            | `pnpm test:run`                                | all pass             |
| 型                  | `pnpm check`                                   | 0 errors, 0 warnings |
| lint                | `pnpm lint`                                    | exit 0               |

## Scope

In scope は Drift check に並べた 9 ファイル。

Out of scope は次のとおり。

- `behavior.ts` のほかの整理（`runMode` の大きな switch、`wrap`/`turn` の重複など）
- `Command` の `call` の `then: 'sleep'`（ベッドで寝かせる、いまの機能）と、`BehaviorEvent` の `sleep`/`wake`
- 自然に起きるときののび（`STRETCH` と `:1274`）
- CLAUDE.md の上の 3 か所以外（pet-house の長い段落の書き直しなど）

## Git workflow

- 2 コミットに分ける。`Drop the leftovers of the pet voice commands` と `Fix three stale lines in CLAUDE.md`。
  末尾に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- push しない

## Steps

### Step 0: 計画 027 のブランチを取り込む

レビュー担当が渡す 027 のブランチ名で `git merge --no-edit <027 のブランチ>` を実行する。

**Verify**: `grep -n "#full" src/lib/games/pet-house/session.svelte.ts` が 1 行以上出る

### Step 1: 死んだテストを先に消す

`behavior.test.ts` の `describe('声の頼みごと', ...)` のブロック全体と、import の `naughty` を消す。

**Verify**: `pnpm exec vitest run src/lib/games/pet-house/behavior.test.ts` → all pass（本数は 7 減る）

### Step 2: 命令と状態を消す

- `Command` から `sleep`・`stay`・`scold`・`play`・`face` を消し、`wake` を `{ type: 'wake' }` にする
- `apply()` から `stretch` の分岐・`scold`・`face`/`sleep`/`stay`/`play` の分岐と、`stay`/`bedtime`/`romp` への代入を消す。
  `wake` は `wakeUp(a); return;` だけになる。`stroke`/`brush` の条件から `a.stay ||` を消し、コメントの「「まて」のあいだは
  なでても待つ」も消す
- `scolded()` と `naughty` を消す
- `Actor` の `bedtime`・`stay`・`romp` と、その初期値・読み書き（上の一覧の `:789`・`:870`・`:1100`・`:1172-1177`・
  `:1217`・`:1221`・`:1450`、`social.ts:154`）を消す。`:789` は `s.energy < SLEEPY + 15 * (world.night ?? 0)` だけにする。
  `:1217` は `a.romp > 0 ||` を消した式、`:1221` と `:1450` は行ごと消す
- `apply()` の中で使われなくなった import や定数があれば消す（`STRETCH` は `:1274` が使うので残る）

**Verify**: `grep -nE "bedtime|romp|\.stay\b|scolded|naughty|stretch\?" src/lib/games/pet-house/*.ts` → 0 行
（`'stretch'` の action 名や `STRETCH` 定数は出てよい。`grep -n "STRETCH" src/lib/games/pet-house/behavior.ts` は 2 行）。
`pnpm check` → 0 errors。`pnpm exec vitest run src/lib/games/pet-house` → all pass

### Step 3: 呼ばれないメソッドとコメントを直す

- `toys.ts` の `toss()` を消す（使われなくなった import や `kindOf` があれば、ほかで使っていないか確かめてから消す）
- `session.svelte.ts` の `flush()` と、その JSDoc を消し、`#write` の JSDoc（「条件の多くは…次に開いたときに押す」）を
  `#write` の直前に残す
- `Tools.svelte:25` を `/** おふろへ行く・投げたおもちゃを待つのに使う */` のように今の用途にする
- `training.ts:7` を「ボタンでさせて、なでてほめる。」に、`activity.ts:32` の「声の芸」を消して「しつけのボタン（session.trick）」にする

**Verify**: `grep -rn "声で\|声の「\|マイク" src/lib/games/pet-house --include=*.ts --include=*.svelte | grep -v "\.test\."` → 0 行
（鳴き声・歓声など音の説明の「声」は出てよいが、この grep の形では出ない）。`pnpm check` → 0 errors

### Step 4: CLAUDE.md の 3 か所を直す

- `:13` のコメントを `# vitest 一括実行（node の unit と happy-dom の dom の 2 project）。pnpm test で watch` にする
  （行の桁揃えは前後の行に合わせる）
- `:38` の「はじく速さは `fingers.ts` の `velocity()` で出す」を「bomb-relay のはじく速さは `fingers.ts` の `velocity()`、
  hockey のマレットの速さは `engine.ts` の `updateMallets` が前のフレームの位置から出す」にする
- 「更新」の節の `/about` の説明のカードの並びに「バックアップ（`Backup.svelte`）」を最後に足す

**Verify**: `grep -n "2 project" CLAUDE.md` → 1 行。`grep -n "updateMallets" CLAUDE.md` → 1 行。
`grep -n "Backup.svelte" CLAUDE.md` → 1 行以上。`pnpm lint` → exit 0

### Step 5: 全体の確認

**Verify**: `pnpm test:run` → all pass（ノミのテストが乱数でまれに落ちるのは既知。落ちたらもう一度流す）。
`pnpm check` → 0 errors。`pnpm lint` → exit 0。`pnpm vitals --diff` → exit 0

## Test plan

新しいテストは書かない。消すのは届かない分岐だけで、残る振る舞いは `behavior.test.ts` と `session.svelte.test.ts` の
既存のテストが押さえている。

## Done criteria

- [ ] Step 2 と Step 3 の grep が 0 行
- [ ] `pnpm test:run` / `pnpm check` / `pnpm lint` / `pnpm vitals --diff` が通る
- [ ] `git diff --name-only 4c06cf0` が In scope のファイル（+ 先に入った計画のファイル、`plans/README.md`）だけ

## STOP conditions

- 消そうとした命令・状態を、上の一覧にない本番のコードが使っていた（`pnpm check` の型エラーで分かる）
- 死んだテスト以外の既存テストが落ちる（届く分岐を消した可能性）
- `session.svelte.ts` に計画 027 の変更（`#full`）が入っていない（027 のあとに実行する前提）

## Maintenance notes

- 声の機能を戻す話が出たら、2026-09-26 にマイクを許可した直後に固まって記録が全部消えた件を先に確かめる
- `behavior.ts` の `Command` は画面から来る頼みごとの一覧。足すときは、どの画面から送るかを JSDoc に書く
