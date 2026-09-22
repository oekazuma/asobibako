<script lang="ts">
  import { onMount, type Component } from 'svelte';
  import type { SoloMeta } from '$lib/games';

  /** best はたどり着いたいちばん先のレベル。◀ ▶ でそこまでの面を選び直せる */
  let {
    meta,
    Howto,
    best,
    level = $bindable(),
    onstart
  }: { meta: SoloMeta; Howto: Component; best: number; level: number; onstart: () => void } = $props();

  let timer: ReturnType<typeof setTimeout> | undefined;
  /** 長押しのリピートで動かしたあとは、指を離したときの click で余分に 1 つ動かさない */
  let repeated = false;

  function step(d: -1 | 1): boolean {
    const next = Math.min(best, Math.max(1, level + d));
    if (next === level) return false;
    level = next;
    return true;
  }

  function press(d: -1 | 1) {
    repeated = false;
    clearTimeout(timer);
    const tick = () => {
      repeated = true;
      // 端に着いたら止める（disabled になった button には pointerup が届かないことがある）
      if (step(d)) timer = setTimeout(tick, 90);
    };
    timer = setTimeout(tick, 400);
  }

  const release = () => clearTimeout(timer);

  function click(d: -1 | 1) {
    if (repeated) repeated = false;
    else step(d);
  }

  onMount(() => release);
</script>

<div class="panel">
  <div class="art" aria-hidden="true"><div class="zoom"><meta.Thumb /></div></div>
  <h1 class="title sticker">{meta.name}</h1>
  <Howto />
  <span class="picker">
    <button
      class="step"
      onpointerdown={() => press(-1)}
      onpointerup={release}
      onpointercancel={release}
      onpointerleave={release}
      onclick={() => click(-1)}
      disabled={level <= 1}
      aria-label="前のレベル">◀</button
    >
    <span class="level">レベル {level}</span>
    <button
      class="step"
      onpointerdown={() => press(1)}
      onpointerup={release}
      onpointercancel={release}
      onpointerleave={release}
      onclick={() => click(1)}
      disabled={level >= best}
      aria-label="次のレベル">▶</button
    >
  </span>
  <button class="pill p1 go" onclick={onstart}>タップで スタート</button>
</div>

<style>
  .panel {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 18px;
    padding: 24px 16px;
    background: var(--dots), linear-gradient(to bottom, #fff, var(--p1-soft));
    text-align: center;
  }

  /* ゲームの絵を大きく飾る。一覧のカードと同じ Thumb を額に入れて、ゆらゆらさせる */
  .art {
    width: min(78vw, 420px);
    height: clamp(150px, 24cqh, 240px);
    overflow: hidden;
    border: 6px solid #fff;
    border-radius: 28px;
    box-shadow:
      0 8px 0 var(--card-edge),
      0 18px 30px rgb(43 45 66 / 0.18);
    rotate: -2deg;
    animation: sway 3s ease-in-out infinite;
  }

  /* Thumb は一覧のカード（高さ 128px）に合わせて px で描いてあるので、小さく作って拡大する */
  .zoom {
    width: calc(100% / 1.7);
    height: calc(100% / 1.7);
    transform: scale(1.7);
    transform-origin: top left;
  }

  .title {
    font-size: clamp(26px, min(7cqh, 11cqw), 64px);
    white-space: nowrap;
  }

  .level {
    padding: 6px 18px;
    border-radius: 999px;
    background: var(--card);
    box-shadow: 0 3px 0 var(--card-edge);
    font-size: clamp(16px, 2.6cqh, 22px);
    font-weight: 800;
  }

  .picker {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .step {
    width: 44px;
    height: 44px;
    border: 3px solid #fff;
    border-radius: 50%;
    background: var(--p1);
    box-shadow: 0 4px 0 var(--p1-deep);
    color: #fff;
    font-size: 16px;
    cursor: pointer;
  }

  .step:disabled {
    background: #c9ccd8;
    box-shadow: 0 4px 0 #a5a8b8;
    cursor: default;
  }

  .go {
    font-size: clamp(18px, 3cqh, 26px);
    padding: 18px 40px;
    animation: bob 1.6s ease-in-out infinite;
  }

  @keyframes sway {
    50% {
      rotate: 2deg;
      translate: 0 -6px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .art,
    .go {
      animation: none;
    }
  }
</style>
