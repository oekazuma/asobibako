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
  /**
   * Apple Pencil で書く人は手のひらを画面に置くので、ペンが一度でも来たら指では書かせない。
   * 手のひらはペンより先に着くことが多く、そのとき書き始めた線はペンが着いたところで消す
   */
  let pen = false;

  /** 書き始めに一度だけ測り、動かすたびにレイアウトを計算させない */
  let box = { left: 0, top: 0, right: 1, width: 1, height: 1 };
  let turned = false;

  // 横向きで .stage が回っていても、盤面そのものの座標で書く
  const at = (event: PointerEvent) => toBoardPoint(event.clientX, event.clientY, box, turned);

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
    // 速く動かすと 1 回の pointermove に何点もまとめられ、線が角ばる
    // 合成イベントや古い Safari では空か無いので、そのときは自分だけを使う
    const events = event.getCoalescedEvents?.() ?? [];
    for (const e of events.length ? events : [event]) {
      const to = at(e);
      segment(line.at(-1)!, to);
      line.push(to);
    }
  }

  function down(event: PointerEvent) {
    if (event.pointerType === 'pen') {
      pen = true;
      const palm = Object.values(open);
      for (const id in open) delete open[id];
      if (palm.length) {
        lines.splice(0, lines.length, ...lines.filter((line) => !palm.includes(line)));
        redraw();
      }
    } else if (pen) return;
    capture(event);
    box = canvas.getBoundingClientRect();
    turned = matchMedia(TURNED_QUERY).matches;
    const p = at(event);
    // 押しただけでも点が残るよう、ほんの少し左から引く
    const line: [number, number][] = [[p[0] - 0.1 / canvas.offsetWidth, p[1]]];
    lines.push(line);
    open[event.pointerId] = line;
    draw(event);
  }

  const up = (event: PointerEvent) => delete open[event.pointerId];

  function redraw() {
    canvas.getContext('2d')!.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    for (const line of lines) line.slice(1).forEach((b, i) => segment(line[i], b));
  }

  function undo() {
    const line = lines.pop();
    for (const id in open) if (open[id] === line) delete open[id];
    redraw();
  }

  function clear() {
    lines.length = 0;
    redraw();
  }

  $effect(() => {
    const observer = new ResizeObserver(() => {
      const dpr = devicePixelRatio || 1;
      canvas.width = Math.round(canvas.offsetWidth * dpr);
      canvas.height = Math.round(canvas.offsetHeight * dpr);
      canvas.getContext('2d')?.scale(dpr, dpr);
      redraw();
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
  <div class="tools">
    <button class="pill" onclick={undo}>もどす</button>
    <button class="pill p2" onclick={clear}>消す</button>
  </div>
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

  .tools {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 2;
    display: flex;
    gap: 8px;
  }

  .tools button {
    padding: 6px 16px;
  }
</style>
