<script lang="ts">
  import { ARCANA_ART } from './art/arcana';
  import { arcanaDef, type ArcanaId } from './arcana';
  import PixelIcon from './PixelIcon.svelte';

  let { cards, locked, onpick }: { cards: ArcanaId[]; locked: boolean; onpick: (id: ArcanaId) => void } = $props();

  function key(event: KeyboardEvent) {
    const n = Number(event.key);
    if (locked || !Number.isInteger(n) || n < 1 || n > cards.length) return;
    event.preventDefault();
    onpick(cards[n - 1]);
  }
</script>

<svelte:window onkeydown={key} />

<div class="veil">
  <section class="as-panel pop" class:as-locked={locked} aria-label="札を選ぶ">
    <h2 class="as-title">札を選ぶ</h2>
    {#each cards as id (id)}
      {@const d = arcanaDef(id)}
      <button class="as-card" class:trade={d.trade} data-card={id} onclick={() => onpick(id)}>
        <PixelIcon art={ARCANA_ART[id]} size="min(10cqw, 6cqh, 64px)" />
        <span class="body">
          <span class="name">{d.name}</span>
          <span class="text">{d.good}</span>
          {#if d.bad}<span class="text bad">ただし {d.bad}</span>{/if}
        </span>
      </button>
    {/each}
  </section>
</div>

<style>
  .veil {
    position: absolute;
    inset: 0;
    z-index: 4;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgb(20 10 30 / 0.55);
  }

  .pop {
    animation: pop 280ms steps(4);
  }

  .trade {
    background: #e6dcf5;
    box-shadow:
      inset 0 0 0 2px #a66ae0,
      0 4px 0 #5a3a7a;
  }

  .body {
    display: grid;
    gap: 4px;
  }

  .name {
    font-size: min(5cqw, 3cqh, 26px);
  }

  .text {
    font-size: min(3.8cqw, 2.3cqh, 19px);
    font-weight: 700;
    color: #5d3a2a;
  }

  .bad {
    color: #d8463c;
  }

  @keyframes pop {
    from {
      scale: 0.6;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pop {
      animation: none;
    }
  }
</style>
