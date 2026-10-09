import type { Seat } from '$lib/net/party.svelte';
import { newMatch, view, type GameMode, type Role, type View } from './referee';

export const MODES: Record<GameMode, { name: string; lines: [string, string] }> = {
  normal: { name: '通常', lines: ['鬼と人間に分かれて隠れる。', '1人でも最後まで隠れ切ると勝利'] },
  infect: { name: '増え鬼', lines: ['捕まると鬼になる。', '最後まで隠れ切ると勝利'] }
};

export const WINNER = { chameleon: '勝者カメレオン!', hunter: '勝者ハンター!' } as const;

export const nameOf = (seat: Seat) => `プレイヤー${seat}`;

export class Match {
  view = $state.raw<View>(view(newMatch()));
  left = $state(0);
  /** 自分の次の強制挑発までの秒。探索中の隠れる人で、強制挑発があるときだけ */
  taunt = $state<number | null>(null);
  /** 戻った子は、親から最初の様子が届くまで自分の動きを送らない */
  synced = $state(false);
  // 子の席の番号はつないだあとに Party へ届くので、値ではなく関数で受ける
  readonly #me: () => Seat;

  constructor(me: () => Seat) {
    this.#me = me;
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
    return this.hiding ? '隠れつづけよう' : '探索時間';
  }
}
