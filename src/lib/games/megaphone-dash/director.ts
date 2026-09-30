import type { RunFx } from './effects';
import type { RunEvent, RunState } from './engine';
import { sounds } from './sounds';
import type { RunWorld } from './world3d';

/** engine の出来事を 3D・重ね描き・音へ配る。戻り値は、手ごたえのために画面を止める秒 */
export function direct(events: RunEvent[], s: RunState, world: RunWorld | undefined, fx: RunFx): number {
  let stop = 0;
  for (const e of events) {
    world?.handle(e);
    fx.handle(e, s);
    if (e.type === 'hit') {
      sounds.hit(e.combo, e.walkers.length);
      if (e.walkers.length >= 5) stop = Math.max(stop, 0.05);
    } else if (e.type === 'drop') sounds.drop();
    else if (e.type === 'bump') {
      sounds.bump();
      stop = Math.max(stop, 0.08);
    } else if (e.type === 'gauge') sounds.gauge();
    else if (e.type === 'shout') {
      sounds.shout();
      stop = Math.max(stop, 0.12);
    } else if (e.type === 'boss-in') {
      sounds.bossIn();
      stop = Math.max(stop, 0.25);
    } else if (e.type === 'boss-hit') {
      sounds.bossHit(e.big);
      if (e.big) stop = Math.max(stop, 0.1);
    } else if (e.type === 'boss-down') {
      sounds.bossDown();
      stop = Math.max(stop, 0.3);
    } else if (e.type === 'throw') sounds.throw();
    else if (e.type === 'land') sounds.land();
    else if (e.type === 'zone') sounds.zone();
    else if (e.type === 'goal') sounds.goal();
    else if (e.type === 'timeout') sounds.timeout();
  }
  return stop;
}
