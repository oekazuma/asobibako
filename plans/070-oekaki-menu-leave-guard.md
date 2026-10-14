# Plan 070: おえかきのもりのメニューで、ぬける… の二度押しが確かめの ぬける に当たらないようにする

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat ea56ff6..HEAD -- src/lib/games/oekaki-mori/Menu.svelte src/lib/games/oekaki-mori/Menu.svelte.test.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                                           |
| ---------- | ---------------------------------------------------------------------------- |
| Priority   | P3                                                                           |
| Effort     | S（`Menu.svelte` に 10 行ほど、テストを 1 つ直して 1 つ足す）                |
| Risk       | LOW（確かめの ぬける が出てから 350ms 押せないだけ。ほかのボタンは変えない） |
| Depends on | none                                                                         |
| Category   | bug                                                                          |
| Planned at | commit `ea56ff6`, 2026-10-14                                                 |

## Why this matters

おえかきのもりは、つながったあと右上の「≡」（`Menu.svelte`）から「ぬける…」を押し、確かめの「ぬける」でつながりを切る。
親が抜けると全員の遊びが終わる。確かめは同じメニューの枠の中で、「ぬける…」のボタンと入れ替わって出る。枠の高さが
ほとんど変わらないので、確かめの「ぬける」（下の段の右半分）は、いま押した「ぬける…」とほぼ同じ高さに出る。
小さい子がボタンを続けて 2 回たたくと、2 回めがそのまま確かめの「ぬける」に当たり、確かめが役に立たない。

アプリの中の同じ形の確かめは、どれも出てから 350ms は押せないようにしている。アニマルサバイバーの一時停止の「やめる」は、
まさにこの理由（`Pause.svelte:34` のコメント「確かめの「やめる」はメニューの「やめる」と近い位置に出るので、2 度押しで
決まらないよう少し止める」）で止めている。やっぱりカメレオンの ✕ の確かめ（`QuitConfirm.svelte`）も 350ms 待つ。
同じ待ちを、新しい共通部品を作らずにおえかきのもりのメニューにも入れる。

この計画では次の 2 つは直さない（調べて、当たらないと分かった）。

- メニューを開くこと自体は危なくない。「≡」は画面の右上の隅で、開いた枠は「≡」の 64px 下から始まる
  （`Menu.svelte:65-69`）ので、開いた指の下に確かめは出ない
- `aria-modal` は付けない。この枠は背景を覆わず、ほかの画面もそのまま押せる、ふつうの開き閉じする枠なので、
  `aria-modal="true"` は事実と合わない

## Current state

`src/lib/games/oekaki-mori/Menu.svelte` は 92 行。状態と関数は `Menu.svelte:8-21` にある。

```ts
let { party, oninvite }: { party: Party; oninvite: () => void } = $props();

let open = $state(false);
let asking = $state(false);

function close() {
  open = false;
  asking = false;
}

function leave() {
  party.close();
  void goto(resolve('/'));
}
```

確かめは `Menu.svelte:27-36` の `{#if asking}` の中にある。

```svelte
{#if open}
  <div class="sheet" role="dialog" aria-label="メニュー">
    {#if asking}
      <div class="confirm">
        <p>{party.host ? 'ぬけると みんなの あそびが おわるよ' : 'ぬけても おやが よびなおせるよ'}</p>
        <div class="row">
          <button class="pill" onclick={() => (asking = false)}>もどる</button>
          <button class="pill p2 leave" onclick={leave}>ぬける</button>
        </div>
      </div>
```

「ぬける…」は `Menu.svelte:51` の `<button class="pill" onclick={() => (asking = true)}>ぬける…</button>`。その上に
音のボタンと（親で 3 人そろっていなければ）「なかまを よぶ」が並ぶ。確かめの文は `<p>` で、`src/app.css` に `p` の
余白を消す決まりは無いので、上下に 1 文字ぶんの余白が付く。枠は `min-width: min(280px, 80cqw)` と `padding: 16px`
（`Menu.svelte:72-73`）なので、親の文は 2 行に折り返し、下の段のボタンは「ぬける…」と同じくらいの高さに来る。

確かめの開き方は、ほかのゲームでは次の 2 つ。どちらも `onclick` で開いた確かめを止めている。

- `src/lib/games/yappari-chameleon/QuitConfirm.svelte:10-16` は、部品が出たときに 350ms のタイマーを始め、`disabled={!ready}` にする
- `src/lib/games/animal-survivors/Pause.svelte:41-44` は、`ask()` で確かめを出すたびに `lock.begin(finger)` で止め直す

メニューの確かめは別の部品ではなく `{#if asking}` の中にあるので、`QuitConfirm` の `onMount` の形はそのまま使えない。
`asking` が true になるたびに止め直す必要がある（「もどる」で閉じて、もう一度「ぬける…」を押したときも待つ）。
そこで `asking` を見る `$effect` で、350ms のタイマーを持つ。おえかきのもりでも `$effect` の中で状態を書く形は使っている
（`RelayPlay.svelte:44-48`）。

テストは `src/lib/games/oekaki-mori/Menu.svelte.test.ts`（happy-dom）。31〜42 行めのテストは、「ぬける…」のすぐあとに
`.confirm .leave` を押して `party.close` が呼ばれることを見ているので、待ちを入れると落ちる。偽のタイマーで 350ms 進めて
から押すように直す。お手本は `src/lib/games/yappari-chameleon/Buttons.svelte.test.ts:187-213`（`vi.useFakeTimers()` と
`vi.advanceTimersByTime(350)`）。happy-dom は `disabled` のボタンの `.click()` を届けない（`HTMLButtonElement.dispatchEvent`
が `disabled` なら何もしない）ので、「押しても呼ばれない」をそのまま確かめられる。

`.pill` には `:disabled` の見た目が無いので、待つ 350ms のあいだもボタンはふつうに見える。カメレオンの確かめと同じで、
この計画では変えない。

規約として、コメントは「コードから復元できない WHY」だけを日本語で書く。`.svelte` は 200 行未満
（svelte-vitals `architecture/component-size`）。テストの名前は日本語の文にする。

## Commands you will need

| Purpose          | Command                                                              | Expected on success           |
| ---------------- | -------------------------------------------------------------------- | ----------------------------- |
| メニューのテスト | `pnpm exec vitest run src/lib/games/oekaki-mori/Menu.svelte.test.ts` | すべて pass                   |
| 全テスト         | `pnpm test:run`                                                      | exit 0                        |
| 型               | `pnpm check`                                                         | `0 ERRORS 0 WARNINGS`、exit 0 |
| lint             | `pnpm lint`                                                          | exit 0                        |
| svelte-vitals    | `pnpm vitals --diff`                                                 | 警告 0                        |
| 全部             | `pnpm verify`                                                        | exit 0                        |

## Scope

**In scope**

- `src/lib/games/oekaki-mori/Menu.svelte`
- `src/lib/games/oekaki-mori/Menu.svelte.test.ts`
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- `src/lib/settle.svelte.ts` と `animal-survivors/lock.svelte.ts` を使うこと — どちらも指が離れるのを見張る仕組みで、
  `onclick` で開く確かめには大きすぎる。待つだけでよい
- 確かめを共通の部品にすること — カメレオンの `QuitConfirm` は見た目が別のゲームのもの。写すほうが小さい
- 「もどる」を止めること — 押しても確かめが閉じるだけで、害が無い
- `aria-modal` を足すこと（Why に理由）
- `src/app.css` の `.pill` に `:disabled` の見た目を足すこと
- `src/lib/games/oekaki-mori/CLAUDE.md` — 書いてある「確かめてから抜ける」は変わらない

## Git workflow

- ブランチは `advisor/070-oekaki-menu-leave-guard`
- コミットは 1 つ。英語の命令形 1 文で、Co-Authored-By などの trailer は付けない（例 `Hold the oekaki-mori leave confirm for 350ms so a double tap cannot end the game`）
- push しない（`main` への push は本番に出る）

## Steps

### Step 1: テストを先に直して足す

`Menu.svelte.test.ts` の `afterEach` に `vi.useRealTimers();` を足す（`vi.clearAllMocks();` の下）。

31〜42 行めのテストを次に置き換える。

```ts
// 押し間違いで抜けるとつながりが切れるので、確かめてから抜ける
it('ぬける… で確かめを出し、出てから 350ms たって ぬけるを押したときだけ閉じて一覧へ戻る', () => {
  vi.useFakeTimers();
  const { app, target, party, press } = show(true);
  press('button', 'ぬける…');
  expect(target.textContent).toContain('みんなの あそびが おわるよ');
  press('button', 'もどる');
  expect(party.close).not.toHaveBeenCalled();
  press('button', 'ぬける…');
  vi.advanceTimersByTime(350);
  flushSync();
  press('.confirm .leave');
  expect(party.close).toHaveBeenCalled();
  expect(nav.goto).toHaveBeenCalled();
  unmount(app);
});
```

その下に次のテストを足す。

```ts
// 確かめの ぬける は、いま押した ぬける… とほぼ同じ高さに出る。2 度たたいた 2 回めで抜けない
it('確かめが出てすぐの ぬける は押せず、もどるで閉じて開き直すとまた待つ', () => {
  vi.useFakeTimers();
  const { app, party, press } = show(true);
  press('button', 'ぬける…');
  press('.confirm .leave');
  vi.advanceTimersByTime(349);
  flushSync();
  press('.confirm .leave');
  expect(party.close).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  flushSync();
  press('button', 'もどる');
  press('button', 'ぬける…');
  press('.confirm .leave');
  expect(party.close).not.toHaveBeenCalled();
  expect(nav.goto).not.toHaveBeenCalled();
  unmount(app);
});
```

**Verify**: `pnpm exec vitest run src/lib/games/oekaki-mori/Menu.svelte.test.ts` → 足したテスト（2 つめ）が落ちる
（`party.close` が呼ばれる）。直したテスト（1 つめ）と「子の確かめは…」は通る。

### Step 2: `Menu.svelte` で、確かめが出るたびに 350ms 待つ

`let asking = $state(false);` の下に次を足す。

```ts
let ready = $state(false);

// 確かめの ぬける は、いま押した ぬける… とほぼ同じ高さに出るので、2 度たたいた 2 回めで抜けないよう出てすぐは押せなくする
$effect(() => {
  if (!asking) return;
  const t = setTimeout(() => (ready = true), 350);
  return () => {
    clearTimeout(t);
    ready = false;
  };
});
```

確かめの「ぬける」のボタンに `disabled={!ready}` を足す。

```svelte
<button class="pill p2 leave" disabled={!ready} onclick={leave}>ぬける</button>
```

`asking` が false に戻ると（「もどる」・「とじる」・「≡」で閉じる）片付けが走って `ready` が false に戻り、
部品が消えるときはタイマーも止まる。

**Verify**: `pnpm exec vitest run src/lib/games/oekaki-mori/Menu.svelte.test.ts` → 3 つとも pass。
`wc -l src/lib/games/oekaki-mori/Menu.svelte` → 199 以下（105 前後）。

### Step 3: 全体の確かめ

**Verify**: `pnpm verify` → exit 0。

## Test plan

- 直すテストは `Menu.svelte.test.ts` の「ぬける… で確かめを出し…」（350ms 進めてから押す）
- 足すテストは 1 つ（出てすぐと 349ms では押せない、開き直すとまた待つ）
- 型にするテストは `yappari-chameleon/Buttons.svelte.test.ts:187-213`
- `pnpm exec vitest run src/lib/games/oekaki-mori/Menu.svelte.test.ts` → 3 つ pass

## Done criteria

- [ ] `pnpm exec vitest run src/lib/games/oekaki-mori/Menu.svelte.test.ts` が 3 つ pass
- [ ] `grep -n 'disabled={!ready}' src/lib/games/oekaki-mori/Menu.svelte` が 1 行返す
- [ ] `grep -n 'aria-modal' src/lib/games/oekaki-mori/Menu.svelte` が何も返さない
- [ ] `pnpm verify` が exit 0
- [ ] `git status` で in scope 以外のファイルが変わっていない
- [ ] `plans/README.md` の 070 の行を更新し、`pnpm exec prettier --write plans/README.md` を通した

## STOP 条件

- 上の抜粋（`Menu.svelte` の状態と確かめのブロック、テストの 31〜42 行め）が今のコードと違う
- Step 1 の確かめで、足したテストが直す前から通る（happy-dom が `disabled` を見ていない、などの前提違い）
- svelte-vitals か eslint が `$effect` の中で状態を書くことを止める。`ask()` の関数で `asking = true` と同時にタイマーを
  始める形に変えたくなったら、その前に報告する（部品が消えたあとのタイマーの片付けを別に書く必要が出る）
- `Menu.svelte` 以外（`OekakiMori.svelte` など）を変えたくなった

## Maintenance notes

- メニューに、押すと取り返しのつかない確かめを足すときは、同じ `ready` で止める
- 実機（iPad）では、子の端末で「≡」→「ぬける…」を素早く 2 回たたいて抜けないこと、少し待って「ぬける」を押せば抜けることを見る
