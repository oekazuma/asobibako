import type { Stage, SymptomDef, ToolId } from './engine';

const ALL: ToolId[] = ['brush', 'drill', 'tweezers', 'filling', 'pliers', 'shot', 'pat'];
const CARE: ToolId[] = ['drill', 'tweezers', 'filling'];
const plaque = (tooth: number, amount = 0.5): SymptomDef => ({ type: 'plaque', tooth, amount });
const cavity = (tooth: number, depth = 0.8, germs = 1, kind: 'normal' | 'quick' | 'boss' = 'normal'): SymptomDef => ({
  type: 'cavity',
  tooth,
  depth,
  germs,
  kind
});
const loose = (tooth: number): SymptomDef => ({ type: 'loose', tooth });
/** 痛みを覚える前の面。ふつうに治すだけでは泣かない */
const MILD = { pain0: 0, painRate: 0.05, shots: 0 };
const SORE = 0.7;

/** 1 つが 1 レベル。面ごとに患者さん・症状の組み合わせ・考えどころのどれかを前の面から変える */
export const LEVELS: Stage[] = [
  // 1. ブラシだけで汚れを 2 つ
  { animal: 'rabbit', tools: ['brush'], symptoms: [plaque(1), plaque(4)], ...MILD },
  // 2. 上下の汚れ 4 つ
  { animal: 'cat', tools: ['brush'], symptoms: [plaque(0), plaque(3), plaque(5), plaque(6, 0.6)], ...MILD },
  // 3. 虫歯を削ってバイキンを捨て、詰める
  { animal: 'dog', tools: CARE, symptoms: [cavity(1)], ...MILD },
  // 4. バイキン 2 匹と汚れ
  { animal: 'bear', tools: ['brush', ...CARE], symptoms: [cavity(7, 0.8, 2), plaque(3, 0.6)], ...MILD },
  // 5. ぐらぐらの歯をペンチで抜く
  { animal: 'pig', tools: ['pliers'], symptoms: [loose(6)], ...MILD },
  // 6. ぐらぐらと虫歯
  { animal: 'rabbit', tools: [...CARE, 'pliers'], symptoms: [loose(0), cavity(4)], ...MILD },
  // 7. 深い虫歯。注射しないと泣く
  { animal: 'cat', tools: ['shot', ...CARE], symptoms: [cavity(2, 1.6, 2)], pain0: 0, painRate: SORE, shots: Infinity },
  // 8. 怖がりの患者さん。よしよしで落ち着かせながら削る
  { animal: 'dog', tools: ['pat', ...CARE], symptoms: [cavity(6)], pain0: 0.5, painRate: SORE, shots: 0 },
  // 9. となり合う虫歯。健康な歯を削らないよう狙う
  {
    animal: 'bear',
    tools: ['shot', 'brush', ...CARE],
    symptoms: [cavity(1, 1), cavity(2, 1), plaque(8)],
    pain0: 0,
    painRate: SORE,
    shots: Infinity
  },
  // 10. カバの厚い歯石と、ぐらぐら 2 本
  {
    animal: 'hippo',
    tools: ['brush', 'pliers', 'shot'],
    symptoms: [plaque(1, 1.5), plaque(4, 1.5), plaque(7, 1.5), plaque(10, 1.5), plaque(6, 0.6), loose(3), loose(9)],
    pain0: 0.4,
    painRate: SORE,
    shots: Infinity
  },
  // 11. すばしっこいバイキン
  {
    animal: 'lion',
    tools: ['shot', ...CARE],
    symptoms: [cavity(2, 1, 2, 'quick'), cavity(7, 1)],
    pain0: 0,
    painRate: SORE,
    shots: Infinity
  },
  // 12. 怖がりと、ぐらぐら 2 本
  { animal: 'pig', tools: ['pat', 'pliers'], symptoms: [loose(1), loose(8)], pain0: 0.5, painRate: SORE, shots: 0 },
  // 13. カエルの奥歯
  {
    animal: 'frog',
    tools: ['shot', ...CARE],
    symptoms: [cavity(0, 1.2, 2), cavity(11, 1.2)],
    pain0: 0,
    painRate: SORE,
    shots: Infinity
  },
  // 14. 注射は 1 回だけ。となり合う 2 本にまとめて効かせる
  {
    animal: 'cat',
    tools: ['shot', 'pat', ...CARE],
    symptoms: [cavity(1, 1), cavity(2, 1), cavity(6, 1)],
    pain0: 0,
    painRate: SORE,
    shots: 1
  },
  // 15. 深い虫歯とすばしっこいバイキン、汚れ、ぐらぐら。少し怖がり
  {
    animal: 'lion',
    tools: ALL,
    symptoms: [cavity(1, 1.6, 2, 'quick'), plaque(6, 0.8), loose(9)],
    pain0: 0.4,
    painRate: SORE,
    shots: 2
  },
  // 16. カバの虫歯 3 本（2 本はとなり合う）と厚い歯石
  {
    animal: 'hippo',
    tools: ['shot', 'brush', ...CARE],
    symptoms: [cavity(2, 1.2), cavity(3, 1.2, 2), cavity(9, 1.2, 1, 'quick'), plaque(0, 1.5)],
    pain0: 0,
    painRate: SORE,
    shots: 2
  },
  // 17. とても怖がり。注射 1 回、ぐらぐら 2 本と虫歯
  {
    animal: 'bear',
    tools: ['pat', 'shot', ...CARE, 'pliers'],
    symptoms: [loose(0), loose(4), cavity(7, 1, 2)],
    pain0: 0.6,
    painRate: SORE,
    shots: 1
  },
  // 18. 厚い歯石 3 つ、バイキン 3 匹、ぐらぐら
  {
    animal: 'dog',
    tools: ALL,
    symptoms: [plaque(0, 1.5), plaque(3, 1.5), plaque(6, 1.5), cavity(5, 1.2, 3, 'quick'), loose(2)],
    pain0: 0.3,
    painRate: SORE,
    shots: 2
  },
  // 19. カバの全部入り
  {
    animal: 'hippo',
    tools: ALL,
    symptoms: [cavity(1, 1), cavity(7, 1, 2, 'quick'), cavity(10, 1.6), loose(4), plaque(5, 1.5)],
    pain0: 0.4,
    painRate: SORE,
    shots: 2
  },
  // 20. カエルの全部入り。最後にバイキンのおやぶん
  {
    animal: 'frog',
    tools: ALL,
    symptoms: [plaque(2, 1.5), plaque(9, 1.5), cavity(4, 1, 2, 'quick'), loose(11), cavity(7, 1.6, 1, 'boss')],
    pain0: 0.3,
    painRate: SORE,
    shots: 2
  }
];

export const levelFor = (n: number): Stage => LEVELS[Math.min(LEVELS.length, Math.max(1, n)) - 1];

/** その面で初めて出てくる道具。使い方を半透明の手で一度だけ見せる */
export function introduces(n: number): ToolId[] {
  const seen = new Set(LEVELS.slice(0, Math.max(0, n - 1)).flatMap((s) => s.tools));
  return levelFor(n).tools.filter((t) => !seen.has(t));
}
