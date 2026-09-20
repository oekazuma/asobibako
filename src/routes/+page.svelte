<script lang="ts">
  import { sfx, wake } from '$lib/audio.svelte';
  import ResultScreen from '$lib/components/ResultScreen.svelte';
  import TitleScreen from '$lib/components/TitleScreen.svelte';
  import { games } from '$lib/games';
  import type { Player } from '$lib/player';

  const game = games[0];
  const Game = game.component;

  let screen = $state<'title' | 'playing' | 'result'>('title');
  let winner = $state<Player>(1);
  let round = $state(0);
  /** 決着タップで指を離した位置にボタンが現れると合成 click が着弾してしまう */
  let shownAt = $state(0);

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
    shownAt = Date.now();
    screen = 'result';
  }

  function again() {
    if (Date.now() - shownAt < 350) return;
    start();
  }

  $effect(() => {
    if (screen !== 'title' || !ready[1] || !ready[2]) return;
    const t = setTimeout(start, 550);
    return () => clearTimeout(t);
  });
</script>

<main class="board">
  {#if screen === 'playing'}
    {#key round}
      <Game onfinish={finish} />
    {/key}
  {:else if screen === 'title'}
    <TitleScreen gameName={game.name} {ready} onpaddown={padDown} onpadup={padUp} />
  {:else}
    <ResultScreen {winner} onagain={again} />
  {/if}
</main>
