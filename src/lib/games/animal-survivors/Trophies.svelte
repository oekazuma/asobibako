<script lang="ts">
  import Back from './Back.svelte';
  import { ACHIEVEMENTS } from './achievements';
  import { ANIMAL_ART } from './art/animals';
  import PixelIcon from './PixelIcon.svelte';
  import { TROPHY_GROUPS } from './trophy-groups';
  import Evolutions from './Evolutions.svelte';
  import { loadRecords } from './records';

  let { onback }: { onback: () => void } = $props();

  const r = loadRecords();
  const done = ACHIEVEMENTS.filter((a) => r.achieved.includes(a.id)).length;
  const n = (v: number) => Math.floor(v).toLocaleString('ja-JP');
  const groups = TROPHY_GROUPS.map(([title, ids]) => [title, ACHIEVEMENTS.filter((a) => ids.includes(a.id))] as const);
</script>

<div class="as-screen">
  <section class="as-panel" aria-label="実績">
    <h2 class="as-title">実績</h2>
    <p class="count">{done} / {ACHIEVEMENTS.length} 達成</p>
    {#each groups as [title, list] (title)}
      <h3 class="group">
        {title} <span class="tally">{list.filter((a) => r.achieved.includes(a.id)).length} / {list.length}</span>
      </h3>
      <ul>
        {#each list as a (a.id)}
          {@const got = r.achieved.includes(a.id)}
          {@const p = a.progress?.(r)}
          <li class:got>
            <span class="mark">{got ? '✓' : ''}</span>
            <span class="name">{a.name}</span>
            <span class="reward"
              >+{a.coins}{#if a.animal}<span
                  class="face"
                  class:shadow={!r.unlocked.includes(a.animal)}
                  data-reward={a.animal}><PixelIcon art={ANIMAL_ART[a.animal].forms[0].walk} size="1.6em" /></span
                >{/if}</span
            >
            {#if p && !got}<span class="progress">{n(Math.min(p[0], p[1]))} / {n(p[1])}</span>{/if}
          </li>
        {/each}
      </ul>
    {/each}
    <Evolutions evolved={r.evolved} />
  </section>
</div>
<Back {onback} />

<style>
  .count {
    margin: 0;
    text-align: center;
    color: #ffd84a;
    font-size: min(5cqw, 3cqh, 26px);
  }

  .group {
    margin: 6px 0 0;
    color: #ffd84a;
    font-size: min(4.2cqw, 2.5cqh, 22px);
  }

  .tally {
    color: #bcc4ce;
    font-size: 0.7em;
  }

  ul {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    grid-template-columns: 1.4em 1fr auto;
    gap: 2px 8px;
    align-items: center;
    padding: 6px 10px;
    background: #1f1530;
    color: #8a7aa8;
    font-size: min(3.6cqw, 2.1cqh, 18px);
  }

  li.got {
    background: #3a2a14;
    color: #fff3d6;
  }

  .mark {
    color: #8fd14f;
  }

  .reward {
    display: flex;
    gap: 6px;
    align-items: center;
    color: #ffd84a;
  }

  .face {
    display: flex;
  }

  /* まだ仲間でない子は影で見せる。暗い地でも見えるよう灰色にする */
  .shadow {
    filter: brightness(0) invert(0.45);
  }

  .progress {
    grid-column: 2 / -1;
    font-size: 0.85em;
  }
</style>
