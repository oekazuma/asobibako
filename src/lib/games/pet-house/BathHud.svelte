<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import type { BathPlay, BathStep } from './bath.svelte';

  let { play }: { play: BathPlay } = $props();

  const STEPS: { id: BathStep; name: string }[] = [
    { id: 'shampoo', name: 'シャンプー' },
    { id: 'rinse', name: 'シャワー' },
    { id: 'towel', name: 'タオル' }
  ];
  const ORDER: BathStep[] = ['shampoo', 'rinse', 'towel', 'shake', 'done'];

  const at = $derived(ORDER.indexOf(play.step));
  const tip = $derived.by(() => {
    if (play.fussing) return `${play.name}が いやがってる… すこし まってあげてね`;
    switch (play.step) {
      case 'shampoo':
        return 'からだを ゆびで こすって、あわあわに しよう';
      case 'rinse':
        return 'シャワーを ゆびで うごかして、あわを ながそう';
      case 'towel':
        return 'タオルで ごしごし ふいて あげよう';
      case 'shake':
        return 'ぶるぶるっ！';
      default:
        return play.cat ? 'いやがってたけど、さっぱり！' : 'さっぱり！ きもちよかったね';
    }
  });
</script>

<div class="hud">
  <header class="bar">
    <ol class="steps">
      {#each STEPS as s, i (s.id)}
        <li class:now={i === at} class:done={i < at}>
          {#if i < at}<Icon name="check" size="16px" />{/if}{s.name}
        </li>
      {/each}
    </ol>
    {#if at < STEPS.length}
      <!-- 泡の多さ・流した量・乾き具合 -->
      <meter class="meter" value={play.progress} aria-label="{STEPS[at].name}の すすみぐあい"></meter>
    {/if}
  </header>

  {#key tip}
    <p class="tip" class:big={at >= STEPS.length}>{tip}</p>
  {/key}

  {#if at < STEPS.length}
    <button class="quit pill" onclick={() => play.quit()}>
      <Icon name="cross" size="18px" />やめる
    </button>
  {/if}
</div>

<style>
  .hud {
    position: absolute;
    inset: 0;
    z-index: 3;
    pointer-events: none;
    color: var(--line);
  }

  .bar {
    position: absolute;
    top: max(12px, env(safe-area-inset-top));
    left: 50%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 12px 6px 8px;
    border: 3px solid var(--line);
    border-radius: 999px;
    background: var(--paper);
    box-shadow: var(--soft-shadow);
    font-weight: 800;
    white-space: nowrap;
    translate: -50% 0;
  }

  .steps {
    display: flex;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .steps li {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 3px 10px;
    border-radius: 999px;
    color: #a08b7e;
    font-size: clamp(12px, 2.4cqw, 16px);
  }

  .steps .now {
    background: var(--pastel-p1);
    color: var(--line);
  }

  .steps .done {
    color: var(--line);
  }

  .meter {
    width: clamp(48px, 12cqw, 96px);
    height: 14px;
  }

  /* 細い画面では、隅の ✕ と ↻ にかからないよう進みのメーターをしまう */
  @container (max-width: 520px) {
    .meter {
      display: none;
    }

    .bar {
      padding: 4px 6px;
    }

    .steps li {
      padding: 3px 6px;
    }
  }

  .tip {
    position: absolute;
    bottom: max(28px, env(safe-area-inset-bottom));
    left: 50%;
    width: max-content;
    max-width: calc(100% - 32px);
    margin: 0;
    padding: 10px 20px;
    border: 3px solid var(--line);
    border-radius: 24px;
    background: #fff;
    box-shadow: var(--soft-shadow);
    font-size: clamp(15px, min(2.4cqh, 4.4cqw), 22px);
    font-weight: 800;
    text-align: center;
    word-break: keep-all;
    translate: -50% 0;
    animation: pop 360ms var(--spring);
  }

  .tip.big {
    background: var(--pastel-gold);
    font-size: clamp(20px, min(3.4cqh, 6cqw), 32px);
  }

  /* ペットにかからない、左下の床の上。下の吹き出しが 2 行になっても重ならない高さ */
  .quit {
    pointer-events: auto;
    position: absolute;
    bottom: max(112px, calc(env(safe-area-inset-bottom) + 96px));
    left: max(10px, env(safe-area-inset-left));
    display: flex;
    align-items: center;
    gap: 4px;
  }

  @keyframes pop {
    from {
      scale: 0.6;
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tip {
      animation: none;
    }
  }
</style>
