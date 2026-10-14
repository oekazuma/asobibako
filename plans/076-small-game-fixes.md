# Plan 076: 小さなゲームの直し 3 つ（雪原のお皿の形・長押しの玉の指・盤面が低いときの縮尺）

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat ea56ff6..HEAD -- src/lib/games/snow-camp/world3d.ts src/lib/games/snow-camp/models.ts src/lib/games/snow-camp/models.test.ts src/lib/games/border-rush/Orbs.svelte src/lib/games/border-rush/Orbs.svelte.test.ts src/lib/games/dentist/Dentist.svelte src/lib/games/dog-guard/DogGuard.svelte src/lib/games/pin-rescue/PinRescue.svelte`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                     |
| ---------- | ------------------------------------------------------ |
| Priority   | P3                                                     |
| Effort     | S                                                      |
| Risk       | LOW（3 つとも 1 か所の小さな直しで、互いに関わらない） |
| Depends on | none                                                   |
| Category   | bug                                                    |
| Planned at | commit `ea56ff6`, 2026-10-14                           |

## Why this matters

互いに関わらない小さな直しを 3 つまとめた。1 つずつコミットする。

1. 雪原サバイバル（`snow-camp`）は、机にシチューのお皿を出すたびに `CylinderGeometry` を 2 つ新しく作り、お皿を下げるときに
   捨てない。同じ部品の形は使い回す決まり（`models.ts` の `geo()`）があるのに、お皿だけ外れている。漏れる量は 1 面のあいだに
   出したお皿のぶんで、面を抜けると描画のコンテキストごと捨てるので小さい。決まりにそろえて、作るのも捨てるのもやめる
2. 陣取りラッシュ（`border-rush`）の長押しの玉は、押さえている指とは別の指を玉の上で離しただけで長押しが終わり、
   押さえ直しになる。玉のボタンが `pointerup` の `pointerId` を見ていないため
3. はいしゃさん・線を引いて守る・ピンぬきは、盤面の高さが上の帯（130px・90px・96px）より低いと縮尺が 0 以下になる。
   0 なら指の位置を世界の座標に直す割り算が無限大になり、負なら絵が裏返る。遊ぶ iPad では起きず、大きさが変わる途中や
   とても小さい窓のときだけの話なので、1 行ずつの守りにとどめる

## Current state

### 1. 雪原のお皿

今のコードは `src/lib/games/snow-camp/world3d.ts:341-351` にある。

```ts
while (this.#meals.children.length < Math.min(state.meals, 6)) {
  const i = this.#meals.children.length;
  const bowl = new THREE.Group();
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.014, 14), mat('#ffffff'));
  const stew = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.004, 14), mat('#c2542b'));
  stew.position.y = 0.006;
  bowl.add(cup, stew);
  bowl.position.set(-0.06 + (i % 3) * 0.06, 0, i < 3 ? -0.015 : 0.02);
  this.#meals.add(bowl);
}
while (this.#meals.children.length > Math.min(state.meals, 6)) this.#meals.remove(this.#meals.children.at(-1)!);
```

形を使い回す部品は `src/lib/games/snow-camp/models.ts:19-41` にある（`cyl` は export していない）。

```ts
function mesh(geometry: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0, extra = {}, shadow = true) {
  const m = new THREE.Mesh(geometry, mat(color, extra));
  m.position.set(x, y, z);
  m.castShadow = shadow;
  return m;
}

const geometries = new Map<string, THREE.BufferGeometry>();

/** 同じ形の geometry は 1 つを使い回す。木 1 本で 7 個、面全体で数百個になるので GPU に上げる回数を減らす */
function geo(key: string, make: () => THREE.BufferGeometry) {
  let g = geometries.get(key);
  if (!g) {
    g = make();
    geometries.set(key, g);
  }
  return g;
}

const sphere = (r: number) => geo(`sphere:${r}`, () => new THREE.SphereGeometry(r, 20, 14));
const cyl = (r1: number, r2: number, h: number, seg = 16) =>
  geo(`cyl:${r1}:${r2}:${h}:${seg}`, () => new THREE.CylinderGeometry(r1, r2, h, seg));
```

同じファイルの `coin()`（`models.ts:120-123`）が、`cyl()` と `mesh()` で 1 つの部品を返すお手本になる。

```ts
export function coin() {
  const m = mesh(cyl(0.014, 0.014, 0.005, 20), '#ffc233', 0, 0, 0, { metalness: 0.6, roughness: 0.3 });
  return m;
}
```

`mat(color, extra = {})` は色と `JSON.stringify(extra)` で材質を使い回すので、`mesh(…, '#ffffff', 0, 0, 0, {}, false)` の材質は
今の `mat('#ffffff')` と同じものになる。今のお皿の Mesh は影を落とさない（`new THREE.Mesh` の `castShadow` は既定で false）ので、
`mesh()` の最後の引数は `false` にする。使い回す形は捨ててはいけない（ほかのお皿も同じ形を使う）。

テストは `src/lib/games/snow-camp/models.test.ts`（node）で、「同じ部品は geometry を使い回す」（`models.test.ts:14-18`）がお手本。

### 2. 長押しの玉の指

今のコードは `src/lib/games/border-rush/Orbs.svelte:1-36` にある（ファイルは 176 行）。

```svelte
<script lang="ts">
  import type { Player } from '$lib/player';
  import type { Orb } from './engine';

  let {
    orbs,
    holding,
    ongrab,
    onrelease
  }: {
    orbs: Orb[];
    holding: number[];
    ongrab: (event: PointerEvent, orb: Orb, by: Player) => void;
    onrelease: (id: number) => void;
  } = $props();

  const label = (orb: Orb, by: Player) =>
    `プレイヤー${by}の${orb.kind === 'hold' ? '長押しの玉' : orb.kind === 'contest' ? '奪い合いの玉' : '玉'}`;
</script>

{#each orbs as orb (orb.id)}
  {#if orb.owner !== null}
    <button
      class="orb {orb.kind} p{orb.owner}"
      class:holding={holding.includes(orb.id)}
      style:left="{orb.x * 100}%"
      style:top="{orb.y * 100}%"
      aria-label={label(orb, orb.owner)}
      onpointerdown={(e) => ongrab(e, orb, orb.owner as Player)}
      onpointerup={() => onrelease(orb.id)}
      onpointercancel={() => onrelease(orb.id)}
    >
      {#if orb.kind === 'hold'}<span class="fill"></span>{/if}
    </button>
  {/if}
{/each}
```

`ongrab` と `onrelease` は `src/lib/games/border-rush/BorderRush.svelte:77-91` の `grab` と `release` で、`release` は
`endHold(game, id)`（`engine.ts:144-146`、長押しの経過を消す）を呼ぶ。長押しの玉は `grab` の中で `capture(event)` するので、
押さえた指の `pointerup` は指が玉から外れても玉に届く。ほかの指でも、玉の上で離せば玉に `pointerup` が届き、`onrelease` が呼ばれる。

### 3. 盤面が低いときの縮尺

3 か所とも `resize()` の 1 行で、`input.px(1, 1)` の盤面の大きさから世界の縮尺を出す。

- `src/lib/games/dentist/Dentist.svelte:99` は `const scale = Math.min(w, (h - TOP) / WORLD_H);`（`TOP` は 130、`Dentist.svelte:32`）
- `src/lib/games/dog-guard/DogGuard.svelte:63` は `const scale = Math.min(w, (h - TOP) / WORLD_H);`（`TOP` は 90、`DogGuard.svelte:16`）
- `src/lib/games/pin-rescue/PinRescue.svelte:50` は `const scale = Math.min(w, (h - 96) / WORLD_H);`

縮尺は指の位置を世界の座標に直すときの割る数になる（例 `Dentist.svelte:58-61` の `toWorld` は `(px - view.ox) / view.scale`）。
高さが 0 のときは `BoardInput.observe` が `onResize` を呼ばないので、ここに来るのは高さが 1px 以上で上の帯以下のときだけ。
ファイルの行数は `Dentist.svelte` が 191、`DogGuard.svelte` が 187、`PinRescue.svelte` が 165 で、この直しでは増やさない。

### 規約

- コードのコメントは、コードから読み取れない WHY だけを日本語で書く。変更の経緯や計画の番号は書かない
- テストの名前は日本語の文にする
- `.svelte` のファイルは 200 行未満に保つ（svelte-vitals の `architecture/component-size`。ファイル全体の行数）

## Commands you will need

| Purpose       | Command                                                                                                     | Expected on success           |
| ------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 足すテスト    | `pnpm exec vitest run src/lib/games/snow-camp/models.test.ts src/lib/games/border-rush/Orbs.svelte.test.ts` | すべて pass                   |
| 全部のテスト  | `pnpm test:run`                                                                                             | すべて pass                   |
| 型            | `pnpm check`                                                                                                | `0 ERRORS 0 WARNINGS`、exit 0 |
| lint          | `pnpm lint`                                                                                                 | exit 0                        |
| svelte-vitals | `pnpm vitals --diff`                                                                                        | 警告 0                        |
| 全部          | `pnpm verify`                                                                                               | exit 0                        |

ブラウザの道具は使わない（この計画では要らない）。

## Scope

**In scope**

- `src/lib/games/snow-camp/models.ts`（`bowl()` を足す）
- `src/lib/games/snow-camp/models.test.ts`（テストを 1 つ足す）
- `src/lib/games/snow-camp/world3d.ts`（お皿を作る 5 行と import の 1 行）
- `src/lib/games/border-rush/Orbs.svelte`
- `src/lib/games/border-rush/Orbs.svelte.test.ts`（新しく作る）
- `src/lib/games/dentist/Dentist.svelte`・`src/lib/games/dog-guard/DogGuard.svelte`・`src/lib/games/pin-rescue/PinRescue.svelte`（それぞれ 1 行）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- `world3d.ts` の `dispose()`。使い回す形は捨てない決まりのまま
- 雪原のほかの部品（コイン・肉など。もう使い回している）
- `BorderRush.svelte` の `grab` / `release` と、`onrelease` の引数の形。玉のボタンの中だけで直す
- 長押しの玉を押さえた指の `pointerup` が届かなかったとき（その長押しは 700ms で終わって玉が弾けるので、止まりはしない）
- 3 つのゲームの `view.ox` / `view.oy` の式と、上の帯の高さ

## Git workflow

- ブランチは `advisor/076-small-game-fixes`
- コミットは 3 つ（直し 1 つにつき 1 つ）。英語の命令形 1 文で、`Co-Authored-By` などの末尾の行は付けない
  1. `Reuse the meal bowl geometry in snow camp`
  2. `End a hold only when the finger holding the orb lifts`
  3. `Keep the world scale positive on very short boards`
- push しない（`main` への push は本番に出る）

## Steps

### Step 1: 雪原のお皿の形を使い回す（コミット 1）

先に `src/lib/games/snow-camp/models.test.ts` の import を `import { bear, bowl, pine } from './models';` にし、
`describe('snow-camp models', …)` の最後に次のテストを足す。

```ts
it('机のお皿は geometry を使い回す', () => {
  const [a, b] = [meshes(bowl()), meshes(bowl())];
  expect(a).toHaveLength(2);
  a.forEach((m, i) => expect(m.geometry).toBe(b[i].geometry));
});
```

`pnpm exec vitest run src/lib/games/snow-camp/models.test.ts` で、足したテストが落ちる（`bowl is not a function`。ファイルごと落ちることもある）ことを確かめる。

次に `src/lib/games/snow-camp/models.ts` の `coin()` のすぐ下に足す。

```ts
/** 机に出すシチューのお皿 */
export function bowl() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.018, 0.012, 0.014, 14), '#ffffff', 0, 0, 0, {}, false));
  g.add(mesh(cyl(0.016, 0.016, 0.004, 14), '#c2542b', 0, 0.006, 0, {}, false));
  return g;
}
```

`src/lib/games/snow-camp/world3d.ts` の import（`world3d.ts:15`）に `bowl` を足し（並びは今のアルファベット順に合わせて
`badge, bear, bowl, coin, …`）、`world3d.ts:343-347` の 5 行（`const bowl = new THREE.Group();` から `bowl.add(cup, stew);` まで）を
`const b = bowl();` の 1 行にして、続く 2 行の `bowl` を `b` にする。できあがりは次の形。

```ts
while (this.#meals.children.length < Math.min(state.meals, 6)) {
  const i = this.#meals.children.length;
  const b = bowl();
  b.position.set(-0.06 + (i % 3) * 0.06, 0, i < 3 ? -0.015 : 0.02);
  this.#meals.add(b);
}
```

お皿を下げる行（`world3d.ts:351`）は変えない（形は使い回すので捨てない）。

**Verify**:

- `pnpm exec vitest run src/lib/games/snow-camp/` → すべて pass
- `grep -c "CylinderGeometry" src/lib/games/snow-camp/world3d.ts` → 0
- `pnpm check` → `0 ERRORS 0 WARNINGS`

ここで `pnpm exec prettier --write src/lib/games/snow-camp/models.ts src/lib/games/snow-camp/models.test.ts src/lib/games/snow-camp/world3d.ts` を
通してからコミット 1 を作る。

### Step 2: 長押しの玉は、押さえている指が離れたときだけ終える（コミット 2）

先に `src/lib/games/border-rush/Orbs.svelte.test.ts` を新しく作る（`.svelte.test.ts` なので happy-dom の project で動く。
組み立て方のお手本は `src/lib/components/GameShell.svelte.test.ts`）。

```ts
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Orb } from './engine';
import Orbs from './Orbs.svelte';

const hold: Orb = { id: 7, kind: 'hold', owner: 1, x: 0.5, y: 0.7, bornAt: 0 };

function show() {
  const onrelease = vi.fn();
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Orbs, { target, props: { orbs: [hold], holding: [], ongrab: () => {}, onrelease } });
  flushSync();
  const orb = target.querySelector('button.orb') as HTMLButtonElement;
  const fire = (type: string, pointerId: number) =>
    orb.dispatchEvent(new PointerEvent(type, { pointerId, pointerType: 'touch', bubbles: true }));
  return { app, onrelease, fire };
}

describe('Orbs', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('長押しの玉の上でほかの指を離しても、押さえている指の長押しは終わらない', () => {
    const { app, onrelease, fire } = show();
    fire('pointerdown', 1);
    fire('pointerdown', 2);
    fire('pointerup', 2);
    expect(onrelease).not.toHaveBeenCalled();
    fire('pointerup', 1);
    expect(onrelease).toHaveBeenCalledExactlyOnceWith(7);
    unmount(app);
  });

  it('押さえている指を OS に取り上げられたら長押しを終える', () => {
    const { app, onrelease, fire } = show();
    fire('pointerdown', 1);
    fire('pointercancel', 1);
    expect(onrelease).toHaveBeenCalledExactlyOnceWith(7);
    unmount(app);
  });
});
```

`pnpm exec vitest run src/lib/games/border-rush/Orbs.svelte.test.ts` で、1 つめだけが落ちる（指 2 を離したときに `onrelease` が
呼ばれる）ことを確かめる。`toHaveBeenCalledExactlyOnceWith` が無いと言われたら、`toHaveBeenCalledTimes(1)` と
`toHaveBeenCalledWith(7)` の 2 行に分ける。

次に `src/lib/games/border-rush/Orbs.svelte` を直す。`label` の下に次を足す（`Map` は画面に出さないので `$state` にしない）。

```ts
/** 長押しの玉の id → 先に押さえた指。ほかの指を玉の上で離しても、押さえている指の長押しは終わらせない */
const grips = new Map<number, number>();

function grab(event: PointerEvent, orb: Orb) {
  if (orb.kind === 'hold' && !grips.has(orb.id)) grips.set(orb.id, event.pointerId);
  ongrab(event, orb, orb.owner as Player);
}

function release(event: PointerEvent, id: number) {
  if (grips.get(id) !== event.pointerId) return;
  grips.delete(id);
  onrelease(id);
}
```

1 つめの `{#each}` の `<button>` の 3 行を次にする（2 つめの `{#each}` の奪い合いの玉は変えない）。

```svelte
onpointerdown={(e) => grab(e, orb)}
onpointerup={(e) => release(e, orb.id)}
onpointercancel={(e) => release(e, orb.id)}
```

ふつうの玉（`kind` が `tap`）は押した瞬間に弾けて消えるので、`grips` に入れず、離しても `onrelease` を呼ばない。今の
`onrelease` はふつうの玉では `endHold` が何も消さないだけなので、ふるまいは変わらない。

**Verify**:

- `pnpm exec vitest run src/lib/games/border-rush/` → すべて pass
- `wc -l < src/lib/games/border-rush/Orbs.svelte` → 200 未満（190 前後）
- `pnpm check` → `0 ERRORS 0 WARNINGS`

`pnpm exec prettier --write src/lib/games/border-rush/Orbs.svelte src/lib/games/border-rush/Orbs.svelte.test.ts` を通してからコミット 2 を作る。

### Step 3: 縮尺を正に保つ（コミット 3）

3 か所の行を、`Math.min(…)` を `Math.max(1, …)` で包んだ形にする（ほかの字は変えない）。

- `src/lib/games/dentist/Dentist.svelte:99` は `const scale = Math.max(1, Math.min(w, (h - TOP) / WORLD_H));`
- `src/lib/games/dog-guard/DogGuard.svelte:63` は `const scale = Math.max(1, Math.min(w, (h - TOP) / WORLD_H));`
- `src/lib/games/pin-rescue/PinRescue.svelte:50` は `const scale = Math.max(1, Math.min(w, (h - 96) / WORLD_H));`

コメントは足さない（行数を増やさないため。理由はこの計画とコミットにある）。テストも足さない（`resize()` は canvas の
コンポーネントの中にあり、組み立てて試すには描くところを全部差し替える必要がある。型と今のテストで確かめる）。

**Verify**:

- `grep -c "Math.max(1, Math.min(w, (h - " src/lib/games/dentist/Dentist.svelte src/lib/games/dog-guard/DogGuard.svelte src/lib/games/pin-rescue/PinRescue.svelte` → それぞれ 1
- `wc -l src/lib/games/dentist/Dentist.svelte src/lib/games/dog-guard/DogGuard.svelte src/lib/games/pin-rescue/PinRescue.svelte` → 191・187・165 のまま
- `pnpm exec vitest run src/lib/games/dentist/ src/lib/games/dog-guard/ src/lib/games/pin-rescue/` → すべて pass
- `pnpm check` → `0 ERRORS 0 WARNINGS`

`pnpm exec prettier --write` を 3 つのファイルに通してからコミット 3 を作る。

### Step 4: 全体の確かめ

**Verify**:

- `pnpm verify` → exit 0
- `git log --oneline -3` → 上の 3 つのコミットが 1 つずつ並ぶ

## Test plan

- `src/lib/games/snow-camp/models.test.ts` に 1 つ。2 回作ったお皿の 2 つの Mesh が同じ geometry を持つ（お手本は同じファイルの
  「同じ部品は geometry を使い回す」）
- `src/lib/games/border-rush/Orbs.svelte.test.ts` を作り 2 つ。ほかの指を玉の上で離しても `onrelease` を呼ばず、押さえた指を
  離したときに 1 回だけ呼ぶ。押さえた指の `pointercancel` でも終える
- 縮尺の直しは型と今のテストで確かめる（上の理由で新しいテストは足さない）

## Done criteria

- [ ] `pnpm exec vitest run src/lib/games/snow-camp/models.test.ts src/lib/games/border-rush/Orbs.svelte.test.ts` が pass し、足した 3 つを含む
- [ ] `grep -c "CylinderGeometry" src/lib/games/snow-camp/world3d.ts` が 0
- [ ] `grep -n "export function bowl" src/lib/games/snow-camp/models.ts` が 1 行
- [ ] `grep -n "grips.get(id) !== event.pointerId" src/lib/games/border-rush/Orbs.svelte` が 1 行
- [ ] `wc -l < src/lib/games/border-rush/Orbs.svelte` が 200 未満
- [ ] 3 つのゲームの `resize()` の縮尺の行が `Math.max(1, ` で始まる
- [ ] `pnpm verify` が exit 0
- [ ] コミットが 3 つで、どれにも `Co-Authored-By` などの末尾の行が無い
- [ ] `git status` で in scope 以外のファイルが変わっていない
- [ ] `plans/README.md` の 076 の行を更新し、`pnpm exec prettier --write plans/README.md` を通した

## STOP 条件

- 上の抜粋（お皿の `while`・`models.ts` の `mesh` / `geo` / `cyl` / `coin`・`Orbs.svelte` の玉のボタン・3 つの縮尺の行）が今のコードと違う
- `models.ts` に `bowl` という名前がもうある、または `world3d.ts` で `b` という名前がお皿の `while` の中ですでに使われている
- `Orbs.svelte` が 200 行以上になる。足す行を削る道を探さずに報告する
- `pnpm exec vitest run src/lib/games/border-rush/` で、もとからある `engine.test.ts` が落ちる
- Svelte が `onpointercancel` を玉のボタンに付けない（テストの 2 つめが直したあとも落ちる）など、テストの仕掛けが合わない
- 縮尺の直しで行が折り返されて、3 つのファイルのどれかの行数が増える

## Maintenance notes

- 雪原のお皿の形を変えるときは `models.ts` の `bowl()` を直す。形の寸法を変えると `geo()` のキーも変わり、新しい形が 1 つ増えるだけで済む
- 長押しの玉は「先に押さえた指」だけが長押しを終えられる。先の指を離して後の指を残したときは、そこで長押しが終わる
  （後の指に引き継がない）。引き継ぎたくなったら `grips` に指の並びを持つ
- `grips` は弾けて消えた玉の番号を消さずに持つが、1 回の対戦のあいだの数十個で、対戦が終わるとコンポーネントごと捨てる
- 縮尺の下限 1 は「盤面の高さが上の帯より低いときに壊れない」ためだけの値で、そのときの見た目は気にしていない。
  とても小さい窓でも遊べるようにするなら、上の帯の高さを盤面に合わせて縮めるところから考える
