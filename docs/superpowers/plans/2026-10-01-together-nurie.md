# みんなでぬりえ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** おえかきのもりに 3 つ目の遊び方「みんなでぬりえ」を足し、つないだ端末で同じ線画をいっしょに塗れるようにする。

**Architecture:** ぬりえの部品を `src/lib/coloring/` へ移して、ぬりえとおえかきのもりの両方から使う。親は線画を縮めて全員へ配り（`wire.ts`）、塗る・戻すの操作を受けて順番を決め（`together.ts` の純粋な規則）、色の変化を全員へ配る。画面と親の処理は `Together.svelte` 1 つにまとめる。

**Tech Stack:** SvelteKit（Svelte 5 runes、TypeScript）、WebRTC DataChannel（`Party`）、`CompressionStream`、vitest、playwright-core。

**Spec:** `docs/superpowers/specs/2026-10-01-together-nurie-design.md`

## Global Constraints

- 遊び方選びに「みんなでぬりえ」を足す。2 人から選べる。
- 親が絵を選ぶ（テンプレート 8 枚か、しゃしんから つくる）。子には「おやが えを えらんでいます…」。
- 線画は、テンプレートでも線画そのもの（1 画素 1 ビットに詰めて `deflate-raw` で縮めた base64）を 1 通で配る。
- 塗る・戻すは親に送り、親が順番を決めて全員に配る。押した端末も、親から届いてから色を変える。
- 「1つ もどす」は押した人の手順を新しい順に見て、いまの色がその手順で塗った色のままなら戻す。違えば捨てて前を見る。
- 親だけに「できた！」。押すと全員に出来上がりを見せ、全員のぬりえちょうに新しい作品として入れる（線画と色の表。戻す手順は入れない）。出来上がりでは全員が「しゃしんに ほぞん」、親の「あそびを えらぶ」で遊び方選びへ、子には「おやが つぎの あそびを えらぶのを まってね」。
- ぬりえ（ひとりで）の動きは変えない。
- `.svelte` は 200 行未満。コメントは非自明な WHY だけ、日本語。絵文字は使わない。

## Review Focus

1. 子が線画を縮めて戻している途中（非同期）に、親から塗った色が届いても落とさないこと。`Together.svelte` は届いた知らせを 1 本の Promise の列で順に処理する。Task 4 の通しの確認で、親が塗り始めを急いでも子の色がそろうかを見る。
2. 親が別の絵を選び直したとき（出来上がりのあと「あそびを えらぶ」→ 再びみんなでぬりえ）、前の絵の塗り手順が残らないこと。`Together.svelte` を作り直すので状態は残らない。Task 4 で見る。
3. 写真の線画が DataChannel の 1 通に収まること。Task 2 のテストで、テンプレートの線画が 16 KB 未満になることを固め、Task 4 で写真も通す。
4. 部品を移したあと、ぬりえ（ひとりで）が同じように動くこと。Task 1 で既存のテストと一覧の絵の撮影を通す。
5. 子が抜けても、残りの人の塗りが続くこと。`Party` の既存の扱いのまま。Task 4 の確認で 1 人抜けたあとも塗れるかを見る。

---

### Task 1: ぬりえの部品を `src/lib/coloring/` へ移す

**Files:**

- Move: `src/lib/games/nurie/{regions,paint,lineart,templates,art,book,sounds}.ts`、`{regions,paint,lineart,templates,book}.test.ts`、`{Canvas,Palette,PhotoMaker,Picker}.svelte`、`Picker.svelte.test.ts` → `src/lib/coloring/`
- Modify: `src/lib/games/nurie/Nurie.svelte`、`src/lib/games/nurie/Nurie.svelte.test.ts`、`src/lib/games/nurie/test/CanvasStub.svelte`
- Modify: `src/lib/coloring/Palette.svelte`（「できた！」を渡されたときだけ出す）

**Interfaces:**

- Produces: `$lib/coloring/*` の中身は移す前と同じ名前と形。`Palette` の `ondone` は省ける（`ondone?: () => void`）

- [ ] **Step 1: 移す**

```bash
mkdir -p src/lib/coloring
for f in regions.ts regions.test.ts paint.ts paint.test.ts lineart.ts lineart.test.ts templates.ts templates.test.ts art.ts book.ts book.test.ts sounds.ts Canvas.svelte Palette.svelte PhotoMaker.svelte Picker.svelte Picker.svelte.test.ts; do git mv src/lib/games/nurie/$f src/lib/coloring/$f; done
```

- [ ] **Step 2: 読み込み先を直す**

`Nurie.svelte` の `./art` `./book` `./Canvas.svelte` `./paint` `./Palette.svelte` `./PhotoMaker.svelte` `./Picker.svelte` `./regions` `./sounds` `./templates` を、それぞれ `$lib/coloring/…` にする。

`Nurie.svelte.test.ts` の `./book`（import と `vi.mock` と `vi.importActual` の 3 か所）・`./regions`・`./art`・`./Canvas.svelte`・`./sounds` を `$lib/coloring/…` にする。`vi.mock('$lib/coloring/Canvas.svelte', async () => ({ default: (await import('./test/CanvasStub.svelte')).default }))` の差し替え先はそのまま。

`test/CanvasStub.svelte` の `../regions` を `$lib/coloring/regions` にする。

- [ ] **Step 3: `Palette.svelte` の「できた！」を省けるようにする**

props の型を `ondone?: () => void` にし、ボタンを次にする。

```svelte
{#if ondone}<button class="pill gold" onclick={ondone}>できた！</button>{/if}
```

- [ ] **Step 4: 検査**

Run: `pnpm check && pnpm lint && pnpm test:run`
Expected: すべて通る（ぬりえのテストは移した先でそのまま通る）

Run: `pnpm thumbs nurie`
Expected: 前と同じ一覧の絵が撮れる（Read で見る）

- [ ] **Step 5: コミット**

```bash
git add -A src/lib/coloring src/lib/games/nurie static/thumbs/nurie.webp
git commit -m "Move the ぬりえ building blocks to src/lib/coloring so おえかきのもり can share them"
```

### Task 2: 線画を縮めて送る形にする `wire.ts`

**Files:**

- Create: `src/lib/coloring/wire.ts`
- Test: `src/lib/coloring/wire.test.ts`

**Interfaces:**

- Consumes: `pack` / `unpack`（`$lib/coloring/book`）、`SIZE`（`$lib/coloring/regions`）
- Produces: `encodeLines(mask: Uint8Array): Promise<string>`、`decodeLines(text: string): Promise<Uint8Array>`

- [ ] **Step 1: 失敗するテストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { SIZE } from './regions';
import { decodeLines, encodeLines } from './wire';

/** テンプレートくらいの線画。太さ 11 画素の円を 3 つ描く */
function rings(): Uint8Array {
  const mask = new Uint8Array(SIZE * SIZE);
  for (const [cx, cy, r] of [
    [384, 384, 300],
    [300, 300, 60],
    [470, 300, 60]
  ]) {
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (Math.abs(Math.hypot(x - cx, y - cy) - r) < 5.5) mask[y * SIZE + x] = 1;
      }
    }
  }
  return mask;
}

describe('encodeLines と decodeLines', () => {
  it('線画を縮めて base64 にし、元に戻せる', async () => {
    const mask = rings();
    const text = await encodeLines(mask);
    expect(text).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(await decodeLines(text)).toEqual(mask);
  });

  it('テンプレートくらいの線画は 16 KB より小さい', async () => {
    expect((await encodeLines(rings())).length).toBeLessThan(16 * 1024);
  });
});
```

Run: `pnpm vitest run src/lib/coloring/wire.test.ts`
Expected: FAIL（`./wire` が無い）

- [ ] **Step 2: 書く**

```ts
import { pack, unpack } from './book';

/** DataChannel の 1 通に収めるため、1 ビットに詰めた線画をさらに縮めて base64 にする */
export async function encodeLines(mask: Uint8Array): Promise<string> {
  const stream = new Blob([pack(mask)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let text = '';
  // 大きな配列を String.fromCharCode(...) に広げると引数の上限を超えるので、少しずつつなぐ
  for (let i = 0; i < bytes.length; i += 4096) text += String.fromCharCode(...bytes.subarray(i, i + 4096));
  return btoa(text);
}

export async function decodeLines(text: string): Promise<Uint8Array> {
  const bytes = Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return unpack(new Uint8Array(await new Response(stream).arrayBuffer()));
}
```

Run: `pnpm vitest run src/lib/coloring/wire.test.ts`
Expected: PASS

- [ ] **Step 3: コミット**

```bash
git add src/lib/coloring/wire.ts src/lib/coloring/wire.test.ts
git commit -m "Add compressed base64 encoding of ぬりえ line art for sending over the party link"
```

### Task 3: みんなで塗る規則 `together.ts`

**Files:**

- Create: `src/lib/games/oekaki-mori/together.ts`
- Test: `src/lib/games/oekaki-mori/together.test.ts`

**Interfaces:**

- Consumes: `Seat`（`$lib/net/party.svelte`、型だけ）
- Produces:
  - `interface Dab { seat: Seat; region: number; before: string | null; after: string }`
  - `interface Shared { colors: Record<number, string>; dabs: Dab[] }`
  - `interface Change { region: number; color: string | null }`
  - `shared(): Shared`、`paintBy(s: Shared, seat: Seat, region: number, color: string): Change | null`、`undoBy(s: Shared, seat: Seat): Change | null`（`s` を書き換える。親だけが持つ）

- [ ] **Step 1: 失敗するテストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { paintBy, shared, undoBy } from './together';

describe('paintBy', () => {
  it('塗った場所と色を返し、表に入れる', () => {
    const s = shared();
    expect(paintBy(s, 2, 5, '#f00')).toEqual({ region: 5, color: '#f00' });
    expect(s.colors).toEqual({ 5: '#f00' });
  });

  it('同じ色での塗り直しと、場所の無いところ（-1）は何もしない', () => {
    const s = shared();
    paintBy(s, 2, 5, '#f00');
    expect(paintBy(s, 3, 5, '#f00')).toBeNull();
    expect(paintBy(s, 3, -1, '#f00')).toBeNull();
    expect(s.dabs).toHaveLength(1);
  });
});

describe('undoBy', () => {
  it('押した人の塗りだけを新しい順に戻す', () => {
    const s = shared();
    paintBy(s, 2, 1, '#f00');
    paintBy(s, 3, 2, '#0f0');
    paintBy(s, 2, 1, '#00f');
    expect(undoBy(s, 2)).toEqual({ region: 1, color: '#f00' });
    expect(undoBy(s, 2)).toEqual({ region: 1, color: null });
    expect(s.colors).toEqual({ 2: '#0f0' });
  });

  it('ほかの人が上から塗ったところは飛ばして、その前の自分の塗りを戻す', () => {
    const s = shared();
    paintBy(s, 2, 1, '#f00');
    paintBy(s, 2, 2, '#f00');
    paintBy(s, 3, 2, '#00f');
    expect(undoBy(s, 2)).toEqual({ region: 1, color: null });
    expect(s.colors).toEqual({ 2: '#00f' });
  });

  it('上から塗った人が戻すと、下の人の色に戻り、その人はさらに戻せる', () => {
    const s = shared();
    paintBy(s, 2, 1, '#f00');
    paintBy(s, 3, 1, '#00f');
    expect(undoBy(s, 3)).toEqual({ region: 1, color: '#f00' });
    expect(undoBy(s, 2)).toEqual({ region: 1, color: null });
  });

  it('戻せる手順が無ければ何もしない', () => {
    const s = shared();
    paintBy(s, 3, 1, '#00f');
    expect(undoBy(s, 2)).toBeNull();
    expect(s.colors).toEqual({ 1: '#00f' });
  });
});
```

Run: `pnpm vitest run src/lib/games/oekaki-mori/together.test.ts`
Expected: FAIL

- [ ] **Step 2: 書く**

```ts
import type { Seat } from '$lib/net/party.svelte';

/** 1 回の塗り。戻すときに、いまの色がこの塗りのままかを after で確かめる */
export interface Dab {
  seat: Seat;
  region: number;
  before: string | null;
  after: string;
}

/** 親だけが持つ。子には Change だけを配る */
export interface Shared {
  colors: Record<number, string>;
  dabs: Dab[];
}

/** 全員に配る色の変化。color が null なら塗っていない白に戻す */
export interface Change {
  region: number;
  color: string | null;
}

export const shared = (): Shared => ({ colors: {}, dabs: [] });

export function paintBy(s: Shared, seat: Seat, region: number, color: string): Change | null {
  if (region < 0 || s.colors[region] === color) return null;
  s.dabs.push({ seat, region, before: s.colors[region] ?? null, after: color });
  s.colors[region] = color;
  return { region, color };
}

/** 押した人の塗りを新しい順に見て、ほかの人が上から塗っていたら捨てて前を見る（押しても何も起きない、を減らす） */
export function undoBy(s: Shared, seat: Seat): Change | null {
  for (let i = s.dabs.length - 1; i >= 0; i--) {
    const dab = s.dabs[i];
    if (dab.seat !== seat) continue;
    s.dabs.splice(i, 1);
    if (s.colors[dab.region] !== dab.after) continue;
    if (dab.before === null) delete s.colors[dab.region];
    else s.colors[dab.region] = dab.before;
    return { region: dab.region, color: dab.before };
  }
  return null;
}
```

Run: `pnpm vitest run src/lib/games/oekaki-mori/together.test.ts`
Expected: PASS

- [ ] **Step 3: コミット**

```bash
git add src/lib/games/oekaki-mori/together.ts src/lib/games/oekaki-mori/together.test.ts
git commit -m "Add the みんなでぬりえ rules: host-ordered fills and per-player undo that skips overwritten regions"
```

### Task 4: `Together.svelte` と遊び方選び、通しの確認、本番

**Files:**

- Create: `src/lib/games/oekaki-mori/Together.svelte`
- Modify: `src/lib/games/oekaki-mori/ModeSelect.svelte`
- Modify: `src/lib/games/oekaki-mori/OekakiMori.svelte`
- Modify: `CLAUDE.md`
- Modify: `<scratchpad>/party-play.mjs`（リポジトリには入れない）

**Interfaces:**

- Consumes: `$lib/coloring/*`（Task 1）、`encodeLines` / `decodeLines`（Task 2）、`shared` / `paintBy` / `undoBy`（Task 3）、`Party`（`$lib/net/party.svelte`）
- Produces:
  - 知らせ：`{ t: 'art', template: string | null, lines: string }`、`{ t: 'painted', region, color }`、`{ t: 'finished' }`、画面の切り替え `{ t: 'screen', screen: 'together' }`
  - 操作：`{ t: 'paint', region, color }`、`{ t: 'unpaint' }`
  - `<Together party={Party} onagain={() => void} />`
  - `ModeSelect` の `onpick: (mode: Mode | 'together') => void`

- [ ] **Step 1: `Together.svelte` を書く**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { photoArt, snapshot, templateArt, type Art } from '$lib/coloring/art';
  import { pack, saveWork } from '$lib/coloring/book';
  import Canvas from '$lib/coloring/Canvas.svelte';
  import Palette, { COLORS } from '$lib/coloring/Palette.svelte';
  import PhotoMaker from '$lib/coloring/PhotoMaker.svelte';
  import Picker from '$lib/coloring/Picker.svelte';
  import { label, type Regions } from '$lib/coloring/regions';
  import { sounds } from '$lib/coloring/sounds';
  import { TEMPLATES, type Template } from '$lib/coloring/templates';
  import { decodeLines, encodeLines } from '$lib/coloring/wire';
  import type { Message } from '$lib/net/link';
  import type { Party } from '$lib/net/party.svelte';
  import { saveImage } from '$lib/share';
  import { paintBy, shared, undoBy } from './together';

  let { party, onagain }: { party: Party; onagain: () => void } = $props();

  let phase = $state<'pick' | 'photo' | 'wait' | 'paint' | 'done'>('wait');
  let sheet = $state.raw<{ art: Art; regions: Regions; mask: Uint8Array; template?: string } | null>(null);
  let colors = $state.raw<Record<number, string>>({});
  let color = $state<string>(COLORS[0].hex);
  /** 親だけが使う。塗った順番と、戻すための手順 */
  let host = shared();
  /** 線画を戻すのは非同期なので、そのあいだに届いた塗りを落とさないよう、届いた順に 1 本の列で処理する */
  let queue = Promise.resolve();

  async function send(mask: Uint8Array, template?: Template) {
    host = shared();
    party.tell('all', { t: 'art', template: template?.id ?? null, lines: await encodeLines(mask) });
  }

  async function receive(m: Message) {
    if (m.t === 'art') {
      const mask = await decodeLines(String(m.lines));
      const template = TEMPLATES.find((t) => t.id === m.template);
      // 場所は配られた線画で分ける。端末ごとにテンプレートを描き直すと、番号がずれることがある
      sheet = {
        art: template ? templateArt(template) : photoArt(mask),
        regions: label(mask),
        mask,
        template: template?.id
      };
      colors = {};
      phase = 'paint';
    } else if (m.t === 'painted') {
      const next = { ...colors };
      if (m.color === null) delete next[Number(m.region)];
      else next[Number(m.region)] = String(m.color);
      colors = next;
    } else if (m.t === 'finished') finish();
  }

  function finish() {
    phase = 'done';
    sounds.done();
    const s = sheet;
    if (!s) return;
    const bits = pack(s.mask);
    const thumb = snapshot(s.art, s.regions, colors, 200, 'image/jpeg');
    const photo = s.template ? undefined : bits;
    const lines = s.template ? bits : undefined;
    const work = { id: crypto.randomUUID(), template: s.template, photo, lines, colors, history: [], thumb };
    saveWork({ ...work, updated: Date.now() }).catch(() => {});
  }

  function exportImage() {
    if (sheet) saveImage(snapshot(sheet.art, sheet.regions, colors, 1536), 'nurie.png');
  }

  onMount(() => {
    phase = party.host ? 'pick' : 'wait';
    const off = [party.onTell((m) => (queue = queue.then(() => receive(m)).catch(() => {})))];
    if (party.host)
      off.push(
        party.onAct((m, from) => {
          const change =
            m.t === 'paint'
              ? paintBy(host, from, Number(m.region), String(m.color))
              : m.t === 'unpaint'
                ? undoBy(host, from)
                : null;
          if (change) party.tell('all', { t: 'painted', ...change });
        })
      );
    return () => off.forEach((stop) => stop());
  });
</script>

{#if phase === 'pick'}
  <Picker
    works={[]}
    ontemplate={(t) => send(templateArt(t).mask, t)}
    onwork={() => {}}
    onphoto={() => (phase = 'photo')}
    onremove={() => {}}
  />
{:else if phase === 'photo'}
  <PhotoMaker onmake={(mask) => send(mask)} onback={() => (phase = 'pick')} />
{:else if phase === 'wait' || !sheet}
  <p class="wait" role="status">おやが えを えらんでいます…</p>
{:else}
  <div class="middle">
    <Canvas
      art={sheet.art}
      regions={sheet.regions}
      {colors}
      onfill={(region) => {
        if (phase !== 'paint') return;
        party.act({ t: 'paint', region, color });
        sounds.fill();
      }}
    />
    {#if phase === 'done'}
      <div class="finished">
        <p class="yuru">できた！</p>
        <button class="pill" onclick={exportImage}>しゃしんに ほぞん</button>
        {#if party.host}
          <button class="pill gold" onclick={onagain}>あそびを えらぶ</button>
        {:else}
          <p role="status">おやが つぎの あそびを えらぶのを まってね</p>
        {/if}
      </div>
    {/if}
  </div>
  {#if phase === 'paint'}
    <Palette
      bind:color
      canUndo={true}
      onundo={() => {
        party.act({ t: 'unpaint' });
        sounds.undo();
      }}
      ondone={party.host ? () => party.tell('all', { t: 'finished' }) : undefined}
      onsave={exportImage}
    />
  {/if}
{/if}

<style>
  .middle {
    position: relative;
    flex: 1;
    display: grid;
    place-items: center;
    min-height: 0;
    /* 上の隅の ✕ などに線画の角が重ならないよう空けておく */
    padding: max(68px, env(safe-area-inset-top)) 12px 12px;
    container-type: size;
  }

  .wait {
    flex: 1;
    display: grid;
    place-items: center;
    color: var(--line);
    font-weight: 800;
  }

  .finished {
    position: absolute;
    bottom: 16px;
    display: grid;
    justify-items: center;
    gap: 10px;
    padding: 16px 24px;
    border: 3px solid var(--line);
    border-radius: 20px;
    background: var(--paper);
    box-shadow: var(--soft-shadow);
    color: var(--line);
    font-weight: 800;
  }

  .finished .yuru {
    font-size: clamp(28px, 6cqh, 48px);
  }
</style>
```

`Palette` の「1つ もどす」は、自分の塗りが残っているかを子の端末では知らないので、いつも押せるようにする（`canUndo={true}`。戻せる手順が無ければ親で何も起きない）。

- [ ] **Step 2: 遊び方選びと親の画面を切り替える**

`ModeSelect.svelte` の `onpick` を `(mode: Mode | 'together') => void` にし、はやおし検定のボタンの次に足す。

```svelte
<button class="pill gold choice" disabled={party.members.length < 2} onclick={() => onpick('together')}>
  みんなでぬりえ
  <small>おなじ えを みんなで いっしょに ぬる</small>
</button>
```

`OekakiMori.svelte` は次のようにする。

- `import Together from './Together.svelte';` を足す
- `screen` の型に `'together'` を足し、`receive` の `screen = m.screen as 'lobby' | 'mode'` を `'lobby' | 'mode' | 'together'` にする
- `begin` を次にする

```ts
function begin(mode: Mode | 'together') {
  referee?.stop();
  referee = null;
  if (mode === 'together') return party?.tell('all', { t: 'screen', screen: 'together' });
  referee = new Referee(party!);
  referee.start(mode);
}
```

- 画面の分岐に `{:else if screen === 'together'}<Together {party} onagain={toMode} />` を足す（`screen === 'mode'` の次）。✕ とミュートは `screen !== 'play' && screen !== 'practice'` のままなので、みんなでぬりえでも出る

Run: `pnpm check && pnpm lint && pnpm vitest run src/lib/games/oekaki-mori src/lib/coloring && pnpm vitals --diff`
Expected: エラーなし・PASS・新しい warning なし

- [ ] **Step 3: 3 ページの通しの確認**

`party-play.mjs` に `MODE=together` の分岐を足す。遊び方選びで「みんなでぬりえ」を押したあと、次を回して終わる。

```js
if (MODE === 'together') {
  await host.getByRole('button', { name: 'りんご' }).click();
  await Promise.all(pages.map((p) => p.locator('.sheet canvas').waitFor()));
  await host.waitForTimeout(300);
  const pixel = (p, fx, fy) =>
    p.evaluate(
      ([fx, fy]) => {
        const c = document.querySelector('.sheet canvas');
        return [
          ...c
            .getContext('2d')
            .getImageData(Math.floor(c.width * fx), Math.floor(c.height * fy), 1, 1)
            .data.slice(0, 3)
        ].join(',');
      },
      [fx, fy]
    );
  const tapSheet = (p, fx, fy) =>
    p.evaluate(
      ([fx, fy]) => {
        const el = document.querySelector('.sheet');
        const r = el.getBoundingClientRect();
        const o = {
          pointerId: 9,
          pointerType: 'touch',
          clientX: r.x + r.width * fx,
          clientY: r.y + r.height * fy,
          bubbles: true
        };
        el.dispatchEvent(new PointerEvent('pointerdown', o));
        el.dispatchEvent(new PointerEvent('pointerup', o));
      },
      [fx, fy]
    );
  await g2.getByRole('button', { name: 'あか', exact: true }).click();
  await tapSheet(g2, 0.5, 0.45);
  await host.waitForTimeout(400);
  console.log('red everywhere', await Promise.all(pages.map((p) => pixel(p, 0.5, 0.45))));
  await g3.getByRole('button', { name: 'あお', exact: true }).click();
  await tapSheet(g3, 0.5, 0.45);
  await tapSheet(g3, 0.5, 0.75);
  await host.waitForTimeout(400);
  await g2.getByRole('button', { name: '1つ もどす' }).click();
  await host.waitForTimeout(400);
  console.log('g2 undo skips overwritten', await pixel(host, 0.5, 0.45), await pixel(host, 0.5, 0.75));
  await host.getByRole('button', { name: 'できた！' }).click();
  await Promise.all(pages.map((p) => p.getByText('できた！', { exact: true }).first().waitFor()));
  await host.waitForTimeout(800);
  console.log(
    'works in book',
    await host.evaluate(
      () =>
        new Promise((resolve) => {
          const req = indexedDB.open('asobibako-nurie', 1);
          req.onsuccess = () => {
            const get = req.result.transaction('works').objectStore('works').count();
            get.onsuccess = () => resolve(get.result);
          };
        })
    )
  );
  await host.screenshot({ path: `${out}/together-host.png` });
  await g2.screenshot({ path: `${out}/together-g2.png` });
  await browser.close();
  process.exit(0);
}
```

Run: `MODE=together node <scratchpad>/party-play.mjs <scratchpad>/shots`
Expected:

- `red everywhere` が 3 つとも赤（`240,68,56`）
- `g2 undo skips overwritten` で、(0.5, 0.45) は青のまま（3P が上から塗った）、(0.5, 0.75) は青（3P の塗り。2P の戻すでは変わらない）
- `works in book` が 3（3 ページは同じブラウザの IndexedDB を使うので、全員の分が 1 つの入れ物に入る）
- 撮った 2 枚を Read で見る

Run: `node <scratchpad>/party-play.mjs <scratchpad>/shots` と `MODE=hayaoshi node <scratchpad>/party-play.mjs <scratchpad>/shots`
Expected: 前回と同じ結果（ほかの遊び方が崩れていない）

- [ ] **Step 4: CLAUDE.md を直す**

ぬりえの段落の最初の文の次に「塗る部品（線画・場所の番号・描き方・テンプレート・写真の線画・ぬりえちょう・画面の部品）は、おえかきのもりのみんなでぬりえと共用するので `src/lib/coloring/` に置く。」を足し、段落の中のファイル名はそのまま（`src/lib/coloring/` の中の名前）にする。

おえかきのもりの段落の「遊び方はエゴコロクイズ（…）とはやおし検定（…）で、」を次にする。

```markdown
遊び方はエゴコロクイズ（50 音盤で答える）とはやおし検定（描いている途中で「はやおし！」を押した最初の人にだけ 4 つの候補を出し、外れはおてつき）とみんなでぬりえ（`Together.svelte`。親が選んだ線画を縮めて全員に配り、塗る・戻すは親が順番を決めて色の変化を配る。戻すのは押した人の塗りだけで、ほかの人が上から塗ったところは飛ばす。規則は `together.ts`。親の「できた！」で全員のぬりえちょうに入る）で、
```

- [ ] **Step 5: 全体の検査とコミット**

Run: `pnpm verify`
Expected: すべて通る

```bash
git add src/lib/games/oekaki-mori CLAUDE.md
git commit -m "Add みんなでぬりえ to おえかきのもり: shared line art, host-ordered fills, per-player undo, and a copy in everyone's book"
```

- [ ] **Step 6: 最終の見直しのあと、main に入れて push する**

最終の見直し（別の係）で Critical / Important を直してから、本体の checkout（`/Users/oekazuma/localRepo/asobibako`、main）で `git merge --no-ff claude/two-player-p2p-local-1938fd`、`pnpm install --frozen-lockfile && pnpm test:run`、`git push origin main`。`gh run watch` で配信の完了を見て、`https://oekazuma.github.io/asobibako/games/oekaki-mori` と `/games/nurie` が 200 を返すことを確かめる。
