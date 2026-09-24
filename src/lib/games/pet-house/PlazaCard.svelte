<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { BREEDS } from './breeds';
  import type { Plaza } from './plaza.svelte';
  import type { BreedId } from './types';

  let { plaza, breed, price, short }: { plaza: Plaza; breed: BreedId; price: number; short: number } = $props();

  const b = $derived(BREEDS[breed]);
</script>

<h2 class="yuru" style:--fill={b.kind === 'dog' ? 'var(--pastel-p1)' : 'var(--pastel-p2)'}>{b.name}</h2>
<p class="note">{b.note}</p>
<p class="how">
  {b.kind === 'dog'
    ? 'なでたり、じめんを ゆびで はじいて ボールを なげて みよう'
    : 'なでたり、じめんを ゆびで なぞって ねこじゃらしで あそんで みよう'}
</p>
{#if short > 0}<p class="why" role="status">コインが あと {short} たりないよ</p>{/if}
<div class="actions">
  <button class="pill" onclick={() => plaza.back()}>ほかの子を みる</button>
  <button class="pill p2" disabled={short > 0} onclick={() => plaza.go('name')}>
    この子に する{#if price > 0}<Icon name="coin" />{price}{/if}
  </button>
</div>

<style>
  h2 {
    font-size: clamp(26px, min(4.4cqh, 9cqw), 44px);
    white-space: nowrap;
  }

  .note,
  .how,
  .why {
    margin: 0;
    font-weight: 800;
    word-break: keep-all;
  }

  .note {
    font-size: 17px;
  }

  .how {
    color: var(--line-soft);
    font-size: 14px;
  }

  .why {
    color: #d63031;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
  }

  .pill:disabled {
    opacity: 0.5;
    box-shadow: none;
    cursor: default;
  }
</style>
