import { difficulty, lerp, Rng } from '$lib/levels';

/**
 * 雪原は幅 WORLD_W・高さ WORLD_H の固定の広さで、y は下向き。上が狩り場、下がキャンプ。
 * 近くの動物は自動で攻撃し、落ちた肉は歩いて拾い、たき火に近づくと自動で渡す
 */
export const WORLD_W = 1.6;
export const WORLD_H = 2.4;
export const HUNT_BOTTOM = 1.35;

export type PadId = 'bag' | 'power' | 'fire' | 'home';

export interface Animal {
  kind: 'rabbit' | 'bear';
  x: number;
  y: number;
  hp: number;
  tx: number;
  ty: number;
  /** 攻撃を受けて赤く光る残り秒 */
  flash: number;
}

export interface Pad {
  id: PadId;
  x: number;
  y: number;
  cost: number;
  paid: number;
  level: number;
}

/** レベルで決まる、その面の決まりごと。難しくなるほど家が高く、クマが多く固く、ウサギは逃げ足が速い */
export interface Rules {
  home: number;
  bearHp: number;
  rabbits: number;
  bears: number;
  flee: number;
  cook: number;
  padScale: number;
  /** 狩り場の木の並び。面ごとに違う */
  trees: { x: number; y: number; s: number }[];
}

export function rulesFor(level: number): Rules {
  const d = difficulty(level);
  const rng = new Rng(level * 7919);
  const trees: Rules['trees'] = [];
  const count = rng.int(18, 30);
  while (trees.length < count) {
    const x = rng.range(0.05, WORLD_W - 0.05);
    const y = rng.range(0.05, HUNT_BOTTOM - 0.05);
    // 狩り場の真ん中と、キャンプの入り口の前は空けておく
    if (Math.abs(x - WORLD_W / 2) < 0.28 && y > 0.25) continue;
    trees.push({ x, y, s: rng.range(0.08, 0.13) });
  }
  return {
    home: Math.round(lerp(50, 300, d ** 1.2)),
    bearHp: Math.round(lerp(4, 9, d)),
    rabbits: Math.round(lerp(5, 2, d)),
    bears: Math.round(lerp(2, 4, d)),
    flee: lerp(0.3, 0.46, d),
    cook: lerp(1.4, 2.2, d),
    padScale: lerp(1, 1.8, d),
    trees
  };
}

export interface GameState {
  rules: Rules;
  hero: { x: number; y: number };
  carry: number;
  cap: number;
  power: number;
  cookSpeed: number;
  animals: Animal[];
  drops: { x: number; y: number }[];
  /** たき火に渡して焼いている肉の数と、いま焼いている 1 枚の経過 */
  cooking: number;
  cookT: number;
  /** 焼けて、食べに来た人を待っている料理 */
  meals: number;
  /** 食べに来て並んでいる人。先頭の人が料理を食べてお金を置いていく */
  guests: number;
  guestT: number;
  eatT: number;
  /** 置いてあるお金と、持っているお金 */
  coins: number;
  wallet: number;
  pads: Pad[];
  attackT: number;
  spawnT: number;
  handT: number;
  result: 'clear' | null;
}

export type CampEvent =
  | { type: 'hit'; x: number; y: number }
  | { type: 'kill'; kind: Animal['kind'] }
  | { type: 'pickup' }
  | { type: 'deposit' }
  | { type: 'cooked' }
  | { type: 'pay' }
  | { type: 'collect'; n: number }
  | { type: 'spend' }
  | { type: 'upgrade'; id: PadId }
  | { type: 'clear' };

export const FIRE = { x: 0.8, y: 1.95 };
export const TABLE = { x: 1.12, y: 1.95 };
export const MONEY = { x: 0.45, y: 2.05 };
export const SPEED = 0.55;
const REACH = 0.13;
const PICK = 0.09;
const NEAR = 0.14;
const ATTACK_S = 0.4;
const HAND_S = 0.1;
const EAT_S = 0.7;
const GUEST_S = 1.5;
const MAX_GUESTS = 3;
const PRICE = 4;
const SPAWN_S = 2.5;
const MEAT: Record<Animal['kind'], number> = { rabbit: 1, bear: 3 };

const wander = (rand: () => number) => [0.1 + rand() * (WORLD_W - 0.2), 0.15 + rand() * (HUNT_BOTTOM - 0.25)];

function spawn(kind: Animal['kind'], rules: Rules, rand: () => number): Animal {
  const [x, y] = wander(rand);
  const [tx, ty] = wander(rand);
  return { kind, x, y, hp: kind === 'bear' ? rules.bearHp : 1, tx, ty, flash: 0 };
}

export function createState(level: number, rand: () => number = Math.random): GameState {
  const rules = rulesFor(level);
  const price = (base: number) => Math.round(base * rules.padScale);
  return {
    rules,
    hero: { x: FIRE.x, y: 1.75 },
    carry: 0,
    cap: 5,
    power: 1,
    cookSpeed: 1,
    animals: [
      ...Array.from({ length: rules.rabbits }, () => spawn('rabbit', rules, rand)),
      ...Array.from({ length: rules.bears }, () => spawn('bear', rules, rand))
    ],
    drops: [],
    cooking: 0,
    cookT: 0,
    meals: 0,
    guests: 1,
    guestT: 0,
    eatT: 0,
    coins: 0,
    wallet: 0,
    pads: [
      { id: 'bag', x: 0.3, y: 2.28, cost: price(10), paid: 0, level: 0 },
      { id: 'power', x: 0.8, y: 2.28, cost: price(15), paid: 0, level: 0 },
      { id: 'fire', x: 1.3, y: 2.28, cost: price(20), paid: 0, level: 0 },
      { id: 'home', x: 1.3, y: 1.62, cost: rules.home, paid: 0, level: 0 }
    ],
    attackT: 0,
    spawnT: 0,
    handT: 0,
    result: null
  };
}

const near = (a: { x: number; y: number }, b: { x: number; y: number }, r: number) =>
  Math.hypot(a.x - b.x, a.y - b.y) < r;

function upgrade(state: GameState, pad: Pad): CampEvent[] {
  pad.level += 1;
  pad.paid = 0;
  if (pad.id === 'home') {
    state.result = 'clear';
    return [{ type: 'upgrade', id: pad.id }, { type: 'clear' }];
  }
  if (pad.id === 'bag') state.cap += 5;
  if (pad.id === 'power') state.power += 1;
  if (pad.id === 'fire') state.cookSpeed += 0.6;
  pad.cost = Math.round(pad.cost * 1.7);
  return [{ type: 'upgrade', id: pad.id }];
}

/** move は 1 秒あたりの移動の向きと強さ（長さ 1 まで） */
export function step(
  state: GameState,
  dt: number,
  move: { x: number; y: number },
  rand: () => number = Math.random
): CampEvent[] {
  if (state.result) return [];
  const events: CampEvent[] = [];
  const hero = state.hero;
  hero.x = Math.min(WORLD_W - 0.05, Math.max(0.05, hero.x + move.x * SPEED * dt));
  hero.y = Math.min(WORLD_H - 0.05, Math.max(0.05, hero.y + move.y * SPEED * dt));

  for (const a of state.animals) {
    a.flash = Math.max(0, a.flash - dt);
    // ウサギは近づくと逃げる。追いかけっこにするため、主人公より少し遅い
    const flee = a.kind === 'rabbit' && near(a, hero, 0.3);
    const [gx, gy] = flee ? [a.x * 2 - hero.x, a.y * 2 - hero.y] : [a.tx, a.ty];
    const d = Math.hypot(gx - a.x, gy - a.y);
    const speed = a.kind === 'bear' ? 0.07 : flee ? state.rules.flee : 0.12;
    if (d < 0.03 && !flee) [a.tx, a.ty] = wander(rand);
    else if (d > 0) {
      a.x += ((gx - a.x) / d) * speed * dt;
      a.y += ((gy - a.y) / d) * speed * dt;
    }
    a.x = Math.min(WORLD_W - 0.05, Math.max(0.05, a.x));
    a.y = Math.min(HUNT_BOTTOM, Math.max(0.1, a.y));
  }

  state.attackT -= dt;
  const target = state.animals.find((a) => near(a, hero, REACH));
  if (target && state.attackT <= 0) {
    state.attackT = ATTACK_S;
    target.hp -= state.power;
    target.flash = 0.15;
    events.push({ type: 'hit', x: target.x, y: target.y });
    if (target.hp <= 0) {
      state.animals.splice(state.animals.indexOf(target), 1);
      for (let i = 0; i < MEAT[target.kind]; i++)
        state.drops.push({ x: target.x + (rand() - 0.5) * 0.08, y: target.y + (rand() - 0.5) * 0.08 });
      events.push({ type: 'kill', kind: target.kind });
    }
  }

  state.spawnT -= dt;
  if (state.spawnT <= 0) {
    state.spawnT = SPAWN_S;
    const count = (k: Animal['kind']) => state.animals.filter((a) => a.kind === k).length;
    if (count('rabbit') < state.rules.rabbits) state.animals.push(spawn('rabbit', state.rules, rand));
    else if (count('bear') < state.rules.bears) state.animals.push(spawn('bear', state.rules, rand));
  }

  state.drops = state.drops.filter((drop) => {
    if (state.carry >= state.cap || !near(drop, hero, PICK)) return true;
    state.carry += 1;
    events.push({ type: 'pickup' });
    return false;
  });

  // たき火・パッドへの受け渡しは、1 つずつ間をあけて流れるように渡す
  state.handT -= dt;
  if (state.handT <= 0) {
    if (state.carry > 0 && near(hero, FIRE, NEAR)) {
      state.handT = HAND_S;
      state.carry -= 1;
      state.cooking += 1;
      events.push({ type: 'deposit' });
    }
    const pad = state.pads.find((p) => near(hero, p, NEAR * 0.8));
    if (pad && state.wallet > 0) {
      state.handT = HAND_S / 3;
      const n = Math.min(state.wallet, pad.cost - pad.paid, Math.max(1, Math.ceil(pad.cost / 40)));
      state.wallet -= n;
      pad.paid += n;
      events.push({ type: 'spend' });
      if (pad.paid >= pad.cost) events.push(...upgrade(state, pad));
    }
  }

  if (state.cooking > 0) {
    state.cookT += dt * state.cookSpeed;
    if (state.cookT >= state.rules.cook) {
      state.cookT = 0;
      state.cooking -= 1;
      state.meals += 1;
      events.push({ type: 'cooked' });
    }
  }

  if (state.guests < MAX_GUESTS) {
    state.guestT += dt;
    if (state.guestT >= GUEST_S) {
      state.guestT = 0;
      state.guests += 1;
    }
  }
  if (state.meals > 0 && state.guests > 0) {
    state.eatT += dt;
    if (state.eatT >= EAT_S) {
      state.eatT = 0;
      state.meals -= 1;
      state.guests -= 1;
      state.coins += PRICE;
      events.push({ type: 'pay' });
    }
  }

  if (state.coins > 0 && near(hero, MONEY, NEAR)) {
    events.push({ type: 'collect', n: state.coins });
    state.wallet += state.coins;
    state.coins = 0;
  }
  return events;
}
