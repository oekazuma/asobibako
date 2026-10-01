<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import type { Party } from '$lib/net/party.svelte';
  import type { Chars, Length, Mode } from './engine';

  let {
    party,
    onpick,
    length = $bindable('normal'),
    chars = $bindable(null)
  }: { party: Party; onpick: (mode: Mode | 'together') => void; length?: Length; chars?: Chars } = $props();

  const LENGTH_NAMES = [
    ['short', 'みじかめ'],
    ['normal', 'ふつう'],
    ['long', 'ながめ']
  ] as const;

  const CHARS_NAMES = [
    [3, '3 もじまで'],
    [4, '4 もじまで'],
    [null, 'ぜんぶ']
  ] as const;

  const MODES = [
    { mode: 'egokoro', icon: 'pencil', name: 'エゴコロクイズ', note: 'ひとりが かいて、みんなで こたえを うつ' },
    { mode: 'hayaoshi', icon: 'bolt', name: 'はやおし検定', note: 'わかったら はやおし！ 4つから えらぶ' },
    { mode: 'together', icon: 'brush', name: 'みんなでぬりえ', note: 'おなじ えを みんなで いっしょに ぬる' }
  ] as const;
</script>

<div class="mode">
  <h2 class="yuru">あそびかた</h2>
  {#if party.host}
    <div class="lengths" role="group" aria-label="ながさ">
      {#each LENGTH_NAMES as [id, name] (id)}
        <button class="pill" aria-pressed={length === id} onclick={() => (length = id)}>{name}</button>
      {/each}
    </div>
    <div class="lengths" role="group" aria-label="もじすう">
      {#each CHARS_NAMES as [id, name] (id)}
        <button class="pill" aria-pressed={chars === id} onclick={() => (chars = id)}>{name}</button>
      {/each}
    </div>
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

  .lengths {
    display: flex;
    gap: 8px;
  }

  .lengths [aria-pressed='true'] {
    --face: var(--pastel-gold);
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
