/// <reference types="vitest/config" />
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

import { svelteVitals } from '@svelte-vitals/vite';

// バージョン名 = ビルド時刻 + git の短いハッシュ。Service Worker のキャッシュ名にもなるのでビルドごとに必ず変わる。
// SvelteKit は client / server で設定を読み直すため、時刻は環境変数に固定して両者で同じ名前にする
process.env.TD_BUILD ??= String(Date.now());
const gitHash = (() => {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'local';
  }
})();

export default defineConfig({
  plugins: [
    svelteVitals(),
    sveltekit({
      compilerOptions: {
        // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
        runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
      },
      adapter: adapter({ fallback: '404.html' }),
      paths: { base: (process.env.BASE_PATH ?? '/table-duel') as '' | `/${string}` },
      serviceWorker: { register: true },
      // pollInterval: 開いている間は 5 分ごとに _app/version.json を見て updated.current を立てる
      version: { name: `${process.env.TD_BUILD}-${gitHash}`, pollInterval: 300_000 },
      // GitHub Pages はヘッダを出せないので <meta http-equiv> で CSP を出す（プリレンダーなので hash）。
      // 依存パッケージ経由で混入したコードが外へ通信するのを connect-src で止めるのが目的。
      // style は style:--b={} などのインライン style 属性を使うので unsafe-inline
      csp: {
        mode: 'hash',
        directives: {
          'default-src': ['self'],
          'script-src': ['self'],
          'style-src': ['self', 'unsafe-inline'],
          'img-src': ['self', 'data:'],
          'font-src': ['self'],
          'connect-src': ['self'],
          'worker-src': ['self'],
          'manifest-src': ['self'],
          'object-src': ['none'],
          'base-uri': ['self']
        }
      }
    })
  ],
  test: {
    projects: [
      {
        // ゲームルールなど、DOM に依存しないモジュールのテスト
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.svelte.test.ts', 'src/lib/settle.svelte.test.ts', 'src/lib/pwa.test.ts']
        }
      },
      {
        // コンポーネントとブラウザ API のテスト。browser 条件で Svelte のクライアント版を解決させないと mount() が動かない
        extends: true,
        resolve: { conditions: ['browser'] },
        test: {
          name: 'dom',
          environment: 'happy-dom',
          include: ['src/**/*.svelte.test.ts', 'src/lib/settle.svelte.test.ts', 'src/lib/pwa.test.ts']
        }
      }
    ]
  }
});
