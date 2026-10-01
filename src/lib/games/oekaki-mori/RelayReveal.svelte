<script lang="ts">
  import Board from './Board.svelte';
  import Face from './Face.svelte';
  import type { Entry } from './relay';
  import { UNKNOWN } from './relay';

  type Page = { chain: number; index: number; entry: Entry; last: boolean };
  let {
    pages,
    finished,
    host,
    looks = {},
    onnext,
    onagain,
    onsave
  }: {
    pages: Page[];
    finished: boolean;
    host: boolean;
    looks?: Record<number, string>;
    onnext: () => void;
    onagain: () => void;
    onsave: () => void;
  } = $props();

  const current = $derived(pages.at(-1));
  const shown = $derived(pages.filter((p) => p.chain === current?.chain));
  const first = $derived(shown.find((p) => p.index === 0)?.entry);
  const lastWord = $derived.by(() => {
    const e = current?.entry;
    return e?.kind === 'guess' ? (e.text ?? UNKNOWN) : '';
  });
  let end = $state<HTMLElement>();
  $effect(() => {
    void shown.length;
    end?.scrollIntoView?.({ block: 'end', behavior: 'smooth' });
  });
</script>

<div class="reveal">
  <h2 class="yuru">ふりかえり</h2>
  <ol class="pages">
    {#each shown as p (p.index)}
      <li>
        {#if p.entry.kind === 'draw'}
          <span class="who"><Face seat={p.entry.by} look={looks[p.entry.by]} name /> が かいた</span>
          <div class="thumb"><Board strokes={p.entry.strokes} /></div>
        {:else if p.entry.kind === 'guess'}
          <p class="text"><Face seat={p.entry.by} look={looks[p.entry.by]} name />「{p.entry.text ?? UNKNOWN}」</p>
        {:else}
          <p class="text">{p.index === 0 ? 'さいしょの おだい' : 'あたらしい おだい'}「{p.entry.text}」</p>
        {/if}
      </li>
    {/each}
  </ol>
  {#if current?.last && first?.kind === 'prompt'}
    <p class="punch">さいしょは「{first.text}」→ さいごは「{lastWord}」</p>
  {/if}
  <div bind:this={end} class="actions">
    {#if finished}
      <button class="pill" onclick={onsave}>しゃしんに ほぞん</button>
      {#if host}<button class="pill gold" onclick={onagain}>あそびを えらぶ</button>{/if}
    {:else if host}
      <button class="pill gold" onclick={onnext}>つぎ</button>
    {:else}
      <p role="status">おやが めくるのを まってね</p>
    {/if}
  </div>
</div>

<style>
  .reveal {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: max(68px, env(safe-area-inset-top)) 16px 16px;
    overflow-y: auto;
    touch-action: pan-y;
    background: var(--paper-dots), var(--paper);
    color: var(--line);
    font-weight: 800;
  }

  .pages {
    display: grid;
    gap: 12px;
    justify-items: center;
    list-style: none;
  }

  .thumb {
    width: min(70cqw, 360px);
    aspect-ratio: 1;
    container-type: size;
  }

  .who,
  .text {
    font-size: clamp(16px, 2.6cqh, 22px);
  }

  .punch {
    padding: 8px 20px;
    border: 3px solid var(--line);
    border-radius: 999px;
    background: var(--pastel-gold);
    font-size: clamp(20px, 3.6cqh, 30px);
    text-align: center;
  }

  .actions {
    display: grid;
    gap: 8px;
    justify-items: center;
  }
</style>
