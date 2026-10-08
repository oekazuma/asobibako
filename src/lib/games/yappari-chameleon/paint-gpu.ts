import * as THREE from 'three';
import { srgbToLinear, type RGB } from './color';
import type { Dab } from './paint';

export const COLOR_SIZE = 2048;
export const GLOSS_SIZE = 1024;
export const WHITE_ROUGH = 0.85;
const BATCH = 16;

const VERTEX = `
precision highp float;
in vec2 position;
in vec3 ppos;
in vec3 pnrm;
out vec3 vPos;
out vec3 vNrm;
void main() {
  vPos = ppos;
  vNrm = pnrm;
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}`;

// 16 個の吹き付けを古い順に重ね、前乗算のアルファで出す。描く先とは ONE, ONE_MINUS_SRC_ALPHA で混ぜる
const FRAGMENT = `
precision highp float;
uniform int uCount;
uniform vec4 uP[${BATCH}];
uniform vec4 uN[${BATCH}];
uniform vec4 uC[${BATCH}];
in vec3 vPos;
in vec3 vNrm;
out vec4 outColor;
void main() {
  vec3 n = normalize(vNrm);
  vec3 c = vec3(0.0);
  float a = 0.0;
  for (int i = 0; i < ${BATCH}; i++) {
    if (i >= uCount) break;
    float r = uP[i].w;
    float d = distance(vPos, uP[i].xyz);
    // 裏を向いた面（腕の向こう側など）には付けない
    float k = uC[i].a * (1.0 - smoothstep(r * 0.35, r, d)) * smoothstep(0.0, 0.35, dot(n, uN[i].xyz));
    c = c * (1.0 - k) + uC[i].rgb * k;
    a = a * (1.0 - k) + k;
  }
  outColor = vec4(c, a);
}`;

const FILL_VERTEX = `
precision highp float;
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

const FILL_FRAGMENT = `
precision highp float;
uniform vec4 uFill;
out vec4 outColor;
void main() { outColor = uFill; }`;

const target = (size: number, colorSpace: THREE.ColorSpace) =>
  new THREE.WebGLRenderTarget(size, size, {
    colorSpace,
    depthBuffer: false,
    generateMipmaps: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter
  });

/**
 * 人形の塗り。色の先は sRGB の 8 bit にするので、シェーダーは linear の色を書き、
 * 混ぜるのも linear で行われる（WebGL2 の sRGB の描き先）。読み出すと sRGB の値が返る
 */
export class PaintSurface {
  readonly color = target(COLOR_SIZE, THREE.SRGBColorSpace);
  readonly gloss = target(GLOSS_SIZE, THREE.NoColorSpace);
  readonly #renderer: THREE.WebGLRenderer;
  readonly #camera = new THREE.Camera();
  readonly #paint = new THREE.Scene();
  readonly #fill = new THREE.Scene();
  readonly #u = {
    uCount: { value: 0 },
    uP: { value: Array.from({ length: BATCH }, () => new THREE.Vector4()) },
    uN: { value: Array.from({ length: BATCH }, () => new THREE.Vector4()) },
    uC: { value: Array.from({ length: BATCH }, () => new THREE.Vector4()) }
  };
  readonly #fillColor = { value: new THREE.Vector4() };
  readonly #pixel = new Uint8Array(4);

  constructor(renderer: THREE.WebGLRenderer, geo: THREE.BufferGeometry) {
    this.#renderer = renderer;
    // position は 2 成分なので、three が並べ替えのために外接球を測ると NaN になる。測らせないよう先に入れる
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1);
    const paint = new THREE.Mesh(
      geo,
      new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: this.#u,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor
      })
    );
    paint.frustumCulled = false;
    this.#paint.add(paint);
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 3, -1, -1, 3]), 2));
    tri.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1);
    const fill = new THREE.Mesh(
      tri,
      new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: FILL_VERTEX,
        fragmentShader: FILL_FRAGMENT,
        uniforms: { uFill: this.#fillColor },
        depthTest: false,
        depthWrite: false,
        blending: THREE.NoBlending
      })
    );
    fill.frustumCulled = false;
    this.#fill.add(fill);
    this.reset();
  }

  #draw(to: THREE.WebGLRenderTarget, scene: THREE.Scene) {
    const r = this.#renderer;
    const before = r.getRenderTarget();
    const auto = r.autoClear;
    // autoClear のままだと、描くたびに今までの塗りを消してしまう
    r.autoClear = false;
    r.setRenderTarget(to);
    r.render(scene, this.#camera);
    r.setRenderTarget(before);
    r.autoClear = auto;
  }

  reset(): void {
    this.#fillColor.value.set(1, 1, 1, 1);
    this.#draw(this.color, this.#fill);
    this.#fillColor.value.set(0, WHITE_ROUGH, 0, 1);
    this.#draw(this.gloss, this.#fill);
  }

  apply(dabs: readonly Dab[]): void {
    const u = this.#u;
    for (let at = 0; at < dabs.length; at += BATCH) {
      const list = dabs.slice(at, at + BATCH);
      u.uCount.value = list.length;
      list.forEach((d, i) => {
        u.uP.value[i].set(d.p[0], d.p[1], d.p[2], d.r);
        u.uN.value[i].set(d.n[0], d.n[1], d.n[2], 0);
        u.uC.value[i].set(srgbToLinear(d.c[0]), srgbToLinear(d.c[1]), srgbToLinear(d.c[2]), d.a);
      });
      this.#draw(this.color, this.#paint);
      list.forEach((d, i) => u.uC.value[i].set(0, d.ro, d.m, d.a));
      this.#draw(this.gloss, this.#paint);
    }
  }

  rebuild(dabs: readonly Dab[]): void {
    this.reset();
    this.apply(dabs);
  }

  read(uv: { x: number; y: number }): { color: RGB; metal: number; rough: number } {
    const px = this.#pixel;
    const at = (size: number, v: number) => Math.min(size - 1, Math.max(0, Math.floor(v * size)));
    this.#renderer.readRenderTargetPixels(this.color, at(COLOR_SIZE, uv.x), at(COLOR_SIZE, uv.y), 1, 1, px);
    const color: RGB = [px[0] / 255, px[1] / 255, px[2] / 255];
    this.#renderer.readRenderTargetPixels(this.gloss, at(GLOSS_SIZE, uv.x), at(GLOSS_SIZE, uv.y), 1, 1, px);
    return { color, rough: px[1] / 255, metal: px[2] / 255 };
  }

  dispose(): void {
    this.color.dispose();
    this.gloss.dispose();
    for (const s of [this.#paint, this.#fill])
      s.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
  }
}
