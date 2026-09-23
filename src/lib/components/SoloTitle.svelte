<script lang="ts">
  import { onMount, type Component } from 'svelte';
  import { asset } from '$app/paths';
  import type { SoloMeta } from '$lib/games';

  /** best はたどり着いたいちばん先のレベル（1..levels + 1）。◀ ▶ か一覧でそこまでの面を選び直せる */
  let {
    meta,
    Howto,
    best,
    level = $bindable(),
    onlevels,
    onstart
  }: {
    meta: SoloMeta;
    Howto: Component;
    best: number;
    level: number;
    onlevels: () => void;
    onstart: () => void;
  } = $props();

  const last = $derived(Math.min(meta.levels, best));
  const name = $derived(meta.levelName ?? 'レベル');

  let timer: ReturnType<typeof setTimeout> | undefined;
  /** 長押しのリピートで動かしたあとは、指を離したときの click で余分に 1 つ動かさない */
  let repeated = false;

  function step(d: -1 | 1): boolean {
    const next = Math.min(last, Math.max(1, level + d));
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
  <img
    class="art"
    src={asset(`/thumbs/${meta.id}.webp`)}
    alt=""
    width="680"
    height="400"
    loading="eager"
    decoding="async"
  />
  <h1 class="title yuru">{meta.name}</h1>
  <Howto />
  {#if meta.levels > 1}
    <span class="picker">
      <button
        class="step"
        onpointerdown={() => press(-1)}
        onpointerup={release}
        onpointercancel={release}
        onpointerleave={release}
        onclick={() => click(-1)}
        disabled={level <= 1}
        aria-label="前の{name}">◀</button
      >
      <button class="pill level" onclick={onlevels}>{name} {level}<span class="more">▼</span></button>
      <button
        class="step"
        onpointerdown={() => press(1)}
        onpointerup={release}
        onpointercancel={release}
        onpointerleave={release}
        onclick={() => click(1)}
        disabled={level >= last}
        aria-label="次の{name}">▶</button
      >
    </span>
  {/if}
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
    background: var(--paper-dots), var(--paper);
    color: var(--line);
    text-align: center;
  }

  /* 一覧のカードと同じ画面の画像を額に入れて、ゆらゆらさせる */
  .art {
    display: block;
    /* 背の低い画面ではタイトルとボタンに高さを譲るため、高さ 24cqh ぶんの幅までに抑える */
    width: min(78vw, 420px, 41cqh);
    height: auto;
    border: 3px solid var(--line);
    border-radius: 24px;
    box-shadow: 0 6px 0 rgb(91 74 66 / 0.22);
    rotate: -2deg;
    animation: sway 3s ease-in-out infinite;
  }

  .title {
    --fill: var(--pastel-p2);
    font-size: clamp(26px, min(7cqh, 11cqw), 64px);
    white-space: nowrap;
  }

  .level {
    padding: 8px 20px;
    font-size: clamp(16px, 2.6cqh, 22px);
  }

  .more {
    font-size: 0.7em;
  }

  .picker {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .step {
    width: 44px;
    height: 44px;
    border: 3px solid var(--line);
    border-radius: 50%;
    background: var(--pastel-p1);
    box-shadow: var(--soft-shadow);
    color: var(--line);
    font-size: 16px;
    cursor: pointer;
  }

  .step:disabled {
    background: #eee5db;
    color: var(--line-soft);
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
