# Plan 002: 対戦エンジンの 2P 勝利・aspect・未検証分岐と、100 面テストの assertion を固める

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、
> 期待どおりの結果を確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。
> 終わったら `plans/README.md` の 002 の行の Status を更新する。
>
> **Drift check（最初に実行）**:
> `git -C /Users/oekazuma/localRepo/table-duel diff --stat b4b0196..HEAD -- src/lib/games/*/engine.ts src/lib/games/*/engine.test.ts src/lib/games.test.ts`
> `engine.ts` が変わっていたら、対応するテストの前提（関数名・イベントの形）を実際のコードで確かめる。
> `engine.test.ts` が変わっていたら、既に同名のテストがないか確かめ、あれば重複させない。

## Status

| 項目       | 値                                            |
| ---------- | --------------------------------------------- |
| Priority   | P1                                            |
| Effort     | M                                             |
| Risk       | LOW（テストを足すだけ。既存の挙動は変えない） |
| Depends on | none                                          |
| Category   | tests                                         |
| Planned at | commit `b4b0196`, 2026-09-22                  |

## Why this matters

2 人用の 8 ゲームは、盤面の上半分（プレイヤー 2）と下半分（プレイヤー 1）で鏡写しの分岐を持つ。
ところが `engine.test.ts` の勝利テストはすべてプレイヤー 1 が勝つ形で、**2P の勝利を検証するテストは
8 本とも 1 つもない**（2P の得点は lightning と feint-master で検証されているが、GOAL に達して
`winner === 2` になるところは未検証）。`1` と `2` の取り違えや `y < 0.5` / `y > 0.5` の向きの
ミスは、この種のゲームでいちばん起きやすく、起きると「向かい側の人は絶対に勝てない」という最悪の
壊れ方をするのに、CI では見えない。

同じく、`aspect`（盤面の幅 ÷ 高さ）を使う 3 エンジン（hockey / bomb-relay / bug-rush）のテストは
すべて `aspect = 1` で走る。`1` は掛け忘れが no-op になる唯一の値で、実機は縦向き iPad で約 0.75、
横向きで回して使うと約 1.3 になる。

1 人用の 100 面テストにも緩いところがある。pin-rescue のわな面は `.not.toBe('clear')` なので
「決着がつかない（`null`）」でも通る。dog-guard の「線がなければ刺される」は 1 つの乱数系列でしか
確かめていない。`LEVELS.length === 100` を固定する assertion がない。

この計画はテストだけを足す。エンジンのバグが見つかったら STOP して報告する（直すのは別の計画）。

## Current state

テストの走らせ方と書き方は既存ファイルに倣う。共通の型は次のとおり。

- `src/lib/player.ts` — `Player = 1 | 2`、`sideOf(y)`（`y < 0.5` なら 2、それ以外 1）
- テストは `describe` / `it` / `expect` を `vitest` から import し、`it` の説明は日本語
- 乱数は各エンジンが `rand: () => number = Math.random` を引数で受けるので、テストでは固定関数を渡す

### 8 本の対戦エンジンの勝利条件（既存コードの抜粋）

**hockey** — `src/lib/games/hockey/engine.ts:182-192`。`state.puck.y < -PUCK_R` で得点者 1、`> 1 + PUCK_R` で 2。
`state.scores[scorer] >= GOAL`（5）で `winner`。既存テスト `engine.test.ts:103-113` は
`state.scores[1] = GOAL - 1; state.puck = { x: 0.5, y: 0.2, vx: 0, vy: -2 }` で 1P の勝利を見ている。

```ts
if (puck.y < -PUCK_R || puck.y > 1 + PUCK_R) {
  const scorer: Player = puck.y < 0 ? 1 : 2;
  state.scores[scorer] += 1;
  events.push({ type: 'goal', scorer });
  if (state.scores[scorer] >= GOAL) {
    state.winner = scorer;
    events.push({ type: 'win', player: scorer });
  } else {
    serve(state, scorer === 1 ? 2 : 1);
  }
  return events;
}
```

**border-rush** — `src/lib/games/border-rush/engine.ts:64-78`。`pop(state, id, by)` で
`by === 2` なら `border` が増え、`border >= 1 - WIN_MARGIN` で `winner = 2`。既存テスト
`engine.test.ts:36-45` は 1P が 40 回取って `winner === 1` を見ている。

**fish-pull** — `src/lib/games/fish-pull/engine.ts:97-101`。`fish.y <= CATCH_Y[2]`（0.12）で
`{ type: 'catch', player: 2 }`。既存テスト `engine.test.ts:18-24` は `haul(state, 6, { 1: 0.8, 2: 0 })` で 1P。
`haul` ヘルパーは `step(state, dt, { 1: rate[1] * dt, 2: rate[2] * dt })` を回す。

**bug-rush** — `src/lib/games/bug-rush/engine.ts:154-160`。時間切れで `c[1] < c[2] ? 1 : 2`。
既存テスト `engine.test.ts:56-64` は 1P 側に 1 匹、2P 側に 2 匹置いて `{ type: 'end', winner: 1 }`。
`place(state, kind, x, y)` ヘルパーがある。

**shield-break** — `src/lib/games/shield-break/engine.ts:98`。`state.life[p] <= 0` で `winner = other(p)`。
既存テスト `engine.test.ts:69-77` は `state.energy[1] = 1; state.life[2] = 1; choose(state, 1, 'attack'); beat(state)`。
`beat(state, guarding)` ヘルパーは `step(state, state.timer, guarding)` で次の拍まで進める。

**lightning** — `src/lib/games/lightning/engine.ts:57-64`。`award()` で `score[player] >= GOAL`（5）なら
`winner`。既存テスト `engine.test.ts:52-59` は `going('tap')` ヘルパーで `state.score[1] = GOAL - 1; answer(state, 1, 'tap')`。

**feint-master** — `src/lib/games/feint-master/engine.ts:116-127`。`press(state, player)` で正解なら
`score[player] += 1`、`>= GOAL`（3）で `winner`。既存テスト `engine.test.ts:46-52` は
`createState(() => 0); state.score[1] = GOAL - 1; step(state, MEMO_S, () => 0); press(state, 1)`。

**bomb-relay** — `src/lib/games/bomb-relay/engine.ts:128-133`。持っている側の `meters[player] >= 1` で
`{ type: 'win', player }`。既存テスト `engine.test.ts:58-65` は `withBombAt(0.5, 0.75)`（1P 陣地）で
`state.meters[1] = 0.99; tryCatch(state, 1, 0.5, 0.75)`。`withBombAt(x, y, fuse)` は
`createState(1, fixed(0.9))` に爆弾を置くヘルパー。

### aspect を使う場所（抜粋）

- hockey `engine.ts:89` `const rx = MALLET_R / state.aspect;`、`:126-129` `collide` で `(puck.x - mx) * state.aspect`
- bomb-relay `engine.ts:83-84` `tryCatch` で `(fx - bomb.x) * state.aspect`、`:96` `moveHeld` で `BOMB_R / state.aspect`
- bug-rush `engine.ts:91` `bugAt` で `(bug.x - x) * state.aspect`、`:123` `const rx = MARGIN / state.aspect;`

### 1 人用の 100 面テスト（抜粋）

`src/lib/games/pin-rescue/engine.test.ts:27-35`（現状）

```ts
it.each(LEVELS.map((level, i) => [i + 1, level] as const).filter(([, level]) => level.trap))(
  '%i 面は、考えずに全部抜くと失敗する',
  (_, level) => {
    const state = createState(level);
    level.pins.forEach((_, i) => pull(state, i));
    run(state, 8);
    expect(state.result).not.toBe('clear');
  }
);
```

pin-rescue の `result` は `'clear' | 'burned' | 'stuck' | null`（`engine.ts:56`）。`run(state, seconds)`
は `!state.result` のあいだ `step(state, 1/60)` を回す。`LEVELS` は `levels.ts:230` で
`Array.from({ length: MAX_LEVEL }, ...)`。

`src/lib/games/dog-guard/engine.test.ts:15-28`（現状）

```ts
it.each(levels)('%i 面は、用意した線でクリアでき、線がなければ刺される', (n) => {
  const stage = levelFor(n);
  for (const seed of [1, 7, 42]) {
    const state = createState(stage);
    for (const p of stage.solution) addPoint(state, p.x, p.y);
    expect(finishStroke(state)).toBe(true);
    expect(run(state, seed), `seed ${seed}`).toBe('clear');
  }
  const bare = createState(stage);
  addPoint(bare, 0.02, 0.05);
  addPoint(bare, 0.06, 0.05);
  finishStroke(bare);
  expect(run(bare)).toBe('stung');
});
```

`run(state, seed = 1)` は seed から線形合同法で乱数を作って `step` に渡す。

守るべき規約は 001 と同じ（日本語の `it` 説明、prettier の設定、コメントは WHY だけ）。

## Commands you will need

すべて `/Users/oekazuma/localRepo/table-duel` で実行する。

| 目的       | コマンド                                            | 成功時                 |
| ---------- | --------------------------------------------------- | ---------------------- |
| 1 ファイル | `pnpm test:run src/lib/games/hockey/engine.test.ts` | pass                   |
| 全部       | `pnpm test:run`                                     | `Test Files 18 passed` |
| lint       | `pnpm lint`                                         | exit 0                 |
| まとめ     | `pnpm verify`                                       | exit 0                 |

## Scope

**In scope**

- `src/lib/games/{hockey,border-rush,fish-pull,bug-rush,shield-break,lightning,feint-master,bomb-relay}/engine.test.ts`
- `src/lib/games/{pin-rescue,dog-guard,gate-run}/engine.test.ts`
- `src/lib/games.test.ts`
- `plans/README.md`（Status の行だけ）

**Out of scope**

- どの `engine.ts` も変えない。テストが落ちたら STOP
- `.svelte` は触らない
- `src/lib/levels.ts`、`seeds.ts`、`levels.ts` — 面の内容は変えない

## Git workflow

- ブランチ: `advisor/002-engine-test-gaps`
- コミットは「対戦 8 本」「aspect」「1 人用」の 3 つ程度に分ける。英語の命令形 1 文、
  末尾に `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- **push しない**

## Steps

### Step 1: 対戦 8 本に「プレイヤー 2 の勝利」を足す

各 `engine.test.ts` に、既存の 1P 勝利テストを鏡写しにした `it` を 1 つ足す。`winner === 2` と、
`win` / `end` / `catch` イベントが `player: 2`（bug-rush は `winner: 2`）であることの両方を見る。
具体的な形を示す。

hockey — 1P 陣地の奥（`y > 1`）へ入れば 2P の得点

```ts
it(`向かい側も ${GOAL} 点で勝てる`, () => {
  const state = createState(1);
  state.scores[2] = GOAL - 1;
  state.puck = { x: 0.5, y: 0.8, vx: 0, vy: 2 };
  const events = run(state, 0.5);
  expect(events).toContainEqual({ type: 'win', player: 2 });
  expect(state.winner).toBe(2);
});
```

border-rush — 2P が自分の玉を取り続ける

```ts
it('プレイヤー 2 も押し切れば勝てる', () => {
  const s = createState();
  for (let i = 0; i < 40 && s.winner === null; i++) {
    const orb = spawnOrb(s, 'tap', 2, 0, seq(0.5));
    pop(s, orb.id, 2);
  }
  expect(s.winner).toBe(2);
});
```

fish-pull — `haul(state, 6, { 1: 0, 2: 0.8 })` で `{ type: 'catch', player: 2 }` と `state.winner === 2`。

bug-rush — 1P 側に 2 匹、2P 側に 1 匹置いて `{ type: 'end', winner: 2 }`。

shield-break — `state.energy[2] = 1; state.life[1] = 1; choose(state, 2, 'attack'); beat(state);` で
`state.winner === 2`、`step(state, 5, idle)` が `[{ type: 'win', player: 2 }]`。

lightning — `going('tap')` で `state.score[2] = GOAL - 1; answer(state, 2, 'tap');` → `winner === 2`、
`step(state, 5)` が `[{ type: 'win', player: 2 }]`。

feint-master — `createState(() => 0); state.score[2] = GOAL - 1; step(state, MEMO_S, () => 0); press(state, 2);`
→ `winner === 2`、`step(state, 5)` が `[{ type: 'win', player: 2 }]`。

bomb-relay — 2P 陣地に爆弾を置く。`withBombAt(0.5, 0.25)` で `state.meters[2] = 0.99; tryCatch(state, 2, 0.5, 0.25);`
→ `run(state, 1)` が `[{ type: 'win', player: 2 }]`、`winner === 2`。

確認 — `pnpm test:run src/lib/games` → 8 ファイルに新しい `it` が 1 つずつ増えて全部 pass

### Step 2: aspect ≠ 1 で物理の不変条件を見る

hockey / bomb-relay / bug-rush に `it.each([0.6, 1, 1.7])` を 1 つずつ足す。数値を固定するのではなく
「物理的な意味が aspect に依らない」ことを見る。

hockey — 左の壁で跳ね返り、壁からパックの半径（`PUCK_R / aspect`）の内側に留まる

```ts
it.each([0.6, 1, 1.7])('aspect %f でも左右の壁の位置はパックの半径ぶん内側', (aspect) => {
  const state = createState(aspect);
  state.puck = { x: 0.1, y: 0.5, vx: -1, vy: 0 };
  run(state, 0.3);
  expect(state.puck.vx).toBeGreaterThan(0);
  expect(state.puck.x).toBeGreaterThanOrEqual(PUCK_R / aspect - 1e-9);
});
```

`PUCK_R` は `engine.ts` から export されているので import に足す。

bomb-relay — つかめる範囲は「高さを 1 とした単位」で円。`CATCH_R` は export されている。
`createState(aspect, fixed(0.9))` に爆弾を `{ x: 0.5, y: 0.75, ... }` で置き、
`tryCatch(state, 1, 0.5 + (CATCH_R * 0.9) / aspect, 0.75)` は `true`、
`tryCatch(state, 1, 0.5 + (CATCH_R * 1.1) / aspect, 0.75)` は `false`（別の state で）。

bug-rush — `bugAt` の当たりも同じ単位で円。`createState(aspect)` に `place(state, 'bug', 0.5, 0.8)` し、
`bugAt(state, 0.5 + (BUG_R * 1.3) / aspect, 0.8)` が見つかり、`bugAt(state, 0.5 + (BUG_R * 1.6) / aspect, 0.8)` が
`null`（`bugAt` の閾値は `radius(bug) * 1.4`、`engine.ts:93`）。`BUG_R` は export されている。

確認 — `pnpm test:run src/lib/games/hockey src/lib/games/bomb-relay src/lib/games/bug-rush` → pass

### Step 3: 未検証の分岐を 1 つずつ埋める

次の `it` を追加する。どれも既存の `run` / `place` ヘルパーで書ける。

- hockey `pause` 中はパックが動かない — 得点直後（既存テスト「失点した側の陣地に…」の状態）で
  `const at = { ...state.puck }; step(state, 1/60); expect(state.puck).toEqual(at);`
- hockey 速度上限 — `state.puck = { x: 0.5, y: 0.5, vx: 0, vy: 50 }; step(state, 1/60);` のあと
  `Math.hypot(state.puck.vx, state.puck.vy)` が 2.8（`MAX_SPEED`、export されていないので数値で書き、
  `toBeLessThanOrEqual(2.8 + 1e-9)`）以下
- bug-rush `MAX_BUGS` — `createState(1)` で `run(state, 60)` しても `state.bugs.length <= 36`
- bug-rush 左右の壁 — `place(state, 'bug', 0.06, 0.8)` に `bug.heading = Math.PI`（左向き）で `run(state, 3)`、
  `bug.x >= 0.06 - 1e-9`（`MARGIN / aspect`、aspect 1）
- border-rush 境界が端に寄っても玉は 0..1 に出る — `s.border = 0.95` のあと `spawnOrb(s, 'tap', 1, 0, seq(0.5))` の
  `y` が `0 <= y <= 1`。`zone(s, 1)` の `lo > hi` になる場合の `(lo + hi) / 2` 分岐（`engine.ts:52`）を通す
- shield-break 拍は `FASTEST_BEAT` より速くならない — `beat(state)` を 30 回呼び、`state.beat` が 1.1 以上
  （`toBeGreaterThanOrEqual(1.1 - 1e-9)`）

確認 — `pnpm test:run src/lib/games` → pass

### Step 4: 1 人用の 100 面テストを固める

pin-rescue `engine.test.ts`

- わな面の assertion を `expect(state.result).toMatch(/^(burned|stuck)$/);` に変える（わなは勇者が焼ける
  `burned` のほかに、全部抜いて 5 秒待っても届かない `stuck` で終わる面もある）。`run(state, 8)` で `null`
  （決着がつかない）のままの面があれば、それはテストが今まで見逃していた面なので STOP して面の番号を報告する
- `it('面は 100 ある', () => expect(LEVELS).toHaveLength(MAX_LEVEL));` を足す。`MAX_LEVEL` を `$lib/levels` から import

dog-guard `engine.test.ts` — 「線がなければ刺される」も 3 つの seed で回す

```ts
for (const seed of [1, 7, 42]) {
  const bare = createState(stage);
  addPoint(bare, 0.02, 0.05);
  addPoint(bare, 0.06, 0.05);
  finishStroke(bare);
  expect(run(bare, seed), `bare seed ${seed}`).toBe('stung');
}
```

gate-run は既に十分（`engine.test.ts:27-29` が 100 面、`:31-34` が重複なし）。触らない。

`src/lib/games.test.ts` — 各 `meta.id` がフォルダ名と一致することを 1 行で見る。`games` 配列の
`load` は `import('./MyGame.svelte')` の相対パスなので、フォルダ名は `meta.ts` の位置から取れないため、
`import.meta.glob('./games/*/meta.ts', { eager: true })` のキーからフォルダ名を集めて
`games.map((g) => g.id)` と集合として一致することを見る。

確認 — `pnpm test:run` → 全部 pass、件数が 387 より増えている

### Step 5: まとめて検証

確認 — `pnpm verify` → exit 0

## Test plan

この計画そのものがテスト。追加する `it` の数の目安は、Step 1 で 8、Step 2 で 3（各 3 ケース）、
Step 3 で 6、Step 4 で 3。既存テストの構造（`describe` 1 つ、ヘルパー関数を先頭に）に合わせる。

## Done criteria

- [ ] `pnpm verify` が exit 0
- [ ] `grep -l "player: 2 }\|winner: 2 }\|toBe(2)" src/lib/games/{hockey,border-rush,fish-pull,bug-rush,shield-break,lightning,feint-master,bomb-relay}/engine.test.ts | wc -l` が 8
- [ ] `grep -c "it.each(\[0.6, 1, 1.7\])" src/lib/games/{hockey,bomb-relay,bug-rush}/engine.test.ts` がそれぞれ 1 以上
- [ ] `grep -n "toMatch(/^(burned|stuck)$/)" src/lib/games/pin-rescue/engine.test.ts` が 1 件、`not.toBe('clear')` が 0 件
- [ ] `grep -n "toHaveLength(MAX_LEVEL)" src/lib/games/pin-rescue/engine.test.ts` が 1 件
- [ ] `git status` で `engine.ts` が 1 つも変わっていない
- [ ] `plans/README.md` の 002 の Status を更新した

## STOP conditions

- 新しいテストが落ちて、原因が `engine.ts` 側にある（＝本物のバグ）。どのテストが、どの値で落ちたかを
  報告する。`engine.ts` は直さない
- Step 4 で `result` が `null` のままになるわな面がある
- 既存のテストが計画作成後に変わっていて、同じ内容のテストが既にある

## Maintenance notes

- 新しい対戦ゲームを足すときは、勝利テストを `it.each([1, 2] as const)` で書く癖をつける
- `aspect` を使うエンジンを足すときは、`it.each([0.6, 1, 1.7])` で不変条件を 1 つ書く
- 012（border-rush に `step()` を足す）は、ここで足した border-rush のテストの上に積む
