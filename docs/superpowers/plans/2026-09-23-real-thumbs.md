# 一覧のカードを実際のゲーム画面にする 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 一覧のカードの絵を、各ゲームを実際に動かして撮った WebP 画像に置き換える。

**Architecture:** `pnpm thumbs` が Vite の dev サーバーを立て、`playwright-core` で端末の Chrome を開き、乱数と時計を固定したうえでゲームごとの台本どおりに Pointer Events を送って場面を作り、切り出して WebP で `static/thumbs/` に保存する。本番のゲームのコードには撮影用の分岐を足さない。`GameCard` は画像を出すだけにし、`Thumb.svelte` はなくす。

**Tech Stack:** SvelteKit（Svelte 5）、Vite の `createServer`、`playwright-core`（`channel: 'chrome'`、`page.clock`）、Node 24 の型ストリップで `.ts` のスクリプトを直接実行。

**Spec:** `docs/superpowers/specs/2026-09-23-real-thumbs-design.md`

## Global Constraints

- リポジトリのルートは `/Users/oekazuma/localRepo/table-duel`。作業ブランチは `real-thumbs`。**push しない**
- 画像は `static/thumbs/<id>.webp`、幅 680px・高さ 400px、1 枚 60KB 以下を目安
- 撮影は iPad 縦（CSS で 768 × 1024、`deviceScaleFactor: 2`、タッチあり）。切り出す範囲は CSS px で幅 : 高さ = 680 : 400
- 依存は `pnpm-workspace.yaml` の catalog に足してから `package.json` で `catalog:` を使う（`minimumReleaseAge` あり）。ブラウザはダウンロードしない（`channel: 'chrome'`）
- スクリプトは `scripts/` に置き、`tsconfig.scripts.json` の型チェック（`pnpm check`）を通す。import は拡張子つき（`./thumbs/scenes.ts`）
- 散文・コメントは日本語で WHY だけ。README / CLAUDE.md は今の仕様だけを書く（経緯は書かない）。Markdown は textlint の hook が走るので「- **ラベル**: 値」のリストと述語のあとのコロンを避ける
- 検証は `pnpm verify`。コミットは英語で、末尾に空行と `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

---

### Task 1: 撮影の仕組みと、はいしゃさんの 1 枚

**Files:**

- Modify: `pnpm-workspace.yaml`（catalog に `playwright-core`）、`package.json`（devDependencies と `"thumbs": "node scripts/thumbs.ts"`）
- Create: `scripts/thumbs.ts`、`scripts/thumbs/stage.ts`、`scripts/thumbs/scenes.ts`
- Create: `static/thumbs/dentist.webp`

**Interfaces:**

- Produces: `Scene`（`{ id: string; level?: number; clip: Clip; play: (s: Stage) => Promise<void> }`）、`Stage`（`page`、`touch(id, type, x, y)`、`tap(id, x, y)`、`drag(id, from, to, ms)`、`wait(ms)`、`startSolo(level)`、`startDuel()`）、`SCENES: Scene[]`

- [ ] Step 1. 依存を足す。`pnpm-workspace.yaml` の catalog に `playwright-core: ^1.59.0` を足し、`pnpm add -D playwright-core@catalog:` を実行する。`package.json` の scripts に `"thumbs": "node scripts/thumbs.ts"` を足す

- [ ] Step 2. 台本から使う操作をまとめた `stage.ts` を書く

```ts
// scripts/thumbs/stage.ts
import type { Page } from 'playwright-core';

export interface Clip {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Point = readonly [number, number];

/**
 * 台本から使う操作。座標は撮影する画面の CSS px。
 * 2 人が同時に触るゲームがあるので、指は pointerId で区別して 1 本ずつ送る
 */
export class Stage {
  constructor(readonly page: Page) {}

  touch(id: number, type: 'down' | 'move' | 'up', x: number, y: number): Promise<void> {
    return this.page.evaluate(
      ([id, type, x, y]) => {
        const target = document.elementFromPoint(x, y) ?? document.body;
        target.dispatchEvent(
          new PointerEvent(`pointer${type}`, {
            pointerId: id,
            pointerType: 'touch',
            isPrimary: id === 1,
            clientX: x,
            clientY: y,
            bubbles: true,
            cancelable: true,
            composed: true
          })
        );
      },
      [id, type, x, y] as const
    );
  }

  /** 時計を ms だけ進める。requestAnimationFrame も止めてあるので、ここでだけゲームが動く */
  wait(ms: number): Promise<void> {
    return this.page.clock.runFor(ms);
  }

  async tap(id: number, x: number, y: number): Promise<void> {
    await this.touch(id, 'down', x, y);
    await this.wait(50);
    await this.touch(id, 'up', x, y);
  }

  /** from から to へ、ms かけて 16ms ごとに指を動かす。up はしない（持ったままの場面を撮れるように） */
  async drag(id: number, from: Point, to: Point, ms: number): Promise<void> {
    await this.touch(id, 'down', ...from);
    const steps = Math.max(1, Math.round(ms / 16));
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      await this.touch(id, 'move', from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k);
      await this.wait(16);
    }
  }

  /** 1 人用。到達レベルを入れて読み直し、そのレベルで始める */
  async startSolo(id: string, level: number): Promise<void> {
    await this.page.evaluate(([id, level]) => localStorage.setItem(`table-duel:reached:${id}`, String(level)), [
      id,
      level
    ] as const);
    await this.page.reload();
    await this.page.click('button.go');
    await this.wait(600);
  }

  /** 2 人用。タイトルで両側を同時に長押しして始める */
  async startDuel(): Promise<void> {
    const [a, b] = await this.page.$$eval('button.go', (els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return [r.x + r.width / 2, r.y + r.height / 2] as const;
      })
    );
    await this.touch(1, 'down', ...a);
    await this.touch(2, 'down', ...b);
    await this.wait(1500);
    await this.touch(1, 'up', ...a);
    await this.touch(2, 'up', ...b);
    await this.wait(1200);
  }
}
```

`button.go` は SoloShell / GameShell のスタートボタンのクラス。違っていたら `src/lib/components/SoloTitle.svelte` と `TitleScreen.svelte` を読んで合わせる（2 人用の長押しの時間も `GameShell` の値に合わせる）。

- [ ] Step 3. 撮影の本体を書く

```ts
// scripts/thumbs.ts
// 一覧のカードの絵を、実際のゲーム画面から撮り直す。pnpm thumbs [id...]
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { SCENES } from './thumbs/scenes.ts';
import { Stage } from './thumbs/stage.ts';

const OUT = 'static/thumbs';
const SIZE = { width: 680, height: 400 };
const only = process.argv.slice(2);

/** 毎回同じ場面になるよう、ページの乱数を種つきにする */
function seedRandom(seed: number) {
  let a = seed;
  Math.random = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const server = await createServer({ server: { port: 0, strictPort: false }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls?.local[0];
if (!base) throw new Error('dev サーバーの URL が取れない');
const browser = await chromium.launch({ channel: 'chrome' });

try {
  await mkdir(OUT, { recursive: true });
  for (const scene of SCENES) {
    if (only.length && !only.includes(scene.id)) continue;
    const context = await browser.newContext({
      viewport: { width: 768, height: 1024 },
      deviceScaleFactor: 2,
      hasTouch: true
    });
    const page = await context.newPage();
    await page.addInitScript(seedRandom, 7);
    await page.clock.install({ time: 0 });
    await page.goto(new URL(`games/${scene.id}`, base).href);
    await page.clock.runFor(500);
    await scene.play(new Stage(page));
    const png = await page.screenshot({ clip: scene.clip, type: 'png' });
    const webp = await page.evaluate(
      async ([b64, width, height]) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const canvas = new OffscreenCanvas(width, height);
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        const bytes = new Uint8Array(
          await (await canvas.convertToBlob({ type: 'image/webp', quality: 0.85 })).arrayBuffer()
        );
        let bin = '';
        for (const b of bytes) bin += String.fromCharCode(b);
        return btoa(bin);
      },
      [png.toString('base64'), SIZE.width, SIZE.height] as const
    );
    await writeFile(`${OUT}/${scene.id}.webp`, Buffer.from(webp, 'base64'));
    console.log(`${scene.id}.webp`);
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}
```

`page.evaluate` の中の `img.decode()` や `convertToBlob` は、止めた時計の影響を受けない。受ける場合は撮る前に `page.clock.resume()` を呼ぶ。

- [ ] Step 4. はいしゃさんの台本を書く。場面は「くまの虫歯から出たバイキンをピンセットでつまみ、ゴミ箱へ運んでいる途中。吹き出しが出ている」。レベル 4（くま、虫歯とバイキン 2 匹）で、ドリルで虫歯を削り、ピンセットを選んでバイキンをつまみ、ゴミ箱の手前まで運んだところで止める（離さない）

```ts
// scripts/thumbs/scenes.ts
import type { Clip, Stage } from './stage.ts';

export interface Scene {
  id: string;
  /** 撮る範囲（CSS px）。幅 : 高さ = 680 : 400 */
  clip: Clip;
  play: (s: Stage) => Promise<void>;
}

/** 幅いっぱいで、上端 y から 680 : 400 の高さを切り出す */
const band = (y: number): Clip => ({ x: 0, y, width: 768, height: Math.round((768 * 400) / 680) });

export const SCENES: Scene[] = [
  {
    id: 'dentist',
    clip: band(200),
    play: async (s) => {
      await s.startSolo('dentist', 4);
      // 座標は画面を見て合わせる。道具トレイのボタンは aria-label で探せる
      // ドリルを選んで虫歯をこすり、ピンセットでバイキンをつまんでゴミ箱の手前まで運ぶ
    }
  }
];
```

台本の座標は、撮った画像を見ながら合わせる。道具の選択は `s.page.click('button[aria-label="ドリル"]')` のように DOM で押してよい。盤面の上の操作は `s.touch` / `s.drag` で送る。`clip` の `y` も画像を見て、顔と口とゴミ箱が入るように決める

- [ ] Step 5. `pnpm thumbs dentist` で撮り、`static/thumbs/dentist.webp` を Read ツールで開いて目で確かめる。場面が違えば台本を直して撮り直す

- [ ] Step 6. `pnpm check`（`tsconfig.scripts.json` も見る）、`pnpm lint` を通し、コミットする

```bash
git add pnpm-workspace.yaml package.json pnpm-lock.yaml scripts static/thumbs/dentist.webp
git commit -m "Add a script that captures game list thumbnails from real play"
```

---

### Task 2: 残り 10 本の場面

**Files:**

- Modify: `scripts/thumbs/scenes.ts`
- Create: `static/thumbs/{pin-rescue,gate-run,dog-guard,snow-camp,doodle-worm,border-rush,bomb-relay,hockey,bug-rush,lightning}.webp`

**Interfaces:**

- Consumes: Task 1 の `Stage`、`Scene`、`band`、`SCENES`

- [ ] Step 1. 仕様の「撮る場面」の表の 10 本ぶん、台本を `SCENES` に足す。各ゲームの操作は `src/lib/games/<id>/` の本体を読んで合わせる（盤面の要素、指の扱い、決着までの流れ）。1 人用は `startSolo`、2 人用は `startDuel`、らくがきムシは面が 1 つだけなので `startSolo(id, 1)`。2 人用は手前（1P、画面の下半分）を中心に切り出す
- [ ] Step 2. 1 本ずつ `pnpm thumbs <id>` で撮り、画像を開いて仕様の場面になっているか確かめる。決着して結果画面に移っていないこと、演出の途中で絵が崩れていないことを見る
- [ ] Step 3. `pnpm thumbs`（引数なし）で 11 本をまとめて撮り直し、2 回撮って同じ画像になる（乱数と時計が固定できている）ことを確かめる
- [ ] Step 4. `pnpm check`、`pnpm lint` を通し、コミットする

```bash
git add scripts/thumbs static/thumbs
git commit -m "Capture real-play thumbnails for every game"
```

---

### Task 3: カードを画像に切り替え、Thumb.svelte をなくす

**Files:**

- Modify: `src/lib/components/GameCard.svelte`、`src/lib/components/GameCard.svelte.test.ts`、`src/lib/games.ts`（`BaseMeta` の `Thumb` を消す）、`src/lib/games.test.ts`
- Modify: 11 本の `src/lib/games/<id>/meta.ts`（`Thumb` の import と項目を消す）
- Delete: 11 本の `src/lib/games/<id>/Thumb.svelte`
- Modify: `src/lib/components/SoloShell.svelte.test.ts`、`SoloTitle.svelte.test.ts` など、スタブの meta に `Thumb` を持つテスト
- Modify: `README.md`（「ゲームを追加する」の Thumb の手順を、`pnpm thumbs` の台本を足して撮る手順に）、`CLAUDE.md`（構成と見た目の節の `Thumb.svelte` の記述）

- [ ] Step 1. 失敗するテストを書く。`src/lib/games.test.ts` に「どのゲームにもカードの画像がある」を足す

```ts
import { existsSync } from 'node:fs';

it('どのゲームにも一覧のカードの画像がある', () => {
  for (const game of games) expect(existsSync(`static/thumbs/${game.id}.webp`), game.id).toBe(true);
});
```

`GameCard.svelte.test.ts` に「カードは /thumbs/<id>.webp の画像を出す」を足す（`img` の `src` が `thumbs/stub.webp` で終わる）

- [ ] Step 2. `pnpm exec vitest run src/lib/games.test.ts src/lib/components/GameCard.svelte.test.ts` で、カードのテストが落ちることを確かめる

- [ ] Step 3. `GameCard.svelte` の `<div class="thumb"><game.Thumb /></div>` を画像に替える

```svelte
<script lang="ts">
  import { asset } from '$app/paths';
  // （既存の import はそのまま）
</script>

<img
  class="thumb"
  src={asset(`/thumbs/${game.id}.webp`)}
  alt=""
  width="680"
  height="400"
  loading="lazy"
  decoding="async"
/>
```

```css
.thumb {
  display: block;
  width: 100%;
  height: 200px;
  border-radius: 20px 20px 0 0;
  object-fit: cover;
}
```

`asset()` が使えない版の SvelteKit なら `base` を使う（`$app/paths` の既存の使い方に合わせる）。markuplint と svelte-vitals が画像まわりで警告を出したら、その指摘に合わせる

- [ ] Step 4. `Thumb` をなくす。`games.ts` の `BaseMeta` から `Thumb` を消し、11 本の `meta.ts` から import と項目を消し、`Thumb.svelte` を消す。テストのスタブの meta からも `Thumb` を消す

- [ ] Step 5. README と CLAUDE.md を直す。ゲームを足すときは `scripts/thumbs/scenes.ts` に台本を足して `pnpm thumbs <id>` で撮る、と書く。CLAUDE.md の「一覧のカードの絵は各ゲームの `Thumb.svelte`」は「一覧のカードの絵は `pnpm thumbs` で実際の画面から撮った `static/thumbs/<id>.webp`」に直す

- [ ] Step 6. `pnpm verify` を通す。`pnpm dev` の一覧を内蔵ブラウザで開き、11 枚の画像が枠に収まって出ることを確かめる（built-in browser だけを使う）

- [ ] Step 7. コミットする

```bash
git add -A src README.md CLAUDE.md
git commit -m "Show real-play screenshots on the game list and drop Thumb components"
```
