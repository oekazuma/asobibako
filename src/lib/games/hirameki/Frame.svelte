<script lang="ts" module>
  import type { Puzzle } from './types';

  /** 図のない number と word は額ごと出さない（メモを書く場所もない） */
  export const framed = (p: Puzzle) => !!p.fig || !(p.kind === 'number' || p.kind === 'word');
</script>

<script lang="ts">
  import type { Entry } from './entry.svelte';
  import Connect from './Connect.svelte';
  import Divide from './Divide.svelte';
  import Figure from './Figure.svelte';
  import Fill from './Fill.svelte';
  import Ice from './Ice.svelte';
  import Lines from './Lines.svelte';
  import Place from './Place.svelte';
  import Memo from './Memo.svelte';
  import Pour from './Pour.svelte';
  import River from './River.svelte';
  import Rotate from './Rotate.svelte';
  import Slide from './Slide.svelte';
  import Sticks from './Sticks.svelte';
  import Tap from './Tap.svelte';

  let {
    entry,
    attempt,
    memo,
    onwarn,
    onsolve,
    onfail
  }: {
    entry: Entry;
    /** 変わるたびに答えの部品を作り直す（川渡りなどの途中の状態も最初に戻す）。メモは作り直さない */
    attempt: number;
    memo: boolean;
    onwarn: (text: string) => void;
    onsolve: () => void;
    onfail: (why: string) => void;
  } = $props();

  const p = $derived(entry.p);
</script>

{#if framed(p)}
  <div class="frame">
    <div class="inner">
      {#key attempt}
        {#if p.kind === 'river'}
          <River {p} {onwarn} {onsolve} {onfail} />
        {:else if p.kind === 'pour'}
          <Pour {p} {onsolve} />
        {:else if p.kind === 'slide'}
          <Slide {p} bind:blocks={entry.blocks} bind:moves={entry.moves} {onsolve} />
        {:else if p.kind === 'connect'}
          <Connect {p} bind:paths={entry.paths} {onsolve} />
        {:else if p.kind === 'divide'}
          <Divide {p} bind:groups={entry.grid} />
        {:else if p.kind === 'rotate'}
          <Rotate {p} bind:turns={entry.grid} bind:moves={entry.moves} {onsolve} />
        {:else if p.kind === 'fill' && p.fig}
          <Fill {p} fig={p.fig} bind:values={entry.grid} />
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
      {/key}
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
