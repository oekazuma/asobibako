<script lang="ts">
  import { onMount } from 'svelte';
  import type { SoloProps } from '$lib/games';
  import { bus } from '$lib/audio.svelte';
  import { Loop } from '$lib/music/loop';
  import { Settle } from '$lib/settle.svelte';
  import type { AchievementDef } from './achievements';
  import type { AnimalId } from './animals';
  import { openArcana } from './arcana';
  import Cauldron from './Cauldron.svelte';
  import { heatLabel, snap } from './cauldron';
  import CharSelect from './CharSelect.svelte';
  import Daily from './Daily.svelte';
  import { dailyPick } from './daily';
  import Play from './Play.svelte';
  import { emptyRecords, ensureDaily, loadRecords, payHeat, record, saveRecords } from './records';
  import Result from './Result.svelte';
  import Shop from './Shop.svelte';
  import StageSelect from './StageSelect.svelte';
  import { stageOf } from './stages';
  import { SONGS } from './songs';
  import Trophies from './Trophies.svelte';
  import Book from './Book.svelte';
  import Gear from './Gear.svelte';
  import GachaRoom from './GachaRoom.svelte';
  import { wornKeys } from './gacha';
  import { overtimeRun } from './overtime';
  import { summary, type Options, type RunSummary, type World } from './world';
  import './retro.css';

  // 10 分の 1 回が面ひとつなので、シェルの level と onfinish は使わない（リザルトはこのゲームが持つ）
  let { onquit }: SoloProps = $props();

  type Screen =
    'select' | 'stage' | 'cauldron' | 'shop' | 'trophies' | 'book' | 'gear' | 'gacha' | 'daily' | 'play' | 'result';
  let screen = $state<Screen>('select');
  /** 記録を自分で読み直す画面 */
  const ROOMS = { shop: Shop, gear: Gear, gacha: GachaRoom, trophies: Trophies };
  /** これから遊ぶ動物と面（お題の回はしばりも）。「もう一度」とやり直しは同じ組で始める。
   * want は釜で選んだ強さ（払えずに heat を下げても、もう一度は want で払おうとする） */
  let pick = $state<Options & { animal: AnimalId; stage: string; want?: number }>({ animal: 'dog', stage: 'forest' });
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
    pick = { ...pick, stage, gear: wornKeys(records) };
    field = { song: 'field', quiet: false };
    round += 1;
    screen = 'play';
  }

  /** 釜で選んだ強さで賭けを引いて始める。足りなければ payHeat が払える強さまで下げる */
  function begin(h: number) {
    const r = loadRecords();
    const heat = payHeat(r, h);
    const note = heat.level < snap(h) ? `コインが足りないので 釜 ${heatLabel(heat.level)} で始めます` : undefined;
    pick = { ...pick, heat, want: snap(h), note, arcana: openArcana(r.achieved) };
    saveRecords(r);
    records = r;
    start(pick.stage);
  }

  /** お題の回は釜の画面を通らず、今日の釜と札のまま同じ組で始める */
  const again = () => (pick.challenge ? start(pick.stage) : begin(pick.want ?? 2));

  // リザルトを待たずに記録する。決着からリザルトまでの間に ✕ で抜けたり終わらされたりしても、その回を落とさない。
  // 延長戦はクリアで 1 回記録してあるので、終わりには延長戦の差だけを記録し、見せるのは 2 回の合計
  function over(w: World) {
    const r = loadRecords();
    const part = w.overtime ? overtimeRun(w) : summary(w);
    const now = record(r, part);
    const first = w.overtime ? run : null;
    // お題のごほうびを入れた印（paid）は record() が渡した part に立つので、クリアの回はそのまま見せる
    run = {
      ...(first ? summary(w) : part),
      bookCoins: (first?.bookCoins ?? 0) + (part.bookCoins ?? 0),
      daily: first?.daily ?? part.daily,
      tickets: (first?.tickets ?? [0, 0, 0]).map((n, i) => n + (part.tickets?.[i] ?? 0)),
      lost: part.lost
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
    pick = dailyPick(d, openArcana(records.achieved));
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
  <StageSelect
    {records}
    onpick={(id) => {
      pick = { ...pick, stage: id };
      screen = 'cauldron';
    }}
    onback={() => (screen = 'select')}
  />
{:else if screen === 'cauldron'}
  <Cauldron
    coins={records.coins}
    start={records.heatLast}
    stage={pick.stage}
    onstart={begin}
    onback={() => (screen = 'stage')}
  />
{:else if screen in ROOMS}
  {@const Room = ROOMS[screen as keyof typeof ROOMS]}
  <Room onback={back} />
{:else if screen === 'book'}
  <Book {records} onback={back} />
{:else if screen === 'play'}
  {#key round}
    <Play {pick} ranks={records.ranks} onover={over} onend={end} onrestart={again} onmusic={(m) => (field = m)} />
  {/key}
{:else if run}
  <Result {run} {got} total={records.coins} locked={settle.active} onagain={again} onselect={back} />
{/if}
