<script lang="ts">
  import { capture, toBoardPoint, TURNED_QUERY } from '$lib/board-input';

  /** active のあいだだけ書ける。書いたものは閉じても残し、下の図の操作はさまたげない */
  let { active }: { active: boolean } = $props();

  let canvas: HTMLCanvasElement;
  /**
   * 書いた線。canvas は大きさが変わると中身が消える（iPad を回す・ボタンの段数が変わる）ので、
   * 盤面の幅・高さに対する 0..1 の座標で持っておき、そのたびに描き直す
   */
  const lines: [number, number][][] = [];
  /** 指ごとの、いま書いている線 */
  const open: Record<number, [number, number][] | undefined> = {};

  // 横向きで .stage が回っていても、盤面そのものの座標で書く
  function at(event: PointerEvent): [number, number] {
    const turned = matchMedia(TURNED_QUERY).matches;
    return toBoardPoint(event.clientX, event.clientY, canvas.getBoundingClientRect(), turned);
  }

  function segment(a: [number, number], b: [number, number]) {
    const ctx = canvas.getContext('2d')!;
    const [w, h] = [canvas.offsetWidth, canvas.offsetHeight];
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ff4d6d';
    ctx.beginPath();
    ctx.moveTo(a[0] * w, a[1] * h);
    ctx.lineTo(b[0] * w, b[1] * h);
    ctx.stroke();
  }

  function draw(event: PointerEvent) {
    const line = open[event.pointerId];
    if (!line) return;
    const to = at(event);
    segment(line.at(-1)!, to);
    line.push(to);
  }

  function down(event: PointerEvent) {
    capture(event);
    const p = at(event);
    // 押しただけでも点が残るよう、ほんの少し左から引く
    const line: [number, number][] = [[p[0] - 0.1 / canvas.offsetWidth, p[1]]];
    lines.push(line);
    open[event.pointerId] = line;
    draw(event);
  }

  const up = (event: PointerEvent) => delete open[event.pointerId];

  function clear() {
    lines.length = 0;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
  }

  $effect(() => {
    const observer = new ResizeObserver(() => {
      const dpr = devicePixelRatio || 1;
      canvas.width = Math.round(canvas.offsetWidth * dpr);
      canvas.height = Math.round(canvas.offsetHeight * dpr);
      canvas.getContext('2d')?.scale(dpr, dpr);
      for (const line of lines) line.slice(1).forEach((b, i) => segment(line[i], b));
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
