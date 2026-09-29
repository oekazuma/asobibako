<script lang="ts">
  import type { Look } from './looks';
  import { portrait } from './paint';
  import type { Doodle } from './stock';

  let {
    title,
    doodles,
    look,
    onpick
  }: {
    title: string;
    doodles: Doodle[];
    look: Look;
    onpick: (d: Doodle) => void;
  } = $props();
</script>

<h2 class="yuru">{title}</h2>
<ul class="grid">
  {#each doodles as d (d.id)}
    <li>
      <button class="card" aria-label="この こに する" onclick={() => onpick(d)}>
        <img src={portrait(d.strokes, look)} style:background={look.bg} width="160" height="160" alt="" />
      </button>
    </li>
  {/each}
</ul>

<style>
  h2 {
    margin: 0 0 12px;
    font-size: clamp(22px, min(4cqh, 6cqw), 36px);
    text-align: center;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .card {
    width: 100%;
    aspect-ratio: 1;
    padding: 6px;
    border: 2px solid var(--line);
    border-radius: 18px;
    background: #fff;
    box-shadow: var(--soft-shadow);
    cursor: pointer;
  }

  .card:active {
    translate: 0 2px;
  }

  img {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 12px;
  }
</style>
