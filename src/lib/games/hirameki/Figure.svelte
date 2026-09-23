<script lang="ts">
  import type { Snippet } from 'svelte';
  import Shapes from './Shapes.svelte';
  import type { Figure } from './types';

  /** children は図の上に重ねる部品。図と同じ縦横比の箱に % で置けば、図の座標とずれない */
  let { fig, children }: { fig: Figure; children?: Snippet } = $props();
</script>

<div class="fig" style:--ar={fig.w / fig.h}>
  <Shapes {fig} />
  {@render children?.()}
</div>

<style>
  .fig {
    position: relative;
    /* 額（.stage とは別のコンテナ）に、縦横比を保ったまま収まるいちばん大きい箱 */
    width: min(100cqw, calc(100cqh * var(--ar)));
    aspect-ratio: var(--ar);
  }
</style>
