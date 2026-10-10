<script lang="ts">
  import CpuSetup from './CpuSetup.svelte';
  import type { Crew } from './cpu/crew';
  import { readCpu, readSettings, saveCpu, saveSettings } from './prefs';
  import type { Session } from './session.svelte';
  import Settings from './Settings.svelte';

  let { session, crew = null, oninvite }: { session: Session; crew?: Crew | null; oninvite: () => void } = $props();
  let open = $state(false);
  let picking = $state(false);
  let settings = $state(readSettings());
  let choice = $state(readCpu());
  const party = $derived(session.party);
  // CPU は始めるときに席へ着け直すので、着き終わる前でも CPU の席を数える
  const players = $derived(crew ? choice.count + 1 : party.members.length);

  /** CPU と遊ぶでは、マップの設定から始めても、ハンターとモードは CPU の設定の役で決める */
  function begin() {
    if (crew) void crew.play($state.snapshot(choice), $state.snapshot(settings));
    else session.start(settings);
  }

  function start() {
    saveSettings(settings);
    open = false;
    begin();
  }

  function startCpu() {
    saveCpu(choice);
    picking = false;
    begin();
  }
</script>

<div class="bar">
  <p>{party.members.map((seat) => session.match.name(seat)).join('・')}（{party.members.length}/3人）</p>
  {#if party.host}
    <button onclick={() => (open = true)}>マップの設定</button>
    {#if crew}
      <button onclick={() => (picking = true)}>CPU の設定</button>
    {:else if party.members.length < 3}
      <button onclick={oninvite}>なかまを呼ぶ</button>
    {/if}
  {:else}
    <p role="status">ホストが始めるのを待っています</p>
  {/if}
</div>
{#if open}
  <Settings bind:settings {players} cpu={!!crew} onstart={start} onclose={() => (open = false)} />
{/if}
{#if picking}<CpuSetup bind:choice onstart={startCpu} onclose={() => (picking = false)} />{/if}

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
