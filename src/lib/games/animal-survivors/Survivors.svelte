<script lang="ts">
  import type { SoloProps } from '$lib/games';
  import Play from './Play.svelte';

  // 15 分の 1 回が面ひとつなので、シェルの level と onfinish は使わない（リザルトはこのゲームが持つ）
  const _props: SoloProps = $props();
</script>

<Play animal="dog" onend={() => {}} />
