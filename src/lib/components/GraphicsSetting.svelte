<script lang="ts">
  import { graphics, QUALITIES, setQuality } from '$lib/graphics.svelte';
</script>

<div class="graphics" role="radiogroup" aria-label="3D の画質">
  {#each QUALITIES as q (q.id)}
    <button
      class="pill choice"
      class:gold={graphics.quality === q.id}
      role="radio"
      aria-checked={graphics.quality === q.id}
      onclick={() => setQuality(q.id)}
    >
      <span class="name">{q.name}</span>
      <span class="note">{q.note}</span>
    </button>
  {/each}
</div>
<p class="hint">3D の ゲーム（わんにゃんハウス）の みため です。うごきが かくかく するときは かるく してね。</p>

<style>
  .graphics {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .choice {
    display: grid;
    gap: 2px;
    padding: 8px 6px;
    text-align: center;
  }

  .name {
    font-size: 16px;
    font-weight: 800;
  }

  .note {
    font-size: 11px;
    font-weight: 700;
    line-height: 1.4;
  }

  .hint {
    margin-top: 8px;
  }
</style>
