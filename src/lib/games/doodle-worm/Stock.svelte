<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import Sheet from '$lib/components/Sheet.svelte';
  import { saveImage } from '$lib/share';
  import { picture, portrait } from './paint';
  import type { Doodle } from './stock';

  let {
    doodles,
    oncall,
    onremove,
    onstar,
    onclear,
    onparade,
    onclose
  }: {
    doodles: Doodle[];
    oncall: (d: Doodle) => void;
    onremove: (d: Doodle) => void;
    onstar: (d: Doodle) => void;
    onclear: () => void;
    onparade: () => void;
    onclose: () => void;
  } = $props();

  /** 押し間違えて消したり保存したりしないよう、モードを選んだあいだだけ絵を押すと反応する */
  let mode = $state<'call' | 'erase' | 'save'>('call');
</script>

<Sheet title="ずかん" {onclose}>
  <div class="tools">
    <button class="pill gold" disabled={!doodles.length} onclick={onparade}>パレード！</button>
    <button
      class="pill"
      class:p2={mode === 'erase'}
      aria-pressed={mode === 'erase'}
      onclick={() => (mode = mode === 'erase' ? 'call' : 'erase')}
    >
      {mode === 'erase' ? 'けしおわる' : 'けす'}
    </button>
    <button
      class="pill"
      class:gold={mode === 'save'}
      aria-pressed={mode === 'save'}
      onclick={() => (mode = mode === 'save' ? 'call' : 'save')}
    >
      {mode === 'save' ? 'ほぞんおわる' : 'えを ほぞん'}
    </button>
    <button class="pill" onclick={onclear}>がめんを かたづける</button>
  </div>
  {#if doodles.length}
    <ul class="grid">
      {#each doodles as d, i (d.id)}
        <li>
          <button
            class="card"
            class:erasing={mode === 'erase'}
            class:saving={mode === 'save'}
            aria-label={mode === 'erase' ? 'この えを けす' : mode === 'save' ? 'この えを ほぞん' : 'この えを よぶ'}
            onclick={() => {
              if (mode === 'erase') onremove(d);
              else if (mode === 'save') saveImage(picture(d.strokes), `asobibako-doodle-${i + 1}.png`);
              else oncall(d);
            }}
          >
            <img src={portrait(d.strokes)} width="160" height="160" alt="" />
          </button>
          <button
            class="star"
            class:on={d.star}
            aria-label="おきにいり"
            aria-pressed={!!d.star}
            onclick={() => onstar(d)}
          >
            <Icon name="star" size="80%" />
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

  li {
    position: relative;
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

  img {
    display: block;
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

  /* 保存できる絵には金色のふちを付ける */
  .card.saving {
    outline: 3px solid var(--gold);
    outline-offset: 2px;
  }

  /* ★を付けた絵は、ずかんがあふれても残る。付いていないあいだは薄くしておく */
  .star {
    position: absolute;
    top: -8px;
    left: -8px;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 2px solid var(--line);
    border-radius: 50%;
    background: #fff;
    cursor: pointer;
  }

  .star:not(.on) :global(svg) {
    opacity: 0.25;
    filter: grayscale(1);
  }

  .card:active {
    translate: 0 2px;
  }

  .empty {
    margin: 12px 0 20px;
    text-align: center;
  }
</style>
