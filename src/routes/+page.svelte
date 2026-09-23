<script lang="ts">
  import { onMount } from 'svelte';
  import AppUpdate from '$lib/components/AppUpdate.svelte';
  import GameCard from '$lib/components/GameCard.svelte';
  import { games, type GameMeta } from '$lib/games';
  import { menuTab, recentGames, setMenuTab } from '$lib/recent';

  const tabs = [
    { players: 1, label: 'ひとりで', title: 'ひとりで あそぶ', color: 'p1' },
    { players: 2, label: 'ふたりで', title: 'ふたりで あそぶ', color: 'p2' }
  ] as const;

  let tab = $state<1 | 2>(1);
  let recent = $state<GameMeta[]>([]);
  const shown = $derived(games.filter((game) => game.players === tab));

  // プリレンダーでは覚えごとが読めないので mount 後に読む。消えたゲームの id は飛ばす
  onMount(() => {
    tab = menuTab();
    recent = recentGames().flatMap((id) => games.find((game) => game.id === id) ?? []);
  });

  function choose(players: 1 | 2) {
    tab = players;
    setMenuTab(players);
  }
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

  {#if recent.length > 0}
    <section class="recent">
      <h2 class="section sticker">さいきん あそんだ</h2>
      <ul class="cards row">
        {#each recent as game (game.id)}
          <li><GameCard {game} /></li>
        {/each}
      </ul>
    </section>
  {/if}

  <section>
    <div class="tabs">
      {#each tabs as t (t.players)}
        <button class="pill tab {t.color}" aria-pressed={tab === t.players} onclick={() => choose(t.players)}
          >{t.label}</button
        >
      {/each}
    </div>
    <h2 class="sr-only">{tabs[tab - 1].title}</h2>
    <ul class="cards">
      {#each shown as game, i (game.id)}
        <li style:--delay="{i * 60}ms"><GameCard {game} /></li>
      {/each}
    </ul>
  </section>
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
    margin: 20px auto 12px;
    font-size: clamp(18px, 3vw, 24px);
    text-align: center;
  }

  .tabs {
    display: flex;
    justify-content: center;
    gap: 12px;
    margin: 24px auto 20px;
  }

  .tab {
    min-width: 140px;
    font-size: clamp(16px, 2.6vw, 20px);
    font-weight: 800;
  }

  .tab[aria-pressed='false'] {
    --face: var(--card);
    --edge: var(--card-edge);
    color: var(--ink-soft);
  }

  /* iPad の縦で 3 列、スマホで 2 列になる幅。最小幅を割合で抑えて、細い画面でも 2 列を保つ */
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(200px, 40%), 1fr));
    gap: 16px;
    max-width: 960px;
    margin: 0 auto;
    list-style: none;
  }

  .row {
    grid-template-columns: repeat(3, 1fr);
    max-width: 720px;
  }

  li {
    animation: rise 480ms var(--spring) var(--delay, 0ms) both;
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
