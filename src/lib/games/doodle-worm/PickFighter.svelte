<script lang="ts">
  import { ratings, stats } from './battle';
  import { hatch } from './engine';
  import type { Look } from './looks';
  import { portrait } from './paint';
  import type { Doodle } from './stock';

  let {
    title,
    doodles,
    look,
    battle,
    onpick
  }: {
    title: string;
    doodles: Doodle[];
    look: Look;
    /** バトルの子を選ぶ。持ち味と強さの目盛りを出す */
    battle: boolean;
    onpick: (d: Doodle) => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  let chosen = $state.raw<Doodle>(doodles[0]);
  const s = $derived(battle ? stats(hatch(chosen.strokes)!) : null);
</script>

<h2 class="banner yuru">{title}</h2>
<div class="show" class:dance={!battle}>
  <img class="big" src={portrait(chosen.strokes, look)} style:background={look.bg} width="160" height="160" alt="" />
  {#if s}
    <div class="stats">
      <span class="trait">{s.trait}</span>
      {#each ratings(s) as [name, v] (name)}
        <span class="row">{name}<i><b style:width="{v * 100}%"></b></i></span>
      {/each}
    </div>
  {/if}
</div>
<button class="pill p2 go" onclick={() => onpick(chosen)}>この こに する！</button>
<ul class="grid">
  {#each doodles as d (d.id)}
    <li>
      <button class="card" aria-label="この こを みる" aria-pressed={d === chosen} onclick={() => (chosen = d)}>
        <img src={portrait(d.strokes, look)} style:background={look.bg} width="160" height="160" alt="" />
      </button>
    </li>
  {/each}
</ul>

<style>
  .banner {
    margin: 0 0 14px;
    font-size: clamp(22px, min(4cqh, 6cqw), 36px);
  }

  .show {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    margin: 0 auto 14px;
    padding: 14px;
    max-width: 560px;
    border: 3px solid var(--line);
    border-radius: 28px;
    background: #fff;
    box-shadow: var(--soft-shadow);
  }

  /* ダンスの子は、舞台と同じ色の上に立たせて見せる */
  .show.dance {
    background:
      radial-gradient(ellipse 70% 60% at 50% 30%, rgb(255 126 182 / 0.5), transparent 70%),
      linear-gradient(#2a1650, #4b2a7a);
  }

  .big {
    width: min(42cqw, 220px);
    height: auto;
    aspect-ratio: 1;
    border-radius: 20px;
    animation: bob 1.6s ease-in-out infinite;
  }

  .stats {
    display: grid;
    gap: 6px;
    flex: 1;
    max-width: 240px;
    text-align: left;
    font-weight: 800;
    font-size: 14px;
  }

  .trait {
    justify-self: start;
    padding: 2px 12px;
    border-radius: 999px;
    background: var(--p2);
    color: #fff;
  }

  .row {
    display: grid;
    grid-template-columns: 5.5em 1fr;
    align-items: center;
  }

  .row i {
    height: 10px;
    overflow: hidden;
    border-radius: 999px;
    background: #eee;
  }

  .row b {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--gold), var(--p2));
    transition: width 200ms var(--spring);
  }

  .go {
    margin-bottom: 18px;
    font-size: 20px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .card {
    width: 100%;
    aspect-ratio: 1;
    padding: 5px;
    border: 2px solid var(--line);
    border-radius: 18px;
    background: #fff;
    cursor: pointer;
    transition: scale 150ms var(--spring);
  }

  .card[aria-pressed='true'] {
    outline: 4px solid var(--p2);
    outline-offset: 2px;
    scale: 1.06;
  }

  .card img {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 12px;
  }

  @keyframes bob {
    50% {
      translate: 0 -6px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .big {
      animation: none;
    }

    .card,
    .row b {
      transition: none;
    }
  }
</style>
