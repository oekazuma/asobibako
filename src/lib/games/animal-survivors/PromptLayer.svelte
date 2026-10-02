<script lang="ts">
  import BossWarning from './BossWarning.svelte';
  import ChestOpen from './ChestOpen.svelte';
  import LevelUp from './LevelUp.svelte';
  import type { Prompts } from './prompts.svelte';

  /** finger は画面に残っている移動の指（出た直後の合成 click を捨てるため） */
  let { prompts, finger }: { prompts: Prompts; finger: number | null } = $props();
</script>

{#if prompts.warning}
  {#key prompts.warning.key}
    <BossWarning name={prompts.warning.name} />
  {/key}
{/if}
{#if prompts.rewards}
  <!-- 宝箱を続けて開けたときに、見せた数を最初から数え直す -->
  {#key prompts.rewards}
    <ChestOpen rewards={prompts.rewards} locked={prompts.lock.active} onclose={() => prompts.close(finger)} />
  {/key}
{:else if prompts.options}
  <LevelUp
    options={prompts.options}
    locked={prompts.lock.active}
    rerolls={prompts.rerolls}
    onpick={(c) => prompts.choose(c, finger)}
    onreroll={() => prompts.reroll(finger)}
  />
{/if}
