<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { MODES } from './match.svelte';
  import type { Session } from './session.svelte';

  let { session }: { session: Session } = $props();
  const match = $derived(session.match);
  const play = $derived(session.play);
  const painting = $derived(play.mode === 'paint');
  const mode = $derived(MODES[match.view.settings.mode]);
</script>

<div class="top">
  {#if !painting}
    <span class="dolls white">
      {#each { length: match.hiders }, i (i)}<Icon name="figure" size="22px" />{/each}
    </span>
  {/if}
  <span class="clock">
    <Icon name="hourglass" size="30px" />
    <span class="num">{Math.ceil(match.left)}</span>
    {#if !painting}<span class="word">{match.word}</span>{/if}
  </span>
  {#if !painting}
    {#if match.taunt !== null}
      <span class="taunt">{Math.ceil(match.taunt)}</span>
    {/if}
    <span class="dolls red">
      {#each { length: match.hunters }, i (i)}<Icon name="figure" size="22px" />{/each}
    </span>
  {/if}
</div>

{#if !painting && match.phase !== 'intro'}
  {#if play.role === 'hunter'}
    <div class="mode">
      <span class="name">{mode.name}</span>
      <span>{mode.lines[0]}</span>
      <span>{mode.lines[1]}</span>
    </div>
  {:else if match.hiding}
    <p class="left">残り人数 <span class="big">{match.hiders}</span></p>
  {/if}
{/if}

<style>
  .top {
    position: absolute;
    top: max(8px, env(safe-area-inset-top));
    left: 50%;
    translate: -50% 0;
    display: flex;
    align-items: flex-start;
    gap: 14px;
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    text-shadow: 0 1px 3px #000;
    pointer-events: none;
  }

  .clock {
    display: grid;
    justify-items: center;
    font-size: 15px;
  }

  .num {
    font-size: 40px;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .dolls {
    display: flex;
    gap: 2px;
    margin-top: 6px;
  }

  .dolls.white {
    color: #fff;
  }

  .dolls.red {
    color: #ff3b30;
  }

  .taunt {
    margin-top: 8px;
    color: #ffd23f;
    font-size: 16px;
    font-variant-numeric: tabular-nums;
  }

  .left,
  .mode {
    position: absolute;
    margin: 0;
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    text-shadow: 0 2px 4px #000;
    pointer-events: none;
  }

  /* 右の列の左に、回転の 2 つのボタンの段の上へ置く（同じ高さだと数字がボタンに重なる） */
  .left {
    right: calc(max(14px, env(safe-area-inset-right)) + 110px);
    bottom: calc(max(14px, env(safe-area-inset-bottom)) + 98px);
    font-size: 22px;
  }

  .big {
    font-size: 64px;
    line-height: 1;
  }

  /* ハンターの「うつ」は 128px と大きいので、その左に寄せる */
  .mode {
    right: calc(max(14px, env(safe-area-inset-right)) + 156px);
    bottom: max(14px, env(safe-area-inset-bottom));
    display: grid;
    justify-items: end;
    font-size: 15px;
  }

  .name {
    color: #7cc243;
    font-size: 26px;
  }
</style>
