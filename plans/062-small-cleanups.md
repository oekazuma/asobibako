# Plan 062: 小さな片付け 4 つ（お題のしばりの読み込み・使われない export・書き出し日・onnxruntime-web の自動マージ）

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 36cc037..HEAD -- src/lib/games/animal-survivors/records.ts src/lib/games/animal-survivors/daily.test.ts src/lib/games/animal-survivors/limit.ts src/lib/games/pet-house/bgm.ts src/lib/backup.ts src/lib/backup.test.ts src/lib/components/Backup.svelte renovate.json pnpm-workspace.yaml pnpm-lock.yaml`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。計画 054 も `records.ts` を触る（`ranksOf` に
> `export` を付けるだけ）。ちがいがその 1 語だけなら続けてよい。`pnpm-lock.yaml` は Renovate が書き換えるので、
> onnxruntime-web の行（Step 4）が抜粋と同じなら続けてよい。

## Status

| 項目       | 値                                                               |
| ---------- | ---------------------------------------------------------------- |
| Priority   | P3                                                               |
| Effort     | S（互いに関係の無い 4 つ。1 つずつコミットする）                 |
| Risk       | LOW（Step 4 だけ lockfile の指定の行が変わる。入る版は変えない） |
| Depends on | none                                                             |
| Category   | tech-debt                                                        |
| Planned at | commit `36cc037`, 2026-10-14                                     |

## Why this matters

どれも小さいが、放っておくと害の出るものと、読む人を迷わせるものが混じっている。

1. アニマルサバイバーの保存を読むとき、お題のしばりの名前を `m in MODS` で確かめている。`MODS` はふつうのオブジェクトなので、
   `'constructor'` のような継ぎ足しの名前も通り、そのあと `dailyBonus` がコインを `NaN` にする。お題をクリアしたときに
   `r.coins += NaN` が入り、保存し直すとコインが 0 に戻る
2. `limit.ts` の `LIMIT_TEXT` と `pet-house/bgm.ts` の `renderTrack` は、どこからも使われていない export。限界突破の札の文は
   `limitGain` が作るので、`LIMIT_TEXT` を直しても画面は変わらず、読む人を迷わせる
3. 「アプリについて」の「記録を書き出す」で作るファイルに、今回の書き出しの日が入らない。書き出しの日（`asobibako:backup-at`）
   は書き出したあとに記録するので、ファイルには前回の日（初めてなら何も無い）が入る。別の端末でそのファイルを読み込むと、
   「最後に書き出した日」に前回の日が出る
4. Renovate は onnxruntime-web の minor と patch を自動でマージする。onnxruntime-web は wasm の実行部分ごと替わるが、
   ぬりえの「AI で せんを かく」のテストは Worker を偽物にしているので（`src/lib/coloring/ai-run.test.ts`）、壊れても CI は通る

## Current state

### 1. お題のしばりの読み込み

`src/lib/games/animal-survivors/records.ts:223-233`

```ts
function dailyOf(v: unknown, ids: AnimalId[]): Daily | null {
  if (!v || typeof v !== 'object') return null;
  const d = v as Record<string, unknown>;
  const mods = Array.isArray(d.mods) ? d.mods : [];
  const ok =
    typeof d.date === 'string' &&
    ids.includes(d.animal as AnimalId) &&
    STAGE_IDS.includes(d.stage as string) &&
    mods.length === 2 &&
    mods[0] !== mods[1] &&
    mods.every((m) => typeof m === 'string' && m in MODS);
```

`MODS` は `src/lib/games/animal-survivors/daily.ts:14` の `export const MODS: Record<ModId, {...}> = { tough: ..., ... }`。
`dailyBonus`（`daily.ts:87-90`）は `d.mods.reduce((t, id) => t + MODS[id].coins, 0)` で、`MODS['constructor'].coins` は
`undefined` なので `NaN` になる。

壊れたお題のテストは `src/lib/games/animal-survivors/daily.test.ts:181-194` にある。

```ts
it('壊れたお題は捨て、正しいお題は読み戻す', () => {
  const good = { date: '2026-10-03', animal: 'cat', stage: 'forest', mods: ['tough', 'growth'], cleared: true };
  expect(parseRecords(JSON.stringify({ daily: good, dailyDays: 3 })).daily).toEqual(good);
  expect(parseRecords(JSON.stringify({ daily: good, dailyDays: 3 })).dailyDays).toBe(3);
  for (const bad of [
    { ...good, mods: ['tough', 'tough'] },
    { ...good, mods: ['nope', 'tough'] },
    { ...good, stage: 'moon' },
    { ...good, animal: 7 },
    'x'
  ])
    expect(parseRecords(JSON.stringify({ daily: bad })).daily).toBeNull();
  expect(emptyRecords().daily).toBeNull();
});
```

`tsconfig` の `lib` は `esnext`（`.svelte-kit/tsconfig.json`）なので、`Object.hasOwn` は型でも通る。

### 2. 使われない export

`src/lib/games/animal-survivors/limit.ts:28-35`

```ts
export const LIMIT_TEXT: Record<LimitStat, string> = {
  damage: `ダメージ +${pct(STEP.damage)}`,
  cooldown: `待ち時間 −${pct(STEP.cooldown)}`,
  area: `大きさ +${pct(STEP.area)}`,
  speed: `速さ +${pct(STEP.speed)}`,
  duration: `時間 +${pct(STEP.duration)}`,
  amount: `数 +${STEP.amount}`
};
```

すぐ下の `limitGain`（`limit.ts:37-45`）が `pct` と `STEP` を使うので、`LIMIT_TEXT` を消しても `pct` と `STEP` は残る。

`src/lib/games/pet-house/bgm.ts:33-42`

```ts
/** OfflineAudioContext に 1 曲を seconds 秒ぶん書く（書き出して確かめる用） */
export function renderTrack(ctx: BaseAudioContext, track: Track, seconds: number): void {
  const t = TRACKS[track];
  const sc = scoreOf(SONGS[t.song]);
  const b = ctx.createGain();
  b.gain.value = t.gain;
  b.connect(output(ctx));
  const sd = 30 / t.bpm;
  for (let i = 0, at = 0.05; at < seconds; i++, at += sd) playStep(ctx, b, sc, i % sc.notes.length, at, sd);
}
```

消したあとも、`playStep`（`bgm.ts:98`）・`scoreOf`（`bgm.ts:45` と `93`）・`output`（`bgm.ts:84`）は同じファイルで使っている。
2 つとも `src/` と `scripts/` に使う場所が無い（`docs/superpowers/plans/` の古い計画に名前が出てくるのは昔の記録で、触らない）。

### 3. 書き出しの日

`src/lib/backup.ts:21-22` と `47-53` と `64-75`

```ts
/** 最後に書き出した日（YYYY-MM-DD）。書き出しにも入るので、別の端末へ移しても「いつの控えか」が残る */
export const BACKUP_AT_KEY = 'asobibako:backup-at';
```

```ts
export function markBackedUp(): void {
  try {
    localStorage.setItem(BACKUP_AT_KEY, today());
  } catch {
    // 残せなくても書き出しそのものは済んでいる
  }
}
```

```ts
export function exportAll(version: string): string {
  const data: Record<string, string> = {};
  for (const k of keys()) data[k] = localStorage.getItem(k) ?? '';
  const b: Backup = { app: 'asobibako', version, at: today(), data };
  return JSON.stringify(b);
}

export const backupName = () => `asobibako-${today()}.json`;

/** iPad の共有シート（AirDrop・ファイル・メール）に渡すための File。中身は exportAll と同じ */
export const backupFile = (version: string) =>
  new File([exportAll(version)], backupName(), { type: 'application/json' });
```

ファイルの頭の `at` には今日が入っている。古いのは `data['asobibako:backup-at']` のほう。`BACKUP_AT_KEY` は「記録あり」に
数えない `NOT_RECORDS` に入っているが、書き出さない `EXCLUDED` には入っていないので、読み込み（`importAll`）でその値が戻る。

`src/lib/components/Backup.svelte:20-42`（今 120 行）

```ts
function save() {
  const url = URL.createObjectURL(new Blob([exportAll(version)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = backupName();
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  done();
}

function share() {
  error = '';
  // Safari はユーザー操作のハンドラ内で同期に呼ばれた share() しか通さないため、await を挟まない
  navigator.share({ files: [backupFile(version)], title: 'あそびばこ の記録' }).then(done, (e: unknown) => {
    if (e instanceof Error && e.name === 'AbortError') return;
    error = '共有できませんでした。「記録を書き出す」をお使いください。';
  });
}

function done() {
  markBackedUp();
  lastAt = backedUpAt();
}
```

直し方を決める制約は 2 つある。

- 共有シートは取り消せる（`AbortError`）。取り消したら書き出していないので、端末の `asobibako:backup-at` を書く
  `markBackedUp()` は今のまま `done()` で、済んだあとに呼ぶ。先に呼ぶと、取り消しても「最後に書き出した日」が今日になる
- `exportAll` は自動の控え（`src/lib/mirror.ts:74` の `snapshot`）も使う。控えに今日の日付を入れると、控えから戻した端末で
  「最後に書き出した日」が、書き出していない日になる

そこで、ファイルを作る `backupFile` だけが今日の日付を入れ、`exportAll` は日付を渡されたときだけ入れる。「記録を書き出す」の
`save()` も `backupFile` を使う（`File` は `Blob` なので `URL.createObjectURL` にそのまま渡せる）。

`src/lib/backup.test.ts` は happy-dom で動き（1 行め `// @vitest-environment happy-dom`）、`beforeEach` で
`localStorage.clear()` する。`File` の中身は `await new Response(f).text()` で読む（`backup.test.ts:39-45`）。
`today` は `src/lib/today.ts` の `export const today = () => ...`（ローカル日付の YYYY-MM-DD）。

### 4. Renovate

`renovate.json` の `packageRules` は、`"matchUpdateTypes": ["minor", "patch", "pin", "digest"], "automerge": true` の規則
（2 つめ）で全部を自動マージにし、あとの規則で three だけを外している。規則は後ろのものが前のものを上書きする。

```json
    {
      "description": "three は 0.x で minor でも API が消える。型と同じ PR にして、手で確かめてから入れる",
      "groupName": "three",
      "matchPackageNames": ["three", "@types/three"],
      "automerge": false
    },
```

自動マージを外すだけでは足りない。`lockFileMaintenance` も `"automerge": true` で、範囲の中の新しい版へ lockfile を上げる。
onnxruntime-web の範囲は `pnpm-workspace.yaml:32` の `onnxruntime-web: ^1.22.0` で、1.x のどの minor にも上がる
（three の `^0.186.0` は 0.186.x の中だけ）。今の lockfile は 1.30.0 を入れている（`pnpm-lock.yaml:161-163`）。

```yaml
onnxruntime-web:
  specifier: ^1.22.0
  version: 1.30.0
```

そこで、catalog の範囲を入っている版ちょうど（`1.30.0`）にする。入る版は変わらず、新しい版は Renovate の PR（自動マージ
しない）でだけ入る。`renovate.json` の `rangeStrategy` は `bump` なので、PR は catalog の版を書き換える。

規約は次のとおり。

- コメントは「コードから復元できない WHY」だけを日本語で書く。WHAT・変更履歴・チケット番号は書かない
- `.svelte` は 200 行未満（svelte-vitals `architecture/component-size` がファイル全体の行を数える）。`Backup.svelte` は今 120 行
- テストの名前は日本語の文にする

## Commands you will need

| Purpose       | Command                                                                                                       | Expected on success           |
| ------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| お題のテスト  | `pnpm exec vitest run src/lib/games/animal-survivors/daily.test.ts`                                           | すべて pass                   |
| 書き出し      | `pnpm exec vitest run src/lib/backup.test.ts src/lib/components/Backup.svelte.test.ts src/lib/mirror.test.ts` | すべて pass                   |
| 全テスト      | `pnpm test:run`                                                                                               | exit 0                        |
| 型            | `pnpm check`                                                                                                  | `0 ERRORS 0 WARNINGS`、exit 0 |
| lint          | `pnpm lint`                                                                                                   | exit 0                        |
| svelte-vitals | `pnpm vitals --diff`                                                                                          | 警告 0                        |
| 全部          | `pnpm verify`                                                                                                 | exit 0                        |

## Scope

**In scope**

- `src/lib/games/animal-survivors/records.ts`（233 行めの 1 か所）
- `src/lib/games/animal-survivors/daily.test.ts`（壊れたお題の並びに 1 行）
- `src/lib/games/animal-survivors/limit.ts`（`LIMIT_TEXT` を消す）
- `src/lib/games/pet-house/bgm.ts`（`renderTrack` を消す）
- `src/lib/backup.ts`、`src/lib/backup.test.ts`、`src/lib/components/Backup.svelte`
- `renovate.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`（onnxruntime-web の指定の行だけ）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- `daily.ts` の `MODS` を `Map` や `Object.create(null)` にすること — 読む口の 1 か所で足りる
- `limitGain` の札の文を `LIMIT_TEXT` に寄せること — 頭打ちのあとの伸びを出すので、表の文とは中身が違う
- `docs/superpowers/plans/` の古い計画 — 書いた時点の記録
- `mirror.ts` と `importAll`・`parseBackup` — 書き出しの日を入れるのは書き出すファイルだけ
- `BACKUP_AT_KEY` を `EXCLUDED` に入れること — 別の端末へ移したときに「いつの控えか」を残すために書き出している
- onnxruntime-web の版を上げること、`static/licenses.txt` と「アプリについて」の表記
- `CLAUDE.md`

## Git workflow

- ブランチは `advisor/062-small-cleanups`
- Step ごとに 1 コミット、合わせて 4 つ。英語の命令形 1 文で、Co-Authored-By などの trailer は付けない
  1. `Reject inherited names when reading saved daily mods`
  2. `Remove the unused LIMIT_TEXT and renderTrack exports`
  3. `Put the export date into the backup file itself`
  4. `Keep onnxruntime-web updates out of Renovate automerge`
- push しない（`main` への push は本番に出る）

## Steps

### Step 1: お題のしばりを、`MODS` 自身が持つ名前だけにする

先に `daily.test.ts:185-191` の `bad` の並びに 1 行足す（`{ ...good, mods: ['nope', 'tough'] },` の下）。

```ts
      { ...good, mods: ['constructor', 'tough'] },
```

**Verify**: `pnpm exec vitest run src/lib/games/animal-survivors/daily.test.ts -t "壊れたお題"` → 落ちる（`constructor` の並びで `daily` が null にならない）。

`records.ts:233` を次にする。

```ts
mods.every((m) => typeof m === 'string' && Object.hasOwn(MODS, m));
```

**Verify**: `pnpm exec vitest run src/lib/games/animal-survivors/daily.test.ts` → すべて pass。
`grep -n " in MODS" src/lib/games/animal-survivors/records.ts` → 何も出ない。コミット 1。

### Step 2: 使われない `LIMIT_TEXT` と `renderTrack` を消す

1. 使う場所が無いことを確かめる。
   `grep -rn "LIMIT_TEXT\|renderTrack" src scripts` → `limit.ts:28` と `bgm.ts:34` の定義の 2 行だけ
2. `limit.ts:28-35` の `export const LIMIT_TEXT ... };` と、そのあとの空行を消す
3. `bgm.ts:33-42` の doc コメント（`/** OfflineAudioContext に 1 曲を ...`）から `renderTrack` の閉じ括弧までと、そのあとの空行を消す

**Verify**: `grep -rn "LIMIT_TEXT\|renderTrack" src scripts` → 何も出ない。`pnpm check` → `0 ERRORS 0 WARNINGS`。
`pnpm lint` → exit 0（消したあとに使われなくなった import が無いこと）。
`pnpm exec vitest run src/lib/games/animal-survivors/limit.test.ts src/lib/games/pet-house/bgm.test.ts` → すべて pass。コミット 2。

### Step 3: 書き出すファイルに今回の書き出しの日を入れる

先に `backup.test.ts` の import に `today`（`./today`）を足し、`describe('backup', ...)` の中に次を足す。

```ts
it('書き出すファイルには今回の書き出しの日が入り、自動の控えと端末の「最後に書き出した日」は前のまま', async () => {
  localStorage.setItem('asobibako:reached:maze', '5');
  localStorage.setItem('asobibako:backup-at', '2026-01-01');
  const f = backupFile('v');
  expect(parseBackup(await new Response(f).text()).data['asobibako:backup-at']).toBe(today());
  expect(parseBackup(exportAll('v')).data['asobibako:backup-at']).toBe('2026-01-01');
  expect(localStorage.getItem('asobibako:backup-at')).toBe('2026-01-01');
});
```

**Verify**: `pnpm exec vitest run src/lib/backup.test.ts` → 足したテストが落ちる（`expected '2026-01-01' to be '2026-10-…'`）。

`backup.ts` の `exportAll` と `backupFile` を次の形にする。

```ts
/** at を渡すと、書き出しの日としてその日を入れる（markBackedUp は書き出したあとに呼ぶので、渡さなければ前回の日が入る） */
export function exportAll(version: string, at?: string): string {
  const data: Record<string, string> = {};
  for (const k of keys()) data[k] = localStorage.getItem(k) ?? '';
  if (at) data[BACKUP_AT_KEY] = at;
  const b: Backup = { app: 'asobibako', version, at: today(), data };
  return JSON.stringify(b);
}
```

```ts
/**
 * 書き出すファイル。共有シート（AirDrop・ファイル・メール）にもダウンロードにも使う。
 * 今回の書き出しの日を入れる（自動の控えは exportAll をそのまま使うので、書き出していない日は入らない）
 */
export const backupFile = (version: string) =>
  new File([exportAll(version, today())], backupName(), { type: 'application/json' });
```

`Backup.svelte` の `save()` の 1 行めを `const url = URL.createObjectURL(backupFile(version));` にし、6 行めの import から
`exportAll` を外す（`backedUpAt, backupFile, backupName, markBackedUp, parseBackup, type Backup` が残る）。`done()` と
`share()` は変えない。

**Verify**: `pnpm exec vitest run src/lib/backup.test.ts src/lib/components/Backup.svelte.test.ts` → すべて pass（もとからある
`共有シート用の File は日付入りの名前と型を持ち、中身は書き出しと同じ` と `書き出し → 消去 → 読み込みで…` を含む）。
`wc -l src/lib/components/Backup.svelte` → 199 以下。`pnpm check` → `0 ERRORS 0 WARNINGS`。コミット 3。

### Step 4: onnxruntime-web を自動マージから外し、範囲を入っている版にする

1. `renovate.json` の three の規則（`"groupName": "three"` を持つもの）のすぐ下に、次の規則を足す

```json
    {
      "description": "onnxruntime-web は wasm の実行部分ごと替わり、テストは Worker を偽物にしているので CI では壊れたことが分からない。ぬりえの「AI で せんを かく」を手で確かめてから入れる。lockFileMaintenance で上がらないよう、catalog は版ちょうどにしてある",
      "matchPackageNames": ["onnxruntime-web"],
      "automerge": false
    },
```

2. `pnpm-workspace.yaml:32` の `onnxruntime-web: ^1.22.0` を `onnxruntime-web: 1.30.0` にする。先に
   `grep -n -A2 "^    onnxruntime-web:" pnpm-lock.yaml` で `version: 1.30.0` を確かめ、違えばその版ちょうどにする
3. `pnpm install` を実行して lockfile の指定の行を合わせる

**Verify**:

- `node -e "const r=JSON.parse(require('fs').readFileSync('renovate.json','utf8')).packageRules;const i=r.findIndex(p=>p.matchPackageNames?.includes('onnxruntime-web'));const a=r.findIndex(p=>p.automerge===true&&p.matchUpdateTypes);if(i<0||i<a||r[i].automerge!==false)process.exit(1);console.log('ok')"`
  → `ok`
- `grep -n -A2 "^    onnxruntime-web:" pnpm-lock.yaml` → `specifier: 1.30.0` と `version: 1.30.0`
- `git diff --stat pnpm-lock.yaml` → 変わったのは 1〜2 行だけ（ほかの依存の版が動いていたら STOP）
- `pnpm install --frozen-lockfile` → exit 0
- `pnpm exec prettier --check renovate.json pnpm-workspace.yaml` → exit 0

コミット 4。

### Step 5: 全体の確かめ

**Verify**: `pnpm verify` → exit 0。`git log --oneline 36cc037..HEAD` → この計画のコミットが 4 つ。

## Test plan

- `daily.test.ts` の `壊れたお題は捨て、正しいお題は読み戻す` に `['constructor', 'tough']` の並びを足す（今のコードで落ちる）
- `backup.test.ts` に 1 つ（書き出すファイルは今日の日付、自動の控えと端末の値は前の日のまま。今のコードで落ちる）
- 消した export は、`pnpm check` と `pnpm lint`、`limit.test.ts`・`pet-house/bgm.test.ts` が守る
- Renovate の規則は `node -e` の確かめと `pnpm install --frozen-lockfile` で見る（Renovate の検証ツールは入っておらず、
  `npx` はネットが要るので使わない）

## Done criteria

- [ ] `grep -n " in MODS" src/lib/games/animal-survivors/records.ts` が何も返さない
- [ ] `grep -rn "LIMIT_TEXT\|renderTrack" src scripts` が何も返さない
- [ ] `backup.test.ts` の足したテストと `daily.test.ts` が pass
- [ ] Step 4 の `node -e` が `ok` を出し、`pnpm install --frozen-lockfile` が exit 0
- [ ] `pnpm verify` が exit 0
- [ ] `git status` で in scope 以外のファイルが変わっていない
- [ ] `plans/README.md` の 062 の行を更新し、`pnpm exec prettier --write plans/README.md` を通した

## STOP 条件

- 上の抜粋（`dailyOf`、`LIMIT_TEXT`、`renderTrack`、`exportAll`・`backupFile`、`Backup.svelte` の `save`、`renovate.json` の
  three の規則、catalog の onnxruntime-web）が今のコードと違う
- Step 2 の最初の grep で、定義のほかに使う場所が出た（消さずに報告する）
- Step 3 で `mirror.ts` か `importAll`・`parseBackup` を変えたくなった
- Step 4 の `pnpm install` がネットにつながらずに失敗した、または lockfile のほかの依存の版が動いた（`git checkout pnpm-lock.yaml
pnpm-workspace.yaml` で戻し、Step 4 の 1 の `renovate.json` だけをコミットして報告する）
- `pnpm verify` が、この計画で触っていない場所で落ちる

## Maintenance notes

- お題のしばりに名前を足すときは `MODS` に足せば読み込みも通る。保存から読む名前を確かめるときは、ふつうのオブジェクトに
  `in` を使わない
- 書き出しの日は「ファイルに入る日」（`backupFile` が今日を入れる）と「端末の最後に書き出した日」（済んだあとに `done()` が
  書く）の 2 つ。共有シートを取り消したときは、ファイルは捨てられ、端末の日は変わらない
- onnxruntime-web の版を上げる Renovate の PR が来たら、写真のぬりえで「AI で せんを かく」を実機か built-in browser で試し、
  線画が出ることを見てからマージする。three と同じく手で入れる依存になった
- 実機では、「記録を書き出す」で作ったファイルを別の端末で読み込み、「最後に書き出した日」がそのファイルを作った日になることを見る
