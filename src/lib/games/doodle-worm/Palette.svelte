<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { COLORS } from './engine';

  let {
    color = $bindable(),
    ready,
    ongo,
    onundo,
    onsummon,
    onstock
  }: {
    color: string;
    ready: boolean;
    ongo: () => void;
    onundo: () => void;
    onsummon: () => void;
    onstock: () => void;
  } = $props();
</script>

<div class="palette">
  <div class="colors">
    {#each COLORS as c (c.hex)}
      <button
        class="swatch"
        style:background={c.hex}
        aria-label={c.name}
        aria-pressed={color === c.hex}
        onclick={() => (color = c.hex)}
      ></button>
    {/each}
  </div>
  <button class="tool" aria-label="もどす" disabled={!ready} onclick={onundo}>
    <Icon name="undo" size="70%" />
  </button>
  <button class="hatch" disabled={!ready} onclick={ongo}>うごけ！</button>
  <button class="summon" aria-label="なかまを よぶ" onclick={onsummon}>
    <span class="eyes"></span>
  </button>
  <button class="tool" aria-label="ずかん" onclick={onstock}>
    <Icon name="book" size="75%" />
  </button>
</div>

<style>
  .palette {
    --size: clamp(24px, min(4.6cqh, 6.2cqw), 48px);
    position: absolute;
    bottom: max(16px, env(safe-area-inset-bottom));
    left: 50%;
    display: flex;
    align-items: center;
    gap: clamp(4px, 1cqw, 10px);
    padding: 8px 12px;
    border: 4px solid #fff;
    border-radius: 28px;
    background: rgb(255 255 255 / 0.85);
    box-shadow: var(--lift);
    translate: -50% 0;
  }

  .colors {
    display: grid;
    grid-template-columns: repeat(7, var(--size));
    gap: clamp(3px, 0.8cqw, 8px);
  }

  .swatch,
  .tool,
  .summon {
    width: var(--size);
    aspect-ratio: 1;
    border: 3px solid transparent;
    border-radius: 50%;
    cursor: pointer;
    transition: scale 120ms var(--spring);
  }

  /* しろ・うすい色が地に溶けないよう、どの色にも薄いふちを付ける */
  .swatch {
    box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.12);
  }

  .swatch[aria-pressed='true'] {
    border-color: var(--ink);
    scale: 1.15;
  }

  .tool {
    display: grid;
    place-items: center;
    background: #f1f1f5;
  }

  .hatch {
    height: calc(var(--size) * 1.3);
    padding: 0 clamp(8px, 2cqw, 18px);
    border: 3px solid #fff;
    border-radius: 999px;
    background: var(--p2);
    color: #fff;
    font-size: calc(var(--size) * 0.45);
    font-weight: 800;
    white-space: nowrap;
    box-shadow: 0 4px 0 color-mix(in srgb, var(--p2), #000 25%);
    cursor: pointer;
  }

  .tool:disabled,
  .hatch:disabled {
    opacity: 0.35;
    cursor: default;
  }

  /* 押すと、まるい子が出てくるボタン。出てくる子と同じ顔 */
  .summon {
    position: relative;
    background: #ffd84d;
    box-shadow: 0 3px 0 var(--gold-deep);
  }

  .hatch:active:enabled,
  .summon:active {
    translate: 0 3px;
    box-shadow: none;
  }

  .eyes {
    position: absolute;
    left: 50%;
    translate: -50% 0;
    top: 34%;
    width: 44%;
    height: 32%;
    background:
      radial-gradient(ellipse 22% 50%, var(--ink) 95%, transparent) left / 50% 100% no-repeat,
      radial-gradient(ellipse 22% 50%, var(--ink) 95%, transparent) right / 50% 100% no-repeat;
  }

  @media (prefers-reduced-motion: reduce) {
    .swatch {
      transition: none;
    }
  }
</style>
