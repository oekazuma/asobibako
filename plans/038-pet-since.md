# Plan 038: ペットに「うちに来た日」を持たせ、何日めかを札に出す

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 4f6f07a..HEAD -- src/lib/games/pet-house/engine.ts src/lib/games/pet-house/engine.test.ts src/lib/games/pet-house/PetCard.svelte`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                         |
| ---------- | ---------------------------------------------------------- |
| Priority   | P2                                                         |
| Effort     | S                                                          |
| Risk       | LOW（任意の項目を 1 つ足すだけ。古い保存は読み込みで補う） |
| Depends on | none                                                       |
| Category   | direction                                                  |
| Planned at | commit `4f6f07a`, 2026-09-26                               |

## Why this matters

わんにゃんハウスは子どもが毎日遊んでいる。利用者が以前に挙げた次の候補の 1 つが「誕生日の記録」だった。
ペットに「うちに来た日」を持たせ、ペットの札に「うちに きて N にちめ」を出す。毎日開くたびに数字が増え、続けて遊ぶ
楽しみになる。すでにいるペットは来た日を持っていないので、この版で初めて開いた日を来た日にする。

## Current state

`src/lib/games/pet-house/engine.ts`

- `:19-30` `export interface Pet { id; breed; name; stats; love; tricks; accessory; best? }`
- `:120-123` `export function day(ms: number): string`（端末の日付の `YYYY-MM-DD`）
- `:159-183` `function repairPet(raw: unknown, taken: Set<string>): Pet | null` — 保存から読んだペットの形を直す。
  足りない項目は既定値で補う（例 `name: typeof raw.name === 'string' && raw.name ? raw.name.slice(0, 12) : 'ポチ'`）
- `:186-232` `loadSave()` が `const now = Date.now();` を持ち、`raw.pets` を `repairPet(p, taken)` で直す
- `:318-337` `adopt(save, breed, name)` が新しい `Pet` を作る（`{ id, breed, name, stats, love: 0, tricks: {}, accessory: null }`）

`src/lib/games/pet-house/PetCard.svelte:21-24`（184 行。画面の上の札）

```svelte
  <div class="top">
    <span class="face" style:background={breed.color}><Icon name={breed.kind} size="80%" /></span>
    <span class="name">{pet.name}</span>
    <span class="breed">{breed.name}</span>
```

画面の文は子ども向けのひらがなと分かち書き。テストは `src/lib/games/pet-house/engine.test.ts`（`withPet()` など小さな作り手と、
`vi.stubGlobal('localStorage', ...)` の偽物の見本がある）。

## Commands you will need

| Purpose             | Command                                                       | Expected on success  |
| ------------------- | ------------------------------------------------------------- | -------------------- |
| Install（worktree） | `pnpm install --frozen-lockfile`                              | exit 0               |
| 対象テスト          | `pnpm exec vitest run src/lib/games/pet-house/engine.test.ts` | all pass             |
| 全テスト            | `pnpm test:run`                                               | all pass             |
| 型                  | `pnpm check`                                                  | 0 errors, 0 warnings |
| lint                | `pnpm lint`                                                   | exit 0               |

## Scope

In scope は `src/lib/games/pet-house/engine.ts`、`src/lib/games/pet-house/engine.test.ts`、
`src/lib/games/pet-house/PetCard.svelte`、`CLAUDE.md`（わんにゃんハウスの段落に 1 文）。

Out of scope は、記念日のお祝いの演出・スタンプ・ペットの一覧（`Pets.svelte`）。

## Git workflow

- コミット 1〜2 つ。メッセージは英語の命令形 1 行（例 `Remember the day each pet came home`）。末尾に Co-Authored-By を 1 行
- push しない。git stash は使わない

## Steps

### Step 1: 来た日を持たせる

- `Pet` に `/** うちに来た日（YYYY-MM-DD、端末の日付） */ since: string;` を足す
- `adopt` は `since: day(Date.now())` を入れる
- `repairPet(raw, taken, today: string)` にし、`since` が `/^\d{4}-\d{2}-\d{2}$/` に合う文字列ならそれ、でなければ `today`。
  `loadSave` からは `day(now)` を渡す
- `export function daysTogether(pet: Pet, now: number): number` を足す。`Date.parse(day(now))` と `Date.parse(pet.since)` の差を
  `86_400_000` で割って四捨五入し、1 を足す（来た日が 1 にちめ）。どちらも UTC の 0 時として読まれるので、差はちょうど日数になる

**Verify**: `pnpm check` → 0 errors（`Pet` を作っているほかの場所、たとえばひろばの `#fill` やテストの作り手が型で落ちたら、
そこに `since` を足す。ひろばの子は `since: day(Date.now())` でよい）

### Step 2: 札に出す

`PetCard.svelte` の `<span class="breed">{breed.name}</span>` を `<span class="breed">{breed.name}・うちに きて {daysTogether(pet, Date.now())} にちめ</span>` にする。
日付は開いているあいだに変わってもかまわない（札は保存が変わるたびに描き直される）。札の幅に収まらないときは
`.breed` の CSS に `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;` を足す（既にあれば不要）。

**Verify**: `wc -l src/lib/games/pet-house/PetCard.svelte` → 200 未満。`pnpm check` → 0 errors

### Step 3: テストを書く

`engine.test.ts` に 3 本。

1. `adopt` したペットの `since` が今日（`day(Date.now())`）
2. `since` の無い古い保存を `loadSave()` すると `since` が今日になり、壊れた `since`（`'x'`）も今日になる。正しい `since` はそのまま残る
3. `daysTogether` は来た日に 1、3 日後に 4（`since` を 3 日前の日付にして確かめる）

**Verify**: `pnpm exec vitest run src/lib/games/pet-house/engine.test.ts` → all pass（3 本増える）

### Step 4: CLAUDE.md に今の仕様を 1 文足す

わんにゃんハウスの段落の保存の説明のそばに、「ペットは来た日（`since`）を持ち、札に『うちに きて N にちめ』を出す。
来た日の無い古い保存は、読み込んだ日を来た日にする」を足す。経緯は書かない。

**Verify**: `grep -c "since" CLAUDE.md` → 1 以上

### Step 5: 全体の確認

**Verify**: `pnpm test:run` → all pass。`pnpm check` → 0 errors。`pnpm lint` → exit 0。`pnpm vitals --diff` → exit 0

## Test plan

`engine.test.ts` に 3 本（Step 3）。

## Done criteria

- [ ] `grep -n "since" src/lib/games/pet-house/engine.ts` が型・adopt・repairPet で出る
- [ ] `grep -n "daysTogether" src/lib/games/pet-house/PetCard.svelte` が 1 行
- [ ] `pnpm test:run` / `pnpm check` / `pnpm lint` / `pnpm vitals --diff` が通る
- [ ] `git diff --name-only 4f6f07a` が In scope のファイル（+ 型のために `since` を足したファイル）だけ（+ `plans/README.md`）

## STOP conditions

- 抜粋と今のコードが違う
- `Pet` を作る場所が多く、`since` を足すのに In scope 外のファイルを 3 つ以上触る必要がある（`since` を任意の項目にするかを報告して聞く）

## Maintenance notes

- 記念日のお祝い（30 にちめ、1 ねんめ など）を足すなら `daysTogether` を使う
- バックアップから別の端末へ移しても来た日は保存の中にあるので変わらない
