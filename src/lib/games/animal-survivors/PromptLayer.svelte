<script lang="ts">
  import BossWarning from './BossWarning.svelte';
  import ChestOpen from './ChestOpen.svelte';
  import LevelUp from './LevelUp.svelte';
  import OvertimeAsk from './OvertimeAsk.svelte';
  import type { Prompts } from './prompts.svelte';

  /** finger は画面に残っている移動の指（出た直後の合成 click を捨てるため）。onanswer は延長戦へ進むか */
  let { prompts, finger, onanswer }: { prompts: Prompts; finger: number | null; onanswer: (go: boolean) => void } =
    $props();
</script>

{#if prompts.notice}
  {#key prompts.notice.key}
    <p class="notice" role="status">{prompts.notice.text}</p>
  {/key}
{/if}
{#if prompts.warning}
  {#key prompts.warning.key}
    <BossWarning name={prompts.warning.name} />
  {/key}
{/if}
{#if prompts.asking}
  <OvertimeAsk
    locked={prompts.lock.active}
    onanswer={(go) => {
      prompts.answered();
      onanswer(go);
    }}
  />
{:else if prompts.rewards}
  <!-- 宝箱を続けて開けたときに、見せた数を最初から数え直す -->
  {#key prompts.rewards}
    <ChestOpen rewards={prompts.rewards} locked={prompts.lock.active} onclose={() => prompts.close(finger)} />
  {/key}
{:else if prompts.options}
  <!-- 札が替わるたびに作り直し、除外を選んでいる途中の状態を次のレベルアップへ持ち越さない -->
  {#key prompts.options}
    <LevelUp
      options={prompts.options}
      locked={prompts.lock.active}
      tools={prompts.tools}
      onpick={(c) => prompts.choose(c, finger)}
      ontool={(t) => (t === 'reroll' ? prompts.reroll(finger) : prompts.skip(finger))}
      onbanish={(c) => prompts.banish(c, finger)}
    />
  {/key}
{/if}

<style>
  .notice {
    position: absolute;
    top: 20%;
    left: 50%;
    z-index: 3;
    margin: 0;
    padding: 4px 16px;
    border: 3px solid #24151f;
    background: #ffd84a;
    color: #24151f;
    font-weight: 900;
    font-size: min(4.6cqw, 2.8cqh, 24px);
    white-space: nowrap;
    translate: -50% 0;
    pointer-events: none;
    animation: slide 300ms steps(3);
  }

  @keyframes slide {
    from {
      translate: -50% -40px;
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .notice {
      animation: none;
    }
  }
</style>
