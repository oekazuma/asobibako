import type { Party, Seat } from '$lib/net/party.svelte';
import type { Host } from '../host';
import type { Settings } from '../referee';
import { Bot } from './bot';
import type { CpuChoice } from './levels';
import { pipes } from './pipe';
import type { Senses } from './senses';

/** 隠れるときはプレイヤー 1 人が隠れ、見つかった時点で終わるので通常にする。ダブルは CPU と遊ぶでは選べない */
export function cpuSettings(s: Settings, c: CpuChoice): Settings {
  return { ...s, mode: c.side === 'hide' ? 'normal' : c.mode, hunters: c.side === 'hide' ? c.count : 1 };
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
  #stopped = false;
  #turn: Promise<void> = Promise.resolve();

  constructor(party: Party, host: Host, rand: () => number = Math.random) {
    this.#party = party;
    this.#host = host;
    this.#rand = rand;
    // ハンターは CPU の設定の役で決めるので、ロビーの台はハンター希望に使わない
    host.podium = false;
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
  useSenses(senses: Senses | null): void {
    this.#senses = senses;
  }

  /** CPU の人数と強さを合わせる */
  seat(c: CpuChoice): Promise<void> {
    return this.#next(() => this.#seat(c));
  }

  /** 減らすときは、閉じた席が顔ぶれから抜け終わるまで待つ */
  async #seat(c: CpuChoice): Promise<void> {
    while (this.bots.length > c.count) {
      const bot = this.bots.pop()!;
      bot.close();
      await bot.gone;
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
  }

  play(c: CpuChoice, settings: Settings): Promise<void> {
    return this.#next(async () => {
      // 前の play で試合が始まっていれば、試合中の席を変えない
      if (this.#host.match.phase !== 'lobby') return;
      await this.#seat(c);
      if (!this.#stopped) this.#host.start(cpuSettings(settings, c), cpuHunters(c, this.#party.members));
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
