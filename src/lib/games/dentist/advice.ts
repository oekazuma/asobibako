import { germPos, HEAD, needFor, TRASH, type GameState, type ToolId } from './engine';

export interface Advice {
  tool: ToolId;
  x: number;
  y: number;
  text: string;
}

const TEXT: Record<ToolId, string> = {
  brush: 'ブラシで よごれを みがこう',
  drill: 'ドリルで むしばを けずろう',
  tweezers: 'ピンセットで バイキンを つまもう',
  filling: 'あなを つめもので ふさごう',
  pliers: 'ペンチで ぐらぐらの はを ぬこう',
  shot: 'ちゅうしゃで いたくなくしよう',
  pat: 'よしよし してあげよう'
};

const WRONG: Partial<Record<ToolId, string>> = {
  brush: 'よごれには ブラシだよ',
  drill: 'むしばには ドリルだよ',
  tweezers: 'バイキンは ピンセットで つまもう',
  filling: 'あなには つめものだよ',
  pliers: 'ぐらぐらの はは ペンチだよ'
};

export const ORDER_TEXT = 'さきに バイキンを すてよう';
const CARRY_TEXT = 'ゴミばこへ はこぼう';

export const wrongText = (need: ToolId) => WRONG[need] ?? TEXT[need];

/**
 * いまやることを 1 つ選ぶ。子どもへの手助けとテストのボットがこれに従う。
 * 歯を引っぱっている途中に注射やなだめへ切り替えると、抜きかけの手を離させてしまうので、つかんでいるあいだは続けさせる
 */
export function advice(state: GameState): Advice | null {
  if (state.result) return null;
  if (state.grip?.kind === 'germ') return { tool: 'tweezers', x: TRASH.x, y: TRASH.y, text: CARRY_TEXT };
  if (state.grip?.kind === 'tooth') {
    const t = state.teeth[state.symptoms[state.grip.symptom].tooth];
    return { tool: 'pliers', x: t.x, y: t.y, text: TEXT.pliers };
  }
  if (state.calming && state.grip === null) return { tool: 'pat', x: HEAD.x, y: HEAD.y, text: TEXT.pat };
  const germ = state.germs.find((g) => !g.gone);
  if (germ) {
    const [x, y] = germPos(germ, state.time);
    return { tool: 'tweezers', x, y, text: TEXT.tweezers };
  }
  for (const s of state.symptoms) {
    const need = needFor(s);
    if (!need) continue;
    const t = state.teeth[s.tooth];
    const painful = need === 'drill' || need === 'pliers';
    if (painful && state.stage.tools.includes('shot') && state.shots > 0 && !t.numb)
      return { tool: 'shot', x: t.x, y: t.y, text: TEXT.shot };
    return { tool: need, x: t.x, y: t.y, text: TEXT[need] };
  }
  return null;
}

/** もう使い道のない道具。トレイで薄く見せる */
export function spent(state: GameState): ToolId[] {
  const needs = state.symptoms.map(needFor);
  const cavityLeft = state.symptoms.some((s) => s.type === 'cavity' && s.stage !== 'done');
  const idle: Record<ToolId, boolean> = {
    brush: !needs.includes('brush'),
    drill: !needs.includes('drill'),
    tweezers: !needs.includes('drill') && !needs.includes('tweezers'),
    filling: !cavityLeft,
    pliers: !needs.includes('pliers'),
    shot: state.shots <= 0 || (!needs.includes('drill') && !needs.includes('pliers')),
    pat: false
  };
  return state.stage.tools.filter((t) => idle[t]);
}
