import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/**
 * 色の仕上げ。くすんだ色だけ鮮やかにし、影を青く光を暖かく寄せ、周りを少し暗くする。
 * uSpeed は速さ（0..1）で、画面の端を放射状に流して走っている勢いを出す。uFlash は大声の白い光
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSpeed: { value: 0 },
    uFlash: { value: 0 },
    uAspect: { value: 0.75 }
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uSpeed; uniform float uFlash; uniform float uAspect;
    varying vec2 vUv;
    void main(){
      vec2 c = vUv - vec2(0.5, 0.42);
      float r = length(c * vec2(uAspect, 1.0));
      vec4 col = texture2D(tDiffuse, vUv);
      // 放射状のぶれは画面の端だけにかけ、真ん中の走る子と群れはくっきり残す
      float blur = uSpeed * smoothstep(0.25, 0.75, r) * 0.035;
      if (blur > 0.0005) {
        vec4 acc = col;
        for (int i = 1; i <= 6; i++) acc += texture2D(tDiffuse, vUv - c * blur * float(i));
        col = acc / 7.0;
      }
      float l = dot(col.rgb, vec3(0.2126, 0.7152, 0.0722));
      float mx = max(col.r, max(col.g, col.b)), mn = min(col.r, min(col.g, col.b));
      float chroma = (mx - mn) / max(mx, 1e-4);
      col.rgb = max(mix(vec3(l), col.rgb, 1.1 + 0.18 * (1.0 - smoothstep(0.1, 0.7, chroma))), 0.0);
      col.rgb = 0.18 * pow(max(col.rgb, vec3(1e-6)) / 0.18, vec3(1.08));
      float lt = smoothstep(0.02, 0.6, l);
      col.rgb *= mix(vec3(0.965, 0.99, 1.05), vec3(1.035, 1.0, 0.965), lt);
      col.rgb *= 1.0 - (0.22 + 0.2 * uSpeed) * smoothstep(0.5, 1.2, r);
      col.rgb += uFlash;
      gl_FragColor = col;
    }`
};

/** 描画の後ろの仕上げ。HDR で描いて、光のにじみ → 色の仕上げ → 出力 → ふちのなめらかさ、の順にかける */
export class Post {
  readonly composer: EffectComposer;
  readonly #grade: ShaderPass;
  readonly #bloom: UnrealBloomPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    // Apple の GPU は MSAA 付きの半精度の描画先が重いので、MSAA はかけずに最後に SMAA でならす
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 0 });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));
    this.#bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.35, 0.5, 0.9);
    this.composer.addPass(this.#bloom);
    this.#grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.#grade);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(new SMAAPass());
  }

  resize(w: number, h: number, ratio: number): void {
    this.composer.setPixelRatio(ratio);
    this.composer.setSize(w, h);
    this.#grade.uniforms.uAspect.value = w / h;
  }

  render(speed: number, flash: number): void {
    this.#grade.uniforms.uSpeed.value = speed;
    this.#grade.uniforms.uFlash.value = flash;
    this.composer.render();
  }

  dispose(): void {
    this.composer.dispose();
  }
}
