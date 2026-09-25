<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { kindOf, trickSteps, TRICKS } from './engine';
  import { MOTION, type Motion, type Rank } from './rhythm';
  import { drawNote } from './rhythm-draw';
  import type { RhythmPlay } from './rhythm-play.svelte';

  /** リズムあそびの、はじめる前の遊び方と、1 曲おわったあとの成績 */
  let { play }: { play: RhythmPlay } = $props();

  const HOW: Record<Motion, string> = {
    tap: 'タップ',
    down: 'したへ シュッ',
    up: 'うえへ シュッ',
    side: 'よこへ シュッ',
    circle: 'ぐるっと まわす',
    hold: 'ながおし'
  };
  const PRAISE: Record<Rank, string> = {
    S: 'パーフェクト！',
    A: 'じょうず！',
    B: 'いいかんじ！',
    C: 'がんばったね！'
  };
  const RANK_COLOR: Record<Rank, string> = { S: '#ffc233', A: '#ff7eb3', B: '#8ec9ff', C: '#b9e6a0' };

  const motion = $derived(MOTION[play.lesson]);
  const steps = $derived.by(() => {
    const t = TRICKS.find((k) => k.id === play.lesson);
    return t ? trickSteps(t, kindOf(play.pet.breed)) : 1;
  });
  const done = $derived(Math.min(steps, play.pet.tricks[play.lesson] ?? 0));
  const r = $derived(play.result);

  /** 見本のノーツ。レーンと同じ絵を小さな canvas に描く */
  function sample(canvas: HTMLCanvasElement, [m, trick]: [Motion, boolean]) {
    const dpr = devicePixelRatio || 1;
    canvas.width = canvas.height = 56 * dpr;
    const ctx = canvas.getContext('2d');
    ctx?.scale(dpr, dpr);
    if (ctx) drawNote(ctx, m, trick, 28, 26, 22, 1);
  }
</script>

<section class="card" aria-label={r ? 'けっか' : 'あそびかた'}>
  {#if !r}
    <h2 class="yuru">「{play.trickName}」を おしえよう</h2>
    <p>おんがくに あわせて、ノーツが わに かさなったら ゆびで あいずしてね</p>
    <ul class="how">
      <li><canvas use:sample={['tap', false]}></canvas>{HOW.tap}</li>
      <li><canvas use:sample={[motion, true]}></canvas>{motion === 'tap' ? 'ハートも タップ' : HOW[motion]}</li>
    </ul>
    <p class="note">つなげて たたくと、{play.pet.name}が 「{play.trickName}」を するよ</p>
  {:else}
    <p class="rank" style:--c={RANK_COLOR[r.rank]}>{r.rank}</p>
    <h2 class="yuru">{PRAISE[r.rank]}</h2>
    <ul class="counts">
      <li class="great">すごい<b>{r.great}</b></li>
      <li class="good">いいね<b>{r.good}</b></li>
      <li class="near">おしい<b>{r.near}</b></li>
    </ul>
    <p>さいだい コンボ <b>{r.maxCombo}</b>、スコア <b>{r.score}</b></p>
    <p class="note">{play.record ? 'ハイスコア こうしん！' : `ハイスコア ${play.best}`}</p>
  {/if}
  <p class="steps">
    <span class="sr-only">おぼえた ぐあい {done} / {steps}</span>
    {#each { length: steps }, i (i)}
      <span class:dim={i >= done}><Icon name="star" /></span>
    {/each}
    {#if r && play.gained > 0}<b class="great">+{play.gained}</b>{/if}
  </p>
  <div class="row">
    <button class="pill" onclick={() => play.quit()}>おわる</button>
    <button class="pill gold" onclick={() => play.begin()}>{r ? 'もういちど' : 'はじめる'}</button>
  </div>
</section>

<style>
  .card {
    position: absolute;
    top: 68%;
    left: 50%;
    width: min(90%, 460px);
    padding: 16px 18px;
    border: 3px solid var(--line);
    border-radius: 28px;
    background: var(--paper-dots), var(--paper);
    box-shadow: var(--soft-shadow);
    font-weight: 800;
    text-align: center;
    pointer-events: auto;
    translate: -50% -50%;
    animation: rise 420ms var(--spring);
  }

  h2 {
    --fill: var(--pastel-gold);
    margin: 0 0 8px;
    font-size: clamp(22px, min(3.4cqh, 6.4cqw), 32px);
  }

  p {
    margin: 6px 0;
  }

  .note {
    font-size: 0.9em;
    opacity: 0.8;
  }

  .how,
  .counts {
    display: flex;
    justify-content: center;
    gap: 12px;
    margin: 8px 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 4.5em;
    padding: 4px 10px;
    border: 2px solid var(--line);
    border-radius: 16px;
    background: #fff;
  }

  .how li {
    min-width: 7em;
  }

  canvas {
    width: 56px;
    height: 56px;
  }

  .rank {
    margin: -6px 0 0;
    color: var(--c);
    font-size: clamp(56px, min(9cqh, 18cqw), 96px);
    font-weight: 900;
    line-height: 1;
    -webkit-text-stroke: 5px var(--line);
    paint-order: stroke;
  }

  .counts b {
    font-size: 1.5em;
  }

  .great {
    color: #e56a00;
  }

  .good {
    color: #1f86e0;
  }

  .steps {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 3px;
    font-size: 20px;
  }

  .dim {
    opacity: 0.25;
    filter: grayscale(1);
  }

  .row {
    display: flex;
    justify-content: center;
    gap: 12px;
    margin-top: 10px;
  }

  @keyframes rise {
    from {
      scale: 0.7;
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .card {
      animation: none;
    }
  }
</style>
