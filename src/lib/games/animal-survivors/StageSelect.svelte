<script lang="ts">
  import { FOREST_ART } from './art/forest';
  import { GRAVE_ART } from './art/graveyard';
  import { ENEMIES } from './enemies';
  import PixelIcon from './PixelIcon.svelte';
  import { canPlay, type Records } from './records';
  import { STAGES } from './stages';

  let { records, onpick, onback }: { records: Records; onpick: (id: string) => void; onback: () => void } = $props();

  const LOOK = {
    forest: { tile: FOREST_ART.grass, mark: FOREST_ART.decor.tree },
    graveyard: { tile: GRAVE_ART.grass, mark: GRAVE_ART.decor.tomb }
  };
</script>

<div class="as-screen">
  <button class="round corner" onclick={onback} aria-label="キャラクター選択へ戻る">✕</button>
  <section class="as-panel" aria-label="面を選ぶ">
    <h2 class="as-title">面を選ぶ</h2>
    {#each STAGES as s (s.id)}
      {@const open = canPlay(records, s.id)}
      <button
        class="as-card"
        class:closed={!open}
        data-stage={s.id}
        disabled={!open}
        aria-current={records.stage === s.id ? 'true' : undefined}
        onclick={() => onpick(s.id)}
      >
        <span class="look">
          <PixelIcon art={LOOK[s.art].mark} size="min(14cqw, 8cqh, 72px)" />
        </span>
        <span class="body">
          <span class="name">{s.name}</span>
          {#if open}
            <span class="info">ボス: {[...new Set(s.bosses.map((b) => ENEMIES[b.id].name))].join('・')}</span>
            <span class="info">コイン ×{s.coin}</span>
            {#if s.id !== 'forest'}<span class="info hard">敵が強い</span>{/if}
          {:else}
            <span class="info">{s.unlock}</span>
          {/if}
        </span>
      </button>
    {/each}
  </section>
</div>

<style>
  .corner {
    position: absolute;
    top: max(12px, env(safe-area-inset-top));
    left: max(12px, env(safe-area-inset-left));
    z-index: 5;
  }

  .look {
    display: flex;
  }

  .closed {
    cursor: default;
    background: #d9cbb0;
  }

  .closed .look {
    filter: brightness(0);
    opacity: 0.55;
  }

  [aria-current='true'] {
    box-shadow:
      inset 0 0 0 3px #ffd84a,
      0 4px 0 #8a6a4a;
  }

  .body {
    display: grid;
    gap: 4px;
  }

  .name {
    font-size: min(5.4cqw, 3.2cqh, 28px);
  }

  .info {
    color: #5d3a2a;
    font-size: min(3.4cqw, 2cqh, 17px);
    font-weight: 700;
  }

  .hard {
    color: #d8463c;
  }
</style>
