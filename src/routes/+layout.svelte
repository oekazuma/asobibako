<script lang="ts">
  import { onMount } from 'svelte';
  import '../app.css';
  import { keepScreenAwake } from '$lib/wake-lock.svelte';

  let { children } = $props();

  onMount(keepScreenAwake);
</script>

<svelte:head>
  <title>Table Duel — iPad をはさんで 2 人で遊ぶ対戦ゲーム</title>
  <meta name="description" content="iPad 1台をはさんで2人で遊ぶ対戦ゲーム" />
</svelte:head>

{@render children()}
