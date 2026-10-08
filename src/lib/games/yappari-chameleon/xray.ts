import * as THREE from 'three';

export const XRAY = {
  center: { value: new THREE.Vector2() },
  radius: { value: 0 },
  depth: { value: 0 },
  on: { value: 0 }
};

const HEAD = /* glsl */ `
uniform vec2 uXrayCenter;
uniform float uXrayRadius;
uniform float uXrayDepth;
uniform float uXrayOn;
float xrayBayer(vec2 p) {
  ivec2 i = ivec2(mod(p, 4.0));
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[i.x + i.y * 4]) + 0.5) / 16.0;
}`;

// vViewPosition はカメラから見た位置の符号を反転したもので、z がそのまま奥行き（m）になる
const CUT = /* glsl */ `
if (uXrayOn > 0.5) {
  float xd = distance(gl_FragCoord.xy, uXrayCenter);
  if (xd < uXrayRadius && vViewPosition.z < uXrayDepth) {
    float edge = smoothstep(uXrayRadius * 0.75, uXrayRadius, xd);
    if (xrayBayer(gl_FragCoord.xy) > edge) discard;
  }
}`;

/** 屋敷の材質に、自分のまわりを透かす処理を足す。同じ材質に 2 度は足さない */
export function seeThrough(m: THREE.Material): void {
  if (!(m instanceof THREE.MeshStandardMaterial) || m.userData.xray) return;
  m.userData.xray = true;
  m.onBeforeCompile = (s) => {
    s.uniforms.uXrayCenter = XRAY.center;
    s.uniforms.uXrayRadius = XRAY.radius;
    s.uniforms.uXrayDepth = XRAY.depth;
    s.uniforms.uXrayOn = XRAY.on;
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\n${HEAD}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${CUT}`);
  };
  m.customProgramCacheKey = () => 'chameleon-xray';
}
