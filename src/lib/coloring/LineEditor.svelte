<script lang="ts">
  import { BoardInput } from '$lib/board-input';
  import type { Edit } from './edits';
  import { SIZE } from './regions';

  let {
    mask,
    onedit,
    onundo,
    canUndo
  }: { mask: Uint8Array; onedit: (edit: Edit) => void; onundo: () => void; canUndo: boolean } = $props();

  /** 足す線は自動の線とほぼ同じ太さ、消すほうは太めにして、はみ出した線をまとめて消せるようにする */
  const WIDTH = { add: 5, erase: 18 } as const;
  const INK = [59, 47, 42];

  let canvas = $state<HTMLCanvasElement>();
  /** 選ぶまでは何もしない。押しまちがいで線を消さないため */
  let tool = $state<'add' | 'erase' | null>(null);
  let pts: number[] | null = null;

  const input = new BoardInput({
    down: (_event, x, y) => {
      if (tool) pts = [x, y];
    },
    move: (_event, x, y) => {
      if (!pts || !tool) return;
      // なぞっているあいだは、その場で描いて見せる（線画を作り直すのは離したとき）
      const g = canvas?.getContext('2d');
      if (g) {
        g.strokeStyle = tool === 'add' ? `rgb(${INK})` : '#fff';
        g.lineWidth = WIDTH[tool];
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(pts[pts.length - 2] * SIZE, pts[pts.length - 1] * SIZE);
        g.lineTo(x * SIZE, y * SIZE);
        g.stroke();
      }
      pts.push(x, y);
    },
    up: (_event, _finger, x, y) => {
      if (!pts || !tool) return;
      pts.push(x, y);
      onedit({ kind: tool, pts, width: WIDTH[tool] });
      pts = null;
    }
  });

  $effect(() => {
    const g = canvas?.getContext('2d');
    if (!g) return;
    const img = g.createImageData(SIZE, SIZE);
    const d = img.data;
    for (let i = 0; i < mask.length; i++) {
      const line = mask[i] === 1;
      d[i * 4] = line ? INK[0] : 255;
      d[i * 4 + 1] = line ? INK[1] : 255;
      d[i * 4 + 2] = line ? INK[2] : 255;
      d[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
</script>

<div class="editor" class:live={tool} use:input.board>
  <canvas width={SIZE} height={SIZE} bind:this={canvas}></canvas>
</div>
<div class="tools">
  <button class="pill" aria-pressed={tool === 'add'} onclick={() => (tool = tool === 'add' ? null : 'add')}
    >せんを たす</button
  >
  <button class="pill" aria-pressed={tool === 'erase'} onclick={() => (tool = tool === 'erase' ? null : 'erase')}
    >せんを けす</button
  >
  <button class="pill" disabled={!canUndo} onclick={onundo}>1つ もどす</button>
</div>

<style>
  .editor {
    width: min(86cqw, 52cqh);
    aspect-ratio: 1;
    border: 3px solid var(--line);
    border-radius: 12px;
    overflow: hidden;
    background: #fff;
    touch-action: none;
  }

  .editor.live {
    cursor: crosshair;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }

  .tools {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }

  [aria-pressed='true'] {
    --face: var(--pastel-gold);
  }
</style>
