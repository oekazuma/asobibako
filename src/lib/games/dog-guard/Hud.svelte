<script lang="ts">
  let {
    level,
    phase,
    ink,
    left
  }: {
    level: number;
    phase: 'draw' | 'defend' | 'done';
    ink: number;
    left: number;
  } = $props();
</script>

<div class="hud">
  <span class="level sticker">レベル {level}</span>
  {#if phase === 'draw'}
    <span class="ink" role="img" aria-label="のこりのインク {Math.round(ink * 100)}%"
      ><span class="fill" style:width="{ink * 100}%"></span></span
    >
  {:else}
    <span class="count sticker" role="timer">{phase === 'defend' ? left : ''}</span>
  {/if}
</div>

<style>
  .hud {
    position: absolute;
    top: 14px;
    left: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    translate: -50% 0;
    pointer-events: none;
  }

  .level {
    font-size: 24px;
  }

  .ink {
    width: 180px;
    height: 14px;
    overflow: hidden;
    border: 3px solid #fff;
    border-radius: 999px;
    background: rgb(43 45 66 / 0.12);
  }

  .fill {
    display: block;
    height: 100%;
    background: var(--ink);
  }

  .count {
    font-size: 40px;
    color: var(--p2);
  }
</style>
