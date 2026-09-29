<script lang="ts">
  import type { Snippet } from 'svelte';
  import { DIFFICULTIES, type Difficulty, type Level, type Result } from './dance';
  import Jacket from './Jacket.svelte';

  let {
    result,
    level,
    difficulty,
    fresh,
    children
  }: {
    result: Result;
    level: Level;
    difficulty: Difficulty;
    /** ハイスコアを更新した */
    fresh: boolean;
    children: Snippet;
  } = $props();

  const WORD = { S: 'さいこう！', A: 'すてき！', B: 'いいかんじ', C: 'また おどろう' };
  const ROWS: [string, keyof Result][] = [
    ['すごい', 'great'],
    ['いいね', 'good'],
    ['おしい', 'near'],
    ['ミス', 'miss'],
    ['さいだい コンボ', 'maxCombo'],
    ['スペシャルアピール', 'appeals']
  ];
</script>

<div class="head">
  <span class="jacket"><Jacket {level} /></span>
  <span class="rank r{result.rank}">{result.rank}</span>
</div>
<p class="song">{level.name}（{DIFFICULTIES[difficulty]}）</p>
<h2 class="yuru word">{WORD[result.rank]}</h2>
<p class="score">
  {result.score.toLocaleString()} てん
  {#if fresh}<span class="fresh">ハイスコア！</span>{/if}
</p>
<dl>
  {#each ROWS as [name, key] (key)}
    <dt>{name}</dt>
    <dd>{result[key]}</dd>
  {/each}
</dl>
<div class="actions">
  {@render children()}
</div>

<style>
  .head {
    position: relative;
    width: min(46cqw, 220px);
    margin: 0 auto 8px;
  }

  .rank {
    position: absolute;
    right: -30%;
    bottom: -12%;
    color: var(--p2);
    font-size: min(28cqw, 150px);
    font-weight: 900;
    font-style: italic;
    line-height: 1;
    -webkit-text-stroke: 8px #fff;
    paint-order: stroke;
    animation: stamp 500ms 200ms var(--spring) both;
  }

  .rank.rS {
    color: var(--gold);
  }

  .rank.rC {
    color: var(--ink-soft);
  }

  .song {
    margin: 12px 0 0;
    font-weight: 800;
  }

  .word {
    margin: 4px 0;
    font-size: clamp(28px, min(5cqh, 8cqw), 44px);
  }

  .score {
    margin: 0 0 12px;
    font-size: 26px;
    font-weight: 900;
  }

  .fresh {
    display: inline-block;
    margin-left: 8px;
    padding: 2px 12px;
    border-radius: 999px;
    background: var(--gold);
    color: #fff;
    font-size: 16px;
    rotate: -6deg;
    animation: stamp 400ms 600ms var(--spring) both;
  }

  dl {
    display: grid;
    grid-template-columns: auto auto;
    gap: 4px 24px;
    justify-content: center;
    margin: 0 auto 18px;
    padding: 12px 20px;
    max-width: 360px;
    border: 3px solid var(--line);
    border-radius: 20px;
    background: #fff;
    font-weight: 800;
  }

  dt {
    text-align: left;
  }

  dd {
    margin: 0;
    text-align: right;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  @keyframes stamp {
    from {
      scale: 2.5;
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .rank,
    .fresh {
      animation: none;
    }
  }
</style>
