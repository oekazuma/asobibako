// @vitest-environment happy-dom
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Effects, SPLATS } from './effects';

describe('Effects', () => {
  it('しぶきは 1 試合で 60 枚まで残し、超えたら古いものから消す。試合の始めに消す', () => {
    const scene = new THREE.Scene();
    const fx = new Effects(scene);
    for (let i = 0; i < SPLATS + 5; i++) fx.splat([i, 1, 0], [0, 0, 1]);
    expect(fx.splats).toBe(SPLATS);
    expect(scene.children).toHaveLength(SPLATS);
    fx.clear();
    expect(scene.children).toHaveLength(0);
  });

  it('弾の筋は 0.3 秒、破片は 1.5 秒、♪ は 2 秒で消える', () => {
    const scene = new THREE.Scene();
    const fx = new Effects(scene);
    fx.trail([0, 1, 0], [[0, 1, 5]]);
    fx.shatter([0, 1, 0], Array(20).fill([1, 1, 1]));
    fx.note([0, 0, 0]);
    expect(scene.children).toHaveLength(1 + 20 + 1);
    fx.step(0.31);
    expect(scene.children).toHaveLength(21);
    fx.step(1.2);
    expect(scene.children).toHaveLength(1);
    fx.step(0.5);
    expect(scene.children).toHaveLength(0);
  });
});
