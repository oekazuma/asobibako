<script lang="ts">
  import { onMount } from 'svelte';
  import { itemArt } from './art/evolved';
  import { ITEM_ART } from './art/items';
  import { cardInfo } from './choice-view';
  import type { Reward } from './chest';
  import { PASSIVES } from './passives';
  import PixelIcon from './PixelIcon.svelte';
  import { sounds } from './sounds';
  import { WEAPONS } from './weapons';

  let { rewards, locked, onclose }: { rewards: Reward[]; locked: boolean; onclose: () => void } = $props();

  /** ふたが開いてから、上がったものを 1 つずつ見せる */
  let shown = $state(0);
  const done = $derived(shown >= rewards.length);

  function info(r: Reward) {
    if (r.kind === 'union')
      return {
        key: `u-${r.id}`,
        art: itemArt(`weapon-${r.id}`),
        name: WEAPONS[r.id].name,
        text: `${WEAPONS[r.parts[0]].name}＋${WEAPONS[r.parts[1]].name}の合体！`,
        evo: true
      };
    if (r.kind === 'evolve')
      return { key: `e-${r.id}`, art: itemArt(`weapon-${r.id}`), name: WEAPONS[r.id].name, text: '進化！', evo: true };
    if (r.kind === 'weapon')
      return {
        key: `w-${r.id}-${r.level}`,
        art: itemArt(`weapon-${r.id}`),
        name: WEAPONS[r.id].name,
        text: `Lv ${r.level}`,
        evo: false
      };
    if (r.kind === 'passive')
      return {
        key: `p-${r.id}-${r.level}`,
        art: itemArt(`passive-${r.id}`),
        name: PASSIVES[r.id].name,
        text: `Lv ${r.level}`,
        evo: false
      };
    const d = cardInfo(r);
    return {
      key: r.kind === 'limit' ? `l-${r.id}-${r.stat}` : r.kind,
      art: d.art,
      name: d.name,
      text: d.text,
      evo: false
    };
  }

  function key(event: KeyboardEvent) {
    if (!done || locked || (event.key !== 'Enter' && event.key !== '1')) return;
    event.preventDefault();
    onclose();
  }

  onMount(() => {
    let id: ReturnType<typeof setTimeout>;
    // 進化とまとめの出来事は宝箱を開けた step の外で起きて効果の側に届かないので、見せたときにここで鳴らす
    const tick = () => {
      shown += 1;
      const k = rewards[shown - 1]?.kind;
      if (k === 'evolve' || k === 'union') sounds.evolve();
      if (shown < rewards.length) id = setTimeout(tick, 250);
    };
    id = setTimeout(tick, 600);
    return () => clearTimeout(id);
  });
</script>

<svelte:window onkeydown={key} />

<div class="veil">
  <section class="as-panel" class:as-locked={locked} aria-label="宝箱">
    <h2 class="as-title">TREASURE!</h2>
    <div class="chest" class:open={shown > 0}><PixelIcon art={ITEM_ART.chest} size="min(18cqw, 11cqh, 96px)" /></div>
    <ul>
      {#each rewards.slice(0, shown) as r, i (info(r).key + i)}
        {@const d = info(r)}
        <li class:evo={d.evo}>
          <PixelIcon art={d.art} size="min(8cqw, 4.8cqh, 44px)" /><b>{d.name}</b><span>{d.text}</span>
        </li>
      {/each}
    </ul>
    {#if done}
      <button class="as-card ok" onclick={onclose}>OK</button>
    {/if}
  </section>
</div>

<style>
  .veil {
    position: absolute;
    inset: 0;
    z-index: 4;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgb(20 10 30 / 0.6);
  }

  .chest {
    justify-self: center;
    animation: shake 120ms steps(2) 4;
  }

  .chest.open {
    animation: none;
    filter: drop-shadow(0 0 12px #ffd84a);
  }

  ul {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 6px 12px;
    background: #fff3d6;
    border: 3px solid #24151f;
    color: #24151f;
    font-size: min(4.4cqw, 2.6cqh, 22px);
    animation: pop 220ms steps(3);
  }

  li span {
    margin-left: auto;
    color: #2a64c8;
  }

  li.evo {
    border-color: #ffd84a;
    background: #3a2a14;
    color: #ffd84a;
  }

  li.evo span {
    color: #fff3d6;
  }

  .ok {
    justify-content: center;
    font-size: min(5cqw, 3cqh, 26px);
  }

  @keyframes shake {
    50% {
      translate: 4px 0;
    }
  }

  @keyframes pop {
    from {
      scale: 0.6;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .chest,
    li {
      animation: none;
    }
  }
</style>
