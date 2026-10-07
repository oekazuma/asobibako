import type { CoopGuest, CoopHost } from './coop';
import type { Prompts } from './prompts.svelte';
import type { World } from './world';

/** 協力プレイの ✕ が何をするか。親は遊んでいるあいだはその回を終え、延長戦を聞く画面では進まないを選び、子はいつでも抜ける */
export function quitAction(s: {
  host: boolean;
  over: string | null;
  overtime: boolean;
  asking: boolean;
}): 'end' | 'decline' | 'leave' | 'none' {
  if (!s.host) return 'leave';
  if (s.asking) return 'decline';
  return s.over ? 'none' : 'end';
}

/** 親はその回を倒れたときと同じに終えて 2 人ともリザルトを出し（延長戦を聞く画面では進まないを選び）、子は自分のぶんを記録して抜ける */
export function quitCoop(
  world: World,
  host: CoopHost | null | undefined,
  guest: CoopGuest | null | undefined,
  prompts: Prompts | null | undefined
): void {
  const a = quitAction({ host: !!host, over: world.over, overtime: !!world.overtime, asking: !!prompts?.asking });
  if (a === 'decline') {
    prompts?.answered();
    host?.end();
    return;
  }
  if (a === 'end') {
    // 自分で終えたので、延長戦なら引き上げたことにする（1 人で遊ぶときと同じ）
    if (world.overtime) world.overtime.retreat = true;
    world.over = 'dead';
  }
  guest?.quit();
}
