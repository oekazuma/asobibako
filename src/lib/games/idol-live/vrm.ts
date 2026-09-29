import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * アイドルの 3D モデル（VRM）。千駄ヶ谷 篠（pixiv の VRoid Studio のサンプルモデル、CC0）を使う。
 * 読みこみは 1 度だけで、じゅんびの画面とライブで同じものを使い回す（読むのに 1 秒ほどかかる）
 */

export const MODEL_URL = 'idol-live/shino.vrm';

let loading: Promise<VRM> | null = null;

/** base は $app/paths の base（GitHub Pages のサブパス） */
export function loadVRM(base: string): Promise<VRM> {
  loading ??= (async () => {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    const gltf = await loader.loadAsync(`${base}/${MODEL_URL}`);
    const vrm = gltf.userData.vrm as VRM;
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);
    // VRM 0.x は -z を向いているので、+z（客席）へ向ける
    VRMUtils.rotateVRM0(vrm);
    vrm.scene.traverse((o) => (o.frustumCulled = false));
    return vrm;
  })();
  // 失敗したら、次に呼んだときにもう一度読みにいく
  loading.catch(() => (loading = null));
  return loading;
}
