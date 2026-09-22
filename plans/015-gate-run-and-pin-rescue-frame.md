# Plan 015: gate-run の描画リストと pin-rescue のサブステップ・hiss を落ち着かせる

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、
> 期待どおりの結果を確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。
> 終わったら `plans/README.md` の 015 の行の Status を更新する。
>
> **Drift check（最初に実行）**:
> `git -C /Users/oekazuma/localRepo/table-duel diff --stat b4b0196..HEAD -- src/lib/games/gate-run/paint.ts src/lib/games/pin-rescue/engine.ts src/lib/games/pin-rescue/effects.ts src/lib/games/pin-rescue/engine.test.ts`
> `engine.test.ts` は 002 で変わっている **はず**（`toBe('burned')`、`toHaveLength(MAX_LEVEL)`）。それ以外の
> 差分は「Current state」と見比べる。

## Status

| 項目       | 値                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| Priority   | P3                                                                                                           |
| Effort     | S〜M                                                                                                         |
| Risk       | MED（pin-rescue のサブステップは物理の刻みを変える。`dt = 1/60` のテストでは同じ回数になるよう設計してある） |
| Depends on | 002                                                                                                          |
| Category   | perf                                                                                                         |
| Planned at | commit `b4b0196`, 2026-09-22                                                                                 |

## Why this matters

**pin-rescue** の `step()` は `n = min(12, round(dt / SUB_DT))` でサブステップの回数を決める。60fps なら 4 回だが、
フレームが遅れて `dt` が上限の 0.05 秒に達すると 12 回になる。粒どうしの当たり判定は総当たり（150 個で
約 1.1 万組 × `ITERATIONS = 2`）なので、**遅いフレームほど 3 倍働き、次のフレームがさらに遅れる** 帰還ループになる。
固定刻みの積算に上限を付け、遅いときはシミュレーションの時間のほうを落とす。

同じゲームで、水とマグマが触れて石になった粒が 1 つでもあれば毎フレーム `sounds.hiss()` を鳴らす。
`hiss` は `noise(200, 0.08)` で、`AudioBuffer` を新しく作って `sampleRate × 0.2 ≒ 9,600` 回 `Math.random()` を
回す。カスケードの間はこれが毎フレーム走る。

**gate-run** の `paint()` は、群れの人 1 人ごとに `{ z, draw: () => {...} }` のクロージャを作り（最大 140 人 ×
最大 3 つの群れ）、毎フレーム `sort` してから呼ぶ。1 フレームに約 440 個の短命オブジェクトが GC に積まれる。
点は「z・位置・大きさ・スプライト」の数値だけで描けるので、クロージャでなくデータにする。

## Current state

### pin-rescue

`src/lib/games/pin-rescue/engine.ts:59`, `:165-178`（現状）

```ts
const SUB_DT = 1 / 240;
// ...
export function step(state: GameState, dt: number): void {
  if (state.result) return;
  const segs = solids(state);
  const n = Math.min(12, Math.round(dt / SUB_DT));
  for (let i = 0; i < n && !state.result; i++) substep(state, segs);
  if (state.result) return;
  // ...
  state.idle += dt;
  if (state.pulled.every(Boolean) && state.idle > STUCK_S) state.result = 'stuck';
}
```

`GameState`（`engine.ts:47-57`）は `level / particles / pulled / idle / gold / collected / result`。
`createState()` は `engine.ts:72-90`。

`engine.test.ts` の `run(state, seconds)` は `step(state, 1/60)` を回す。`1/60 ÷ 1/240 = 4` なので、
今は 100 面すべて **4 サブステップ／フレーム** でクリアが検証されている。新しい方式でも `dt = 1/60` で
4 回になれば、テストは 1 ビットも変わらない。

`src/lib/games/pin-rescue/effects.ts:62-77`（現状）

```ts
// 石になった粒から湯気を出す
let formed = false;
game.particles.forEach((p, i) => {
  if (p.kind !== 'rock' || !this.#kinds[i] || this.#kinds[i] === 'rock') return;
  formed = true;
  this.particles.burst(p.x, p.y, {/* ... */});
});
if (formed) sounds.hiss();
this.#kinds = game.particles.map((p) => p.kind);
```

`PinFx.update(game, dt)` は毎フレーム呼ばれ、`dt` を受け取る。フィールドは `#collected`、`#kinds`、`#pending`、`#since`。

### gate-run

`src/lib/games/gate-run/paint.ts:95-120`（現状。`crowdDraws`）

```ts
const draws: Draw[] = [];
for (let i = 0; i < dots; i++) {
  const d = 0.026 * Math.sqrt(i);
  const dl = Math.cos(i * GOLDEN) * d;
  const dz = Math.sin(i * GOLDEN) * d * 0.9;
  const pz = z + dz;
  if (pz < 0.4) continue;
  draws.push({
    z: pz,
    draw: () => {
      const [x, y, s] = project(v, center + dl, pz);
      const size = v.w * 0.075 * s;
      const frame = Math.floor(now * 10 + i * 0.37) % 2 === 0 ? 0 : 1;
      const bob = Math.abs(Math.sin(now * 16 + i)) * size * 0.08;
      stamp(c, runner(colors[0], colors[1], frame), x, y - size * 0.45 - bob, size);
    }
  });
}
return draws;
```

`paint()`（`:170-207`）は `draws` に城・群れ・門・人数の札を積み、最後に `draws.sort((a, b) => b.z - a.z).forEach((d) => d.draw());`。
`Draw` 型の定義は `paint.ts` の上のほうにある（`{ z: number; draw: () => void }` の形。実際の行は `grep -n "interface Draw\|type Draw" src/lib/games/gate-run/paint.ts` で確かめる）。
`runner(color0, color1, frame)` は `fx.sprite()` でキャッシュされた `HTMLCanvasElement` を返す。

規約 — engine は DOM に依存しない。コメントは WHY だけ・日本語。

## Commands you will need

すべて `/Users/oekazuma/localRepo/table-duel` で実行する。

| 目的       | コマンド                                 | 成功時             |
| ---------- | ---------------------------------------- | ------------------ |
| pin-rescue | `pnpm test:run src/lib/games/pin-rescue` | 100 面 + 既存 pass |
| gate-run   | `pnpm test:run src/lib/games/gate-run`   | pass               |
| 型         | `pnpm check`                             | `0 ERRORS`         |
| まとめ     | `pnpm verify`                            | exit 0             |

## Scope

**In scope**

- `src/lib/games/pin-rescue/engine.ts`
- `src/lib/games/pin-rescue/effects.ts`
- `src/lib/games/pin-rescue/engine.test.ts`（1 件追加）
- `src/lib/games/gate-run/paint.ts`
- `plans/README.md`

**Out of scope**

- `SUB_DT`、`ITERATIONS`、`R` — 物理の手触りを変えない
- `seeds.ts`、`levels.ts` — 再シードはしない。テストが落ちたら STOP
- `src/lib/audio.svelte.ts` の `noise()` — バッファのキャッシュは別の話
- gate-run の門・城・札のクロージャ — 数が少ない（10 個程度）ので残す

## Git workflow

- ブランチ: `advisor/015-gate-run-and-pin-rescue-frame`
- コミットは「pin-rescue のサブステップ」「hiss」「gate-run」の 3 つ。英語の命令形 1 文、
  末尾に `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- **push しない**

## Steps

### Step 1: pin-rescue のサブステップを固定刻みの積算にする

`engine.ts` を次のように変える。

- `GameState` に `/** まだ進めていない時間（秒）。フレームが遅れても刻みを増やさず、余りを次に持ち越す */ acc: number;` を足し、
  `createState()` で `acc: 0`
- 定数 `const MAX_SUBSTEPS = 6;` を `SUB_DT` の次に置く。1 行コメント — `// 遅いフレームで刻みを 3 倍にすると次も遅れる。上限を超えた分は捨てて、時間のほうを遅らせる`
- `step()` の先頭を次にする

```ts
export function step(state: GameState, dt: number): void {
  if (state.result) return;
  const segs = solids(state);
  state.acc = Math.min(MAX_SUBSTEPS * SUB_DT, state.acc + dt);
  // 1/60 ÷ 1/240 は浮動小数で 4 にわずかに届かないことがあるので、少し足してから切り捨てる
  const n = Math.floor(state.acc / SUB_DT + 1e-6);
  state.acc -= n * SUB_DT;
  for (let i = 0; i < n && !state.result; i++) substep(state, segs);
```

`dt = 1/60` で毎回 `n = 4` になり、`acc` は `1/60 - 4/240 ≒ 0`（誤差だけ）が残る。
`dt = 0.05`（`loop.ts` の上限）では `acc = min(0.025, 0.05) = 0.025` → `n = 6`、余りは捨てられる。

確認 — `pnpm test:run src/lib/games/pin-rescue` → **100 面すべて pass のまま**（サブステップ数が
`dt = 1/60` で変わっていない証拠）。1 つでも落ちたら STOP

### Step 2: 上限をテストで固定する

`engine.test.ts` に足す。

```ts
it('遅いフレームでもサブステップは上限までしか進まない', () => {
  const state = createState(LEVELS[0]);
  pull(state, LEVELS[0].solution[0]);
  const before = state.particles.map((p) => p.y);
  step(state, 0.05);
  const slow = state.particles.map((p) => p.y);
  const fast = createState(LEVELS[0]);
  pull(fast, LEVELS[0].solution[0]);
  step(fast, 6 / 240);
  expect(slow).toEqual(fast.particles.map((p) => p.y));
  expect(slow.some((y, i) => y !== before[i])).toBe(true);
});
```

`dt = 0.05` と `dt = 6/240 = 0.025` で粒の位置がぴったり同じになる（どちらも 6 回）ことを見る。

確認 — `pnpm test:run src/lib/games/pin-rescue` → pass

### Step 3: `hiss` を 0.2 秒に 1 回にする

`effects.ts` の `PinFx` にフィールド `#hissAt = -1;` と `#t = 0;` を足し、`update()` の先頭で `this.#t += dt;`、
`if (formed) sounds.hiss();` を次にする。

```ts
// 石になる粒が続くあいだ毎フレーム鳴らすと、ノイズのバッファ生成だけで重い
if (formed && this.#t - this.#hissAt > 0.2) {
  this.#hissAt = this.#t;
  sounds.hiss();
}
```

`reset()` で `#hissAt = -1; #t = 0;` に戻す。

確認 — `pnpm check` → `0 ERRORS`。`pnpm dev` で水とマグマのある面（`localStorage.setItem('table-duel:level:pin-rescue', '30')`）を
遊び、石になるときに「シュー」が鳴るが連打にならない

### Step 4: gate-run の点をデータにする

`paint.ts` の `Draw` 型を「クロージャか、スプライトの点か」の 2 形にする。

```ts
type Draw = { z: number; draw: () => void } | { z: number; img: HTMLCanvasElement; x: number; y: number; size: number };
```

`crowdDraws` の `push` を次にする（クロージャの中でやっていた計算をその場で済ませる）。

```ts
const [x, y, s] = project(v, center + dl, pz);
const size = v.w * 0.075 * s;
const frame = Math.floor(now * 10 + i * 0.37) % 2 === 0 ? 0 : 1;
const bob = Math.abs(Math.sin(now * 16 + i)) * size * 0.08;
draws.push({ z: pz, img: runner(colors[0], colors[1], frame), x, y: y - size * 0.45 - bob, size });
```

`paint()` の末尾を次にする。

```ts
draws.sort((a, b) => b.z - a.z);
for (const d of draws) {
  if ('draw' in d) d.draw();
  else stamp(c, d.img, d.x, d.y, d.size);
}
```

`crowdDraws` が返す配列は呼ぶ側で `draws.push(...crowdDraws(...))` されている。配列の生成自体は残るが
（1 フレームに数個）、要素ごとのクロージャは消える。`runner()` は `sprite()` のキャッシュを返すだけなので、
`push` の時点で呼んでもコストは同じ。

確認 — `pnpm check` → `0 ERRORS`、`pnpm test:run src/lib/games/gate-run` → pass。`pnpm dev` で gate-run を開き、
群れの人が奥から手前の順に重なり（手前が上）、走る足の動きと上下の弾みが以前と同じ

### Step 5: 検証

確認 — `pnpm verify` → exit 0

## Test plan

- Step 2 の 1 件
- 100 面テスト（002 で固めたもの）が pin-rescue の物理の回帰テスト
- gate-run の描画順は目視

## Done criteria

- [ ] `pnpm verify` が exit 0
- [ ] `grep -n "Math.round(dt / SUB_DT)" src/lib/games/pin-rescue/engine.ts` が 0 件、`MAX_SUBSTEPS` が 2 件以上
- [ ] `grep -n "#hissAt" src/lib/games/pin-rescue/effects.ts` が 3 件以上
- [ ] `grep -c "draw: () =>" src/lib/games/gate-run/paint.ts` が `crowdDraws` の外だけ（群れの点には `draw:` がない）
- [ ] `git status` で `seeds.ts` / `levels.ts` が変わっていない
- [ ] `plans/README.md` の 015 の Status を更新した

## STOP conditions

- 002 が未実施（`engine.test.ts` に `toBe('burned')` がない）
- Step 1 のあとで 100 面テストのどれかが落ちる（浮動小数の切り捨てで 4 回にならない面がある。`n` の値を
  `console.log` で確かめ、`1e-6` の補正では足りないなら報告する。**再シードはしない**）
- gate-run の `Draw` 型が「Current state」の想定と違う形で使われている（`draw` 以外のプロパティが既にある）

## Maintenance notes

- `MAX_SUBSTEPS` を上げると遅いフレームで重くなり、下げると 60fps でも物理が遅れる（4 未満にしない）
- `noise()` のバッファを 1 回作って使い回す最適化は、`audio.svelte.ts` 側の話。ほかのゲームの `noise` は
  イベント駆動なので今は不要
