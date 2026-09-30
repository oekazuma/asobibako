<script lang="ts">
  import Board from './Board.svelte';
  import { apply, ERASER, PENS, SIZES, type Stroke } from './strokes';
  import Tools from './Tools.svelte';

  let { onback }: { onback: () => void } = $props();

  let strokes = $state.raw<Stroke[]>([]);
  let color = $state<string>(PENS[0].hex);
  let size = $state(1);
  let erasing = $state(false);
  const pen = $derived(erasing ? ERASER : { color, size: SIZES[size] });
</script>

<header class="bar">
  <button class="pill" onclick={onback}>もどる</button>
  <p class="title">ひとりで れんしゅう</p>
</header>
<div class="middle">
  <Board {strokes} {pen} onink={(ink) => (strokes = apply(strokes, ink))} />
</div>
<Tools
  bind:color
  bind:size
  bind:erasing
  onundo={() => (strokes = apply(strokes, { k: 'undo' }))}
  onclear={() => (strokes = [])}
/>

<style>
  .bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: max(8px, env(safe-area-inset-top)) 12px 8px;
  }

  .title {
    font-weight: 800;
    color: var(--line);
  }

  .middle {
    flex: 1;
    display: grid;
    place-items: center;
    min-height: 0;
    padding: 8px;
    container-type: size;
  }
</style>
