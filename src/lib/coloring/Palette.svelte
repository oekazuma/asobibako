<script module lang="ts">
  export const COLORS = [
    { hex: '#f04438', name: 'あか' },
    { hex: '#f5913e', name: 'オレンジ' },
    { hex: '#ffd84d', name: 'きいろ' },
    { hex: '#fff3b0', name: 'クリーム' },
    { hex: '#b3ec3a', name: 'きみどり' },
    { hex: '#3bb54a', name: 'みどり' },
    { hex: '#5ee0c8', name: 'みずいろ' },
    { hex: '#63a8f7', name: 'あお' },
    { hex: '#3656d6', name: 'こいあお' },
    { hex: '#a974f2', name: 'むらさき' },
    { hex: '#f25ea6', name: 'ピンク' },
    { hex: '#ffb3d1', name: 'うすピンク' },
    { hex: '#ffd6b0', name: 'はだいろ' },
    { hex: '#8a5a3c', name: 'ちゃいろ' },
    { hex: '#9aa0a6', name: 'はいいろ' },
    { hex: '#2b2d42', name: 'くろ' },
    { hex: '#ffffff', name: 'しろ' }
  ] as const;
</script>

<script lang="ts">
  let {
    color = $bindable(),
    canUndo,
    onundo,
    ondone,
    onsave
  }: { color: string; canUndo: boolean; onundo: () => void; ondone?: () => void; onsave: () => void } = $props();
</script>

<div class="palette">
  <div class="colors">
    {#each COLORS as c (c.hex)}
      <button
        class="swatch"
        style:background={c.hex}
        aria-label={c.name}
        aria-pressed={color === c.hex}
        onclick={() => (color = c.hex)}
      ></button>
    {/each}
  </div>
  <div class="row">
    <button class="pill" disabled={!canUndo} onclick={onundo}>1つ もどす</button>
    <button class="pill" onclick={onsave}>しゃしんに ほぞん</button>
    {#if ondone}<button class="pill gold" onclick={ondone}>できた！</button>{/if}
  </div>
</div>

<style>
  .palette {
    --size: clamp(30px, min(5cqh, 9cqw), 50px);
    display: grid;
    gap: 10px;
    justify-items: center;
    padding: 10px 10px max(10px, env(safe-area-inset-bottom));
    border-top: 3px solid var(--line);
    background: var(--paper);
  }

  .colors {
    display: grid;
    grid-template-columns: repeat(9, var(--size));
    gap: clamp(4px, 1.2cqw, 10px);
  }

  .swatch {
    width: var(--size);
    aspect-ratio: 1;
    border: 3px solid var(--line);
    border-radius: 50%;
    cursor: pointer;
  }

  .swatch[aria-pressed='true'] {
    outline: 4px solid var(--pastel-gold);
    outline-offset: 2px;
    scale: 1.1;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }
</style>
