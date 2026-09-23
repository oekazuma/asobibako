// 実行: pnpm thumbs [id...]
// 一覧のカードの絵を、実際のゲームを動かした画面から撮り直して static/thumbs/<id>.webp に書く。
// ブラウザはダウンロードせず、端末の Google Chrome を使う
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

const server = await createServer({ server: { port: 0 }, logLevel: 'error' });
await server.listen();
// SvelteKit の base パス（/table-duel）までが入り、末尾の / はつかない
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
    // dev サーバーからモジュールを読み終えるまでハイドレートしない。止めた時計を進めても待てないので、通信が止むまで待つ
    await page.goto(`${base}/games/${scene.id}`, { waitUntil: 'networkidle' });
    await scene.play(new Stage(page));
    const png = await page.screenshot({ clip: scene.clip, type: 'png' });
    // 縮小と WebP 化は Chrome の canvas に任せる（画像ライブラリを足さないため）
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
    console.log(`${OUT}/${scene.id}.webp`);
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}
