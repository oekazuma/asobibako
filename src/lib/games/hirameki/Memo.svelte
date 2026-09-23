<script lang="ts">
  import { capture, toBoardPoint, TURNED_QUERY } from '$lib/board-input';

  /** active のあいだだけ書ける。書いたものは閉じても残し、下の図の操作はさまたげない */
  let { active }: { active: boolean } = $props();

  let canvas: HTMLCanvasElement;
  /** 指ごとの、前に書いた点 */
  const last: Record<number, [number, number] | undefined> = {};

  // 横向きで .stage が回っていても、盤面そのものの座標で書く
  function at(event: PointerEvent): [number, number] {
    const turned = matchMedia(TURNED_QUERY).matches;
    const [x, y] = toBoardPoint(event.clientX, event.clientY, canvas.getBoundingClientRect(), turned);
    return [x * canvas.offsetWidth, y * canvas.offsetHeight];
  }

  function pen() {
    const ctx = canvas.getContext('2d')!;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ff4d6d';
    return ctx;
  }

  function draw(event: PointerEvent) {
    const from = last[event.pointerId];
    if (!from) return;
    const to = at(event);
    const ctx = pen();
    ctx.beginPath();
    ctx.moveTo(...from);
    ctx.lineTo(...to);
    ctx.stroke();
    last[event.pointerId] = to;
  }

  function down(event: PointerEvent) {
    capture(event);
    const p = at(event);
    last[event.pointerId] = [p[0] - 0.1, p[1]];
    draw(event);
  }

  const up = (event: PointerEvent) => delete last[event.pointerId];

  function clear() {
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
  }

  $effect(() => {
    // 大きさが変わると canvas の中身は消える。メモは一時的なものなので描き直さない
    const observer = new ResizeObserver(() => {
      const dpr = devicePixelRatio || 1;
      canvas.width = Math.round(canvas.offsetWidth * dpr);
      canvas.height = Math.round(canvas.offsetHeight * dpr);
      canvas.getContext('2d')?.scale(dpr, dpr);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  });
</script>

<canvas
  bind:this={canvas}
  class:active
  aria-hidden="true"
  onpointerdown={down}
  onpointermove={draw}
  onpointerup={up}
  onpointercancel={up}
></canvas>
{#if active}
  <button class="pill p2 erase" onclick={clear}>消す</button>
{/if}

<style>
  canvas {
    position: absolute;
    inset: 0;
    z-index: 2;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  canvas.active {
    pointer-events: auto;
    outline: 4px dashed var(--pastel-p2);
    outline-offset: -4px;
    border-radius: 10px;
  }

  .erase {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 2;
    padding: 6px 16px;
  }
</style>
