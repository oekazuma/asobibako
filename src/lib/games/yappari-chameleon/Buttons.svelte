<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import type { IconName } from '$lib/icons';
  import type { Play } from './play.svelte';

  let { play, onquit }: { play: Play; onquit: () => void } = $props();

  const hold = (key: 'up' | 'down', on: boolean) => (play.held[key] = on);
</script>

{#snippet button(icon: IconName, label: string, onclick: () => void, on = false, rotate = 0)}
  <button class="btn" class:on {onclick}>
    <Icon name={icon} size="30px" {rotate} />
    <span>{label}</span>
  </button>
{/snippet}

{#snippet holder(icon: IconName, label: string, key: 'up' | 'down', rotate = 0)}
  <button
    class="btn"
    onpointerdown={() => hold(key, true)}
    onpointerup={() => hold(key, false)}
    onpointercancel={() => hold(key, false)}
    onpointerleave={() => hold(key, false)}
  >
    <Icon name={icon} size="30px" {rotate} />
    <span>{label}</span>
  </button>
{/snippet}

<button class="quit" onclick={onquit} aria-label="タイトルへ">✕</button>

<div class="column">
  {#if play.mode === 'paint'}
    {@render button('dropper', '3D スポイト', () => play.toggleSpoit(), play.spoit)}
    {@render button('rewind', '元に戻す', () => play.undo())}
    {@render button('shadow', '影', () => play.toggleShadow(), play.shadow)}
    {@render button('spray', 'ペイントモード', () => play.togglePaint(), true)}
  {:else if play.mode === 'eye'}
    {@render button('lift', 'ジャンプ', () => play.jump())}
    {@render button('eye', 'フリーカメラ', () => play.toggleEye(), true)}
  {:else if play.cling}
    {@render holder('lift', '上がる', 'up')}
    {@render holder('lift', '下がる', 'down', 180)}
    <button class="btn" onclick={() => play.release()}><span>張り付き解除</span></button>
    {@render button('spray', 'ペイントモード', () => play.togglePaint())}
  {:else}
    {@render button('lift', play.nearWall ? 'よじ登り' : 'ジャンプ', () => play.jump())}
    {@render button('spray', 'ペイントモード', () => play.togglePaint())}
    {@render button('eye', 'フリーカメラ', () => play.toggleEye())}
  {/if}
</div>

<style>
  .quit {
    position: absolute;
    top: max(12px, env(safe-area-inset-top));
    left: max(12px, env(safe-area-inset-left));
    width: 48px;
    height: 48px;
    border: 2px solid rgb(255 255 255 / 0.85);
    border-radius: 50%;
    background: rgb(0 0 0 / 0.35);
    color: #fff;
    font-size: 22px;
  }

  .column {
    position: absolute;
    right: max(14px, env(safe-area-inset-right));
    bottom: max(14px, env(safe-area-inset-bottom));
    display: grid;
    gap: 10px;
  }

  .btn {
    display: grid;
    justify-items: center;
    align-content: center;
    width: 88px;
    height: 88px;
    border: 2px solid rgb(255 255 255 / 0.85);
    border-radius: 50%;
    background: rgb(0 0 0 / 0.35);
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 10px;
    white-space: nowrap;
    line-height: 1.15;
    text-shadow: 0 1px 2px #000;
  }

  .btn.on {
    background: rgb(255 255 255 / 0.9);
    color: #1d1a17;
    text-shadow: none;
  }
</style>
