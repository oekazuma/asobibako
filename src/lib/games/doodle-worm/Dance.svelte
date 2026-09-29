<script lang="ts">
  import { onMount } from 'svelte';
  import { wake } from '$lib/audio.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { Settle } from '$lib/settle.svelte';
  import type { Level, Result } from './dance';
  import { LEVELS } from './dance-songs';
  import DanceStage from './DanceStage.svelte';
  import type { Stroke } from './engine';
  import type { Look } from './looks';
  import { portrait } from './paint';
  import Pick from './Pick.svelte';
  import type { Doodle } from './stock';

  let { doodles, look, onclose }: { doodles: Doodle[]; look: Look; onclose: () => void } = $props();

  const RANK_WORD = { S: 'さいこう！', A: 'すてき！', B: 'いいかんじ', C: 'また おどろう' };

  let phase = $state<'pick' | 'song' | 'play' | 'result'>('pick');
  let dancer = $state.raw<Stroke[]>([]);
  let level = $state.raw<Level>(LEVELS[0]);
  let result = $state.raw<Result | null>(null);
  /** 同じ曲をもう 1 度おどるとき、舞台を作り直すための番号 */
  let take = $state(0);
  const settle = new Settle();

  function choose(d: Doodle) {
    dancer = d.strokes;
    phase = 'song';
  }

  /** 曲を選ぶタッチの中で音を起こす。iOS は操作の中でないと鳴らせない */
  function start(l: Level) {
    wake();
    level = l;
    take += 1;
    phase = 'play';
  }

  function end(r: Result) {
    result = r;
    phase = 'result';
    settle.begin();
  }

  onMount(settle.listen);
</script>

{#if phase === 'play'}
  {#key take}
    <DanceStage {dancer} {level} {look} onend={end} />
  {/key}
  <button class="pill quit" onclick={() => (phase = 'song')}>やめる</button>
{:else}
  <div class="screen" class:settling={settle.active}>
    {#if phase === 'pick'}
      <p>ずかんの こが ステージで おどるよ。わっかが まるに かさなったら タッチ！</p>
      <Pick title="おどる こを えらんでね" {doodles} {look} onpick={choose} />
    {:else if phase === 'song'}
      <img class="dancer" src={portrait(dancer, look)} style:background={look.bg} width="160" height="160" alt="" />
      <h2 class="yuru">きょくを えらんでね</h2>
      <div class="songs">
        {#each LEVELS as l (l.id)}
          <button class="song" aria-label="{l.name}（むずかしさ {l.stars}）" onclick={() => start(l)}>
            <span>{l.name}</span>
            <span class="stars">
              {#each { length: l.stars }, i (i)}<Icon name="star" size="22px" />{/each}
            </span>
          </button>
        {/each}
      </div>
    {:else if result}
      <p class="rank">{result.rank}</p>
      <h2 class="yuru">{RANK_WORD[result.rank]}</h2>
      <dl>
        <dt>すごい</dt>
        <dd>{result.great}</dd>
        <dt>いいね</dt>
        <dd>{result.good}</dd>
        <dt>おしい</dt>
        <dd>{result.near}</dd>
        <dt>ミス</dt>
        <dd>{result.miss}</dd>
        <dt>さいだい コンボ</dt>
        <dd>{result.maxCombo}</dd>
        <dt>スペシャルアピール</dt>
        <dd>{result.appeals}</dd>
      </dl>
      <div class="actions">
        <button class="pill p2" onclick={() => start(level)}>もういちど</button>
        <button class="pill" onclick={() => (phase = 'song')}>ほかの きょく</button>
      </div>
    {/if}
    <button class="pill back" onclick={phase === 'pick' ? onclose : () => (phase = 'pick')}>もどる</button>
  </div>
{/if}

<style>
  .screen {
    position: absolute;
    inset: 0;
    z-index: 3;
    padding: 72px 16px max(24px, env(safe-area-inset-bottom));
    overflow-y: auto;
    touch-action: pan-y;
    background: var(--paper-dots), var(--paper);
    color: var(--line);
    text-align: center;
  }

  .settling {
    pointer-events: none;
  }

  h2 {
    margin: 0 0 12px;
  }

  p {
    margin: 0 auto 16px;
    max-width: 30em;
  }

  .dancer {
    width: 120px;
    height: 120px;
    border-radius: 20px;
  }

  .songs,
  .actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
  }

  .song {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    width: min(100%, 420px);
    padding: 14px 20px;
    border: 3px solid var(--line);
    border-radius: 20px;
    background: #fff;
    box-shadow: var(--soft-shadow);
    color: var(--line);
    font-size: 18px;
    font-weight: 800;
    cursor: pointer;
  }

  .stars {
    display: flex;
    color: var(--gold);
  }

  .rank {
    margin: 0;
    font-size: 96px;
    font-weight: 800;
    line-height: 1;
    color: var(--p2);
  }

  dl {
    display: grid;
    grid-template-columns: auto auto;
    gap: 4px 16px;
    justify-content: center;
    margin: 0 0 20px;
    font-weight: 800;
  }

  dt {
    text-align: left;
  }

  dd {
    margin: 0;
    text-align: right;
  }

  .quit {
    position: absolute;
    bottom: max(16px, env(safe-area-inset-bottom));
    left: 50%;
    translate: -50% 0;
  }
</style>
