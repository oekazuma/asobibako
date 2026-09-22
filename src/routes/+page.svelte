<script lang="ts">
  import AppUpdate from '$lib/components/AppUpdate.svelte';
  import GameCard from '$lib/components/GameCard.svelte';
  import { games } from '$lib/games';

  const sections = [
    { title: 'ひとりで あそぶ', list: games.filter((game) => game.players === 1) },
    { title: 'ふたりで あそぶ', list: games.filter((game) => game.players === 2) }
  ].filter((section) => section.list.length > 0);
</script>

<svelte:head>
  <title>Table Duel — iPad をはさんで 2 人で遊ぶ対戦ゲーム集</title>
</svelte:head>

<main class="menu">
  <header>
    <h1 class="logo sticker"><span class="a">Table</span> <span class="b">Duel</span></h1>
    <p class="lead">ひとりでも、向かい合って ふたりでも あそぼう！</p>
  </header>

  <AppUpdate />

  {#each sections as section (section.title)}
    <section>
      <h2 class="section sticker">{section.title}</h2>
      <ul class="cards">
        {#each section.list as game, i (game.id)}
          <li style:--delay="{i * 70}ms">
            <GameCard {game} />
          </li>
        {/each}
      </ul>
    </section>
  {/each}
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

  .section {
    max-width: 960px;
    margin: 28px auto 16px;
    font-size: clamp(22px, 4vw, 30px);
    text-align: center;
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
  }
</style>
