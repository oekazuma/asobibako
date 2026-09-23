<script lang="ts">
  import { COLORS } from './engine';

  let { color = $bindable(), onsummon }: { color: string; onsummon: () => void } = $props();

  const NAMES = ['きいろ', 'きみどり', 'オレンジ', 'ピンク', 'みずいろ', 'あお', 'むらさき', 'ちゃいろ'];
</script>

<div class="palette">
  {#each COLORS as c, i (c)}
    <button
      class="swatch"
      style:background={c}
      aria-label={NAMES[i]}
      aria-pressed={color === c}
      onclick={() => (color = c)}
    ></button>
  {/each}
  <button class="summon" aria-label="ムシを よぶ" onclick={onsummon}>
    <span class="hair"></span>
    <span class="eyes"></span>
  </button>
</div>

<style>
  .palette {
    --size: clamp(26px, min(5cqh, 8cqw), 52px);
    position: absolute;
    bottom: max(16px, env(safe-area-inset-bottom));
    left: 50%;
    display: flex;
    align-items: center;
    gap: clamp(4px, 1cqw, 10px);
    padding: 8px 12px;
    border: 4px solid #fff;
    border-radius: 999px;
    background: rgb(255 255 255 / 0.85);
    box-shadow: var(--lift);
    translate: -50% 0;
  }

  .swatch,
  .summon {
    width: var(--size);
    aspect-ratio: 1;
    border: 3px solid transparent;
    border-radius: 50%;
    cursor: pointer;
    transition: scale 120ms var(--spring);
  }

  .swatch[aria-pressed='true'] {
    border-color: var(--ink);
    scale: 1.15;
  }

  /* 押すとムシが出てくるボタン。ムシと同じ顔 */
  .summon {
    position: relative;
    margin-left: 6px;
    background: #ffd84d;
    box-shadow: 0 3px 0 var(--gold-deep);
  }

  .summon:active {
    translate: 0 3px;
    box-shadow: none;
  }

  .eyes,
  .hair {
    position: absolute;
    left: 50%;
    translate: -50% 0;
  }

  .eyes {
    top: 34%;
    width: 44%;
    height: 32%;
    background:
      radial-gradient(ellipse 22% 50%, var(--ink) 95%, transparent) left / 50% 100% no-repeat,
      radial-gradient(ellipse 22% 50%, var(--ink) 95%, transparent) right / 50% 100% no-repeat;
  }

  .hair {
    top: -26%;
    width: 44%;
    height: 34%;
    background:
      linear-gradient(var(--ink), var(--ink)) left / 3px 100% no-repeat,
      linear-gradient(var(--ink), var(--ink)) center / 3px 100% no-repeat,
      linear-gradient(var(--ink), var(--ink)) right / 3px 100% no-repeat;
  }

  @media (prefers-reduced-motion: reduce) {
    .swatch {
      transition: none;
    }
  }
</style>
