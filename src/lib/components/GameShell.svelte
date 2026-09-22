<script lang="ts">
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import { audio, sfx, toggleMute, wake } from '$lib/audio.svelte';
  import type { DuelMeta, GameModule } from '$lib/games';
  import { Settle } from '$lib/settle.svelte';
  import type { Player } from '$lib/player';
  import ResultScreen from './ResultScreen.svelte';
  import TitleScreen from './TitleScreen.svelte';

  let { meta, Game, Howto }: { meta: DuelMeta } & GameModule = $props();

  let screen = $state<'title' | 'playing' | 'result'>('title');
  let winner = $state<Player>(1);
  let round = $state(0);
  const settle = new Settle();

  const ready = $state<Record<Player, boolean>>({ 1: false, 2: false });
  const pads: Record<Player, Set<number>> = { 1: new Set(), 2: new Set() };

  /** 合成イベントや既に解放されたポインタでは失敗するが、掴み自体は続行してよい */
  function capture(event: PointerEvent) {
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // noop
    }
  }

  function padDown(event: PointerEvent, player: Player) {
    event.preventDefault();
    wake();
    capture(event);
    pads[player].add(event.pointerId);
    ready[player] = true;
    // マウスは同時に1点しか置けないので、PC では片側を押しただけで始められるようにする
    if (event.pointerType === 'mouse') ready[1] = ready[2] = true;
  }

  function padUp(event: PointerEvent, player: Player) {
    pads[player].delete(event.pointerId);
    ready[player] = pads[player].size > 0;
    if (event.pointerType === 'mouse') ready[1] = ready[2] = false;
  }

  function start() {
    sfx.start();
    ready[1] = ready[2] = false;
    pads[1].clear();
    pads[2].clear();
    round += 1;
    screen = 'playing';
  }

  function finish(won: Player) {
    winner = won;
    screen = 'result';
    settle.begin();
  }

  onMount(settle.listen);

  $effect(() => {
    if (screen !== 'title' || !ready[1] || !ready[2]) return;
    const t = setTimeout(start, 550);
    return () => clearTimeout(t);
  });
</script>

<main class="stage" class:settling={settle.active}>
  {#if screen === 'playing'}
    {#key round}
      <Game onfinish={finish} />
    {/key}
  {:else}
    {#if screen === 'title'}
      <TitleScreen name={meta.name} {Howto} {ready} onpaddown={padDown} onpadup={padUp} />
    {:else}
      <ResultScreen {winner} onagain={start} />
    {/if}

    <!-- 対戦中は誤操作で抜けないよう出さない。どちらのプレイヤーからも等距離の、境界線の高さの左右端に置く -->
    <a class="edge back" href={resolve('/')} aria-label="ゲーム選択へ戻る">✕</a>
    <button class="edge mute" onclick={toggleMute} aria-label="ミュート" aria-pressed={audio.muted}>
      {audio.muted ? '🔇' : '🔊'}
    </button>
  {/if}
</main>

<style>
  .edge {
    position: absolute;
    top: 50%;
    translate: 0 -50%;
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border: 3px solid #fff;
    border-radius: 50%;
    background: var(--card);
    box-shadow: var(--lift);
    color: var(--ink);
    font-size: 18px;
    font-weight: 800;
    text-decoration: none;
    cursor: pointer;
  }

  .back {
    left: max(10px, env(safe-area-inset-left));
  }

  .mute {
    right: max(10px, env(safe-area-inset-right));
  }

  .settling .edge,
  .settling :global(.again) {
    pointer-events: none;
  }
</style>
