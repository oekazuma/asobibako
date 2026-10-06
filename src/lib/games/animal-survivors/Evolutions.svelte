<script lang="ts">
  import { ANIMALS } from './animals';
  import { itemArt } from './art/evolved';
  import { EVOLUTIONS } from './evolutions';
  import { PASSIVES } from './passives';
  import { UNIONS } from './unions';
  import PixelIcon from './PixelIcon.svelte';
  import { WEAPONS } from './weapons';

  let { evolved }: { evolved: string[] } = $props();
  const size = 'min(7cqw, 4cqh, 36px)';
</script>

<h3 class="head">進化 {EVOLUTIONS.filter((e) => evolved.includes(e.to)).length} / {EVOLUTIONS.length}</h3>
<ul class="pairs">
  {#each EVOLUTIONS as e (e.to)}
    {@const got = evolved.includes(e.to)}
    <li class:got>
      <PixelIcon art={itemArt(`weapon-${e.from}`)} {size} />
      <span class="plus">+</span>
      <PixelIcon art={itemArt(`passive-${e.with}`)} {size} />
      <span class="plus">=</span>
      <span class:hidden={!got}><PixelIcon art={itemArt(`weapon-${e.to}`)} {size} /></span>
      <span class="name"
        >{got ? WEAPONS[e.to].name : '？？？'}<small>{WEAPONS[e.from].name}・{PASSIVES[e.with].name}</small></span
      >
    </li>
  {/each}
</ul>
<h3 class="head">専用進化 {ANIMALS.filter((a) => evolved.includes(a.special)).length} / {ANIMALS.length}</h3>
<ul class="specials">
  {#each ANIMALS as a (a.id)}
    {@const got = evolved.includes(a.special)}
    <li class:got>
      <PixelIcon art={itemArt(`weapon-${a.weapon}`)} {size} />
      <span class="plus">=</span>
      <span class:hidden={!got}><PixelIcon art={itemArt(`weapon-${a.special}`)} {size} /></span>
      <span class="name">{got ? WEAPONS[a.special].name : '？？？'}<small>{a.forms[2]}</small></span>
    </li>
  {/each}
</ul>
<h3 class="head">合体 {UNIONS.filter((u) => evolved.includes(u.to)).length} / {UNIONS.length}</h3>
<ul class="unions">
  {#each UNIONS as u (u.to)}
    {@const got = evolved.includes(u.to)}
    <li class:got>
      <PixelIcon art={itemArt(`weapon-${u.parts[0]}`)} {size} />
      <span class="plus">+</span>
      <PixelIcon art={itemArt(`weapon-${u.parts[1]}`)} {size} />
      <span class="plus">=</span>
      <span class:hidden={!got}><PixelIcon art={itemArt(`weapon-${u.to}`)} {size} /></span>
      <span class="name"
        >{got ? WEAPONS[u.to].name : '？？？'}<small>{WEAPONS[u.parts[0]].name}・{WEAPONS[u.parts[1]].name}</small
        ></span
      >
    </li>
  {/each}
</ul>

<style>
  .head {
    margin: 0;
    text-align: center;
    color: #ffd84a;
    font-size: min(4.6cqw, 2.8cqh, 24px);
  }

  ul {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    gap: 6px;
    align-items: center;
    padding: 4px 8px;
    background: #1f1530;
    color: #8a7aa8;
    font-size: min(3.4cqw, 2cqh, 17px);
  }

  li.got {
    background: #3a2a14;
    color: #fff3d6;
  }

  .plus {
    color: #8a7aa8;
  }

  .hidden {
    display: flex;
    filter: brightness(0);
    opacity: 0.55;
  }

  .name {
    display: grid;
    margin-left: 4px;
  }

  small {
    font-size: 0.75em;
    color: #c9b8e8;
  }
</style>
