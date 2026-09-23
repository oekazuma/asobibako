<script lang="ts">
  import Figure from './Figure.svelte';
  import { sounds } from './sounds';
  import type { Figure as Fig, FillQ } from './types';

  /** values は cells の順の数（-1 は空き）。given のます目は最初から入っていて変えられない */
  let { p, fig, values = $bindable() }: { p: FillQ; fig: Fig; values: number[] } = $props();

  /** 選んでいるチップ（numbers の添え字） */
  let chip = $state<number | null>(null);
  /** ます目の四角の一辺（図の座標） */
  const BOX = 36;

  /** 同じ数のチップが何枚も入っていれば、使った枚数ぶんだけ前から使ったことにする */
  const spent = $derived.by(() => {
    const placed = values.filter((v, i) => v >= 0 && p.cells[i].given === undefined);
    return p.numbers.map(
      (n, i) => p.numbers.slice(0, i + 1).filter((m) => m === n).length <= placed.filter((v) => v === n).length
    );
  });

  function pickChip(i: number) {
    if (spent[i]) return;
    chip = chip === i ? null : i;
    sounds.pick();
  }

  function press(c: number) {
    if (p.cells[c].given !== undefined) return;
    if (values[c] >= 0) values = values.map((v, k) => (k === c ? -1 : v));
    else if (chip !== null) {
      values = values.map((v, k) => (k === c ? p.numbers[chip!] : v));
      chip = null;
    } else return;
    sounds.pick();
  }
</script>

<div class="fill">
  <div class="area">
    <Figure {fig}>
      {#each { length: p.cells.length }, c (c)}
        {@const cell = p.cells[c]}
        <button
          class="box"
          class:given={cell.given !== undefined}
          class:empty={values[c] < 0}
          style:left="{(cell.x / fig.w) * 100}%"
          style:top="{(cell.y / fig.h) * 100}%"
          style:width="{(BOX / fig.w) * 100}%"
          aria-label="ます {c + 1}"
          onclick={() => press(c)}>{values[c] >= 0 ? values[c] : ''}</button
        >
      {/each}
    </Figure>
  </div>
  <div class="chips">
    {#each { length: p.numbers.length }, i (i)}
      <button
        class="chip"
        class:on={chip === i}
        disabled={spent[i]}
        aria-label="数 {p.numbers[i]}"
        onclick={() => pickChip(i)}>{p.numbers[i]}</button
      >
    {/each}
  </div>
</div>

<style>
  .fill {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: 100cqw;
    height: 100cqh;
  }

  .area {
    display: grid;
    flex: 1;
    place-items: center;
    width: 100%;
    min-height: 0;
    container-type: size;
  }

  .box {
    position: absolute;
    aspect-ratio: 1;
    padding: 0;
    border: 3px solid var(--line);
    border-radius: 8px;
    background: #fff;
    color: var(--line);
    font-size: clamp(14px, 4cqh, 28px);
    font-weight: 900;
    translate: -50% -50%;
    cursor: pointer;
  }

  .empty {
    border-style: dashed;
    background: #fff8;
  }

  .given {
    background: #f1eadf;
    color: #8a5a3b;
    cursor: default;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
  }

  .chip {
    min-width: 44px;
    height: 44px;
    padding: 0 8px;
    border: 3px solid var(--line);
    border-radius: 12px;
    background: #fff4d6;
    box-shadow: var(--soft-shadow);
    color: var(--line);
    font-size: 20px;
    font-weight: 900;
    cursor: pointer;
  }

  .chip.on {
    background: var(--pastel-gold);
    translate: 0 -4px;
  }

  .chip:disabled {
    opacity: 0.25;
    box-shadow: none;
  }
</style>
