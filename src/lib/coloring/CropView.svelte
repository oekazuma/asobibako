<script lang="ts">
  import { BoardInput } from '$lib/board-input';
  import { panCrop, visible, type Crop } from './crop';

  let { bmp, crop = $bindable() }: { bmp: ImageBitmap; crop: Crop } = $props();

  let canvas = $state<HTMLCanvasElement>();
  let frame = $state<HTMLDivElement>();
  /** 写真を動かしている指と、そのひとつ前の位置（盤面に対する 0..1） */
  let held: { id: number; x: number; y: number } | null = null;

  // 横向きで画面ごと回しても指の向きがずれないよう、座標は BoardInput で読む
  const input = new BoardInput({
    down: (event, x, y) => {
      if (!held) held = { id: event.pointerId, x, y };
    },
    up: (event) => {
      if (held?.id !== event.pointerId) return;
      // 動かしていた指を離しても、ほかの指が残っていればその指で続けて動かせるようにする
      const [id, rest] = [...input.fingers.all].find(([other]) => other !== event.pointerId) ?? [];
      held = id !== undefined && rest ? { id, x: rest.x, y: rest.y } : null;
    }
  });

  function move(event: PointerEvent) {
    const finger = held && input.fingers.all.get(held.id);
    if (!held || event.pointerId !== held.id || !finger) return;
    crop = panCrop(crop, (finger.x - held.x) * crop.size, (finger.y - held.y) * crop.size, bmp.width, bmp.height);
    held = { id: held.id, x: finger.x, y: finger.y };
  }

  // BoardInput の指の位置を読むので、BoardInput が先に受けたあとの同じ pointermove で動かす
  $effect(() => {
    frame?.addEventListener('pointermove', move);
    return () => frame?.removeEventListener('pointermove', move);
  });

  $effect(() => {
    const g = canvas?.getContext('2d');
    if (!g || !canvas) return;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, canvas.width, canvas.height);
    const d = visible(crop, bmp.width, bmp.height, canvas.width);
    g.drawImage(bmp, d.sx, d.sy, d.sw, d.sh, d.dx, d.dy, d.dw, d.dh);
  });
</script>

<div class="frame" use:input.board bind:this={frame}>
  <canvas width="768" height="768" bind:this={canvas}></canvas>
</div>

<style>
  .frame {
    width: min(86cqw, 52cqh);
    aspect-ratio: 1;
    border: 3px solid var(--line);
    border-radius: 12px;
    overflow: hidden;
    background: #fff;
    touch-action: none;
    cursor: grab;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
