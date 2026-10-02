<script lang="ts">
  import { onMount } from 'svelte';
  import type { SoloProps } from '$lib/games';
  import { Settle } from '$lib/settle.svelte';
  import type { AnimalId } from './animals';
  import CharSelect from './CharSelect.svelte';
  import Play from './Play.svelte';
  import { loadRecords, record, saveRecords } from './records';
  import Result from './Result.svelte';
  import { summary, type RunSummary, type World } from './world';
  import './retro.css';

  // 15 分の 1 回が面ひとつなので、シェルの level と onfinish は使わない（リザルトはこのゲームが持つ）
  const _props: SoloProps = $props();

  let screen = $state<'select' | 'play' | 'result'>('select');
  let animal = $state<AnimalId>('dog');
  let run = $state<RunSummary | null>(null);
  /** 選べる動物と、この回で新しく仲間になった動物 */
  let unlocked = $state<AnimalId[]>(['dog', 'cat', 'wolf']);
  let fresh = $state<AnimalId[]>([]);
  let round = $state(0);
  // 倒れたときは移動の指が残っていることが多い。離した指の合成 click でリザルトのボタンが押されないようにする
  const settle = new Settle();

  function start(id: AnimalId) {
    animal = id;
    round += 1;
    screen = 'play';
  }

  // リザルトを待たずに記録する。決着からリザルトまでの間に ✕ で抜けたり終わらされたりしても、その回を落とさない
  function over(w: World) {
    run = summary(w);
    const r = loadRecords();
    fresh = record(r, run);
    saveRecords(r);
    unlocked = r.unlocked;
  }

  function end() {
    screen = 'result';
    settle.begin();
  }

  onMount(() => {
    unlocked = loadRecords().unlocked;
    return settle.listen();
  });
</script>

{#if screen === 'select'}
  <CharSelect {unlocked} onpick={start} />
{:else if screen === 'play'}
  {#key round}
    <Play {animal} onover={over} onend={end} />
  {/key}
{:else if run}
  <Result {run} {fresh} locked={settle.active} onagain={() => start(animal)} onselect={() => (screen = 'select')} />
{/if}
