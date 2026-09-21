<script lang="ts">
  import GameShell from '$lib/components/GameShell.svelte';

  let { data } = $props();
</script>

<svelte:head>
  <title>{data.meta.name} — Table Duel</title>
</svelte:head>

<!-- 別のゲームへ移ったとき、前のゲームの画面状態を持ち越さない -->
{#key data.meta.id}
  <GameShell meta={data.meta} Game={data.Game} Howto={data.Howto} />
{/key}
