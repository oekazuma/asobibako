import { defineConfig } from 'svelte-vitals';

export default defineConfig({
  failOn: 'warning',
  // 個人用・検索対象外（noindex）の PWA なので、検索結果の見え方にしか効かない SEO 規則は対象外にする
  seo: { indexable: false },
  rules: {
    // ディレクトリ名は kebab-case（src/lib/games/border-rush など）
    'architecture/directory-naming': {
      options: { directories: { 'src/lib/*': 'kebab-case' } }
    },
    // 全ページに <main> を置く
    'a11y/required-element': { options: { elements: ['main'] } }
  }
});
