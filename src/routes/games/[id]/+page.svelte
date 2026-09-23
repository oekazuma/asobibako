<script lang="ts">
  import GameShell from '$lib/components/GameShell.svelte';
  import SoloShell from '$lib/components/SoloShell.svelte';
  import { rememberGame } from '$lib/recent';

  let { data } = $props();

  // 別のゲームへ移ってもページの部品は使い回されるので、onMount ではなく id の変化で覚える
  $effect(() => rememberGame(data.play.meta.id));
</script>

<svelte:head>
  <title>{data.play.meta.name} — Table Duel</title>
</svelte:head>

<!-- 別のゲームへ移ったとき、前のゲームの画面状態を持ち越さない -->
{#key data.play.meta.id}
  {#if data.play.solo}
    <SoloShell meta={data.play.meta} Game={data.play.Game} Howto={data.play.Howto} />
  {:else}
    <GameShell meta={data.play.meta} Game={data.play.Game} Howto={data.play.Howto} />
  {/if}
{/key}
