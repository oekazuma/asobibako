<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import {
    DECOR,
    decorPrice,
    hasDecor,
    PART_NAME,
    ROOM_PARTS,
    ROOM_THEMES,
    THEME_NAME,
    VIEW_NAME,
    type DecorId,
    type RoomLook,
    type RoomPart,
    type RoomTheme
  } from './decor';
  import type { Save } from './engine';
  import RoomMini from './RoomMini.svelte';
  import { ROOM_SWATCH } from './ui';

  let { save, onbuy, onroom }: { save: Save; onbuy: (id: DecorId) => void; onroom: (look: Partial<RoomLook>) => void } =
    $props();

  let theme = $state<RoomTheme>('pink');
  const sw = $derived(ROOM_SWATCH[theme]);
  const owns = (part: RoomPart) => hasDecor(save.decor, part, theme);
  const allOwned = $derived(ROOM_PARTS.every(owns));
  const allUsed = $derived(ROOM_PARTS.every((p) => save.room[p] === theme));
  const setItem = $derived(DECOR.find((d) => d.id === `set:${theme}`));
  const setPrice = $derived(setItem ? decorPrice(save.decor, setItem) : 0);

  function pickSet() {
    if (!allOwned) onbuy(`set:${theme}`);
    else onroom(Object.fromEntries(ROOM_PARTS.map((p) => [p, theme])));
  }

  function pickPart(part: RoomPart) {
    if (owns(part)) onroom({ [part]: theme });
    else onbuy(`${part}:${theme}`);
  }

  const price = (part: RoomPart) => DECOR.find((d) => d.id === `${part}:${theme}`)?.price ?? 0;
</script>

<div class="themes" role="group" aria-label="へやの テーマ">
  {#each ROOM_THEMES as t (t)}
    <button class="theme" class:on={theme === t} aria-pressed={theme === t} onclick={() => (theme = t)}>
      <span class="chip" style:background={ROOM_SWATCH[t].wall}></span>{THEME_NAME[t]}
    </button>
  {/each}
</div>
<div class="grid">
  <button
    class="pet-choice set"
    class:on={allUsed}
    aria-pressed={allUsed}
    disabled={!allOwned && save.money < setPrice}
    onclick={pickSet}
  >
    <RoomMini swatch={sw} />
    <span class="name">{theme === 'natural' ? 'ナチュラルに もどす' : `${THEME_NAME[theme]}セット`}</span>
    <span class="price">
      {#if !allOwned}<Icon name="coin" />{setPrice}{:else}{allUsed ? 'つかってる' : 'ぜんぶ つかう'}{/if}
    </span>
  </button>
  {#each ROOM_PARTS as part (part)}
    {@const have = owns(part)}
    {@const used = save.room[part] === theme}
    <button
      class="pet-choice"
      class:on={used}
      aria-pressed={used}
      disabled={!have && save.money < price(part)}
      onclick={() => pickPart(part)}
    >
      <span class="swatch" style:background={sw[part]}></span>
      <span class="name">{part === 'view' ? VIEW_NAME[theme] : PART_NAME[part]}</span>
      <span class="price">
        {#if !have}<Icon name="coin" />{price(part)}{:else}{used ? 'つかってる' : 'つかう'}{/if}
      </span>
    </button>
  {/each}
</div>

<style>
  .themes {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
  }

  .theme {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px 4px 6px;
    border: 2px solid var(--line);
    border-radius: 999px;
    background: #fff;
    color: var(--line);
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
  }

  .theme.on {
    background: var(--pastel-p2);
  }

  .chip {
    width: 22px;
    aspect-ratio: 1;
    border: 2px solid var(--line);
    border-radius: 50%;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 12px;
  }

  .set {
    grid-column: span 2;
  }

  .swatch {
    width: 48px;
    aspect-ratio: 1;
    border: 3px solid var(--line);
    border-radius: 12px;
  }

  .name {
    font-size: 14px;
    text-align: center;
    word-break: keep-all;
  }

  .price {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 16px;
  }
</style>
