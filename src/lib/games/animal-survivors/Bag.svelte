<script lang="ts">
  import { GEAR, keyOf, parseKey, RARITY_NAME, SLOT_NAME, SLOTS, type GearKey } from './gear';
  import GearIcon from './GearIcon.svelte';
  import type { Records } from './records';

  let {
    bag,
    worn,
    locks,
    onpick
  }: { bag: Records['bag']; worn: Records['worn']; locks: GearKey[]; onpick: (k: GearKey) => void } = $props();

  const on = $derived(new Set(Object.values(worn)));
  // 場所ごとに表の順、同じ品はレア度の高い順
  const groups = $derived(
    SLOTS.map((s) => ({
      s,
      keys: GEAR.filter((d) => d.slot === s)
        .flatMap((d) => ([2, 1, 0] as const).map((r) => keyOf(d.id, r)))
        .filter((k) => bag[k])
    })).filter((g) => g.keys.length)
  );
  const label = (k: GearKey) => {
    const p = parseKey(k)!;
    return `${p.def.name}（${RARITY_NAME[p.rarity]}）`;
  };
</script>

{#each groups as g (g.s)}
  <h3>{SLOT_NAME[g.s]}</h3>
  <div class="grid">
    {#each g.keys as k (k)}
      <button class="cell" data-gear={k} aria-label={label(k)} onclick={() => onpick(k)}>
        <GearIcon gear={k} size="min(9cqw, 5cqh, 44px)" />
        {#if (bag[k] ?? 0) > 1}<span class="n">×{bag[k]}</span>{/if}
        {#if on.has(k)}<span class="on">E</span>{/if}
        {#if locks.includes(k)}<span class="lock" data-locked>鍵</span>{/if}
      </button>
    {/each}
  </div>
{:else}
  <p class="empty">まだ装備がありません。ガチャで手に入れよう</p>
{/each}

<style>
  h3 {
    margin: 4px 0 0;
    color: #ffd84a;
    font-size: min(3.4cqw, 2cqh, 17px);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(16cqw, 64px), 1fr));
    gap: 6px;
  }

  .cell {
    position: relative;
    display: flex;
    justify-content: center;
    padding: 4px;
    border: 0;
    background: none;
    cursor: pointer;
  }

  .n,
  .on,
  .lock {
    position: absolute;
    padding: 0 3px;
    color: #24151f;
    font-size: min(2.6cqw, 1.5cqh, 13px);
    font-weight: 800;
  }

  .n {
    right: 0;
    bottom: 0;
    background: #fff8ec;
  }

  .lock {
    bottom: 0;
    left: 0;
    background: #ffd84a;
  }

  .on {
    top: 0;
    left: 0;
    background: #8fd14f;
  }

  .empty {
    margin: 8px 0;
    color: #bcc4ce;
    text-align: center;
  }
</style>
