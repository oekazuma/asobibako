<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import type { Doodle } from './stock';

  let { doodle }: { doodle: Doodle } = $props();
</script>

<!-- バトルで勝った絵のしるし。優勝した絵はトロフィー、勝っただけの絵は勝ち数 -->
{#if doodle.wins}
  <span class="medal" class:crown={doodle.crown} role="img" aria-label="かった かず {doodle.wins}">
    {#if doodle.crown}<Icon name="trophy" size="20px" />{/if}{doodle.wins}
  </span>
{/if}

<style>
  .medal {
    position: absolute;
    right: -6px;
    bottom: -6px;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 1px 8px;
    border: 2px solid #fff;
    border-radius: 999px;
    background: var(--p2);
    color: #fff;
    font-size: 13px;
    font-weight: 900;
    box-shadow: var(--soft-shadow);
    pointer-events: none;
  }

  .crown {
    background: var(--gold);
    color: var(--ink);
  }
</style>
