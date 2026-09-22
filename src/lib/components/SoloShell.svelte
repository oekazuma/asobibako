<script lang="ts">
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import { audio, sfx, toggleMute, wake } from '$lib/audio.svelte';
  import type { SoloMeta, SoloModule } from '$lib/games';
  import { Settle } from '$lib/settle.svelte';

  let { meta, Game, Howto }: { meta: SoloMeta } & SoloModule = $props();

  const key = $derived(`table-duel:level:${meta.id}`);
  let screen = $state<'title' | 'playing' | 'result'>('title');
  let cleared = $state(false);
  let round = $state(0);
  let level = $state(1);
  const settle = new Settle();

  function start() {
    wake();
    sfx.start();
    round += 1;
    screen = 'playing';
  }

  function finish(won: boolean) {
    cleared = won;
    if (won) {
      level += 1;
      try {
        localStorage.setItem(key, String(level));
      } catch {
        // 保存できなくても、この場では次のレベルへ進める
      }
    }
    screen = 'result';
    settle.begin();
  }

  onMount(() => {
    try {
      level = Math.max(1, Number(localStorage.getItem(key)) || 1);
    } catch {
      // プライベートブラウズでは 1 から
    }
    return settle.listen();
  });
</script>

<main class="stage solo" class:settling={settle.active}>
  {#if screen === 'playing'}
    {#key round}
      <Game {level} onfinish={finish} />
    {/key}
    <!-- 遊んでいる途中でもやめられるよう、小さく隅に置く。一覧ではなくタイトルへ戻る -->
    <button class="corner quit" onclick={() => (screen = 'title')} aria-label="やめる">✕</button>
  {:else}
    <div class="panel" class:won={screen === 'result' && cleared}>
      {#if screen === 'title'}
        <h1 class="title sticker">{meta.name}</h1>
        <Howto />
        <span class="level">レベル {level}</span>
        <button class="pill p1 go" onclick={start}>タップで スタート</button>
      {:else}
        <span class="outcome sticker" role="status">{cleared ? 'クリア！' : 'ざんねん…'}</span>
        <span class="level">{cleared ? `つぎは レベル ${level}` : `レベル ${level}`}</span>
        <button class="pill gold go" onclick={start}>{cleared ? 'つぎへ' : 'もういちど'}</button>
      {/if}
    </div>
    <a class="corner back" href={resolve('/')} aria-label="ゲーム選択へ戻る">✕</a>
    <button class="corner mute" onclick={toggleMute} aria-label="ミュート" aria-pressed={audio.muted}>
      {audio.muted ? '🔇' : '🔊'}
    </button>
  {/if}
</main>

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

  .panel.won {
    background:
      repeating-conic-gradient(from 0deg, rgb(255 255 255 / 0.45) 0deg 10deg, transparent 10deg 20deg),
      radial-gradient(circle, #fff3c4, var(--gold) 70%);
  }

  .title {
    font-size: clamp(34px, 7dvh, 64px);
  }

  .outcome {
    font-size: clamp(48px, 12dvh, 120px);
    color: var(--gold-deep);
    animation: pop 520ms var(--spring) both;
  }

  .level {
    padding: 6px 18px;
    border-radius: 999px;
    background: var(--card);
    box-shadow: 0 3px 0 var(--card-edge);
    font-size: clamp(16px, 2.6dvh, 22px);
    font-weight: 800;
  }

  .go {
    font-size: clamp(18px, 3dvh, 26px);
    padding: 18px 40px;
    animation: bob 1.6s ease-in-out infinite;
  }

  .corner {
    position: absolute;
    top: max(12px, env(safe-area-inset-top));
    z-index: 5;
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border: 3px solid #fff;
    border-radius: 50%;
    background: var(--card);
    box-shadow: var(--lift);
    color: var(--ink);
    font-size: 18px;
    font-weight: 800;
    text-decoration: none;
    cursor: pointer;
  }

  .back,
  .quit {
    left: max(12px, env(safe-area-inset-left));
  }

  .quit {
    opacity: 0.7;
  }

  .mute {
    right: max(12px, env(safe-area-inset-right));
  }

  .settling .corner,
  .settling .go {
    pointer-events: none;
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
    .outcome,
    .go {
      animation: none;
    }
  }
</style>
