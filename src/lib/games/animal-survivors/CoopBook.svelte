<script lang="ts">
  import type { AnimalId } from './animals';
  import { ANIMAL_ART } from './art/animals';
  import { clock } from './hud';
  import PixelIcon from './PixelIcon.svelte';
  import type { CoopRecords } from './records';

  let { coop }: { coop: CoopRecords } = $props();

  /** 10 匹から 2 匹（同じ動物どうしも）の組み合わせの数 */
  const ALL = 55;
  const pairs = $derived(coop.pairs.map((p) => p.split('+') as [AnimalId, AnimalId]));
</script>

<section class="book" aria-label="ふたりの記録帳">
  <h3>ふたりの記録帳</h3>
  <p>
    あそんだ {coop.runs} 回・クリア {coop.clears} 回・最長 {clock(coop.best)}<br />起こした {coop.raises}・連携の技 {coop.links}・重い宝箱
    {coop.carries}
  </p>
  <p>組んだ相棒 {pairs.length} / {ALL}</p>
  <div class="pairs">
    {#each pairs as [a, b] (`${a}+${b}`)}
      <span class="pair" data-pair>
        <PixelIcon art={ANIMAL_ART[a].forms[0].walk} size="min(6cqw, 3.6cqh, 32px)" />
        <PixelIcon art={ANIMAL_ART[b].forms[0].walk} size="min(6cqw, 3.6cqh, 32px)" />
      </span>
    {/each}
  </div>
</section>

<style>
  .book {
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
    font-size: min(3.8cqw, 2.3cqh, 19px);
  }

  .pairs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
  }

  .pair {
    display: flex;
    padding: 2px;
    background: rgb(36 21 31 / 0.1);
  }
</style>
