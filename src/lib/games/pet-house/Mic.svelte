<script lang="ts">
  import { onDestroy } from 'svelte';
  import { version } from '$app/environment';
  import { snapshot } from '$lib/mirror';
  import { canListen, pushToTalk } from './listen';
  import type { Session } from './session.svelte';
  import { parse } from './voice';

  let { session }: { session: Session } = $props();

  let listening = $state(false);
  /** 押しても聞けない（非対応・許可なし）。押せば理由を出す */
  let off = $state(!canListen());
  let said = $state('');
  let clear: ReturnType<typeof setTimeout> | undefined;

  onDestroy(() => {
    clearTimeout(clear);
    talk.stop();
  });

  function show(text: string, ms: number) {
    said = text;
    clearTimeout(clear);
    clear = setTimeout(() => (said = ''), ms);
  }

  const talk = pushToTalk(() => {
    // iPad でマイクを許可した直後に固まり、終わらせたら記録が全部消えたことがある。聞く前に記録と控えを書いておく
    session.flush();
    void snapshot(version);
    listening = true;
    return {
      result(alts) {
        off = false;
        for (const text of alts) {
          const h = parse(text, session.save.pets);
          if (!h) continue;
          show(`「${text}」`, 2500);
          return session.voice(h);
        }
        show(`「${alts[0]}」？ わからなかった`, 3000);
      },
      error(reason, lasting) {
        off = lasting;
        show(reason, 4500);
      },
      end() {
        listening = false;
      }
    };
  });
</script>

<div class="mic">
  <button
    class="tool"
    class:live={listening}
    class:off
    aria-label="こえで よぶ（おしながら はなす）"
    aria-pressed={listening}
    onpointerdown={talk.down}
    onpointerup={talk.up}
    onpointercancel={talk.up}
    onclick={talk.click}
  >
    <svg viewBox="0 0 24 24" width="56%" height="56%">
      <rect x="8.5" y="2.5" width="7" height="12" rx="3.5" fill="currentColor" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3.5M8 21.5h8" fill="none" stroke="currentColor" stroke-width="2.2" />
      {#if off}
        <path d="M4 3l16 18" stroke="#fff" stroke-width="5" stroke-linecap="round" />
        <path d="M4 3l16 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
      {/if}
    </svg>
    <span>{listening ? 'きいてるよ' : 'こえ'}</span>
  </button>
  {#if said}
    {#key said}
      <p class="said" role="status">{said}</p>
    {/key}
  {/if}
</div>

<style>
  .mic {
    position: relative;
  }

  .tool {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: clamp(52px, min(8cqh, 15cqw), 76px);
    aspect-ratio: 1;
    border: 3px solid var(--line);
    border-radius: 22%;
    background: #fff;
    box-shadow: var(--soft-shadow);
    color: var(--line);
    font-size: clamp(9px, min(1.2cqh, 2.4cqw), 12px);
    font-weight: 800;
    cursor: pointer;
  }

  .tool:active {
    translate: 0 3px;
    box-shadow: var(--soft-press);
  }

  .off {
    opacity: 0.55;
  }

  .live {
    background: var(--pastel-p2);
    color: #fff;
    animation: glow 900ms ease-in-out infinite alternate;
  }

  .said {
    position: absolute;
    top: 50%;
    left: calc(100% + 10px);
    width: max-content;
    max-width: min(60cqw, 360px);
    margin: 0;
    padding: 8px 14px;
    border: 3px solid var(--line);
    border-radius: 18px;
    background: var(--paper);
    box-shadow: var(--soft-shadow);
    color: var(--line);
    font-size: clamp(15px, min(2.2cqh, 4cqw), 22px);
    font-weight: 800;
    word-break: keep-all;
    translate: 0 -50%;
    animation: pop 320ms var(--spring);
  }

  @keyframes glow {
    from {
      box-shadow:
        var(--soft-shadow),
        0 0 0 0 rgb(255 77 94 / 0.55);
    }

    to {
      box-shadow:
        var(--soft-shadow),
        0 0 0 10px rgb(255 77 94 / 0);
    }
  }

  @keyframes pop {
    from {
      scale: 0.5;
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .live,
    .said {
      animation: none;
    }
  }
</style>
