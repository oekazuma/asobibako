<script lang="ts">
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import Logo from '$lib/components/Logo.svelte';
</script>

<svelte:head>
  <title>{page.status} — Table Duel</title>
</svelte:head>

<main class="error">
  <Logo width="160px" mark />
  <h1>{page.status === 404 ? 'ゲームが見つかりません' : 'エラーが起きました'}</h1>
  <a class="pill p1" href={resolve('/')}>ゲーム選択へ</a>
</main>

<style>
  .error {
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 24px;
    height: 100dvh;
    background: var(--paper-dots), var(--paper);
    color: var(--line);
    text-align: center;
  }

  h1 {
    font-size: clamp(22px, 4vw, 30px);
    font-weight: 800;
  }

  a {
    text-decoration: none;
  }
</style>
