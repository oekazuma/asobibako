<script lang="ts">
  import type { LinkState } from './link';

  let { mode, onpress }: { mode: LinkState; onpress: () => void } = $props();

  const can = $derived(mode === 'ready' || mode === 'partner');
  // 細い端末でも変なところで折り返さないよう、行を決めておく
  const lines = $derived(
    mode === 'waiting' ? ['相棒を', '待っています'] : mode === 'partner' ? ['相棒が', '押した！'] : ['いっしょに！']
  );

  // 2 人で「せーの」と合わせるので、指が触れた瞬間に数える（click は指を離すまで遅れる）
  function press(event: PointerEvent) {
    event.preventDefault();
    if (can) onpress();
  }

  function key(event: KeyboardEvent) {
    if (event.key !== ' ' || !can) return;
    event.preventDefault();
    onpress();
  }
</script>

<svelte:window onkeydown={key} />

{#if mode !== 'none'}
  <button class="link as-card" class:partner={mode === 'partner'} data-link disabled={!can} onpointerdown={press}>
    {#each lines as line (line)}<span>{line}</span>{/each}
  </button>
{/if}

<style>
  .link {
    position: absolute;
    top: 50%;
    right: max(12px, env(safe-area-inset-right));
    z-index: 5;
    flex-direction: column;
    width: min(32cqw, 170px);
    min-height: min(14cqw, 76px);
    justify-content: center;
    padding: 6px;
    translate: 0 -50%;
    background: #ffd84a;
    color: #24151f;
    font-size: min(4.4cqw, 2.6cqh, 22px);
    font-weight: 900;
    line-height: 1.2;
    white-space: nowrap;
  }

  .link:disabled {
    opacity: 0.75;
    font-size: min(3.4cqw, 2cqh, 17px);
  }

  .partner {
    animation: glow 900ms ease-in-out infinite alternate;
  }

  @keyframes glow {
    from {
      box-shadow: 0 0 0 0 rgb(255 216 74 / 0.4);
    }
    to {
      box-shadow: 0 0 18px 8px rgb(255 216 74 / 0.9);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .partner {
      animation: none;
      box-shadow: 0 0 12px 6px rgb(255 216 74 / 0.8);
    }
  }
</style>
