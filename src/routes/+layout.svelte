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
