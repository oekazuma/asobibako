<script lang="ts">
  import { onMount } from 'svelte';
  import { wake } from '$lib/audio.svelte';
  import { Settle } from '$lib/settle.svelte';
  import type { Difficulty, Result } from './dance';
  import { bestKey, loadBest, saveBest } from './dance-best';
  import { LEVELS } from './dance-songs';
  import DanceResult from './DanceResult.svelte';
  import DanceStage from './DanceStage.svelte';
  import type { Stroke } from './engine';
  import type { Look } from './looks';
  import PickFighter from './PickFighter.svelte';
  import SongSelect from './SongSelect.svelte';
  import type { Doodle } from './stock';

  let { doodles, look, onclose }: { doodles: Doodle[]; look: Look; onclose: () => void } = $props();

  let phase = $state<'pick' | 'song' | 'play' | 'result'>('pick');
  let dancer = $state.raw<Stroke[]>([]);
  let song = $state(0);
  let difficulty = $state<Difficulty>(0);
  let result = $state.raw<Result | null>(null);
  let fresh = $state(false);
  let best = $state.raw(loadBest());
  /** 同じ曲をもう 1 度おどるとき、舞台を作り直すための番号 */
  let take = $state(0);
  const settle = new Settle();

  function choose(d: Doodle) {
    dancer = d.strokes;
    phase = 'song';
  }

  /** スタートのタッチの中で音を起こす。iOS は操作の中でないと鳴らせない */
  function start(s: number, d: Difficulty) {
    wake();
    [song, difficulty] = [s, d];
    take += 1;
    phase = 'play';
  }

  function end(r: Result) {
    ({ best, fresh } = saveBest(best, bestKey(LEVELS[song].id, difficulty), r));
    result = r;
    phase = 'result';
    settle.begin();
  }

  onMount(settle.listen);
</script>

{#if phase === 'play'}
  {#key take}
    <DanceStage {dancer} level={LEVELS[song]} {difficulty} {look} onend={end} />
  {/key}
  <button class="pill quit" onclick={() => (phase = 'song')}>やめる</button>
{:else}
  <div class="screen" class:settling={settle.active}>
    {#if phase === 'pick'}
      <PickFighter title="おどる こを えらんでね" {doodles} {look} battle={false} onpick={choose} />
    {:else if phase === 'song'}
      <SongSelect {best} {song} {difficulty} onstart={start} />
    {:else if result}
      <DanceResult {result} level={LEVELS[song]} {difficulty} {fresh}>
        <button class="pill p2" onclick={() => start(song, difficulty)}>もういちど</button>
        <button class="pill" onclick={() => (phase = 'song')}>きょくを えらぶ</button>
      </DanceResult>
    {/if}
    <button class="pill back" onclick={phase === 'pick' ? onclose : () => (phase = phase === 'song' ? 'pick' : 'song')}>
      {phase === 'song' ? 'おどる こを かえる' : 'もどる'}
    </button>
  </div>
{/if}

<style>
  .screen {
    position: absolute;
    inset: 0;
    z-index: 3;
    padding: 64px 16px max(24px, env(safe-area-inset-bottom));
    overflow-y: auto;
    touch-action: pan-y;
    background: var(--paper-dots), var(--paper);
    color: var(--line);
    text-align: center;
  }

  .settling {
    pointer-events: none;
  }

  .back {
    margin-top: 8px;
  }

  .quit {
    position: absolute;
    bottom: max(16px, env(safe-area-inset-bottom));
    left: 50%;
    translate: -50% 0;
  }
</style>
