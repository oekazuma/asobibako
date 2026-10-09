<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import './round-button.css';
  import type { Session } from './session.svelte';

  let { session }: { session: Session } = $props();
</script>

<!-- 右の列の上に足す。スティックの指を置いたまま押すので、pointerdown で受ける -->
{#if session.canTaunt}
  <button class="round-btn taunt" disabled={session.tootWait > 0} onpointerdown={() => session.taunt()}>
    <Icon name="note" size="30px" />
    <span>挑発</span>
  </button>
{/if}

<style>
  /* 本家のキー案内で、挑発だけは黄色 */
  .taunt {
    border-color: #ffd23f;
    color: #ffd23f;
  }

  .taunt:disabled {
    opacity: 0.5;
  }
</style>
