<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import { audio, sfx, toggleMute, wake } from '$lib/audio.svelte';
  import { capture } from '$lib/board-input';
  import type { DuelMeta, GameModule } from '$lib/games';
  import type { Net } from '$lib/net/link';
  import { Settle } from '$lib/settle.svelte';
  import type { Player } from '$lib/player';
  import ResultScreen from './ResultScreen.svelte';
  import TitleScreen from './TitleScreen.svelte';

  let { meta, Game, Howto, net, onpair }: { meta: DuelMeta; net?: Net; onpair?: () => void } & GameModule = $props();
  /** 2 台で遊ぶときの子。画面ごと 180 度回して 2P を手前に置き、開始と決着は親の知らせで動く */
  const guest = $derived(net?.me === 2);

  let screen = $state<'title' | 'playing' | 'result'>('title');
  let winner = $state<Player>(1);
  let round = $state(0);
  /** このセッションの勝ち数。一覧に戻るとコンポーネントごと作り直されるので、リセットは要らない */
  const wins = $state<Record<Player, number>>({ 1: 0, 2: 0 });
  const settle = new Settle();

  const ready = $state<Record<Player, boolean>>({ 1: false, 2: false });
  const pads: Record<Player, Set<number>> = { 1: new Set(), 2: new Set() };

  function padDown(event: PointerEvent, player: Player) {
    event.preventDefault();
    if (net && player !== net.me) return;
    wake();
    capture(event);
    pads[player].add(event.pointerId);
    ready[player] = true;
    net?.link.send({ t: 'ready', on: true });
    // マウスは同時に1点しか置けないので、PC では片側を押しただけで始められるようにする
    if (!net && event.pointerType === 'mouse') ready[1] = ready[2] = true;
  }

  function padUp(event: PointerEvent, player: Player) {
    if (net && player !== net.me) return;
    pads[player].delete(event.pointerId);
    ready[player] = pads[player].size > 0;
    net?.link.send({ t: 'ready', on: ready[player] });
    if (!net && event.pointerType === 'mouse') ready[1] = ready[2] = false;
  }

  function start() {
    sfx.start();
    ready[1] = ready[2] = false;
    pads[1].clear();
    pads[2].clear();
    round += 1;
    screen = 'playing';
    if (net?.me === 1) net.link.send({ t: 'start' });
  }

  function finish(won: Player) {
    if (screen !== 'playing') return;
    winner = won;
    wins[won] += 1;
    screen = 'result';
    settle.begin();
    if (net?.me === 1) net.link.send({ t: 'finish', winner: won });
  }

  /** 子の「もう一度」は親に頼み、始めるのは親が決める */
  const again = () => (guest ? net?.link.send({ t: 'again' }) : start());

  onMount(settle.listen);

  onMount(() =>
    net?.link.on((message) => {
      if (message.t === 'ready') ready[net.me === 1 ? 2 : 1] = message.on === true;
      else if (message.t === 'start' && screen !== 'playing') start();
      else if (message.t === 'finish') finish(message.winner as Player);
      else if (message.t === 'again' && screen === 'result') start();
    })
  );

  $effect(() => {
    if (screen !== 'title' || !ready[1] || !ready[2] || guest) return;
    const t = setTimeout(start, 550);
    return () => clearTimeout(t);
  });
</script>

<main class="stage" class:settling={settle.active}>
  <!-- .stage は横向きで回っているので、子の 180 度はその内側で回す -->
  <div class="view" class:flip={guest}>
    {#if screen === 'playing'}
      {#key round}
        <Game onfinish={finish} {net} />
      {/key}
    {:else}
      {#if screen === 'title'}
        <TitleScreen name={meta.name} {Howto} {ready} onpaddown={padDown} onpadup={padUp} />
      {:else}
        <ResultScreen {winner} {wins} onagain={again} />
      {/if}

      <!-- 対戦中は誤操作で抜けないよう出さない。どちらのプレイヤーからも等距離の、境界線の高さの左右端に置く -->
      <a class="round edge back" href={resolve('/')} aria-label="ゲーム選択へ戻る">✕</a>
      <button class="round edge mute" onclick={toggleMute} aria-label="ミュート" aria-pressed={audio.muted}>
        <Icon name={audio.muted ? 'mute' : 'speaker'} size="26px" />
      </button>
      {#if onpair && !net && screen === 'title'}
        <button class="round edge pair" onclick={onpair} aria-label="2だいで あそぶ">2だい</button>
      {/if}
    {/if}
  </div>
</main>

<style>
  .edge {
    position: absolute;
    top: 50%;
    translate: 0 -50%;
  }

  .back {
    left: max(10px, env(safe-area-inset-left));
  }

  .mute {
    right: max(10px, env(safe-area-inset-right));
  }

  .pair {
    left: 50%;
    width: auto;
    padding: 0 14px;
    border-radius: 999px;
    font-size: 16px;
    translate: -50% -50%;
  }

  .view {
    display: contents;
  }

  .view.flip {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    rotate: 180deg;
  }

  .settling .edge,
  .settling :global(.again) {
    pointer-events: none;
  }
</style>
