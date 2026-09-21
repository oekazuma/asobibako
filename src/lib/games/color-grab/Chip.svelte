<script lang="ts">
  import { CHIP_R, type Chip } from './engine';
  import { GLYPH, HEX } from './palette';

  let { chip }: { chip: Chip } = $props();
</script>

<span
  class="chip"
  class:held={chip.heldBy !== null}
  class:chameleon={chip.chameleon}
  data-chip={chip.id}
  style:left="{chip.x * 100}%"
  style:top="{chip.y * 100}%"
  style:--size="{CHIP_R * 200}%"
  style:--c={HEX[chip.color]}
  aria-hidden="true">{GLYPH[chip.color]}</span
>

<style>
  .chip {
    position: absolute;
    display: grid;
    place-items: center;
    height: var(--size);
    aspect-ratio: 1;
    border-radius: 50%;
    background: var(--c);
    border: 4px solid #fff;
    box-shadow: 0 5px 0 rgb(43 45 66 / 0.2);
    color: rgb(0 0 0 / 0.55);
    font-size: 4dvh;
    line-height: 1;
    translate: -50% -50%;
    touch-action: none;
    cursor: grab;
    transition: scale 120ms;
  }

  .held {
    scale: 1.18;
    box-shadow:
      0 0 0 4px var(--ink),
      0 12px 18px rgb(43 45 66 / 0.3);
    z-index: 1;
  }

  /* 色が変わり続ける玉は、点線の縁で「変わる玉」だと分かるようにする */
  .chameleon {
    outline: 3px dashed var(--ink);
    outline-offset: 3px;
  }
</style>
