<script lang="ts">
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import AppUpdate from '$lib/components/AppUpdate.svelte';
  import Backup from '$lib/components/Backup.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import MirrorRestore from '$lib/components/MirrorRestore.svelte';
  import { pwaStatus, type PwaStatus } from '$lib/pwa';

  let status = $state<PwaStatus>({ standalone: false, swActive: false, cached: false });

  // プリレンダーでは Service Worker もキャッシュも読めないので mount 後に読む
  onMount(() => {
    pwaStatus()
      .then((s) => (status = s))
      .catch(() => {});
  });

  const items = $derived([
    [
      status.standalone,
      'ホーム画面から起動しています',
      'ブラウザで開いています（ホーム画面に追加すると全画面で遊べます）'
    ],
    [status.swActive, 'オフライン用の保存（Service Worker）が有効です', 'オフライン用の保存がまだ有効ではありません'],
    [status.cached, 'ゲームを端末に保存済みです', 'ゲームはまだ端末に保存されていません']
  ] as const);
</script>

<svelte:head>
  <title>アプリについて — あそびばこ</title>
</svelte:head>

<main class="about">
  <div class="column">
    <header>
      <a class="pill back" href={resolve('/')}>もどる</a>
      <h1 class="yuru">アプリについて</h1>
    </header>

    <section class="card">
      <h2>更新</h2>
      <AppUpdate />
    </section>

    <section class="card">
      <h2>アプリの状態</h2>
      <ul class="status">
        {#each items as [ok, good, bad] (good)}
          <li><Icon name={ok ? 'check' : 'cross'} size="22px" />{ok ? good : bad}</li>
        {/each}
      </ul>
    </section>

    <section class="card">
      <h2>データについて</h2>
      <p>
        到達したレベル・さいきん
        あそんだゲーム・えらんだタブ・ミュートは、この端末の中にだけ保存します。サーバーには送りません。下の「バックアップ」で、記録をファイルに書き出して別の端末へ移せます。
      </p>
    </section>

    <section class="card">
      <h2>この端末の控え</h2>
      <MirrorRestore />
    </section>

    <section class="card">
      <h2>バックアップ</h2>
      <Backup />
    </section>
  </div>
</main>

<style>
  /* 全体は touch-action: none なので、一覧と同じく自分をスクロール領域にして縦スクロールを許す */
  .about {
    height: 100dvh;
    overflow-y: auto;
    touch-action: pan-y;
    padding: max(24px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right))
      max(36px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
    background: var(--paper-dots), var(--paper);
    color: var(--line);
  }

  .column {
    display: grid;
    gap: 16px;
    max-width: 560px;
    margin: 0 auto;
  }

  header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 4px;
  }

  .back {
    padding: 8px 20px;
    font-size: 15px;
    text-decoration: none;
  }

  h1 {
    font-size: clamp(24px, 5vw, 32px);
  }

  .card {
    padding: 16px 18px;
    border: 3px solid var(--line);
    border-radius: 22px;
    background: #fff;
    box-shadow: var(--soft-shadow);
    line-height: 1.7;
  }

  h2 {
    margin-bottom: 8px;
    font-size: 17px;
    font-weight: 800;
    letter-spacing: 0.06em;
  }

  p {
    font-size: 14px;
    font-weight: 700;
  }

  .status {
    display: grid;
    gap: 8px;
    font-size: 14px;
    font-weight: 700;
    list-style: none;
  }

  .status li {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }
</style>
