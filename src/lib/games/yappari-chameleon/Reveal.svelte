<script lang="ts">
  import { onMount } from 'svelte';
  import { WINNER } from './match.svelte';
  import type { Winner } from './referee';

  let { winner }: { winner: Winner } = $props();
  let canvas: HTMLCanvasElement;
  const text = $derived(WINNER[winner]);

  // 少しずつずらして重ね、下へ垂れを描いて、緑のペンキを太い筆で塗ったように見せる
  function paint(g: CanvasRenderingContext2D, w: number, h: number) {
    const size = Math.min(h * 0.32, (w * 0.95) / [...text].length);
    g.font = `bold ${size}px "Hiragino Mincho ProN", serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    for (let i = 0; i < 6; i++) {
      g.strokeStyle = i % 2 ? '#3f9c2f' : '#5cbf3c';
      g.lineWidth = size * (0.16 - i * 0.015);
      g.strokeText(text, w / 2 + (Math.random() - 0.5) * size * 0.08, h / 2 + (Math.random() - 0.5) * size * 0.08);
    }
    g.fillStyle = '#4caf35';
    g.fillText(text, w / 2, h / 2);
    for (let i = 0; i < 26; i++) {
      const x = w / 2 + (Math.random() - 0.5) * size * [...text].length * 0.9;
      const y = h / 2 + size * 0.3;
      g.fillRect(x, y, size * 0.04, size * (0.2 + Math.random() * 0.7));
    }
  }

  onMount(() => {
    const r = canvas.getBoundingClientRect();
    canvas.width = r.width;
    canvas.height = r.height;
    const g = canvas.getContext('2d');
    if (g) paint(g, r.width, r.height);
  });
</script>

<!-- 飾り文字が答え合わせの 30 秒ずっと画面をふさぐと全員の場所を見て回れないので 3 秒で消し、白い勝者の言葉だけ残す -->
<canvas class="paint" bind:this={canvas} aria-hidden="true"></canvas>
<p class="winner" role="status">{text}</p>

<style>
  .paint {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    animation: fade 3s forwards;
  }

  @keyframes fade {
    0%,
    65% {
      opacity: 0.9;
    }
    100% {
      opacity: 0;
    }
  }

  .winner {
    position: absolute;
    top: calc(max(8px, env(safe-area-inset-top)) + 84px);
    left: 50%;
    translate: -50% 0;
    margin: 0;
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 30px;
    white-space: nowrap;
    text-shadow: 0 2px 6px #000;
    pointer-events: none;
  }
</style>
