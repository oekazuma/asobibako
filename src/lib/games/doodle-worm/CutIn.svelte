<script lang="ts">
  import type { Stroke } from './engine';
  import type { Look } from './looks';
  import { portrait } from './paint';

  let {
    strokes,
    move,
    look,
    color,
    flip
  }: {
    strokes: Stroke[];
    /** ひっさつわざの名前 */
    move: string;
    look: Look;
    color: string;
    /** 向かいの人の子。帯を向かいから読める向きにする */
    flip: boolean;
  } = $props();
</script>

<!-- ひっさつわざの「ため」のあいだだけ、帯に子の顔と技の名前を大きく出す。ぶつかる瞬間は見せたいので、ためが終わる前に消す。指の邪魔をしないよう当たり判定は持たない -->
<div class="cut" class:flip style:--c={color}>
  <img src={portrait(strokes, look)} style:background={look.bg} width="160" height="160" alt="" />
  <span class="move">{move}</span>
</div>

<style>
  .cut {
    position: absolute;
    top: 50%;
    left: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
    height: min(26cqw, 18cqh);
    padding: 0 20px;
    background:
      repeating-linear-gradient(-60deg, rgb(255 255 255 / 0.15) 0 14px, transparent 14px 28px),
      linear-gradient(90deg, var(--c), color-mix(in srgb, var(--c), var(--gold) 45%));
    border-block: 5px solid #fff;
    box-shadow: var(--lift);
    translate: 0 -50%;
    pointer-events: none;
    animation: cut 0.75s both;
  }

  .flip {
    rotate: 180deg;
  }

  img {
    height: 88%;
    width: auto;
    aspect-ratio: 1;
    border: 4px solid #fff;
    border-radius: 18px;
  }

  .move {
    color: #fff;
    font-size: min(8cqw, 6cqh);
    font-weight: 900;
    font-style: italic;
    white-space: nowrap;
    -webkit-text-stroke: 5px var(--ink);
    paint-order: stroke;
  }

  @keyframes cut {
    0% {
      clip-path: inset(0 100% 0 0);
      opacity: 1;
    }

    18% {
      clip-path: inset(0 0 0 0);
    }

    80% {
      opacity: 1;
    }

    100% {
      clip-path: inset(0 0 0 0);
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cut {
      animation: none;
    }
  }
</style>
