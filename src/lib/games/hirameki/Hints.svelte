<script lang="ts">
  let {
    hints,
    shown = $bindable(1),
    onclose
  }: { hints: readonly string[]; shown?: number; onclose: () => void } = $props();
</script>

<div class="sheet" role="dialog" aria-label="ヒント">
  <ol>
    {#each { length: shown }, i (i)}
      {@const hint = hints[i]}
      <li><span class="tag">ヒント {i + 1}</span>{hint}</li>
    {/each}
  </ol>
  <div class="row">
    {#if shown < hints.length}
      <button class="pill p1" onclick={() => (shown += 1)}>次のヒント</button>
    {/if}
    <button class="pill" onclick={onclose}>閉じる</button>
  </div>
</div>

<style>
  .sheet {
    position: absolute;
    right: 12px;
    bottom: max(12px, env(safe-area-inset-bottom));
    left: 12px;
    z-index: 3;
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 640px;
    margin: 0 auto;
    padding: 16px;
    border: 3px solid var(--line);
    border-radius: 22px;
    background: #fff;
    box-shadow: var(--soft-shadow);
    color: var(--line);
    animation: up 360ms var(--spring);
  }

  @keyframes up {
    from {
      translate: 0 40%;
      opacity: 0;
    }
  }

  ol {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: clamp(14px, min(2.1cqh, 3.8cqw), 21px);
    font-weight: 700;
    line-height: 1.5;
  }

  .tag {
    display: inline-block;
    margin-right: 8px;
    padding: 0 10px;
    border-radius: 999px;
    background: var(--pastel-gold);
    font-size: 0.8em;
  }

  .row {
    display: flex;
    justify-content: center;
    gap: 12px;
  }

  .pill {
    padding: 10px 24px;
  }

  @media (prefers-reduced-motion: reduce) {
    .sheet {
      animation: none;
    }
  }
</style>
