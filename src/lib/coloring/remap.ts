import type { Regions } from './regions';

/**
 * 線を直して場所の番号が変わったあと、塗った色を引き継ぐ。新しい場所ごとに、重なっていた前の場所の色を
 * 画素の数で数え、いちばん多かった色にする（線を足して分かれた場所は両方に、消してつながった場所は多いほうに）
 */
export function remap(
  before: Regions,
  colors: Record<number, string>,
  after: Regions,
  pixels: number
): Record<number, string> {
  const votes = new Map<number, Map<string, number>>();
  for (let i = 0; i < pixels; i++) {
    const color = colors[before.labels[i]];
    const region = after.labels[i];
    if (color === undefined || region < 0) continue;
    const tally = votes.get(region) ?? new Map<string, number>();
    tally.set(color, (tally.get(color) ?? 0) + 1);
    votes.set(region, tally);
  }
  const out: Record<number, string> = {};
  for (const [region, tally] of votes) out[region] = [...tally].sort((a, b) => b[1] - a[1])[0][0];
  return out;
}
