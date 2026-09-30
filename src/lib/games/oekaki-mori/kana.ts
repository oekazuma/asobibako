/** 50 音表の列。あ行から順に、各列の上から 5 マス。空きは '' */
export const COLUMNS: string[][] = [
  'あいうえお',
  'かきくけこ',
  'さしすせそ',
  'たちつてと',
  'なにぬねの',
  'はひふへほ',
  'まみむめも',
  'や_ゆ_よ',
  'らりるれろ',
  'わ_を_ん'
].map((column) => [...column].map((ch) => (ch === '_' ? '' : ch)));

/** 濁点が付く字。Unicode では濁点付きがすぐ次、は行の半濁点はその次に並ぶ */
const VOICED = 'かきくけこさしすせそたちつてとはひふへほ';
const SEMI = 'はひふへほ';
/** 小さい字が付く字。Unicode では小さい字がすぐ前に並ぶ */
const SMALLABLE = 'あいうえおつやゆよわ';
const SMALLS = 'ぁぃぅぇぉっゃゅょゎ';

const shift = (ch: string, by: number) => String.fromCharCode(ch.charCodeAt(0) + by);

export function plain(text: string): string {
  return [...text.normalize('NFD').replace(/[゙゚]/g, '')]
    .map((ch) => (SMALLS.includes(ch) ? shift(ch, 1) : ch))
    .join('');
}

function variants(base: string): string[] {
  const list = [base];
  if (VOICED.includes(base)) list.push(shift(base, 1));
  if (SEMI.includes(base)) list.push(shift(base, 2));
  if (SMALLABLE.includes(base)) list.push(shift(base, -1));
  return list;
}

export function cycle(ch: string): string {
  const list = variants(plain(ch));
  const i = list.indexOf(ch);
  return i < 0 ? ch : list[(i + 1) % list.length];
}

export type Verdict = 'right' | 'close' | 'wrong';

export function judge(word: string, text: string): Verdict {
  if (!text) return 'wrong';
  if (text === word) return 'right';
  return plain(text) === plain(word) ? 'close' : 'wrong';
}
