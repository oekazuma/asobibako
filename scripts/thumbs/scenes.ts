import type { Clip, Stage } from './stage.ts';

export interface Scene {
  id: string;
  /** 撮る範囲（CSS px）。幅 : 高さ = 680 : 256 */
  clip: Clip;
  play: (s: Stage) => Promise<void>;
}

/** 幅いっぱいで、上端 y から 680 : 256 の高さを切り出す */
const band = (y: number): Clip => ({ x: 0, y, width: 768, height: Math.round((768 * 256) / 680) });

/**
 * 座標は iPad 縦（768 × 1024）で撮った画面から読んだ CSS px。
 * 道具の先端は指より少し上（はいしゃさんの TIP）に出るので、指は狙う場所の 41px 下に置く
 */
export const SCENES: Scene[] = [
  {
    // 顔の全体と吹き出しまでは 680 : 256 に収まらないので、下の歯・運んでいるバイキン・ゴミ箱を優先する
    id: 'dentist',
    clip: band(588),
    play: async (s) => {
      await s.startSolo('dentist', 4);
      // 下の列の真ん中の虫歯を削りきると、バイキンが 2 匹出てくる
      await s.press('button[aria-label="ドリル"]');
      await s.touch(1, 'down', 384, 663);
      await s.wait(1200);
      await s.touch(1, 'up', 384, 663);
      await s.wait(800);
      await s.press('button[aria-label="ピンセット"]');
      await s.drag(1, [372, 663], [540, 790], 600);
      await s.wait(100);
    }
  }
];
