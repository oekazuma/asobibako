import * as THREE from 'three';
import { zoneAt, type Zone } from './course';
import { boost, FAR_W, REACH, speed, type Obstacle, type RunEvent, type RunState, type Walker } from './engine';
import { chara, HERO, passer, recolor, run, type Chara } from './chara';
import { CAMERA, gate, heartTexture, megaphone, obstacle, SEG, soundCone } from './models';
import { Post } from './post';
import { MOOD, segment } from './scenery';

const AHEAD = 90;
const BEHIND = 2;
/** 後ろをついて走るファンの見える数。それより多い分は数字だけ増える */
const FANS = 14;
/** ファンになった人が跳ねてから列へ走り出すまでの秒 */
const POP = 0.45;
const HEARTS = 60;

const near = new THREE.Vector3();
const far = new THREE.Vector3();

/** 通行人の形はこの細かさ（m）で作る。人数が多いので、走る子より粗くして組み立ての時間を抑える */
const CROWD_DETAIL = 0.02;
const FAN_SHIRT = '#ff7eb6';
/** 通行人の見た目の組み合わせの数（chara.ts の passer と同じ） */
const LOOKS = 8;

interface Pop {
  fig: Chara;
  t: number;
  x: number;
  z: number;
}

interface Heart {
  sprite: THREE.Sprite;
  v: THREE.Vector3;
  t: number;
}

interface Flying {
  group: THREE.Group;
  v: THREE.Vector3;
  spin: THREE.Vector3;
  t: number;
}

export class RunWorld {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, 0.1, 160);
  readonly #post: Post;
  readonly #sun = new THREE.DirectionalLight('#fff1d6', 2.6);
  readonly #hemi = new THREE.HemisphereLight('#e6f4ff', '#b7ae9f', 1.6);
  readonly #fog = new THREE.Fog('#cfe9ff', 40, 88);
  readonly #sky = new THREE.Color('#8fd0ff');
  readonly #hero = chara(HERO, 0.012);
  #heroX = 0;
  #lean = 0;
  #phase = 0;
  #t = 0;
  #made = 0;
  #shake = 0;
  #flash = 0;
  #fov: number = CAMERA.fov;
  readonly #segments = new Map<number, { zone: Zone; group: THREE.Group }>();
  readonly #walkers = new Map<Walker, Chara>();
  readonly #pops: Pop[] = [];
  readonly #fans: Chara[] = [];
  readonly #blocks = new Map<Obstacle, THREE.Group>();
  readonly #flying: Flying[] = [];
  readonly #cones: { mesh: THREE.Mesh; t: number }[] = [];
  readonly #hearts: Heart[] = [];
  readonly #shockwave: THREE.Mesh;
  #shockT = -1;
  readonly #goal = gate();

  constructor(canvas: HTMLCanvasElement, s: RunState) {
    // デフォルメのローポリなので MSAA は使わず、仕上げの SMAA でふちをならす
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(1.5, devicePixelRatio));
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene.background = this.#sky;
    this.scene.fog = this.#fog;
    this.scene.add(this.#hemi);
    this.#sun.castShadow = true;
    this.#sun.shadow.mapSize.set(1024, 1024);
    this.#sun.shadow.bias = -0.0005;
    const c = this.#sun.shadow.camera;
    c.left = c.bottom = -12;
    c.right = c.top = 12;
    c.near = 1;
    c.far = 40;
    this.scene.add(this.#sun, this.#sun.target);
    this.#goal.group.position.z = -s.rule.length;
    const horn = megaphone();
    horn.position.set(-0.02, -0.15, -0.06);
    this.#hero.bones.handR.add(horn);
    this.scene.add(this.#hero.group, this.#goal.group);
    // 通行人の形は最初にまとめて作っておく。走っている途中で作ると、その瞬間に画面が止まる
    for (let i = 0; i < LOOKS; i++) recolor(chara(passer(i), CROWD_DETAIL), FAN_SHIRT);
    for (let i = 0; i < HEARTS; i++) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: heartTexture(), transparent: true, depthWrite: false })
      );
      sprite.visible = false;
      this.scene.add(sprite);
      this.#hearts.push({ sprite, v: new THREE.Vector3(), t: 1 });
    }
    for (let i = 0; i < 4; i++) {
      const mesh = soundCone();
      mesh.visible = false;
      this.scene.add(mesh);
      this.#cones.push({ mesh, t: 1 });
    }
    this.#shockwave = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.12, 8, 48),
      new THREE.MeshBasicMaterial({
        color: '#ffe066',
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.#shockwave.visible = false;
    this.scene.add(this.#shockwave);
    this.#post = new Post(this.renderer, this.scene, this.camera);
    this.#applyMood(zoneAt(0), 1);
    this.update(s, 0);
  }

  resize(w: number, h: number): void {
    this.renderer.setSize(w, h, false);
    this.#post.resize(w, h, this.renderer.getPixelRatio());
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  precompile(): Promise<unknown> {
    return this.renderer.compileAsync(this.scene, this.camera);
  }

  handle(e: RunEvent): void {
    if (e.type === 'pulse') this.#pulse();
    else if (e.type === 'hit') {
      for (const w of e.walkers) this.#pop(w);
      this.#shake = Math.min(1, this.#shake + 0.04 * e.walkers.length);
    } else if (e.type === 'shout') {
      for (const w of e.walkers) this.#pop(w);
      for (const o of e.blocks) this.#launch(o, 1.6);
      this.#shockT = 0;
      this.#shake = 1;
      this.#flash = 0.3;
    } else if (e.type === 'bump') {
      this.#launch(e.obstacle, 1);
      this.#shake = 0.8;
    } else if (e.type === 'goal') this.#flash = 0.35;
  }

  #pulse() {
    const c = this.#cones.find((k) => k.t >= 1) ?? this.#cones[0];
    c.t = 0;
    c.mesh.visible = true;
  }

  #pop(w: Walker) {
    const fig = this.#walkers.get(w);
    if (!fig) return;
    this.#walkers.delete(w);
    recolor(fig, FAN_SHIRT);
    this.#pops.push({ fig, t: 0, x: w.x, z: w.z });
    for (let i = 0; i < 3; i++) this.#heart(w.x, 1.2, -w.z);
  }

  #heart(x: number, y: number, z: number) {
    const h = this.#hearts.find((k) => k.t >= 1);
    if (!h) return;
    h.t = 0;
    h.sprite.position.set(x, y, z);
    h.v.set((Math.random() - 0.5) * 3, 3 + Math.random() * 2.5, (Math.random() - 0.5) * 2);
    h.sprite.visible = true;
  }

  #launch(o: Obstacle, power: number) {
    const group = this.#blocks.get(o);
    if (!group) return;
    this.#blocks.delete(o);
    const side = o.x >= this.#heroX ? 1 : -1;
    this.#flying.push({
      group,
      v: new THREE.Vector3(side * 4 * power, 6 * power, -7 * power),
      spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
      t: 0
    });
  }

  #applyMood(zone: Zone, k: number) {
    const m = MOOD[zone];
    this.#sky.lerp(new THREE.Color(m.sky), k);
    this.#fog.color.lerp(new THREE.Color(m.fog), k);
    this.#sun.color.lerp(new THREE.Color(m.sun), k);
    this.#sun.intensity += (m.sunI - this.#sun.intensity) * k;
    this.#hemi.color.lerp(new THREE.Color(m.hemi), k);
    this.#hemi.groundColor.lerp(new THREE.Color(m.ground), k);
  }

  update(s: RunState, dt: number): void {
    this.#t += dt;
    const v = speed(s);
    const b = boost(s.combo);
    this.#phase += dt * (5 + v * 1.3);
    const z = -s.z;
    const prevX = this.#heroX;
    this.#heroX = s.x;
    const vx = dt > 0 ? (this.#heroX - prevX) / dt : 0;
    this.#lean += (-vx * 0.05 - this.#lean) * Math.min(1, dt * 10);
    const hero = this.#hero;
    hero.group.position.set(this.#heroX, Math.abs(Math.sin(this.#phase)) * 0.06, z);
    hero.group.rotation.z = this.#lean + (s.stumble > 0 ? Math.sin(this.#t * 30) * 0.25 : 0);
    hero.group.rotation.x = -0.1 - b * 0.15;
    run(hero, this.#phase, s.result ? 0 : 0.95);

    this.#fov += (CAMERA.fov + b * 14 - this.#fov) * Math.min(1, dt * 3);
    this.camera.fov = this.#fov;
    this.camera.updateProjectionMatrix();
    this.#shake = Math.max(0, this.#shake - dt * 2.5);
    const sh = this.#shake * this.#shake * 0.25;
    const camX = this.#heroX * 0.7 + (Math.random() - 0.5) * sh;
    this.camera.position.set(camX, CAMERA.up - b * 0.3 + (Math.random() - 0.5) * sh, z + CAMERA.back - b * 0.6);
    this.camera.lookAt(this.#heroX * 0.85, CAMERA.lookUp, z - CAMERA.look);
    this.camera.rotation.z += this.#lean * 0.4;
    this.#sun.position.set(this.#heroX + 5, 14, z + 6);
    this.#sun.target.position.set(this.#heroX, 0, z - 6);
    this.#applyMood(zoneAt(s.z), Math.min(1, dt * 1.5));

    this.#syncSegments(s);
    this.#syncWalkers(s);
    this.#syncBlocks(s);
    this.#animatePops(dt);
    this.#animateFans(s, dt);
    this.#animateFx(s, dt);
  }

  #syncSegments(s: RunState) {
    const first = Math.floor(s.z / SEG) - 1;
    const last = first + Math.ceil(AHEAD / SEG) + 1;
    for (const [k, seg] of this.#segments)
      if (k < first || k > last) {
        this.scene.remove(seg.group);
        this.#segments.delete(k);
      }
    for (let k = first; k <= last; k++) {
      if (this.#segments.has(k)) continue;
      const zone = zoneAt(k * SEG + SEG / 2);
      const group = segment(zone, k);
      group.position.z = -k * SEG;
      this.scene.add(group);
      this.#segments.set(k, { zone, group });
    }
  }

  #syncWalkers(s: RunState) {
    for (const w of s.walkers) {
      if (w.fan) continue;
      const ahead = w.z - s.z;
      let fig = this.#walkers.get(w);
      if (ahead > AHEAD || ahead < -BEHIND) {
        if (fig) {
          this.scene.remove(fig.group);
          this.#walkers.delete(w);
        }
        continue;
      }
      if (!fig) {
        fig = chara(passer(this.#made++), CROWD_DETAIL);
        fig.group.rotation.y = Math.PI;
        this.#walkers.set(w, fig);
        this.scene.add(fig.group);
      }
      fig.group.position.set(w.x, 0, -w.z);
      // メガホンの扇に近づくと、こちらを見てそわそわする
      const excited = ahead < REACH * 1.6 ? 1 : 0;
      fig.group.position.y = excited * Math.abs(Math.sin(this.#t * 9 + w.phase)) * 0.12;
      run(fig, this.#t * 4 + w.phase, 0.35 + excited * 0.4);
    }
  }

  #syncBlocks(s: RunState) {
    for (const o of s.blocks) {
      if (o.hit) continue;
      const ahead = o.z - s.z;
      let g = this.#blocks.get(o);
      if (ahead > AHEAD || ahead < -BEHIND) {
        if (g) {
          this.scene.remove(g);
          this.#blocks.delete(o);
        }
        continue;
      }
      if (!g) {
        g = obstacle(o.kind, o.w);
        this.#blocks.set(o, g);
        this.scene.add(g);
      }
      g.position.set(o.x, 0, -o.z);
    }
  }

  #animatePops(dt: number) {
    for (const p of this.#pops) {
      p.t += dt;
      const k = Math.min(1, p.t / POP);
      // 跳び上がってくるっと回り、こちらを向く
      p.fig.group.position.set(p.x, Math.sin(k * Math.PI) * 1.1, -p.z);
      p.fig.group.rotation.y = Math.PI * (1 - k) + k * Math.PI * 2;
      const pulse = 1 + Math.sin(k * Math.PI) * 0.25;
      p.fig.group.scale.setScalar(pulse * (1 - k * 0.25));
    }
    for (let i = this.#pops.length - 1; i >= 0; i--) {
      const p = this.#pops[i];
      if (p.t < POP) continue;
      this.#pops.splice(i, 1);
      if (this.#fans.length >= FANS) {
        this.scene.remove(p.fig.group);
        continue;
      }
      p.fig.group.rotation.y = 0;
      p.fig.group.scale.setScalar(0.65);
      this.#fans.push(p.fig);
    }
  }

  #animateFans(s: RunState, dt: number) {
    const z = -s.z;
    this.#fans.forEach((fig, i) => {
      // 走る子の左右の脇から少し前へ並んで走る。後ろに並べるとカメラの手前に来て、画面の下を大きくふさぐ
      const side = i % 2 ? 1 : -1;
      const n = Math.floor(i / 2);
      // 走る子の横と後ろは空けて、主人公が群れに埋もれないようにする
      const tx = this.#heroX + side * (1.05 + (n % 3) * 0.6);
      const tz = z - 0.7 - Math.floor(n / 3) * 1.0;
      const p = fig.group.position;
      // 前後はなめらかに追わせると、速く走るほど後ろへ遅れてカメラの手前に溜まる。横と、列へ入るときだけ寄せる
      const k = Math.min(1, dt * 7);
      const kz = Math.abs(tz - p.z) > 3 ? k : 1;
      p.set(p.x + (tx - p.x) * k, Math.abs(Math.sin(this.#phase + i * 0.7)) * 0.15, p.z + (tz - p.z) * kz);
      run(fig, this.#phase + i * 0.7, 0.9, true);
    });
  }

  #animateFx(s: RunState, dt: number) {
    const z = -s.z;
    for (const c of this.#cones) {
      if (c.t >= 1) continue;
      c.t = Math.min(1, c.t + dt / 0.28);
      const len = REACH * (0.35 + c.t * 0.65);
      const rad = FAR_W * (0.35 + c.t * 0.65);
      c.mesh.position.set(this.#heroX + 0.22, 0.95, z - 0.35);
      c.mesh.scale.set(rad, rad * 0.45, len);
      (c.mesh.material as THREE.MeshBasicMaterial).opacity = 0.32 * (1 - c.t);
      c.mesh.visible = c.t < 1;
    }
    for (const h of this.#hearts) {
      if (h.t >= 1) continue;
      h.t = Math.min(1, h.t + dt / 0.9);
      h.v.y -= 9 * dt;
      h.sprite.position.addScaledVector(h.v, dt);
      h.sprite.scale.setScalar(0.55 * (1 - h.t * 0.4));
      (h.sprite.material as THREE.SpriteMaterial).opacity = Math.min(1, (1 - h.t) * 2.5);
      h.sprite.visible = h.t < 1;
    }
    for (const f of this.#flying) {
      f.t += dt;
      f.v.y -= 16 * dt;
      f.group.position.addScaledVector(f.v, dt);
      f.group.rotation.x += f.spin.x * dt;
      f.group.rotation.y += f.spin.y * dt;
      f.group.rotation.z += f.spin.z * dt;
    }
    for (let i = this.#flying.length - 1; i >= 0; i--)
      if (this.#flying[i].t > 1.4) {
        this.scene.remove(this.#flying[i].group);
        this.#flying.splice(i, 1);
      }
    if (this.#shockT >= 0) {
      this.#shockT += dt;
      const k = this.#shockT / 0.6;
      const m = this.#shockwave.material as THREE.MeshBasicMaterial;
      this.#shockwave.visible = k < 1;
      this.#shockwave.position.set(this.#heroX, 1, z - 1 - k * 18);
      this.#shockwave.scale.setScalar(0.5 + k * 5);
      m.opacity = 1 - k;
      if (k >= 1) this.#shockT = -1;
    }
    this.#flash = Math.max(0, this.#flash - dt * 1.6);
  }

  render(s: RunState): void {
    this.#post.render(boost(s.combo), this.#flash);
  }

  /** 横の位置・距離・高さ（m）を、画面のピクセルと、そこでの 1 m あたりのピクセル数へ */
  project(x: number, dist: number, height: number, w: number, h: number): [number, number, number] {
    const p = near.set(x, height, -dist).project(this.camera);
    const q = far.set(x + 1, height, -dist).project(this.camera);
    return [((p.x + 1) / 2) * w, ((1 - p.y) / 2) * h, (Math.abs(q.x - p.x) / 2) * w];
  }

  dispose(): void {
    this.#goal.dispose();
    for (const c of this.#cones) (c.mesh.material as THREE.Material).dispose();
    for (const h of this.#hearts) h.sprite.material.dispose();
    this.#shockwave.geometry.dispose();
    (this.#shockwave.material as THREE.Material).dispose();
    this.#post.dispose();
    this.renderer.dispose();
    // dispose() だけではコンテキストが残り、Safari は十数個で古いものを失う
    this.renderer.forceContextLoss();
  }
}
