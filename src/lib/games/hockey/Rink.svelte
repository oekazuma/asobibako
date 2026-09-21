<script lang="ts">
  import { GOAL_W } from './engine';

  let { flash }: { flash: number } = $props();
</script>

<!-- 陣地・センターライン・ゴールの口。どれも動かないので、ここは一度描いたら触らない -->
<div class="rink" style:--goal-w="{GOAL_W * 100}%" aria-hidden="true">
  <div class="zone p2"></div>
  <div class="zone p1"></div>
  <div class="center-line"></div>
  <div class="center-circle"></div>
  <div class="goal p2"></div>
  <div class="goal p1"></div>
  {#key flash}
    {#if flash > 0}<div class="flash"></div>{/if}
  {/key}
</div>

<style>
  .rink {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .zone {
    position: absolute;
    left: 0;
    right: 0;
    height: 50%;
  }

  /* 氷のような白いリンクに、各陣地の色をほんのり乗せる */
  .zone.p2 {
    top: 0;
    background: linear-gradient(to top, #fff, var(--p2-soft));
  }

  .zone.p1 {
    bottom: 0;
    background: linear-gradient(to bottom, #fff, var(--p1-soft));
  }

  .center-line {
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 5px;
    background: rgb(43 45 66 / 0.2);
    translate: 0 -50%;
  }

  .center-circle {
    position: absolute;
    top: 50%;
    left: 50%;
    height: 22%;
    aspect-ratio: 1;
    border: 5px solid rgb(43 45 66 / 0.14);
    border-radius: 50%;
    translate: -50% -50%;
  }

  .goal {
    position: absolute;
    left: 50%;
    width: var(--goal-w);
    height: 14px;
    translate: -50% 0;
  }

  .goal.p2 {
    top: 0;
    border-radius: 0 0 10px 10px;
    background: var(--p2);
    box-shadow: 0 0 18px var(--p2);
  }

  .goal.p1 {
    bottom: 0;
    border-radius: 10px 10px 0 0;
    background: var(--p1);
    box-shadow: 0 0 18px var(--p1);
  }

  .flash {
    position: absolute;
    inset: 0;
    background: var(--gold);
    animation: flash 450ms ease-out forwards;
  }

  @keyframes flash {
    from {
      opacity: 0.5;
    }
    to {
      opacity: 0;
    }
  }
</style>
