// 実行: pnpm icon
// ロゴの箱とキャラクター（Logo の mark）をクリーム色の正方形に置いて撮り、static/icon-*.png に書く。
// ブラウザはダウンロードせず、端末の Google Chrome を使う
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

// 512 は maskable も兼ねる。Android の丸い切り抜き（半径 40%）でも、ふたの先と箱の角がほぼ欠けない大きさ
const WIDTH = '74%';

const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, logLevel: 'error' });
try {
  // 部品と同じ svelte の実体で描く（Node から直接 import すると別の実体になり、描画が失敗する）
  const { render } = (await server.ssrLoadModule('svelte/server')) as typeof import('svelte/server');
  const { default: Logo } = await server.ssrLoadModule('/src/lib/components/Logo.svelte');
  const { body } = render(Logo, { props: { mark: true, width: WIDTH } });
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    for (const size of [180, 192, 512]) {
      const page = await browser.newPage({ viewport: { width: size, height: size } });
      await page.setContent(
        `<body style="margin:0;height:100vh;display:grid;place-items:center;background:#fff7e8">${body}</body>`
      );
      await page.screenshot({ path: `static/icon-${size}.png` });
      console.log(`wrote static/icon-${size}.png`);
    }
  } finally {
    await browser.close();
  }
} finally {
  await server.close();
}
