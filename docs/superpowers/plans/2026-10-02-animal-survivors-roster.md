# Animal Survivors 動物の追加 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** キツネ・クマ・ウサギ・パンダを足し、記録の条件で解放する。

**Architecture:** 動物は `animals.ts` の表に `bonus` つきで足し、`stats()` が足す。記録は DOM を使わない `records.ts` の `record()` が更新と解放を決め、`Survivors.svelte` がリザルトのときに localStorage へ保存する。キャラ選択は解放の有無で絵と押せるかを変え、リザルトは新しく解放した動物を出す。

**Tech Stack:** SvelteKit（Svelte 5 runes）、TypeScript、vitest、playwright-core（scratchpad の確認用）

**Spec:** `docs/superpowers/specs/2026-10-02-animal-survivors-roster-design.md`

## 止まるところ

| どこで          | 何を見せるか       | 次へ進む条件                   |
| --------------- | ------------------ | ------------------------------ |
| Task 1 の終わり | 4 匹の全コマの見本 | 利用者が「この絵でよい」と言う |
| Task 5 の終わり | 入った版           | main へ push してよいかを聞く  |

## Global Constraints

- 4 匹の数値は spec の表のとおり（fox 85/1.15/1.0/`flame`/`crit: 0.1`、bear 150/0.85/1.15/`claw`/`armor: 2`、rabbit 75/1.35/0.85/`dash`/`magnet: 0.5`、panda 130/0.9/1.0/`vine`/`regen: 0.5`）。
- 解放の条件は、キツネ 300 秒、クマ 巨大ベアを倒す、ウサギ 撃破の合計 3000、パンダ クリア。最初から選べるのは犬・猫・狼。
- 記録は `asobibako:animal-survivors`。壊れていても落ちない。
- 絵は 16×16 の手打ちで、今の 3 匹と同じ組み立て（体 14 行と足 2 行、歩き 4 コマ・攻撃・被弾）。
- コンポーネントは 200 行未満、`<main>` は書かない、絵文字は使わない。
- 各 Task の終わりに `pnpm test:run`・`pnpm check`・`pnpm lint`・`pnpm vitals --diff` を通して commit する。commit の末尾は `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。

## Review Focus

- 同じ回で 2 匹以上の条件を満たした。両方が解放され、リザルトに両方出ること。Task 3 のテスト。
- localStorage が使えない（プライベートブラウズ・容量オーバー）。読み書きが例外を投げても、キャラ選択とリザルトが出ること（try/catch）。Task 3 のテスト（`parseRecords` の壊れた入力）と Task 4 の撮影。
- 記録が先に進んだ別のタブ・控えからの復元のあと。解放した動物が消えないこと（記録は足していくだけで、解放は取り消さない）。Task 3 のテスト。
- 「もう一度」で遊ぶ動物が解放前になる経路は無いこと（解放は取り消さないので起きない）。
- 7 匹のキャラ選択が、iPhone のような細長い画面でもスクロールで全部押せること。Task 4 の撮影。

---

### Task 1: 4 匹の絵と見本

**Files:**

- Modify: `art/animals.ts`（`ANIMAL_ART` の型を `Record<AnimalId, …>` 相当の 7 匹にし、4 匹を足す）
- Create (scratchpad): 4 文字区切りの手打ちの元（前の `hand-animals.mjs` と同じ形）と見本の台本

**見分けるところ**

| 動物   | 絵                                                                                             |
| ------ | ---------------------------------------------------------------------------------------------- |
| キツネ | 赤みの強い橙（差し色 `pal`）、白い鼻先と胸、黒い足先と耳の先、先の白い太いしっぽ。猫と見分ける |
| クマ   | こげ茶の丸い小さな耳、クリームの鼻先と黒い鼻、ずんぐりした体。垂れ耳の犬と見分ける             |
| ウサギ | 白とうす灰、長い耳（内側は桃）、丸いしっぽ                                                     |
| パンダ | 白い体、黒い耳・目のまわり・手足                                                               |

- [ ] **Step 1: 失敗するテストを足す**

`pixels.test.ts` に足す。

```ts
it('7 匹ぶんの絵がある', () => {
  expect(Object.keys(ANIMAL_ART).sort()).toEqual(['bear', 'cat', 'dog', 'fox', 'panda', 'rabbit', 'wolf']);
});
```

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors/pixels.test.ts`
Expected: FAIL

- [ ] **Step 2: 描いてテストを通す**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors/pixels.test.ts`
Expected: PASS（7 匹とも歩き 4 コマ、すべてのコマの幅と色が正しい）

- [ ] **Step 3: 見本を撮って直す**

7 匹の全コマを 8 倍で並べた 1 枚を撮り、猫とキツネ、犬とクマが見分けられるまで直す。

- [ ] **Step 4: commit して見せて止まる**

```bash
git add src/lib/games/animal-survivors
git commit -m "Draw Animal Survivors' fox, bear, rabbit, and panda"
```

`SendUserFile` で見本を送り、承認されるまで Task 2 へ進まない。

---

### Task 2: 4 匹の表と特別な強み

**Files:**

- Modify: `animals.ts`、`passives.ts`
- Test: `roster.test.ts`（新）

**Interfaces:**

```ts
// animals.ts
export type AnimalId = 'dog' | 'cat' | 'wolf' | 'fox' | 'bear' | 'rabbit' | 'panda';
export interface Animal {
  /* 既存 */ bonus?: Partial<Stats>;
  /** 解放の条件の文。最初から選べる動物には無い */ unlock?: string;
}
```

`bonus` の文はキャラ選択で「とくい: 会心率 +10%」のように出すので、`Animal.perk?: string`（例「会心率 +10%」）も持たせる。

- [ ] **Step 1: テストを書く**

```ts
// roster.test.ts
import { describe, expect, it } from 'vitest';
import { ANIMALS, animal } from './animals';
import { stats } from './passives';
import { WEAPONS } from './weapons';

describe('動物', () => {
  it('7 匹いて、最初の武器はどれも表にある', () => {
    expect(ANIMALS.map((a) => a.id)).toEqual(['dog', 'cat', 'wolf', 'fox', 'bear', 'rabbit', 'panda']);
    for (const a of ANIMALS) expect(WEAPONS[a.weapon]).toBeDefined();
  });

  it('新しい 4 匹は表どおりで、特別な強みが stats に入る', () => {
    expect(animal('fox')).toMatchObject({ hp: 85, speed: 1.15, might: 1, weapon: 'flame' });
    expect(animal('bear')).toMatchObject({ hp: 150, speed: 0.85, might: 1.15, weapon: 'claw' });
    expect(animal('rabbit')).toMatchObject({ hp: 75, speed: 1.35, might: 0.85, weapon: 'dash' });
    expect(animal('panda')).toMatchObject({ hp: 130, speed: 0.9, might: 1, weapon: 'vine' });
    expect(stats(animal('fox'), []).crit).toBeCloseTo(0.15);
    expect(stats(animal('bear'), []).armor).toBe(2);
    expect(stats(animal('rabbit'), []).magnet).toBeCloseTo(1.5);
    expect(stats(animal('panda'), []).regen).toBeCloseTo(0.5);
    expect(stats(animal('dog'), []).crit).toBeCloseTo(0.05);
  });

  it('新しい 4 匹には解放の条件と強みの文がある', () => {
    for (const id of ['fox', 'bear', 'rabbit', 'panda'] as const) {
      expect(animal(id).unlock).toBeTruthy();
      expect(animal(id).perk).toBeTruthy();
    }
    for (const id of ['dog', 'cat', 'wolf'] as const) expect(animal(id).unlock).toBeUndefined();
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors/roster.test.ts`
Expected: FAIL

- [ ] **Step 3: 書く**

`stats()` は基本値を作ったあとに `for (const [k, v] of Object.entries(a.bonus ?? {})) s[k] += v` を足す。

- [ ] **Step 4: テストを通して commit**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors`
Expected: PASS

```bash
git add src/lib/games/animal-survivors
git commit -m "Add Animal Survivors' fox, bear, rabbit, and panda with their perks"
```

---

### Task 3: 記録と解放

**Files:**

- Create: `records.ts`
- Modify: `world.ts`（`World.bossKills: BossId[]`、`damageEnemy` でボスが倒れたら足す、`RunSummary.bosses`）
- Test: `roster.test.ts`

**Interfaces:**

```ts
// records.ts
export interface Records {
  best: number;
  kills: number;
  bosses: BossId[];
  clears: number;
  unlocked: AnimalId[];
}
export const RECORDS_KEY = 'asobibako:animal-survivors';
export function emptyRecords(): Records; // unlocked は犬・猫・狼
export function parseRecords(text: string | null): Records; // 壊れていれば emptyRecords。型の合わない値は既定値に
export function record(r: Records, run: RunSummary): AnimalId[]; // r を更新し、新しく解放した動物を ANIMALS の順で返す
export function loadRecords(): Records; // localStorage。例外は空の記録
export function saveRecords(r: Records): void; // 例外は握りつぶす
```

- [ ] **Step 1: テストを足す**

```ts
import { emptyRecords, parseRecords, record } from './records';
import type { RunSummary } from './world';
import { ENEMIES } from './enemies';
import { createWorld, makeEnemy, step, summary } from './world';

const run = (o: Partial<RunSummary>): RunSummary => ({
  animal: 'dog',
  cleared: false,
  time: 100,
  level: 5,
  kills: 100,
  xp: 0,
  weapons: [],
  passives: [],
  bosses: [],
  ...o
});

describe('記録と解放', () => {
  it('初めは犬・猫・狼だけ', () => {
    expect(emptyRecords().unlocked).toEqual(['dog', 'cat', 'wolf']);
  });

  it('5 分生き延びるとキツネ。一度解放したものはもう返さない', () => {
    const r = emptyRecords();
    expect(record(r, run({ time: 299 }))).toEqual([]);
    expect(record(r, run({ time: 300 }))).toEqual(['fox']);
    expect(r.unlocked).toContain('fox');
    expect(record(r, run({ time: 400 }))).toEqual([]);
    expect(r.best).toBe(400);
  });

  it('同じ回で 2 匹の条件を満たせば 2 匹とも解放する', () => {
    const r = emptyRecords();
    expect(record(r, run({ time: 310, bosses: ['bear'] }))).toEqual(['fox', 'bear']);
  });

  it('撃破の合計 3000 でウサギ、クリアでパンダ', () => {
    const r = emptyRecords();
    expect(record(r, run({ kills: 1500 }))).toEqual([]);
    expect(record(r, run({ kills: 1500 }))).toEqual(['rabbit']);
    expect(record(r, run({ time: 900, cleared: true }))).toEqual(['fox', 'panda']);
    expect(r.clears).toBe(1);
  });

  it('壊れた保存や型の違う値は空の記録として読む', () => {
    expect(parseRecords(null)).toEqual(emptyRecords());
    expect(parseRecords('{oops')).toEqual(emptyRecords());
    expect(parseRecords(JSON.stringify({ best: 'x', kills: 50, unlocked: ['fox', 'nope'] }))).toEqual({
      ...emptyRecords(),
      kills: 50,
      unlocked: ['dog', 'cat', 'wolf', 'fox']
    });
  });

  it('その回に倒したボスがリザルトに入る', () => {
    const w = createWorld('dog', 1, { w: 274, h: 394 });
    w.stage = { ...w.stage, waves: [], bosses: [] };
    w.spawnAcc = [];
    w.weapons = [{ id: 'woof', level: 1, cd: 0 }];
    w.enemies.push(makeEnemy({ ...ENEMIES.bear, speed: 0 }, 60, 0, 1));
    for (let i = 0; i < 60; i++) step(w, { x: 0, y: 0 }, 1 / 60);
    expect(summary(w).bosses).toEqual(['bear']);
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors/roster.test.ts`
Expected: FAIL（`./records` が無い）

- [ ] **Step 3: 書く**

`record()` は `best = max`、`kills += run.kills`、`bosses` にその回のボスを重ならないよう足し、`cleared` なら `clears += 1`。そのあと、解放していない動物について条件（`fox: best >= 300`、`bear: bosses に 'bear'`、`rabbit: kills >= 3000`、`panda: clears >= 1`）を見て、満たしたものを `unlocked` に足して返す。`parseRecords` は、数でない値は 0、知らない動物の id は捨て、犬・猫・狼は必ず入れる。

- [ ] **Step 4: テストを通して commit**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors`
Expected: PASS

```bash
git add src/lib/games/animal-survivors
git commit -m "Keep Animal Survivors' records and unlock the new animals by them"
```

---

### Task 4: キャラ選択とリザルト

**Files:**

- Modify: `CharSelect.svelte`（props に `unlocked: AnimalId[]`）、`Survivors.svelte`、`Result.svelte`（props に `fresh: AnimalId[]`）

**決まり**

- `Survivors.svelte` は mount で `loadRecords()` を読み、`unlocked` を `$state` に持つ。`end()` で `const r = loadRecords(); const fresh = record(r, run); saveRecords(r); unlocked = r.unlocked;` として `fresh` を `Result` に渡す。
- `CharSelect` は 7 匹を並べ、解放前は絵を `filter: brightness(0)`、名前を「？？？」、ステータスと武器の代わりに `unlock` の文、`disabled`。強みのある動物は武器の下に「とくい: {perk}」。カードは今より小さくする（spec の大きさ）。
- `Result` は `fresh` があれば、見出しの下に動物ごとに「NEW! {name}が仲間になった」と歩くコマの絵を出す（金色のふち、`pop` のアニメ。`prefers-reduced-motion` では止める）。

- [ ] **Step 1: 書く**（Svelte は `npx -y @sveltejs/mcp svelte-autofixer` で確かめる）

- [ ] **Step 2: headless Chrome で撮る**

1. 記録の無い状態のキャラ選択（4 匹が影）。
2. `localStorage` に `asobibako:animal-survivors` = 全部解放の記録を入れたキャラ選択。
3. 一時的に Play.svelte に `window.__w = world` を入れ（commit しない）、時刻を 300 秒にして倒れさせたリザルト（キツネの NEW）。
4. 390×844 の細長い画面でのキャラ選択（スクロールで最後のパンダまで届く）。
5. `localStorage` を使えなくした（`Object.defineProperty(window, 'localStorage', { get() { throw new Error() } })` を `addInitScript` で入れた）状態で、キャラ選択とリザルトが出ること。

- [ ] **Step 3: 確かめて commit**

Run: `pnpm test:run && pnpm check && pnpm lint && pnpm vitals --diff`

```bash
git add src/lib/games/animal-survivors
git commit -m "Show locked animals and newly unlocked ones in Animal Survivors"
```

---

### Task 5: 強さの確かめと文書

- [ ] **Step 1: ボットで測る**

scratchpad の `sim/survivors.sim.ts` の動物の並びに 4 匹を足し、7 匹 × 2 通り × 8 種で回す。4 匹の生存時間の中央値が、今の 3 匹の幅（9〜15 分）から大きく外れたら、その動物の数値を直す（直したら `roster.test.ts` も合わせる）。

- [ ] **Step 2: 文書**

`CLAUDE.md` の Animal Survivors の段落に、7 匹と解放（`records.ts`・`asobibako:animal-survivors`・条件）を足す。spec は直した数値に合わせる。

- [ ] **Step 3: まとめて確かめて commit**

Run: `pnpm verify`

```bash
git add -A src/lib/games/animal-survivors CLAUDE.md docs
git commit -m "Check Animal Survivors' new animals with the bot and document the roster"
```

- [ ] **Step 4: レビューして止まる**

別の係（最も強いモデル）にブランチ全体を見てもらい、Critical と Important を直してから、main へ push してよいかを聞く。
