<script lang="ts">
  import ArcanaRow from './ArcanaRow.svelte';
  import { TICKET_NAME } from './gacha';
  import GearRow from './GearRow.svelte';
  import type { RunSummary } from './world';

  /** リザルトの札・装備・ガチャ券の列 */
  let { run }: { run: RunSummary } = $props();

  const list = (t?: number[]) => (t ?? []).flatMap((n, i) => (n > 0 ? [`${TICKET_NAME[i]} ×${n}`] : []));
  const kept = $derived(list(run.tickets));
  const lost = $derived(list(run.lost));
</script>

<ArcanaRow cards={run.arcana ?? []} />
<GearRow keys={run.gear ?? []} />
{#if kept.length}<p class="tickets" data-kept>持ち帰った券 {kept.join('・')}</p>{/if}
{#if lost.length}<p class="tickets lost" data-lost>持ち帰れなかった券 <s>{lost.join('・')}</s></p>{/if}

<style>
  .tickets {
    margin: 0;
    color: #ffd84a;
    font-size: min(3.2cqw, 1.9cqh, 16px);
    text-align: center;
  }

  .lost {
    color: #9aa0ae;
  }
</style>
