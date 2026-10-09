import type { Phase } from './referee';
import { SONGS } from './songs';
import type { Mode } from './touch';

export type Track = 'lobby' | 'hide' | 'search';

/** ペイントモードのあいだの BGM の大きさ。塗る音と口笛を聞きやすくして、曲は止めない */
export const QUIET = 0.4;

/** 答え合わせはロビーの曲（本家の答え合わせの曲は分からない） */
export function trackOf(phase: Phase): Track {
  if (phase === 'search') return 'search';
  if (phase === 'intro' || phase === 'hide') return 'hide';
  return 'lobby';
}

export function pick(phase: Phase, mode: Mode) {
  const t = SONGS[trackOf(phase)];
  return { song: t.song, bpm: t.bpm, gain: mode === 'paint' ? t.gain * QUIET : t.gain };
}
