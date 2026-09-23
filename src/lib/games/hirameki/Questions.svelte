<script lang="ts">
  import { sounds } from './sounds';
  import type { Question } from './types';

  /** asked は答えを開いた質問の添え字。シートを閉じても、このナゾのあいだは開いたまま */
  let {
    questions,
    asked = $bindable([]),
    onclose
  }: { questions: Question[]; asked?: number[]; onclose: () => void } = $props();

  const TONE = { はい: 'yes', いいえ: 'no', 関係ない: 'na' } as const;

  function ask(i: number) {
    if (asked.includes(i)) return;
    asked = [...asked, i];
    sounds.pick();
  }
</script>

<div class="sheet" role="dialog" aria-label="質問">
  <p class="head">聞いた数 {asked.length} / {questions.length}</p>
  <ol>
    {#each { length: questions.length }, i (i)}
      {@const item = questions[i]}
      <li>
        <button class="q" disabled={asked.includes(i)} onclick={() => ask(i)}>{item.q}</button>
        {#if asked.includes(i)}
          <span class="a {TONE[item.a]}">{item.a}</span>
        {/if}
      </li>
    {/each}
  </ol>
  <button class="pill close" onclick={onclose}>閉じる</button>
</div>

<style>
  .sheet {
    position: absolute;
    right: 12px;
    bottom: max(12px, env(safe-area-inset-bottom));
    left: 12px;
    z-index: 3;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: 680px;
    max-height: calc(100cqh - 96px);
    margin: 0 auto;
    padding: 14px 16px 16px;
    border: 3px solid var(--line);
    border-radius: 22px;
    background: #fff;
    box-shadow: var(--soft-shadow);
    color: var(--line);
    animation: up 360ms var(--spring);
  }

  @keyframes up {
    from {
      translate: 0 40%;
      opacity: 0;
    }
  }

  .head {
    margin: 0;
    font-size: clamp(14px, 2cqh, 18px);
    font-weight: 800;
    text-align: center;
  }

  /* 画面全体は touch-action: none なので、ここだけ縦のスクロールを許す */
  ol {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
    margin: 0;
    padding: 0 4px;
    overflow-y: auto;
    overscroll-behavior: contain;
    list-style: none;
    touch-action: pan-y;
  }

  li {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .q {
    flex: 1 1 0;
    min-width: 0;
    padding: 8px 14px;
    border: 2px solid var(--line);
    border-radius: 14px;
    background: var(--paper);
    color: var(--line);
    font-size: clamp(14px, min(2cqh, 3.8cqw), 19px);
    font-weight: 700;
    line-height: 1.45;
    text-align: left;
    cursor: pointer;
    touch-action: pan-y;
  }

  .q:disabled {
    background: #fff;
    cursor: default;
  }

  /* 答えのスタンプ。はい・いいえ・関係ないで色を変える */
  .a {
    flex: none;
    padding: 2px 12px;
    border: 3px solid currentColor;
    border-radius: 10px;
    font-size: clamp(15px, 2.2cqh, 20px);
    font-weight: 900;
    rotate: -6deg;
    animation: stamp 320ms cubic-bezier(0.2, 0.9, 0.3, 1.4);
  }

  .yes {
    background: #e3f7e6;
    color: #2f8f5b;
  }

  .no {
    background: #ffe6ec;
    color: #d0435e;
  }

  .na {
    background: #f1eeea;
    color: #8a7f76;
  }

  @keyframes stamp {
    from {
      scale: 1.8;
      opacity: 0;
    }
  }

  .close {
    align-self: center;
    padding: 10px 28px;
  }

  @media (prefers-reduced-motion: reduce) {
    .sheet,
    .a {
      animation: none;
    }
  }
</style>
