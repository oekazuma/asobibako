<script lang="ts">
  import { onMount } from 'svelte';
  import type { SoloProps } from '$lib/games';
  import { Settle } from '$lib/settle.svelte';
  import type { AnimalId } from './animals';
  import CharSelect from './CharSelect.svelte';
  import Play from './Play.svelte';
  import Result from './Result.svelte';
  import { summary, type RunSummary, type World } from './world';
  import './retro.css';

  // 15 分の 1 回が面ひとつなので、シェルの level と onfinish は使わない（リザルトはこのゲームが持つ）
  const _props: SoloProps = $props();

  let screen = $state<'select' | 'play' | 'result'>('select');
  let animal = $state<AnimalId>('dog');
  let run = $state<RunSummary | null>(null);
  let round = $state(0);
  // 倒れたときは移動の指が残っていることが多い。離した指の合成 click でリザルトのボタンが押されないようにする
  const settle = new Settle();

  function start(id: AnimalId) {
    animal = id;
    round += 1;
    screen = 'play';
  }

  function end(w: World) {
    run = summary(w);
    screen = 'result';
    settle.begin();
  }

  onMount(() => settle.listen());
</script>

{#if screen === 'select'}
  <CharSelect onpick={start} />
{:else if screen === 'play'}
  {#key round}
    <Play {animal} onend={end} />
  {/key}
{:else if run}
  <Result {run} locked={settle.active} onagain={() => start(animal)} onselect={() => (screen = 'select')} />
{/if}
