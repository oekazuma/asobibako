// 一覧画面の覚えごと。プライベートブラウズなど localStorage が使えない環境では覚えずに動く

const RECENT = 'table-duel:recent';
const TAB = 'table-duel:menu-tab';
const MAX = 3;

/** 最近開いたゲームの id。新しい順に 3 本まで。壊れていたり読めなければ空 */
export function recentGames(): string[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(RECENT) ?? '[]');
    return Array.isArray(list) ? list.filter((id) => typeof id === 'string').slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function rememberGame(id: string): void {
  try {
    const list = [id, ...recentGames().filter((other) => other !== id)].slice(0, MAX);
    localStorage.setItem(RECENT, JSON.stringify(list));
  } catch {
    // 保存できなくても遊ぶのには困らない
  }
}

/** 一覧で最後に選んだ側。1 がひとりで、2 がふたりで */
export function menuTab(): 1 | 2 {
  try {
    return localStorage.getItem(TAB) === '2' ? 2 : 1;
  } catch {
    return 1;
  }
}

export function setMenuTab(tab: 1 | 2): void {
  try {
    localStorage.setItem(TAB, String(tab));
  } catch {
    // 保存できなくても遊ぶのには困らない
  }
}
