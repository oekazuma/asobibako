<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import './round-button.css';
  import type { Session } from './session.svelte';

  let { session }: { session: Session } = $props();
  const match = $derived(session.match);
  const wished = $derived(match.view.wishes.includes(match.me));
</script>

<!-- 右の列の上に足す。スティックの指を置いたまま押すので、pointerdown で受ける -->
{#if match.phase === 'lobby'}
  <button class="round-btn wish" class:on={wished} aria-pressed={wished} onpointerdown={() => session.wish()}>
    <span class="mark"></span>
    <span>ハンター希望</span>
  </button>
{/if}
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

  .mark {
    width: 22px;
    height: 22px;
    margin-bottom: 4px;
    border: 2px solid #fff;
    border-radius: 50%;
  }

  /* 希望を出した印は赤。.on の白塗りより優先する */
  .wish.on {
    border-color: #ff4a3d;
    background: rgb(160 20 10 / 0.6);
    color: #fff;
    text-shadow: 0 1px 2px #000;
  }

  .wish.on .mark {
    border-color: #ff4a3d;
    background: #ff4a3d;
  }
</style>
