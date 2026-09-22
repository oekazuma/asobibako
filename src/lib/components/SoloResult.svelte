<script lang="ts">
  import Confetti from '$lib/components/Confetti.svelte';
  import Icon from '$lib/components/Icon.svelte';
  let {
    cleared,
    complete,
    level,
    onagain
  }: { cleared: boolean; complete: boolean; level: number; onagain: () => void } = $props();
</script>

<div class="result" class:won={cleared}>
  {#if cleared}
    <div class="rays" aria-hidden="true"></div>
    <Confetti />
    <div class="stars" aria-hidden="true">
      <span class="star"><Icon name="star" /></span>
      <span class="star big"><Icon name="star" /></span>
      <span class="star"><Icon name="star" /></span>
    </div>
  {:else}
    <span class="face" aria-hidden="true"><Icon name="sad" /></span>
  {/if}
  <span class="outcome sticker" class:long={complete} role="status"
    >{complete ? 'ぜんぶクリア！' : cleared ? 'クリア！' : 'ざんねん…'}</span
  >
  <span class="level">
    {complete ? `レベル ${level} まで ぜんぶ クリア！` : cleared ? `つぎは レベル ${level}` : `レベル ${level}`}
  </span>
  <button class="pill gold go again" onclick={onagain}>{cleared && !complete ? 'つぎへ' : 'もういちど'}</button>
</div>

<style>
  .result {
    position: relative;
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 18px;
    overflow: hidden;
    background: var(--dots), linear-gradient(to bottom, #eef0f8, #d9dcec);
  }

  .won {
    background: radial-gradient(circle, #fff6cf, var(--gold) 75%);
  }

  /* 放射状の光をゆっくり回す */
  .rays {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 180vmax;
    aspect-ratio: 1;
    background: repeating-conic-gradient(from 0deg, rgb(255 255 255 / 0.4) 0deg 10deg, transparent 10deg 20deg);
    translate: -50% -50%;
    animation: spin 24s linear infinite;
  }

  .stars {
    position: relative;
    display: flex;
    align-items: flex-end;
    gap: 6px;
  }

  .star {
    font-size: clamp(44px, 8cqh, 72px);
    filter: drop-shadow(0 4px 0 rgb(43 45 66 / 0.2));
    animation: pop 500ms var(--spring) both;
  }

  .star:nth-child(2) {
    animation-delay: 200ms;
  }

  .star:nth-child(3) {
    animation-delay: 400ms;
  }

  .star.big {
    font-size: clamp(60px, 11cqh, 100px);
  }

  .face {
    font-size: clamp(60px, 11cqh, 100px);
    animation: pop 500ms var(--spring) both;
  }

  .outcome {
    position: relative;
    font-size: clamp(40px, min(12cqh, 16cqw), 120px);
    white-space: nowrap;
    color: var(--gold-deep);
    animation: pop 520ms var(--spring) both;
  }

  /* 「ぜんぶクリア！」は字数が多いので、幅に合わせて小さめにする */
  .outcome.long {
    font-size: clamp(32px, min(10cqh, 12cqw), 100px);
  }

  .result:not(.won) .outcome {
    color: var(--ink-soft);
  }

  .level {
    position: relative;
    padding: 6px 18px;
    border-radius: 999px;
    background: var(--card);
    box-shadow: 0 3px 0 var(--card-edge);
    font-size: clamp(16px, 2.6cqh, 22px);
    font-weight: 800;
  }

  .go {
    position: relative;
    padding: 18px 40px;
    font-size: clamp(18px, 3cqh, 26px);
    animation: bob 1.6s ease-in-out infinite;
  }

  @keyframes spin {
    to {
      rotate: 360deg;
    }
  }

  @keyframes pop {
    from {
      scale: 0.3;
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .rays,
    .star,
    .face,
    .outcome,
    .go {
      animation: none;
    }
  }
</style>
