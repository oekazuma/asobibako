# Plan 044: バックアップの赤い注意書きと「？」の印をなくし、「この端末の控え」を分かる言葉にする

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat bc0c678..HEAD -- src/lib/components/Backup.svelte src/lib/components/MirrorRestore.svelte src/lib/components/MirrorRestore.svelte.test.ts src/lib/backup.ts src/lib/backup.test.ts src/routes/+page.svelte src/routes/page.svelte.test.ts src/routes/about CLAUDE.md`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                            |
| ---------- | --------------------------------------------- |
| Priority   | P1                                            |
| Effort     | S                                             |
| Risk       | LOW（文言と表示を減らすだけ。保存は変えない） |
| Depends on | none                                          |
| Category   | direction                                     |
| Planned at | commit `bc0c678`, 2026-09-26                  |

## Why this matters

利用者（保護者）から 3 つの要望があった。

1. アプリについての「バックアップ」の赤い注意書き（「iPad の不具合で記録が消えることがあるので、週に 1 回ほど書き出して…」）は要らない
2. 書き出していないときに一覧の右上の「？」に付く印（7 日ごとに書き出しを勧める）は要らない
3. 「この端末の控え」のカードの日本語が分かりにくい。「控え」という言葉をやめ、「自動バックアップ」と呼ぶ

読み込みの確認に出る「いまこの端末にある記録はすべて置き換わります。元に戻せません。」（赤）は、押し間違いで記録を消さない
ための注意なので残す。新版があるときの「？」の印も残す。

## Current state

`src/lib/components/Backup.svelte:59-64`

```svelte
<div class="backup">
  <p>到達したレベルなどの記録を 1 つのファイルに書き出せます。端末を替えるときや、データを消す前に。</p>
  <p class:warn={!lastAt}>
    {lastAt ? `最後に書き出した日: ${lastAt}` : 'まだ書き出していません。'}
    iPad の不具合で記録が消えることがあるので、週に 1 回ほど書き出して「ファイル」などに残しておくと戻せます。
  </p>
```

CSS の `.warn, .err { color: var(--p2-deep); }`（`:120` あたり）。

`src/routes/+page.svelte` — `import { backupDue } from '$lib/backup';`、`let due = $state(false);`、
`help` の文言（`updated.current ? 'アプリについて（あたらしいバージョンがあります）' : due ? 'アプリについて（記録の書き出しをおすすめします）' : 'アプリについて'`）、
`onMount` の `due = backupDue();`、`{#if updated.current || due}<span class="dot"></span>{/if}`。

`src/lib/backup.ts` — `BACKUP_AT_KEY`・`markBackedUp()`・`backedUpAt()`（書き出した日を覚えて見せる。残す）と、
`DUE_DAYS = 7` と `backupDue(now)`（印の判定。なくす）。`backup.test.ts` に `backupDue` のテストが 2 か所ある
（「記録があるのに書き出していないか、最後の書き出しが 7 日より前なら書き出しを勧める」と、「最近のゲーム・タブ・ミュートだけなら
記録なしとみなす」の中の `expect(backupDue('2026-09-26')).toBe(false);` の 1 行）。

`src/lib/components/MirrorRestore.svelte:23-45`（文言）

```svelte
{#if loading}
  <p>控えを読んでいます…</p>
{:else if !sum}
  <p>この端末にはまだ控えがありません。遊んだ記録は、画面を閉じるときなどに自動で控えます。</p>
{:else}
  <p>
    <b>{sum.at}</b> 時点の控えがあります（{sum.games} 本のゲームの記録・{sum.keys} 件）。記録が消えて自動で戻らなかったときは、ここから戻せます。
  </p>
  <div class="row">
    <button class="pill" onclick={() => (pending = found)}><Icon name="upload" size="20px" />控えから戻す</button>
  </div>
{/if}
...
<BackupConfirm {pending} from="控え" ... />
```

`src/routes/about/+page.svelte:63-66` は `<h2>この端末の控え</h2><MirrorRestore />`。`src/routes/about/page.svelte.test.ts:20` が
見出しの一覧に `'この端末の控え'` を持つ。`src/lib/components/MirrorRestore.svelte.test.ts` が文言（「まだ控えがありません」
「に控え）」など）を確かめている。

CLAUDE.md に、「最後の書き出しから 7 日を過ぎると一覧の「？」に印を付けて書き出しを勧める（`asobibako:backup-at`）」と、
アプリについての説明の「この端末の控え（`MirrorRestore.svelte`。…）」がある。

## Commands you will need

| Purpose             | Command                                                                     | Expected on success  |
| ------------------- | --------------------------------------------------------------------------- | -------------------- |
| Install（worktree） | `pnpm install --frozen-lockfile`                                            | exit 0               |
| 対象テスト          | `pnpm exec vitest run src/lib/backup.test.ts src/lib/components src/routes` | all pass             |
| 全テスト            | `pnpm test:run`                                                             | all pass             |
| 型                  | `pnpm check`                                                                | 0 errors, 0 warnings |
| lint                | `pnpm lint`                                                                 | exit 0               |
| vitals              | `pnpm vitals --diff`                                                        | exit 0               |

## Scope

In scope は Drift check に並べたファイル（`src/routes/about` は `+page.svelte` と `page.svelte.test.ts`）。

Out of scope は、`BackupConfirm.svelte`（読み込みの確認の赤い注意は残す）、保存の仕組み（`mirror.ts`、`BACKUP_AT_KEY`）、
新版の印。

## Git workflow

- コミット 1〜3 つ。メッセージは英語の命令形 1 行（例 `Drop the backup nudge and rename the device mirror to 自動バックアップ`）。
  末尾に Co-Authored-By を 1 行
- push しない。git stash は使わない

## Steps

### Step 1: バックアップの赤い注意書きを消す

`Backup.svelte` の 2 つめの `<p class:warn={!lastAt}>…</p>` を、`{lastAt ? … : 'まだ書き出していません。'}` だけを中身に持つ `<p>`（「最後に書き出した日: 」と日付を並べる今の書き方のまま） だけにする
（「iPad の不具合で…」の文と、赤くする `class:warn` を消す）。`.warn` がほかで使われなくなったら CSS からも消す（`.err` は残す）。

**Verify**: `grep -n "iPad の不具合\|class:warn" src/lib/components/Backup.svelte` → 0 行。`pnpm check` → 0 errors

### Step 2: 「？」の書き出しの印をなくす

- `+page.svelte` から `backupDue` の import・`due`・`onMount` の `due = backupDue();` を消す。`help` は
  `updated.current ? 'アプリについて（あたらしいバージョンがあります）' : 'アプリについて'`、印は `{#if updated.current}` にする
- `backup.ts` から `DUE_DAYS` と `backupDue` を消す（`BACKUP_AT_KEY`・`markBackedUp`・`backedUpAt` は残す）
- `backup.test.ts` の `backupDue` のテスト 1 本を消し、「最近のゲーム・タブ・ミュートだけなら記録なしとみなす」の中の
  `backupDue` の 1 行を消す（そのテストのほかの期待は変えない）。import からも消す

**Verify**: `grep -rn "backupDue\|DUE_DAYS" src` → 0 行。`pnpm exec vitest run src/lib/backup.test.ts src/routes` → all pass

### Step 3: 「この端末の控え」を「自動バックアップ」にする

`MirrorRestore.svelte` の文言を次にする（`sum.keys` の件数は出さない）。

- 読んでいるあいだ「自動バックアップを確かめています…」
- 無いとき「まだ自動バックアップはありません。遊んだ記録は、アプリを閉じるときなどに、この端末の中へ自動で保存されます。」
- あるとき「<b>{sum.at}</b> に自動で保存した記録があります（{sum.games} 本のゲーム）。記録が消えてしまったときは、ここから元に戻せます。」
- ボタン「この記録に戻す」
- 確認のフォームへは `from="自動で保存"`（確認の文が「（2026-09-26 に自動で保存）」になる）

`src/routes/about/+page.svelte` の見出しを「自動バックアップ」にし、`page.svelte.test.ts` の見出しの一覧も合わせる。
`MirrorRestore.svelte.test.ts` の文言の期待（「まだ控えがありません」「控えから戻す」「に控え）」など）と `describe` の名前を、
新しい文言に合わせて直す（確かめている中身は変えない）。

**Verify**: `grep -rn "控え" src/lib/components/MirrorRestore.svelte src/routes/about/+page.svelte` → 0 行。
`pnpm exec vitest run src/lib/components/MirrorRestore.svelte.test.ts src/routes` → all pass

### Step 4: CLAUDE.md を今の仕様にする

- 「iPad ごと記録を失ったときのために、最後の書き出しから 7 日を過ぎると一覧の「？」に印を付けて書き出しを勧める（`asobibako:backup-at`）」を、
  「書き出した日を `asobibako:backup-at` に覚え、アプリについてで見せる」のように今の仕様にする
- アプリについてのカードの並びの「この端末の控え（`MirrorRestore.svelte`。…）」を「自動バックアップ（`MirrorRestore.svelte`。…）」にする

経緯は書かない。

**Verify**: `grep -n "7 日\|この端末の控え" CLAUDE.md` → 0 行。`pnpm lint` → exit 0

### Step 5: 全体の確認

**Verify**: `pnpm test:run` → all pass。`pnpm check` → 0 errors。`pnpm lint` → exit 0。`pnpm vitals --diff` → exit 0

## Test plan

既存のテストの文言を直すだけ。新しいテストは書かない（表示を減らす変更）。

## Done criteria

- [ ] Step 1〜4 の grep がすべて 0 行
- [ ] `pnpm test:run` / `pnpm check` / `pnpm lint` / `pnpm vitals --diff` が通る
- [ ] 触ったファイルが In scope のものだけ（+ `plans/README.md`）

## STOP conditions

- 抜粋と今のコードが違う
- `backupDue` をほかでも使っていた

## Maintenance notes

- 画面では「自動バックアップ」と呼ぶが、コードの名前（`mirror.ts`、`MirrorRestore`）はそのまま。保存名も `asobibako-mirror` のまま
