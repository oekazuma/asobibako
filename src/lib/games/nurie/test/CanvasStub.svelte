<script lang="ts">
  import { onMount } from 'svelte';
  import type { Regions } from '$lib/coloring/regions';

  // 本物の Canvas は canvas の描画が要るので、場所の数を見せて最初の場所を 1 回塗るだけの代わりを置く
  let { regions, onfill }: { regions: Regions; onfill: (region: number) => void } = $props();

  onMount(() => onfill(0));
</script>

<p class="stub-regions">{regions.count}</p>
