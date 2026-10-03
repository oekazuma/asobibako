# Animal Survivors 延長戦 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 15:00 のクリアのあとに延長戦を選べるようにし、粘るほど増えて倒れると半分になるコインで引き際を作る。

**Architecture:** 延長戦の始まり・倍率・延長戦のぶんのまとめは DOM を使わない `overtime.ts` に置く。始めると World の面の表を写し、時刻の終わりを外し、`toughness` と `fury` に延長戦の伸びを入れ、ボスの行を足すので、出現とボスは今の流れのまま進む。コインはすべて `drops.ts` の `addCoins()` を通る。選ぶ画面は 3 択と同じく `Prompts` が出し入れする。記録は 15:00 で 1 回、延長戦の終わりに差だけをもう 1 回 `record()` へ渡す。

**Tech Stack:** SvelteKit（Svelte 5 runes）、TypeScript、vitest、playwright-core の headless Chrome、scratchpad のボット

**Spec:** `docs/superpowers/specs/2026-10-03-animal-survivors-overtime-design.md`

## Global Constraints

- 新しい絵は描かない。HUD の倍率は今の 3×5 のドット字（`x` と `.` が無ければ字を足す。字は見本を見せて止まる）。
- コンポーネントは 200 行未満、props は 6 つまで。全角スペースと絵文字は使わない。
- コードコメントは非自明な WHY だけ。docs は最新の仕様だけ。`pnpm verify` が通ること。

## Review Focus

- 15:00 の記録と延長戦の記録で、倒した数・宝箱・図鑑・コインが二重に入らない。クリアの回数は 1 回だけ。Task 1 と Task 3 のテスト。
- 選ぶ画面のあいだに一時停止・画面が隠れる・アプリが終わらされても、15:00 の記録は残っている（選ぶ前に記録している）。Task 3。
- 延長戦の一時停止の「やり直す」と「引き上げる」は半分にせず、復活を使い切って倒れたときだけ半分になる。Task 1 と Task 3 のテスト。
- 延長戦に入ったあとも 15:00 の判定がもう一度起きない（`length` を外す）。面の表の元（`FOREST` など）を書き換えない。Task 1 のテスト。
- 選ぶ画面のボタンが、15:00 で移動の指を置いたままでも合成 click で押されない（`Lock`）。Task 3。

---

### Task 1: 延長戦のしくみ

**Files:** Create `overtime.ts`、`overtime.test.ts`。Modify `world.ts`（`World.overtime`、`coinsOf`、`summary` の `overtime`）、`drops.ts`（`addCoins(w, n)`。拾ったコイン・小袋・大袋）、`chest.ts`（宝箱のコインも `addCoins`）。

**Interfaces:**

- `World.overtime: null | { base: { kills: number; opened: number; killsBy: Record<string, number>; bossTimes: number; coins: number }; coins: number; retreat: boolean }`
- `startOvertime(w: World): void`（`w.over = null`、面の表を写して `length: Infinity`、終わりが `length` の出現の行を `rate[1]` の速さで続け、`toughness` と `fury` を `RAMP` で強めた式に包み、16:00 から 1 分ごとのボスの行を 60 本足す）
- `addCoins(w: World, n: number): void`（延長戦なら `overtimeRate` を掛けて `w.overtime.coins` へ、そうでなければ `w.coins` へ）
- `overtimeRate(w: World): number`（`1 + 0.5 × floor((time - 900) / 60)`、延長戦でなければ 1）
- `overtimeCoins(w: World): number`（強欲と面の倍率を掛け、倒れて引き上げていなければ半分）
- `overtimeRun(w: World): RunSummary`（2 回めの記録に渡す差。`cleared: false`、`finale: false`、`metal: false`）
- `RunSummary.overtime?: { secs: number; coins: number; halved: boolean; best?: number }`

- [ ] テストを書く（`overtime.test.ts`）: 始めると 15:00 を過ぎても止まらず敵が出続ける。`FOREST` は変わらない。16:00・17:00 に 2 体が交互に出て、WARNING が出る。倍率は 15:30 で 1、16:00 で 1.5。延長戦に拾ったコインは倍率を掛けて延長戦のぶんに入り、15:00 までの `w.coins` は変わらない。宝箱のコインも倍率が掛かる。倒れると半分、`retreat` なら全部。`overtimeRun` は倒した数・宝箱・図鑑の倒した数とボスの秒を差だけにし、クリアを数えない。
- [ ] FAIL → 実装 → PASS。Commit `Let Animal Survivors continue past 15:00 into overtime`。

### Task 2: 記録と実績

**Files:** Modify `records.ts`（`Records.overtime: Record<string, number>`、`record()` が `run.overtime` の秒で面ごとの最高を更新）、`achievements.ts`（`overtime5`・`overtime10`）。Test `overtime.test.ts`。

- [ ] テストを書く: 2 回の記録でクリアは 1 回、倒した数とコインは合計どおり。面ごとの最高は長いほうを残し、壊れた値は捨てる。5 分と 10 分の実績。
- [ ] FAIL → 実装 → PASS。Commit `Record Animal Survivors' best overtime per stage`。

### Task 3: 画面

**Files:** Create `OvertimeAsk.svelte`、`OvertimeAsk.svelte.test.ts`。Modify `prompts.svelte.ts`（`asking` と `ask(finger)`、`busy` に含める）、`PromptLayer.svelte`（`OvertimeAsk` を出し、答えを `onanswer` で返す）、`draw.ts`（Play の `resize()` の canvas の大きさ合わせを `fitCanvas()` に移す。Play は 199 行で余りが無いため）、`Play.svelte`（クリアなら 1.2 秒後に `prompts.ask`、延長戦へなら `startOvertime` して `ended` を戻す、`leave()` が延長戦なら `retreat` を立てる、延長戦の終わりに `onover`）、`Survivors.svelte`（2 回めの記録、実績と図鑑のコインを合わせる、`run.overtime.best`）、`Pause.svelte`（延長戦では「引き上げる」と、確かめに「延長戦のコインは全部もらえます」）、`Result.svelte`（延長戦の見出しと行）、`StageSelect.svelte`（面の札に「延長 M:SS」）、`hud.ts`（倍率）。

- [ ] テストを書く: 選ぶ画面の「生存成功！」と 2 つのボタンと文、`Lock` のあいだは押せない。`Prompts.ask` のあいだは `busy`。延長戦の一時停止の「引き上げる」と確かめの文。延長戦のリザルトの行。
- [ ] FAIL → 実装 → PASS。headless で選ぶ画面・延長戦の HUD・延長戦のリザルトを iPad の縦と iPhone の幅で撮る（Play.svelte に一時的に `__w` を入れて時刻を 14:58 に進める。commit しない）。Commit `Show Animal Survivors' overtime choice, HUD rate, and result`。

### Task 4: ボットで伸びを決め、仕上げる

- [ ] ボットに延長戦を足し（クリアしたら `startOvertime` して倒れるまで）、店を全部と半分で、竜の子・トラ・パンダの延長戦の秒を森と雪山で測る。店を全部で中央値 4〜7 分、10 分を超えるのが 1 割未満になるよう、延長戦の硬さと攻撃の伸び（`overtime.ts` の `RAMP`）を決める。延長戦のコイン（半分にする前）と 15 分までのコインの比も出す。spec に「## 7. 調整の結果」を書く。
- [ ] CLAUDE.md、`pnpm verify`、Commit。別の係にブランチ全体を見てもらい、Critical と Important を直してから、main へ push してよいかを聞く。
