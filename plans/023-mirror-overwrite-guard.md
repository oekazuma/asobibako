# Plan 023: 記録の控え（IndexedDB）を、読み切れていない起動で上書きしない

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**。
> `git diff --stat 4c06cf0..HEAD -- src/lib/mirror.ts src/lib/mirror.test.ts src/lib/backup.ts src/lib/backup.test.ts src/lib/recent.ts src/lib/audio.svelte.ts CLAUDE.md`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                                        |
| ---------- | ------------------------------------------------------------------------- |
| Priority   | P1                                                                        |
| Effort     | M                                                                         |
| Risk       | MED（記録の消失事故への対策そのものを触る。テストで経路を固めてから直す） |
| Depends on | none                                                                      |
| Category   | bug                                                                       |
| Planned at | commit `4c06cf0`, 2026-09-26                                              |

## Why this matters

2026-09-26、iPad のホーム画面アプリで localStorage が丸ごと消え、子どもの作品を含む全ゲームの記録を失った。
対策として `src/lib/mirror.ts` が記録を IndexedDB（`asobibako-mirror` の `latest` 1 件だけ）へ写し、
起動時に記録が空なら控えから戻す。ところが次の筋書きで、アプリ自身が唯一の控えを消す。

1. localStorage が消えた状態で起動する。IndexedDB を開くのが遅く、`restoreIfEmpty` は 1.5 秒で見切って `false` を返す
2. 子どもがゲームを開く → `asobibako:recent` が書かれる（タブを押せば `asobibako:menu-tab`、ミュートなら `asobibako:muted`）
3. `hasRecords()` が true になり、次の `snapshot()`（ページ移動・30 秒ごと・画面が隠れるとき）が
   `latest` を「最近のゲーム」1 件だけの JSON で上書きする
4. 次の起動からは記録があるので、復元はもう試されない

この計画のあと、(a) 控えを実際に読み終えるまで `snapshot` は書かない、(b) 見切ったあと遅れて控えが読めたら戻して
読み直す、(c) 読み切れなかった起動のあとは、次の起動でも記録の有無にかかわらず戻しにいく、(d) 画面の覚えごと
（最近のゲーム・タブ・ミュート）は「記録」に数えない、(e) IndexedDB の接続が切れたら開き直す、が成り立つ。
あわせて、バックアップの読み込みが「書き出しから除くキー」を 1 つ含むだけでファイル全体を拒む点を直す
（除くキーを将来足したとき、それ以前の控えとファイルがすべて読めなくなるため）。

## Current state

- `src/lib/mirror.ts` — 控えの読み書き（全 96 行）。要点。

```ts
// src/lib/mirror.ts:16-28
let opening: Promise<IDBDatabase> | undefined;

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  // 失敗した open を覚えたままにせず、次は開きなおす
  opening.catch(() => (opening = undefined));
  return opening;
}
```

```ts
// src/lib/mirror.ts:50-78
let last = '';

/** いまの記録を控えに写す。記録が空のときは写さない（空で控えを上書きすると、戻す元がなくなる） */
export async function snapshot(version: string, store = idb): Promise<void> {
  try {
    if (!hasRecords()) return;
    const text = exportAll(version);
    if (text === last) return;
    await store.set(text);
    last = text;
  } catch {
    // 控えを残せなくても遊ぶのには困らない
  }
}

/** 記録が 1 つもなく控えがあれば、控えから全部戻す。戻したら true */
export async function restoreIfEmpty(store = idb, wait = RESTORE_WAIT): Promise<boolean> {
  try {
    if (hasRecords()) return false;
    const text = await Promise.race([
      store.get(),
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), wait))
    ]);
    return !!text && importAll(parseBackup(text));
  } catch {
    return false;
  }
}
```

`idb.get` / `idb.set`（`:30-48`）は `await open()` のあと `db.transaction(...)` を呼ぶ。接続が閉じられていると
`transaction` が投げるが、`opening` は成功した接続を覚えたままなので、以後ずっと失敗する。

- `src/lib/backup.ts` — 書き出し・読み込み。要点。

```ts
// src/lib/backup.ts:9-27
const PREFIX = 'asobibako:';
// 端末ごとの控え。持ち運ぶと別の端末のエラーやゲートの回数、端末の力に合わせた画質が混ざる
const EXCLUDED = new Set([LAST_ERROR_KEY, GATE_KEY, GRAPHICS_KEY]);
...
export const BACKUP_AT_KEY = 'asobibako:backup-at';
...
const backedUp = (k: string) => k.startsWith(PREFIX) && !EXCLUDED.has(k);
const keys = () => Object.keys(localStorage).filter(backedUp);

/** 書き出して残す記録が 1 つでもあるか */
export const hasRecords = () => keys().some((k) => k !== BACKUP_AT_KEY);
```

```ts
// src/lib/backup.ts:72-82
export function parseBackup(text: string): Backup {
  if (text.length > MAX_CHARS) throw new Error('backup');
  const v: unknown = JSON.parse(text);
  if (!isObject(v) || v.app !== 'asobibako' || !isObject(v.data)) throw new Error('backup');
  if (typeof v.version !== 'string' || typeof v.at !== 'string') throw new Error('backup');
  const entries = Object.entries(v.data);
  if (entries.length > MAX_KEYS) throw new Error('backup');
  for (const [k, val] of entries) {
    if (!backedUp(k) || typeof val !== 'string') throw new Error('backup');
  }
  return v as Backup;
}
```

`hasRecords` を使うのは `mirror.ts:55,68` と `backupDue`（`backup.ts:49`、一覧の「？」に印を付ける判定）。

- 画面の覚えごとを書く場所（キー名はそれぞれのファイルの中の定数で、いまは export していない）。
  - `src/lib/recent.ts:3-4` — `const RECENT = 'asobibako:recent';`、`const TAB = 'asobibako:menu-tab';`
  - `src/lib/audio.svelte.ts:1` — `const KEY = 'asobibako:muted';`
- 呼び出し側: `src/hooks.client.ts` の `init` が `migrateStorage()` → `await restoreIfEmpty()`。
  `src/routes/+layout.svelte` が `watch(version)`（mount 時と 30 秒ごと・hidden・pagehide に `snapshot`）と
  `beforeNavigate(() => void snapshot(version))`。この 2 ファイルは変えない。
- 既存テスト: `src/lib/mirror.test.ts`（3 本。`memory()` の Map 風 store を使う）、`src/lib/backup.test.ts`。
  `backup.test.ts:60-64` は EXCLUDED のキーを含むファイルが throw することを期待している（この計画で仕様を変える）。
  `backup.test.ts:68-72` の「大きさが常識外」は `'a'.repeat(1024 * 1024 + 1)` を渡しており、JSON.parse の失敗で
  throw しているだけで、16MB の `MAX_CHARS` を検査していない。
- 規約: キー名の定数は持ち主のファイルが export する（例 `gate.svelte.ts` の `export const GATE_KEY`、
  `backup.ts` が import）。コメントは「コードから復元できない WHY」だけを日本語で書く（WHAT・変更履歴・計画番号は書かない）。
  localStorage に触る処理は try/catch で包み、使えない環境でも投げない。
- location の差し替え: `src/lib/components/Backup.svelte.test.ts` は `vi.stubGlobal('location', { ...location, reload })`
  で `location.reload()` を見張っている。同じやり方を使う。

## Commands you will need

| Purpose             | Command                                                              | Expected on success  |
| ------------------- | -------------------------------------------------------------------- | -------------------- |
| Install（worktree） | `pnpm install --frozen-lockfile`                                     | exit 0               |
| 対象テスト          | `pnpm exec vitest run src/lib/mirror.test.ts src/lib/backup.test.ts` | all pass             |
| 全テスト            | `pnpm test:run`                                                      | all pass             |
| 型                  | `pnpm check`                                                         | 0 errors, 0 warnings |
| lint                | `pnpm lint`                                                          | exit 0               |

## Scope

**In scope**。

- `src/lib/mirror.ts`
- `src/lib/mirror.test.ts`
- `src/lib/backup.ts`
- `src/lib/backup.test.ts`
- `src/lib/recent.ts`（キー名の定数を export するだけ）
- `src/lib/audio.svelte.ts`（キー名の定数を export するだけ）
- `CLAUDE.md`（控えの説明の 1 文だけ）

**Out of scope**（触らない）。

- `src/hooks.client.ts`、`src/routes/+layout.svelte` — 呼び出し方は変えない
- `src/lib/components/Backup.svelte` — 読み込み画面。別の計画（032）が分割する
- 控えを何世代も持つこと — 戻すときに「どれが正しいか」を決める問題が出るので、この計画ではやらない
- 各ゲームの保存（`pet-house/engine.ts`、`doodle-worm/stock.ts`）— 別の計画（027）

## Git workflow

- 作業ブランチの上で、ステップごとにコミットしてよい。メッセージは英語の命令形 1 行（例: `Keep the IndexedDB mirror until it has been read`）。
  末尾に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` を付ける
- push しない。PR も作らない

## Steps

### Step 1: 画面の覚えごとのキー名を export する

- `src/lib/recent.ts`: `const RECENT` / `const TAB` を `export const RECENT_KEY = 'asobibako:recent';` /
  `export const MENU_TAB_KEY = 'asobibako:menu-tab';` に改名して export し、ファイル内の参照を直す
- `src/lib/audio.svelte.ts`: `const KEY` を `export const MUTED_KEY = 'asobibako:muted';` にし、参照を直す

**Verify**: `pnpm exec vitest run src/lib/recent.test.ts` → pass。`grep -n "RECENT_KEY\|MENU_TAB_KEY" src/lib/recent.ts` と
`grep -n "MUTED_KEY" src/lib/audio.svelte.ts` が定義と参照を出す

### Step 2: backup.ts — 覚えごとを記録に数えない・除くキーは読み飛ばす・控え待ちの印

`src/lib/backup.ts` を次の形にする（コメントは WHY だけ）。

```ts
import { MUTED_KEY } from './audio.svelte';
import { MENU_TAB_KEY, RECENT_KEY } from './recent';

/** 前の起動で控えを読み切れなかった印。端末ごとの状態なので書き出さない */
export const RESTORE_PENDING_KEY = 'asobibako:restore-pending';
const EXCLUDED = new Set([LAST_ERROR_KEY, GATE_KEY, GRAPHICS_KEY, RESTORE_PENDING_KEY]);
// 書き出しには入れるが「記録がある」とは数えない。ゲームを開くだけで書かれるので、これで記録ありとみなすと、
// 消えたあとの起動で控えから戻さず、空に近い中身で控えを上書きしてしまう
const NOT_RECORDS = new Set([BACKUP_AT_KEY, RECENT_KEY, MENU_TAB_KEY, MUTED_KEY]);

export const hasRecords = () => keys().some((k) => !NOT_RECORDS.has(k));
```

（`BACKUP_AT_KEY` の宣言が `NOT_RECORDS` より前に来るよう並べる。）

`parseBackup` は、接頭辞が違うキーと値が文字列でないものは今までどおり throw し、`EXCLUDED` のキーは
throw せず読み飛ばした `data` を返す。

```ts
const data: Record<string, string> = {};
for (const [k, val] of entries) {
  if (!k.startsWith(PREFIX) || typeof val !== 'string') throw new Error('backup');
  // 端末ごとの控えは持ち込まない。拒むと、除くキーを足す前に書き出したファイルや控えが読めなくなる
  if (!EXCLUDED.has(k)) data[k] = val;
}
return { app: 'asobibako', version: v.version, at: v.at, data };
```

**Verify**: `pnpm exec tsc --noEmit -p tsconfig.json` は SvelteKit の型生成が要るので使わず、`pnpm check` → 0 errors。
この時点で `backup.test.ts` の「形が違うファイルは受け付けない」は落ちる（Step 3 で直す）。それ以外は pass すること。
`pnpm exec vitest run src/lib/backup.test.ts` → 失敗は「形が違うファイルは受け付けない」の 1 本だけ

### Step 3: backup.test.ts を新しい仕様に合わせ、足りない検査を足す

- 「形が違うファイルは受け付けない」: `asobibako:gate` / `asobibako:last-error` / `asobibako:graphics` の 3 行を
  「受け付けて、その 3 キーは data に入らない」テストへ移す（新しい it: 「端末ごとの控えのキーは読み飛ばす」）。
  `evil`（接頭辞違い）と `'asobibako:muted': 1`（文字列でない）は throw のまま残す
- 「キー数・大きさが常識外」: `'a'.repeat(...)` の行を、形の正しい 16MB 超のファイル
  `file({ 'asobibako:x': 'x'.repeat(16 * 1024 * 1024) })` が throw することに置き換える
  （`MAX_CHARS` の判定を消すと落ちることを、手で一度確かめる: 判定行をコメントアウト → テストが落ちる → 戻す）
- 新しい it「最近のゲーム・タブ・ミュートだけなら記録なしとみなす」: その 3 キーだけ入れて `hasRecords()` が false、
  `asobibako:reached:maze` を足すと true。`backupDue('2026-09-26')` も 3 キーだけなら false

**Verify**: `pnpm exec vitest run src/lib/backup.test.ts` → all pass

### Step 4: mirror.ts — 読み終えるまで書かない・遅れて届いたら戻す・接続が切れたら開き直す

`src/lib/mirror.ts` を次のように変える（形の見本。細部は既存の書き方に合わせる）。

```ts
import { exportAll, hasRecords, importAll, parseBackup, RESTORE_PENDING_KEY } from './backup';

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => {
      const db = req.result;
      // iOS は裏に回ったあいだに接続を閉じることがある。覚えたままだと以後の控えがずっと失敗する
      db.onclose = () => (opening = undefined);
      db.onversionchange = () => {
        db.close();
        opening = undefined;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
  ...
}
```

`idb.get` / `idb.set` は、`db.transaction(...)` が投げたとき（Promise の executor 内で投げれば reject になる）に
`opening = undefined` にしてから reject する（`.catch((e) => { opening = undefined; throw e; })` で包む）。

```ts
/** 控えを読み終えたか（控えが無かった・壊れていた場合も含む）。読めるまでは、控えを今の記録で上書きしない */
let verified = false;

export async function snapshot(version: string, store = idb): Promise<void> {
  try {
    if (!verified || !hasRecords()) return;
    ... 以下は今と同じ
  }
}

export async function restoreIfEmpty(store = idb, wait = RESTORE_WAIT): Promise<boolean> {
  try {
    if (hasRecords() && localStorage.getItem(RESTORE_PENDING_KEY) === null) {
      verified = true;
      return false;
    }
    // 読み切れずに遊び始めると記録が少し書かれる。次の起動でもそれに負けずに戻しにいくための印
    localStorage.setItem(RESTORE_PENDING_KEY, '1');
    const reading = store.get();
    const text = await Promise.race([reading, new Promise<typeof LATE>((r) => setTimeout(() => r(LATE), wait))]);
    if (text !== LATE) return restore(text);
    // 起動は待たせない。遅れて読めたら、そのあいだに書かれた数分ぶんより控えを取って読み直す
    void reading.then(
      (late) => restore(late) && location.reload(),
      () => {}
    );
    return false;
  } catch {
    return false;
  }
}

const LATE = Symbol('late');

function restore(text: string | undefined): boolean {
  verified = true;
  try {
    localStorage.removeItem(RESTORE_PENDING_KEY);
    return !!text && importAll(parseBackup(text));
  } catch {
    return false;
  }
}
```

要点（この通りに振る舞えば書き方は多少違ってよい）。

- `store.get()` が **解決した** ときだけ `verified = true`。reject したら `verified` は false のまま、印も残る
  （次の起動でまた戻しにいく。その起動中は控えを上書きしない）
- 控えが壊れていて `parseBackup` が投げたら、`verified = true`・印を消す・`false`（壊れた控えは上書きしてよい）
- `importAll` は `EXCLUDED` のキーを消さないので、印は `importAll` のあとも残る。`restore` で必ず消す
- `watch()` と `hooks.client.ts` の呼び方は変えない

**Verify**: `pnpm check` → 0 errors

### Step 5: mirror.test.ts — モジュールの状態をテストごとに作り直し、筋書きを固める

`verified` と `last` はモジュール変数なので、テストごとに読み直す。

```ts
let m: typeof import('./mirror');
beforeEach(async () => {
  localStorage.clear();
  vi.resetModules();
  m = await import('./mirror');
});
afterEach(() => vi.unstubAllGlobals());
```

既存の 3 本は、`snapshot` の前に `await m.restoreIfEmpty(store)` を呼んで読み終えた状態にしてから同じことを確かめる
（1 本目: 記録を入れる → `restoreIfEmpty`（記録があるので false）→ `snapshot` → clear → `restoreIfEmpty` が true）。

足すテスト（名前は日本語で、既存の書き方に合わせる）。

1. 読み切れないうちは控えを上書きしない。`get` が永遠に解決しない store（`set` は `vi.fn`）で
   `restoreIfEmpty(stuck, 50)` → false。`localStorage.setItem('asobibako:reached:maze', '1')` のあと
   `await m.snapshot('v', stuck)` → `set` が呼ばれていない
2. 見切ったあと遅れて届いた控えで戻し、読み直す。`vi.stubGlobal('location', { ...location, reload })`。
   解決を手で遅らせる store（`get: () => new Promise((r) => (release = r))`）。`restoreIfEmpty(store, 20)` → false。
   `asobibako:recent` を書く。`release(控えの JSON)` → `await vi.waitFor(() => expect(reload).toHaveBeenCalled())`、
   控えのキーが localStorage に戻り、`asobibako:recent` は控えの値（無ければ消えている）
3. 前の起動で読み切れなかったら、記録が少しあっても次の起動で戻す。localStorage に
   `asobibako:restore-pending = '1'` と `asobibako:pet-house = '{"new":true}'` を入れ、控えには
   `asobibako:pet-house = '{"old":true}'` を持つ store。`restoreIfEmpty(store)` → true、pet-house は old、印は消えている
4. 最近のゲームだけが残っていても戻す。localStorage に `asobibako:recent` だけ → `restoreIfEmpty(store)` → true
5. 控えが無い端末では、読み終えたら普通に写す。`get` が undefined を返す store。`restoreIfEmpty` → false、
   記録を書いて `snapshot` → `set` が呼ばれる
6. **控えが読めなかった（get が reject）起動では上書きせず、印を残す**

「待ちすぎずに起動を続ける」の既存テストは残す。

**Verify**: `pnpm exec vitest run src/lib/mirror.test.ts src/lib/backup.test.ts` → all pass（新しい 6 本を含む）。
さらに、Step 4 の `if (!verified || ...)` の `!verified ||` を一時的に消すとテスト 1 が落ちることを確かめてから戻す

### Step 6: CLAUDE.md の控えの説明を今の仕様にする

`CLAUDE.md` の「そこで `src/lib/mirror.ts` がバックアップと同じ JSON を IndexedDB（…）へ写し、…控えは画面が隠れるとき・
ページを移るとき・見えているあいだ 30 秒ごとに取り、記録が空なら写さない。」の文を、次の事実が入るよう書き換える
（経緯は書かない。今の仕様だけ）。

- 最近のゲーム・タブ・ミュートだけなら「記録なし」とみなす
- 控えを読み終えるまでは写さない。1.5 秒で見切ったあと遅れて読めたら、控えから戻して読み直す
- 読み切れなかった起動のあとは、次の起動でも記録の有無にかかわらず控えから戻す（`asobibako:restore-pending`）
- 書き出しから除くキーを含むファイルは、そのキーを読み飛ばして読み込む

**Verify**: `grep -n "restore-pending" CLAUDE.md` が 1 行出る

### Step 7: 全体の確認

**Verify**: `pnpm test:run` → all pass（pet-house の `models.test.ts` のノミのテストが乱数でまれに落ちるのは既知。
落ちたら同じコマンドをもう一度流し、2 回目も落ちるときだけ報告）。`pnpm check` → 0 errors。`pnpm lint` → exit 0

## Test plan

- `src/lib/mirror.test.ts` に 6 本（Step 5）。見本は同じファイルの既存テスト
- `src/lib/backup.test.ts` に 2 本と 2 本の書き換え（Step 3）
- どれも happy-dom（ファイル先頭の `// @vitest-environment happy-dom` をそのまま使う）

## Done criteria

- [ ] `pnpm exec vitest run src/lib/mirror.test.ts src/lib/backup.test.ts` が all pass し、mirror のテストが 9 本以上ある
- [ ] `grep -n "verified" src/lib/mirror.ts` が宣言・snapshot・restore で 3 か所以上出る
- [ ] `grep -n "RESTORE_PENDING_KEY" src/lib/backup.ts src/lib/mirror.ts` が両ファイルで出る
- [ ] `pnpm test:run` / `pnpm check` / `pnpm lint` が通る
- [ ] `git diff --name-only 4c06cf0` が In scope のファイルだけ（+ `plans/README.md`）

## STOP conditions

- 「Current state」の抜粋と今のコードが違う
- `hooks.client.ts` や `+layout.svelte` を変えないと Step 4 の振る舞いが作れないと分かった
- `backup.ts` から `audio.svelte.ts` を import すると循環 import やテスト環境の失敗（rune が node で動かない等）が起きる
  （そのときは定数を export せず backup.ts に文字列で並べる案に切り替えてよいかを報告して聞く）
- どれかの確認が、直す試みを 2 回しても通らない

## Maintenance notes

- 新しく「画面の覚えごと」（ゲームの進み具合ではないもの）を localStorage に足すときは、`NOT_RECORDS` に入れる。
  入れ忘れると、消えたあとの起動でそのキーが書かれた瞬間に控えから戻らなくなる
- 端末ごとの設定を足すときは `EXCLUDED` に入れる。読み込みは読み飛ばすので、古い書き出しも読める
- 遅れて戻したときの `location.reload()` は遊んでいる途中でも起きうる。数分の遊びより、消えた全記録を取り戻すのを優先している
- レビューで見るところ: `restoreIfEmpty` のどの出口でも `verified` と印が仕様どおりか。`snapshot` が `verified` 前に
  1 度も `store.set` しないか
