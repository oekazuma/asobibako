import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry
} from 'three';
import type { Scene } from './chart';
import { drawLed, LED, LED_H, LED_W } from './led-draw';
import { LIGHT } from './toon';

/**
 * ステージ。一段高い丸い舞台（ふちが光る）と光る床、うしろの大きな LED スクリーン、上のトラスから差す照明、
 * もりあがり（hype）で照明の本数と明るさが変わる（手前の客席は crowd-draw.ts が画面にかぶせて描く）。
 * 背景はキャラクターが埋もれないよう、暗めの紫で奥を沈める
 */

export interface StageState {
  beat: number;
  scene: Scene;
  hype: number;
  /** この区間のはじめのスペシャルをきめた */
  lit: boolean;
  /** アイドルのカラー */
  color: string;
}

const SKY: Record<Scene, [string, string]> = {
  intro: ['#120a2c', '#3a1a5a'],
  verse: ['#0e1646', '#3a2a86'],
  bridge: ['#1c0a3a', '#6a2060'],
  chorus: ['#070522', '#2c1266'],
  break: ['#160a32', '#58206e'],
  finale: ['#1c0e3c', '#8a3a6a']
};

const BEAM_VERT = /* glsl */ `
varying float vH;
varying vec3 vN;
varying vec3 vW;
void main() {
  vH = uv.y;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const BEAM_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uPower;
varying float vH;
varying vec3 vN;
varying vec3 vW;
void main() {
  // 光の筋は根元ほど濃く、ふちほど薄い（真横から見ると芯が濃い）
  vec3 V = normalize(cameraPosition - vW);
  float core = pow(abs(dot(normalize(vN), V)), 1.5);
  gl_FragColor = vec4(uColor * uPower * core * pow(vH, 1.6) * 0.5, 1.0);
  #include <colorspace_fragment>
}`;

function beam(): Mesh {
  const g = new ConeGeometry(0.9, 6, 24, 1, true);
  // 頂点（光の出どころ）を原点に、下へ広がる向きにする
  g.translate(0, -3, 0);
  const m = new ShaderMaterial({
    vertexShader: BEAM_VERT,
    fragmentShader: BEAM_FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    uniforms: { uColor: { value: new Color('#ffffff') }, uPower: { value: 1 } }
  });
  return new Mesh(g, m);
}

function sky(): Mesh {
  const g = new SphereGeometry(40, 32, 16);
  const m = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms: { uTop: { value: new Color() }, uBottom: { value: new Color() } },
    vertexShader: `varying float vY; void main() { vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uTop; uniform vec3 uBottom; varying float vY;
      void main() { gl_FragColor = vec4(mix(uBottom, uTop, smoothstep(-0.1, 0.5, vY)), 1.0);
      #include <colorspace_fragment>
      }`
  });
  return new Mesh(g, m);
}

export class Stage3D {
  readonly group = new Group();
  readonly #sky = sky();
  readonly #ledCanvas = document.createElement('canvas');
  readonly #led: CanvasTexture;
  readonly #edge: MeshBasicMaterial;
  readonly #glow: MeshBasicMaterial;
  readonly #beams: Mesh[] = [];
  #ledBeat = -1;

  constructor() {
    this.group.add(this.#sky);
    // 舞台。上面は暗い床に同心円と放射の光の線
    const floorTex = this.#floorTexture();
    const top = new Mesh(new CircleGeometry(2.6, 64), new MeshBasicMaterial({ map: floorTex }));
    top.rotation.x = -Math.PI / 2;
    const side = new Mesh(
      new CylinderGeometry(2.6, 2.7, 0.9, 64, 1, true),
      new MeshBasicMaterial({ color: '#150a2c' })
    );
    side.position.y = -0.45;
    this.#edge = new MeshBasicMaterial({ color: '#ff6fa5' });
    const edge = new Mesh(new TorusGeometry(2.6, 0.025, 8, 96), this.#edge);
    edge.rotation.x = Math.PI / 2;
    edge.position.y = 0.01;
    this.#glow = new MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.35,
      blending: AdditiveBlending,
      depthWrite: false,
      map: radial()
    });
    const pool = new Mesh(new CircleGeometry(0.9, 32), this.#glow);
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.012;
    // 客席の床
    const hall = new Mesh(new PlaneGeometry(30, 20), new MeshBasicMaterial({ color: '#0a0518' }));
    hall.rotation.x = -Math.PI / 2;
    hall.position.set(0, -0.9, 6);
    this.group.add(top, side, edge, pool, hall);
    // うしろの LED スクリーン
    this.#ledCanvas.width = LED_W;
    this.#ledCanvas.height = LED_H;
    this.#led = new CanvasTexture(this.#ledCanvas);
    this.#led.colorSpace = SRGBColorSpace;
    const screen = new Mesh(new PlaneGeometry(9, 9 * (LED_H / LED_W)), new MeshBasicMaterial({ map: this.#led }));
    screen.position.set(0, 2.5, -3.4);
    const frame = new Mesh(
      new BoxGeometry(9.3, 9 * (LED_H / LED_W) + 0.3, 0.1),
      new MeshBasicMaterial({ color: '#1a1030' })
    );
    frame.position.set(0, 2.5, -3.47);
    // トラスと、左右の光の柱
    const truss = new Mesh(new BoxGeometry(10, 0.18, 0.18), new MeshBasicMaterial({ color: '#2a2440' }));
    truss.position.set(0, 5.2, -0.5);
    this.group.add(frame, screen, truss);
    for (const s of [-1, 1]) {
      const pillar = new Mesh(new BoxGeometry(0.12, 4.5, 0.12), new MeshBasicMaterial({ color: '#ff6fa5' }));
      pillar.position.set(s * 4.8, 2.25, -3.2);
      pillar.userData.pillar = true;
      this.group.add(pillar);
    }
    for (let i = 0; i < 8; i++) {
      const b = beam();
      b.position.set(-4.2 + (8.4 * i) / 7, 5.2, -0.5);
      this.#beams.push(b);
      this.group.add(b);
    }
  }

  update(s: StageState): void {
    const { beat, hype } = s;
    const [top, bottom] = SKY[s.scene];
    const sk = this.#sky.material as ShaderMaterial;
    sk.uniforms.uTop.value.set(top);
    sk.uniforms.uBottom.value.set(bottom);
    const pulse = beat >= 0 ? Math.exp(-(beat - Math.floor(beat)) * 5) : 0;
    const colors = LED[s.scene];
    this.#edge.color.set(s.color).multiplyScalar(0.6 + 0.6 * pulse * (0.3 + hype));
    this.#glow.opacity = 0.3 + 0.25 * hype;
    // LED は 1 拍に 8 回だけ描きなおす
    const q = Math.floor(beat * 8);
    if (q !== this.#ledBeat) {
      this.#ledBeat = q;
      drawLed(this.#ledCanvas.getContext('2d')!, s.scene, beat, hype, s.lit);
      this.#led.needsUpdate = true;
    }
    const lit = 2 + Math.round(hype * 6);
    this.#beams.forEach((b, i) => {
      b.visible = i % Math.ceil(8 / lit) === 0 || i < lit;
      const swing = Math.sin(beat * Math.PI * 0.25 + i * 1.3) * (0.25 + 0.3 * hype);
      b.rotation.set(0.35 + 0.1 * Math.sin(beat * 0.5 + i), 0, swing + (i - 3.5) * 0.06);
      const m = b.material as ShaderMaterial;
      m.uniforms.uColor.value.set(colors[i % colors.length]);
      m.uniforms.uPower.value = 0.35 + 0.35 * hype + 0.2 * pulse;
    });
    for (const o of this.group.children)
      if (o.userData.pillar)
        ((o as Mesh).material as MeshBasicMaterial).color.set(colors[0]).multiplyScalar(0.4 + 0.6 * pulse);
    // キャラクターのふちに差す光は、区間の色で
    LIGHT.rim.value.set(colors[Math.floor(Math.max(0, beat) / 4) % colors.length]).lerp(new Color('#ffffff'), 0.35);
  }

  #floorTexture(): CanvasTexture {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const x = c.getContext('2d')!;
    const g = x.createRadialGradient(256, 256, 0, 256, 256, 256);
    g.addColorStop(0, '#3a2468');
    g.addColorStop(1, '#170c34');
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 512);
    x.strokeStyle = 'rgba(255, 170, 230, 0.35)';
    x.lineWidth = 3;
    for (const r of [80, 150, 220]) {
      x.beginPath();
      x.arc(256, 256, r, 0, Math.PI * 2);
      x.stroke();
    }
    x.lineWidth = 2;
    x.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      x.moveTo(256 + Math.cos(a) * 80, 256 + Math.sin(a) * 80);
      x.lineTo(256 + Math.cos(a) * 250, 256 + Math.sin(a) * 250);
    }
    x.stroke();
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
  }
}

/** 真ん中が明るく外へ消える丸（光のにじみ） */
let glowTex: CanvasTexture | null = null;
function radial(): CanvasTexture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  glowTex = new CanvasTexture(c);
  return glowTex;
}
