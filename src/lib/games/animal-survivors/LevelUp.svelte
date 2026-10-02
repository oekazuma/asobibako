<script lang="ts">
  import { itemArt } from './art/evolved';
  import { ITEM_ART } from './art/items';
  import type { Choice } from './choices';
  import { PASSIVES } from './passives';
  import PixelIcon from './PixelIcon.svelte';
  import { WEAPONS, upText } from './weapons';

  let {
    options,
    locked,
    rerolls,
    onpick,
    onreroll
  }: {
    options: Choice[];
    locked: boolean;
    rerolls: number;
    onpick: (c: Choice) => void;
    onreroll: () => void;
  } = $props();

  function info(c: Choice) {
    if (c.kind === 'weapon') {
      const d = WEAPONS[c.id];
      const fresh = c.level === 1;
      return {
        art: itemArt(`weapon-${c.id}`),
        name: d.name,
        tag: fresh ? 'NEW' : `Lv ${c.level}`,
        text: fresh ? d.blurb : upText(d, c.level),
        evo: c.evo ?? false
      };
    }
    if (c.kind === 'passive') {
      const d = PASSIVES[c.id];
      return {
        art: itemArt(`passive-${c.id}`),
        name: d.name,
        tag: c.level === 1 ? 'NEW' : `Lv ${c.level}`,
        text: d.blurb,
        evo: c.evo ?? false
      };
    }
    if (c.kind === 'meat') return { art: ITEM_ART.meat, name: '肉', tag: '', text: 'HP を 30% 回復', evo: false };
    return { art: ITEM_ART.chest, name: '経験値の袋', tag: '', text: '経験値 +25', evo: false };
  }

  function key(event: KeyboardEvent) {
    if (!locked && event.key.toLowerCase() === 'r' && rerolls > 0) {
      event.preventDefault();
      onreroll();
      return;
    }
    const n = Number(event.key);
    if (locked || !Number.isInteger(n) || n < 1 || n > options.length) return;
    event.preventDefault();
    onpick(options[n - 1]);
  }
</script>

<svelte:window onkeydown={key} />

<div class="veil">
  <section class="as-panel pop" class:as-locked={locked} aria-label="レベルアップ">
    <h2 class="as-title">LEVEL UP!</h2>
    {#each options as c, i (c.kind + ('id' in c ? c.id : ''))}
      {@const d = info(c)}
      <button class="as-card" onclick={() => onpick(c)}>
        <span class="key">{i + 1}</span>
        <PixelIcon art={d.art} size="min(10cqw, 6cqh, 64px)" />
        <span class="body">
          <span class="name"
            >{d.name}{#if d.tag}<span class="tag" class:new={d.tag === 'NEW'}>{d.tag}</span>{/if}{#if d.evo}<span
                class="tag evo">進化</span
              >{/if}</span
          >
          <span class="text">{d.text}</span>
        </span>
      </button>
    {/each}
    {#if rerolls > 0}
      <button class="as-card reroll" onclick={onreroll}>引き直す（のこり {rerolls}）</button>
    {/if}
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

  .reroll {
    justify-content: center;
    background: #d6e8ff;
    font-size: min(4cqw, 2.4cqh, 20px);
  }

  .key {
    color: #8a6a4a;
    font-size: min(3.4cqw, 2cqh, 18px);
  }

  .body {
    display: grid;
    gap: 4px;
  }

  .name {
    display: flex;
    gap: 10px;
    align-items: center;
    font-size: min(5cqw, 3cqh, 26px);
  }

  .tag {
    padding: 1px 8px;
    background: #2a64c8;
    color: #fff;
    font-size: 0.6em;
  }

  .tag.new {
    background: #d8463c;
  }

  .tag.evo {
    background: #e09a1c;
  }

  .text {
    font-size: min(3.8cqw, 2.3cqh, 19px);
    font-weight: 700;
    color: #5d3a2a;
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
