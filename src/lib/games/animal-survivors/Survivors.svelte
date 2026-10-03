<script lang="ts">
  import { onMount } from 'svelte';
  import type { SoloProps } from '$lib/games';
  import { bus } from '$lib/audio.svelte';
  import { Loop } from '$lib/music/loop';
  import { Settle } from '$lib/settle.svelte';
  import type { AchievementDef } from './achievements';
  import type { AnimalId } from './animals';
  import CharSelect from './CharSelect.svelte';
  import Daily from './Daily.svelte';
  import { dailyBonus, type Challenge } from './daily';
  import Play from './Play.svelte';
  import { emptyRecords, ensureDaily, loadRecords, record, saveRecords } from './records';
  import Result from './Result.svelte';
  import Shop from './Shop.svelte';
  import StageSelect from './StageSelect.svelte';
  import { stageOf } from './stages';
  import { SONGS } from './songs';
  import Trophies from './Trophies.svelte';
  import Book from './Book.svelte';
  import { overtimeRun } from './overtime';
  import { summary, type RunSummary, type World } from './world';
  import './retro.css';

  // 15 分の 1 回が面ひとつなので、シェルの level と onfinish は使わない（リザルトはこのゲームが持つ）
  let { onquit }: SoloProps = $props();

  let screen = $state<'select' | 'stage' | 'shop' | 'trophies' | 'book' | 'daily' | 'play' | 'result'>('select');
  /** これから遊ぶ動物と面（お題の回はしばりも）。「もう一度」とやり直しは同じ組で始める */
  let pick = $state<{ animal: AnimalId; stage: string; challenge?: Challenge }>({ animal: 'dog', stage: 'forest' });
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

  // リザルトを待たずに記録する。決着からリザルトまでの間に ✕ で抜けたり終わらされたりしても、その回を落とさない。
  // 延長戦は 15:00 で 1 回記録してあるので、終わりには延長戦の差だけを記録し、見せるのは 2 回の合計
  function over(w: World) {
    const r = loadRecords();
    const part = w.overtime ? overtimeRun(w) : summary(w);
    const now = record(r, part);
    const first = w.overtime ? run : null;
    // お題のごほうびを入れた印（paid）は record() が渡した part に立つので、15:00 の回はそのまま見せる
    run = {
      ...(first ? summary(w) : part),
      bookCoins: (first?.bookCoins ?? 0) + (part.bookCoins ?? 0),
      daily: first?.daily ?? part.daily
    };
    if (run.overtime) run.overtime.best = r.overtime[run.stage];
    got = first ? [...got, ...now] : now;
    saveRecords(r);
    records = r;
  }

  function choose(animal: AnimalId) {
    pick = { animal, stage: records.stage };
    screen = 'stage';
  }

  // 机に置いたまま日付をまたぐことがあるので、お題を見せる前と始める前に今日のお題か確かめる
  function openDaily() {
    reload();
    screen = 'daily';
  }

  function daily() {
    const shown = records.daily?.date;
    reload();
    const d = records.daily!;
    // 画面に出ていたのが前の日のお題なら、始めずに今日のお題を見せる
    if (d.date !== shown) return;
    pick = { animal: d.animal, stage: d.stage, challenge: { date: d.date, bonus: dailyBonus(d), mods: d.mods } };
    start(d.stage);
  }

  /** 日付が変わっていたら今日のお題を作り直して残す */
  function reload() {
    const r = loadRecords();
    ensureDaily(r, new Date());
    saveRecords(r);
    records = r;
  }

  function end() {
    screen = 'result';
    settle.begin();
  }

  /** 店で買ったあとは記録が変わっているので読み直す */
  function back() {
    reload();
    screen = 'select';
  }

  onMount(() => {
    reload();
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
    onopen={(s) => (s === 'daily' ? openDaily() : (screen = s))}
  />
{:else if screen === 'daily' && records.daily}
  <Daily daily={records.daily} onstart={daily} onback={() => (screen = 'select')} />
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
  <Result {run} {got} total={records.coins} locked={settle.active} onagain={() => start(pick.stage)} onselect={back} />
{/if}
