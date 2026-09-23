<script lang="ts">
  import { onDestroy } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import type { SoloProps } from '$lib/games';
  import { isRight } from './engine';
  import { Entry } from './entry.svelte';
  import Frame from './Frame.svelte';
  import Hints from './Hints.svelte';
  import Questions from './Questions.svelte';
  import { PUZZLES } from './puzzles';
  import Status from './Status.svelte';
  import Verdict from './Verdict.svelte';

  let { level, onfinish, onhint }: SoloProps = $props();

  // level はゲームごと作り直されるので、最初の値だけ使えばよい
  const start = (p = PUZZLES.at(level - 1)) => p && new Entry(p);
  let entry = $state(start());
  /** 間違えて答え直した回数。答えの入力だけを作り直し、メモ・ヒント・質問はそのまま残す */
  let attempt = $state(0);
  let verdict = $state<{ ok: boolean; detail: string; quick: boolean } | null>(null);
  let shown = $state(1);
  /** 開いているシート。質問は答えを開いたものを覚えておく */
  let sheet = $state<'hints' | 'ask' | null>(null);
  let asked = $state<number[]>([]);
  let memo = $state(false);
  let hintTimer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => clearTimeout(hintTimer));

  function answer() {
    if (!entry?.ready || verdict) return;
    settle(isRight(entry.p, entry.value));
  }

  /** 結果の演出へ。quick は川わたりや注ぐなぞのように、操作の途中で決まったもの */
  function settle(ok: boolean, why = '', quick = false) {
    verdict = { ok, detail: ok ? (entry?.p.why ?? '') : why, quick };
  }

  function retry() {
    verdict = null;
    entry = start();
    attempt += 1;
  }

  function warn(text: string) {
    onhint?.(text);
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => onhint?.(''), 2400);
  }
</script>

<div class="nazo">
  {#if entry}
    {@const p = entry.p}
    <header>
      <span class="no">ナゾ {level}</span>
      <h1 class="yuru">{p.title}</h1>
    </header>
    <p class="text">{p.text}</p>
    <Frame
      {entry}
      {attempt}
      {memo}
      onwarn={warn}
      onsolve={() => settle(true, '', true)}
      onfail={(why) => settle(false, why, true)}
    />
    <Status {entry} />
    <div class="bar">
      <button class="pill p1" onclick={() => (sheet = 'hints')}><Icon name="help" />ヒント</button>
      {#if p.questions?.length}
        <button class="pill p1" onclick={() => (sheet = 'ask')}><Icon name="detective" />質問する</button>
      {/if}
      <button class="pill" class:p2={memo} aria-pressed={memo} onclick={() => (memo = !memo)}>
        <Icon name="pencil" />メモ
      </button>
      <!-- 操作の途中で決まるなぞには「答える」がない -->
      {#if !['river', 'pour', 'slide', 'ice', 'connect', 'rotate'].includes(p.kind)}
        <button class="pill gold" disabled={!entry.ready} onclick={answer}>答える</button>
      {/if}
    </div>
    {#if sheet === 'hints'}
      <Hints hints={p.hints} bind:shown onclose={() => (sheet = null)} />
    {:else if sheet === 'ask' && p.questions}
      <Questions questions={p.questions} bind:asked onclose={() => (sheet = null)} />
    {/if}
    {#if verdict}
      <Verdict {...verdict} onnext={() => onfinish(true)} ondone={retry} />
    {/if}
  {/if}
</div>

<style>
  .nazo {
    position: absolute;
    inset: 0;
    display: grid;
    grid-template:
      'head' auto
      'text' auto
      'frame' minmax(0, 1fr)
      'answer' auto
      'bar' auto / minmax(0, 1fr);
    gap: clamp(8px, 1.4cqh, 16px);
    padding: max(72px, calc(env(safe-area-inset-top) + 60px)) 16px max(16px, env(safe-area-inset-bottom));
    background: var(--paper-dots), var(--paper);
    color: var(--line);
    line-break: strict;
    overflow-wrap: anywhere;
  }

  /* 横長の画面（マウスの PC）では、図を左に、答えを右に並べる */
  @container (orientation: landscape) {
    .nazo {
      grid-template:
        'head head' auto
        'text answer' auto
        'frame answer' minmax(0, 1fr)
        'frame bar' auto / minmax(0, 1.4fr) minmax(0, 1fr);
    }
  }

  header {
    grid-area: head;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  .no {
    flex: none;
    padding: 4px 14px;
    border: 3px solid var(--line);
    border-radius: 999px;
    background: var(--pastel-p2);
    font-size: clamp(14px, min(2.2cqh, 4cqw), 22px);
    font-weight: 800;
  }

  h1 {
    --fill: var(--pastel-gold);
    margin: 0;
    overflow: hidden;
    font-size: clamp(20px, min(3.6cqh, 6cqw), 40px);
    white-space: nowrap;
  }

  .text {
    grid-area: text;
    margin: 0;
    padding: 12px 18px;
    border: 3px solid var(--line);
    border-radius: 20px;
    background: #fff;
    box-shadow: var(--soft-shadow);
    font-size: clamp(14px, min(2.1cqh, 3.7cqw), 22px);
    font-weight: 700;
    line-height: 1.55;
    /* 物語の長い文でも図や答えの場所を押しつぶさないよう、はみ出したらカードの中で読む */
    max-height: 36cqh;
    overflow-y: auto;
    overscroll-behavior: contain;
    touch-action: pan-y;
  }

  .bar {
    grid-area: bar;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
  }

  .pill {
    padding: 12px clamp(12px, 2cqw, 26px);
    font-size: clamp(16px, min(2.6cqh, 4.4cqw), 26px);
    white-space: nowrap;
  }

  .pill:disabled {
    opacity: 0.45;
  }
</style>
