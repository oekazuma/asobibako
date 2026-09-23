<script lang="ts">
  import type { Entry } from './entry.svelte';
  import Figure from './Figure.svelte';
  import Ice from './Ice.svelte';
  import Lines from './Lines.svelte';
  import Place from './Place.svelte';
  import Memo from './Memo.svelte';
  import Pour from './Pour.svelte';
  import River from './River.svelte';
  import Slide from './Slide.svelte';
  import Sticks from './Sticks.svelte';
  import Tap from './Tap.svelte';

  let {
    entry,
    memo,
    onwarn,
    onsolve,
    onfail
  }: {
    entry: Entry;
    memo: boolean;
    onwarn: (text: string) => void;
    onsolve: () => void;
    onfail: (why: string) => void;
  } = $props();

  const p = $derived(entry.p);
</script>

<!-- 図のない number と word は額ごと出さない -->
{#if p.fig || !(p.kind === 'number' || p.kind === 'word')}
  <div class="frame">
    <div class="inner">
      {#if p.kind === 'river'}
        <River {p} {onwarn} {onsolve} {onfail} />
      {:else if p.kind === 'pour'}
        <Pour {p} {onsolve} />
      {:else if p.kind === 'slide'}
        <Slide {p} bind:blocks={entry.blocks} bind:moves={entry.moves} {onsolve} />
      {:else if p.kind === 'ice'}
        <Ice {p} bind:at={entry.at} bind:moves={entry.moves} {onsolve} />
      {:else if p.kind === 'place'}
        <Place {p} bind:cells={entry.picked} />
      {:else if p.kind === 'lines'}
        <Lines {p} fig={p.fig} bind:path={entry.path} />
      {:else if p.kind === 'tap' && p.fig}
        <Tap fig={p.fig} spots={p.spots} max={p.answer.length} bind:picked={entry.picked} />
      {:else if p.kind === 'sticks' && p.fig}
        <Sticks
          {p}
          fig={p.fig}
          bind:on={entry.on}
          bind:lifted={entry.lifted}
          onblock={() => onwarn('これ以上は動かせない。元の場所へ戻せば数え直す')}
        />
      {:else if p.fig}
        <Figure fig={p.fig} />
      {/if}
    </div>
    <Memo active={memo} />
  </div>
{/if}

<style>
  /* 図の額。木の色のふちの内側に白い台紙 */
  .frame {
    grid-area: frame;
    position: relative;
    display: flex;
    min-height: 0;
    padding: 18px;
    border: 3px solid var(--line);
    border-radius: 22px;
    background: #fff;
    box-shadow:
      inset 0 0 0 9px #f3d6a8,
      inset 0 0 0 11px var(--line),
      var(--soft-shadow);
  }

  .inner {
    display: grid;
    flex: 1;
    place-items: center;
    container-type: size;
  }
</style>
