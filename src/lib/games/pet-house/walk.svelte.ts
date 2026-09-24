import { Vector3 } from 'three';
import { graphics } from '$lib/graphics.svelte';
import type { Activity, ActivityHost, Follow } from './activity';
import type { Actor } from './behavior';
import { BREEDS } from './breeds';
import { play, stroke } from './engine';
import type { Layout, Spot } from './layout';
import { createPet, type PetModel } from './models';
import { buildStreet, type Street } from './scene-street';
import { sounds } from './sounds';
import type { BreedId, PetAction } from './types';
import { LENGTH, SIDEWALK, plan, tether, type Stop } from './walk';

const STREET: Layout = {
  bounds: { x0: SIDEWALK.x0, x1: SIDEWALK.x1, z0: -LENGTH - 5, z1: 2 },
  front: { x: 0, z: 0 },
  blocks: [],
  camera: { x: 0.15, y: 1.55, z: 2.8, lookX: 0.45, lookY: 0.35, lookZ: -2.4, fov: 48 }
};
const FOLLOW: Follow = { x: 0.45, zMin: -LENGTH - 10, zMax: 5, near: 1.9, rate: 2.2, shadow: 3 };
/** 手元の歩く速さ（m/s）と、ペットが手元より先を歩く距離、地面の上でリードが届く距離 */
const WALK = 1.15;
const LEAD = 1.7;
const LEASH = 2.4;
/** 止まったペットに、手元が後ろから近づける距離。これより寄ると追いこしてカメラの下へ隠れる */
const CLOSE = 1.25;
/** 寄り道する出来事までの、ペットの前の距離 */
const REACH = 3.2;
const DOGS: BreedId[] = ['shiba', 'beagle', 'poodle'];

type Mode = 'follow' | 'toSpot' | 'sniff' | 'pee' | 'poop' | 'greet' | 'arrive';

interface Npc {
  model: PetModel;
  breed: BreedId;
  x: number;
  z: number;
  heading: number;
  state: 'come' | 'greet' | 'go';
}

/**
 * リードでおさんぽ（犬だけ）。画面を押しているあいだ手元が歩き、ペットは少し先を歩いて、
 * 電柱・消火栓・草むら・プレゼントへ寄り道し、ほかの犬とあいさつし、ときどきうんちをする。道の先の公園に着いたら公園へ出る
 */
export class WalkPlay implements Activity {
  readonly drives = true;
  meters = $state(0);
  /** ひろっていないうんちがある */
  poop = $state(false);

  #host!: ActivityHost;
  #street: Street | null = null;
  #stops: Stop[] = [];
  #done: Stop[] = [];
  #hand = { x: 0, z: LEAD, v: 0 };
  #start = LEAD;
  #finger: { id: number; x: number } | null = null;
  #mode: Mode = 'follow';
  #t = 0;
  #clock = 0;
  #spot: Stop | null = null;
  #npc: Npc | null = null;
  #dung: Spot | null = null;
  #nag = 0;
  #step = 0;
  #tired = 0;
  #taut = false;
  #cheered = false;
  #met = 0;
  readonly #v = new Vector3();

  enter(host: ActivityHost): void {
    this.#host = host;
    this.#stops = plan(Math.random);
    host.enter({
      id: 'street',
      layout: STREET,
      follow: FOLLOW,
      outdoor: true,
      build: () => (this.#street = buildStreet(this.#stops, host.world.camera))
    });
    this.#stops.forEach((s, i) => s.kind === 'present' && host.view.presents.push({ id: i + 1, x: s.x, z: s.z }));
    const a = host.actor;
    if (a) [a.x, a.z, a.heading] = [0, -0.2, Math.PI];
    this.#hand = { x: 0, z: (a?.z ?? 0) + LEAD, v: 0 };
    this.#start = this.#hand.z;
    host.setTool('hand');
    host.say('がめんを おしている あいだ あるくよ', 5);
  }

  frame(dt: number): void {
    const a = this.#host.actor;
    if (!a || !this.#street) return;
    this.#t += dt;
    this.#clock += dt;
    this.#walk(dt, a);
    this.#pet(dt, a);
    // 公園に着いて host.end() したあとは、もう道の上の物を動かさない
    if (!this.#street) return;
    this.#other(dt, a);
    this.#leash(a);
    this.meters = Math.max(0, Math.round(this.#start - this.#hand.z));
  }

  #set(mode: Mode, spot: Stop | null = this.#spot) {
    this.#mode = mode;
    this.#spot = spot;
    this.#t = 0;
    this.#cheered = false;
  }

  /** 手元。押しているあいだ前へ歩き、ペットが止まっているあいだは止まる */
  #walk(dt: number, a: Actor) {
    const hand = this.#hand;
    const f = this.#finger;
    const mode = this.#mode;
    let want = f && (mode === 'follow' || mode === 'toSpot' || mode === 'sniff') ? WALK : 0;
    if (mode !== 'follow' && hand.z - a.z < CLOSE) want = 0;
    // ひろわずに通りすぎたら声をかけ、カメラの後ろへ消えたら片づいたことにする（止めてしまうと先へ進めなくなる子がいる）
    const dung = this.#dung;
    if (dung && hand.z < dung.z - 0.3 && this.#clock > this.#nag) {
      this.#nag = Infinity;
      this.#host.say('うんちを ひろって あげてね');
    }
    if (dung && dung.z > this.#host.world.camera.position.z + 0.5) {
      this.#street?.clearPoop();
      this.#dung = null;
      this.poop = false;
    }
    hand.v += (want - hand.v) * Math.min(1, dt * 5);
    hand.z -= hand.v * dt;
    const [w] = this.#host.size;
    const x = f ? Math.max(-0.7, Math.min(0.7, (f.x / w - 0.5) * 1.6)) : hand.x;
    hand.x += (x - hand.x) * Math.min(1, dt * 2);
    if (hand.v > 0.3 && (this.#step -= dt) <= 0) {
      this.#step = 0.5;
      sounds.step();
    }
    if (hand.v > 0.1) this.#tired += dt;
    if (this.#tired >= 1) {
      play(this.#host.pet, this.#tired / 20);
      this.#tired = 0;
      this.#host.changed();
    }
  }

  #pet(dt: number, a: Actor) {
    const host = this.#host;
    const hand = this.#hand;
    const s = this.#spot;
    a.wag = 0.8;
    a.look = 0;
    switch (this.#mode) {
      case 'follow': {
        this.#steer(a, hand.x * 0.7, hand.z - LEAD, 1.6, dt);
        if (a.v < 0.05) a.look = Math.sin(this.#clock * 0.9) * 0.5;
        const next = this.#stops.find((t) => !this.#done.includes(t) && t.z < a.z + 0.3 && t.z > a.z - REACH);
        if (next?.kind === 'poop') {
          if (next.z > a.z) this.#set('poop', next);
        } else if (next && next.kind !== 'dog') this.#set('toSpot', next);
        break;
      }
      case 'toSpot': {
        if (!s) return this.#set('follow');
        const to = this.#standAt(s);
        this.#steer(a, to.x, to.z, 1.4, dt);
        if (Math.hypot(to.x - a.x, to.z - a.z) < 0.15) {
          this.#set('sniff');
          sounds.sniff();
        }
        break;
      }
      case 'sniff':
        this.#hold(a, 'eat', dt);
        a.look = Math.sin(this.#t * 7) * 0.35;
        if (s?.kind === 'present' && this.#t > 0.7) {
          this.#done.push(s);
          host.view.presents = host.view.presents.filter((p) => p.id !== this.#stops.indexOf(s) + 1);
          host.found(a);
          this.#set('follow', null);
        } else if (this.#t > 1.2 && s?.pee) this.#set('pee');
        else if (this.#t > (this.#finger ? 1.2 : 2.6)) {
          if (s) this.#done.push(s);
          this.#set('follow', null);
        }
        break;
      case 'pee':
        this.#pee(a, dt);
        break;
      case 'poop':
        this.#hold(a, 'sit', dt);
        if (this.#t > 1.4 && !this.#dung && s && !this.#done.includes(s)) {
          this.#done.push(s);
          this.#dung = { x: a.x - Math.sin(a.heading) * 0.2, z: a.z - Math.cos(a.heading) * 0.2 };
          this.#street?.poop(this.#dung.x, this.#dung.z);
          this.poop = true;
          this.#nag = 0;
          sounds.plop();
          host.say('うんちが でた！ ふくろで ひろおう', 4);
        }
        if (this.#t > 2.1) this.#set('follow', null);
        break;
      case 'greet':
        this.#hold(a, this.#t > 1.2 && this.#t < 2.4 ? 'happy' : 'stand', dt);
        a.wag = 1;
        break;
      case 'arrive':
        this.#hold(a, 'happy', dt);
        if (this.#t > 1.3) host.end('park');
        return;
    }
    // リードが張ったら、寄り道のときはペットが手元を引っぱり、ほかのときは手元がペットを引き寄せる
    const d = Math.hypot(a.x - hand.x, a.z - hand.z);
    this.#taut = d > LEASH;
    if (this.#taut && this.#mode === 'toSpot') {
      const k = (d - LEASH) / d;
      hand.x += (a.x - hand.x) * k;
      hand.z += (a.z - hand.z) * k;
    } else if (this.#taut) {
      const p = tether(a, hand, LEASH);
      [a.x, a.z] = [p.x, p.z];
    }
    if (a.z < -LENGTH + 0.3) {
      this.#set('arrive', null);
      host.say('こうえんに ついた！ プレゼントを さがそう');
    }
  }

  /** 電柱と消火栓のそばでは、横に並んで立つ */
  #standAt(s: Stop): Spot {
    if (s.kind === 'pole' || s.kind === 'hydrant') return { x: s.x - Math.sign(s.x) * 0.35, z: s.z };
    return { x: Math.max(SIDEWALK.x0 + 0.2, s.x), z: s.z };
  }

  /** 足を上げるかっこうは無いので、電柱の側の体を持ち上げるように傾けて立たせる */
  #pee(a: Actor, dt: number) {
    const s = this.#spot;
    if (!s) return this.#set('follow');
    const side = Math.atan2(s.x - a.x, s.z - a.z) - Math.PI / 2;
    const diff = wrap(side - a.heading);
    a.heading = wrap(a.heading + Math.max(-4 * dt, Math.min(4 * dt, diff)));
    this.#hold(a, Math.abs(diff) > 0.1 ? 'walk' : 'stand', dt);
    const model = this.#host.world.model(this.#host.pet.id);
    const up = this.#t > 0.5 && this.#t < 2.6;
    this.#street?.tilt(model?.group ?? null, up ? 0.3 : 0);
    if (up && !this.#cheered) {
      this.#cheered = true;
      this.#street?.puddle(s.x + (a.x - s.x) * 0.45, s.z);
      sounds.pee();
    }
    if (this.#t > 2.9) {
      this.#done.push(s);
      this.#set('follow', null);
    }
  }

  /** ほかの犬。近づいたら出てきて向こうから歩いてきて、会ったらにおいをかぎ合う */
  #other(dt: number, a: Actor) {
    const host = this.#host;
    const hand = this.#hand;
    const stop = this.#stops.find((s) => s.kind === 'dog' && !this.#done.includes(s) && hand.z < s.z + 14);
    if (!this.#npc && stop) {
      this.#done.push(stop);
      const breed = DOGS.filter((b) => b !== host.pet.breed)[this.#met++ % 2];
      const model = createPet(breed, graphics.quality);
      this.#street?.group.add(model.group);
      this.#npc = { model, breed, x: 0.4, z: stop.z - 5, heading: 0, state: 'come' };
    }
    const n = this.#npc;
    if (!n) return;
    const d = Math.hypot(n.x - a.x, n.z - a.z);
    let v = 0;
    let action: PetAction = 'stand';
    if (n.state === 'come') {
      n.x += (a.x - n.x) * Math.min(1, dt * 0.8);
      v = d > (this.#mode === 'follow' ? 0.8 : 1.4) ? 0.7 : 0;
      n.heading = Math.atan2(a.x - n.x, a.z - n.z);
      if (!v && this.#mode === 'follow') {
        n.state = 'greet';
        this.#set('greet', null);
      }
    } else if (n.state === 'greet') {
      n.heading = Math.atan2(a.x - n.x, a.z - n.z);
      a.heading = wrap(n.heading + Math.PI);
      action = this.#t > 1.2 && this.#t < 2.4 ? 'happy' : 'stand';
      if (this.#t > 1.2 && !this.#cheered) {
        this.#cheered = true;
        sounds.greet();
        host.voice();
        host.fx.hearts(...host.above(a), 3);
        const [nx, ny] = host.world.project(n.x, 0.45, n.z);
        host.fx.hearts(nx, ny, 3);
        host.say(`${BREEDS[n.breed].name}と あいさつ したよ`);
      }
      if (this.#t > 2.7) {
        n.state = 'go';
        this.#set('follow', null);
      }
    } else {
      const lane = a.x > 0 ? a.x - 0.7 : a.x + 0.7;
      n.x += (lane - n.x) * Math.min(1, dt * 2);
      n.heading = 0;
      v = 0.9;
      if (n.z > host.world.camera.position.z + 0.5) return this.#drop();
    }
    n.z += Math.cos(n.heading) * v * dt;
    n.x += Math.sin(n.heading) * v * dt * (n.state === 'come' ? 1 : 0);
    if (v) action = 'walk';
    n.model.group.position.set(n.x, 0, n.z);
    n.model.group.rotation.y = n.heading;
    const look = n.state === 'greet' ? Math.sin(this.#t * 6) * 0.3 : 0;
    n.model.update(action, dt, { speed: v ? 0.55 : 0, wag: 1, look, t: this.#clock });
  }

  #drop() {
    const n = this.#npc;
    if (!n) return;
    n.model.group.removeFromParent();
    n.model.dispose();
    this.#npc = null;
  }

  #leash(a: Actor) {
    const host = this.#host;
    const [w, h] = host.size;
    const hand = host.world.floor(w * 0.56, h + 40, 0.8);
    const mouth = host.world.model(host.pet.id)?.mouth;
    if (!hand || !mouth || !this.#street) return;
    const neck = mouth.getWorldPosition(this.#v).clone();
    neck.x -= Math.sin(a.heading) * 0.09;
    neck.z -= Math.cos(a.heading) * 0.09;
    neck.y -= 0.05;
    const from = new Vector3(hand.x, 0.8, hand.z);
    this.#street.leash(from, neck, this.#taut ? 0 : Math.max(0, 2.9 - from.distanceTo(neck)));
  }

  /** その場で止まって、かっこうをとる */
  #hold(a: Actor, action: PetAction, dt: number) {
    a.v = Math.max(0, a.v - 6 * dt);
    a.speed = action === 'walk' ? 0.3 : 0;
    a.action = action;
  }

  #steer(a: Actor, tx: number, tz: number, max: number, dt: number) {
    const d = Math.hypot(tx - a.x, tz - a.z);
    let goal = 0;
    let spin = 0;
    if (d > 0.08) {
      const diff = wrap(Math.atan2(tx - a.x, tz - a.z) - a.heading);
      const step = Math.max(-5 * dt, Math.min(5 * dt, diff));
      a.heading = wrap(a.heading + step);
      spin = Math.abs(step) / dt;
      goal = Math.min(max, d * 2.5) * Math.max(0.2, Math.cos(diff));
    }
    a.v += Math.max(-4 * dt, Math.min(3 * dt, goal - a.v));
    a.x += Math.sin(a.heading) * a.v * dt;
    a.z += Math.cos(a.heading) * a.v * dt;
    const moving = a.v > 0.05 || spin > 1;
    a.action = !moving ? 'stand' : a.v > 1.25 ? 'run' : 'walk';
    a.speed = moving ? Math.min(1, Math.max(0.3, a.v / 1.3)) : 0;
  }

  /** ふくろのボタン。うんちをひろう */
  pick(): void {
    const host = this.#host;
    const dung = this.#dung;
    if (!dung) return;
    this.#street?.clearPoop();
    this.#dung = null;
    this.poop = false;
    stroke(host.pet, 20);
    host.changed();
    const [x, y] = host.world.project(dung.x, 0.1, dung.z);
    host.fx.sparkle(x, y, 5);
    host.fx.text('きれいに できたね！', x, y - 30, '#1f9bff', 34);
    sounds.sparkle();
  }

  home(): void {
    this.#host.end();
  }

  down(id: number, px: number, py: number): boolean {
    const dung = this.#dung;
    if (dung) {
      const [x, y] = this.#host.world.project(dung.x, 0.05, dung.z);
      if (Math.hypot(px - x, py - y) < 80) {
        this.pick();
        return true;
      }
    }
    this.#finger = { id, x: px };
    return true;
  }

  move(id: number, px: number): boolean {
    if (this.#finger?.id === id) this.#finger.x = px;
    return true;
  }

  up(id: number): boolean {
    if (this.#finger?.id === id) this.#finger = null;
    return true;
  }

  exit(): void {
    this.#drop();
    this.#street?.tilt(null, 0);
    this.#street = null;
  }
}

const wrap = (x: number) => Math.atan2(Math.sin(x), Math.cos(x));
