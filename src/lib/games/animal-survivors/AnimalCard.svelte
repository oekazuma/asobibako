<script lang="ts">
  import { ANIMALS, type Animal } from './animals';
  import { ANIMAL_ART } from './art/animals';
  import { ITEM_ART } from './art/items';
  import PixelIcon from './PixelIcon.svelte';
  import { WEAPONS } from './weapons';

  let { a, open, tick, onstart }: { a: Animal; open: boolean; tick: number; onstart: () => void } = $props();

  const top = {
    hp: Math.max(...ANIMALS.map((o) => o.hp)),
    speed: Math.max(...ANIMALS.map((o) => o.speed)),
    might: Math.max(...ANIMALS.map((o) => o.might))
  };
</script>

<div class="as-card detail" class:closed={!open}>
  <span class="face">
    <PixelIcon art={ANIMAL_ART[a.id].forms[0].walk} frame={open ? tick % 4 : 0} size="min(18cqw, 10cqh, 96px)" />
  </span>
  <span class="body">
    {#if open}
      <span class="name"
        >{a.name}<span class="style">{a.style}</span><span class="tier">{'★'.repeat(a.tier)}</span></span
      >
      {#each [['HP', a.hp / top.hp], ['速さ', a.speed / top.speed], ['攻撃', a.might / top.might]] as const as [label, ratio] (label)}
        <span class="stat"><span class="label">{label}</span><span class="bar" style:--r={ratio}></span></span>
      {/each}
      <span class="weapon">
        <PixelIcon art={ITEM_ART[`weapon-${a.weapon}`]} size="min(5cqw, 3cqh, 26px)" />
        <b>{WEAPONS[a.weapon].name}</b>
      </span>
      {#if a.perk}<span class="perk">とくい: {a.perk}</span>{/if}
    {:else}
      <span class="name">？？？<span class="tier">{'★'.repeat(a.tier)}</span></span>
      <span class="unlock">{a.unlock}</span>
    {/if}
  </span>
</div>
<button class="as-card go" data-go disabled={!open} onclick={onstart}>この子で出発</button>

<style>
  .detail {
    cursor: default;
    align-items: flex-start;
  }

  .closed {
    background: #d9cbb0;
  }

  /* 解放前は黒い影だけを見せる */
  .closed .face {
    filter: brightness(0);
    opacity: 0.55;
  }

  .face {
    display: flex;
    padding-top: 4px;
  }

  .body {
    display: grid;
    flex: 1;
    gap: 4px;
  }

  .name {
    display: flex;
    gap: 10px;
    align-items: baseline;
    font-size: min(5.4cqw, 3cqh, 28px);
  }

  .style {
    color: #a3501c;
    font-size: 0.55em;
  }

  .tier {
    margin-left: auto;
    color: #e09a1c;
    font-size: 0.6em;
    letter-spacing: -0.05em;
  }

  .stat {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: min(2.8cqw, 1.6cqh, 14px);
  }

  .label {
    width: 3.2em;
  }

  .bar {
    flex: 1;
    height: 0.6em;
    border: 2px solid #24151f;
    background: linear-gradient(90deg, #d8463c calc(var(--r) * 100%), #5d3a2a 0);
  }

  .weapon,
  .perk,
  .unlock {
    display: flex;
    gap: 6px;
    align-items: center;
    color: #5d3a2a;
    font-size: min(2.9cqw, 1.7cqh, 15px);
    font-weight: 700;
  }

  .weapon b {
    color: #24151f;
  }

  .perk {
    color: #2a64c8;
  }

  .go {
    justify-content: center;
    padding-block: min(2cqh, 16px);
    background: #ffd84a;
    font-size: min(6cqw, 3.4cqh, 30px);
  }

  .go:disabled {
    opacity: 0.45;
    cursor: default;
  }
</style>
