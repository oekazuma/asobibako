<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import type { Party } from '$lib/net/party.svelte';
  import type { Mode } from './engine';

  let { party, onpick }: { party: Party; onpick: (mode: Mode | 'together') => void } = $props();

  const MODES = [
    { mode: 'egokoro', icon: 'pencil', name: 'エゴコロクイズ', note: 'ひとりが かいて、みんなで こたえを うつ' },
    { mode: 'hayaoshi', icon: 'bolt', name: 'はやおし検定', note: 'わかったら はやおし！ 4つから えらぶ' },
    { mode: 'together', icon: 'brush', name: 'みんなでぬりえ', note: 'おなじ えを みんなで いっしょに ぬる' }
  ] as const;
</script>

<div class="mode">
  <h2 class="yuru">あそびかた</h2>
  {#if party.host}
    {#each MODES as m (m.mode)}
      <button class="pill gold choice" disabled={party.members.length < 2} onclick={() => onpick(m.mode)}>
        <Icon name={m.icon} size="40px" />
        <span>{m.name}<small>{m.note}</small></span>
      </button>
    {/each}
    {#if party.members.length < 2}<p role="alert">なかまが いなくなりました。メニューから よんでね</p>{/if}
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
    gap: 14px;
    justify-content: flex-start;
    width: min(460px, 88cqw);
    padding: 14px 18px;
    font-size: clamp(20px, 3.2cqh, 28px);
    text-align: left;
  }

  .choice span {
    display: grid;
  }

  .choice small {
    font-size: 0.6em;
  }
</style>
