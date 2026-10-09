import * as THREE from 'three';
import { finish, rainbowMottle } from './textures';

function part(geo: THREE.BufferGeometry, mat: THREE.Material, at: [number, number, number], rotX = 0): THREE.Mesh {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(...at);
  o.rotation.x = rotX;
  o.castShadow = true;
  return o;
}

/** 本家のハンターのショットガン型のペイント銃。木の銃床と先台、虹色のまだらの機関部と銃身。銃口は -z（前）を向く */
export function gunModel(): THREE.Group {
  const wood = finish({ tint: '#8a5a2e', rough: 0.55 }, [0.1, 0.3]);
  const paint = finish({ pattern: rainbowMottle(), rough: 0.45 }, [0.12, 0.4]);
  const dark = finish({ tint: '#2b2420', metal: 0.6, rough: 0.4 }, [0.05, 0.1]);
  const g = new THREE.Group();
  g.add(
    part(new THREE.BoxGeometry(0.05, 0.08, 0.26), wood, [0, -0.025, 0.21], 0.12),
    part(new THREE.BoxGeometry(0.06, 0.075, 0.2), paint, [0, 0, 0]),
    part(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 14), paint, [0, 0.016, -0.3], Math.PI / 2),
    part(new THREE.CylinderGeometry(0.03, 0.03, 0.13, 14), wood, [0, -0.024, -0.2], Math.PI / 2),
    part(new THREE.BoxGeometry(0.035, 0.085, 0.045), dark, [0, -0.07, 0.075], -0.35)
  );
  return g;
}

/** 銃口の位置（gunModel の座標） */
export const MUZZLE: [number, number, number] = [0, 0.016, -0.51];

/** 隠れる側がペイントモードのあいだ右手に持つ絵筆。虹色のまだらの柄に金の口金と黒い穂先 */
export function brushModel(): THREE.Group {
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.014, 0.36, 12),
    finish({ pattern: rainbowMottle(), rough: 0.5 }, [0.08, 0.36])
  );
  const ferrule = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.014, 0.05, 12),
    finish({ tint: '#c9a227', metal: 1, rough: 0.35 }, [0.1, 0.05])
  );
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.018, 0.07, 12),
    finish({ tint: '#2b2420', rough: 0.9 }, [0.1, 0.07])
  );
  ferrule.position.y = 0.2;
  tip.position.y = 0.26;
  const g = new THREE.Group();
  g.add(handle, ferrule, tip);
  return g;
}

/**
 * 体の右手（前腕の骨の子）に絵筆か銃を持たせる。手の楕円体（doll.ts の [-0.538, 0.616, 0]）を、
 * 前腕の骨の付け根 [-0.354, 0.745, 0] からの差で指す
 */
export function inHand(forearm: THREE.Bone, o: THREE.Object3D, kind: 'brush' | 'gun'): void {
  o.position.set(-0.184, -0.129, 0.03);
  if (kind === 'brush') {
    // 穂先を下にして腰のわきへ垂らす（横へ寝かせると床に付く）
    o.rotation.set(Math.PI - 0.5, 0, 0.2);
  } else {
    // 構えたポーズでは前腕が前を向くので、銃口をひじから手首の向きへ合わせる
    const along = new THREE.Vector3(-0.184, -0.129, 0).normalize();
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), along);
  }
  o.visible = false;
  forearm.add(o);
}

export function disposeModel(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.geometry.dispose();
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      (m as THREE.MeshStandardMaterial).map?.dispose();
      m.dispose();
    }
  });
}
