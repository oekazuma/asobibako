<script lang="ts">
  import type { Entry } from './entry.svelte';
  import Keypad from './Keypad.svelte';
  import Word from './Word.svelte';

  /** 図の下の、答えの入力と いまの様子 */
  let { entry }: { entry: Entry } = $props();

  const p = $derived(entry.p);
  const CAPTION = { river: '乗せるものを選んで「渡る」', pour: '入れものを2つ順に押すと注げます' };
</script>

<div class="answer">
  {#if p.kind === 'number'}
    <Keypad unit={p.unit} bind:digits={entry.digits} />
  {:else if p.kind === 'word'}
    <Word tiles={p.tiles} bind:picked={entry.picked} />
  {:else if p.kind === 'tap'}
    <p class="count">選んだ数 {entry.picked.length} / {p.answer.length}</p>
  {:else if p.kind === 'sticks'}
    <p class="count">
      残り {entry.left} 回
      <button class="pill" onclick={() => entry.reset()}>元に戻す</button>
    </p>
  {:else if p.kind === 'lines'}
    <p class="count">
      残り {entry.left} 本
      <button class="pill" disabled={!entry.path.length} onclick={() => entry.undo()}>1 本戻す</button>
      <button class="pill" disabled={!entry.path.length} onclick={() => entry.reset()}>元に戻す</button>
    </p>
  {:else if p.kind === 'place' || p.kind === 'slide' || p.kind === 'ice'}
    <p class="count">
      {p.kind === 'place' ? `置いた数 ${entry.picked.length} / ${p.count}` : `手数 ${entry.moves}`}
      <button class="pill" disabled={!entry.picked.length && !entry.moves} onclick={() => entry.reset()}
        >元に戻す</button
      >
    </p>
  {:else}
    <p class="count">{CAPTION[p.kind]}</p>
  {/if}
</div>

<style>
  .answer {
    grid-area: answer;
    align-self: center;
  }

  .count {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 10px 16px;
    margin: 0;
    font-size: clamp(14px, min(2.2cqh, 4cqw), 22px);
    font-weight: 800;
  }

  .pill {
    padding: 8px clamp(12px, 2cqw, 22px);
  }

  .pill:disabled {
    opacity: 0.45;
  }
</style>
