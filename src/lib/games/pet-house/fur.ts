import * as THREE from 'three';

/**
 * 毛の質感。体の面を少しずつ外へふくらませた殻（シェル）を重ね、殻ごとに毛の生えていない所を捨てる。
 * 毛の位置は形の元の座標（position）から決めるので、足を曲げても毛が体に付いて動き、UV もいらない。
 * 頂点には色・毛の長さ（furLen、0 なら毛なし）・毛の流れ（furComb）を持たせる
 */

const cache = new Map<string, THREE.MeshStandardMaterial>();

const common = /* glsl */ `
varying vec3 vRest;
varying float vFur;
varying vec3 vComb;
uniform float uShell;
uniform float uCell;
uniform float uWet;
uniform float uDirt;
`;

const vertex = /* glsl */ `
#include <begin_vertex>
vRest = position;
vFur = furLen;
vComb = furComb;
vec3 fc = furComb - normal * dot(normal, furComb);
// ぬれた毛は短く縮んで、流れの向きへ寝る
float wk = 1.0 - 0.55 * uWet;
transformed += (normal * uShell * wk + fc * (uShell * uShell) * (0.5 + 1.2 * uWet)) * furLen * wk;
`;

// 毛 1 本を格子の 1 マスに 1 本置く。マスごとに長さ・太さ・明るさを散らし、粗いかたまりで房を作る
const fragment = /* glsl */ `
#include <color_fragment>
float furDark = 0.0;
{
  vec3 q = vRest * uCell;
  vec3 id = floor(q);
  vec3 f = fract(q) - 0.5;
  float r1 = furHash(id);
  float r2 = furHash(id + 17.31);
  vec3 off = vec3(furHash(id + 3.1), furHash(id + 5.7), furHash(id + 9.2)) - 0.5;
  float tuft = furHash(floor(q * 0.25) + 41.7);
  float len = 0.5 + 0.32 * r1 + 0.18 * tuft;
  float fur = clamp(vFur * 250.0, 0.0, 1.0);
#ifdef FUR_SHELL
  float d = length(f - off * 0.3);
  if (vFur < 0.0004 || uShell > len) discard;
  // 毛のふちと毛先を薄くして（alphaToCoverage で MSAA の画素ごとに間引く）、輪郭をとげとげさせずにぼかす
  float rad = 0.45 * (1.0 - 0.55 * uShell / len);
  float cover = smoothstep(rad, rad * 0.5, d) * smoothstep(len, len * 0.55, uShell);
  if (cover < 0.04) discard;
  diffuseColor.a = cover;
#endif
  // 短い毛は根元の影も浅い。深い影を付けると短い毛が針のように浮いて見える
  float deep = clamp(vFur * 35.0, 0.0, 1.0);
  // 毛先は光を通して少し明るい
  float shade = mix(1.0, mix(mix(0.9, 0.74, deep), 1.04, uShell) * (0.92 + 0.16 * r2), fur);
#ifndef FUR_SHELL
  // 殻を重ねない顔は、毛の流れの向きに引きのばしたむらで短い毛並みに見せる
  vec3 cd = normalize(vComb + vec3(1e-5));
  vec3 sp = vRest * uCell * 0.45;
  sp -= cd * dot(sp, cd) * 0.8;
  float streak = 0.6 * furNoise(sp) + 0.4 * furNoise(sp * 2.3 + 7.1);
  shade *= mix(0.9 + 0.16 * streak, 1.0, fur);
#endif
  // 汚れは毛全体のくすみと泥。足先は下から泥をかぶり、胸・顔・体には小さなはねが散る（vRest は肩の高さが 1 の座標）
  if (uDirt > 0.0) {
    diffuseColor.rgb *= mix(vec3(1.0), vec3(0.82, 0.76, 0.68), uDirt);
    float n1 = 0.6 * furNoise(vRest * 6.0) + 0.4 * furNoise(vRest * 17.0 + 3.7);
    float sock = smoothstep(0.04, -0.04, vRest.y - 0.1 - 0.22 * uDirt - (n1 - 0.5) * 0.3);
    float front = smoothstep(0.15, 0.6, vRest.z) * smoothstep(1.0, 0.5, vRest.y);
    float edge = 0.8 - 0.14 * uDirt - 0.08 * front;
    float speck = smoothstep(edge, edge + 0.05, 0.7 * furNoise(vRest * 24.0 + 11.0) + 0.3 * n1);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.15, 0.09, 0.045), max(sock * 0.8, speck * 0.7));
  }
  diffuseColor.rgb *= shade * (1.0 - 0.3 * uWet);
  furDark = smoothstep(0.05, 0.012, dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)));
}
`;

// 黒い毛は光をほとんど返さず、目のほかは輪郭も鼻も闇に沈む。ふちに空の明るさを足し、つやを少し出して形を見せる
const rim = /* glsl */ `
#include <emissivemap_fragment>
totalEmissiveRadiance += furDark * (0.012 + 0.3 * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.0)) * vec3(0.5, 0.52, 0.62);
`;

const hash = /* glsl */ `
float furHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float furNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(furHash(i), furHash(i + vec3(1, 0, 0)), f.x), mix(furHash(i + vec3(0, 1, 0)), furHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(furHash(i + vec3(0, 0, 1)), furHash(i + vec3(1, 0, 1)), f.x), mix(furHash(i + vec3(0, 1, 1)), furHash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z
  );
}
`;

/**
 * layer は 0（地肌、影を落とす）から layers（毛先）まで。cell は毛 1 本の間隔（m）。wet はぬれ具合 0..1 で、
 * 毛を寝かせて暗く、つやを出す。dirt は汚れ具合 0..1。同じ引数なら同じ material を返し、shader は殻どうしで共有する
 */
export function furMaterial(
  layer: number,
  layers: number,
  cell: number,
  wet = 0,
  dirt = 0
): THREE.MeshStandardMaterial {
  const key = `${layer}/${layers}/${cell}${wet ? `/${wet}` : ''}${dirt ? `/d${dirt}` : ''}`;
  let m = cache.get(key);
  if (m) return m;
  const shell = layer > 0;
  m = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92 - 0.5 * wet,
    metalness: 0,
    envMapIntensity: 1 + wet
  });
  if (shell) {
    m.defines = { FUR_SHELL: '' };
    m.alphaToCoverage = true;
    // 毛の薄さは画素の間引きにだけ使い、画面の α には書かない（書くとキャンバスの後ろのページが透けて点々になる）
    m.blending = THREE.CustomBlending;
    m.blendSrc = THREE.OneFactor;
    m.blendDst = THREE.ZeroFactor;
    m.blendSrcAlpha = THREE.ZeroFactor;
    m.blendDstAlpha = THREE.OneFactor;
  }
  const h = layer / layers;
  m.onBeforeCompile = (s) => {
    s.uniforms.uShell = { value: h };
    s.uniforms.uCell = { value: 1 / cell };
    s.uniforms.uWet = { value: wet };
    s.uniforms.uDirt = { value: dirt };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>\n${common}\nattribute float furLen;\nattribute vec3 furComb;`)
      .replace('#include <begin_vertex>', vertex);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\n${common}\n${hash}`)
      .replace('#include <color_fragment>', fragment)
      .replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.7, furDark);'
      )
      .replace('#include <emissivemap_fragment>', rim);
  };
  m.customProgramCacheKey = () => (shell ? 'fur-shell' : 'fur-base');
  // scenes の release() が捨てないように。全ペットで使い回している
  m.userData.shared = true;
  cache.set(key, m);
  return m;
}
