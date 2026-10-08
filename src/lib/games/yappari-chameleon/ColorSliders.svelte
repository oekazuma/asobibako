<script lang="ts">
  import type { RGB } from './color';

  /** which は、2 段めの色（RGBA と HSV）か、4 段めの艶（メタリックとラフネス）か。本家ではあいだに見本の段が入る */
  let {
    which,
    hsv,
    rgb,
    opacity,
    metal,
    rough,
    onhsv,
    onrgb,
    onopacity,
    onmetal,
    onrough
  }: {
    which: 'color' | 'gloss';
    hsv: [number, number, number];
    rgb: RGB;
    opacity: number;
    metal: number;
    rough: number;
    onhsv: (v: [number, number, number]) => void;
    onrgb: (c: RGB) => void;
    onopacity: (v: number) => void;
    onmetal: (v: number) => void;
    onrough: (v: number) => void;
  } = $props();

  interface Row {
    label: string;
    value: number;
    max: number;
    set: (v: number) => void;
  }

  const rgba = $derived<Row[]>([
    { label: 'R', value: rgb[0], max: 1, set: (v) => onrgb([v, rgb[1], rgb[2]]) },
    { label: 'G', value: rgb[1], max: 1, set: (v) => onrgb([rgb[0], v, rgb[2]]) },
    { label: 'B', value: rgb[2], max: 1, set: (v) => onrgb([rgb[0], rgb[1], v]) },
    { label: 'A', value: opacity, max: 1, set: onopacity }
  ]);
  const hsvRows = $derived<Row[]>([
    { label: 'H', value: hsv[0], max: 360, set: (v) => onhsv([v, hsv[1], hsv[2]]) },
    { label: 'S', value: hsv[1], max: 1, set: (v) => onhsv([hsv[0], v, hsv[2]]) },
    { label: 'V', value: hsv[2], max: 1, set: (v) => onhsv([hsv[0], hsv[1], v]) }
  ]);
  const gloss = $derived<Row[]>([
    { label: 'メタリック', value: metal, max: 1, set: onmetal },
    { label: 'ラフネス', value: rough, max: 1, set: onrough }
  ]);
</script>

{#snippet rows(list: Row[])}
  {#each list as row (row.label)}
    <label class="row">
      <span class="name">{row.label}</span>
      <input
        type="range"
        min="0"
        max={row.max}
        step={row.max === 360 ? 1 : 0.01}
        value={row.value}
        oninput={(e) => row.set(+e.currentTarget.value)}
        aria-label={row.label}
      />
      <span class="num">{row.max === 360 ? Math.round(row.value) : row.value.toFixed(2)}</span>
    </label>
  {/each}
{/snippet}

{#if which === 'color'}
  <div class="two">
    <div data-part="rgba">{@render rows(rgba)}</div>
    <div data-part="hsv">{@render rows(hsvRows)}</div>
  </div>
{:else}
  <div class="gloss" data-part="gloss">{@render rows(gloss)}</div>
{/if}

<style>
  .two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .row {
    display: grid;
    grid-template-columns: 1.3em 1fr 2.6em;
    align-items: center;
    gap: 4px;
    font-size: 12px;
  }

  .gloss .row {
    grid-template-columns: 5em 1fr 2.6em;
  }

  input {
    min-width: 0;
    accent-color: #fff;
  }

  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
