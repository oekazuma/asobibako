<script lang="ts">
  import { onDestroy } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { capture, toBoardPoint, TURNED_QUERY } from '$lib/board-input';
  import { iceDone, iceSlide } from './engine';
  import { sounds } from './sounds';
  import type { IceQ, Point } from './types';

  let {
    p,
    at = $bindable(),
    moves = $bindable(),
    onsolve
  }: { p: IceQ; at: Point; moves: number; onsolve: () => void } = $props();

  /** 1 ます滑るのにかかる時間 */
  const STEP_MS = 110;

  let board: HTMLDivElement;
  /** 滑っている途中。そのあいだの入力は受けない */
  let busy = $state(false);
  let done = false;
  let ms = $state(0);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => clearTimeout(timer));

  function go(dx: number, dy: number) {
    if (busy || done) return;
    const next = iceSlide(p, at, dx, dy);
    const dist = Math.abs(next.x - at.x) + Math.abs(next.y - at.y);
    if (!dist) return sounds.wrong();
    ms = dist * STEP_MS;
    at = next;
    moves += 1;
    busy = true;
    sounds.pick();
    timer = setTimeout(() => {
      busy = false;
      if (!iceDone(p, next)) return;
      done = true;
      timer = setTimeout(onsolve, 300);
    }, ms);
  }

  // 横向きで .stage が回っていても、盤そのものの向きのます目で数える
  function cell(event: PointerEvent): [number, number] {
    const turned = matchMedia(TURNED_QUERY).matches;
    const [x, y] = toBoardPoint(event.clientX, event.clientY, board.getBoundingClientRect(), turned);
    return [x * p.cols, y * p.rows];
  }

  let swipe: { id: number; from: [number, number] } | null = null;

  function down(event: PointerEvent) {
    if (swipe) return;
    capture(event);
    swipe = { id: event.pointerId, from: cell(event) };
  }

  /** 指を離したとき、動いた向きが 1/3 ます以上なら、その向きへ滑る */
  function up(event: PointerEvent) {
    if (swipe?.id !== event.pointerId) return;
    const [x, y] = cell(event);
    const [dx, dy] = [x - swipe.from[0], y - swipe.from[1]];
    swipe = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 1 / 3) return;
    if (Math.abs(dx) >= Math.abs(dy)) go(Math.sign(dx), 0);
    else go(0, Math.sign(dy));
  }

  const pct = (n: number, of: number) => `${(n / of) * 100}%`;
  const ARROWS = [
    { label: '左へ', t: '←', d: [-1, 0] },
    { label: '上へ', t: '↑', d: [0, -1] },
    { label: '下へ', t: '↓', d: [0, 1] },
    { label: '右へ', t: '→', d: [1, 0] }
  ] as const;
</script>

<div class="ice">
  <div
    class="board"
    bind:this={board}
    style:--cols={p.cols}
    style:--rows={p.rows}
    role="application"
    aria-label="氷の湖。スワイプで滑る"
    onpointerdown={down}
    onpointerup={up}
    onpointercancel={() => (swipe = null)}
  >
    <span class="goal" style:left={pct(p.goal.x, p.cols)} style:top={pct(p.goal.y, p.rows)}>
      <span class="tag">出口</span>
    </span>
    {#each p.rocks as r (`${r.x},${r.y}`)}
      <span class="rock" style:left={pct(r.x, p.cols)} style:top={pct(r.y, p.rows)}></span>
    {/each}
    <span class="me" style:left={pct(at.x, p.cols)} style:top={pct(at.y, p.rows)} style:transition-duration="{ms}ms">
      <Icon name="detective" size="100%" />
    </span>
  </div>
  <div class="pad">
    {#each ARROWS as a (a.label)}
      <button class="pill" aria-label={a.label} disabled={busy} onclick={() => go(a.d[0], a.d[1])}>{a.t}</button>
    {/each}
  </div>
</div>

<style>
  .ice {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .board {
    position: relative;
    width: min(100cqw, calc((100cqh - 62px) * var(--cols) / var(--rows)));
    aspect-ratio: var(--cols) / var(--rows);
    border: 4px solid var(--line);
    border-radius: 12px;
    /* ます目の線と、斜めに走る細いひび */
    background:
      linear-gradient(90deg, #b9dff5 1px, #0000 1px) 0 0 / calc(100% / var(--cols)) 100%,
      linear-gradient(#b9dff5 1px, #0000 1px) 0 0 / 100% calc(100% / var(--rows)),
      repeating-linear-gradient(118deg, #0000 0 46px, #fff9 46px 48px, #0000 48px 90px),
      linear-gradient(160deg, #eaf8ff, #cdeaff);
    touch-action: none;
  }

  .goal,
  .rock,
  .me {
    position: absolute;
    width: calc(100% / var(--cols));
    height: calc(100% / var(--rows));
  }

  /* 出口は氷に空いた穴 */
  .goal {
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: radial-gradient(circle, #2e6f9e 0 45%, #6fb5e0 58%, #0000 70%);
  }

  .tag {
    padding: 1px 8px;
    border: 2px solid var(--line);
    border-radius: 999px;
    background: var(--pastel-gold);
    color: var(--line);
    font-size: clamp(10px, 2.2cqh, 14px);
    font-weight: 800;
  }

  .rock {
    border: 3px solid var(--line);
    border-radius: 40% 46% 38% 44%;
    background: radial-gradient(circle at 35% 30%, #c9c3bb, #8f877d);
    background-clip: padding-box;
    scale: 0.86;
  }

  .me {
    /* padding の % は盤の幅に対してなので、1 ます分に直してから取る */
    padding: calc(8% / var(--cols));
    transition-property: left, top;
    transition-timing-function: cubic-bezier(0.2, 0.6, 0.4, 1);
    filter: drop-shadow(0 3px 0 rgb(91 74 66 / 0.25));
  }

  .pad {
    display: flex;
    gap: 8px;
  }

  .pill {
    width: 52px;
    height: 52px;
    padding: 0;
    font-size: 24px;
  }

  .pill:disabled {
    opacity: 0.5;
  }

  @media (prefers-reduced-motion: reduce) {
    .me {
      transition: none;
    }
  }
</style>
