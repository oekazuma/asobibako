import type { Message } from '$lib/net/link';
import type { Pipe } from '$lib/net/party.svelte';

/**
 * 手元でつないだ 2 本の管。Link と同じく JSON で写して渡し（$state の配列を相手に持たせない）、最初の聞き手が付くまで
 * 届いた知らせをためる。知らせは送った呼び出しの中で渡すので、受けた側はその中で送り返さない（CPU は step でだけ送る）
 */
export function pipes(): [Pipe, Pipe] {
  const listeners = [new Set<(m: Message) => void>(), new Set<(m: Message) => void>()];
  const early: Message[][] = [[], []];
  let open = true;
  let close!: () => void;
  const closed = new Promise<void>((resolve) => (close = resolve));
  const end = (me: 0 | 1): Pipe => ({
    send: (m) => {
      if (!open) return;
      const copy = JSON.parse(JSON.stringify(m)) as Message;
      if (!listeners[1 - me].size) early[1 - me].push(copy);
      for (const l of listeners[1 - me]) l(copy);
    },
    on: (l) => {
      listeners[me].add(l);
      for (const m of early[me].splice(0)) l(m);
      return () => listeners[me].delete(l);
    },
    closed,
    close: () => {
      open = false;
      close();
    }
  });
  return [end(0), end(1)];
}
