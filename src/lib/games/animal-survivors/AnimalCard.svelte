<script lang="ts">
  import { ANIMALS, type Animal } from './animals';
  import { ANIMAL_ART } from './art/animals';
  import { ITEM_ART } from './art/items';
  import PixelIcon from './PixelIcon.svelte';
  import { heatLabel } from './cauldron';
  import { clock } from './hud';
  import type { AnimalBest } from './records';
  import { WEAPONS } from './weapons';

  let {
    a,
    open,
    tick,
    best,
    cleared,
    onstart
  }: { a: Animal; open: boolean; tick: number; best?: AnimalBest; cleared: boolean; onstart: () => void } = $props();

  const mark = $derived(
    [
      cleared ? (best?.heat !== undefined ? `クリア 釜 ${heatLabel(best.heat)}` : 'クリア済み') : '',
      best ? `最長 ${clock(best.time)}` : ''
    ]
      .filter(Boolean)
      .join('・') || 'まだ遊んでいない'
  );

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
  <!-- 子を選び替えるたびに下のボタンが動かないよう、どの子でも同じ行を並べて高さをそろえる -->
  <span class="body">
    <span class="name"
      >{open ? a.name : '？？？'}{#if open}<span class="style">{a.style}</span>{/if}<span class="tier"
        >{'★'.repeat(a.tier)}</span
      ></span
    >
    <span class="info" class:hide={!open}>
      {#each [['HP', a.hp / top.hp], ['速さ', a.speed / top.speed], ['攻撃', a.might / top.might]] as const as [label, ratio] (label)}
        <span class="stat"><span class="label">{label}</span><span class="bar" style:--r={ratio}></span></span>
      {/each}
      <span class="weapon">
        <PixelIcon art={ITEM_ART[`weapon-${a.weapon}`]} size="min(5cqw, 3cqh, 26px)" />
        <b>{WEAPONS[a.weapon].name}</b>
      </span>
      <span class="perk">{a.perk ? `とくい: ${a.perk}` : ''}</span>
      <span class="record">{mark}</span>
    </span>
    {#if !open}<span class="unlock">{a.unlock}</span>{/if}
  </span>
</div>
<button class="as-card as-go go" data-go disabled={!open} onclick={onstart}>この子で出発</button>

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
    position: relative;
    display: grid;
    flex: 1;
    gap: 4px;
  }

  .info {
    display: grid;
    gap: 4px;
  }

  .hide {
    visibility: hidden;
  }

  .unlock {
    position: absolute;
    inset: auto 0;
    top: 50%;
    translate: 0 -50%;
  }

  .name {
    display: flex;
    gap: 10px;
    align-items: baseline;
    font-size: min(5cqw, 3cqh, 28px);
    white-space: nowrap;
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
  .record,
  .unlock {
    display: flex;
    gap: 6px;
    align-items: center;
    color: #5d3a2a;
    font-size: min(2.9cqw, 1.7cqh, 15px);
    font-weight: 700;
  }

  /* 折り返すと子ごとに札の高さが変わるので 1 行に収める */
  .record {
    color: #a3501c;
    white-space: nowrap;
  }

  .weapon b {
    color: #24151f;
  }

  /* いちばん長いとくいでも細い画面で 2 行に収まるので、2 行ぶんを空けておく */
  .perk {
    min-height: 2.6em;
    align-items: flex-start;
    color: #2a64c8;
    line-height: 1.3;
  }

  .go {
    justify-content: center;
    padding-block: min(2cqh, 16px);
    font-size: min(6cqw, 3.4cqh, 30px);
  }

  .go:disabled {
    opacity: 0.45;
    cursor: default;
  }
</style>
