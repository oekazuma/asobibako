import type { Party, Seat } from '$lib/net/party.svelte';
import type { Host } from '../host';
import type { Settings } from '../referee';
import { Bot } from './bot';
import type { CpuChoice, Strength } from './levels';
import { pipes } from './pipe';
import type { Senses } from './senses';

/** 隠れるときはプレイヤー 1 人が隠れ、見つかった時点で終わるので通常にする。ダブルは CPU と遊ぶでは選べない */
export function cpuSettings(s: Settings, c: CpuChoice): Settings {
  return {
    ...s,
    mode: c.side === 'hide' ? 'normal' : c.mode,
    hunters: c.side === 'hide' ? c.count : 1,
    petit: c.petit
  };
}

export const cpuHunters = (c: CpuChoice, members: readonly Seat[]): Seat[] =>
  c.side === 'hide' ? members.filter((s) => s !== 1) : [1];

/** CPU と遊ぶ。CPU を手元の管で親の Party に座らせ、審判のループで進める */
export class Crew {
  readonly bots: Bot[] = [];
  readonly #party: Party;
  readonly #host: Host;
  readonly #rand: () => number;
  #queued: { choice: CpuChoice; settings: Settings } | null = null;
  #senses: Senses | null = null;
  #warm: (() => void) | null = null;
  #warmed = false;
  #stopped = false;
  #turn: Promise<void> = Promise.resolve();

  /** 人のつないだ試合の空いた席に CPU を足す使い方。ハンターは人の試合と同じくロビーの台の希望で決める */
  readonly mixed: boolean;

  constructor(party: Party, host: Host, rand: () => number = Math.random, mixed = false) {
    this.#party = party;
    this.#host = host;
    this.#rand = rand;
    this.mixed = mixed;
    // CPU と遊ぶではハンターを CPU の設定の役で決めるので、ロビーの台はハンター希望に使わない
    if (!mixed) host.podium = false;
  }

  /**
   * 席替えと始めるのを、呼ばれた順に 1 つずつ進める。重ねて呼ぶと 2 つの席替えが入り混じる。
   * 失敗は呼んだ側へ返さずに知らせる（呼ぶ側はどれも待たずに投げっぱなしにする）
   */
  #next(f: () => Promise<void>): Promise<void> {
    const run = this.#turn.then(f).catch((e: unknown) => console.error(e));
    this.#turn = run;
    return run;
  }

  /** 親の端末の 3D。つないだ画面が 3D を作ってから入れ、壊すときに null に戻す（画面の props を書き換えず、口を通す） */
  useSenses(senses: Senses | null, warm: (() => void) | null = null): void {
    this.#senses = senses;
    this.#warm = warm;
    this.#warmed = false;
    this.#warmIfSeated();
  }

  /** 目の絵の shader を作る 1 秒ほどの止まりは、CPU が 1 人も座らない試合では払わない */
  #warmIfSeated(): void {
    if (this.#warmed || !this.#warm || this.bots.length === 0) return;
    this.#warmed = true;
    this.#warm();
  }

  /** CPU の人数と強さを合わせる */
  seat(c: CpuChoice): Promise<void> {
    return this.#next(() => this.#seat(c));
  }

  /** 減らすときは、閉じた席が顔ぶれから抜け終わるまで待つ */
  async #seat(c: { count: number; strength: Strength }): Promise<void> {
    while (this.bots.length > c.count) {
      const bot = this.bots.pop()!;
      const seat = bot.party.me;
      bot.close();
      await bot.gone;
      this.#forget(seat);
    }
    while (this.bots.length < c.count && !this.#stopped) {
      const [a, b] = pipes();
      const bot = new Bot(b, {
        strength: c.strength,
        index: this.bots.length,
        rand: this.#rand,
        senses: () => this.#senses
      });
      this.bots.push(bot);
      // 抜けたあとは Party が管を閉じて席を返さない。そこでやめる
      if (typeof (await this.#party.add(a)) !== 'number') return;
    }
    for (const bot of this.bots) bot.strength = c.strength;
    this.#warmIfSeated();
  }

  /**
   * 閉じた CPU の席を、切れた席（呼び直しの番号）と CPU の名前から外す。残すと「よびなおす」に CPU の席が出て、
   * 次にその席に来た人も CPU と呼ばれる
   */
  #forget(seat: Seat) {
    const p = this.#party;
    if (seat === 1) return;
    p.away = p.away.filter((s) => s !== seat);
    const looks = { ...p.looks };
    delete looks[seat];
    p.looks = looks;
  }

  /**
   * 人の試合の空いた席に CPU を 1 人座らせる（strength）か外す（null）。ロビーのあいだだけ。
   * Party は番号を持たない子を切れた人の席へ先に座らせるので、切れた人がいるあいだは足さない（戻る人の席を取らない）
   */
  fillSeat(strength: Strength | null): Promise<void> {
    return this.#next(async () => {
      const p = this.#party;
      if (this.#host.match.phase !== 'lobby') return;
      if (strength && (p.away.length > 0 || p.members.length >= 3)) return;
      await this.#seat({ count: strength ? 1 : 0, strength: strength ?? 'normal' });
    });
  }

  play(c: CpuChoice, settings: Settings): Promise<void> {
    return this.#next(async () => {
      // 前の play で試合が始まっていれば、試合中の席を変えない
      if (this.#host.match.phase !== 'lobby') return;
      await this.#seat(c);
      if (this.#stopped) return;
      // CPU が送る知らせは step の中だけなので、体型の知らせでは始めるのに間に合わない。始めるときに決め打つ
      const body = c.side === 'seek' ? 'petit' : 'normal';
      // 席に着けなかった bot の party.me は初めの 1 のままなので、bots ではなく席から鍵を取る（席 1 のプレイヤーを上書きしない）
      const members = this.#party.members;
      const bodies = Object.fromEntries(members.filter((s) => s !== 1).map((s) => [s, body] as const));
      this.#host.start(cpuSettings(settings, c), cpuHunters(c, members), bodies);
    });
  }

  /** 試合を始めるのを、つないだ画面が 3D を作り終えるまで待たせる（紹介の 3 秒を作るあいだに過ぎさせない） */
  queue(c: CpuChoice, settings: Settings): void {
    this.#queued = { choice: c, settings };
  }

  go(): void {
    const q = this.#queued;
    this.#queued = null;
    if (q) void this.play(q.choice, q.settings);
  }

  step(dt: number, now: number): void {
    if (!this.#stopped) for (const bot of this.bots) bot.step(dt, now);
  }

  stop(): void {
    this.#stopped = true;
    for (const bot of this.bots.splice(0)) bot.close();
  }
}
