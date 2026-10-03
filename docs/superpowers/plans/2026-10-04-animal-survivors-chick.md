# Animal Survivors 火の鳥のひな Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 火山のクリアで仲間になる 10 匹めの動物「火の鳥のひな」（最強の段、一度だけよみがえる、専用の武器「火の羽根」と専用進化「火の鳥の翼」）を足す。

**Architecture:** 動物は `animals.ts` の 1 行と絵（`art/animals.ts`・`art/grown.ts`）。よみがえりは `Animal.rebirths` を `World.rebirths` に写し、`hurtPlayer` の倒れたところで店の復活より先に使う。火の羽根はブーメランの動き方のまま、`arms.ts` の折り返すところで `zones.ts` の炎を置く（武器の定義の `flameTurn`）。

**Tech Stack:** SvelteKit（Svelte 5 runes）、TypeScript、vitest、scratchpad のボットとドット絵の道具

**Spec:** `docs/superpowers/specs/2026-10-04-animal-survivors-chick-design.md`

## Global Constraints

- 絵は使う前に見本を見せる。黒い丸目とほっぺのかわいい顔。
- id は `chick`、名前は 火の鳥のひな・炎の若鳥・火の鳥。段は最強（`tier: 4`）。
- よみがえりは一度だけ、店の復活より先、押し返しなし、2 秒の無敵と帯「よみがえった！」。
- コンポーネントは 200 行未満。コメントは非自明な WHY だけ。`pnpm verify` が通ること。

## Review Focus

- よみがえりと店の復活とお題の「HP 半分」が重なっても、最大 HP の半分で戻り、回数がずれない（Task 2 のテスト）。
- 一時停止の「やめる」や延長戦で、よみがえりの残りが記録やリザルトを狂わせない（Task 2 のテスト）。
- 火の羽根が、ほかの動物の 3 択・宝箱・お題の「武器は 1 つだけ」で出ない／壊れない（Task 3 のテスト）。
- 前に火山をクリアした記録で、読み込むと仲間になる（Task 2 のテスト）。
- 羽根の炎が増えすぎない（炎の入れ物の上限を越えない）（Task 3 のテスト）。

---

### Task 1: 絵の見本（利用者に見せて止まる）

- [ ] scratchpad の道具で、3 段階の姿（16・20・24 ドット）の歩き 4 コマ・攻撃・やられを描く。竜の子の 3 段階と並べた PNG と、火の羽根・火の鳥の翼の印（12 ドット、翼は金色に赤い王冠）を `SendUserFile` で見せる。かわいさ（黒い丸目とほっぺ）を保ち、強さは羽と炎の飾りで見せる。
- [ ] 決まった絵を `art/animals.ts`（1 段階め）・`art/grown.ts`（2・3 段階め）・`art/items.ts`（`weapon-fireFeather`）に入れる。`pixels.test.ts` が幅・行数・コマ数を確かめる。

### Task 2: 動物とよみがえり・解放

**Files:**

- Modify: `animals.ts`（`AnimalId` に `chick`、行を足す、`Animal.rebirths?: number`）、`world.ts`（`World.rebirths`、`hurtPlayer`）、`achievements.ts`（`volcanoClear` に `animal: 'chick'`）、`weapons.ts`（`fireFeather` を先に置く。動きは Task 3）
- Test: `src/lib/games/animal-survivors/chick.test.ts`

- [ ] **Step 1: テストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from './achievements';
import { animal } from './animals';
import { emptyRecords, parseRecords } from './records';
import { createWorld, hurtPlayer } from './world';

const VIEW = { w: 274, h: 394 };

describe('火の鳥のひな', () => {
  it('最強の段で、火の羽根を持ち、火山のクリアで仲間になる', () => {
    const a = animal('chick');
    expect(a.tier).toBe(4);
    expect(a.forms).toEqual(['火の鳥のひな', '炎の若鳥', '火の鳥']);
    expect(a.weapon).toBe('fireFeather');
    expect(ACHIEVEMENTS.find((d) => d.id === 'volcanoClear')?.animal).toBe('chick');
    const r = parseRecords(JSON.stringify({ ...emptyRecords(), achieved: ['volcanoClear'] }));
    expect(r.unlocked).toContain('chick');
  });

  it('倒れると一度だけ HP 半分でよみがえり、店の復活はそのあとに残る', () => {
    const w = createWorld('chick', 1, VIEW, { revive: 1 });
    w.stats.armor = 0;
    expect(w.rebirths).toBe(1);
    hurtPlayer(w, 1e9);
    expect(w.over).toBe(null);
    expect(w.player.hp).toBe(Math.round(w.stats.maxHp / 2));
    expect(w.player.invuln).toBeGreaterThanOrEqual(2);
    expect(w.rebirths).toBe(0);
    expect(w.revives).toBe(1);
    expect(w.events.some((e) => e.type === 'swarm' && e.text === 'よみがえった！')).toBe(true);
    w.player.invuln = 0;
    hurtPlayer(w, 1e9);
    expect(w.over).toBe(null);
    expect(w.revives).toBe(0);
    w.player.invuln = 0;
    hurtPlayer(w, 1e9);
    expect(w.over).toBe('dead');
  });

  it('お題の HP 半分でも、その回の最大 HP の半分で戻る', () => {
    const w = createWorld('chick', 1, VIEW, {}, 'forest', { challenge: { date: 'x', bonus: 0, mods: ['halfHp'] } });
    hurtPlayer(w, 1e9);
    expect(w.player.hp).toBe(Math.round(w.stats.maxHp / 2));
  });

  it('ほかの動物はよみがえらない', () => {
    const w = createWorld('drake', 1, VIEW);
    expect(w.rebirths).toBe(0);
    hurtPlayer(w, 1e9);
    expect(w.over).toBe('dead');
  });
});
```

- [ ] **Step 2〜4**（落ちる → 実装 → 通る）。`hurtPlayer` の `if (p.hp > 0) return;` のあとに

```ts
if (w.rebirths > 0) {
  w.rebirths -= 1;
  p.hp = Math.round(w.stats.maxHp / 2);
  p.invuln = REBIRTH_INVULN;
  w.events.push({ type: 'swarm', text: 'よみがえった！' }, { type: 'revive' });
  return;
}
```

（`REBIRTH_INVULN = 2`。店の復活の押し返しは通らない）。数は Task 4 で合わせる仮の値（HP 110・速さ 1.25・攻撃 1.3）。図鑑の姿・実績「9 匹がそろう」など数を固めたテストは 10 匹に直す。

- [ ] **Step 5: Commit** `Add Animal Survivors' fire chick with one rebirth`

### Task 3: 火の羽根と火の鳥の翼

**Files:**

- Modify: `weapons.ts`（`fireFeather`：`boomerang`、`EXCLUSIVE` に足す、`flameTurn: true`。`fireFeatherSp`：`sp(...)`、羽根の数と炎が多い）、`arms.ts`（ブーメランが折り返したフレームで、定義に `flameTurn` があれば `zones.ts` の炎をその場に置く。`Shot.turned` で 1 回だけ）、`zones.ts`（場所を受けて炎を置く口 `flameAt(w, slot, s, area, x, y)`。今の `dropFlame` もこれを使う）、`animals.ts`（`special: 'fireFeatherSp'`）、`art/items.ts`
- Test: `chick.test.ts` に足す

- [ ] **Step 1: テストを書く**。犬の 3 択を 200 回引いても `fireFeather` が出ない。ひなで 2 秒動かすと、羽根が折り返したところ（自分から離れた場所）に炎の区域ができ、炎は羽根 1 枚につき 1 回だけ。炎の入れ物の上限を越えない。3 段階めで `fireFeather` を Lv5 にすると `fireFeatherSp` に入れ替わる（`trySpecial`）。お題の「武器は 1 つだけ」でも最初の武器として動く。
- [ ] **Step 2〜4**（落ちる → 実装 → 通る）。
- [ ] **Step 5: Commit** `Add Animal Survivors' fire feather and its special evolution`

### Task 4: 画面とボットで合わせる

- [ ] headless の Chrome でキャラ選択（10 匹の札）・遊ぶ・育つ瞬間・よみがえりの帯を撮る（一時的に `window.__w` を入れて HP を減らす。commit しない）。
- [ ] `sim/boss.sim.ts` に `ANIMALS=chick,drake,tiger` を渡し、店なし・半分の森と火山で比べる。ひなが竜の子と同じくらい（よみがえりのぶん能力を下げる）になるよう `animals.ts` の数と `fireFeather` の数値を合わせる。spec に「## 7. 調整の結果」。Commit。

### Task 5: 仕上げ

- [ ] CLAUDE.md の動物の段落に 10 匹め（解放・よみがえり・火の羽根）を足す。`pnpm verify`、Commit。別の係にブランチ全体を見てもらい、Critical と Important を直してから、main へ push してよいかを聞く。
