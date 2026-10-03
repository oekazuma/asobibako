<script lang="ts">
  import { onMount } from 'svelte';
  import { audio, toggleMute } from '$lib/audio.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { ACHIEVEMENTS } from './achievements';
  import { ANIMALS, type AnimalId } from './animals';
  import { ANIMAL_ART } from './art/animals';
  import { ITEM_ART } from './art/items';
  import PixelIcon from './PixelIcon.svelte';
  import type { Records } from './records';
  import { WEAPONS } from './weapons';

  let {
    records,
    onpick,
    onquit,
    onshop,
    ontrophies
  }: {
    records: Records;
    onpick: (id: AnimalId) => void;
    onquit: () => void;
    onshop: () => void;
    ontrophies: () => void;
  } = $props();

  const top = {
    hp: Math.max(...ANIMALS.map((a) => a.hp)),
    speed: Math.max(...ANIMALS.map((a) => a.speed)),
    might: Math.max(...ANIMALS.map((a) => a.might))
  };
  let tick = $state(0);

  onMount(() => {
    const id = setInterval(() => (tick += 1), 110);
    return () => clearInterval(id);
  });
</script>

<div class="as-screen">
  <button class="round corner back" onclick={onquit} aria-label="タイトルへ戻る">✕</button>
  <button class="round corner mute" onclick={toggleMute} aria-label="ミュート" aria-pressed={audio.muted}>
    <Icon name={audio.muted ? 'mute' : 'speaker'} size="26px" />
  </button>
  <section class="as-panel" aria-label="キャラクター選択">
    <h2 class="as-title">キャラクターを選ぶ</h2>
    {#each ANIMALS as a (a.id)}
      {@const open = records.unlocked.includes(a.id)}
      {@const weapon = WEAPONS[a.weapon]}
      <button class="as-card" class:closed={!open} data-animal={a.id} disabled={!open} onclick={() => onpick(a.id)}>
        <span class="face"
          ><PixelIcon
            art={ANIMAL_ART[a.id].forms[0].walk}
            frame={open ? tick % 4 : 0}
            size="min(14cqw, 8cqh, 80px)"
          /></span
        >
        <span class="body">
          {#if open}
            <span class="name"
              >{a.name}<span class="style">{a.style}</span><span class="tier" aria-label="強さの段 {a.tier}"
                >{'★'.repeat(a.tier)}</span
              ></span
            >
            {#each [['HP', a.hp / top.hp], ['速さ', a.speed / top.speed], ['攻撃', a.might / top.might]] as const as [label, ratio] (label)}
              <span class="stat"><span class="label">{label}</span><span class="bar" style:--r={ratio}></span></span>
            {/each}
            <span class="weapon">
              <PixelIcon art={ITEM_ART[`weapon-${a.weapon}`]} size="min(5cqw, 3cqh, 26px)" />
              <b>{weapon.name}</b>
            </span>
            {#if a.perk}<span class="perk">とくい: {a.perk}</span>{/if}
          {:else}
            <span class="name"
              >？？？<span class="tier" aria-label="強さの段 {a.tier}">{'★'.repeat(a.tier)}</span></span
            >
            <span class="unlock">{a.unlock}</span>
          {/if}
        </span>
      </button>
    {/each}
    <div class="links">
      <button class="as-card link" onclick={onshop}>
        <PixelIcon art={ITEM_ART.coin} size="min(5cqw, 3cqh, 26px)" />パワーアップ（{records.coins.toLocaleString(
          'ja-JP'
        )}）
      </button>
      <button class="as-card link" onclick={ontrophies}>実績 {records.achieved.length} / {ACHIEVEMENTS.length}</button>
    </div>
  </section>
</div>

<style>
  .corner {
    position: absolute;
    top: max(12px, env(safe-area-inset-top));
    z-index: 5;
  }

  .back {
    left: max(12px, env(safe-area-inset-left));
  }

  .mute {
    right: max(12px, env(safe-area-inset-right));
  }

  .as-card {
    padding-block: min(1cqh, 8px);
  }

  .links {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .link {
    justify-content: center;
    font-size: min(3.8cqw, 2.2cqh, 19px);
  }

  .closed {
    cursor: default;
    background: #d9cbb0;
  }

  /* 解放前は黒い影だけを見せる */
  .closed .face {
    filter: brightness(0);
    opacity: 0.55;
  }

  .face {
    display: flex;
  }

  .body {
    display: grid;
    flex: 1;
    gap: 3px;
  }

  .name {
    display: flex;
    gap: 10px;
    align-items: baseline;
    font-size: min(5cqw, 2.8cqh, 26px);
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
</style>
