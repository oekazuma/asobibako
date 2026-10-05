<script lang="ts">
  import type { AchievementDef } from './achievements';
  import { animal } from './animals';
  import { arcanaOf } from './arcana';
  import { ANIMAL_ART } from './art/animals';
  import PixelIcon from './PixelIcon.svelte';

  /** 一度にいくつ取っても、帯を並べずに 1 つの枠にまとめる（並べるとリザルトのボタンが画面の外へ押し出される） */
  let { list }: { list: AchievementDef[] } = $props();
</script>

{#each list as a (a.id)}
  {#if a.animal}
    <p class="new">
      <PixelIcon art={ANIMAL_ART[a.animal].forms[0].walk} size="min(10cqw, 6cqh, 56px)" /><span
        ><b>NEW!</b> {animal(a.animal).name}が仲間になった</span
      >
    </p>
  {/if}
{/each}
{#if list.length}
  <section class="trophy" aria-label="達成した実績">
    <b class="head">実績達成 {list.length}</b>
    <ul>
      {#each list as a (a.id)}
        <li>
          <span>{a.name}</span><span class="coins">+{a.coins}</span>
          {#if arcanaOf(a.id)}<span class="coins card">NEW! {arcanaOf(a.id)?.name}の札</span>{/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .trophy {
    display: grid;
    gap: 4px;
    padding: 8px 12px;
    border: 3px solid #ffd84a;
    background: #3a2a14;
    color: #fff3d6;
    font-size: min(3.6cqw, 2.1cqh, 18px);
    animation: pop 360ms steps(4);
  }

  .new {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 6px 12px;
    border: 3px solid #ffd84a;
    background: #3a2a14;
    color: #fff3d6;
    font-size: min(4.2cqw, 2.5cqh, 22px);
    animation: pop 360ms steps(4);
  }

  .new b {
    color: #ffd84a;
  }

  .head {
    color: #ffd84a;
    text-align: center;
  }

  ul {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    flex-wrap: wrap;
    gap: 0 0.8em;
  }

  .coins {
    margin-left: auto;
    color: #ffd84a;
  }

  .card {
    margin-left: 0;
  }

  @keyframes pop {
    from {
      scale: 0.5;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .trophy,
    .new {
      animation: none;
    }
  }
</style>
