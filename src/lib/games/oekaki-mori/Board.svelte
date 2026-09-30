<script lang="ts">
  import { onMount } from 'svelte';
  import { BoardInput } from '$lib/board-input';
  import { animate } from '$lib/loop';
  import { render, renderTail, type Ink, type Stroke } from './strokes';

  let {
    strokes,
    pen = null,
    onink
  }: { strokes: Stroke[]; pen?: { color: string; size: number } | null; onink?: (ink: Ink) => void } = $props();

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  /** 描いているポインタ。描くのは 1 本だけ */
  let pointer: number | null = null;
  let kind = '';
  /** 一度ペンが触れたら指では描かない（Pencil を持つ手のひらが線になる） */
  let penSeen = false;
  let last: [number, number] = [0, 0];
  /** 送っていない点。1 フレームぶんをまとめて送る */
  let pending: number[] = [];
  /** 前に描いた線。足された点だけを描き足すのに使う */
  let drawn: Stroke[] = [];

  function add(x: number, y: number) {
    // 描く時間が終わっても指を置いたままだと、自分の絵にだけ線が足されてほかの人の絵と食い違う
    if (!pen) return;
    if (Math.hypot(x - last[0], y - last[1]) < 0.003) return;
    last = [x, y];
    pending.push(x, y);
  }

  function flush() {
    if (pending.length && pen) onink?.({ k: 'add', pts: pending });
    pending = [];
  }

  const input = new BoardInput({
    down: (event, x, y) => {
      if (!pen) return;
      const isPen = event.pointerType === 'pen';
      if (!isPen && penSeen) return;
      if (pointer !== null) {
        if (!isPen || kind === 'pen') return;
        flush();
        onink?.({ k: 'undo' });
      }
      if (isPen) penSeen = true;
      pointer = event.pointerId;
      kind = event.pointerType;
      last = [x, y];
      pending = [];
      onink?.({ k: 'start', color: pen.color, size: pen.size, x, y });
    },
    move: (event) => {
      if (event.pointerId !== pointer) return;
      const events = event.getCoalescedEvents?.() ?? [];
      for (const e of events.length ? events : [event]) add(...input.at(e));
    },
    up: (event, _finger, x, y) => {
      if (event.pointerId !== pointer) return;
      add(x, y);
      flush();
      pointer = null;
    }
  });

  /** 最後の線に点が足されただけなら、その点だけを描き足す */
  function paint(next: Stroke[]) {
    if (!ctx) return;
    const prev = drawn;
    drawn = next;
    const a = prev.at(-1);
    const b = next.at(-1);
    const kept = (n: number) => prev.slice(0, n).every((s, i) => s === next[i]);
    const grew = a && b && b.color === a.color && b.pts[0] === a.pts[0] && b.pts.length >= a.pts.length;
    if (grew && next.length === prev.length && kept(prev.length - 1)) renderTail(ctx, b, a.pts.length / 2);
    else if (b && next.length === prev.length + 1 && kept(prev.length)) renderTail(ctx, b, 0);
    else render(ctx, next);
  }

  function resize() {
    const [w, h] = input.px(1, 1);
    const dpr = devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx = canvas.getContext('2d');
    if (!ctx) return;
    // 大きさを変えると canvas は消えるので、描き足しではなく全部描き直す
    render(ctx, strokes);
    drawn = strokes;
  }

  $effect(() => {
    // ctx より先に strokes を読む。ctx が無い最初の回に strokes を読まないと、この effect が何も追わなくなる
    const next = strokes;
    paint(next);
  });

  onMount(() => animate(flush));
</script>

<div class="board" class:live={pen} use:input.board={resize}>
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .board {
    position: relative;
    width: min(100cqw, 100cqh);
    aspect-ratio: 1;
    border: 3px solid var(--line);
    border-radius: 12px;
    overflow: hidden;
    background: #fff;
    touch-action: none;
  }

  .board.live {
    cursor: crosshair;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
