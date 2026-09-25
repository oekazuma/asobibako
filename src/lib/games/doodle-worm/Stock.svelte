<script lang="ts">
  import Sheet from '$lib/components/Sheet.svelte';
  import { portrait } from './paint';
  import type { Doodle } from './stock';

  let {
    doodles,
    oncall,
    onremove,
    onclear,
    onclose
  }: {
    doodles: Doodle[];
    oncall: (d: Doodle) => void;
    onremove: (d: Doodle) => void;
    onclear: () => void;
    onclose: () => void;
  } = $props();

  /** 押し間違えて消さないよう、「けす」を押したあいだだけ絵を押すと消える */
  let erasing = $state(false);

  function draw(canvas: HTMLCanvasElement, d: Doodle) {
    portrait(canvas, d.strokes);
  }
</script>

<Sheet title="ずかん" {onclose}>
  <div class="tools">
    <button class="pill" class:p2={erasing} aria-pressed={erasing} onclick={() => (erasing = !erasing)}>
      {erasing ? 'けしおわる' : 'けす'}
    </button>
    <button class="pill" onclick={onclear}>がめんを かたづける</button>
  </div>
  {#if doodles.length}
    <ul class="grid">
      {#each doodles as d (d.id)}
        <li>
          <button
            class="card"
            class:erasing
            aria-label={erasing ? 'この えを けす' : 'この えを よぶ'}
            onclick={() => (erasing ? onremove(d) : oncall(d))}
          >
            <canvas width="160" height="160" use:draw={d}></canvas>
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty">えを かいて「うごけ！」を おすと、ここに はいるよ</p>
  {/if}
</Sheet>

<style>
  .tools {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 12px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .card {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    padding: 6px;
    border: 2px solid var(--line);
    border-radius: 18px;
    background: #fff4f6;
    box-shadow: var(--soft-shadow);
    cursor: pointer;
  }

  canvas {
    width: 100%;
    height: 100%;
  }

  /* 消せる絵には赤い ✕ を重ねる */
  .card.erasing::after {
    content: '✕';
    position: absolute;
    top: -8px;
    right: -8px;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 2px solid #fff;
    border-radius: 50%;
    background: var(--p2);
    color: #fff;
    font-weight: 800;
  }

  .card:active {
    translate: 0 2px;
  }

  .empty {
    margin: 12px 0 20px;
    text-align: center;
  }
</style>
