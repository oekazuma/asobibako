<script lang="ts">
  import { ACHIEVEMENTS } from './achievements';
  import { animal } from './animals';
  import Evolutions from './Evolutions.svelte';
  import { loadRecords } from './records';

  let { onback }: { onback: () => void } = $props();

  const r = loadRecords();
  const done = ACHIEVEMENTS.filter((a) => r.achieved.includes(a.id)).length;
  const n = (v: number) => Math.floor(v).toLocaleString('ja-JP');
</script>

<div class="as-screen">
  <section class="as-panel" aria-label="実績">
    <h2 class="as-title">実績</h2>
    <p class="count">{done} / {ACHIEVEMENTS.length} 達成</p>
    <ul>
      {#each ACHIEVEMENTS as a (a.id)}
        {@const got = r.achieved.includes(a.id)}
        {@const p = a.progress?.(r)}
        <li class:got>
          <span class="mark">{got ? '✓' : ''}</span>
          <span class="name">{a.name}</span>
          <span class="reward">+{a.coins}{a.animal ? `・${animal(a.animal).name}` : ''}</span>
          {#if p && !got}<span class="progress">{n(Math.min(p[0], p[1]))} / {n(p[1])}</span>{/if}
        </li>
      {/each}
    </ul>
    <Evolutions evolved={r.evolved} />
    <button class="as-card back" onclick={onback}>もどる</button>
  </section>
</div>

<style>
  .count {
    margin: 0;
    text-align: center;
    color: #ffd84a;
    font-size: min(5cqw, 3cqh, 26px);
  }

  ul {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    grid-template-columns: 1.4em 1fr auto;
    gap: 2px 8px;
    align-items: center;
    padding: 6px 10px;
    background: #1f1530;
    color: #8a7aa8;
    font-size: min(3.6cqw, 2.1cqh, 18px);
  }

  li.got {
    background: #3a2a14;
    color: #fff3d6;
  }

  .mark {
    color: #8fd14f;
  }

  .reward {
    color: #ffd84a;
  }

  .progress {
    grid-column: 2 / -1;
    font-size: 0.85em;
  }

  .back {
    justify-content: center;
    font-size: min(4.6cqw, 2.8cqh, 24px);
  }
</style>
