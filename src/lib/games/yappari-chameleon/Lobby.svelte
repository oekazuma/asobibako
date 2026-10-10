<script lang="ts">
  import { readSettings, saveSettings } from './prefs';
  import type { Session } from './session.svelte';
  import Settings from './Settings.svelte';

  let { session, oninvite }: { session: Session; oninvite: () => void } = $props();
  let open = $state(false);
  let settings = $state(readSettings());
  const party = $derived(session.party);

  function start() {
    saveSettings(settings);
    open = false;
    session.start(settings);
  }
</script>

<div class="bar">
  <p>{party.members.map((seat) => session.match.name(seat)).join('・')}（{party.members.length}/3人）</p>
  {#if party.host}
    <button onclick={() => (open = true)}>マップの設定</button>
    {#if party.members.length < 3}<button onclick={oninvite}>なかまを呼ぶ</button>{/if}
  {:else}
    <p role="status">ホストが始めるのを待っています</p>
  {/if}
</div>
{#if open}
  <Settings bind:settings players={party.members.length} onstart={start} onclose={() => (open = false)} />
{/if}

<style>
  .bar {
    position: absolute;
    top: max(10px, env(safe-area-inset-top));
    left: 50%;
    translate: -50% 0;
    display: flex;
    align-items: center;
    gap: 12px;
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 16px;
    text-shadow: 0 1px 3px #000;
    white-space: nowrap;
  }

  p {
    margin: 0;
  }

  button {
    padding: 6px 16px;
    border: 2px solid rgb(255 255 255 / 0.85);
    border-radius: 999px;
    background: rgb(0 0 0 / 0.35);
    color: #fff;
    font: inherit;
    text-shadow: inherit;
  }
</style>
