<script module lang="ts">
  import type { Seat } from '$lib/net/party.svelte';
  import type { Stroke } from './strokes';

  export interface Miss {
    by: Seat;
    text: string;
  }

  export interface Drawing {
    word: string;
    by: Seat;
    strokes: Stroke[];
    /** その番に外れた答え */
    misses: Miss[];
  }
</script>

<script lang="ts">
  import { saveImage } from '$lib/share';
  import { album } from './album';
  import Board from './Board.svelte';
  import type { View } from './engine';
  import Face from './Face.svelte';
  import { who } from './looks';

  let {
    view,
    me,
    gallery,
    host,
    onagain,
    looks = {}
  }: {
    view: View;
    me: Seat;
    gallery: Drawing[];
    host: boolean;
    onagain: () => void;
    looks?: Record<number, string>;
  } = $props();

  const ranking = $derived(
    Object.entries(view.scores)
      .map(([seat, points]) => ({ seat: Number(seat) as Seat, points }))
      .sort((a, b) => b.points - a.points)
  );
  const rank = (points: number) => 1 + ranking.filter((r) => r.points > points).length;
</script>

<div class="result">
  <h2 class="yuru">けっか</h2>
  <ol class="ranking">
    {#each ranking as r (r.seat)}
      <li class="pill p{r.seat}">
        {rank(r.points)}い <Face seat={r.seat} look={looks[r.seat]} name />{r.seat === me ? '（あなた）' : ''}
        {r.points}てん
      </li>
    {/each}
  </ol>
  <ul class="gallery">
    {#each gallery as d (d)}
      <li>
        <div class="thumb"><Board strokes={d.strokes} /></div>
        <span><Face seat={d.by} look={looks[d.by]} />「{d.word}」</span>
        {#if d.misses.length}
          <ul class="misses">
            {#each d.misses as m (m)}<li>{who(m.by, looks)}「{m.text}」</li>{/each}
          </ul>
        {/if}
      </li>
    {/each}
  </ul>
  {#if gallery.length}
    <button
      class="pill"
      onclick={() =>
        saveImage(
          album(
            gallery,
            ranking.map((r) => ({ ...r, rank: rank(r.points) })),
            looks
          ),
          'oekaki-mori.png'
        )}>しゃしんに ほぞん</button
    >
  {/if}
  {#if host}
    <button class="pill gold" onclick={onagain}>あそびを えらぶ</button>
  {:else}
    <p role="status">おやが つぎの あそびを えらぶのを まってね</p>
  {/if}
</div>

<style>
  .result {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 16px;
    overflow-y: auto;
    touch-action: pan-y;
    background: var(--paper-dots), var(--paper);
    color: var(--line);
    font-weight: 800;
  }

  .ranking {
    display: grid;
    gap: 8px;
    list-style: none;
  }

  .gallery {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    width: min(100%, 560px);
    list-style: none;
  }

  .gallery li {
    display: grid;
    gap: 4px;
    justify-items: center;
    font-size: 14px;
  }

  .misses {
    list-style: none;
    font-size: 12px;
    font-weight: 700;
    text-align: center;
  }

  .thumb {
    width: 100%;
    aspect-ratio: 1;
    container-type: size;
  }
</style>
