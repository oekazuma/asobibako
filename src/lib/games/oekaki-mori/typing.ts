/** 人ごとの打っている字に、届いた知らせを入れる。空の字（送った・消した）ならその人の欄を消す */
export function typed(all: Record<number, string>, seat: number, text: string): Record<number, string> {
  const next = { ...all };
  if (text) next[seat] = text;
  else delete next[seat];
  return next;
}
