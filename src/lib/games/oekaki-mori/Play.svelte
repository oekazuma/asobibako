<script lang="ts">
  import type { Message } from '$lib/net/link';
  import type { Seat } from '$lib/net/party.svelte';
  import Buzzer from './Buzzer.svelte';
  import Board from './Board.svelte';
  import Bubbles, { type Bubble } from './Bubbles.svelte';
  import type { View } from './engine';
  import KanaPad from './KanaPad.svelte';
  import { ERASER, PENS, SIZES, type Ink, type Stroke } from './strokes';
  import Tools from './Tools.svelte';
  import TopBar from './TopBar.svelte';

  let {
    view,
    me,
    strokes,
    bubbles,
    close,
    onink,
    act,
    typing,
    ontype
  }: {
    view: View;
    me: Seat;
    strokes: Stroke[];
    bubbles: Bubble[];
    close: boolean;
    onink: (ink: Ink) => void;
    act: (message: Message) => void;
    typing: Record<number, string>;
    ontype: (text: string) => void;
  } = $props();

  let color = $state<string>(PENS[0].hex);
  let size = $state(1);
  let erasing = $state(false);
  const drawing = $derived(view.drawer === me);
  const pen = $derived(drawing && view.phase === 'draw' ? (erasing ? ERASER : { color, size: SIZES[size] }) : null);
  const solved = $derived(view.solved.includes(me));
</script>

<TopBar {view} {me} {typing} />
<div class="middle">
  <Board {strokes} {pen} {onink} />
  <Bubbles {bubbles} />
  {#if view.phase === 'ready'}
    <div class="cover">
      {#if drawing}
        <p>おだいは「{view.word}」</p>
        <button class="pill gold" onclick={() => act({ t: 'start' })}>かきはじめる</button>
      {:else}
        <p>{view.drawer}P が じゅんびしています</p>
      {/if}
    </div>
  {:else if view.phase === 'reveal'}
    <!-- 描いた絵もいっしょに見せるので、覆わずに答えだけを上に出す -->
    <p class="answer">こたえは「{view.word}」</p>
  {/if}
  {#if close}<p class="flash">おしい！</p>{/if}
  {#if solved && view.phase === 'draw'}<p class="flash right">せいかい！</p>{/if}
</div>
{#if drawing}
  <Tools bind:color bind:size bind:erasing onundo={() => onink({ k: 'undo' })} onclear={() => onink({ k: 'clear' })} />
{:else if view.mode === 'hayaoshi'}
  <Buzzer {view} {me} {act} />
{:else}
  {#key view.turn}
    <KanaPad disabled={view.phase !== 'draw' || solved} onsubmit={(text) => act({ t: 'guess', text })} {ontype} />
  {/key}
{/if}

<style>
  .middle {
    position: relative;
    flex: 1;
    display: grid;
    place-items: center;
    min-height: 0;
    padding: 8px;
    container-type: size;
  }

  .cover {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: rgb(255 250 244 / 0.9);
    color: var(--line);
    font-size: clamp(20px, 4cqh, 32px);
    font-weight: 800;
  }

  .answer {
    position: absolute;
    top: 12px;
    padding: 6px 20px;
    border: 3px solid var(--line);
    border-radius: 999px;
    background: var(--pastel-gold);
    color: var(--line);
    font-size: clamp(20px, 4cqh, 32px);
    font-weight: 800;
    pointer-events: none;
  }

  .cover .pill {
    min-width: 50%;
    font-size: clamp(22px, 5cqh, 36px);
  }

  .flash {
    position: absolute;
    bottom: 12px;
    padding: 6px 18px;
    border: 3px solid var(--line);
    border-radius: 999px;
    background: #fff;
    color: var(--line);
    font-size: clamp(18px, 3.4cqh, 28px);
    font-weight: 800;
    pointer-events: none;
  }

  .flash.right {
    background: var(--pastel-gold);
  }
</style>
