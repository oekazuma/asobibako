import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { Message } from '$lib/net/link';
import type { Party, Seat } from '$lib/net/party.svelte';
import type { Host } from './host';
import { SPAWNS } from './mansion/layout';
import type { Level } from './move';
import { CHAMELEON_VERSION, DAB_LEN, packDabs, type Me } from './net';
import type { Dab } from './paint';
import { Play } from './play.svelte';
import { AIM, STAND } from './poses';
import { DEFAULTS, newMatch, view, type View } from './referee';
import { Session, SHATTER_SECS, type Inbox } from './session.svelte';
import { capsules, fire, placement } from './shots';
import { sounds } from './sounds';
import type { World } from './world3d';

vi.mock('./doll3d', () => ({ restHit: () => ({ p: [0, 1, 0], n: [0, 0, 1] }) }));
vi.mock('$lib/audio.svelte', () => ({
  tone: vi.fn(),
  sweep: vi.fn(),
  noise: vi.fn(),
  bus: () => undefined,
  sfx: { start: vi.fn(), finish: vi.fn() }
}));
// 3D の部品は描かないので、何もしない物に替える
vi.mock('./effects', () => ({
  Effects: class {
    trail = vi.fn();
    splat = vi.fn();
    shatter = vi.fn();
    note = vi.fn();
    clear = vi.fn();
    step = vi.fn();
    dispose = vi.fn();
  }
}));
vi.mock('./hunter', () => ({
  HunterView: class {
    constructor() {
      made.guns.push(this);
    }
    visible = false;
    dispose = vi.fn();
    fire = vi.fn();
    step = vi.fn();
    muzzle = () => [0, 1, 0];
  }
}));
vi.mock('./glow', () => ({
  Glow: class {
    set = vi.fn();
    dispose = vi.fn();
  }
}));
const made = vi.hoisted(() => ({
  remotes: [] as {
    log: unknown[];
    rig: { paint: { rebuild: unknown } };
    dabs: unknown;
    lastShow: { visible: boolean; shine?: unknown } | null;
  }[],
  guns: [] as { visible: boolean; dispose: unknown }[]
}));
vi.mock('./remote', () => ({
  HEAD_Y: 1.35,
  paintColors: () => [],
  Remote: class {
    constructor() {
      made.remotes.push(this);
    }
    // 本物と同じく、動きが届いて更新されるまでは見えない
    rig = { root: Object.assign(new THREE.Group(), { visible: false }), paint: { rebuild: vi.fn() } };
    log = [];
    shown: Me | null = null;
    push(me: Me) {
      this.last = me;
    }
    last: Me | null = null;
    dabs = vi.fn();
    clearPaint = vi.fn();
    lastShow: { visible: boolean; pin?: Me | null; shine?: unknown } | null = null;
    update(_dt: number, _now: number, show: { visible: boolean; pin?: Me | null; shine?: unknown }) {
      this.lastShow = show;
      // 本物と同じく、見せる体の様子は更新のときに決まる
      this.shown = show.pin ?? this.last;
      this.rig.root.visible = !!this.shown && show.visible;
    }
    center = () => (this.shown ? [...this.shown.pos] : null);
    head = () => null;
    colors = () => [];
    dispose = vi.fn();
  }
}));

/** 床と天井だけの広い部屋（大広間と控室の始める場所を含む）と、ロビーの床 */
const level: Level = {
  boxes: [
    { min: [-40, -1, -40], max: [40, 0, 40] },
    { min: [-40, 6, -40], max: [40, 6.3, 40] },
    { min: [-8, -1, -68], max: [8, 0, -52] }
  ],
  ramps: [],
  spawn: [0, 0, 1.5]
};

function fakeWorld() {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 80);
  return {
    level,
    camera,
    scene: new THREE.Scene(),
    rig: { root: new THREE.Group(), mesh: { receiveShadow: true }, paint: { rebuild: vi.fn(), apply: vi.fn() } },
    poses: { step: vi.fn(), to: vi.fn() },
    placeDoll: vi.fn(),
    follow: vi.fn(),
    eye: vi.fn(),
    render: vi.fn(),
    xray: vi.fn(),
    snapCamera: vi.fn(),
    holdBrush: vi.fn(),
    holdGun: vi.fn(),
    gunMuzzle: () => [9, 9, 9],
    dollCenter: () => [0, 1, 0],
    pickBody: () => ({ object: {}, point: {}, normal: {} }),
    cursor: vi.fn(),
    screen: () => ({ x: 0, y: 0 }),
    dist: 2.25,
    arrange: vi.fn(),
    podium: vi.fn()
  } as unknown as World;
}

function setup(me: Seat = 2, inbox?: Inbox, host: Host | null = null) {
  let listener: (m: Message) => void = () => {};
  const acts: Message[] = [];
  const party = {
    me,
    host: false,
    members: [1, 2, 3],
    act: (m: Message) => acts.push(JSON.parse(JSON.stringify(m))),
    onTell: (l: (m: Message) => void) => {
      listener = l;
      return () => {};
    }
  } as unknown as Party;
  const play = new Play(fakeWorld(), 70);
  const s = new Session(party, play, () => ({}) as never, host, inbox);
  const tell = (m: Message) => listener(JSON.parse(JSON.stringify(m)));
  let clock = 0;
  const frames = (secs: number) => {
    for (let i = 0; i < Math.round(secs * 60); i++) s.frame(1 / 60, (clock += 1000 / 60));
  };
  return { s, play, acts, tell, frames };
}

/** 2 が隠れる人、3 がハンターの試合の様子 */
function at(phase: View['phase'], extra: Partial<View> = {}): Message {
  const v = view(newMatch());
  return {
    t: 'phase',
    view: { ...v, phase, settings: DEFAULTS, roles: { 1: 'hider', 2: 'hider', 3: 'hunter' }, first: [3], ...extra }
  };
}

const normal = { ...DEFAULTS, mode: 'normal' } as const;

const body = (extra: Partial<Me> = {}): Me => ({
  ms: 0,
  pos: [0, 0, 0],
  yaw: 0,
  cling: null,
  pose: 'stand',
  crouch: false,
  paint: false,
  look: [0, 0],
  eye: null,
  ...extra
});
const meMsg = (seat: Seat, extra: Partial<Me> = {}): Message => ({ t: 'me', seat, ...body(extra) });

const dab = (i: number): Dab => ({ p: [i / 100, 1, 0], n: [0, 0, 1], r: 0.05, c: [1, 0, 0], a: 0.3, m: 0, ro: 0.8 });

describe('Session のつなぎ方', () => {
  it('子はつなぐたびに版を送り、版ちがいの知らせを受けると mismatch を立てる', () => {
    const { s, tell, acts } = setup();
    expect(acts).toEqual([{ t: 'hi', v: CHAMELEON_VERSION }]);
    expect(s.mismatch).toBe(false);
    tell({ t: 'chameleon-mismatch' });
    expect(s.mismatch).toBe(true);
  });

  it('親は版を送らず、全員の体と様子を自分の画面へも送らせ、始めるのを審判へ渡す', () => {
    const host = { welcome: vi.fn(), start: vi.fn() } as unknown as Host;
    const { s, acts } = setup(1, undefined, host);
    expect(host.welcome).toHaveBeenCalledWith(1);
    expect(acts).toEqual([]);
    s.start(DEFAULTS);
    expect(host.start).toHaveBeenCalledWith(DEFAULTS);
  });
});

describe('Session の見つかった人', () => {
  it('ペイントモードのあいだに見つかったら、ペイントモードを抜けて観戦になり、自分の人形を隠す（通常）', () => {
    const { s, play, tell } = setup();
    tell(at('lobby'));
    tell(at('search', { settings: normal }));
    play.togglePaint();
    expect(play.mode).toBe('paint');
    tell({ t: 'found', seat: 2, by: 3, at: [0, 1, 0], body: undefined });
    expect(play.mode).toBe('eye');
    expect(play.role).toBe('watch');
    s.frame(1 / 60, 0);
    expect(play.world.rig.root.visible).toBe(false);
  });

  it('増え鬼で見つかると、破片が消えたあと白い体のハンターになり、銃を持つ', () => {
    const { play, tell, frames } = setup();
    tell(at('lobby'));
    tell(at('search'));
    play.applyDabs([dab(0), dab(1)]);
    tell({ t: 'found', seat: 2, by: 3, at: [0, 1, 0] });
    tell(at('search', { roles: { 1: 'hider', 2: 'hunter', 3: 'hunter' }, found: [2] }));
    frames(SHATTER_SECS - 0.1);
    expect(play.role).toBe('hider');
    frames(0.2);
    expect(play.role).toBe('hunter');
    expect(play.log.dabs).toHaveLength(0);
    expect(made.guns.at(-1)!.visible).toBe(true);
  });

  it('最後の隠れる人が撃たれて答え合わせに入っても、破片が消えたあとハンターになり、人形は隠れたまま', () => {
    const { play, tell, frames } = setup();
    tell(at('lobby'));
    tell(at('search'));
    play.applyDabs([dab(0)]);
    tell({ t: 'found', seat: 2, by: 3, at: [0, 1, 0], body: body({ pos: [0, 0, 1.5] }) });
    tell(at('reveal', { roles: { 1: 'hunter', 2: 'hunter', 3: 'hunter' }, found: [1, 2], winner: 'hunter' }));
    frames(SHATTER_SECS - 0.1);
    expect(play.role).toBe('hider');
    expect(play.world.rig.root.visible).toBe(false);
    frames(0.2);
    expect(play.role).toBe('hunter');
    expect(play.log.dabs).toHaveLength(0);
    expect(play.ghost.pos).toEqual([...SPAWNS.lobby[2]]);
    expect(play.world.rig.root.visible).toBe(false);
  });

  it('1 回の散弾で 2 人が見つかると、2 人ともハンターになる', () => {
    const a = setup(1);
    const b = setup(2);
    for (const x of [a, b]) {
      x.tell(at('lobby'));
      x.tell(at('search'));
      for (const seat of [1, 2] as const) x.tell({ t: 'found', seat, by: 3, at: [0, 1, 0], body: body() });
      x.tell(at('reveal', { roles: { 1: 'hunter', 2: 'hunter', 3: 'hunter' }, found: [1, 2], winner: 'hunter' }));
      x.frames(SHATTER_SECS + 0.1);
      expect(x.play.role).toBe('hunter');
    }
  });

  it('天井に張り付いたまま見つかると、天井の裏ではなく真下の床に立つハンターになる', () => {
    const { play, tell, frames } = setup();
    tell(at('lobby'));
    tell(at('search'));
    play.body.pos = [2, 6 - 0.01, 3];
    play.body.cling = { kind: 'ceiling' } as never;
    tell({ t: 'found', seat: 2, by: 3, at: [0, 1, 0] });
    tell(at('search', { roles: { 1: 'hider', 2: 'hunter', 3: 'hunter' }, found: [2] }));
    frames(SHATTER_SECS + 0.1);
    expect(play.role).toBe('hunter');
    expect(play.ghost.pos[0]).toBeCloseTo(2);
    expect(play.ghost.pos[1]).toBeCloseTo(0);
    expect(play.ghost.pos[2]).toBeCloseTo(3);
  });

  it('砕けているあいだは動かず、見つかった場所からハンターになる', () => {
    const { play, tell, frames } = setup();
    tell(at('lobby'));
    tell(at('search'));
    play.body.pos = [0, 0, 0];
    tell({ t: 'found', seat: 2, by: 3, at: [0, 1, 0] });
    tell(at('search', { roles: { 1: 'hider', 2: 'hunter', 3: 'hunter' }, found: [2] }));
    play.pointer('down', 1, 100, 400, 1000);
    play.pointer('move', 1, 170, 400, 1000);
    frames(SHATTER_SECS - 0.2);
    expect(play.frozen).toBe(true);
    expect(Math.abs(play.body.pos[0]) + Math.abs(play.body.pos[2])).toBeLessThan(1e-6);
    frames(0.3);
    expect(play.frozen).toBe(false);
    expect(play.ghost.pos[0]).toBeCloseTo(0);
    expect(play.ghost.pos[2]).toBeCloseTo(0);
  });
});

describe('Session の戻った子', () => {
  it('親に残っていた自分の体と塗りを受け取り、様子が届いてから、その場の動きを送り始める', () => {
    const { play, tell, frames, acts } = setup();
    tell(meMsg(2, { pos: [4, 0, 6], yaw: 1, pose: 'curl' }));
    tell({ t: 'dabs', seat: 2, at: 0, d: packDabs([dab(0), dab(1), dab(2)]) });
    frames(0.2);
    expect(acts.filter((m) => m.t === 'me')).toEqual([]);
    tell(at('search'));
    expect(play.body.pos).toEqual([4, 0, 6]);
    expect(play.log.dabs).toHaveLength(3);
    frames(0.1);
    const me = acts.find((m) => m.t === 'me') as unknown as Me;
    expect(me.pos).toEqual([4, 0, 6]);
    expect(me.pose).toBe('curl');
    expect(me.eye).toBeNull();
    // 受け取った塗りは送り返さない
    expect(acts.filter((m) => m.t === 'dabs')).toEqual([]);
  });

  it('3D を作るあいだに届いていた体・塗り・様子も受け取る（つないだときからためておいた知らせ）', () => {
    const stop = vi.fn();
    const messages = [
      meMsg(2, { pos: [5, 0, 2], pose: 'lie' }),
      { t: 'dabs', seat: 2, at: 0, d: packDabs([dab(0), dab(1)]) },
      at('search')
    ] as Message[];
    const { s, play } = setup(2, { messages, stop });
    expect(stop).toHaveBeenCalled();
    expect(s.match.synced).toBe(true);
    expect(play.body.pos).toEqual([5, 0, 2]);
    expect(play.log.dabs).toHaveLength(2);
  });

  it('戻ったハンターは、親に残っていた続きの場所から銃を持つ', () => {
    const { play, tell } = setup(3);
    tell(meMsg(3, { pos: [7, 0, 5], yaw: 1.5, pose: AIM.id }));
    tell(at('search'));
    expect(play.role).toBe('hunter');
    expect(play.ghost.pos).toEqual([7, 0, 5]);
    expect(play.eyeYaw).toBe(1.5);
  });

  it('答え合わせの最中に戻ると、見つかったときの体をその場に戻して見せる（人形は観戦でも隠さない）', () => {
    const { play, tell, frames } = setup();
    tell({ t: 'found', seat: 2, by: 0, at: [3, 0, 3], body: body({ pos: [3, 0, 3], pose: 'lie' }), quiet: true });
    tell(at('reveal', { found: [2], winner: 'chameleon', settings: normal }));
    // 観戦の役のままなら人形は隠れるので、見えるのは撃たれた体を見せる分岐のおかげ
    expect(play.role).toBe('watch');
    frames(0.1);
    expect(play.body.pos).toEqual([3, 0, 3]);
    expect(play.world.rig.root.visible).toBe(true);
  });
});

describe('Session の答え合わせ', () => {
  it('増え鬼でハンターになった人は撃たれた場所へ戻らず、ほかの画面には撃たれた場所の体と今のハンターの体の両方を出す', () => {
    const { play, tell, frames } = setup();
    tell(meMsg(1, { pos: [1, 0, 0] }));
    tell(at('lobby'));
    tell(at('search'));
    tell({ t: 'found', seat: 1, by: 3, at: [4, 1, 4], body: body({ pos: [4, 0, 4] }) });
    tell({ t: 'found', seat: 2, by: 3, at: [0, 1, 0], body: body({ pos: [0, 0, 1.5] }) });
    frames(SHATTER_SECS + 0.1);
    expect(play.role).toBe('hunter');
    play.ghost.pos = [6, 0, 6];
    const before = made.remotes.length;
    tell(at('reveal', { roles: { 1: 'hunter', 2: 'hunter', 3: 'hunter' }, found: [1, 2], winner: 'hunter' }));
    frames(0.1);
    expect(play.role).toBe('hunter');
    expect(play.ghost.pos).toEqual([6, 0, 6]);
    expect(play.world.rig.root.visible).toBe(false);
    expect(made.remotes.length - before).toBe(1);
  });
});

describe('Session の答え合わせの塗り', () => {
  it('増え鬼で見つかってハンターになった人の撃たれた場所の体は、見つかったときの塗りで作る', () => {
    const { tell, frames } = setup();
    tell(meMsg(1, { pos: [1, 0, 0] }));
    const live = made.remotes.at(-1)!;
    tell(at('lobby'));
    tell(at('search'));
    live.log.push(dab(0), dab(1));
    tell({ t: 'found', seat: 1, by: 3, at: [1, 1, 0], body: body({ pos: [1, 0, 0] }) });
    // ハンターになった人は列を消して送り直す
    live.log.length = 0;
    tell(at('reveal', { roles: { 1: 'hunter', 2: 'hider', 3: 'hunter' }, found: [1], winner: 'chameleon' }));
    frames(0.1);
    const pin = made.remotes.at(-1)!;
    expect(pin).not.toBe(live);
    expect(pin.rig.paint.rebuild).toHaveBeenCalledWith([dab(0), dab(1)]);
  });
});

describe('Session の役の切り替え', () => {
  it('ハンターは紹介で控室へ、探索で屋敷の入口から一人称になる', () => {
    const { play, tell } = setup(3);
    tell(at('lobby'));
    tell(at('intro'));
    expect(play.body.pos).toEqual([...SPAWNS.room[3]]);
    tell(at('hide'));
    expect(play.role).toBe('hider');
    tell(at('search'));
    expect(play.role).toBe('hunter');
    expect(play.ghost.pos).toEqual([...SPAWNS.entrance[3]]);
  });

  it('ハンターのあいだは人形を隠し、動きには人形ではなく目の位置を載せる', () => {
    const { play, tell, frames, acts } = setup(3);
    tell(at('lobby'));
    tell(at('search'));
    play.ghost.pos = [6, 0, 6];
    play.body.pos = [1, 0, 1];
    play.world.camera.position.set(1, 2, 3);
    frames(0.1);
    expect(play.world.rig.root.visible).toBe(false);
    const me = acts.findLast((m) => m.t === 'me') as unknown as Me;
    expect(me.pos).toEqual([6, 0, 6]);
    expect(me.pose).toBe(AIM.id);
    // 親は見落としポイントの視野をカメラの位置から測る
    expect(me.eye).toEqual([1, 2, 3]);
  });

  it('塗っている途中で試合が終わってロビーに戻っても、その指の続きは白に戻した体に塗らない', () => {
    const { play, tell, frames } = setup();
    tell(at('hide'));
    play.togglePaint();
    play.pointer('down', 1, 300, 300, 1000);
    frames(0.2);
    play.pointer('move', 1, 330, 300, 1000);
    expect(play.log.dabs.length).toBeGreaterThan(0);
    tell(at('lobby'));
    play.pointer('move', 1, 360, 300, 1000);
    play.pointer('up', 1, 360, 300, 1000);
    expect(play.log.dabs).toHaveLength(0);
  });

  it('ロビーに戻ると自分の塗りを白に戻し、相手の列も 0 から送り直す', () => {
    const { play, tell, frames, acts } = setup();
    tell(at('lobby'));
    play.applyDabs([dab(0)]);
    frames(0.1);
    tell(at('intro'));
    expect(play.log.dabs).toHaveLength(0);
    acts.length = 0;
    frames(0.1);
    expect(acts.find((m) => m.t === 'dabs')).toMatchObject({ at: 0, d: [] });
  });

  it('撃つと 2 秒は次を撃てず、隠れる人には撃てない。銃口から筋を引く', () => {
    const { s, tell, frames, acts } = setup(3);
    s.shoot();
    expect(acts.filter((m) => m.t === 'shot')).toHaveLength(0);
    tell(at('lobby'));
    tell(at('search'));
    s.shoot();
    s.shoot();
    expect(acts.filter((m) => m.t === 'shot')).toHaveLength(1);
    frames(2.05);
    s.shoot();
    expect(acts.filter((m) => m.t === 'shot')).toHaveLength(2);
    const shot = acts.find((m) => m.t === 'shot')!;
    expect((shot.d as number[]).length).toBe(3);
    expect(shot.from).toEqual([0, 1, 0]);
    expect(shot).not.toHaveProperty('saw');
  });

  it('観戦で見ている人が見えなくなったら次の人へ移り、誰もいなければフリーカメラ', () => {
    const { s, tell, frames } = setup();
    tell(meMsg(1, { pos: [1, 0, 0] }));
    tell(meMsg(3, { pos: [3, 0, 0] }));
    tell(at('lobby'));
    tell(at('search', { settings: normal }));
    frames(0.1);
    tell({ t: 'found', seat: 2, by: 3, at: [0, 1, 0] });
    frames(0.1);
    expect(s.watching).toBe(1);
    tell({ t: 'found', seat: 1, by: 3, at: [0, 1, 0] });
    tell(at('search', { settings: normal, found: [2, 1] }));
    frames(0.1);
    expect(s.watching).toBe(3);
    expect(s.play.watch).toEqual([3, 0, 0]);
  });

  it('ハンターの三人称では、一人称の手と銃を隠して自分の体と銃を出し、筋は体の銃口から引く', () => {
    const { s, play, tell, frames, acts } = setup(3);
    tell(at('lobby'));
    tell(at('search'));
    play.toggleTps();
    frames(0.1);
    expect(made.guns.at(-1)!.visible).toBe(false);
    expect(play.world.rig.root.visible).toBe(true);
    expect(play.world.holdGun).toHaveBeenLastCalledWith(true);
    s.shoot();
    expect(acts.find((m) => m.t === 'shot')!.from).toEqual([9, 9, 9]);
  });

  it('三人称のカメラが家具の中にあっても、弾と視野は十字に沿って体の深さから始まり、体の後ろの人には当たらない', () => {
    const { s, play, tell, frames, acts } = setup(3);
    tell(at('lobby'));
    tell(at('search'));
    play.toggleTps();
    play.ghost.pos = [0, 0, 10];
    play.eyeYaw = 0;
    frames(0.1);
    const head = play.tpsHead!;
    const cam = play.world.camera;
    cam.position.set(head[0], head[1] + 0.3, head[2] - 2.4);
    cam.lookAt(...head);
    const c = cam.position;
    play.world.level = {
      ...level,
      boxes: [...level.boxes, { min: [c.x - 0.5, c.y - 0.5, c.z - 0.5], max: [c.x + 0.5, c.y + 0.5, c.z + 0.5] }]
    };
    s.shoot();
    const shot = acts.find((m) => m.t === 'shot')!;
    const o = shot.o as [number, number, number];
    o.forEach((v, i) => expect(v).toBeCloseTo(head[i], 5));
    const hider = (z: number) => capsules(STAND, placement({ pos: [head[0], 0, z], yaw: Math.PI, cling: null }));
    const d = shot.d as [number, number, number];
    expect(fire(play.world.level, o, d, [{ seat: 1, caps: hider(14) }])[0].seat).toBe(1);
    expect(fire(play.world.level, o, d, [{ seat: 1, caps: hider(8.6) }]).every((r) => r.seat === null)).toBe(true);
    s.frame(1 / 60, 1e6);
    const me = acts.findLast((m) => m.t === 'me') as unknown as Me;
    me.eye!.forEach((v, i) => expect(v).toBeCloseTo(head[i], 5));
  });

  it('ハンターは動きにカメラの位置を載せ、隠れる人は載せない', () => {
    const hunter = setup(3);
    hunter.tell(at('lobby'));
    hunter.tell(at('search'));
    hunter.play.world.camera.position.set(1, 2, 3);
    hunter.s.frame(1 / 60, 1000);
    const me = hunter.acts.findLast((m) => m.t === 'me') as unknown as Me;
    expect(me.eye).toEqual([1, 2, 3]);
    const hider = setup(2);
    hider.tell(at('hide'));
    hider.frames(0.1);
    expect((hider.acts.findLast((m) => m.t === 'me') as unknown as Me).eye).toBeNull();
  });
});

describe('Session の片づけ', () => {
  it('片づけると銃の見た目も片づける', () => {
    const { s } = setup();
    s.dispose();
    expect(made.guns.at(-1)!.dispose).toHaveBeenCalled();
  });
});

describe('Session の口笛', () => {
  it('ほかの人の口笛は、聞く人のカメラから見た向きで鳴らす（右が +x、前が −z）', () => {
    const { play, tell } = setup();
    const whistle = vi.spyOn(sounds, 'whistle').mockImplementation(() => {});
    play.world.camera.position.set(1, 0, 0);
    play.world.camera.updateMatrixWorld(true);
    tell({ t: 'toot', seat: 3, at: [3, 0, -5] });
    const rel = whistle.mock.calls[0][0];
    expect(rel[0]).toBeCloseTo(2);
    expect(rel[1]).toBeCloseTo(0);
    expect(rel[2]).toBeCloseTo(-5);
    tell({ t: 'toot', seat: 2, at: [9, 9, 9] });
    expect(whistle).toHaveBeenLastCalledWith([0, 0, -1]);
  });
});

describe('Session の送る量', () => {
  it('動きと塗りは 0.05 秒ごとにまとめて送る', () => {
    const { tell, frames, acts, play } = setup();
    tell(at('lobby'));
    for (let i = 0; i < 6; i++) {
      play.applyDabs([dab(i)]);
      frames(1 / 60);
    }
    frames(0.05);
    const sent = acts.filter((m) => m.t === 'dabs');
    expect(sent.length).toBeLessThanOrEqual(3);
    expect(sent.reduce((n, m) => n + (m.d as number[]).length, 0)).toBe(6 * DAB_LEN);
  });
});

const double = { ...DEFAULTS, mode: 'double' } as const;
const hunters = { 1: 'hunter', 2: 'hunter', 3: 'hunter' } as const;
const hiders = { 1: 'hider', 2: 'hider', 3: 'hider' } as const;

describe('Session のロビーと小物', () => {
  it('ロビーではロビーの部屋の席の場所に出て、北の台を向く', () => {
    const { play, tell } = setup();
    play.camYaw = 2;
    tell(at('lobby'));
    expect(play.body.pos).toEqual([...SPAWNS.lobby[2]]);
    expect(play.camYaw).toBe(0);
  });

  it('種の入った様子で小物を置き直し、同じ種では置き直さない', () => {
    const { play, tell } = setup();
    tell(at('lobby'));
    tell(at('intro', { seed: 5 }));
    tell(at('hide', { seed: 5 }));
    tell(at('lobby', { seed: null }));
    expect(vi.mocked(play.world.arrange).mock.calls).toEqual([[null], [5], [null]]);
  });

  it('3D を作るあいだに届いていた種も、最初の様子で置く（戻った子と途中で来た子）', () => {
    const { play } = setup(2, { messages: [at('hide', { seed: 9 })], stop: vi.fn() });
    expect(play.world.arrange).toHaveBeenCalledWith(9);
  });

  it('台に誰かが乗っているあいだだけ、台の縁を光らせる', () => {
    const { s, play, tell } = setup();
    tell(at('lobby', { wishes: [3] }));
    s.frame(1 / 60, 0);
    expect(play.world.podium).toHaveBeenLastCalledWith(true);
    tell(at('lobby', { wishes: [] }));
    s.frame(1 / 60, 16);
    expect(play.world.podium).toHaveBeenLastCalledWith(false);
  });
});

describe('Session のダブル', () => {
  /** 2 の画面。1 と 3 の体と塗りが届き、自分も塗ってから、残した体の知らせと探索の様子が来る */
  function doubled() {
    const x = setup();
    x.tell(meMsg(1, { pos: [1, 0, 1] }));
    x.tell(meMsg(3, { pos: [3, 0, 3] }));
    x.tell(at('lobby'));
    x.tell(at('hide', { settings: double, roles: hiders, first: [], hid: [1, 2, 3] }));
    const live1 = made.remotes.findLast((r) => (r as unknown as { last: Me }).last?.pos[0] === 1)!;
    live1.log.push(dab(5));
    x.play.applyDabs([dab(0), dab(1)]);
    const before = made.remotes.length;
    for (const seat of [1, 2, 3] as Seat[]) x.tell({ t: 'left', seat, body: body({ pos: [seat, 0, 9], pose: 'lie' }) });
    x.tell(at('search', { settings: double, roles: hunters, first: [], hid: [1, 2, 3] }));
    const pins = made.remotes.slice(before);
    return { ...x, pins };
  }

  it('探索に入ると、全員の残した体をそのときの塗りで置き、自分は白い体で入口から探す', () => {
    const { play, pins } = doubled();
    expect(pins).toHaveLength(3);
    expect(pins[0].rig.paint.rebuild).toHaveBeenCalledWith([dab(5)]);
    expect(pins[1].rig.paint.rebuild).toHaveBeenCalledWith([dab(0), dab(1)]);
    expect(play.log.dabs).toHaveLength(0);
    expect(play.role).toBe('hunter');
    expect(play.ghost.pos).toEqual([...SPAWNS.entrance[2]]);
  });

  it('見つけた体は見つけた人の画面からだけ消え、答え合わせでは見つかった体を青、まだの体を赤で出す', () => {
    const { tell, frames, pins } = doubled();
    tell({ t: 'found', seat: 1, by: 3, at: [1, 1, 9] });
    tell(at('search', { settings: double, roles: hunters, first: [], hid: [1, 2, 3], caught: { 3: [1] } }));
    frames(0.1);
    expect(pins[0].lastShow?.visible).toBe(true);
    tell({ t: 'found', seat: 3, by: 2, at: [3, 1, 9] });
    tell(at('search', { settings: double, roles: hunters, first: [], hid: [1, 2, 3], caught: { 3: [1], 2: [3] } }));
    frames(0.1);
    expect(pins[2].lastShow?.visible).toBe(false);
    tell(
      at('reveal', {
        settings: double,
        roles: hunters,
        first: [],
        hid: [1, 2, 3],
        caught: { 3: [1], 2: [3] },
        winner: 'double'
      })
    );
    frames(0.1);
    expect(pins.map((p) => [p.lastShow?.visible, p.lastShow?.shine])).toEqual([
      [true, 'blue'],
      [true, 'red'],
      [true, 'blue']
    ]);
  });

  it('ダブルで戻った子は、残した体を leftDabs の塗りで作り直し、ハンターの続きの場所から探す', () => {
    const d = packDabs([dab(0), dab(1), dab(2)]);
    const messages = [
      meMsg(2, { pos: [7, 0, 5], yaw: 1.5, pose: AIM.id }),
      { t: 'dabs', seat: 2, at: 0, d: [] },
      { t: 'left', seat: 2, body: body({ pos: [2, 0, 9] }) },
      { t: 'leftDabs', seat: 2, at: 0, d },
      at('search', { settings: double, roles: hunters, first: [], hid: [1, 2, 3], seed: 4 })
    ] as Message[];
    const before = made.remotes.length;
    const { s, play } = setup(2, { messages, stop: vi.fn() });
    const pin = made.remotes[before];
    expect(pin.dabs).toHaveBeenCalledWith(0, d);
    expect(play.role).toBe('hunter');
    expect(play.ghost.pos).toEqual([7, 0, 5]);
    expect(play.world.arrange).toHaveBeenCalledWith(4);
    expect(s.pinPaint(2)).toBe(0);
  });
});
