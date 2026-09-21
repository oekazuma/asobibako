<script lang="ts">
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
</script>

<svelte:head>
  <title>{page.status} — Table Duel</title>
</svelte:head>

<main class="error">
  <h1>{page.status === 404 ? 'ゲームが見つかりません' : 'エラーが起きました'}</h1>
  <a href={resolve('/')}>ゲーム選択へ</a>
</main>

<style>
  .error {
    display: grid;
    place-content: center;
    gap: 24px;
    height: 100dvh;
    text-align: center;
  }

  h1 {
    font-size: clamp(20px, 4vw, 28px);
  }

  a {
    padding: 14px 28px;
    border: 1px solid #ffffff44;
    border-radius: 14px;
    background: #ffffff1a;
    color: inherit;
    text-decoration: none;
  }
</style>
