export interface Step {
  region: number;
  /** 塗る前の色。塗っていなかったら null */
  before: string | null;
}

/** 場所の番号は同じ線画から同じ順で振るので、保存するのはこの表だけでよい */
export interface Coloring {
  colors: Record<number, string>;
  history: Step[];
}

/** 戻せる手順の数。塗るたびにまるごと保存するので、ぬりえちょうの作品が際限なく大きくならないようにする */
export const MAX_STEPS = 200;

export const empty = (): Coloring => ({ colors: {}, history: [] });

export function fill(c: Coloring, region: number, color: string): Coloring {
  if (region < 0 || c.colors[region] === color) return c;
  return {
    colors: { ...c.colors, [region]: color },
    history: [...c.history, { region, before: c.colors[region] ?? null }].slice(-MAX_STEPS)
  };
}

export function undo(c: Coloring): Coloring {
  const last = c.history.at(-1);
  if (!last) return c;
  const colors = { ...c.colors };
  if (last.before === null) delete colors[last.region];
  else colors[last.region] = last.before;
  return { colors, history: c.history.slice(0, -1) };
}
