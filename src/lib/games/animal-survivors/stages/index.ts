import { FOREST, type Stage } from './forest';
import { GRAVEYARD } from './graveyard';
import { SNOW } from './snow';
import { VOLCANO } from './volcano';

export const STAGES: Stage[] = [FOREST, GRAVEYARD, SNOW, VOLCANO];

/** 知らない id（壊れた保存など）は森 */
export const stageOf = (id: string): Stage => STAGES.find((s) => s.id === id) ?? FOREST;
