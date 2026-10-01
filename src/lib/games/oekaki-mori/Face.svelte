<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import type { Seat } from '$lib/net/party.svelte';
  import { lookOf } from './looks';

  let {
    seat,
    look,
    size = '2em',
    name = false
  }: { seat: Seat; look?: string; size?: string; name?: boolean } = $props();

  const found = $derived(lookOf(look));
</script>

<!-- 同じ動物を選んだ人どうしも、番号の色の丸で見分ける -->
<span class="face">
  <span class="disc p{seat}" style:width={size} style:height={size}>
    {#if found}<Icon name={found.id} size="80%" />{:else}<small>{seat}P</small>{/if}
  </span>
  {#if name && found}<span>{found.name}</span>{/if}
</span>

<style>
  .face {
    display: inline-flex;
    align-items: center;
    gap: 0.25em;
    vertical-align: middle;
  }

  .disc {
    display: inline-grid;
    place-items: center;
    border: 2px solid var(--line);
    border-radius: 50%;
  }

  /* 丸の大きさは em で受けるので、丸そのものの文字の大きさは変えず、番号だけを小さくする */
  small {
    font-size: 0.6em;
  }

  .disc.p1 {
    background: var(--pastel-p1);
  }

  .disc.p2 {
    background: var(--pastel-p2);
  }

  .disc.p3 {
    background: var(--pastel-p3);
  }
</style>
