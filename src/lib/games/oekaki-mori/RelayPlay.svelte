<script module lang="ts">
  import type { Task as T } from './relay';

  const WAIT: T = { kind: 'wait' };
</script>

<script lang="ts">
  import Board from './Board.svelte';
  import KanaPad from './KanaPad.svelte';
  import type { Seat } from '$lib/net/party.svelte';
  import type { Task } from './relay';
  import { apply, ERASER, PENS, SIZES, type Ink, type Stroke } from './strokes';
  import Tools from './Tools.svelte';

  let {
    task: given,
    view,
    me,
    onink,
    ondone,
    ontype
  }: {
    task: Task;
    view: { step: number; steps: number; left: number; done: Seat[] };
    me: Seat;
    onink: (ink: Ink) => void;
    ondone: (text?: string) => void;
    ontype: (text: string) => void;
  } = $props();

  /** できたを押した人は、次のだんの受け持ちが届くまで待つ。同じものを返して、毎秒の見え方で線が消えないようにする */
  const task = $derived(given.kind !== 'wait' && view.done.includes(me) ? WAIT : given);
  let strokes = $state.raw<Stroke[]>([]);
  let color = $state<string>(PENS[0].hex);
  let size = $state(1);
  let erasing = $state(false);
  const pen = $derived(task.kind === 'draw' ? (erasing ? ERASER : { color, size: SIZES[size] }) : null);

  function ink(i: Ink) {
    strokes = apply(strokes, i);
    onink(i);
  }

  // だんが替わったら、前のだんの自分の線を消す
  $effect(() => {
    void task;
    strokes = [];
  });
</script>

<header class="bar">
  <p class="word">
    {#if task.kind === 'draw'}おだい <b>{task.word}</b>{:else if task.kind === 'guess'}なにの えかな？{:else}ほかの
      ひとを まっています{/if}
  </p>
  <p class="left"><small>{view.step + 1} / {view.steps}</small> {view.left}</p>
</header>
<div class="middle">
  {#if task.kind === 'draw'}
    <Board {strokes} {pen} onink={ink} />
  {:else if task.kind === 'guess'}
    <Board strokes={task.strokes} />
  {:else}
    <p class="wait" role="status">ほかの ひとを まっています</p>
  {/if}
</div>
{#if task.kind === 'draw'}
  <Tools bind:color bind:size bind:erasing onundo={() => ink({ k: 'undo' })} onclear={() => ink({ k: 'clear' })} />
  <button class="pill gold done" onclick={() => ondone()}>できた</button>
{:else if task.kind === 'guess'}
  <KanaPad onsubmit={(text) => ondone(text)} {ontype} />
{/if}

<style>
  .bar {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 4px 12px;
    align-items: center;
    /* 右上の ≡ に重ならないよう空けておく */
    padding: max(8px, env(safe-area-inset-top)) 72px 8px 12px;
    border-bottom: 3px solid var(--line);
    background: var(--paper);
    color: var(--line);
    font-weight: 800;
  }

  .word {
    font-size: clamp(18px, 3cqh, 28px);
  }

  .left {
    font-size: clamp(18px, 3cqh, 28px);
  }

  .middle {
    position: relative;
    flex: 1;
    display: grid;
    place-items: center;
    min-height: 0;
    padding: 8px;
    container-type: size;
  }

  .wait {
    color: var(--line);
    font-weight: 800;
  }

  .done {
    min-width: 50%;
    margin: 0 auto max(8px, env(safe-area-inset-bottom));
  }
</style>
