<script lang="ts">
  import { animal } from './animals';
  import { ANIMAL_ART } from './art/animals';
  import { titles } from './coop-stats';
  import PixelIcon from './PixelIcon.svelte';
  import type { CoopRun } from './world';

  let { coop }: { coop: CoopRun } = $props();

  const names = $derived(titles(coop));
  const n = (v: number) => v.toLocaleString('ja-JP');
</script>

<section class="duo" aria-label="ふたりの活躍">
  <h3>ふたりの活躍</h3>
  <div class="cols">
    {#each coop.heroes as h, i (`${h.animal}-${i}`)}
      <div class="col" class:me={i === coop.me} aria-current={i === coop.me ? 'true' : undefined}>
        <PixelIcon art={ANIMAL_ART[h.animal].forms[0].walk} size="min(10cqw, 6cqh, 56px)" />
        <b>{animal(h.animal).name}</b>
        {#if i === coop.me}<small>じぶん</small>{/if}
        <span>撃破 {n(h.kills)}</span>
        <span>ダメージ {n(h.damage)}</span>
        <span>起こした {h.raises}</span>
        {#each names[i] as t (t)}<em>{t}</em>{/each}
      </div>
    {/each}
  </div>
  <p>連携の技 {coop.links}・重い宝箱 {coop.carries}</p>
</section>

<style>
  .duo {
    display: grid;
    gap: 6px;
    padding: 8px;
    border: 3px solid #24151f;
    background: #fff3d6;
    color: #24151f;
  }

  h3,
  p {
    margin: 0;
    text-align: center;
    font-size: min(4cqw, 2.4cqh, 20px);
  }

  .cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .col {
    display: grid;
    justify-items: center;
    gap: 2px;
    font-size: min(3.6cqw, 2.2cqh, 18px);
  }

  .col.me b {
    color: #2a64c8;
  }

  em {
    padding: 0 6px;
    background: #ffd84a;
    font-style: normal;
    font-weight: 800;
  }
</style>
