<script lang="ts">
  import { resolve } from '$app/paths';
  import AppUpdate from '$lib/components/AppUpdate.svelte';
  import { games } from '$lib/games';
</script>

<svelte:head>
  <title>Table Duel — iPad をはさんで 2 人で遊ぶ対戦ゲーム集</title>
</svelte:head>

<main class="menu">
  <header>
    <h1 class="logo sticker"><span class="a">Table</span> <span class="b">Duel</span></h1>
    <p class="lead">iPad をテーブルに置いて、向かい合って あそぼう！</p>
  </header>

  <AppUpdate />

  <ul class="cards">
    {#each games as game, i (game.id)}
      <li style:--delay="{i * 70}ms">
        <a class="card" href={resolve('/games/[id]', { id: game.id })}>
          <div class="thumb"><game.Thumb /></div>
          <div class="body">
            <h2>{game.name}</h2>
            <p class="desc">{game.description}</p>
            <p class="meta">
              <span class="chip">{game.players}人</span>
              <span class="chip">{game.minutes}</span>
            </p>
          </div>
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
    padding: max(36px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right))
      max(36px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left));
    background:
      radial-gradient(circle, var(--bg-dot) 3px, transparent 3.5px) 0 0 / 28px 28px,
      var(--bg);
  }

  header {
    max-width: 960px;
    margin: 0 auto 24px;
    text-align: center;
  }

  .logo {
    font-size: clamp(40px, 8vw, 72px);
    line-height: 1.1;
  }

  .logo .a {
    color: var(--p1);
  }

  .logo .b {
    color: var(--p2);
  }

  .lead {
    display: inline-block;
    margin-top: 12px;
    padding: 6px 18px;
    border-radius: 999px;
    background: var(--card);
    box-shadow: 0 3px 0 var(--card-edge);
    color: var(--ink-soft);
    font-size: clamp(13px, 2vw, 16px);
    font-weight: 700;
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 340px));
    justify-content: center;
    gap: 22px;
    max-width: 960px;
    margin: 0 auto;
    list-style: none;
  }

  li {
    animation: rise 480ms var(--spring) var(--delay) both;
  }

  .card {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    border: 4px solid #fff;
    border-radius: 26px;
    background: var(--card);
    box-shadow:
      0 8px 0 var(--card-edge),
      0 16px 28px rgb(43 45 66 / 0.1);
    color: inherit;
    text-decoration: none;
    transition:
      translate 90ms,
      box-shadow 90ms;
  }

  .card:active {
    translate: 0 6px;
    box-shadow:
      0 2px 0 var(--card-edge),
      0 6px 14px rgb(43 45 66 / 0.1);
  }

  .thumb {
    display: block;
    height: 128px;
    border-radius: 20px 20px 0 0;
    overflow: hidden;
  }

  .body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 8px;
    padding: 14px 18px 18px;
  }

  h2 {
    font-size: 24px;
    font-weight: 800;
    letter-spacing: 0.06em;
  }

  .desc {
    color: var(--ink-soft);
    font-size: 14px;
    font-weight: 700;
    line-height: 1.6;
  }

  .meta {
    display: flex;
    gap: 6px;
    margin-top: auto;
    padding-top: 4px;
  }

  .chip {
    padding: 3px 12px;
    border-radius: 999px;
    background: var(--bg);
    color: var(--ink-soft);
    font-size: 12px;
    font-weight: 800;
  }

  @keyframes rise {
    from {
      translate: 0 24px;
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    li {
      animation: none;
    }

    .card {
      transition: none;
    }
  }
</style>
