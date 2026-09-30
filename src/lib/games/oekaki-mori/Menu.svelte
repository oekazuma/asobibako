<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { audio, toggleMute } from '$lib/audio.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import type { Party } from '$lib/net/party.svelte';

  let { party, oninvite }: { party: Party; oninvite: () => void } = $props();

  let open = $state(false);
  let asking = $state(false);

  function close() {
    open = false;
    asking = false;
  }

  function leave() {
    party.close();
    void goto(resolve('/'));
  }
</script>

<button class="round menu" aria-label="メニュー" aria-expanded={open} onclick={() => (open ? close() : (open = true))}>
  <Icon name="menu" size="26px" />
</button>
{#if open}
  <div class="sheet" role="dialog" aria-label="メニュー">
    {#if asking}
      <div class="confirm">
        <p>{party.host ? 'ぬけると みんなの あそびが おわるよ' : 'ぬけても おやが よびなおせるよ'}</p>
        <div class="row">
          <button class="pill" onclick={() => (asking = false)}>もどる</button>
          <button class="pill p2 leave" onclick={leave}>ぬける</button>
        </div>
      </div>
    {:else}
      <button class="pill" aria-pressed={audio.muted} onclick={toggleMute}>
        <Icon name={audio.muted ? 'mute' : 'speaker'} size="22px" />
        {audio.muted ? 'おとを だす' : 'おとを けす'}
      </button>
      {#if party.host && party.members.length < 3}
        <button
          class="pill"
          onclick={() => {
            close();
            oninvite();
          }}>なかまを よぶ</button
        >
      {/if}
      <button class="pill" onclick={() => (asking = true)}>ぬける…</button>
      <button class="pill gold" onclick={close}>とじる</button>
    {/if}
  </div>
{/if}

<style>
  .menu {
    position: absolute;
    top: max(10px, env(safe-area-inset-top));
    right: max(10px, env(safe-area-inset-right));
    z-index: 5;
  }

  .sheet {
    position: absolute;
    top: calc(max(10px, env(safe-area-inset-top)) + 64px);
    right: max(10px, env(safe-area-inset-right));
    z-index: 5;
    display: grid;
    gap: 10px;
    min-width: min(280px, 80cqw);
    padding: 16px;
    border: 3px solid var(--line);
    border-radius: 18px;
    background: var(--paper);
    box-shadow: var(--soft-shadow);
    color: var(--line);
    font-weight: 800;
    text-align: center;
  }

  .row {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }

  .row .pill {
    flex: 1;
  }
</style>
