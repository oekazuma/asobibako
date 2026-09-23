<script lang="ts">
  import { sounds } from './sounds';

  /** picked は押したタイルの添え字の並び。1 枚は 1 回だけ使える */
  let { tiles, picked = $bindable([]) }: { tiles: string[]; picked?: number[] } = $props();

  function press(i: number) {
    if (picked.includes(i)) return;
    picked = [...picked, i];
    sounds.pick();
  }
</script>

<div class="word">
  <!-- 答えの文字数ぶんの枠は出さない。文字数が答えの手がかりになってしまうため -->
  <p class="spelled" aria-live="polite">
    {#each picked as t (t)}
      <span class="cell">{tiles[t]}</span>
    {:else}
      <span class="empty">タイルを押して言葉を作る</span>
    {/each}
  </p>
  <div class="tiles">
    {#each { length: tiles.length }, i (i)}
      <button class="tile" disabled={picked.includes(i)} onclick={() => press(i)}>{tiles[i]}</button>
    {/each}
  </div>
  <div class="row">
    <button class="pill" disabled={!picked.length} onclick={() => (picked = picked.slice(0, -1))}>1 字消す</button>
    <button class="pill" disabled={!picked.length} onclick={() => (picked = [])}>全部消す</button>
  </div>
</div>

<style>
  .word {
    --tile: clamp(40px, min(6cqh, 11cqw), 60px);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    color: var(--line);
  }

  .spelled {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 4px;
    min-height: calc(var(--tile) * 0.9);
    margin: 0;
    font-size: calc(var(--tile) * 0.5);
    font-weight: 800;
  }

  .cell {
    display: grid;
    place-items: center;
    width: calc(var(--tile) * 0.9);
    aspect-ratio: 1;
    border: 3px solid var(--line);
    border-radius: 10px;
    background: #fff;
    animation: pop 240ms var(--spring);
  }

  @keyframes pop {
    from {
      scale: 0.5;
    }
  }

  .empty {
    align-self: center;
    color: var(--line-soft);
    font-size: clamp(13px, 2cqh, 18px);
  }

  .tiles {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
    max-width: calc(var(--tile) * 10 + 54px);
  }

  .tile {
    width: var(--tile);
    aspect-ratio: 1;
    padding: 0;
    border: 3px solid var(--line);
    border-radius: 12px;
    background: #fff4d6;
    box-shadow: var(--soft-shadow);
    color: var(--line);
    font-size: calc(var(--tile) * 0.5);
    font-weight: 800;
    cursor: pointer;
  }

  .tile:active {
    translate: 0 3px;
    box-shadow: var(--soft-press);
  }

  .tile:disabled {
    opacity: 0.25;
    box-shadow: none;
    cursor: default;
  }

  .row {
    display: flex;
    gap: 10px;
  }

  .pill {
    padding: 8px 18px;
    font-size: clamp(14px, 2cqh, 18px);
  }

  .pill:disabled {
    opacity: 0.45;
  }

  @media (prefers-reduced-motion: reduce) {
    .cell {
      animation: none;
    }
  }
</style>
