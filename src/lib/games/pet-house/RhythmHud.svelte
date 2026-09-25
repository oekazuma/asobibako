<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import type { RhythmPlay } from './rhythm-play.svelte';
  import RhythmCard from './RhythmCard.svelte';

  /** リズムあそびの HUD。ノーツとレーンは 2D の canvas（rhythm-draw.ts）が描き、ここは文字とボタンだけ */
  let { play }: { play: RhythmPlay } = $props();
</script>

<div class="hud">
  <header class="bar"><Icon name="paw" size="20px" />「{play.trickName}」の れんしゅう</header>
  {#if play.phase === 'play'}
    {#if play.combo >= 2}
      {#key play.combo}
        <p class="combo"><b>{play.combo}</b>コンボ</p>
      {/key}
    {/if}
    {#if play.banner}
      {#key play.banner}
        <p class="big">{play.banner}</p>
      {/key}
    {/if}
    <button class="quit pill" onclick={() => play.quit()}><Icon name="cross" size="18px" />やめる</button>
  {:else}
    <RhythmCard {play} />
  {/if}
</div>

<style>
  .hud {
    position: absolute;
    inset: 0;
    z-index: 3;
    pointer-events: none;
    color: var(--line);
  }

  .bar {
    position: absolute;
    top: max(12px, env(safe-area-inset-top));
    left: 50%;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 16px 6px 10px;
    border: 3px solid var(--line);
    border-radius: 999px;
    background: var(--paper);
    box-shadow: var(--soft-shadow);
    font-size: clamp(15px, 2.6cqw, 20px);
    font-weight: 800;
    white-space: nowrap;
    translate: -50% 0;
  }

  /* レーン（盤面の高さの 74%）のすぐ上の右 */
  .combo {
    position: absolute;
    top: 50%;
    right: 5%;
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 0;
    color: #fff;
    font-size: min(3cqh, 5.5cqw);
    font-weight: 900;
    -webkit-text-stroke: 4px var(--line);
    paint-order: stroke;
    animation: pop 260ms var(--spring);
  }

  .combo b {
    color: var(--pastel-gold);
    font-size: min(9cqh, 17cqw);
    line-height: 1;
    -webkit-text-stroke: 6px var(--line);
  }

  .big {
    position: absolute;
    top: 46%;
    left: 0;
    right: 0;
    margin: 0;
    color: var(--pastel-gold);
    font-size: min(10cqh, 16cqw);
    font-weight: 900;
    text-align: center;
    -webkit-text-stroke: 6px var(--line);
    paint-order: stroke;
    translate: 0 -50%;
    animation: pop 380ms var(--spring);
  }

  .quit {
    position: absolute;
    bottom: max(18px, env(safe-area-inset-bottom));
    left: 50%;
    display: flex;
    align-items: center;
    gap: 4px;
    pointer-events: auto;
    translate: -50% 0;
  }

  @keyframes pop {
    from {
      scale: 0.5;
      opacity: 0.2;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .combo,
    .big {
      animation: none;
    }
  }
</style>
