<script lang="ts">
  import { onMount } from 'svelte';
  import { audio, toggleMute } from '$lib/audio.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { animal, ANIMALS, type AnimalId } from './animals';
  import { ANIMAL_ART } from './art/animals';
  import DailyCard from './DailyCard.svelte';
  import PixelIcon from './PixelIcon.svelte';
  import AnimalCard from './AnimalCard.svelte';
  import { heatLabel } from './cauldron';
  import MenuLinks from './MenuLinks.svelte';
  import { canPlay, type Records } from './records';
  import { stageOf } from './stages';

  let {
    records,
    onpick,
    onrepeat,
    onquit,
    onopen
  }: {
    records: Records;
    onpick: (id: AnimalId) => void;
    /** 前回と同じ動物・ステージ・釜の強さで始める */
    onrepeat: () => void;
    onquit: () => void;
    onopen: (screen: 'daily' | 'gacha' | 'shop' | 'trophies' | 'book' | 'gear') => void;
  } = $props();

  // 記録はあとから読み直して届くので、押すまでは今の記録の「最後に遊んだ子」を選んでいることにする
  let touched = $state<AnimalId | null>(null);
  const chosen = $derived(
    touched ?? (records.unlocked.includes(records.animal) ? records.animal : (records.unlocked[0] ?? 'dog'))
  );
  const picked = $derived(ANIMALS.find((a) => a.id === chosen)!);
  const last = $derived(
    records.best > 0 && records.unlocked.includes(records.animal) && canPlay(records, records.stage)
      ? `${animal(records.animal).name}・${stageOf(records.stage).name}・釜 ${heatLabel(records.heatLast)}`
      : null
  );
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
    {#if records.daily}<DailyCard daily={records.daily} onopen={() => onopen('daily')} />{/if}
    <div class="tiles" role="listbox" aria-label="動物">
      {#each ANIMALS as a (a.id)}
        {@const open = records.unlocked.includes(a.id)}
        <button
          class="as-card tile"
          class:closed={!open}
          class:on={chosen === a.id}
          role="option"
          aria-selected={chosen === a.id}
          aria-label={open ? a.name : '？？？'}
          data-animal={a.id}
          onclick={() => (touched = a.id)}
        >
          <span class="face"
            ><PixelIcon
              art={ANIMAL_ART[a.id].forms[0].walk}
              frame={open && chosen === a.id ? tick % 4 : 0}
              size="min(11cqw, 6.4cqh, 60px)"
            /></span
          >
          <span class="tier">{'★'.repeat(a.tier)}</span>
        </button>
      {/each}
    </div>
    {#if last}<button class="as-card again" data-again onclick={onrepeat}
        >前回と同じではじめる<small>{last}</small></button
      >{/if}
    <AnimalCard a={picked} open={records.unlocked.includes(picked.id)} {tick} onstart={() => onpick(picked.id)} />
    <MenuLinks {records} {onopen} />
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

  .again {
    flex-direction: column;
    gap: 2px;
    justify-content: center;
    background: #ffd84a;
    font-size: min(4.4cqw, 2.5cqh, 22px);
  }

  .again small {
    color: #5d3a2a;
    font-size: 0.7em;
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: min(1.6cqw, 10px);
  }

  .tile {
    flex-direction: column;
    gap: 2px;
    justify-content: center;
    padding: min(1cqh, 8px) 0;
  }

  .tile.on {
    background: #ffe28a;
    box-shadow:
      inset 0 0 0 3px #ffd84a,
      0 4px 0 #8a6a4a;
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
  }

  .tier {
    color: #e09a1c;
    font-size: min(2.6cqw, 1.5cqh, 13px);
    letter-spacing: -0.05em;
  }
</style>
