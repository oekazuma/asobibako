import * as THREE from 'three';
import { finish } from '../textures';
import { hunterSign } from '../textures-rooms';
import type { Kind } from './layout';
import { box, cyl, type Maker } from './shapes';

/** 縁は乗っている人がいるあいだ光る輪で、build が userData.glow で拾う */
function podium(g: THREE.Group) {
  cyl(g, [1.2, 1.2], 0.3, { tint: '#c8231e', rough: 0.55 }, [0, 0.15, 0], 64);
  const top = new THREE.Mesh(
    new THREE.CircleGeometry(1.19, 64),
    finish({ pattern: hunterSign(), rough: 0.6 }, [2.4, 2.4])
  );
  // 南（始める場所の側）から北を向いて読める向きにする。円の上は −z へ向くので z まわりにも回す
  top.rotation.set(-Math.PI / 2, 0, Math.PI);
  top.position.y = 0.302;
  top.receiveShadow = true;
  g.add(top);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(1.2, 0.05, 10, 96),
    // 消えているときは台と同じ赤にして、点いたときの黄色い光との差で乗っているのが分かるようにする
    new THREE.MeshStandardMaterial({ color: '#c8231e', roughness: 0.55, emissive: '#ffd36b', emissiveIntensity: 0 })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.3;
  rim.userData.glow = true;
  g.add(rim);
}

/** 本家のロビーの端の水色の台 */
function pedestal(g: THREE.Group) {
  box(g, [0.9, 0.9, 0.9], { tint: '#7fd1e8', rough: 0.4 }, [0, 0.45, 0]);
  cyl(g, [0.22, 0.24], 0.1, { tint: '#2f9ec7', rough: 0.3 }, [0, 0.95, 0]);
}

export const ROOM_MAKERS = { podium, pedestal } satisfies Partial<Record<Kind, Maker>>;
