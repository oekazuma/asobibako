# Plan 001: 1 人用ゲームの `onfinish` タイマーを片付け、シェルの `finish` を冪等にする

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、
> 期待どおりの結果を確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する
> （勝手に工夫しない）。終わったら `plans/README.md` の 001 の行の Status を更新する
> （レビュー担当が索引を管理すると言われている場合を除く）。
>
> **Drift check（最初に実行）**:
> `git -C /Users/oekazuma/localRepo/table-duel diff --stat b4b0196..HEAD -- src/lib/components/SoloShell.svelte src/lib/components/GameShell.svelte src/lib/games/pin-rescue/PinRescue.svelte src/lib/games/gate-run/GateRun.svelte src/lib/games/dog-guard/DogGuard.svelte src/lib/games/snow-camp/SnowCamp.svelte`
> 対象ファイルが計画の作成後に変わっていたら、「Current state」の抜粋と実際のコードを見比べ、
> 食い違っていれば STOP 条件として扱う。

## Status

| 項目       | 値                           |
| ---------- | ---------------------------- |
| Priority   | P1                           |
| Effort     | S                            |
| Risk       | LOW                          |
| Depends on | none                         |
| Category   | bug                          |
| Planned at | commit `b4b0196`, 2026-09-22 |

## Why this matters

1 人用の 4 ゲーム（pin-rescue / gate-run / dog-guard / snow-camp）は、クリアやしっぱいが決まると
演出を見せるために `setTimeout(() => onfinish(...), 1500〜2000)` で結果を遅らせて知らせる。この
タイマーはどこにも保存されず、コンポーネントが破棄されても止まらない。演出中に左上の ✕
（やめる）を押すとタイトルに戻るが、1.5〜2 秒後にタイマーが発火して `SoloShell.finish()` が走り、
タイトル画面の上に結果画面が出て、クリアの場合はレベルが進み localStorage に書かれる。
さらに、✕ を押してすぐ「タップで スタート」で次の回を始めると、古いタイマーが新しい回の
途中で発火し、遊んでいない面のクリアとして数えられる。pin-rescue では ↻（やりなおし）にも
同じ穴があり、`onfinish` が 2 回呼ばれうる（`src/lib/games.ts:31` の「1 回だけ呼ぶ」契約違反）。

直すべきところは 2 つある。タイマーの持ち主（各ゲーム）が破棄時と再開時にタイマーを消すこと、
そしてシェル側が「遊んでいる最中でなければ無視する」守りを持つこと。前者が本筋、後者は
将来のゲームが同じ穴を開けたときの保険。

## Current state

- `src/lib/components/SoloShell.svelte` — 1 人用の外枠。タイトル・結果・レベル保存を持つ
- `src/lib/components/GameShell.svelte` — 2 人用の外枠。同じ形の `finish` を持つ
- `src/lib/games/pin-rescue/PinRescue.svelte` — ピンぬき本体。↻ の `restart()` がある
- `src/lib/games/gate-run/GateRun.svelte`、`src/lib/games/dog-guard/DogGuard.svelte`、
  `src/lib/games/snow-camp/SnowCamp.svelte` — 残りの 1 人用 3 本

`SoloShell.svelte:32-46`（現状）

```ts
function finish(won: boolean) {
  cleared = won;
  complete = won && level >= MAX_LEVEL;
  if (won && !complete) {
    level += 1;
    best = Math.max(best, level);
    try {
      localStorage.setItem(key, String(best));
    } catch {
      // 保存できなくても、この場では次のレベルへ進める
    }
  }
  screen = 'result';
  settle.begin();
}
```

`SoloShell.svelte:48-55`（現状。localStorage から読むところ）

```ts
onMount(() => {
  try {
    best = level = Math.min(MAX_LEVEL, Math.max(1, Number(localStorage.getItem(key)) || 1));
  } catch {
    // プライベートブラウズでは 1 から
  }
  return settle.listen();
});
```

`SoloShell.svelte:59-64`（現状。✕ は `screen = 'title'` にするだけで、`{#if screen === 'playing'}` の
中の `<Game>` が破棄される）

```svelte
  {#if screen === 'playing'}
    {#key round}
      <Game {level} onfinish={finish} />
    {/key}
    <button class="corner quit" onclick={() => (screen = 'title')} aria-label="やめる">✕</button>
```

`GameShell.svelte:56-60`（現状）

```ts
function finish(won: Player) {
  winner = won;
  screen = 'result';
  settle.begin();
}
```

`PinRescue.svelte:45-51` と `:73-78` と `:90-97`（現状）

```ts
function restart() {
  game = fresh();
  pulledAt = [];
  fx.reset();
  progress = score = 0;
  done = false;
}
// ...
if (game.result && !done) {
  done = true;
  const cleared = game.result === 'clear';
  fx.finished(game);
  setTimeout(() => onfinish(cleared), 2000);
}
// ...
onMount(() => {
  const unobserve = input.observe(board, resize);
  const stop = animate(frame);
  return () => {
    stop();
    unobserve();
  };
});
```

`GateRun.svelte:85`、`DogGuard.svelte:114`、`SnowCamp.svelte:74`（現状。どれも同じ形）

```ts
setTimeout(() => onfinish(event.type === 'clear'), 1500); // gate-run, dog-guard
setTimeout(() => onfinish(true), 1500); // snow-camp
```

どのゲームも `onMount` の戻り値で `stop()`（rAF）と `unobserve()`（ResizeObserver）だけを片付けている。

守るべき規約は次のとおり。

- コメントは「コードから復元できない WHY」だけ書く。WHAT や変更履歴は書かない（利用者のグローバル
  ルール。例として既存の `// 保存できなくても、この場では次のレベルへ進める` が正しい粒度）
- コメント・文章は日本語。識別子は英語
- `.svelte` は 200 行未満（svelte-vitals `architecture/component-size`）。`PinRescue.svelte` は今 186 行、
  `DogGuard.svelte` は 184 行。増えても数行に留める
- prettier は `singleQuote: true`、`printWidth: 120`、`trailingComma: none`

## Commands you will need

すべて `/Users/oekazuma/localRepo/table-duel` で実行する。

| 目的   | コマンド                                         | 成功時                                    |
| ------ | ------------------------------------------------ | ----------------------------------------- |
| lint   | `pnpm lint`                                      | exit 0                                    |
| 型     | `pnpm check`                                     | `0 ERRORS`                                |
| テスト | `pnpm test:run`                                  | `Test Files 18 passed`（件数は 387 以上） |
| vitals | `pnpm vitals --diff`                             | exit 0                                    |
| まとめ | `pnpm verify`                                    | exit 0                                    |
| 目視   | `pnpm dev` → `http://localhost:5173/table-duel/` | 後述の手順                                |

## Scope

**In scope**（変更してよいファイル）

- `src/lib/components/SoloShell.svelte`
- `src/lib/components/GameShell.svelte`
- `src/lib/games/pin-rescue/PinRescue.svelte`
- `src/lib/games/gate-run/GateRun.svelte`
- `src/lib/games/dog-guard/DogGuard.svelte`
- `src/lib/games/snow-camp/SnowCamp.svelte`
- `plans/README.md`（Status の行だけ）

**Out of scope**（触らない）

- 各ゲームの `engine.ts` — ルールは変えない。engine は決着後 `[]` を返す（gate-run
  `engine.ts:112`、dog-guard `engine.ts:153`）ので、演出中に mount されたままでも害はない
- `src/lib/settle.svelte.ts` — 合成 click 対策は別の仕組み
- 遅延（1500 / 2000 ms）の値そのもの — 手触りを変えない
- 演出をシェルに移す再設計 — 今回はタイマーの後始末と守りだけ

## Git workflow

- ブランチ: `advisor/001-solo-onfinish-timers`（実行者が worktree で作業しているならそのブランチ）
- コミットは論理単位ごと。メッセージは英語の命令形 1 文、接頭辞なし（例: `Give every solo game 100 distinct levels whose difficulty follows the level`）。
  末尾に `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` を付ける
- **push しない**。`main` への push は本番デプロイになる

## Steps

### Step 1: シェルの `finish` を「遊んでいる最中」だけ受け付ける

`SoloShell.svelte` の `finish` の先頭に 1 行足す。

```ts
  function finish(won: boolean) {
    // 演出中に ✕ で抜けたあとに届く遅れた onfinish は捨てる
    if (screen !== 'playing') return;
    cleared = won;
```

`GameShell.svelte` の `finish` にも同じ 1 行を足す（コメントは片方だけでよい。GameShell 側は
`if (screen !== 'playing') return;` だけ）。

確認 — `pnpm check` → `0 ERRORS`

### Step 2: 保存されたレベルを整数に丸める

`SoloShell.svelte:50` を次にする（`Math.floor` を足すだけ）。

```ts
best = level = Math.min(MAX_LEVEL, Math.max(1, Math.floor(Number(localStorage.getItem(key))) || 1));
```

理由（コメントには書かない）— pin-rescue の `levelFor` は `LEVELS[n - 1]` の添字参照で、小数が来ると
`undefined` を返して `createState` が落ちる。読み口 1 か所で丸めれば 4 ゲームすべてに効く。

確認 — `pnpm check` → `0 ERRORS`

### Step 3: 4 ゲームでタイマーの handle を持ち、破棄時に消す

各ゲームで `let finishTimer: ReturnType<typeof setTimeout> | undefined;` を宣言し、`setTimeout(...)`
の戻り値を代入し、`onMount` の戻り値の関数で `clearTimeout(finishTimer)` する。

pin-rescue の例（`restart()` でも消す。↻ で新しい回を始めたら古い結果は届けない）

```ts
let finishTimer: ReturnType<typeof setTimeout> | undefined;

function restart() {
  clearTimeout(finishTimer);
  game = fresh();
  // ...（既存のまま）
}

// frame() の中
if (game.result && !done) {
  done = true;
  const cleared = game.result === 'clear';
  fx.finished(game);
  finishTimer = setTimeout(() => onfinish(cleared), 2000);
}

onMount(() => {
  const unobserve = input.observe(board, resize);
  const stop = animate(frame);
  return () => {
    stop();
    unobserve();
    clearTimeout(finishTimer);
  };
});
```

gate-run（`GateRun.svelte:85` と `:106-113`）、dog-guard（`DogGuard.svelte:114` と `:145-152`）、
snow-camp（`SnowCamp.svelte:74` と `:113-122`）も同じ形にする。dog-guard の `restart()`
（`DogGuard.svelte:138-143`）は `if (game.phase === 'done') return;` で演出中は再開できないので、
`clearTimeout` は `onMount` の後始末だけでよい。gate-run と snow-camp に `restart()` はない。

コメントは不要（`clearTimeout` の意図はコードから読める）。

確認 — `pnpm check` → `0 ERRORS`、`pnpm lint` → exit 0、各 `.svelte` が 200 行未満
（`wc -l src/lib/games/*/PinRescue.svelte src/lib/games/*/DogGuard.svelte` で確認）

### Step 4: 目視で 2 つの穴が閉じたことを確かめる

`pnpm dev` を起動し、ブラウザで `http://localhost:5173/table-duel/games/gate-run` を開く。

1. レベル 1 を最後まで走らせてクリア演出が始まったら、1 秒以内に左上の ✕ を押す。
   期待 — タイトルに戻ったまま 2 秒たっても結果画面は出ず、「レベル 1」のまま
2. 続けてすぐ「タップで スタート」を押す。期待 — 新しい回の途中で結果画面に飛ばない
3. `http://localhost:5173/table-duel/games/pin-rescue` でわざと失敗（マグマを勇者に当てる）し、
   演出中に右上の ↻ を押す。期待 — 2 秒たっても結果画面は出ず、新しい回を続けられる

確認 — 上の 3 つが期待どおり。localStorage の `table-duel:level:gate-run` が未設定のまま
（DevTools → Application → Local Storage。クリアしていないので書かれない）

### Step 5: まとめて検証

確認 — `pnpm verify` → exit 0

## Test plan

この計画では自動テストを足さない。シェルはコンポーネント（`.svelte`）で、現状の vitest project は
DOM のコンポーネントを mount できない。009（テスト基盤）が `dom` project を作ったあと、
`src/lib/components/SoloShell.svelte.test.ts` に次の回帰テストを書く（009 の計画に含めてある）。

- `onfinish(true)` を 2 回呼んでもレベルは 1 つしか進まない
- `screen` が `'title'` のときの `onfinish` は無視される
- localStorage が `'5.5'` / `'abc'` / `'9999'` / `'0'` のとき、`level` は 1..100 の整数

## Done criteria

すべて満たすこと。

- [ ] `pnpm verify` が exit 0
- [ ] `grep -n "setTimeout(() => onfinish" src/lib/games/*/*.svelte` の 4 件すべてが `finishTimer =` で受けている
      （`grep -c "clearTimeout(finishTimer)" src/lib/games/{pin-rescue/PinRescue,gate-run/GateRun,dog-guard/DogGuard,snow-camp/SnowCamp}.svelte` が pin-rescue で 2、他は 1）
- [ ] `grep -n "screen !== 'playing'" src/lib/components/SoloShell.svelte src/lib/components/GameShell.svelte` が 2 件
- [ ] `grep -n "Math.floor(Number(localStorage" src/lib/components/SoloShell.svelte` が 1 件
- [ ] Step 4 の 3 つの目視が期待どおり
- [ ] `git status` で In scope 以外のファイルが変わっていない
- [ ] `plans/README.md` の 001 の Status を更新した

## STOP conditions

次のどれかに当たったら止めて報告する。

- 「Current state」の抜粋と実際のコードが一致しない（作成後に変わっている）
- `SoloShell.svelte` の `finish` に既に `screen` の判定がある（誰かが先に直している）
- ゲームの `.svelte` が 200 行を超えそうになり、数行の変更で収まらない
- Step 4 の目視で、✕ のあとに結果画面が出る（タイマー以外の経路がある）
- 修正に `engine.ts` や `settle.svelte.ts` を触る必要が出た

## Maintenance notes

- 新しい 1 人用ゲームを足すときも、`onfinish` を遅らせるなら handle を持って `onMount` の後始末で
  消す。シェルの守りは保険であって、遅れて届いた `onfinish` を「正しく捨てる」ためのものではない
  （新しい回が始まっていれば `screen === 'playing'` なので通ってしまう）
- レビューでは、`restart()` を持つゲーム（pin-rescue）で `clearTimeout` が `restart()` の先頭にあることを見る
- 演出の遅延をシェルに移す（`onfinish` を同期で呼び、シェルが `screen` を切り替える前に待つ）
  設計は、この計画では見送った。4 ゲームの演出の長さが揃う（1500 / 2000 ms）ことが決まったら検討する
