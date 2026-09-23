<script lang="ts">
  import { movesUsed } from './engine';
  import { circle, g, line } from './fig';
  import Figure from './Figure.svelte';
  import { sounds } from './sounds';
  import type { Figure as Fig, Shape, Slot, SticksQ } from './types';

  let {
    p,
    fig,
    on = $bindable(),
    lifted = $bindable(null),
    onblock
  }: {
    p: SticksQ;
    fig: Fig;
    /** いま置いてある slot。持ち上げている棒は入らない */
    on: number[];
    /** 持ち上げている棒（コイン）がもとあった slot */
    lifted?: number | null;
    /** moves を超える置き方をしようとした */
    onblock: () => void;
  } = $props();

  /** 棒の両はしを縮めて、角でとなりの棒と重ならないようにする */
  const INSET = 3;
  const WOOD = '#f5c98f';
  const EMPTY = '#cdbcae';

  function ends(s: Extract<Slot, { x1: number }>) {
    const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
    const [ux, uy] = [(s.x2 - s.x1) / len, (s.y2 - s.y1) / len];
    const a = { x: s.x1 + ux * INSET, y: s.y1 + uy * INSET };
    const b = { x: s.x2 - ux * INSET, y: s.y2 - uy * INSET };
    // 頭は右（縦なら上）の端に付ける。角で隣の棒の頭とぶつからない向き
    const [tail, head] = b.x > a.x + 0.01 || (Math.abs(b.x - a.x) < 0.01 && b.y < a.y) ? [a, b] : [b, a];
    const k = 2 / len;
    return { tail, head: { x: head.x + (tail.x - head.x) * k, y: head.y + (tail.y - head.y) * k }, len };
  }

  function piece(s: Slot, placed: boolean, held: boolean): Shape {
    const halo = { stroke: '#ffd45c', 'stroke-width': 13 };
    if ('x1' in s) {
      const { tail, head } = ends(s);
      const stick = (a: Record<string, string | number>) => line(tail.x, tail.y, head.x, head.y, a);
      if (!placed && !held) return stick({ stroke: EMPTY, 'stroke-dasharray': '3 3' });
      return g(
        '',
        ...(held ? [stick(halo)] : []),
        stick({ 'stroke-width': 6 }),
        stick({ stroke: WOOD, 'stroke-width': 3.4 }),
        circle(head.x, head.y, 3, '#ff5a4f', { 'stroke-width': 1.4 })
      );
    }
    if (!placed && !held) return circle(s.x, s.y, 13, 'none', { stroke: EMPTY, 'stroke-dasharray': '4 4' });
    return g(
      '',
      ...(held ? [circle(s.x, s.y, 18, '#ffd45c', { stroke: 'none' })] : []),
      circle(s.x, s.y, 13, '#ffc233', { stroke: '#b57a00' }),
      circle(s.x, s.y, 9, 'none', { stroke: '#e39a00', 'stroke-width': 1.5 })
    );
  }

  // 空いた場所の点線が置いた棒にかぶらないよう、空き → 置いた棒の順に描き、押す場所も同じ順に重ねる
  const order = $derived(p.slots.map((_, i) => i).sort((a, b) => Number(on.includes(a)) - Number(on.includes(b))));
  const drawn = $derived({
    ...fig,
    s: [...fig.s, ...order.map((i) => piece(p.slots[i], on.includes(i), i === lifted))]
  });

  function press(i: number) {
    if (on.includes(i)) {
      // 別の棒を持っていたら、もとの場所へもどしてから持ちかえる
      on = [...(lifted === null ? on : [...on, lifted])].filter((j) => j !== i);
      lifted = i;
    } else if (lifted !== null) {
      const next = [...on, i];
      if (movesUsed(p, next) > p.moves) {
        sounds.wrong();
        onblock();
        return;
      }
      on = next;
      lifted = null;
    } else return;
    sounds.pick();
  }

  /** 押せる場所。棒は向きに合わせて回した細長い箱、コインは丸 */
  function hit(s: Slot) {
    if (!('x1' in s)) return { x: s.x, y: s.y, w: 32, h: 32, deg: 0, round: true };
    const { len } = ends(s);
    const deg = (Math.atan2(s.y2 - s.y1, s.x2 - s.x1) * 180) / Math.PI;
    return { x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2, w: len * 0.8, h: 14, deg, round: false };
  }
</script>

<Figure fig={drawn}>
  {#each order as i (i)}
    {@const b = hit(p.slots[i])}
    <button
      class="slot"
      class:round={b.round}
      style:left="{(b.x / fig.w) * 100}%"
      style:top="{(b.y / fig.h) * 100}%"
      style:width="{(b.w / fig.w) * 100}%"
      style:height="{(b.h / fig.h) * 100}%"
      style:rotate="{b.deg}deg"
      aria-label={on.includes(i) ? `${b.round ? 'コイン' : '棒'} ${i + 1}` : `空いている場所 ${i + 1}`}
      aria-pressed={i === lifted}
      onclick={() => press(i)}
    ></button>
  {/each}
</Figure>

<style>
  .slot {
    position: absolute;
    padding: 0;
    border: none;
    border-radius: 8px;
    background: none;
    translate: -50% -50%;
    cursor: pointer;
  }

  .slot.round {
    border-radius: 50%;
  }
</style>
