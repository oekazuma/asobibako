<script lang="ts">
  import { sounds } from './sounds';

  let { unit, digits = $bindable('') }: { unit: string; digits?: string } = $props();

  function key(d: string) {
    sounds.pick();
    if (d === '消す') digits = digits.slice(0, -1);
    else if (digits.length < 8) digits = digits === '0' ? d : digits + d;
  }
</script>

<div class="keypad">
  <output class="shown" aria-live="polite">
    <span class="num" class:empty={!digits}>{digits || '?'}</span>{unit}
  </output>
  <div class="keys">
    {#each ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '消す'] as d (d)}
      <button class="pill" class:erase={d === '消す'} onclick={() => key(d)}>{d}</button>
    {/each}
  </div>
</div>

<style>
  .keypad {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: var(--line);
  }

  .shown {
    font-size: clamp(20px, min(3.4cqh, 6cqw), 36px);
    font-weight: 800;
  }

  .num {
    display: inline-block;
    min-width: 3.2em;
    margin-right: 0.2em;
    padding: 0 0.3em;
    border-bottom: 3px solid var(--line);
    text-align: center;
  }

  .num.empty {
    color: var(--line-soft);
  }

  .keys {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    width: min(100%, 420px);
  }

  .pill {
    height: clamp(40px, 6cqh, 60px);
    padding: 0;
    font-size: clamp(18px, min(3cqh, 5.4cqw), 28px);
  }

  .erase {
    grid-column: span 2;
    --face: var(--pastel-p2);
  }
</style>
