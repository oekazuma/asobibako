import { animal, type Animal, type AnimalId } from './animals';
import type { RunBook } from './book';
import { fire, hits, type Effect, type Shot } from './arms';
import { moveBoss, slot, spawnBosses, updateHazards, type Hazard } from './bosses';
import { BOAR } from './bosses-forest';
import { airborne } from './bosses-snow';
import { bloodPact, healRate, regenRate, takeArcana, type ArcanaId } from './arcana';
import { atkMul, heatStage, PLAIN, type Heat } from './cauldron';
import { rebirth } from './bosses-volcano';
import { hpScale, modPerks, modStage, type Challenge, type ModId } from './daily';
import { CLEAR_COINS, COIN_RATE, collect, dropFrom, overtimeCoins, type Gem, type Item } from './drops';
import { ENEMIES, MAX_R, type BossId, type EnemyDef } from './enemies';
import { addBoost, gearOf, type GearFx, type GearKey } from './gear';
import {
  anyChest,
  anyPending,
  bindHeroes,
  raise,
  eachHero,
  tagged,
  SLOT_COUNT,
  nearestHero,
  type Hero
} from './heroes';
import { Grid } from './grid';
import { stats, type Stats } from './passives';
import { rng, type Rng } from './rng';
import { stageOf } from './stages';
import { startEvent, stepEvents } from './events';
import { quietEarth, stepEruption, updateLava, type Eruption, type Lava } from './eruption';
import { PLAYER_R, pushOut } from './obstacles';
import { flakes, hasRelic, placeRelics, type RelicId } from './relics';
import { limitTotal, type Limit } from './limit';
import { speedOf, stepBlessing, touchShrines, type ShrineKind } from './shrines';
import { calm, STORM_PUSH, stepStorm, windFactor, type Storm } from './storm';
import { spawnRate, type Stage } from './stages/forest';
import { perks, type Ranks } from './upgrades';
import { WEAPONS } from './weapons';

export interface Enemy {
  alive: boolean;
  def: EnemyDef;
  x: number;
  y: number;
  /** 吹き飛ばしの速さ（px/秒）。毎秒 1e-4 倍に減る */
  kx: number;
  ky: number;
  hp: number;
  flash: number;
  t: number;
  phase: number;
  /** 突進の段階。0 追う、1 ためる、2 走る。巨大ベアは 3 が地ならしの予告 */
  state: number;
  wait: number;
  dx: number;
  dy: number;
  /** ボスの次の攻撃までの秒 */
  cd: number;
  /** ツタで足止めされている残り秒 */
  root: number;
  /** ボスの攻撃の数え（巨大ベアは突進と地ならしの交互、女王グモは子グモまでの秒） */
  turn: number;
  /** 武器の枠ごと（合体武器の 2 つめの部品は PART_B から）に最後に当たった時刻。後ろの ZONE_HIT からは同じ番号の炎とツタの時計 */
  hit: Float64Array;
  /** まっすぐ飛ぶ残りの秒（群れ）。0 になったら消え、倒した数には入らない */
  drift: number;
  /** 不死鳥が一度よみがえった */
  reborn: boolean;
  /** 出た時刻（ボスときらきらハリネズミを倒すまでの秒に使う） */
  born: number;
  /** 大ヘビの頭が通った道（x, y の並び）。体の節がこの上に並ぶ */
  trail?: number[];
}

export interface Player {
  x: number;
  y: number;
  hp: number;
  facing: 1 | -1;
  aimX: number;
  aimY: number;
  invuln: number;
  moving: boolean;
  attack: number;
  hurt: number;
  /** 糸の玉で足が遅くなっている残り秒 */
  slow: number;
}

export interface Owned {
  id: string;
  level: number;
  /** summary の武器だけ: 限界突破で上げた回数の合計 */
  lb?: number;
}

/** hero はふたりで遊ぶときの持ち主（heroes の番号） */
export type GameEvent = { hero?: number } & (
  | { type: 'hit'; x: number; y: number; dmg: number; crit: boolean }
  | { type: 'kill'; x: number; y: number; enemy: string }
  | { type: 'pickup'; value: number }
  | { type: 'heal'; amount: number }
  | { type: 'magnet' }
  | { type: 'hurt'; dmg: number }
  | { type: 'fire'; weapon: string }
  | { type: 'levelup' }
  | { type: 'clear' }
  | { type: 'dead' }
  | { type: 'warning'; boss: BossId; title?: string }
  | { type: 'bossdown'; x: number; y: number }
  | { type: 'chest' }
  | { type: 'coin'; value: number }
  | { type: 'revive' }
  | { type: 'evolve'; id: string }
  | { type: 'relic'; id: RelicId }
  | { type: 'shrine'; kind: ShrineKind }
  | { type: 'swarm'; text: string }
  | { type: 'cross' }
  | { type: 'freeze' }
  | { type: 'grow'; form: 1 | 2 }
  | { type: 'rush' }
  | { type: 'special'; id: string }
  /** ボスが出た（入れ物の番号）。面の主の 2 体は 1 つにまとめる */
  | { type: 'bossIntro'; ids: number[] }
  | { type: 'chief'; i: number; name: string }
);

export interface World {
  rand: Rng;
  time: number;
  stage: Stage;
  /** 釜の強さと賭けたコイン */
  heat: Heat;
  /** 遊び始めに帯で出す一言 */
  note?: string;
  /** 持っている札 */
  arcana: ArcanaId[];
  /** 開いている札（候補はここから引く。空ならその回は札を出さない） */
  arcanaPool: ArcanaId[];
  /** 選ぶのを待っている札の数 */
  arcanaPending: number;
  animal: Animal;
  /** 育った段階。0 が 1 段階め */
  form: 0 | 1 | 2;
  stats: Stats;
  /** 店と装備の強化。パッシブを取って stats を作り直すときにも足す */
  boost: Partial<Stats>;
  /** 装備の効き目 */
  fx: GearFx;
  /** つけている装備（リザルトと一時停止に出す） */
  worn: GearKey[];
  /** コインに掛ける倍率 */
  greed: number;
  /** 残りの 3 択の引き直しと復活 */
  rerolls: number;
  revives: number;
  /** 動物のよみがえりの残り（火の鳥のひな） */
  rebirths: number;
  skips: number;
  banishes: number;
  /** その回の候補から消した札（kind:id） */
  banished: string[];
  player: Player;
  weapons: (Owned & { cd: number; cd2?: number; limit?: Limit })[];
  passives: Owned[];
  enemies: Enemy[];
  shots: Shot[];
  effects: Effect[];
  gems: Gem[];
  items: Item[];
  /** ボスの予告と飛び道具 */
  hazards: Hazard[];
  level: number;
  xp: number;
  xpTotal: number;
  kills: number;
  /** まだ選んでいない 3 択の数。0 より大きいあいだ step は進まない */
  pending: number;
  /** まだ開けていない宝箱の数。0 より大きいあいだ step は進まない */
  chests: number;
  /** その回に倒したボス */
  bossKills: BossId[];
  /** この回に拾ったコインの枚数（強欲を掛ける前）。見せるときは coinsOf で掛ける */
  coins: number;
  /** この回に開けた宝箱 */
  opened: number;
  /** この回に作った進化形 */
  evolvedNow: string[];
  /** 持っている遺物と、この回に拾った遺物（効き目はこれを見る）。2 匹で共通 */
  relics: RelicId[];
  relicsNow: RelicId[];
  /** 祠のご利益の残りの秒（動物ごと） */
  blessing: { might: number; speed: number; xp: number };
  /** 使った祠の key。その回は戻さない */
  shrinesUsed: number[];
  /** 今当たって戻せる HP。毎秒 DRAIN × 最大 HP ずつ、その量まで戻る */
  drainLeft: number;
  /** 武器の id ごとの、与えたダメージと倒した数 */
  dealt: Record<string, { damage: number; kills: number }>;
  /** 次に出すステージの出来事の番号 */
  eventNext: number;
  /** 時計で敵が止まっている残り秒 */
  freeze: number;
  /** 金の磁石のコインラッシュの残り秒 */
  rush: number;
  /** 雪山の吹雪 */
  storm: Storm;
  eruption: Eruption;
  /** 噴火の割れ目と溶岩の池 */
  lava: Lava[];
  /** 溶岩の池で倒した数 */
  lavaKills: number;
  /** 宝の地図の宝箱（無ければ null） */
  treasure: Item | null;
  /** 流れ星の残り秒と、次の予告までの秒 */
  meteors: { left: number; next: number };
  /** お祭りの残り秒 */
  festival: number;
  /** 次にランタンを足すまでの秒 */
  propCd: number;
  /** 次に出すヌシの番号 */
  chiefNext: number;
  /** きらきらハリネズミが出る時刻。出ない回と、もう出たあとは -1 */
  metalAt: number;
  /** この回にきらきらハリネズミを倒した */
  metalWon: boolean;
  /** この回に倒した面の主の数 */
  finaleKills: number;
  /** 図鑑に足す、この回に倒した敵の数（元の敵の id ごと）・強化個体とヌシ・ボスを倒すまでの秒・拾った品 */
  killsBy: Record<string, number>;
  elitesDown: string[];
  chiefsDown: string[];
  bossTimes: { id: string; secs: number }[];
  picked: string[];
  /** その回に拾ったガチャ券（銅・銀・金） */
  tickets: [number, number, number];
  /** 券を落とすかと券の種類の乱数（ふつうの乱数の並びを変えないため別の種） */
  loot: Rng;
  /** 次に出すボスの番号と、予告を出したボスの数 */
  bossNext: number;
  warned: number;
  /** お題のしばり。お題でない回は空 */
  mods: ModId[];
  /** お題の回の日付とごほうび（お題でない回は null） */
  daily: { date: string; bonus: number } | null;
  /** クリアの一掃で倒さずに消えたボスの数（延長戦でボス戦の曲を止めるときに、倒した数に足す） */
  swept: number;
  over: null | 'dead' | 'clear';
  /**
   * 延長戦（無ければ null）。from は延長戦に入った秒、base は 2 回めの記録で差を取るための始めた時の値、
   * coins は倍率を掛けて貯めた延長戦のコイン（強欲を掛ける前）、retreat は自分で終えた
   */
  overtime: null | {
    from: number;
    base: {
      kills: number;
      opened: number;
      killsBy: Record<string, number>;
      bossTimes: number;
      lavaKills: number;
      tickets: number[];
    };
    coins: number;
    retreat: boolean;
  };
  /** 仮想画面の大きさ（px）。出現と回し直しの距離に使う */
  view: { w: number; h: number };
  events: GameEvent[];
  spawnAcc: number[];
  grid: Grid;
  /** 動物ごとの項目（HERO_KEYS）。上の同じ名前の項目は heroes[cur] を指す */
  heroes: Hero[];
  cur: number;
}

export const MAX_ENEMIES = 400;
/** 武器の枠の数（choices の SLOTS）。火の羽根と炎のように 1 つの枠が両方を出すとき、互いの当たりを止めないよう時計を分ける */
export const ZONE_HIT = SLOT_COUNT * 2;
/** 当たって戻せる HP は 1 秒に最大 HP のこの割合まで（大群に当てて一瞬で満タンにならないように） */
export const DRAIN = 0.03;
export const BASE_SPEED = 60;
/** 糸の玉に当たったときの速さの倍率 */
export const SLOW = 0.85;
const BEAR_DASH_ATK = 30;
const REVIVE_INVULN = 2;
const REVIVE_REACH = 80;
const REVIVE_PUSH = 400;

export const METAL_CHANCE = 0.3;
/** きらきらハリネズミが去るまでの秒 */
export const METAL_LIFE = 20;
const METAL_HP = 12;

/** 出るかと時刻は別の乱数で決める（同じ種の回の流れを変えないため） */
function metalTime(seed: number): number {
  const r = rng(seed + 0x2545f491);
  return r() < METAL_CHANCE ? 120 + r() * 360 : -1;
}

/** createWorld の後ろの引数。Survivors の選んだ組をそのまま渡せる形 */
export interface Options {
  challenge?: Challenge;
  heat?: Heat;
  arcana?: ArcanaId[];
  /** 遊び始めに帯で出す一言（釜の強さを下げたときなど） */
  note?: string;
  /** つけている装備 */
  gear?: GearKey[];
  /** 記録で持っている遺物 */
  relics?: RelicId[];
}

/** 1 匹ぶん。店の強化なしのしばりの日は、店の強化と装備を外す */
export function makeHero(id: AnimalId, ranks: Ranks, mods: ModId[], gear: GearKey[]): Hero {
  const a = animal(id);
  const noShop = mods.includes('noShop');
  const k = modPerks(perks(noShop ? {} : ranks), mods);
  const worn = noShop ? [] : gear;
  const g = gearOf(worn);
  const boost = addBoost(k.boost, g.boost);
  const s = stats(a, [], boost, 0, hpScale(mods));
  return {
    animal: a,
    form: 0,
    stats: s,
    boost,
    fx: g.fx,
    worn: [...worn],
    greed: k.greed + g.greed,
    rerolls: k.rerolls,
    revives: k.revives,
    rebirths: a.rebirths ?? 0,
    skips: k.skips,
    banishes: k.banishes,
    banished: [],
    player: {
      x: 0,
      y: 0,
      hp: s.maxHp,
      facing: 1,
      aimX: 1,
      aimY: 0,
      invuln: 0,
      moving: false,
      attack: 0,
      hurt: 0,
      slow: 0
    },
    weapons: [{ id: a.weapon, level: 1, cd: 0.3 }],
    passives: [],
    dealt: {},
    evolvedNow: [],
    drainLeft: s.maxHp * DRAIN,
    pending: 0,
    chests: 0,
    blessing: { might: 0, speed: 0, xp: 0 },
    down: false,
    revive: 0,
    gone: false
  };
}

/** 2 匹めを足して番号を返す。始めは 1 匹めの少し右に置く */
export function addHero(w: World, id: AnimalId, ranks: Ranks = {}, gear: GearKey[] = []): number {
  const h = makeHero(id, ranks, w.mods, gear);
  if (hasRelic(w, 'flake') && flakes(w)) h.rerolls += 1;
  h.player.x = w.heroes[0].player.x + 24;
  h.player.y = w.heroes[0].player.y;
  return w.heroes.push(h) - 1;
}

export function createWorld(
  id: AnimalId,
  seed: number,
  view: { w: number; h: number },
  ranks: Ranks = {},
  stageId = 'forest',
  opts: Options = {}
): World {
  const { challenge, heat = PLAIN, arcana = [], note, gear = [] } = opts;
  const mods = challenge?.mods ?? [];
  const stage = heatStage(modStage(stageOf(stageId), mods), heat.level);
  const w = {
    rand: rng(seed),
    time: 0,
    stage,
    heat,
    note,
    arcana: [],
    arcanaPool: arcana,
    arcanaPending: arcana.length && !challenge ? 1 : 0,
    enemies: [],
    shots: [],
    effects: [],
    gems: [],
    items: [],
    hazards: [],
    level: 1,
    xp: 0,
    xpTotal: 0,
    kills: 0,
    bossKills: [],
    coins: 0,
    opened: 0,
    eventNext: 0,
    freeze: 0,
    rush: 0,
    storm: calm(),
    eruption: quietEarth(),
    lava: [],
    lavaKills: 0,
    treasure: null,
    meteors: { left: 0, next: 0 },
    festival: 0,
    propCd: 2,
    chiefNext: 0,
    metalAt: metalTime(seed),
    metalWon: false,
    finaleKills: 0,
    killsBy: {},
    elitesDown: [],
    chiefsDown: [],
    bossTimes: [],
    picked: [],
    tickets: [0, 0, 0],
    loot: rng(seed + 0x5bd1e995),
    bossNext: 0,
    warned: 0,
    swept: 0,
    mods,
    daily: challenge ? { date: challenge.date, bonus: challenge.bonus } : null,
    over: null,
    overtime: null,
    view,
    events: [],
    spawnAcc: stage.waves.map(() => 0),
    grid: new Grid(),
    heroes: [makeHero(id, ranks, mods, gear)],
    cur: 0,
    relics: [...(opts.relics ?? [])],
    relicsNow: [],
    shrinesUsed: []
  } as unknown as World;
  bindHeroes(w);
  w.events = tagged(w);
  placeRelics(w);
  if (hasRelic(w, 'flake') && flakes(w)) w.rerolls += 1;
  // お題の今日の札は、始めの 3 枚選びの代わりに持って始める
  if (challenge?.card) takeArcana(w, challenge.card);
  return w;
}

export function makeEnemy(def: EnemyDef, x: number, y: number, hp: number): Enemy {
  return {
    alive: true,
    def,
    x,
    y,
    kx: 0,
    ky: 0,
    hp,
    flash: 0,
    t: 0,
    phase: 0,
    state: 0,
    wait: 0,
    dx: 0,
    dy: 0,
    cd: 2,
    turn: 0,
    root: 0,
    hit: new Float64Array(ZONE_HIT * 2).fill(-1),
    drift: 0,
    reborn: false,
    born: 0
  };
}

/** 自分を中心にした、画面の外の輪の上。動いていれば進む先から来やすくする */
export function spawnPoint(w: World, out = { x: 0, y: 0 }) {
  const p = w.player;
  const r = Math.hypot(w.view.w, w.view.h) / 2 + 24;
  const a =
    p.moving && w.rand() < 0.6 ? Math.atan2(p.aimY, p.aimX) + (w.rand() - 0.5) * Math.PI : w.rand() * Math.PI * 2;
  out.x = p.x + Math.cos(a) * r;
  out.y = p.y + Math.sin(a) * r;
  pushOut(w.stage.art, out, 16);
  return out;
}

/** source はダメージを出した武器の id（ダメージ表に使う）。drain は当たって戻す HP で、無ければ source の武器の値 */
export function damageEnemy(
  w: World,
  i: number,
  dmg: number,
  kx: number,
  ky: number,
  crit = false,
  source?: string,
  drain?: number
): void {
  const e = w.enemies[i];
  if (!e.alive || airborne(e)) return;
  if (e.def.part) {
    // 大ヘビの体の節。光るのは節で、体力は頭から減らす
    e.flash = 0.12;
    if (w.enemies[e.turn]?.alive) damageEnemy(w, e.turn, dmg, 0, 0, crit, source, drain);
    return;
  }
  const heal = drain ?? (source ? (WEAPONS[source]?.drain ?? 0) : 0);
  if (heal > 0 && w.drainLeft > 0) {
    const amt = Math.min(heal, w.drainLeft);
    w.drainLeft -= amt;
    w.player.hp = Math.min(w.stats.maxHp, w.player.hp + amt * healRate(w));
  }
  if (e.def.boss || e.def.chief) dmg *= 1 + w.fx.bossDmg;
  if (e.def.metal) dmg = 1;
  if (source && !e.def.prop) (w.dealt[source] ??= { damage: 0, kills: 0 }).damage += Math.max(0, Math.min(dmg, e.hp));
  e.hp -= dmg;
  e.flash = 0.12;
  e.kx += kx * (1 - e.def.heavy);
  e.ky += ky * (1 - e.def.heavy);
  w.events.push({ type: 'hit', x: e.x, y: e.y - e.def.r, dmg, crit });
  if (e.hp > 0 || rebirth(w, e)) return;
  e.alive = false;
  if (e.def.prop) {
    w.events.push({ type: 'kill', x: e.x, y: e.y, enemy: e.def.id });
    dropFrom(w, e);
    return;
  }
  countKill(w, e);
  if (e.def.metal) w.metalWon = true;
  if (source) w.dealt[source].kills += 1;
  w.events.push({ type: 'kill', x: e.x, y: e.y, enemy: e.def.id });
  if (e.def.ai === 'snake') for (const s of w.enemies) if (s.alive && s.def.part && s.turn === i) s.alive = false;
  if (e.def.boss) {
    w.bossKills.push(e.def.boss);
    if (e.def.finale) w.finaleKills += 1;
    w.events.push({ type: 'bossdown', x: e.x, y: e.y });
  }
  dropFrom(w, e);
}

/** 倒した数と図鑑の分を数える。十字架でまとめて倒したときも通す */
export function countKill(w: World, e: Enemy): void {
  w.kills += 1;
  bloodPact(w);
  const id = e.def.id;
  w.killsBy[id] = (w.killsBy[id] ?? 0) + 1;
  if (e.def.elite && !w.elitesDown.includes(id)) w.elitesDown.push(id);
  if (e.def.chief && !w.chiefsDown.includes(id)) w.chiefsDown.push(id);
  if (e.def.boss || e.def.metal) w.bossTimes.push({ id: e.def.boss ?? 'metal', secs: w.time - e.born });
}

/** 強化個体の表。元の表は書き換えない */
export function eliteOf(def: EnemyDef): EnemyDef {
  return { ...def, hp: def.hp * 8, xp: def.xp * 5, r: def.r * 1.6, heavy: Math.max(def.heavy, 0.6), elite: true };
}

/** ヌシの表。元の表は書き換えない */
export function chiefOf(def: EnemyDef): EnemyDef {
  return { ...def, name: `ヌシ${def.name}`, xp: def.xp * 20, r: def.r * 3, heavy: 1, chief: true };
}

/** ボスと同じく、入れ物が埋まっていても遠くの敵の枠を使って必ず出す */
function place(w: World, def: EnemyDef, hp: number): Enemy {
  const at = spawnPoint(w);
  const i = slot(w);
  w.enemies[i] = makeEnemy(def, at.x, at.y, hp);
  w.enemies[i].born = w.time;
  return w.enemies[i];
}

export function spawnChiefs(w: World): void {
  const list = w.stage.chiefs;
  while (w.chiefNext < list.length && w.time >= list[w.chiefNext].at) {
    const c = list[w.chiefNext++];
    const def = chiefOf(ENEMIES[c.enemy]);
    const e = place(w, def, c.hp);
    w.events.push({ type: 'chief', i: w.enemies.indexOf(e), name: def.name });
  }
}

export function spawnMetal(w: World): void {
  if (w.metalAt < 0 || w.time < w.metalAt) return;
  w.metalAt = -1;
  place(w, ENEMIES.metal, METAL_HP);
  w.events.push({ type: 'swarm', text: 'なにかがキラッと光った…' });
}

/** 入れ物に敵を 1 体置く。体力はそのときの toughness を掛ける。400 体を使い切っていれば null */
export function addEnemy(w: World, def: EnemyDef, x: number, y: number): Enemy | null {
  const hp = def.hp * w.stage.toughness(w.time);
  const free = w.enemies.find((e) => !e.alive);
  if (free) Object.assign(free, makeEnemy(def, x, y, hp), { hit: free.hit.fill(-1) });
  else if (w.enemies.length < MAX_ENEMIES) w.enemies.push(makeEnemy(def, x, y, hp));
  else return null;
  const e = free ?? w.enemies[w.enemies.length - 1];
  e.phase = w.rand() * Math.PI * 2;
  return e;
}

function spawn(w: World, base: EnemyDef) {
  const chance = w.stage.elite(w.time);
  const def = chance > 0 && !base.boss && !base.id.endsWith('ling') && w.rand() < chance ? eliteOf(base) : base;
  const at = spawnPoint(w);
  addEnemy(w, def, at.x, at.y);
}

const SWARM_SPEED = 1.5;
/** 自分の周りに置くランタンの数 */
export const LANTERNS = 5;
const PROP_EVERY = 3;

/** ランタンを PROP_EVERY 秒ごとに 1 つ、画面の外の進む先に足す（周りに LANTERNS 個まで） */
export function spawnProps(w: World, dt: number): void {
  w.propCd -= dt;
  if (w.propCd > 0) return;
  w.propCd = PROP_EVERY;
  let n = 0;
  for (const e of w.enemies) if (e.alive && e.def.prop) n++;
  if (n >= LANTERNS + (hasRelic(w, 'lamp') ? 1 : 0)) return;
  const at = spawnPoint(w);
  const e = addEnemy(w, ENEMIES.lantern, at.x, at.y);
  // 時刻で硬くならない
  if (e) e.hp = 1;
}

/** 時刻になったステージの出来事を出す。群れと輪は同時に出せる数の上限とは別に出す */
export function spawnEvents(w: World): void {
  const list = w.stage.events;
  while (w.eventNext < list.length && list[w.eventNext].at <= w.time) {
    const ev = list[w.eventNext++];
    if (ev.kind === 'treasure' || ev.kind === 'meteor' || ev.kind === 'festival') {
      startEvent(w, ev);
      w.events.push({ type: 'swarm', text: ev.text });
      continue;
    }
    const def = ENEMIES[ev.enemy];
    const p = w.player;
    const r = Math.hypot(w.view.w, w.view.h) / 2 + 24;
    if (ev.kind === 'ring' || ev.kind === 'lanterns') {
      // ランタンは画面の中に灯す
      const rr = ev.kind === 'lanterns' ? Math.min(w.view.w, w.view.h) * 0.3 : r;
      for (let i = 0; i < ev.count; i++) {
        const a = (i / ev.count) * Math.PI * 2;
        const e = addEnemy(w, def, p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr);
        if (!e) break;
        // ランタンは動かず押し出されないので、置くときに障害物の外へ出す
        if (def.prop) {
          e.hp = 1;
          pushOut(w.stage.art, e, def.r);
        }
      }
    } else if (ev.kind === 'elites') {
      const a = w.rand() * Math.PI * 2;
      const strong = eliteOf(def);
      for (let i = 0; i < ev.count; i++) {
        const side = (i / Math.max(1, ev.count - 1) - 0.5) * 60;
        const x = p.x + Math.cos(a) * r - Math.sin(a) * side;
        const y = p.y + Math.sin(a) * r + Math.cos(a) * side;
        if (!addEnemy(w, strong, x, y)) break;
      }
    } else {
      // 画面の外の片側に、進む向きと直角に帯になって並び、反対側へ抜ける
      const a = w.rand() * Math.PI * 2;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      const life = (2 * r + 60) / (def.speed * SWARM_SPEED);
      for (let i = 0; i < ev.count; i++) {
        const side = (i / Math.max(1, ev.count - 1) - 0.5) * r * 1.6;
        const back = w.rand() * 40;
        const e = addEnemy(w, def, p.x - dx * (r + back) - dy * side, p.y - dy * (r + back) + dx * side);
        if (!e) break;
        Object.assign(e, { dx, dy, drift: life });
      }
    }
    w.events.push({ type: 'swarm', text: ev.text });
  }
}

function moveEnemy(w: World, i: number, dt: number) {
  const e = w.enemies[i];
  if (e.def.part) {
    // 節は大ヘビの頭が動かす
    e.t += dt;
    e.flash -= dt;
    return;
  }
  if (e.def.prop || w.freeze > 0) {
    // ランタンは灯りだけ揺らす。止まっているあいだの吹き飛ばしはためない（切れた瞬間にまとめて飛ぶ）
    if (e.def.prop) e.t += dt;
    e.kx = e.ky = 0;
    e.flash -= dt;
    return;
  }
  if (e.drift > 0) {
    e.drift -= dt;
    if (e.drift <= 0) e.alive = false;
    e.x += e.dx * e.def.speed * SWARM_SPEED * dt;
    e.y += e.dy * e.def.speed * SWARM_SPEED * dt;
    e.t += dt;
    e.flash -= dt;
    return;
  }
  const p = w.player;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d;
  const uy = dy / d;
  const sp = e.def.speed;
  let vx = ux * sp;
  let vy = uy * sp;
  const move = e.def.move;
  if (move === 'flee') {
    if (e.t >= METAL_LIFE) {
      e.alive = false;
      return;
    }
    vx = -vx;
    vy = -vy;
  } else if (move === 'boss') ({ vx, vy } = moveBoss(w, i, dt));
  else if (move === 'wave' || move === 'snake') {
    const s = move === 'wave' ? Math.sin(e.t * 6 + e.phase) * 0.8 : Math.sin(e.t * 3 + e.phase) * 0.5;
    vx += -uy * s * sp;
    vy += ux * s * sp;
  } else if (move === 'leap') {
    // 3 秒ごとに 0.4 秒止まり、そのときの向きへ 4 倍の速さで 0.35 秒跳ぶ
    if (e.state === 0) {
      e.cd -= dt;
      if (e.cd <= 0) {
        e.state = 1;
        e.wait = 0.4;
      }
    } else {
      e.wait -= dt;
      if (e.wait <= 0 && e.state === 1) {
        e.state = 2;
        e.wait = 0.35;
        e.dx = ux;
        e.dy = uy;
      } else if (e.wait <= 0) {
        e.state = 0;
        e.cd = 3;
      }
    }
    if (e.state === 1) vx = vy = 0;
    else if (e.state === 2) {
      vx = e.dx * sp * 4;
      vy = e.dy * sp * 4;
    }
  } else if (move === 'charge') {
    if (e.state === 0 && d < 60) {
      e.state = 1;
      e.wait = 0.6;
      e.dx = ux;
      e.dy = uy;
    }
    if (e.state > 0) {
      e.wait -= dt;
      if (e.wait <= 0) {
        e.state = e.state === 1 ? 2 : 0;
        e.wait = e.state === 2 ? 0.8 : 0;
      }
      vx = e.state === 2 ? e.dx * sp * 4 : 0;
      vy = e.state === 2 ? e.dy * sp * 4 : 0;
    }
  }
  if (!e.def.boss) {
    const k = windFactor(w, vx, vy);
    vx *= k;
    vy *= k;
  }
  // 足止めのあいだも動き方（ボスの攻撃の時計）は進め、位置だけを止める
  if (e.root > 0) {
    e.root -= dt;
    vx = vy = 0;
    e.kx = e.ky = 0;
  }
  const decay = Math.pow(1e-4, dt);
  e.x += (vx + e.kx) * dt;
  e.y += (vy + e.ky) * dt;
  e.kx *= decay;
  e.ky *= decay;
  e.t += dt;
  e.flash -= dt;
}

const near: number[] = [];

/** ヌシは体が大きく、隣り合う障害物のすき間で引っかかるので、障害物から押し出す丸だけを小さくする */
const CHIEF_PUSH = 16;

/** 障害物で止まる敵。ボス・群れ・ランタン・大ヘビの体・きらきらハリネズミは通り抜ける */
const blocked = (e: Enemy) => !e.def.boss && !e.def.prop && !e.def.part && !e.def.metal && e.drift <= 0;

/** 重なった敵を半分ずつ押し返し、団子にならないようにする。比べるのは近い 4 体まで */
function separate(w: World) {
  const es = w.enemies;
  for (let i = 0; i < es.length; i++) {
    const a = es[i];
    if (!a.alive) continue;
    let n = 0;
    for (const j of w.grid.near(a.x, a.y, a.def.r * 2, near)) {
      if (j === i) continue;
      const b = es[j];
      // ランタンと宙にいる大雪男は押さず押されない
      if (a.def.prop || b.def.prop || a.def.part || b.def.part || airborne(a) || airborne(b)) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = a.def.r + b.def.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2) || 0.01;
      // ボスは押されず、相手だけが重なりの分だけ下がる
      const fa = a.def.boss || a.def.chief;
      const fb = b.def.boss || b.def.chief;
      const ka = fa ? 0 : fb ? 1 : 0.5;
      const kb = fb ? 0 : fa ? 1 : 0.5;
      const over = (min - d) / d;
      a.x -= dx * over * ka;
      a.y -= dy * over * ka;
      b.x += dx * over * kb;
      b.y += dy * over * kb;
      if (++n >= 4) break;
    }
  }
}

function touch(w: World) {
  const p = w.player;
  if (p.invuln > 0 || w.freeze > 0) return;
  let atk = 0;
  let boss = false;
  for (const i of w.grid.near(p.x, p.y, 5 + MAX_R, near)) {
    const e = w.enemies[i];
    if (!e.alive || airborne(e)) continue;
    const r = e.def.r + 5;
    if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 >= r * r) continue;
    // ボス（と大ヘビの体）は時間で強くならない。突進中の巨大ベアと大イノシシは強く当たる
    const base =
      e.def.boss || e.def.part
        ? e.state === 2 && e.def.ai === 'bear'
          ? BEAR_DASH_ATK
          : e.state === 2 && e.def.ai === 'boar'
            ? BOAR.dashAtk
            : e.def.atk
        : e.def.atk * w.stage.fury(w.time);
    if (base <= atk) continue;
    atk = base;
    boss = !!(e.def.boss || e.def.chief || e.def.part);
  }
  if (atk > 0) hurtPlayer(w, atk, boss ? 'boss' : 'touch');
}

/** 黒曜石のかけらで溶岩の池から受けるダメージに掛ける */
const SHARD = 0.5;

/** 受けたダメージの出どころ。装備のよろい・甲羅・マントが見る */
export type Hurt = 'touch' | 'boss' | 'shot' | 'lava';

/** 自分にダメージを与え、少し無敵にする。釜の攻撃の倍率はボスの攻撃や予告にも効かせるのでここで掛け、防御を引き、最低 1 */
export function hurtPlayer(w: World, raw: number, from: Hurt = 'touch'): void {
  if (from === 'lava' && hasRelic(w, 'shard')) raw *= SHARD;
  const f = w.fx;
  const scale =
    (from === 'boss' || from === 'shot' ? 1 - f.bossGuard : 1) *
    (from === 'shot' ? 1 - f.shell : 1) *
    (from === 'lava' ? 1 - f.lavaGuard : 1);
  // 伝説のマントで溶岩が 0 になったときは、当たっていないことにする（無敵の点滅で動きが止まって見えないように）
  if (scale <= 0) return;
  const p = w.player;
  const dmg = Math.max(1, Math.round(raw * scale * atkMul(w.heat.level) - w.stats.armor));
  p.hp -= dmg;
  p.invuln = 0.5 + f.invuln;
  p.hurt = 0.3;
  w.events.push({ type: 'hurt', dmg });
  if (p.hp > 0) return;
  if (w.rebirths > 0) {
    // 動物の強みなので店の復活より先に使い、まわりの敵は押し返さない
    w.rebirths -= 1;
    p.hp = Math.round(w.stats.maxHp / 2);
    p.invuln = REVIVE_INVULN;
    w.events.push({ type: 'swarm', text: 'よみがえった！' }, { type: 'revive' });
    return;
  }
  if (w.revives > 0) {
    w.revives -= 1;
    p.hp = Math.round(w.stats.maxHp / 2);
    p.invuln = REVIVE_INVULN;
    for (const e of w.enemies) {
      // ボス・ヌシ・ランタンは動かないもの、ハリネズミは逃げ回るもの。どれも復活で飛ばすと流れが崩れるので外す
      if (!e.alive || e.def.boss || e.def.chief || e.def.prop || e.def.metal) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > REVIVE_REACH) continue;
      e.kx += (dx / d) * REVIVE_PUSH;
      e.ky += (dy / d) * REVIVE_PUSH;
    }
    w.events.push({ type: 'revive' });
    return;
  }
  if (f.feather > 0) {
    p.hp = Math.round(w.stats.maxHp * f.feather);
    f.feather = 0;
    p.invuln = REVIVE_INVULN;
    w.events.push({ type: 'swarm', text: '不死鳥の羽根で起き上がった！' }, { type: 'revive' });
    return;
  }
  p.hp = 0;
  if (w.heroes.length > 1) {
    w.heroes[w.cur].down = true;
    if (w.heroes.some((h) => !h.down)) return;
  }
  w.over = 'dead';
  w.events.push({ type: 'dead' });
}

export function step(w: World, input: { x: number; y: number }, dt: number): void {
  w.events.length = 0;
  if (w.over || anyPending(w) || anyChest(w)) return;
  w.time += dt;
  if (w.time >= w.stage.length) {
    for (const e of w.enemies) {
      if (!e.alive) continue;
      e.alive = false;
      if (e.def.part) continue;
      if (e.def.boss) w.swept += 1;
      w.kills += 1;
      w.events.push({ type: 'kill', x: e.x, y: e.y, enemy: e.def.id });
    }
    // 拾いそびれた券はクリアで持ち帰る（9:00 の主の券を拾う前に時間になることがある）
    for (const it of w.items)
      if (it.alive && it.kind === 'ticket') {
        it.alive = false;
        w.tickets[it.tier ?? 0] += 1;
      }
    w.coins += CLEAR_COINS;
    w.over = 'clear';
    w.events.push({ type: 'clear' });
    return;
  }

  // 倒れた動物は動かない（2 匹めの位置は子の端末から届く）
  if (w.heroes[0].down) input = { x: 0, y: 0 };
  const p = w.player;
  const speed = BASE_SPEED * w.stats.speed * (p.slow > 0 ? SLOW : 1) * speedOf(w);
  p.moving = input.x !== 0 || input.y !== 0;
  p.x += input.x * speed * dt;
  p.y += input.y * speed * dt;
  stepStorm(w, dt);
  if (w.storm.left > 0 && w.freeze <= 0 && !w.heroes[0].down) {
    p.x += w.storm.wx * BASE_SPEED * STORM_PUSH * (1 - w.fx.wind) * dt;
    p.y += w.storm.wy * BASE_SPEED * STORM_PUSH * (1 - w.fx.wind) * dt;
  }
  pushOut(w.stage.art, p, PLAYER_R);
  if (p.moving) {
    const len = Math.hypot(input.x, input.y);
    p.aimX = input.x / len;
    p.aimY = input.y / len;
    if (input.x !== 0) p.facing = input.x > 0 ? 1 : -1;
  }
  raise(w, dt);
  eachHero(w, () => {
    const h = w.player;
    h.invuln -= dt;
    h.hurt -= dt;
    h.attack -= dt;
    h.slow -= dt;
    h.hp = Math.min(w.stats.maxHp, h.hp + w.stats.regen * regenRate(w) * dt);
    w.drainLeft = Math.min(w.stats.maxHp * DRAIN, w.drainLeft + w.stats.maxHp * DRAIN * dt);
    // ご利益の時計は、ほかの出来事と同じく時計の品で止まっているあいだは進めない
    if (w.freeze <= 0) stepBlessing(w, dt);
  });
  // 倒れた動物は祠に触れない。先に触れた動物の番で祠は使ったことになるので、2 匹が同時に触れても 1 匹だけ
  eachHero(w, () => {
    if (!w.heroes[w.cur].down) touchShrines(w);
  });

  let alive = 0;
  for (const e of w.enemies) if (e.alive && !e.def.prop && !e.def.part) alive++;
  const cap = w.stage.cap(w.time);
  w.stage.waves.forEach((wave, i) => {
    if (alive >= cap) return;
    w.spawnAcc[i] += spawnRate(wave, w.time) * dt * (w.festival > 0 ? 2 : 1);
    while (w.spawnAcc[i] >= 1 && alive < cap) {
      w.spawnAcc[i] -= 1;
      // 2 匹のときは出る位置を順に回し、離れていてもどちらのまわりにも敵が来るようにする
      const up = w.heroes.flatMap((h, k) => (h.down ? [] : [k]));
      w.cur = up[alive % up.length] ?? 0;
      spawn(w, ENEMIES[wave.enemy]);
      w.cur = 0;
      alive++;
    }
  });
  spawnBosses(w);
  spawnChiefs(w);
  spawnMetal(w);
  spawnEvents(w);
  spawnProps(w, dt);
  w.freeze = Math.max(0, w.freeze - dt);
  w.rush = Math.max(0, w.rush - dt);
  if (w.freeze <= 0) {
    stepEvents(w, dt);
    stepEruption(w, dt);
  }

  const far = Math.hypot(w.view.w, w.view.h) * 0.9;
  w.grid.clear();
  w.enemies.forEach((e, i) => {
    if (!e.alive) return;
    // 敵の動き（ボスの攻撃も）は w.player を狙うので、近いほうの動物を cur にしてから動かす
    w.cur = nearestHero(w, e.x, e.y);
    const q = w.player;
    moveEnemy(w, i, dt);
    if (e.def.prop && (e.x - q.x) ** 2 + (e.y - q.y) ** 2 > far * far) {
      e.alive = false;
      return;
    }
    if (e.drift <= 0 && !e.def.part && (e.x - q.x) ** 2 + (e.y - q.y) ** 2 > far * far) {
      const at = spawnPoint(w);
      e.x = at.x;
      e.y = at.y;
    }
    w.grid.add(i, e.x, e.y);
  });
  w.cur = 0;
  separate(w);
  // 押し合いのあとに出す。前だと群れに押し込まれた敵が毎フレーム出入りしてガタつく
  for (const e of w.enemies)
    if (e.alive && blocked(e)) pushOut(w.stage.art, e, e.def.chief ? Math.min(e.def.r, CHIEF_PUSH) : e.def.r);
  eachHero(w, () => touch(w));
  if (w.freeze <= 0 && !w.over) {
    updateHazards(w, dt);
    updateLava(w, dt);
  }
  if (w.over) return;

  eachHero(w, () => fire(w, dt));
  hits(w, dt);
  collect(w, dt);
}

export interface RunSummary {
  animal: AnimalId;
  cleared: boolean;
  time: number;
  level: number;
  kills: number;
  xp: number;
  weapons: Owned[];
  passives: Owned[];
  bosses: BossId[];
  coins: number;
  opened: number;
  evolved: string[];
  /** 武器ごとのダメージと倒した数。ダメージの多い順 */
  dealt: { id: string; damage: number; kills: number }[];
  stage: string;
  /** いちばん育った段階 */
  form: 0 | 1 | 2;
  /** きらきらハリネズミを倒した */
  metal: boolean;
  /** 面の主を 2 体とも倒した */
  finale: boolean;
  book: RunBook;
  /** record() が入れる、この回に図鑑へ新しく載ったぶんのコイン */
  bookCoins?: number;
  /** お題の回の日付とごほうび。paid は record() が、このときごほうびを入れたら立てる */
  daily?: { date: string; bonus: number; paid?: boolean };
  /** 延長戦の 2 回めの記録で、クリアの記録に入れた倒した数（kills はその回の合計なので、記録には差を足す） */
  killsBefore?: number;
  /** 延長戦の秒とそのぶんのコイン（倒れて半分になったか）。best は記録した面の最高 */
  overtime?: { secs: number; coins: number; halved: boolean; best?: number };
  heat: Heat;
  arcana?: ArcanaId[];
  /** 溶岩の池で倒した数 */
  lavaKills?: number;
  /** 持ち帰るガチャ券と、倒れて失ったガチャ券（銅・銀・金） */
  tickets?: number[];
  lost?: number[];
  /** つけていた装備 */
  gear?: GearKey[];
  /** この回に拾った遺物 */
  relics?: RelicId[];
}

/** 強欲を掛けたこの回のコイン。1 枚ずつ掛けると端数で減るので、合計に掛ける */
export function coinsOf(w: World): number {
  return Math.floor(w.coins * w.greed * w.stage.coin * COIN_RATE + 1e-9) + overtimeCoins(w);
}

export function summary(w: World): RunSummary {
  return {
    animal: w.animal.id,
    heat: w.heat,
    arcana: [...w.arcana],
    lavaKills: w.lavaKills,
    tickets: w.over === 'clear' ? [...w.tickets] : [0, 0, 0],
    lost: w.over === 'clear' ? [0, 0, 0] : [...w.tickets],
    gear: [...w.worn],
    cleared: w.over === 'clear',
    time: w.time,
    level: w.level,
    kills: w.kills,
    xp: w.xpTotal,
    weapons: w.weapons.map(({ id, level, limit }) => ({
      id,
      level,
      ...(limitTotal(limit) && { lb: limitTotal(limit) })
    })),
    passives: w.passives.map(({ id, level }) => ({ id, level })),
    bosses: [...w.bossKills],
    coins: coinsOf(w),
    opened: w.opened,
    evolved: [...w.evolvedNow],
    relics: [...w.relicsNow],
    dealt: Object.entries(w.dealt)
      .map(([id, d]) => ({ id, damage: Math.round(d.damage), kills: d.kills }))
      .sort((a, b) => b.damage - a.damage),
    stage: w.stage.id,
    form: w.form,
    metal: w.metalWon,
    finale: w.finaleKills >= 2,
    book: {
      kills: { ...w.killsBy },
      elites: [...w.elitesDown],
      chiefs: [...w.chiefsDown],
      bosses: w.bossTimes.map((b) => ({ ...b })),
      forms: Array.from({ length: w.form + 1 }, (_, f) => `${w.animal.id}:${f}`),
      items: [...w.picked]
    },
    ...(w.daily && { daily: { ...w.daily } }),
    ...(w.overtime && {
      overtime: {
        secs: Math.floor(w.time - w.overtime.from),
        coins: overtimeCoins(w),
        halved: w.over === 'dead' && !w.overtime.retreat
      }
    })
  };
}
