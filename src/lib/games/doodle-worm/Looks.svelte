<script lang="ts">
  import Sheet from '$lib/components/Sheet.svelte';
  import type { Stroke } from './engine';
  import { LOOKS, type Look } from './looks';
  import { portrait } from './paint';

  let {
    look,
    sample,
    onpick,
    onclose
  }: {
    look: Look;
    /** 見比べる絵。自分の絵のほうが違いが伝わる */
    sample: Stroke[];
    onpick: (look: Look) => void;
    onclose: () => void;
  } = $props();
</script>

<Sheet title="えがら" {onclose}>
  <ul class="grid">
    {#each LOOKS as l (l.id)}
      <li>
        <button class="card" aria-pressed={l === look} onclick={() => onpick(l)}>
          <img src={portrait(sample, l)} style:background={l.bg} width="160" height="160" alt="" />
          <span>{l.name}</span>
        </button>
      </li>
    {/each}
  </ul>
</Sheet>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
    gap: 12px;
    margin: 0 0 12px;
    padding: 0;
    list-style: none;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    padding: 6px 6px 8px;
    border: 2px solid var(--line);
    border-radius: 18px;
    background: #fff;
    box-shadow: var(--soft-shadow);
    color: var(--line);
    font-weight: 800;
    cursor: pointer;
  }

  .card[aria-pressed='true'] {
    outline: 4px solid var(--p2);
    outline-offset: 2px;
  }

  .card:active {
    translate: 0 2px;
  }

  img {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 1;
    border-radius: 12px;
  }
</style>
