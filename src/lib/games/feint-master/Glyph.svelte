<script lang="ts">
  import type { Color, Shape } from './engine';

  /** どちらかを省くと、その半分は白く抜いた形・灰色の丸で描く（ヒント用） */
  let { color, shape, size = '100%' }: { color?: Color; shape?: Shape; size?: string } = $props();
</script>

<span class="glyph {shape ?? 'blank'} {color ?? 'none'}" style:width={size} aria-hidden="true"></span>

<style>
  .glyph {
    display: block;
    aspect-ratio: 1;
    background: var(--c);
    filter: drop-shadow(0 4px 0 rgb(43 45 66 / 0.2));
  }

  .green {
    --c: #2fbf5b;
  }

  .purple {
    --c: #9b5cff;
  }

  .orange {
    --c: #ff9a1f;
  }

  .none {
    --c: #b7b9c6;
  }

  .circle,
  .blank {
    border-radius: 50%;
  }

  .triangle {
    clip-path: polygon(50% 6%, 96% 90%, 4% 90%);
  }

  .star {
    clip-path: polygon(50% 2%, 62% 36%, 98% 37%, 69% 58%, 80% 94%, 50% 73%, 20% 94%, 31% 58%, 2% 37%, 38% 36%);
  }
</style>
