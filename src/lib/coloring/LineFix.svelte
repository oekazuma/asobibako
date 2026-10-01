<script lang="ts">
  import { applyEdits, type Edit } from './edits';
  import LineEditor from './LineEditor.svelte';

  let { mask, onmake, onback }: { mask: Uint8Array; onmake: (mask: Uint8Array) => void; onback: () => void } = $props();

  let edits = $state.raw<Edit[]>([]);
  const fixed = $derived(applyEdits(mask, edits));
</script>

<div class="fix">
  <h2 class="yuru">せんを なおす</h2>
  <p>ぬりが はみだす ところに せんを たしてね</p>
  <LineEditor
    mask={fixed}
    onedit={(e) => (edits = [...edits, e])}
    onundo={() => (edits = edits.slice(0, -1))}
    canUndo={edits.length > 0}
  />
  <div class="row">
    <button class="pill" onclick={onback}>やめる</button>
    <button class="pill gold" onclick={() => onmake(fixed)}>これで ぬる</button>
  </div>
</div>

<style>
  .fix {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    /* 上の隅の共通の ✕ と ↻ に見出しが重ならないよう空けておく */
    padding: max(68px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom));
    overflow-y: auto;
    touch-action: pan-y;
    background: var(--paper-dots), var(--paper);
    color: var(--line);
    font-weight: 800;
  }

  .row {
    display: flex;
    gap: 8px;
  }
</style>
