import { animal, type AnimalId } from './animals';
import type { Effect, Shot } from './arms';
import type { Hazard } from './bosses';
import type { Gem, Item } from './drops';
import { ENEMIES, type EnemyDef } from './enemies';
import type { Lava } from './eruption';
import type { Storm } from './storm';
import { addHero, chiefOf, eliteOf, makeEnemy, type GameEvent, type World } from './world';

/** 協力プレイの知らせの形の版。形を変えたら 1 上げる */
export const COOP_VERSION = 1;

type Row = (number | string)[];

/**
 * 親から子へ 1 秒に 20 回送る、画面に要る様子。配列は生きているものだけを、
 * 親の配列の番号つきの数の列にする（番号をそろえると、予告の持ち主の番号もそのまま使え、間をつなぐときの相手も番号で決まる）
 */
export interface Snap {
  t: number[];
  heroes: Row[];
  enemies: Row[];
  shots: Row[];
  effects: Row[];
  gems: Row[];
  items: Row[];
  hazards: Hazard[];
  lava: Lava[];
  storm: Storm;
  treasure: number;
  events: GameEvent[];
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const IDS = Object.keys(ENEMIES);
const CODE = new Map(IDS.map((id, i) => [id, i]));
/** 敵の番号に足す種類（強化個体・ヌシ） */
const ELITE = 1000;
const CHIEF = 2000;

function code(d: EnemyDef): number {
  return (CODE.get(d.id) ?? -1) + (d.chief ? CHIEF : d.elite ? ELITE : 0);
}

const defs = new Map<string, EnemyDef>();
function defOf(c: number, max: number | undefined): EnemyDef | null {
  const base = ENEMIES[IDS[c % ELITE]];
  if (!base) return null;
  const key = `${c}|${max ?? ''}`;
  let d = defs.get(key);
  if (!d) {
    d = c >= CHIEF ? chiefOf(base) : c >= ELITE ? eliteOf(base) : base;
    // ボスは出た時刻で体力の大きさを変えた写しなので、体力の札がずれないよう最大の体力も合わせる
    if (max !== undefined && max !== d.hp) d = { ...d, hp: max };
    defs.set(key, d);
  }
  return d;
}

export function makeSnap(w: World, events: GameEvent[]): Snap {
  const rows = <T extends { alive: boolean }>(list: T[], row: (o: T) => Row) =>
    list.flatMap((o, i) => (o.alive ? [[i, ...row(o)]] : []));
  return {
    t: [
      r1(w.time),
      w.level,
      r1(w.xp),
      w.kills,
      w.coins,
      r1(w.freeze),
      r1(w.festival),
      w.over === 'dead' ? 1 : w.over ? 2 : 0
    ],
    heroes: w.heroes.map((h) => {
      const p = h.player;
      return [
        h.animal.id,
        h.form,
        r1(p.x),
        r1(p.y),
        Math.round(p.hp),
        Math.round(h.stats.maxHp),
        h.stats.speed,
        p.facing,
        p.moving ? 1 : 0,
        r1(p.invuln),
        r1(p.hurt),
        r1(p.attack),
        h.down ? 1 : 0,
        h.pending,
        h.weapons.map((o) => `${o.id}:${o.level}`).join(','),
        h.passives.map((o) => `${o.id}:${o.level}`).join(','),
        r1(p.slow),
        r1(h.revive),
        h.chests
      ];
    }),
    enemies: rows(w.enemies, (e) => {
      const base: Row = [code(e.def), r1(e.x), r1(e.y), r1(e.t), r1(Math.max(0, e.flash))];
      const extra = e.def.boss || e.def.chief || e.def.metal || e.state !== 0 || e.drift > 0;
      return extra
        ? [
            ...base,
            Math.round(e.hp),
            e.def.hp,
            e.state,
            r1(e.wait),
            r1(e.dx),
            r1(e.dy),
            e.turn,
            r1(e.root),
            r1(e.drift),
            e.reborn ? 1 : 0
          ]
        : base;
    }),
    shots: rows(w.shots, (o) => [
      o.kind,
      o.slot,
      r1(o.x),
      r1(o.y),
      r1(o.vx),
      r1(o.vy),
      r1(o.angle),
      r1(o.r),
      r1(o.age),
      r1(o.life)
    ]),
    effects: rows(w.effects, (f) => [
      f.kind,
      f.slot,
      r1(f.x),
      r1(f.y),
      r1(f.r),
      r1(f.age),
      r1(f.life),
      r1(f.angle),
      r1(f.born)
    ]),
    gems: rows(w.gems, (g) => [r1(g.x), r1(g.y), g.value]),
    items: rows(w.items, (it) => [it.kind, r1(it.x), r1(it.y), it.tier ?? -1, r1(it.life ?? -1)]),
    hazards: w.hazards.filter((h) => h.alive),
    lava: w.lava.filter((l) => l.life > 0),
    storm: { ...w.storm },
    treasure: w.treasure ? w.items.indexOf(w.treasure) : -1,
    events
  };
}

/** 番号の位置へ書く。足りなければ作って足し、書かなかった番号は消す */
function place<T extends { alive: boolean }>(list: T[], rows: Row[], make: () => T, write: (o: T, r: Row) => boolean) {
  for (const o of list) o.alive = false;
  for (const r of rows) {
    const i = r[0] as number;
    while (list.length <= i) list.push(make());
    list[i].alive = write(list[i], r);
  }
}

const parsed = (s: string) =>
  s
    ? s.split(',').map((x) => ({ id: x.slice(0, x.lastIndexOf(':')), level: Number(x.slice(x.lastIndexOf(':') + 1)) }))
    : [];

/** 子の端末の描くための World に書き込む。自分（view.cur）の位置と向きは自分の端末で動かしているので書かない */
export function applySnap(view: World, s: Snap): void {
  const [time, level, xp, kills, coins, freeze, festival] = s.t;
  Object.assign(view, { time, level, xp, kills, coins, freeze, festival });
  view.over = s.t[7] === 1 ? 'dead' : s.t[7] === 2 ? 'clear' : null;
  s.heroes.forEach((r, i) => {
    const id = r[0] as AnimalId;
    if (!view.heroes[i]) addHero(view, id);
    const h = view.heroes[i];
    if (h.animal.id !== id) h.animal = animal(id);
    h.form = r[1] as 0 | 1 | 2;
    const p = h.player;
    if (i !== view.cur) {
      p.x = r[2] as number;
      p.y = r[3] as number;
      p.facing = r[7] as 1 | -1;
      p.moving = r[8] === 1;
    }
    p.hp = r[4] as number;
    h.stats = { ...h.stats, maxHp: r[5] as number, speed: r[6] as number };
    p.invuln = r[9] as number;
    p.hurt = r[10] as number;
    p.attack = r[11] as number;
    h.down = r[12] === 1;
    h.pending = r[13] as number;
    h.weapons = parsed(r[14] as string).map((o) => ({ ...o, cd: 0 }));
    h.passives = parsed(r[15] as string);
    p.slow = r[16] as number;
    h.revive = r[17] as number;
    h.chests = r[18] as number;
  });
  place(
    view.enemies,
    s.enemies,
    () => makeEnemy(ENEMIES[IDS[0]], 0, 0, 1),
    (e, r) => {
      const d = defOf(r[1] as number, r.length > 6 ? (r[7] as number) : undefined);
      if (!d) return false;
      e.def = d;
      [e.x, e.y, e.t, e.flash] = r.slice(2, 6) as number[];
      if (r.length > 6) {
        e.hp = r[6] as number;
        [e.state, e.wait, e.dx, e.dy, e.turn, e.root, e.drift] = r.slice(8, 15) as number[];
        e.reborn = r[15] === 1;
      } else {
        e.state = e.wait = e.drift = e.root = 0;
        e.hp = d.hp;
      }
      return true;
    }
  );
  place(
    view.shots,
    s.shots,
    () => ({ alive: false }) as Shot,
    (o, r) => {
      o.kind = r[1] as Shot['kind'];
      [o.slot, o.x, o.y, o.vx, o.vy, o.angle, o.r, o.age, o.life] = r.slice(2) as number[];
      return true;
    }
  );
  place(
    view.effects,
    s.effects,
    () => ({ alive: false }) as Effect,
    (f, r) => {
      f.kind = r[1] as Effect['kind'];
      [f.slot, f.x, f.y, f.r, f.age, f.life, f.angle, f.born] = r.slice(2) as number[];
      return true;
    }
  );
  place(
    view.gems,
    s.gems,
    () => ({ alive: false, x: 0, y: 0, value: 0, pulled: false }) as Gem,
    (g, r) => {
      [g.x, g.y, g.value] = r.slice(1) as number[];
      return true;
    }
  );
  place(
    view.items,
    s.items,
    () => ({ alive: false, pulled: false }) as Item,
    (it, r) => {
      it.kind = r[1] as Item['kind'];
      it.x = r[2] as number;
      it.y = r[3] as number;
      it.tier = (r[4] as number) >= 0 ? (r[4] as Item['tier']) : undefined;
      it.life = (r[5] as number) >= 0 ? (r[5] as number) : undefined;
      return true;
    }
  );
  view.hazards = s.hazards;
  view.lava = s.lava;
  view.storm = s.storm;
  view.treasure = s.treasure >= 0 ? (view.items[s.treasure] ?? null) : null;
  view.events = s.events;
}

/** a を書いたあと、敵・弾・玉・ほかの動物の位置を b へ t だけ寄せる（番号と種類が同じものだけ） */
export function lerpSnap(view: World, a: Snap, b: Snap, t: number): void {
  applySnap(view, a);
  const mix = (o: { x: number; y: number }, ra: Row | undefined, rb: Row | undefined, at: number, kind: boolean) => {
    if (!ra || !rb || (kind && ra[1] !== rb[1])) return;
    o.x = (ra[at] as number) + ((rb[at] as number) - (ra[at] as number)) * t;
    o.y = (ra[at + 1] as number) + ((rb[at + 1] as number) - (ra[at + 1] as number)) * t;
  };
  const byIndex = (rows: Row[]) => new Map(rows.map((r) => [r[0] as number, r]));
  for (const [list, before, after, at, kind] of [
    [view.enemies, a.enemies, b.enemies, 2, true],
    [view.shots, a.shots, b.shots, 3, true],
    [view.gems, a.gems, b.gems, 1, false]
  ] as const) {
    const prev = byIndex(before);
    for (const [i, rb] of byIndex(after)) if (list[i]?.alive) mix(list[i], prev.get(i), rb, at, kind);
  }
  b.heroes.forEach((rb, i) => {
    const ra = a.heroes[i];
    if (i === view.cur || !ra || ra[0] !== rb[0]) return;
    const p = view.heroes[i].player;
    p.x = (ra[2] as number) + ((rb[2] as number) - (ra[2] as number)) * t;
    p.y = (ra[3] as number) + ((rb[3] as number) - (ra[3] as number)) * t;
  });
}
