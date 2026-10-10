import * as THREE from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Pattern } from '../textures';
import type { Built } from '../world3d';

/**
 * node には canvas が無いので、描く命令を捨てて空の画素を返す 2D の文脈を渡す。
 * 模様の中身ではなく、材質の種類・スポイトの印・Mesh と模様の数と、線の太さ（lineWidth に入れた値）を見る
 */
function fakeCanvas() {
  const canvas = { width: 0, height: 0, widths: [] as number[], getContext: () => context };
  const context: object = new Proxy(
    {},
    {
      get: (_, key) => {
        if (key === 'canvas') return canvas;
        if (key === 'getImageData')
          return (_x: number, _y: number, w: number, h: number) => ({
            width: w,
            height: h,
            data: new Uint8ClampedArray(w * h * 4)
          });
        if (String(key).startsWith('create')) return () => ({ addColorStop() {} });
        return () => {};
      },
      set: (_, key, value) => {
        if (key === 'lineWidth') canvas.widths.push(value);
        return true;
      }
    }
  );
  return canvas;
}

let built: Built;
beforeAll(async () => {
  vi.stubGlobal('document', { createElement: fakeCanvas });
  const { buildMansion } = await import('./build');
  built = buildMansion();
});

function meshes(root: THREE.Object3D = built.group): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) out.push(o);
  });
  return out;
}
const materials = () => meshes().flatMap((m) => (Array.isArray(m.material) ? m.material : [m.material]));

describe('組み立てた屋敷', () => {
  it('どの材質も透かし窓の効く MeshStandardMaterial で、透けず、スポイトの印を持つ', () => {
    for (const m of materials()) {
      expect(m).toBeInstanceOf(THREE.MeshStandardMaterial);
      // 透ける材質は mergeStatic がまとめず、描く回数が増える
      expect(m.transparent).toBe(false);
      expect(m.userData.pick, (m as THREE.MeshStandardMaterial).color.getHexString()).toBeDefined();
    }
  });

  it('まとめたあとの Mesh の数と模様の画素の量が上限を超えない', () => {
    // 1 枚の Mesh は画面と日の影で 2 回ほど描くので、描く回数の上限（1354 回）の 3 分の 1 を Mesh の上限にする
    expect(meshes().length).toBeLessThanOrEqual(450);
    const canvases = new Set(
      materials()
        .map((m) => (m as THREE.MeshStandardMaterial).map?.image as { width: number; height: number } | undefined)
        .filter((c) => !!c)
    );
    const bytes = [...canvases].reduce((n, c) => n + c!.width * c!.height * 4, 0);
    expect(bytes).toBeLessThanOrEqual(32e6);
  });
});

/** 模様の中でいちばん細い線（m）。線を引かない模様は Infinity */
const thinnest = (p: Pattern) =>
  Math.min(...(p.canvas as unknown as { widths: number[] }).widths) * (p.meters[0] / p.canvas.width);

describe('作り込んだ模様', () => {
  it('線は 2cm 以上（体に写せる太さ）', async () => {
    const rooms = await import('../textures-rooms');
    const { books } = await import('../textures');
    const study = await import('./study');
    for (const [name, p] of Object.entries({
      whiteTile: rooms.whiteTile(),
      darkPlanks: rooms.darkPlanks(),
      planks: rooms.planks(),
      framedPanel: rooms.framedPanel(),
      books: books(),
      tufted: study.tufted(),
      studyRug: study.studyRug()
    }))
      expect(thinnest(p), name).toBeGreaterThanOrEqual(0.0199);
  });

  it('六角タイルの目地は 2cm で、模様は周期の整数倍で継ぎ目なく繰り返す', async () => {
    const { blueHex, HEX } = await import('../textures-rooms');
    const p = blueHex();
    expect(HEX.grout).toBeGreaterThanOrEqual(0.02);
    expect(p.meters[0] / (Math.sqrt(3) * HEX.r)).toBeCloseTo(8, 6);
    expect(p.meters[1] / (3 * HEX.r)).toBeCloseTo(4, 6);
    expect(p.canvas.width / p.meters[0]).toBeCloseTo(p.canvas.height / p.meters[1], -1);
  });
});

describe('キッチンの肉の棚', () => {
  it('霜降りの肉の塊は下の 3 段に 2〜4 個ずつ、浮かず沈まずに棚板の上に載る', async () => {
    const { piece } = await import('./furniture');
    const rack = piece({ kind: 'meat-rack', at: [-20.75, 0, 10], turn: 1 });
    rack.updateMatrixWorld(true);
    // 棚の中で模様を持つのは霜降りの肉だけ
    const lumps = meshes(rack).filter((m) => !!(m.material as THREE.MeshStandardMaterial).map);
    const tops = [0.15, 0.7, 1.25].map((y) => y + 0.0125);
    const counts = tops.map(() => 0);
    for (const m of lumps) {
      const bottom = new THREE.Box3().setFromObject(m).min.y;
      const k = tops.findIndex((t) => Math.abs(bottom - t) < 0.01);
      expect(k, `${bottom}`).toBeGreaterThanOrEqual(0);
      counts[k]++;
    }
    for (const n of counts) expect(n >= 2 && n <= 4, `${counts}`).toBe(true);
  });
});

describe('ランドリーの洗濯ひも', () => {
  it('縄 1 本に形のある服を 5〜8 枚、洗濯ばさみ 2 つずつで留め、服の裾は人形の頭より上', async () => {
    const { piece } = await import('./furniture');
    const line = piece({ kind: 'clothesline', at: [-15, 2.3, -1.5], turn: 0, span: 9 });
    line.position.y = 2.3;
    line.updateMatrixWorld(true);
    const clothes = meshes(line).filter((m) => m.geometry instanceof THREE.ShapeGeometry);
    expect(clothes.length).toBeGreaterThanOrEqual(5);
    expect(clothes.length).toBeLessThanOrEqual(8);
    const pegs = meshes(line).filter(
      (m) => (m.material as THREE.MeshStandardMaterial).color.getHexString() === 'c9a54a'
    );
    expect(pegs).toHaveLength(clothes.length * 2);
    // 人形の背は 1.15m で、下を歩いても頭が服に重ならない
    for (const c of clothes) expect(new THREE.Box3().setFromObject(c).min.y).toBeGreaterThan(1.45);
  });
});

describe('家具の仕上げ', () => {
  const made = async (p: Parameters<typeof import('./furniture').piece>[0]) => {
    const { piece } = await import('./furniture');
    const g = piece(p);
    g.updateMatrixWorld(true);
    return g;
  };
  const box3 = (m: THREE.Object3D) => new THREE.Box3().setFromObject(m);

  it('排水溝の格子は模様の全体が見え、横に渡す棒も溝の中に入る', async () => {
    const g = await made({ kind: 'drain', at: [0, 0, 0], turn: 0, span: 4 });
    const map = (meshes(g)[0].material as THREE.MeshStandardMaterial).map!;
    expect(map.repeat.y).toBeGreaterThanOrEqual(1);
  });

  it('流しの槽の底は槽の下の面と重ならない', async () => {
    const g = await made({ kind: 'sink', at: [0, 0, 0], turn: 0 });
    const sizeY = (m: THREE.Mesh) => box3(m).getSize(new THREE.Vector3()).y;
    const tub = meshes(g).find((m) => Math.abs(sizeY(m) - 0.32) < 1e-6)!;
    const floor = meshes(g).find((m) => Math.abs(sizeY(m) - 0.02) < 1e-6 && box3(m).max.y < 0.7)!;
    expect(box3(floor).min.y - box3(tub).min.y).toBeGreaterThan(0.002);
  });

  it('ガスボンベの持ち手の輪は丸い頭にとどく', async () => {
    const g = await made({ kind: 'gas', at: [0, 0, 0], turn: 0 });
    const arcs = meshes(g).filter(
      (m) => m.geometry instanceof THREE.CylinderGeometry && m.geometry.parameters.radiusTop === 0.15
    );
    expect(arcs.length).toBe(3);
    // 頭は高さ 0.78 を中心に半径 0.175・高さ 0.55 倍の楕円で、輪の半径 0.15 のところでは 0.83 まで上がる
    for (const a of arcs) expect(box3(a).min.y).toBeLessThanOrEqual(0.835);
  });

  it('鍋の台の鍋・ふた・おたまは棚板の上にぴったり載る', async () => {
    const g = await made({ kind: 'pot-rack', at: [0, 0, 0], turn: 0 });
    const tops = [0.35, 0.8, 1.25, 1.7].map((y) => y + 0.006);
    // 柱と棚板は箱なので、円柱は鍋とふただけ
    const things = meshes(g).filter((m) => m.geometry instanceof THREE.CylinderGeometry);
    expect(things.length).toBe(3);
    for (const m of things) {
      const bottom = box3(m).min.y;
      expect(Math.min(...tops.map((t) => Math.abs(t - bottom))), `${bottom}`).toBeLessThan(0.002);
    }
  });

  it('洗濯ばさみは服の上の辺（回した服の面）の上に付く', async () => {
    const g = await made({ kind: 'clothesline', at: [0, 0, 0], turn: 0, span: 9 });
    const all = meshes(g);
    const peg = (m: THREE.Mesh) => (m.material as THREE.MeshStandardMaterial).color.getHexString() === 'c9a54a';
    let checked = 0;
    for (const [i, cloth] of all.entries()) {
      if (!(cloth.geometry instanceof THREE.ShapeGeometry)) continue;
      for (const pg of [all[i + 1], all[i + 2]]) {
        expect(peg(pg)).toBe(true);
        const local = cloth.worldToLocal(box3(pg).getCenter(new THREE.Vector3()));
        expect(Math.abs(local.z)).toBeLessThan(0.001);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(10);
  });

  it('ランドリーの消火器の札は部屋の側（東）を向く', async () => {
    const { roomPieces } = await import('./rooms');
    const p = roomPieces().find((q) => q.kind === 'extinguisher')!;
    const g = await made(p);
    g.rotation.y = (p.turn * Math.PI) / 2;
    g.updateMatrixWorld(true);
    const label = meshes(g).find((m) => m.geometry instanceof THREE.PlaneGeometry)!;
    const n = new THREE.Vector3(0, 0, 1).transformDirection(label.matrixWorld);
    expect(n.x).toBeGreaterThan(0.99);
  });
});
