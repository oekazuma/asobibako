<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import type { IconName } from '$lib/icons';
  import type { Play } from './play.svelte';
  import QuitConfirm from './QuitConfirm.svelte';

  let { play, onquit }: { play: Play; onquit: () => void } = $props();
  let asking = $state(false);

  function ask() {
    // 確かめが出ているあいだは、押していた指の続きを操作にしない
    play.interrupt();
    asking = true;
  }
</script>

{#snippet button(icon: IconName, label: string, onclick: () => void, on = false, rotate = 0)}
  <button class="btn" class:on {onclick}>
    <Icon name={icon} size="30px" {rotate} />
    <span>{label}</span>
  </button>
{/snippet}

<!-- スティックの指を置いたまま押す 2 本めの指では iOS が click を出さないことがあるので、pointerdown で受ける -->
{#snippet tap(icon: IconName, label: string, onpress: () => void, on = false)}
  <button class="btn" class:on onpointerdown={onpress}>
    <Icon name={icon} size="30px" />
    <span>{label}</span>
  </button>
{/snippet}

{#snippet holder(icon: IconName, label: string, key: 'up' | 'down', rotate = 0)}
  <button
    class="btn"
    onpointerdown={() => play.hold(key, true)}
    onpointerup={() => play.hold(key, false)}
    onpointercancel={() => play.hold(key, false)}
    onpointerleave={() => play.hold(key, false)}
  >
    <Icon name={icon} size="30px" {rotate} />
    <span>{label}</span>
  </button>
{/snippet}

{#snippet pose()}
  <button class="btn" class:on={play.pose !== 'stand'} onpointerdown={(e) => play.openWheel(e.pointerId)}>
    <Icon name="figure" size="30px" />
    <span>ポーズ</span>
  </button>
{/snippet}

{#snippet spinner(turn: number, label: string, mirror = false)}
  <button
    class="btn"
    onpointerdown={() => play.turn(turn)}
    onpointerup={() => play.turn(0)}
    onpointercancel={() => play.turn(0)}
    onpointerleave={() => play.turn(0)}
    aria-label={label}
  >
    <span class:mirror><Icon name="spin" size="30px" /></span>
  </button>
{/snippet}

<button class="quit" onclick={ask} aria-label="タイトルへ">✕</button>

<div class="column">
  {#if play.mode === 'paint'}
    {@render button('dropper', '3D スポイト', () => play.toggleSpoit(), play.spoit)}
    {@render button('rewind', '元に戻す', () => play.undo())}
    {@render button('shadow', '影', () => play.toggleShadow(), play.shadow)}
    {@render button('spray', 'ペイントモード', () => play.togglePaint(), true)}
  {:else if play.mode === 'eye'}
    {@render tap('lift', 'ジャンプ', () => play.jump())}
    {@render button('eye', 'フリーカメラ', () => play.toggleEye(), true)}
  {:else if play.cling}
    {@render holder('lift', '上がる', 'up')}
    {@render holder('lift', '下がる', 'down', 180)}
    <button class="btn" onclick={() => play.release()}><span>張り付き解除</span></button>
    {@render pose()}
    {@render button('spray', 'ペイントモード', () => play.togglePaint())}
  {:else}
    {@render tap('lift', play.nearWall ? 'よじ登り' : 'ジャンプ', () => play.jump())}
    {@render pose()}
    {@render button('spray', 'ペイントモード', () => play.togglePaint())}
    {@render button('eye', 'フリーカメラ', () => play.toggleEye())}
    {@render tap('lock', '回転ロック', () => play.toggleLock(), play.lock)}
  {/if}
</div>

{#if play.mode === 'walk' && play.cling !== 'wall'}
  <div class="spin">
    {@render spinner(1, 'その場で回転（左）', true)}
    {@render spinner(-1, 'その場で回転（右）')}
  </div>
{/if}

{#if asking}
  <QuitConfirm onstay={() => (asking = false)} onleave={onquit} />
{/if}

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

  .spin {
    position: absolute;
    right: calc(max(14px, env(safe-area-inset-right)) + 98px);
    bottom: max(14px, env(safe-area-inset-bottom));
    display: flex;
    gap: 10px;
  }

  .mirror {
    display: inline-flex;
    scale: -1 1;
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
