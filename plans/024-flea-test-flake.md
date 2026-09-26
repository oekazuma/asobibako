# Plan 024: ノミのテストを乱数で落ちないようにする

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 4c06cf0..HEAD -- src/lib/games/pet-house/models.test.ts src/lib/games/pet-house/models.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                           |
| ---------- | ---------------------------- |
| Priority   | P1                           |
| Effort     | S                            |
| Risk       | LOW（テストだけを変える）    |
| Depends on | none                         |
| Category   | tests                        |
| Planned at | commit `4c06cf0`, 2026-09-26 |

## Why this matters

`src/lib/games/pet-house/models.test.ts` の「いちばん汚れた段だけノミが跳ね、泡を付けると消える」は、
`pnpm test:run` のおよそ 3〜7% で `expected 2 to be greater than 3` で落ちる（監査時の一括実行で実際に落ち、
単独で 15 回流すと 1 回落ちた）。CI と、あとで deploy に足すテストの門（計画 025）がランダムに赤くなる。
製品のコードに問題はなく、テストの観察時間が短いだけ。

## Current state

`src/lib/games/pet-house/models.ts:1120-1126`（ノミが生まれるとき。`setDirt(1)` が呼ぶ）

```ts
function hatch() {
  for (const f of fleas) {
    f.alive = true;
    hop(f, true);
    f.sit = Math.random() * 1.5;
    f.jump = 0;
  }
}
```

とまっている時間 `sit` は 0〜1.5 秒。0 以下になると `JUMP = 0.45` 秒かけて跳び、そのあいだ高さが毎フレーム変わる。

`src/lib/games/pet-house/models.test.ts:255-264`

```ts
pet.setDirt(1);
const heights = new Set<number>();
const m = new THREE.Matrix4();
for (let f = 0; f < 90; f++) {
  pet.update('stand', 1 / 60, o);
  fleas().getMatrixAt(0, m);
  heights.add(Math.round(m.elements[13] * 100));
}
expect(fleas().visible).toBe(true);
expect(heights.size).toBeGreaterThan(3);
```

90 フレームは 1.5 秒。`sit` が 1.45 秒を超えると、見ているあいだにノミ 0 番が跳ばず、高さが 2 通りにしかならない。

## Commands you will need

| Purpose             | Command                                                                 | Expected on success |
| ------------------- | ----------------------------------------------------------------------- | ------------------- |
| Install（worktree） | `pnpm install --frozen-lockfile`                                        | exit 0              |
| 対象テスト          | `pnpm exec vitest run src/lib/games/pet-house/models.test.ts -t "ノミ"` | 1 passed            |
| 全テスト            | `pnpm test:run`                                                         | all pass            |
| lint                | `pnpm lint`                                                             | exit 0              |

## Scope

In scope は `src/lib/games/pet-house/models.test.ts` だけ。

Out of scope は `src/lib/games/pet-house/models.ts`。乱数を差し込める形にする案もあるが、`createPet` の引数を
変えることになり、この修正には要らない。

## Git workflow

- コミット 1 つ。メッセージ例 `Watch the fleas long enough to see one hop`。末尾に
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- push しない

## Steps

### Step 1: 観察するフレームを 180 に延ばす

上の抜粋の `for (let f = 0; f < 90; f++)` を `f < 180` にする。3 秒あれば、とまる時間の上限 1.5 秒と跳ぶ 0.45 秒を
必ず含む。ループの直前に 1 行だけ WHY のコメントを置く（例。
`// とまる時間は最大 1.5 秒なので、跳ぶところまで必ず見られる長さにする`）。

**Verify**: `for i in $(seq 1 30); do pnpm exec vitest run src/lib/games/pet-house/models.test.ts -t "ノミ" 2>&1 | grep -E "Tests "; done | sort | uniq -c`
→ 30 回とも `1 passed`

### Step 2: 全体の確認

**Verify**: `pnpm test:run` → all pass。`pnpm lint` → exit 0

## Test plan

新しいテストは書かない。Step 1 の 30 回の連続実行が回帰の確認になる。

## Done criteria

- [ ] `grep -n "f < 180" src/lib/games/pet-house/models.test.ts` が 1 行出る
- [ ] 30 回連続で pass（Step 1 の Verify）
- [ ] `pnpm test:run` が all pass
- [ ] `git diff --name-only 4c06cf0` が `src/lib/games/pet-house/models.test.ts`（+ `plans/README.md`）だけ

## STOP conditions

- 180 フレームにしても 30 回のうち 1 回でも落ちる（原因が別にある）
- 抜粋と今のコードが違う

## Maintenance notes

- `hatch` の `sit` の上限か `JUMP` を延ばしたら、このテストのフレーム数も合わせて延ばす
