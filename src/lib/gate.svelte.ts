import { today } from './today';

export const GATE_KEY = 'asobibako:gate';
export const MAX_FAILS = 3;

function load(): number {
  try {
    const g: unknown = JSON.parse(localStorage.getItem(GATE_KEY) ?? 'null');
    if (typeof g !== 'object' || g === null) return 0;
    const { date, fails } = g as { date?: unknown; fails?: unknown };
    return date === today() && typeof fails === 'number' && Number.isInteger(fails) && fails >= 0 ? fails : 0;
  } catch {
    return 0;
  }
}

/** 保護者ゲート。掛け算に 1 日 3 回間違えると翌日までロックする（日付が変わればリセット） */
export class Gate {
  fails = $state(load());
  passed = $state(false);
  wrong = $state(false);
  readonly a: number;
  readonly b: number;

  constructor(rnd = Math.random) {
    this.a = Math.floor(rnd() * 7) + 3;
    this.b = Math.floor(rnd() * 7) + 3;
  }

  get locked() {
    return this.fails >= MAX_FAILS;
  }

  get left() {
    return MAX_FAILS - this.fails;
  }

  submit(ans: string | number): boolean {
    if (this.locked) return false;
    if (Number(ans) === this.a * this.b) {
      this.passed = true;
      return true;
    }
    this.fails++;
    this.wrong = true;
    try {
      localStorage.setItem(GATE_KEY, JSON.stringify({ date: today(), fails: this.fails }));
    } catch {
      // 保存できなければその場の回数だけで数える
    }
    return false;
  }
}
