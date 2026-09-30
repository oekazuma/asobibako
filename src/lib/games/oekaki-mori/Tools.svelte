<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { PENS, SIZES } from './strokes';

  let {
    color = $bindable(),
    size = $bindable(),
    erasing = $bindable(),
    onundo,
    onclear
  }: { color: string; size: number; erasing: boolean; onundo: () => void; onclear: () => void } = $props();

  const NAMES = ['ほそい', 'ふつう', 'ふとい'];
</script>

<div class="tools">
  <div class="pens">
    {#each PENS as p (p.hex)}
      <button
        class="swatch"
        style:background={p.hex}
        aria-label={p.name}
        aria-pressed={!erasing && color === p.hex}
        onclick={() => {
          color = p.hex;
          erasing = false;
        }}
      ></button>
    {/each}
  </div>
  <div class="row">
    {#each SIZES as width, i (width)}
      <button
        class="tool"
        aria-label={NAMES[i]}
        aria-pressed={!erasing && size === i}
        onclick={() => {
          size = i;
          erasing = false;
        }}><span class="dot" style:width="{6 + i * 8}px" style:background={color}></span></button
      >
    {/each}
    <button class="tool text" aria-pressed={erasing} onclick={() => (erasing = true)}>けしごむ</button>
    <button class="tool" aria-label="1つ もどす" onclick={onundo}><Icon name="undo" size="70%" /></button>
    <button class="tool text" onclick={onclear}>ぜんぶ けす</button>
  </div>
</div>

<style>
  .tools {
    --size: clamp(34px, min(5.4cqh, 9cqw), 52px);
    display: grid;
    gap: 8px;
    justify-items: center;
    padding: 8px 8px max(8px, env(safe-area-inset-bottom));
    border-top: 3px solid var(--line);
    background: var(--paper);
  }

  .pens,
  .row {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: clamp(4px, 1.4cqw, 10px);
  }

  .swatch,
  .tool {
    display: grid;
    place-items: center;
    min-width: var(--size);
    height: var(--size);
    border: 3px solid var(--line);
    border-radius: 999px;
    background: #fff;
    color: var(--line);
    font-weight: 800;
    cursor: pointer;
  }

  .tool.text {
    padding: 0 12px;
    font-size: clamp(13px, 2cqh, 17px);
  }

  [aria-pressed='true'] {
    outline: 4px solid var(--pastel-gold);
    outline-offset: 2px;
  }

  .dot {
    aspect-ratio: 1;
    border-radius: 50%;
  }
</style>
