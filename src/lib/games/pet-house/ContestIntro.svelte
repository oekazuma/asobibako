<script lang="ts">
  import type { ContestPlay } from './contest-play.svelte';

  let { play }: { play: ContestPlay } = $props();
</script>

<section class="card" aria-label="せつめい">
  <h2 class="yuru">{play.contest.name} たいかい</h2>
  <p>{play.contest.how}</p>
  <p class="sub">{play.petName}と いっしょに 1いを めざそう！</p>
  <div class="buttons">
    <button class="pill" onclick={() => play.quit()}>やめる</button>
    <button class="pill gold" onclick={() => play.begin()}>はじめる</button>
  </div>
</section>

<style>
  .card {
    position: absolute;
    top: 50%;
    left: 50%;
    width: min(88%, 460px);
    padding: 20px 22px;
    border: 3px solid var(--line);
    border-radius: 28px;
    background: var(--paper-dots), var(--paper);
    box-shadow: var(--soft-shadow);
    text-align: center;
    font-weight: 700;
    line-height: 1.6;
    pointer-events: auto;
    translate: -50% -50%;
    animation: pop 380ms var(--spring);
  }

  h2 {
    --fill: var(--pastel-gold);
    margin: 0 0 8px;
    font-size: clamp(24px, min(3.6cqh, 7cqw), 34px);
  }

  .sub {
    color: #8a6d5d;
  }

  .buttons {
    display: flex;
    justify-content: center;
    gap: 12px;
    margin-top: 12px;
  }

  @keyframes pop {
    from {
      scale: 0.4;
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .card {
      animation: none;
    }
  }
</style>
