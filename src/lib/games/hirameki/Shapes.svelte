<script lang="ts">
  import type { Figure } from './types';

  let { fig }: { fig: Figure } = $props();
</script>

<!-- 部品の中身は snippet で入れ子にたどる。svg の中にコンポーネントを置くと markuplint が中身の規則で止めるため -->
{#snippet draw(shapes: Figure['s'])}
  <!-- 同じ部品のデータを 2 か所に置いてもよいよう、添え字で並べる -->
  {#each { length: shapes.length }, i (i)}
    {@const s = shapes[i]}
    <svelte:element this={s.el} {...s.a} xmlns="http://www.w3.org/2000/svg">
      {#if s.t}{s.t}{/if}
      {#if s.c}{@render draw(s.c)}{/if}
    </svelte:element>
  {/each}
{/snippet}

<svg viewBox={`0 0 ${fig.w} ${fig.h}`} aria-hidden="true">{@render draw(fig.s)}</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
</style>
