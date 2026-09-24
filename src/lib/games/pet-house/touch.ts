import { BoardInput } from '$lib/board-input';
import { velocity } from '$lib/fingers';
import type { Session } from './session.svelte';

/**
 * 盤面の指を Session の down / move / up へ渡す BoardInput。座標は盤面の中のピクセル、はじく速さはピクセル毎秒。
 * session は onMount で作られるので、作る前の指は捨てる
 */
export function createInput(session: () => Session | undefined): BoardInput {
  const input: BoardInput = new BoardInput({
    down: (event, x, y) => session()?.down(event.pointerId, ...input.px(x, y)),
    up: (event, finger, x, y) => {
      const v = velocity(finger.trail);
      session()?.up(event.pointerId, ...input.px(x, y), ...input.px(v.vx, v.vy));
    }
  });
  // BoardInput には指が動いたときの hook がないので、move を包む。
  // board（use:input.board）は付けたときの this.move を登録するので、ここで差し替えれば効く
  const move = input.move;
  input.move = (event) => {
    move(event);
    const f = input.fingers.all.get(event.pointerId);
    if (f) session()?.move(event.pointerId, ...input.px(f.x, f.y));
  };
  return input;
}
