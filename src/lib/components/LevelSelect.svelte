<script lang="ts">
  import Icon from './Icon.svelte';

  /**
   * best はたどり着いたいちばん先のレベル（1..levels + 1）。それより前はクリア済み、先はまだ選べない。
   * solved があるときは好きな順に選べるゲームで、best の代わりに解いた面の集合と今の面（current）でマスを決める
   */
  let {
    levels,
    best,
    name = 'レベル',
    solved,
    current,
    onpick
  }: {
    levels: number;
    best: number;
    name?: string;
    solved?: ReadonlySet<number>;
    current?: number;
    onpick: (level: number) => void;
  } = $props();

  // 100 面を 6 列にすると 17 行になり、iPad でマスが 35px ほどになる。行を 10 までに抑える
  const columns = $derived(levels > 60 ? 10 : levels > 30 ? 6 : 5);
</script>

<div class="panel">
  <h1 class="title yuru">{name}を えらぼう</h1>
  <div class="grid" style:--cols={columns} style:--rows={Math.ceil(levels / columns)}>
    {#each { length: levels }, i (i)}
      {@const n = i + 1}
      {@const cleared = solved ? solved.has(n) : n < best}
      <button
        class="cell"
        class:cleared
        class:next={solved ? n === current : n === best}
        disabled={!solved && n > best}
        onclick={() => onpick(n)}
        aria-label="{name} {n}"
      >
        {n}
        {#if cleared}
          <span class="star"><Icon name="star" size="100%" /></span>
        {/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .panel {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 24px;
    padding: 72px 16px 24px;
    background: var(--paper-dots), var(--paper);
    color: var(--line);
  }

  .title {
    --fill: var(--pastel-gold);
    font-size: clamp(24px, min(5cqh, 9cqw), 52px);
    white-space: nowrap;
  }

  .grid {
    /* 面が多くてもスクロールせずに収まるよう、列と行の数から 1 マスの大きさを決める */
    --cell: min(calc(90cqw / var(--cols) - 12px), 96px, calc(68cqh / var(--rows) - 12px));
    display: grid;
    grid-template-columns: repeat(var(--cols), var(--cell));
    gap: 12px;
  }

  .cell {
    position: relative;
    display: grid;
    place-items: center;
    aspect-ratio: 1;
    border: 3px solid var(--line);
    border-radius: 22%;
    background: #fff;
    box-shadow: var(--soft-shadow);
    color: var(--line);
    font-size: calc(var(--cell) * 0.38);
    font-weight: 800;
    cursor: pointer;
  }

  .cell:active {
    translate: 0 3px;
    box-shadow: var(--soft-press);
  }

  .next {
    background: var(--pastel-p1);
    animation: bob 1.6s ease-in-out infinite;
  }

  .cell:disabled {
    background: #eee5db;
    color: var(--line-soft);
    box-shadow: none;
    cursor: default;
  }

  .star {
    position: absolute;
    top: -14%;
    right: -14%;
    width: 42%;
    height: 42%;
  }

  @media (prefers-reduced-motion: reduce) {
    .next {
      animation: none;
    }
  }
</style>
