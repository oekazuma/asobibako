<script lang="ts">
  import { GEAR_ART } from './art/gear';
  import { parseKey, type GearKey } from './gear';
  import PixelIcon from './PixelIcon.svelte';

  let { gear, size }: { gear: GearKey; size: string } = $props();

  const p = $derived(parseKey(gear));
</script>

{#if p}
  <span class="icon r{p.rarity}"><PixelIcon art={GEAR_ART[p.def.id]} {size} /></span>
{/if}

<style>
  .icon {
    display: inline-flex;
    flex: none;
    padding: 3px;
    border: 3px solid #f4ead7;
    background: #272040;
  }

  .r1 {
    border-color: #4a8fe0;
  }

  .r2 {
    border-color: #ffd84a;
    box-shadow: 0 0 8px #ffd84a;
  }
</style>
