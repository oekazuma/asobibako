import { movesUsed, type Pick } from './engine';
import type { Block, Puzzle } from './types';

/** 「答える」で出す答えの入力中の中身。なぞの種類ごとに使うものだけが変わる */
export class Entry {
  readonly p: Puzzle;
  digits = $state('');
  /** tap は選んだ spots、word は押したタイルの並び、place は駒を置いたます目 */
  picked = $state<number[]>([]);
  on = $state<number[]>([]);
  /** 持ち上げている棒（コイン）がもとあった slot */
  lifted = $state<number | null>(null);
  /** 線を曲げた pegs の添え字。はじめの点も入る */
  path = $state<number[]>([]);
  /** スライドパズルのいまの並びと、動かした回数 */
  blocks = $state.raw<Block[]>([]);
  moves = $state(0);

  constructor(p: Puzzle) {
    this.p = p;
    this.reset();
  }

  reset() {
    this.on = this.p.kind === 'sticks' ? [...this.p.on] : [];
    this.lifted = null;
    this.path = [];
    this.blocks = this.p.kind === 'slide' ? this.p.blocks : [];
    this.moves = 0;
    if (this.p.kind === 'place') this.picked = [];
  }

  /** lines の最後の点を取り消す */
  undo() {
    this.path = this.path.slice(0, -1);
  }

  /** sticks は動かせる残りの数（持ち上げている棒は置くまで数えない）、lines は引ける残りの本数 */
  get left(): number {
    if (this.p.kind === 'lines') return this.p.segments - Math.max(0, this.path.length - 1);
    if (this.p.kind !== 'sticks') return 0;
    return this.p.moves - movesUsed(this.p, this.lifted === null ? this.on : [...this.on, this.lifted]);
  }

  /** 答えられる形になった。tap は決まった数を、sticks と lines は決まった回数ぶんを使いきるまで出せない */
  get ready(): boolean {
    switch (this.p.kind) {
      case 'number':
        return this.digits !== '';
      case 'tap':
        return this.picked.length === this.p.answer.length;
      case 'sticks':
        return this.lifted === null && this.left === 0;
      case 'lines':
        return this.path.length === this.p.segments + 1;
      case 'word':
        return this.picked.length > 0;
      case 'place':
        return this.picked.length === this.p.count;
      default:
        return false;
    }
  }

  get value(): Pick {
    if (this.p.kind === 'number') return Number(this.digits);
    if (this.p.kind === 'lines') return this.path;
    return this.p.kind === 'sticks' ? this.on : this.picked;
  }
}
