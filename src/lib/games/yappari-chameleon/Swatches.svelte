<script lang="ts">
  import { fromHex, SWATCHES, toHex, type RGB } from './color';

  let { recent, onpick }: { recent: RGB[]; onpick: (c: RGB) => void } = $props();
</script>

<div data-part="swatches">
  {#if recent.length}
    <div class="line" role="group" aria-label="最近使った色">
      {#each recent as c, i (i)}
        <button class="chip" style:background={toHex(c)} onclick={() => onpick(c)} aria-label="最近の色 {i + 1}"
        ></button>
      {/each}
    </div>
  {/if}
  <div class="grid">
    {#each SWATCHES as hex (hex)}
      <button
        class="chip"
        data-swatch={hex}
        style:background={hex}
        onclick={() => onpick(fromHex(hex))}
        aria-label={hex}
      ></button>
    {/each}
  </div>
</div>

<style>
  .line {
    display: flex;
    gap: 4px;
    margin-bottom: 6px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(14, 1fr);
    gap: 3px;
  }

  .chip {
    aspect-ratio: 1;
    min-width: 0;
    padding: 0;
    border: 1px solid rgb(255 255 255 / 0.6);
    border-radius: 4px;
  }

  .line .chip {
    width: 26px;
  }
</style>
