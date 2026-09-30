import { sfx } from '$lib/audio.svelte';
import type { RunFx } from './effects';
import type { RunEvent, RunState } from './engine';
import { sounds } from './sounds';
import type { RunWorld } from './world3d';

/** engine の出来事を 3D・重ね描き・音へ配る */
export function direct(events: RunEvent[], s: RunState, world: RunWorld | undefined, fx: RunFx): void {
  for (const e of events) {
    world?.handle(e);
    fx.handle(e, s);
    if (e.type === 'shot') sounds.shot();
    else if (e.type === 'hit') sounds.hit(e.combo);
    else if (e.type === 'miss') sounds.miss();
    else if (e.type === 'jump') sounds.jump();
    else if (e.type === 'bump') sounds.bump();
    else if (e.type === 'boss-in') sounds.bossIn();
    else if (e.type === 'boss-hit') sounds.bossHit();
    else if (e.type === 'boss-down') sounds.bossDown();
    else if (e.type === 'throw') sounds.throw();
    else if (e.type === 'goal') sfx.finish();
    else if (e.type === 'timeout') sounds.timeout();
  }
}
