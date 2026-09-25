<script lang="ts">
  import { onMount } from 'svelte';
  import { updated } from '$app/state';
  import '../app.css';
  import { keepScreenAwake } from '$lib/wake-lock.svelte';
  import { watch } from '$lib/last-error';

  let { children } = $props();

  onMount(() => {
    const unwatch = watch();
    const release = keepScreenAwake();
    return () => {
      unwatch();
      release();
    };
  });

  // ホーム画面のアプリはページ遷移が少なくポーリングも止まりがちなので、前面に戻ったときに新版を確認する（1 分に 1 回まで）
  let lastCheck = 0;
  function onVisible() {
    if (document.visibilityState !== 'visible' || Date.now() - lastCheck < 60_000) return;
    lastCheck = Date.now();
    void updated.check();
  }
</script>

<svelte:document onvisibilitychange={onVisible} />

<svelte:head>
  <meta name="description" content="iPad で ひとりでも、向かい合って ふたりでも あそべる ゲームばこ" />
</svelte:head>

{@render children()}

<!--
  iOS 27 のホーム画面アプリは、上端に固定した背景のある要素が無いと画面の上をぼかす（プログレッシブブラー）。
  背景を文字の形に切り抜くので何も描かれないが、WebKit はこれを上端の背景とみなしてぼかしをやめる
-->
<div class="ios-blur-fix" aria-hidden="true"></div>

<style>
  .ios-blur-fix {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 11px;
    z-index: 2147483647;
    pointer-events: none;
    background-color: #fffaf2;
    -webkit-background-clip: text;
    background-clip: text;
  }
</style>
