<script lang="ts">
  import { onMount } from 'svelte';
  import { ANIMALS, type AnimalId } from './animals';
  import { ANIMAL_ART } from './art/animals';
  import { ITEM_ART } from './art/items';
  import PixelIcon from './PixelIcon.svelte';
  import { WEAPONS } from './weapons';

  let { onpick }: { onpick: (id: AnimalId) => void } = $props();

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
  <section class="as-panel" aria-label="キャラクター選択">
    <h2 class="as-title">キャラクターを選ぶ</h2>
    {#each ANIMALS as a (a.id)}
      {@const weapon = WEAPONS[a.weapon]}
      <button class="as-card" data-animal={a.id} onclick={() => onpick(a.id)}>
        <PixelIcon art={ANIMAL_ART[a.id].walk} frame={tick % 4} size="min(20cqw, 12cqh, 112px)" />
        <span class="body">
          <span class="name">{a.name}<span class="style">{a.style}</span></span>
          {#each [['HP', a.hp / top.hp], ['速さ', a.speed / top.speed], ['攻撃', a.might / top.might]] as const as [label, ratio] (label)}
            <span class="stat"><span class="label">{label}</span><span class="bar" style:--r={ratio}></span></span>
          {/each}
          <span class="weapon">
            <PixelIcon art={ITEM_ART[`weapon-${a.weapon}`]} size="min(6cqw, 3.6cqh, 32px)" />
            <span><b>{weapon.name}</b><br />{weapon.blurb}</span>
          </span>
        </span>
      </button>
    {/each}
  </section>
</div>

<style>
  .body {
    display: grid;
    flex: 1;
    gap: 5px;
  }

  .name {
    display: flex;
    gap: 10px;
    align-items: baseline;
    font-size: min(6cqw, 3.4cqh, 30px);
  }

  .style {
    color: #a3501c;
    font-size: 0.55em;
  }

  .stat {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: min(3.2cqw, 1.9cqh, 16px);
  }

  .label {
    width: 3.2em;
  }

  .bar {
    flex: 1;
    height: 0.7em;
    border: 2px solid #24151f;
    background: linear-gradient(90deg, #d8463c calc(var(--r) * 100%), #5d3a2a 0);
  }

  .weapon {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 2px;
    color: #5d3a2a;
    font-size: min(3.2cqw, 1.9cqh, 16px);
    font-weight: 700;
  }

  .weapon b {
    color: #24151f;
  }
</style>
