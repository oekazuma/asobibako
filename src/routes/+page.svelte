<script lang="ts">
  import { resolve } from '$app/paths';
  import { games } from '$lib/games';
</script>

<svelte:head>
  <title>Table Duel — iPad をはさんで 2 人で遊ぶ対戦ゲーム集</title>
</svelte:head>

<main class="menu">
  <header>
    <h1>Table Duel</h1>
    <p>iPad をテーブルに置いて、向かい合って遊ぶ 2 人対戦ゲーム集</p>
  </header>

  <ul class="cards">
    {#each games as game (game.id)}
      <li>
        <a class="card" href={resolve('/games/[id]', { id: game.id })}>
          <span class="band" aria-hidden="true"></span>
          <h2>{game.name}</h2>
          <span class="desc">{game.description}</span>
          <span class="meta">{game.players}人 ・ {game.minutes}</span>
        </a>
      </li>
    {/each}
  </ul>
</main>

<style>
  /* 全体は touch-action: none なので、一覧だけは自分をスクロール領域にして縦スクロールを許す */
  .menu {
    height: 100dvh;
    overflow-y: auto;
    touch-action: pan-y;
    padding: max(32px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right))
      max(32px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left));
  }

  header {
    max-width: 960px;
    margin: 0 auto 28px;
    text-align: center;
  }

  h1 {
    font-size: clamp(28px, 5vw, 44px);
    font-weight: 800;
    letter-spacing: 0.1em;
  }

  header p {
    margin-top: 8px;
    font-size: clamp(13px, 2vw, 16px);
    opacity: 0.7;
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 340px));
    justify-content: center;
    gap: 16px;
    max-width: 960px;
    margin: 0 auto;
    list-style: none;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    padding: 0 0 18px;
    overflow: hidden;
    border: 1px solid #262c39;
    border-radius: 16px;
    background: #171c26;
    color: inherit;
    text-decoration: none;
  }

  .card:active {
    background: #1f2533;
  }

  .band {
    height: 56px;
    margin-bottom: 6px;
    background: linear-gradient(to bottom, var(--zone-2) 50%, var(--zone-1) 50%);
    box-shadow: inset 0 -28px 0 -26px rgba(255, 255, 255, 0.85);
  }

  h2,
  .desc,
  .meta {
    padding: 0 18px;
  }

  h2 {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: 0.08em;
  }

  .desc {
    font-size: 14px;
    line-height: 1.6;
    opacity: 0.8;
  }

  .meta {
    margin-top: auto;
    font-size: 13px;
    opacity: 0.6;
  }
</style>
