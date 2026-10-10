import type { Seat } from '$lib/net/party.svelte';
import { placeOf } from './mansion/layout';
import { newMatch, view, type GameMode, type Role, type View } from './referee';

export const MODES: Record<GameMode, { name: string; lines: [string, string]; color: string }> = {
  normal: { name: '通常', lines: ['鬼と人間に分かれて隠れる。', '1人でも最後まで隠れ切ると勝利'], color: '#7cc243' },
  infect: { name: '増え鬼', lines: ['捕まると鬼になる。', '最後まで隠れ切ると勝利'], color: '#7cc243' },
  // 本家の紹介では、ダブルだけモード名がマゼンタ
  double: {
    name: 'ダブル',
    lines: ['最初に全員で隠れる。', 'その後全員で探索し、最初に全員見つければ勝利'],
    color: '#e8399c'
  }
};

export const WINNER = { chameleon: '勝者カメレオン!', hunter: '勝者ハンター!' } as const;

/** 席の呼び名。CPU と遊ぶでは自分がいつも席 1 なので、CPU は席 2 から順に CPU 1・CPU 2 */
export const nameOf = (seat: Seat, looks: Record<number, string> = {}) =>
  looks[seat] === 'cpu' ? `CPU ${seat - 1}` : `プレイヤー${seat}`;

/** 答え合わせの勝者の言葉。決着の前は null */
export function winnerText(v: View, looks: Record<number, string> = {}): string | null {
  if (!v.winner) return null;
  if (v.winner === 'double') return v.champ === null ? '勝者なし' : `勝者 ${nameOf(v.champ, looks)}!`;
  return WINNER[v.winner];
}

export class Match {
  view = $state.raw<View>(view(newMatch()));
  left = $state(0);
  /** 自分の次の強制挑発までの秒。探索中の隠れる人で、強制挑発があるときだけ */
  taunt = $state<number | null>(null);
  /** 戻った子は、親から最初の様子が届くまで自分の動きを送らない */
  synced = $state(false);
  // 子の席の番号はつないだあとに Party へ届くので、値ではなく関数で受ける
  readonly #me: () => Seat;
  // 動物（CPU の印）は顔ぶれと一緒に Party へ届くので、値ではなく関数で受ける
  readonly #looks: () => Record<number, string>;

  constructor(me: () => Seat, looks: () => Record<number, string> = () => ({})) {
    this.#me = me;
    this.#looks = looks;
  }

  name(seat: Seat): string {
    return nameOf(seat, this.#looks());
  }

  get me(): Seat {
    return this.#me();
  }

  get phase(): View['phase'] {
    return this.view.phase;
  }

  receive(v: View): void {
    this.view = v;
    this.left = v.left;
    this.taunt = v.taunts[this.me] ?? null;
    this.synced = true;
  }

  advance(dt: number): void {
    if (this.phase === 'lobby') return;
    this.left = Math.max(0, this.left - dt);
    if (this.taunt !== null && this.phase === 'search') this.taunt = Math.max(0, this.taunt - dt);
  }

  roleOf(seat: Seat): Role | null {
    return this.view.roles[seat] ?? null;
  }

  get role(): Role | null {
    return this.roleOf(this.me);
  }

  found(seat: Seat = this.me): boolean {
    return this.view.found.includes(seat);
  }

  /** 通常で見つかった人のほか、試合の途中から来た人と抜けて戻ったハンター（役が out）も観戦する */
  watching(seat: Seat = this.me): boolean {
    return this.roleOf(seat) === 'out' || (this.view.settings.mode === 'normal' && this.found(seat));
  }

  /** HUD の白い人形と残り人数に使う、まだ見つかっていない隠れる人の数 */
  get hiders(): number {
    return (Object.entries(this.view.roles) as [string, Role][]).filter(
      ([s, r]) => r === 'hider' && !this.view.found.includes(Number(s) as Seat)
    ).length;
  }

  get hunters(): number {
    return Object.values(this.view.roles).filter((r) => r === 'hunter').length;
  }

  get hiding(): boolean {
    return this.role === 'hider' && !this.found();
  }

  get word(): string {
    if (this.phase === 'hide' || this.phase === 'intro') return '探索開始まで';
    if (this.phase === 'reveal') return '答え合わせ';
    if (this.double) return '全員を見つけよう';
    return this.hiding ? '隠れつづけよう' : '探索時間';
  }

  get double(): boolean {
    return this.view.settings.mode === 'double';
  }

  /** ダブルの順位表。見つけた数の多い順、同じ数なら先にその数に届いた順 */
  get ranking(): { seat: Seat; got: number; need: number }[] {
    const v = this.view;
    const need = Math.max(0, v.hid.length - 1);
    const at = (s: Seat) => v.reached[s] ?? Infinity;
    return v.hid
      .map((seat) => ({ seat, got: v.caught[seat]?.length ?? 0, need }))
      .sort((a, b) => b.got - a.got || (at(a.seat) === at(b.seat) ? a.seat - b.seat : at(a.seat) - at(b.seat)));
  }

  /** 自分（ハンター）の見落とした敵。点の多い順で、1 点に満たない人は出さない */
  get overlooked(): { seat: Seat; pts: number }[] {
    return (Object.entries(this.view.overlook[this.me] ?? {}) as [string, number][])
      .map(([s, pts]) => ({ seat: Number(s) as Seat, pts }))
      .filter((r) => r.pts > 0)
      .sort((a, b) => b.pts - a.pts || a.seat - b.seat);
  }

  /** 答え合わせの「見落とされた場所」。隠れた人ごとの全ハンターの点の合計と、いた部屋 */
  get spotted(): { seat: Seat; pts: number; place: string | null }[] {
    const v = this.view;
    return v.hid
      .map((seat) => {
        const spot = v.spots[seat];
        const pts = Object.values(v.overlook).reduce((n, row) => n + (row?.[seat] ?? 0), 0);
        return { seat, pts, place: spot ? placeOf(spot) : null };
      })
      .sort((a, b) => b.pts - a.pts || a.seat - b.seat);
  }
}
