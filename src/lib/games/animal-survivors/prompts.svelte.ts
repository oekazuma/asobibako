import type { AnimalId } from './animals';
import { LINK_FUSE, LINK_SHOW } from './link';
import { arcanaOffer, takeArcana, type ArcanaId } from './arcana';
import { openChest, type Reward } from './chest';
import { WARN_AHEAD } from './bosses';
import { apply, choices, isFiller, type Choice } from './choices';
import { ENEMIES } from './enemies';
import { ownEvent, RAISE_BLESS } from './heroes';
import { firstTip, keepRelic, type TipId } from './records';
import { WEAPONS } from './weapons';
import { RELICS } from './relics';
import { SHRINE_NAME } from './shrines';
import type { Message } from '$lib/net/link';
import { Lock } from './lock.svelte';
import { sounds } from './sounds';
import type { World } from './world';

/** ゲームを止めて重ねる画面（宝箱・3 択）と、WARNING の帯の出し入れ。宝箱は 3 択より先に開ける */
/** 群れの帯を出す秒 */
const NOTICE = 2;
/** ボスの登場で止める秒。カメラが寄る・札を見せる・戻るの 3 つ */
export const INTRO = 2.4;
const GO = 0.6;
const BACK = 1.8;
/** 動きを減らす設定では、カメラを動かさず札だけをこの秒出す */
const INTRO_STILL = 1.2;
/** 育つ演出で止める秒（白い影の入れ替わり・はじける光・札）。動きを減らす設定では札だけを INTRO_STILL 秒 */
export const GROW = 2.6;

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = (k: number) => k * k * (3 - 2 * k);

/** 合体・遺物・祠・限界突破が初めて起きたときだけ、帯に足すひとこと */
const TIP: Record<TipId, string> = {
  union: '2 つの武器が 1 つになり、枠が 1 つ空いた',
  relic: '遺物は次の回からもずっと効く。図鑑で見られる',
  shrine: 'ご利益は 30 秒。HUD の印が残りの秒',
  limit: 'ここからは武器の能力を上げ続けられる'
};

export class Prompts {
  options = $state<Choice[] | null>(null);
  /** 選ぶ札の候補 */
  cards = $state<ArcanaId[] | null>(null);
  rewards = $state<Reward[] | null>(null);
  /** key は帯を作り直すための数。until までゲームの時間で出す（3 択で止まっているあいだに消えないように） */
  warning = $state<{ name: string; key: number; until: number } | null>(null);
  /** 3 択の道具（引き直す・飛ばす・除外）の残り。World の値は $state でないので、画面のために写しを持つ */
  tools = $state({ rerolls: 0, skips: 0, banishes: 0 });
  /** 群れの帯。WARNING と同じくゲームの時間で出す */
  notice = $state<{ text: string; key: number; until: number } | null>(null);
  /** WARNING から、予告したボスを全部倒すまで（ボスの曲を流す） */
  boss = $state(false);
  /** クリアのあとの「延長戦へ・おわる」。答えは画面が受け取って閉じる */
  asking = $state(false);
  /** ボスの登場。t は端末の時間で進める（ゲームの時計は止まっている） */
  intro = $state<{ ids: number[]; t: number; epithet: string; name: string } | null>(null);
  /** 育つ演出。t は端末の時間で進める */
  /** fromForm は育つ前の段階（1 フレームで 2 段育つと form より 2 つ前） */
  evolve = $state<{ from: string; to: string; fromForm: 0 | 1; form: 1 | 2; t: number } | null>(null);
  /** ヌシの帯 */
  chief = $state<{ text: string; key: number; until: number } | null>(null);
  /** 連携の技の帯。t は端末の時間で進める（止めているあいだもゲームの時計は進まない） */
  link = $state<{ a: AnimalId; b: AnimalId; name: string; t: number } | null>(null);
  readonly #still: boolean;
  readonly lock = new Lock();
  readonly #w: World;
  #seen = { fuse: 0, time: 0 };

  /**
   * ふたりで遊ぶ子の端末。World は親が持つので、3 択・宝箱・アルカナを自分で開かず、選んだものを send で親へ送る
   * （3 択と宝箱は親から届いたものを offer と openRewards で出す）
   */
  readonly #remote: { send: (m: Message) => void } | null;

  constructor(w: World, still = reducedMotion(), remote: { send: (m: Message) => void } | null = null) {
    this.#w = w;
    this.#still = still;
    this.#remote = remote;
    this.#sync();
    // step は毎フレームの出来事を消してから進むので、始めの一言は作るときに帯へ写す
    if (w.note) this.notice = { text: w.note, key: -1, until: w.time + NOTICE * 2 };
  }

  #tipLimit(): void {
    if (!this.options?.some((c) => c.kind === 'limit') || !firstTip('limit')) return;
    this.notice = { text: `限界突破！\n${TIP.limit}`, key: this.#w.time, until: this.#w.time + NOTICE * 2 };
  }

  #sync() {
    const w = this.#w;
    this.tools = { rerolls: w.rerolls, skips: w.skips, banishes: w.banishes };
  }

  /** 指で選ぶ画面が出ている。子の端末はこのあいだだけ動きを止める（育つ演出とボスの登場は、親の World が子のためには止まらないので動ける） */
  get picking(): boolean {
    return this.options !== null || this.rewards !== null || this.cards !== null || this.asking;
  }

  get busy(): boolean {
    return (
      this.options !== null ||
      this.rewards !== null ||
      this.cards !== null ||
      this.asking ||
      this.intro !== null ||
      this.evolve !== null
    );
  }

  /** 育つ演出を見せているとき（宝箱・3 択・ボスの登場のあいだは待っている） */
  get growing(): boolean {
    return !!this.evolve && !this.options && !this.rewards && !this.intro;
  }

  /** 動きを減らす設定 */
  get still(): boolean {
    return this.#still;
  }

  /** step のすぐあとに呼び、出来事から WARNING を拾い、ボスが出る時刻を過ぎたら消す */
  take(): void {
    const w = this.#w;
    for (const e of w.events)
      if (!ownEvent(w, e)) continue;
      else if (e.type === 'warning') {
        this.warning = { name: e.title ?? ENEMIES[e.boss].name, key: w.time, until: w.time + WARN_AHEAD };
      } else if (e.type === 'swarm' && e.text)
        this.notice = { text: e.text, key: w.time, until: w.time + NOTICE * (e.text.includes('\n') ? 2 : 1) };
      else if (e.type === 'special')
        this.notice = { text: `${w.animal.forms[2]}の 専用進化！`, key: w.time, until: w.time + NOTICE };
      else if (e.type === 'rush') this.notice = { text: 'コインラッシュ！', key: w.time, until: w.time + NOTICE };
      else if (e.type === 'relic') {
        // 倒れた回やアプリが閉じた回でも残るよう、拾ったその場で記録へ書く（協力プレイの子の端末も snap の出来事で書く）
        keepRelic(e.id);
        // 雪の結晶はその場で引き直しをふやすので、3 択に見せる数も写し直す
        this.#sync();
        const name = RELICS.find((d) => d.id === e.id)!.name;
        const tip = firstTip('relic') ? `\n${TIP.relic}` : '';
        this.notice = { text: `遺物を手に入れた！ ${name}${tip}`, key: w.time, until: w.time + NOTICE * 2 };
      } else if (e.type === 'shrine') {
        // 宝箱と全快はその場で終わり HUD に印が出ないので、30 秒の説明は時計のある祠まで取っておく
        const tip = e.kind !== 'treasure' && e.kind !== 'heal' && firstTip('shrine');
        this.notice = {
          text: `${SHRINE_NAME[e.kind]}！${tip ? `\n${TIP.shrine}` : ''}`,
          key: w.time,
          until: w.time + NOTICE * (tip ? 2 : 1)
        };
      } else if (e.type === 'evolve' && WEAPONS[e.id]?.union && firstTip('union'))
        this.notice = { text: `合体！\n${TIP.union}`, key: w.time, until: w.time + NOTICE * 2 };
      else if (e.type === 'chief') this.chief = { text: e.name, key: w.time, until: w.time + NOTICE };
      else if (e.type === 'link') this.link = { a: e.a, b: e.b, name: e.name, t: 0 };
      else if (e.type === 'raised')
        this.notice = { text: `復活！\n力と風のご利益 ${RAISE_BLESS} 秒`, key: w.time, until: w.time + NOTICE * 2 };
      else if (e.type === 'bossIntro') {
        // WARNING の帯は札と重なるので、ボスが出たら消す
        this.warning = null;
        const defs = e.ids.map((i) => w.enemies[i].def);
        this.intro = { ids: e.ids, t: 0, epithet: defs[0].epithet ?? '', name: defs.map((d) => d.name).join('\n') };
      } else if (e.type === 'grow' && !w.over) {
        // 1 フレームで 2 段育ったときは、まだ始まっていない演出を最後の姿までにのばす
        const fromForm = this.evolve?.t === 0 ? this.evolve.fromForm : ((e.form - 1) as 0 | 1);
        this.evolve = { from: w.animal.forms[fromForm], to: w.animal.forms[e.form], fromForm, form: e.form, t: 0 };
      }
    // 倒していないボスが残ったまま次のボスが出ることがあるので、予告した数と倒した数で決める
    this.boss = w.warned > w.bossKills.length + w.swept;
    if (this.warning && w.time >= this.warning.until) this.warning = null;
    if (this.notice && w.time >= this.notice.until) this.notice = null;
    if (this.chief && w.time >= this.chief.until) this.chief = null;
  }

  /** 毎フレーム呼ぶ。finger は画面に残っている移動の指（出た直後の合成 click を捨てるため）。dt は端末の秒 */
  next(finger: number | null, dt = 0): void {
    const w = this.#w;
    if (this.link) {
      // 一時停止のあいだはゲームの時刻も止めの秒も動かないので、帯の時計も進めない
      const moved = w.link.fuse !== this.#seen.fuse || w.time !== this.#seen.time;
      this.#seen = { fuse: w.link.fuse, time: w.time };
      if (moved) this.link.t += dt;
      if (this.link.t >= LINK_FUSE + LINK_SHOW) this.link = null;
    }
    let left = dt;
    if (this.intro) {
      this.intro.t += dt;
      if (this.intro.t < (this.#still ? INTRO_STILL : INTRO)) return;
      this.intro = null;
      // 登場が終わったフレームの時間は、続く育つ演出に回さない（はじめから見せる）
      left = 0;
    }
    // 経験値の袋や宝箱で育ったときは、開いている画面を閉じてから見せる
    if (this.evolve && !this.options && !this.rewards) {
      // 音は待っていた演出が始まるときに鳴らす（出来事のときに鳴らすと、宝箱やボスの登場と重なる）
      if (this.evolve.t === 0) sounds.grow();
      this.evolve.t += left;
      if (this.evolve.t < (this.#still ? INTRO_STILL : GROW)) return;
      this.evolve = null;
    }
    // 3 択の経験値の袋で育つと、出来事を拾う前にここへ来る。次の 3 択より演出を先にする
    if (this.busy || w.over || w.events.some((e) => e.type === 'grow') || this.#remote) return;
    if (w.arcanaPending > 0) {
      const offer = arcanaOffer(w);
      if (offer.length) {
        this.cards = offer;
        this.lock.begin(finger);
        return;
      }
      w.arcanaPending = 0;
    }
    if (w.chests > 0) this.rewards = openChest(w);
    else if (w.pending > 0) {
      this.options = choices(w);
      this.#tipLimit();
      this.#tipLimit();
    } else return;
    this.lock.begin(finger);
  }

  pickCard(id: ArcanaId, finger: number | null): void {
    takeArcana(this.#w, id);
    this.#w.arcanaPending = Math.max(0, this.#w.arcanaPending - 1);
    this.cards = null;
    this.next(finger);
  }

  /** 子の端末で、親から届いた 3 択を出す */
  offer(options: Choice[], tools: Prompts['tools'], finger: number | null = null): void {
    this.options = options;
    this.#tipLimit();
    this.tools = tools;
    this.lock.begin(finger);
  }

  /** 子の端末で、親が開けた自分の宝箱の中身を出す */
  openRewards(rewards: Reward[], finger: number | null = null): void {
    this.rewards = rewards;
    this.lock.begin(finger);
  }

  /** 子の端末では選んだものを親へ送って閉じる。true なら送った */
  #send(m: Message): boolean {
    if (!this.#remote) return false;
    this.#remote.send(m);
    this.options = null;
    this.rewards = null;
    return true;
  }

  choose(c: Choice, finger: number | null): void {
    if (this.#send({ t: 'choose', i: this.options?.indexOf(c) ?? -1 })) return;
    apply(this.#w, c);
    this.options = null;
    this.next(finger);
  }

  /** 3 択を引き直す。引き直した札も出た直後の合成 click を捨てる */
  reroll(finger: number | null): void {
    const w = this.#w;
    if (this.options && this.tools.rerolls > 0 && this.#send({ t: 'reroll' })) return;
    if (!this.options || w.rerolls <= 0) return;
    w.rerolls -= 1;
    this.#sync();
    this.options = choices(w);
    this.#tipLimit();
    this.lock.begin(finger);
  }

  /** 何も取らずに 3 択を閉じる */
  skip(finger: number | null): void {
    const w = this.#w;
    if (this.options && this.tools.skips > 0 && this.#send({ t: 'skip' })) return;
    if (!this.options || w.skips <= 0) return;
    w.skips -= 1;
    w.pending = Math.max(0, w.pending - 1);
    this.#sync();
    this.options = null;
    this.next(finger);
  }

  /** 札をその回の候補から消し、3 択を引き直す */
  banish(c: Choice, finger: number | null): void {
    const w = this.#w;
    if (
      this.options &&
      this.tools.banishes > 0 &&
      !isFiller(c) &&
      this.#send({ t: 'banish', i: this.options.indexOf(c) })
    )
      return;
    if (!this.options || w.banishes <= 0 || isFiller(c)) return;
    w.banishes -= 1;
    w.banished.push(`${c.kind}:${c.id}`);
    this.#sync();
    this.options = choices(w);
    this.#tipLimit();
    this.lock.begin(finger);
  }

  ask(finger: number | null): void {
    this.asking = true;
    this.lock.begin(finger);
  }

  answered(): void {
    this.asking = false;
  }

  close(finger: number | null): void {
    if (this.#send({ t: 'close' })) return;
    this.rewards = null;
    this.next(finger);
  }

  /** 名前の札を出すとき。カメラがボスに着いてから戻りはじめるまで（動きを減らす設定ではずっと） */
  get named(): boolean {
    const o = this.intro;
    return !!o && (this.#still || (o.t >= GO - 0.1 && o.t < BACK + 0.2));
  }

  /** カメラの寄る先。登場でなければ null（自分を映す） */
  focus(w: World): { x: number; y: number } | null {
    const o = this.intro;
    if (!o || this.#still) return null;
    const live = o.ids.map((i) => w.enemies[i]);
    const to = {
      x: live.reduce((s, e) => s + e.x, 0) / live.length,
      y: live.reduce((s, e) => s + e.y, 0) / live.length
    };
    const p = w.player;
    const k = o.t < GO ? ease(o.t / GO) : o.t < BACK ? 1 : 1 - ease(Math.min(1, (o.t - BACK) / (INTRO - BACK)));
    return { x: p.x + (to.x - p.x) * k, y: p.y + (to.y - p.y) * k };
  }

  stop(): void {
    this.lock.stop();
  }
}
