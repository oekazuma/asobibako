import type { Advice } from '../advice';
import { ANIMALS } from '../animals';
import { expression, germPos, TRASH, type GameState } from '../engine';
import { drawGerm } from './germ';
import { drawPatient } from './patient';
import { drawGhost, drawTool, drawTrash } from './scene';
import { drawTeeth } from './teeth';

export { backdrop } from './scene';

export interface PaintOptions {
  /** 道具の先端。指を置いていなければ null */
  tip: readonly [number, number] | null;
  ghost: Advice | null;
  lid: number;
  /** prefers-reduced-motion。震えを止める */
  still: boolean;
}

export function paint(ctx: CanvasRenderingContext2D, g: GameState, o: PaintOptions): void {
  const a = ANIMALS[g.stage.animal];
  const e = expression(g);
  const shiver = e === 'hurt' && !o.still ? (Math.random() - 0.5) * 0.008 : 0;
  const breathe = o.still ? 0 : Math.sin(g.time * 2) * 0.004;
  ctx.save();
  ctx.translate(shiver, breathe);
  drawPatient(ctx, a, e, g.time, (c) => drawTeeth(c, g, o.still));
  ctx.restore();
  drawTrash(ctx, o.lid);
  for (const germ of g.germs) {
    if (germ.gone) continue;
    const [x, y] = germPos(germ, g.time);
    drawGerm(ctx, x, y, germ.kind, g.time, { held: germ.held, age: g.time - germ.born });
  }
  if (o.ghost) drawGhost(ctx, o.ghost, g.time, [TRASH.x, TRASH.y]);
  if (o.tip) drawTool(ctx, g.tool, o.tip, g.last !== null, o.still);
}
