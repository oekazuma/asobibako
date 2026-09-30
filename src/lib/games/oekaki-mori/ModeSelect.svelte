<script lang="ts">
  import type { Party } from '$lib/net/party.svelte';
  import type { Mode } from './engine';

  let { party, onpick, onlobby }: { party: Party; onpick: (mode: Mode | 'together') => void; onlobby: () => void } =
    $props();
</script>

<div class="mode">
  <h2 class="yuru">あそびかた</h2>
  {#if party.host}
    <button class="pill gold choice" disabled={party.members.length < 2} onclick={() => onpick('egokoro')}>
      エゴコロクイズ
      <small>ひとりが おだいを かいて、みんなで あてる</small>
    </button>
    <button class="pill gold choice" disabled={party.members.length < 2} onclick={() => onpick('hayaoshi')}>
      はやおし検定
      <small>かいている とちゅうで わかったら はやおし！</small>
    </button>
    <button class="pill gold choice" disabled={party.members.length < 2} onclick={() => onpick('together')}>
      みんなでぬりえ
      <small>おなじ えを みんなで いっしょに ぬる</small>
    </button>
    {#if party.members.length < 2}<p role="alert">なかまが いなくなりました</p>{/if}
    <button class="pill" onclick={onlobby}>なかまを よびなおす</button>
  {:else}
    <p role="status">おやが あそびかたを えらんでいます…</p>
  {/if}
</div>

<style>
  .mode {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 16px;
    background: var(--paper-dots), var(--paper);
    color: var(--line);
    font-weight: 700;
    text-align: center;
  }

  h2 {
    font-size: clamp(26px, min(5cqh, 8cqw), 44px);
  }

  .choice {
    flex-direction: column;
    font-size: clamp(20px, 3.2cqh, 28px);
  }

  .choice small {
    font-size: 0.6em;
  }
</style>
