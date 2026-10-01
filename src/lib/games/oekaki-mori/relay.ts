import type { Seat } from '$lib/net/party.svelte';
import { fit, LENGTHS, type Chars, type Length } from './engine';
import { apply, type Ink, type Stroke } from './strokes';

/** だんの数。偶数のだんは描く、奇数のだんは当てるので、最後は必ず当てる */
export const STEPS: Record<Length, number> = { short: 4, normal: 6, long: 8 };
export const GUESS_S = 30;
export const UNKNOWN = '（わからなかった）';

export type Entry =
  | { kind: 'prompt'; text: string }
  | { kind: 'draw'; by: Seat; strokes: Stroke[] }
  | { kind: 'guess'; by: Seat; text: string | null };

export interface Chain {
  start: string;
  entries: Entry[];
}

export interface Relay {
  /** 始めたときの並び。受け持ちはこの並びで回す */
  players: Seat[];
  /** いまつながっている人 */
  present: Seat[];
  steps: number;
  step: number;
  left: number;
  /** 描くだんの秒数 */
  draw: number;
  phase: 'play' | 'reveal' | 'done';
  chains: Chain[];
  /** いまのだんのこまを終えた人 */
  done: Seat[];
  used: string[];
  /** お題の字数の上限。最初のお題と、わからなかったあとに配り直すお題に効く */
  chars: Chars;
  page: { chain: number; index: number };
}

export type Task = { kind: 'draw'; word: string } | { kind: 'guess'; strokes: Stroke[] } | { kind: 'wait' };

const drawing = (step: number) => step % 2 === 0;

function pick(s: Relay, rand: () => number, words: readonly string[], chars: Chars): string {
  let pool = fit(words, chars).filter((w) => !s.used.includes(w));
  if (!pool.length) pool = [...fit(words, chars)];
  const word = pool[Math.floor(rand() * pool.length)];
  s.used.push(word);
  return word;
}

/** リレー c の k だん目を受け持つ人。自分のリレーを続けて受け持たないよう、だんごとに 1 人ずつずらす */
export function assignee(s: Relay, chain: number, step: number): Seat {
  return s.players[(chain + step) % s.players.length];
}

/** いまのだんでその人が受け持つリレー。受け持たないなら -1 */
export function chainOf(s: Relay, seat: Seat): number {
  return s.chains.findIndex((_, c) => assignee(s, c, s.step) === seat);
}

/** そのリレーで、次に描く言葉（最後の答えか、配り直したお題か、最初のお題） */
function wordOf(chain: Chain): string {
  for (let i = chain.entries.length - 1; i >= 0; i--) {
    const e = chain.entries[i];
    if (e.kind === 'prompt') return e.text;
    if (e.kind === 'guess' && e.text !== null) return e.text;
  }
  return chain.start;
}

/** だんを始める。いない人のこまは、待たせないようにすぐ埋める */
function open(s: Relay, rand: () => number, words: readonly string[], chars: Chars) {
  s.done = [];
  s.left = drawing(s.step) ? s.draw : GUESS_S;
  s.chains.forEach((chain, c) => {
    const by = assignee(s, c, s.step);
    if (drawing(s.step)) {
      const last = chain.entries.at(-1);
      if (last?.kind === 'guess' && last.text === null)
        chain.entries.push({ kind: 'prompt', text: pick(s, rand, words, chars) });
      chain.entries.push({ kind: 'draw', by, strokes: [] });
    } else chain.entries.push({ kind: 'guess', by, text: null });
    if (!s.present.includes(by)) s.done.push(by);
  });
}

export function createRelay(
  players: Seat[],
  rand: () => number,
  words: readonly string[],
  length: Length,
  chars: Chars
): Relay {
  const s: Relay = {
    players: [...players],
    present: [...players],
    steps: STEPS[length],
    step: 0,
    left: 0,
    draw: LENGTHS[length].draw.hayaoshi,
    phase: 'play',
    chains: [],
    done: [],
    used: [],
    chars,
    page: { chain: 0, index: 0 }
  };
  s.chains = players.map(() => ({ start: pick(s, rand, words, chars), entries: [] }));
  open(s, rand, words, chars);
  return s;
}

export function taskOf(s: Relay, seat: Seat): Task {
  if (s.phase !== 'play' || s.done.includes(seat)) return { kind: 'wait' };
  const c = chainOf(s, seat);
  if (c < 0) return { kind: 'wait' };
  const chain = s.chains[c];
  if (drawing(s.step)) return { kind: 'draw', word: wordOf({ ...chain, entries: chain.entries.slice(0, -1) }) };
  const prev = chain.entries.at(-2);
  return { kind: 'guess', strokes: prev?.kind === 'draw' ? prev.strokes : [] };
}

export function addInk(s: Relay, seat: Seat, ink: Ink): void {
  if (s.phase !== 'play' || !drawing(s.step) || s.done.includes(seat)) return;
  const c = chainOf(s, seat);
  const entry = s.chains[c]?.entries.at(-1);
  if (entry?.kind === 'draw') entry.strokes = apply(entry.strokes, ink);
}

export function finish(s: Relay, seat: Seat, text?: string): void {
  if (s.phase !== 'play' || s.done.includes(seat)) return;
  const c = chainOf(s, seat);
  if (c < 0) return;
  const entry = s.chains[c].entries.at(-1);
  if (entry?.kind === 'guess') entry.text = text?.trim() || null;
  s.done.push(seat);
}

function advance(s: Relay, rand: () => number, words: readonly string[]) {
  s.step++;
  if (s.step >= s.steps) {
    s.phase = 'reveal';
    s.page = { chain: 0, index: 0 };
    return;
  }
  open(s, rand, words, s.chars);
}

/** 時間を進める。時間切れの当てるこまは、打ちかけの字（typed）を答えにする */
export function tick(
  s: Relay,
  dt: number,
  rand: () => number,
  words: readonly string[],
  typed: Record<number, string>
): void {
  if (s.phase !== 'play') return;
  s.left -= dt;
  if (s.left <= 0)
    s.chains.forEach((chain, c) => {
      const by = assignee(s, c, s.step);
      if (s.done.includes(by)) return;
      const entry = chain.entries.at(-1);
      if (entry?.kind === 'guess') entry.text = typed[by]?.trim() || null;
      s.done.push(by);
    });
  if (s.chains.every((_, c) => s.done.includes(assignee(s, c, s.step)))) advance(s, rand, words);
}

/** 抜けた人のいまのこまは、描きかけの線や打った答えのまま埋める。1 人になったらふりかえりへ */
export function leave(s: Relay, seat: Seat): void {
  s.present = s.present.filter((p) => p !== seat);
  if (s.phase === 'play' && chainOf(s, seat) >= 0 && !s.done.includes(seat)) s.done.push(seat);
  if (s.phase === 'play' && s.present.length < 2) {
    s.phase = 'reveal';
    s.page = { chain: 0, index: 0 };
  }
}

export function rejoin(s: Relay, seat: Seat): void {
  if (s.players.includes(seat) && !s.present.includes(seat)) s.present = [...s.present, seat];
}

export function pageOf(s: Relay): { chain: number; index: number; entry: Entry; last: boolean } | null {
  if (s.phase === 'play') return null;
  const { chain, index } = s.page;
  const c = s.chains[chain];
  if (!c) return null;
  const entry: Entry = index === 0 ? { kind: 'prompt', text: c.start } : c.entries[index - 1];
  return { chain, index, entry, last: index === c.entries.length };
}

export function next(s: Relay): void {
  if (s.phase !== 'reveal') return;
  const c = s.chains[s.page.chain];
  if (s.page.index < c.entries.length) s.page = { ...s.page, index: s.page.index + 1 };
  else if (s.page.chain < s.chains.length - 1) s.page = { chain: s.page.chain + 1, index: 0 };
  else s.phase = 'done';
}
