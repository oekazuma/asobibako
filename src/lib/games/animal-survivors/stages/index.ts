import { FOREST, type Stage } from './forest';
import { GRAVEYARD } from './graveyard';

export const STAGES: Stage[] = [FOREST, GRAVEYARD];

/** 知らない id（壊れた保存など）は森 */
export const stageOf = (id: string): Stage => STAGES.find((s) => s.id === id) ?? FOREST;
