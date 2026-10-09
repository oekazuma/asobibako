import type { Seat } from '$lib/net/party.svelte';

export type Phase = 'lobby' | 'intro' | 'hide' | 'search' | 'reveal';
export type GameMode = 'normal' | 'infect';
/** out は試合から抜けたハンターと、試合の途中で来た人（観戦する） */
export type Role = 'hider' | 'hunter' | 'out';
export type Winner = 'chameleon' | 'hunter';

export interface Settings {
  mode: GameMode;
  hunters: number;
  hide: number;
  search: number;
  reveal: number;
  taunt: number;
}

export const DEFAULTS: Settings = { mode: 'infect', hunters: 1, hide: 60, search: 300, reveal: 30, taunt: 0 };
export const LIMITS = { hide: [30, 300], search: [60, 600], reveal: [10, 120], taunt: [5, 120] } as const;
export const INTRO = 3;
export const COOLDOWN = 2;
export const TOOT_GAP = 1;

/** 小さな dt を足し重ねたずれで、0 になるはずの時計が 0 の手前に残らないようにする */
const EPS = 1e-6;

const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, Math.round(v)));

export function fit(s: Settings, players: number): Settings {
  return {
    mode: s.mode === 'normal' ? 'normal' : 'infect',
    hunters: clamp(s.hunters, [1, Math.max(1, players - 1)]),
    hide: clamp(s.hide, LIMITS.hide),
    search: clamp(s.search, LIMITS.search),
    reveal: clamp(s.reveal, LIMITS.reveal),
    taunt: s.taunt <= 0 ? 0 : clamp(s.taunt, LIMITS.taunt)
  };
}

export interface Match {
  phase: Phase;
  left: number;
  settings: Settings;
  roles: Partial<Record<Seat, Role>>;
  /** 最初のハンター（増え鬼で全員見つかったときの勝者） */
  first: Seat[];
  found: Seat[];
  winner: Winner | null;
  ready: Seat[];
  wishes: Seat[];
  /** 次の強制挑発までの秒（見つかっていない隠れる人ごと。探索のあいだだけ減り、ほかのフェーズでは止まる） */
  taunts: Partial<Record<Seat, number>>;
  clock: number;
  shots: Partial<Record<Seat, number>>;
  toots: Partial<Record<Seat, number>>;
}

export const newMatch = (): Match => ({
  phase: 'lobby',
  left: 0,
  settings: DEFAULTS,
  roles: {},
  first: [],
  found: [],
  winner: null,
  ready: [],
  wishes: [],
  taunts: {},
  clock: 0,
  shots: {},
  toots: {}
});

function shuffle<T>(list: T[], rand: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pickHunters(wishes: Seat[], members: Seat[], n: number, rand: () => number): Seat[] {
  const keen = shuffle(
    members.filter((s) => wishes.includes(s)),
    rand
  );
  const rest = shuffle(
    members.filter((s) => !wishes.includes(s)),
    rand
  );
  return [...keen, ...rest].slice(0, n).sort((a, b) => a - b);
}

export const seatsOf = (m: Match, role: Role): Seat[] =>
  (Object.keys(m.roles).map(Number) as Seat[]).filter((s) => m.roles[s] === role);

export const hiding = (m: Match): Seat[] => seatsOf(m, 'hider').filter((s) => !m.found.includes(s));

export function start(m: Match, members: Seat[], settings: Settings, rand: () => number): void {
  const s = fit(settings, members.length);
  const hunters = pickHunters(m.wishes, members, s.hunters, rand);
  const hiders = members.filter((seat) => !hunters.includes(seat));
  Object.assign(m, {
    phase: 'intro',
    left: INTRO,
    settings: s,
    roles: Object.fromEntries(members.map((seat) => [seat, hunters.includes(seat) ? 'hunter' : 'hider'])),
    first: hunters,
    found: [],
    winner: null,
    ready: [],
    // 隠れタイムから答え合わせまで出し続ける（減るのは探索のあいだだけ）。間隔が 0 なら 0 のまま
    taunts: Object.fromEntries(hiders.map((seat) => [seat, s.taunt])),
    shots: {},
    toots: {}
  } satisfies Partial<Match>);
}

function enter(m: Match, phase: Phase): void {
  m.phase = phase;
  m.ready = [];
  if (phase === 'hide') m.left = m.settings.hide;
  else if (phase === 'search') m.left = m.settings.search;
  else if (phase === 'reveal') {
    m.left = m.settings.reveal;
    m.winner ??= hiding(m).length ? 'chameleon' : 'hunter';
  } else if (phase === 'lobby') {
    Object.assign(m, { left: 0, roles: {}, first: [], found: [], winner: null, taunts: {} } satisfies Partial<Match>);
  }
}

const NEXT: Record<Phase, Phase> = { lobby: 'lobby', intro: 'hide', hide: 'search', search: 'reveal', reveal: 'lobby' };

/** 時計を進める。探索のあいだ、強制挑発の時計が 0 になった隠れる人を返す（その人が吹く） */
export function tick(m: Match, dt: number): Seat[] {
  m.clock += dt;
  if (m.phase === 'lobby') return [];
  const toots: Seat[] = [];
  if (m.phase === 'search' && m.settings.taunt)
    for (const seat of hiding(m)) {
      const left = (m.taunts[seat] ?? m.settings.taunt) - dt;
      m.taunts[seat] = left;
      if (left > EPS) continue;
      m.taunts[seat] = left + m.settings.taunt;
      m.toots[seat] = m.clock;
      toots.push(seat);
    }
  m.left = m.left - dt > EPS ? m.left - dt : 0;
  if (m.left === 0) enter(m, NEXT[m.phase]);
  return toots;
}

/** もうええよ。いる人の全員が押したら、隠れタイムか答え合わせをすぐ終える */
export function ready(m: Match, seat: Seat, present: Seat[]): void {
  if (m.phase !== 'hide' && m.phase !== 'reveal') return;
  if (!m.ready.includes(seat)) m.ready = [...m.ready, seat];
  settle(m, present);
}

function settle(m: Match, present: Seat[]): void {
  if ((m.phase === 'hide' || m.phase === 'reveal') && present.every((s) => m.ready.includes(s)))
    enter(m, NEXT[m.phase]);
}

export function wish(m: Match, seat: Seat, on: boolean): void {
  m.wishes = on ? [...new Set([...m.wishes, seat])] : m.wishes.filter((s) => s !== seat);
}

/** 切れた。ハンターは試合から抜け、ハンターが全員抜けたら隠れる人の勝ちで答え合わせへ。隠れる人の体はその場に残る */
export function leave(m: Match, seat: Seat, present: Seat[]): void {
  m.wishes = m.wishes.filter((s) => s !== seat);
  m.ready = m.ready.filter((s) => s !== seat);
  if (m.phase === 'lobby') return;
  if (m.roles[seat] === 'hunter') m.roles[seat] = 'out';
  const live = ['intro', 'hide', 'search'].includes(m.phase);
  if (live && !seatsOf(m, 'hunter').some((s) => present.includes(s))) {
    m.winner = 'chameleon';
    enter(m, 'reveal');
    return;
  }
  settle(m, present);
}

/** 戻った・途中で来た。役を持っていた隠れる人はそのまま、持っていない人は観戦 */
export function join(m: Match, seat: Seat): void {
  if (m.phase !== 'lobby' && !m.roles[seat]) m.roles[seat] = 'out';
}

export function shoot(m: Match, seat: Seat): boolean {
  if (m.roles[seat] !== 'hunter' || (m.phase !== 'search' && m.phase !== 'reveal')) return false;
  if (m.clock - (m.shots[seat] ?? -Infinity) < COOLDOWN - EPS) return false;
  m.shots[seat] = m.clock;
  return true;
}

export function hit(m: Match, seat: Seat): boolean {
  if (m.phase !== 'search' || m.roles[seat] !== 'hider' || m.found.includes(seat)) return false;
  m.found = [...m.found, seat];
  if (m.settings.mode === 'infect') m.roles[seat] = 'hunter';
  delete m.taunts[seat];
  if (!hiding(m).length) enter(m, 'reveal');
  return true;
}

/** 口笛。ロビーでは全員、試合中は見つかっていない隠れる人だけが、1 秒あけて吹ける。自分で吹くと強制挑発の時計が巻き戻る */
export function toot(m: Match, seat: Seat): boolean {
  const may = m.phase === 'lobby' || (m.roles[seat] === 'hider' && !m.found.includes(seat));
  if (!may || m.clock - (m.toots[seat] ?? -Infinity) < TOOT_GAP - EPS) return false;
  m.toots[seat] = m.clock;
  if (m.phase === 'search' && m.settings.taunt) m.taunts[seat] = m.settings.taunt;
  return true;
}

export interface View {
  phase: Phase;
  left: number;
  settings: Settings;
  roles: Partial<Record<Seat, Role>>;
  first: Seat[];
  found: Seat[];
  winner: Winner | null;
  ready: Seat[];
  wishes: Seat[];
  /** 次の強制挑発までの秒（切り上げ） */
  taunts: Partial<Record<Seat, number>>;
}

export function view(m: Match): View {
  const { phase, settings, roles, first, found, winner, ready, wishes } = m;
  const taunts = Object.fromEntries(Object.entries(m.taunts).map(([s, v]) => [s, Math.ceil(v ?? 0)]));
  return { phase, left: m.left, settings, roles, first, found, winner, ready, wishes, taunts };
}
