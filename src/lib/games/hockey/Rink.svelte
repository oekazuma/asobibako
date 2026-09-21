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

  .zone.p2 {
    top: 0;
    background: var(--zone-2);
  }

  .zone.p1 {
    bottom: 0;
    background: var(--zone-1);
  }

  .center-line {
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 3px;
    background: rgb(255 255 255 / 0.8);
    translate: 0 -50%;
  }

  .center-circle {
    position: absolute;
    top: 50%;
    left: 50%;
    height: 22%;
    aspect-ratio: 1;
    border: 3px solid rgb(255 255 255 / 0.5);
    border-radius: 50%;
    translate: -50% -50%;
  }

  .goal {
    position: absolute;
    left: 50%;
    width: var(--goal-w);
    height: 10px;
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
    background: #fff;
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
