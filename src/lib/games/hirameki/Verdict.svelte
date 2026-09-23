<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import Detective from './Detective.svelte';
  import { sounds } from './sounds';

  /**
   * 答えを出してからの演出。考え中の間をおいてから結果を見せる。
   * detail は、正解なら解き方、失敗ならそのわけ。quick は操作の途中で決まるなぞ（考え中を短く）。
   * 失敗は結果を少し見せてから ondone を呼ぶ
   */
  let {
    ok,
    detail = '',
    quick = false,
    onnext,
    ondone
  }: { ok: boolean; detail?: string; quick?: boolean; onnext: () => void; ondone: () => void } = $props();

  let thinking = $state(true);
  let dots = $state(1);
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
  // ↻ や ✕ で抜けたら、残りの刻みの音と結果を出さない
  onDestroy(() => timers.forEach(clearTimeout));

  onMount(() => {
    const think = quick ? 800 : 1600;
    // だんだん速くなる刻み
    for (let k = 0, at = 0; at < think - 60; at += Math.max(55, 200 - k * 16), k++) {
      const n = k;
      later(at, () => sounds.tick(n));
    }
    later(think / 3, () => (dots = 2));
    later((think * 2) / 3, () => (dots = 3));
    later(think, () => {
      thinking = false;
      if (ok) return sounds.solved();
      sounds.miss();
      // わけを読めるよう、わけがあるときは長めに見せる
      later(detail ? 2800 : 1200, ondone);
    });
  });
</script>

<div class="verdict" class:thinking>
  <div class="stage-v">
    <Detective mood={thinking ? 'think' : ok ? 'happy' : 'sad'} {dots} />
    {#if !thinking}
      <span class="stamp" class:ok role="status">{ok ? 'ナゾ解明！' : '残念…'}</span>
    {/if}
  </div>
  {#if !thinking && (detail || ok)}
    <div class="card">
      {#if detail}<p>{detail}</p>{/if}
      {#if ok}<button class="pill gold next" onclick={onnext}>次へ</button>{/if}
    </div>
  {/if}
</div>

<style>
  .verdict {
    position: absolute;
    inset: 0;
    z-index: 4;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 72px 16px 16px;
    background: rgb(255 250 242 / 0.8);
    transition: background-color 300ms;
  }

  .thinking {
    background: rgb(43 45 66 / 0.45);
  }

  .stage-v {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  /* 探偵のケープに少しかかる位置に押す */
  .stamp {
    position: relative;
    margin-top: -0.15em;
    padding: 0.08em 0.4em;
    border: 0.08em solid currentColor;
    border-radius: 0.25em;
    background: rgb(255 255 255 / 0.85);
    color: #6f7fa0;
    font-size: clamp(36px, min(7cqh, 12cqw), 80px);
    font-weight: 900;
    letter-spacing: 0.06em;
    white-space: nowrap;
    rotate: -6deg;
    animation: slump 700ms ease-out;
  }

  .stamp.ok {
    color: #e8455a;
    rotate: -12deg;
    animation: slam 520ms cubic-bezier(0.2, 0.9, 0.3, 1.3);
  }

  @keyframes slam {
    from {
      scale: 2.6;
      rotate: -32deg;
      opacity: 0;
    }
    60% {
      scale: 0.92;
      opacity: 1;
    }
  }

  @keyframes slump {
    from {
      scale: 1.2;
      rotate: 4deg;
      opacity: 0;
    }
  }

  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    max-width: 640px;
    padding: 16px 22px 20px;
    border: 3px solid var(--line);
    border-radius: 24px;
    background: var(--paper-dots), var(--paper);
    box-shadow: var(--soft-shadow);
    color: var(--line);
    animation: show 400ms ease-out 450ms backwards;
  }

  @keyframes show {
    from {
      translate: 0 20px;
      opacity: 0;
    }
  }

  p {
    margin: 0;
    font-size: clamp(14px, min(2.1cqh, 3.8cqw), 21px);
    font-weight: 700;
    line-height: 1.6;
  }

  .next {
    font-size: clamp(18px, 3cqh, 26px);
    animation: bob 1.4s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .verdict {
      transition: none;
    }

    .stamp,
    .card,
    .next {
      animation: none;
    }
  }
</style>
