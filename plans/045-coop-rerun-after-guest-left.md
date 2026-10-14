# Plan 045: 子が抜けたあとの協力プレイの「もう一度」で、親の回を正しく記録する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b565b01..HEAD -- src/lib/games/animal-survivors/coop.ts src/lib/games/animal-survivors/coop.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

| 項目       | 値                                        |
| ---------- | ----------------------------------------- |
| Priority   | P1                                        |
| Effort     | S                                         |
| Risk       | LOW（消す行を `return` の前へ動かすだけ） |
| Depends on | none                                      |
| Category   | bug                                       |
| Planned at | commit `b565b01`, 2026-10-14              |

## Why this matters

アニマルサバイバーの協力プレイ（2 台の iPad をつないで遊ぶ）で、1 回目が終わったあとに子（2 台目）がリザルトから抜けると、
親が「もう一度」を押しても回が記録されない。始める前に釜の賭けのコインは引かれるので、子どもの貯めたコインが減るだけになり、
画面にはすぐ前の回のリザルトが出る。押すたびに賭けがまた引かれる。原因は `CoopHost.start()` が、前の回の結果を消す行より前に
`return` していること。消す行を `return` の前へ動かせば直る。

## Current state

- `src/lib/games/animal-survivors/coop.ts` — 協力プレイの親（`CoopHost`）と子（`CoopGuest`）。直すのは `CoopHost.start()` だけ
- `src/lib/games/animal-survivors/coop.test.ts` — `CoopHost` / `CoopGuest` のテスト。手元でつないだ 2 本の管（`pipes()`）と
  `started()` の補助がある

今の `start` は `coop.ts:222-234` にある。

```ts
  /** 子の動物を足して、子に始めを知らせる。子は親と同じ種とステージで、描くための World を作る */
  start(w: World, seed = 1, stage = 'forest'): void {
    this.#w = w;
    // 子が抜けたあとのもう一度は、親が 1 人で遊ぶ
    if (!this.guest) return;
    addHero(w, this.guest.animal, this.guest.ranks, this.guest.gear);
    this.#asked = null;
    this.#moves.clear();
    this.#events = [];
    this.result = this.#first = null;
    this.#keep = 0;
    this.#party.tell(GUEST, { t: 'start', seed, stage, animal: w.heroes[0].animal.id });
  }
```

記録する `finish` は `coop.ts:264-272` にあり、`this.result` が残っていると何もしない。

```ts
  finish(final: boolean): void {
    const w = this.#w;
    if (!w || this.result) return;
    const out = store(heroRun(w, 0), this.#first);
    if (final) this.result = out;
    else this.#first = out;
    if (w.heroes[1] && !w.heroes[1].gone)
      this.#party.tell(GUEST, { t: 'record', run: heroRun(w, 1), final } as unknown as Message);
  }
```

子が抜けた・切れたときの `#drop` は `coop.ts:146-148` で、`guest` を null にする。

```ts
  #drop(): void {
    this.guest = null;
    this.ready = false;
```

不具合は次の順で起きる。

1. 1 回目が終わり、親の `finish(true)` が `this.result` を入れる
2. 子がリザルトの「もどる」を押す（`CoopRoom.svelte` の `onDestroy` が `party.close()`）。親の `#drop()` が `guest = null`
3. 親が「もう一度」→ `CoopRoom.svelte:62-78` の `begin()` が `payHeat` で賭けを引いて保存し、`host.start(w)` を呼ぶ
4. `start` は `!this.guest` で return するので、`this.result` は 1 回目のまま
5. `CoopPlay.svelte:123` の `if (side?.result && side.result !== result)` が最初のコマで真になり、前の回のリザルトが出る
6. 2 回目が終わっても `finish` は `this.result` が残っているので記録しない

似た経路として、10:00 のクリアのあと延長戦を聞いている間に子が抜けた場合も同じになる（`end()` が `#first` を `result` に写すため）。

今のテスト `coop.test.ts:481-493`（「子が抜けたあとのもう一度は、親が 1 人で始め、記録もする」）は、1 回目を `finish` する前に
管を閉じているので、この経路を通らない。

```ts
it('子が抜けたあとのもう一度は、親が 1 人で始め、記録もする', async () => {
  vi.stubGlobal('localStorage', memoryStorage());
  localStorage.setItem(RECORDS_KEY, JSON.stringify(emptyRecords()));
  const { h, pipe } = await started();
  pipe.close();
  await settle();
  expect(h.ready).toBe(false);
  const again = createWorld('dog', 2, VIEW);
  h.start(again);
  expect(again.heroes).toHaveLength(1);
  again.over = 'dead';
  h.finish(true);
  expect(h.result?.run.animal).toBe('dog');
  vi.unstubAllGlobals();
});
```

記録の確かめ方はこのファイルの既存のテストにならう。`w.time = 123` のあと記録すると `loadRecords().best` が 123 になる
（`coop.test.ts:439-450` 付近）。

規約は次の 2 つ。

- コメントは「コードから復元できない WHY」だけを日本語で書く。WHAT・変更履歴・チケット番号は書かない
- テストの名前は日本語の文（既存のテストにならう）

## Commands you will need

| Purpose           | Command                                                            | Expected on success           |
| ----------------- | ------------------------------------------------------------------ | ----------------------------- |
| このテストだけ    | `pnpm exec vitest run src/lib/games/animal-survivors/coop.test.ts` | すべて pass                   |
| 全テスト          | `pnpm test:run`                                                    | exit 0                        |
| 型                | `pnpm check`                                                       | `0 ERRORS 0 WARNINGS`、exit 0 |
| lint              | `pnpm lint`                                                        | exit 0                        |
| 全部（CI と同じ） | `pnpm verify`                                                      | exit 0                        |

## Scope

**In scope**:

- `src/lib/games/animal-survivors/coop.ts`（`CoopHost.start()` だけ）
- `src/lib/games/animal-survivors/coop.test.ts`（テストを 1 つ足す）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**:

- `CoopRoom.svelte` / `CoopPlay.svelte` — 画面の側は `host.result` を見ているだけで、正しい
- `CoopGuest` — 子の側の「もう一度」は親が決めるので触らない
- 協力プレイの受け取りの形を確かめる堅牢化（`m.run as HeroRun` など）— 別の課題
- 賭けを返す仕組み — 記録されれば今の決まり（クリアなら戻る）がそのまま効く

## Git workflow

- ブランチ: `advisor/045-coop-rerun-after-guest-left`
- コミットは英語の命令形 1 文（`git log` にならう。例: `Fix CPU body-type seat keys, and tidy petit comments and docs`）
- push しない（`main` への push は本番に自動デプロイされる）

## Steps

### Step 1: 落ちるテストを先に足す

`coop.test.ts` の「子が抜けたあとのもう一度は、親が 1 人で始め、記録もする」の直後に、次のテストを足す。

```ts
it('1 回目が終わってから子が抜けても、親のもう一度は前のリザルトを出さず、記録する', async () => {
  vi.stubGlobal('localStorage', memoryStorage());
  localStorage.setItem(RECORDS_KEY, JSON.stringify(emptyRecords()));
  const { w, h, pipe } = await started();
  w.time = 30;
  w.over = 'dead';
  h.finish(true);
  expect(h.result?.run.time).toBe(30);
  pipe.close();
  await settle();
  const again = createWorld('dog', 2, VIEW);
  h.start(again);
  expect(h.result).toBeNull();
  again.time = 77;
  again.over = 'dead';
  h.finish(true);
  expect(h.result?.run.time).toBe(77);
  expect(loadRecords().best).toBe(77);
  vi.unstubAllGlobals();
});
```

**Verify**: `pnpm exec vitest run src/lib/games/animal-survivors/coop.test.ts -t 'もう一度は前のリザルト'` → この 1 件が
`expect(h.result).toBeNull()` で FAIL する（直す前なので落ちるのが正しい）。落ちなかったら STOP。

### Step 2: `start()` で、前の回の状態を `return` の前に消す

`CoopHost.start()` を次の形にする（消す行を `if (!this.guest) return;` より前へ動かすだけ。`addHero` と `tell` は guest が
いるときだけのまま）。

```ts
  start(w: World, seed = 1, stage = 'forest'): void {
    this.#w = w;
    this.#asked = null;
    this.#moves.clear();
    this.#events = [];
    this.result = this.#first = null;
    this.#keep = 0;
    // 子が抜けたあとのもう一度は、親が 1 人で遊ぶ
    if (!this.guest) return;
    addHero(w, this.guest.animal, this.guest.ranks, this.guest.gear);
    this.#party.tell(GUEST, { t: 'start', seed, stage, animal: w.heroes[0].animal.id });
  }
```

**Verify**: `pnpm exec vitest run src/lib/games/animal-survivors/coop.test.ts` → すべて pass（Step 1 のテストを含む）。

### Step 3: 全体の確かめ

**Verify**: `pnpm verify` → exit 0。

## Test plan

- 足すテスト: Step 1 の 1 件（1 回目を記録 → 子が抜ける → もう一度 → `result` が null → 2 回目も記録される）
- 型にするテスト: 同じファイルの「子が抜けたあとのもう一度は、親が 1 人で始め、記録もする」
- 既存の協力プレイのテスト（同じファイルの全件、`coop-records.test.ts`、`coop-quit.test.ts`）が全部 pass のままであること

## Done criteria

- [ ] `pnpm exec vitest run src/lib/games/animal-survivors/coop.test.ts` が pass し、Step 1 のテストが含まれる
- [ ] `git diff b565b01 -- src/lib/games/animal-survivors/coop.ts` が `start()` の中の行の移動だけ
- [ ] `pnpm verify` が exit 0
- [ ] `git status` で in scope 以外のファイルが変わっていない
- [ ] `plans/README.md` の 045 の行を更新し、`pnpm exec prettier --write plans/README.md` を通した

## STOP conditions

- `coop.ts` の `start()` / `finish()` / `#drop()` が上の抜粋と違う
- Step 1 のテストが、直す前から pass する（原因の読み違い。報告する）
- Step 2 のあと、既存の協力プレイのテストが落ちる（特に「子が抜けたあとのもう一度は…」「クリアのあと延長戦を選んでいるあいだに
  子がやめても、2 回記録しない」）。2 回直しても落ちるなら報告する
- 画面の側（`CoopPlay.svelte` / `CoopRoom.svelte`）を直さないと通らないように見える

## Maintenance notes

- `CoopHost` に回ごとの状態を足すときは、`start()` の `return` より前で消す。子がいない回でも `finish` と `after` は動く
- レビューでは、`#moves.clear()` などを guest がいない回でも呼んで害がないこと（空にするだけ）を確かめる
- 実機では「2 台で 1 回遊ぶ → 子がリザルトでもどる → 親がもう一度 → 倒れる」で、リザルトが新しい回の時間を出し、コインが増える
  ことを見る
