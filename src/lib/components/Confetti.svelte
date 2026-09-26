<script lang="ts">
  import { CONFETTI } from '$lib/fx';

  /** 落ちる距離。半分の画面では枠の外へ出れば十分なので、使う側が指定する */
  let { count = 36, fall = '110cqh' }: { count?: number; fall?: string } = $props();

  /** 紙吹雪の位置・色・速さは毎回ばらつかせる。count は初期値だけ使い、以後変わっても降らし直さない */
  // svelte-ignore state_referenced_locally
  const pieces = Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 1.2,
    duration: 2.2 + Math.random() * 1.6,
    color: CONFETTI[i % CONFETTI.length],
    tilt: Math.random() * 360
  }));
</script>

{#each pieces as c (c.id)}
  <span
    class="confetti"
    aria-hidden="true"
    style:--fall={fall}
    style:left="{c.left}%"
    style:background={c.color}
    style:animation-delay="{c.delay}s"
    style:animation-duration="{c.duration}s"
    style:rotate="{c.tilt}deg"
  ></span>
{/each}

<style>
  .confetti {
    position: absolute;
    top: -20px;
    width: 12px;
    height: 18px;
    border-radius: 3px;
    animation: fall linear infinite;
  }

  @keyframes fall {
    to {
      translate: 0 var(--fall);
      rotate: 720deg;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .confetti {
      animation: none;
    }
  }
</style>
