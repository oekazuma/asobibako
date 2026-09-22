<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  let {
    cleared,
    complete,
    level,
    onagain
  }: { cleared: boolean; complete: boolean; level: number; onagain: () => void } = $props();

  const COLORS = ['#ffc233', '#1f9bff', '#ff4d5e', '#58c46b', '#b27bff'];
  /** 紙吹雪の位置・色・速さは毎回ばらつかせる */
  const confetti = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 1.2,
    duration: 2.2 + Math.random() * 1.6,
    color: COLORS[i % COLORS.length],
    tilt: Math.random() * 360
  }));
</script>

<div class="result" class:won={cleared}>
  {#if cleared}
    <div class="rays" aria-hidden="true"></div>
    {#each confetti as c (c.id)}
      <span
        class="confetti"
        aria-hidden="true"
        style:left="{c.left}%"
        style:background={c.color}
        style:animation-delay="{c.delay}s"
        style:animation-duration="{c.duration}s"
        style:rotate="{c.tilt}deg"
      ></span>
    {/each}
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

  .confetti {
    position: absolute;
    top: -20px;
    width: 12px;
    height: 18px;
    border-radius: 3px;
    animation: fall linear infinite;
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

  @keyframes fall {
    to {
      translate: 0 110dvh;
      rotate: 720deg;
    }
  }

  @keyframes pop {
    from {
      scale: 0.3;
      opacity: 0;
    }
  }

  @keyframes bob {
    50% {
      scale: 1.05;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .rays,
    .confetti,
    .star,
    .face,
    .outcome,
    .go {
      animation: none;
    }
  }
</style>
