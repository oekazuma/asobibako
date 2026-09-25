<script lang="ts">
  import type { Snippet } from 'svelte';

  let { title, onclose, children }: { title: string; onclose: () => void; children: Snippet } = $props();
</script>

<div class="sheet-layer">
  <!-- シートの外を押すと閉じる。盤面へは指を通さない -->
  <button class="backdrop" onclick={onclose} aria-label="とじる"></button>
  <section class="panel" aria-label={title}>
    <header>
      <h2 class="yuru">{title}</h2>
      <button class="round close" onclick={onclose} aria-label="とじる">✕</button>
    </header>
    <div class="body">
      {@render children()}
    </div>
  </section>
</div>

<style>
  /* シェルの隅のボタン（z-index 5）より下に置き、シートが開いていても ✕ でやめられるようにする */
  .sheet-layer {
    position: absolute;
    inset: 0;
    z-index: 4;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    border: none;
    background: rgb(91 74 66 / 0.25);
    cursor: pointer;
  }

  .panel {
    position: relative;
    display: flex;
    flex-direction: column;
    width: min(100%, 640px);
    max-height: 72%;
    border: 3px solid var(--line);
    border-bottom: none;
    border-radius: 28px 28px 0 0;
    background: var(--paper-dots), var(--paper);
    color: var(--line);
    animation: rise 380ms var(--spring);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 12px 8px 20px;
  }

  h2 {
    --fill: var(--pastel-gold);
    font-size: clamp(20px, min(3.2cqh, 6.4cqw), 30px);
  }

  .close {
    flex: none;
    width: 44px;
    height: 44px;
  }

  .body {
    overflow-y: auto;
    overscroll-behavior: contain;
    touch-action: pan-y;
    padding: 4px 16px max(16px, env(safe-area-inset-bottom));
  }

  @keyframes rise {
    from {
      translate: 0 40%;
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .panel {
      animation: none;
    }
  }
</style>
