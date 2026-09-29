import { AdditiveBlending, BackSide, Color, ShaderMaterial, Vector3, type Texture } from 'three';

/**
 * アニメ塗り（セルルック）の材質。光の当たり方を 3 段の色に分け、影は暗くするのでなく色みを変えた「影色」で塗る。
 * ふちには客席側の照明の色のリムライトを差し、髪には光の筋を入れる。輪郭線は黒でなく、その部位の濃い色で細く引く
 */

/** 場面の光。ステージの照明に合わせて、描くたびに書きかえてよい */
export const LIGHT = {
  /** 主な光の来る向き（世界） */
  dir: { value: new Vector3(0.35, 0.8, 0.6).normalize() },
  color: { value: new Color('#ffffff') },
  rim: { value: new Color('#ffd2ec') }
};

const VERT = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
varying vec3 vN;
varying vec3 vW;
varying vec2 vUv;
varying vec3 vC;
void main() {
  vUv = uv;
  #ifdef USE_COLOR
    vC = color;
  #else
    vC = vec3(1.0);
  #endif
  #include <beginnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  vec4 wp = modelMatrix * vec4(transformed, 1.0);
  vW = wp.xyz;
  vN = normalize(mat3(modelMatrix) * objectNormal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uShade;
uniform sampler2D uMap;
uniform float uUseMap;
uniform vec3 uLight;
uniform vec3 uLightColor;
uniform vec3 uRim;
uniform float uRimK;
uniform float uGloss;
uniform float uSoft;
uniform float uOpacity;
varying vec3 vN;
varying vec3 vW;
varying vec2 vUv;
varying vec3 vC;
void main() {
  vec3 base = uColor * vC;
  if (uUseMap > 0.5) base *= texture2D(uMap, vUv).rgb;
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vW);
  vec3 L = normalize(uLight);
  float ndl = dot(N, L);
  // 明るい面・影・深い影の 3 段。境目だけ少しぼかしてギザギザを消す
  float lit = smoothstep(-0.04, 0.04, ndl - 0.1 + uSoft);
  float deep = smoothstep(-0.04, 0.04, ndl + 0.5 + uSoft);
  vec3 shade = mix(uShade * uShade, uShade, deep);
  vec3 col = base * mix(shade, vec3(1.0), lit) * uLightColor;
  float rim = 1.0 - max(dot(N, V), 0.0);
  col += uRim * smoothstep(0.55, 0.8, rim) * uRimK * (0.4 + 0.6 * lit);
  vec3 H = normalize(L + V);
  col += vec3(1.0, 0.96, 0.98) * smoothstep(0.9, 0.93, dot(N, H)) * uGloss;
  gl_FragColor = vec4(col, uOpacity);
  #include <colorspace_fragment>
}`;

export interface ToonOptions {
  color?: string;
  /** 影色（base に掛ける）。肌は赤み、服は色みの濃い影にする */
  shade?: string;
  map?: Texture;
  vertexColors?: boolean;
  rim?: number;
  /** 髪の光の筋の強さ */
  gloss?: number;
  /** 影を浅くする（顔は影をほとんど落とさない） */
  soft?: number;
  opacity?: number;
}

export function toon(o: ToonOptions = {}): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    vertexColors: o.vertexColors ?? false,
    transparent: (o.opacity ?? 1) < 1,
    uniforms: {
      uColor: { value: new Color(o.color ?? '#ffffff') },
      uShade: { value: new Color(o.shade ?? '#c9a8c8') },
      uMap: { value: o.map ?? null },
      uUseMap: { value: o.map ? 1 : 0 },
      uLight: LIGHT.dir,
      uLightColor: LIGHT.color,
      uRim: LIGHT.rim,
      uRimK: { value: o.rim ?? 0.45 },
      uGloss: { value: o.gloss ?? 0 },
      uSoft: { value: o.soft ?? 0 },
      uOpacity: { value: o.opacity ?? 1 }
    }
  });
}

const LINE_VERT = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
uniform float uWidth;
void main() {
  #include <beginnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
  vec3 n = normalize(normalMatrix * objectNormal);
  // 遠くても近くても同じくらいの太さに見えるよう、奥行きに比例して押し出す
  mv.xyz += n * uWidth * -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const LINE_FRAG = /* glsl */ `
uniform vec3 uColor;
void main() {
  gl_FragColor = vec4(uColor, 1.0);
  #include <colorspace_fragment>
}`;

/** 裏返した殻で引く輪郭線。width は画面の高さに対するおおよその太さ */
export function outline(color: string, width = 0.0022): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: LINE_VERT,
    fragmentShader: LINE_FRAG,
    side: BackSide,
    uniforms: { uColor: { value: new Color(color) }, uWidth: { value: width } }
  });
}

const GLINT_FRAG = /* glsl */ `
uniform vec3 uLight;
varying vec3 vN;
varying vec3 vW;
varying vec2 vUv;
varying vec3 vC;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  // 主な光と、客席側（カメラのそば）の光の 2 つが、ひとみの丸いおおいに映りこむ
  float a = pow(max(dot(N, normalize(normalize(uLight) + V)), 0.0), 180.0);
  float b = pow(max(dot(N, V), 0.0), 24.0) * 0.12;
  gl_FragColor = vec4(vec3(1.0) * (smoothstep(0.35, 0.6, a) * 0.9 + b), 1.0);
  #include <colorspace_fragment>
}`;

/** ひとみの上にかぶせる透明な丸いおおい。光の向きとカメラで動く映りこみだけを足す */
export function glint(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: GLINT_FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uLight: LIGHT.dir }
  });
}
