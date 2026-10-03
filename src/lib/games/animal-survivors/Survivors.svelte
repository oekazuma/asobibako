<script lang="ts">
  import { onMount } from 'svelte';
  import type { SoloProps } from '$lib/games';
  import { bus } from '$lib/audio.svelte';
  import { Loop } from '$lib/music/loop';
  import { Settle } from '$lib/settle.svelte';
  import type { AchievementDef } from './achievements';
  import type { AnimalId } from './animals';
  import CharSelect from './CharSelect.svelte';
  import Play from './Play.svelte';
  import { emptyRecords, loadRecords, record, saveRecords } from './records';
  import Result from './Result.svelte';
  import Shop from './Shop.svelte';
  import StageSelect from './StageSelect.svelte';
  import { stageOf } from './stages';
  import { SONGS } from './songs';
  import Trophies from './Trophies.svelte';
  import Book from './Book.svelte';
  import { summary, type RunSummary, type World } from './world';
  import './retro.css';

  // 15 分の 1 回が面ひとつなので、シェルの level と onfinish は使わない（リザルトはこのゲームが持つ）
  let { onquit }: SoloProps = $props();

  let screen = $state<'select' | 'stage' | 'shop' | 'trophies' | 'book' | 'play' | 'result'>('select');
  /** これから遊ぶ動物と面。「もう一度」とやり直しは同じ組で始める */
  let pick = $state<{ animal: AnimalId; stage: string }>({ animal: 'dog', stage: 'forest' });
  let run = $state<RunSummary | null>(null);
  let records = $state(emptyRecords());
  /** この回に達成した実績 */
  let got = $state<AchievementDef[]>([]);
  let round = $state(0);
  // 倒れたときは移動の指が残っていることが多い。離した指の合成 click でリザルトのボタンが押されないようにする
  const settle = new Settle();
  const loop = new Loop(bus);
  /** 遊んでいる最中の曲。ボス戦か、一時停止で小さくするか */
  let field = $state<{ song: 'field' | 'boss'; quiet: boolean }>({ song: 'field', quiet: false });

  $effect(() => {
    const t = SONGS[screen !== 'play' ? 'menu' : field.song === 'boss' ? 'boss' : stageOf(pick.stage).song];
    loop.play(t.song, t.bpm, screen === 'play' && field.quiet ? t.gain * 0.4 : t.gain);
  });

  function start(stage: string) {
    pick = { ...pick, stage };
    field = { song: 'field', quiet: false };
    round += 1;
    screen = 'play';
  }

  // リザルトを待たずに記録する。決着からリザルトまでの間に ✕ で抜けたり終わらされたりしても、その回を落とさない
  function over(w: World) {
    run = summary(w);
    const r = loadRecords();
    got = record(r, run);
    saveRecords(r);
    records = r;
  }

  function choose(animal: AnimalId) {
    pick = { animal, stage: records.stage };
    screen = 'stage';
  }

  function end() {
    screen = 'result';
    settle.begin();
  }

  /** 店で買ったあとは記録が変わっているので読み直す */
  function back() {
    records = loadRecords();
    screen = 'select';
  }

  onMount(() => {
    records = loadRecords();
    // ボス戦の曲は WARNING で急に替わるので、出だしの音の計算で詰まらないよう先に作っておく
    loop.warm(SONGS.boss.song);
    // 曲は AudioContext の時計で 0.5 秒先まで予約するので、画面の描画とは別に 0.1 秒ごとに足せば足りる
    const id = setInterval(() => loop.tick(), 100);
    const unlisten = settle.listen();
    return () => {
      clearInterval(id);
      loop.stop();
      unlisten();
    };
  });
</script>

{#if screen === 'select'}
  <CharSelect
    {records}
    onpick={choose}
    onquit={() => onquit?.()}
    onshop={() => (screen = 'shop')}
    ontrophies={() => (screen = 'trophies')}
    onbook={() => (screen = 'book')}
  />
{:else if screen === 'stage'}
  <StageSelect {records} onpick={start} onback={() => (screen = 'select')} />
{:else if screen === 'shop'}
  <Shop onback={back} />
{:else if screen === 'book'}
  <Book {records} onback={back} />
{:else if screen === 'trophies'}
  <Trophies onback={back} />
{:else if screen === 'play'}
  {#key round}
    <Play
      choice={pick}
      ranks={records.ranks}
      onover={over}
      onend={end}
      onrestart={() => start(pick.stage)}
      onmusic={(m) => (field = m)}
    />
  {/key}
{:else if run}
  <Result
    {run}
    {got}
    total={records.coins}
    locked={settle.active}
    onagain={() => start(pick.stage)}
    onselect={() => (screen = 'select')}
  />
{/if}
