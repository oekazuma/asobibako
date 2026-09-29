<script lang="ts">
  import type { Entry } from './arena-draw';
  import type { Look } from './looks';
  import { portrait } from './paint';
  import { ROUND_NAMES } from './rivals';

  let {
    me,
    rivals,
    round,
    look,
    onfight
  }: {
    me: Entry;
    rivals: Entry[];
    /** いま挑む回戦（0 から） */
    round: number;
    look: Look;
    onfight: () => void;
  } = $props();
</script>

<h2 class="yuru">トーナメント</h2>
<ol class="ladder">
  {#each rivals as r, i (r.name)}
    <li class:done={i < round} class:now={i === round}>
      <span class="step">{ROUND_NAMES[i]}</span>
      <img src={portrait(me.strokes, look)} style:background={look.bg} width="160" height="160" alt="きみの こ" />
      <span class="vs">VS</span>
      <img src={portrait(r.strokes, look)} style:background={look.bg} width="160" height="160" alt={r.name} />
      <span class="name">{i < round ? 'かち！' : r.name}</span>
    </li>
  {/each}
</ol>
<button class="pill p2 go" onclick={onfight}>たたかう！</button>

<style>
  h2 {
    margin: 0 0 12px;
    text-align: center;
  }

  .ladder {
    display: grid;
    gap: 10px;
    margin: 0 auto 16px;
    padding: 0;
    max-width: 520px;
    list-style: none;
  }

  li {
    display: grid;
    grid-template-columns: 1fr 72px auto 72px 1fr;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border: 2px solid var(--line);
    border-radius: 18px;
    background: #fff;
    opacity: 0.55;
  }

  li.now {
    opacity: 1;
    outline: 4px solid var(--p2);
    outline-offset: 2px;
  }

  li.done {
    opacity: 1;
    background: var(--pastel-gold);
  }

  img {
    width: 72px;
    height: 72px;
    border-radius: 12px;
  }

  .step,
  .name {
    font-weight: 800;
    font-size: 14px;
  }

  .name {
    text-align: right;
  }

  .vs {
    font-weight: 800;
    color: var(--p2);
  }

  .go {
    display: block;
    margin: 0 auto;
  }
</style>
