import { ANIMALS, type AnimalId } from './animals';
import { EVOLUTIONS } from './evolutions';
import type { Records } from './records';
import { UPGRADES } from './upgrades';
import { MAX_LEVEL } from './weapons';
import type { RunSummary } from './world';

export interface AchievementDef {
  id: string;
  name: string;
  coins: number;
  animal?: AnimalId;
  /** run は 1 回が終わったときだけ渡る（店で買ったときは null） */
  done: (r: Records, run: RunSummary | null) => boolean;
  /** 合計の実績の [今, 目標] */
  progress?: (r: Records) => [number, number];
}

const maxed = (r: Records) => UPGRADES.filter((d) => (r.ranks[d.id] ?? 0) >= d.max).length;
const lv5 = (run: RunSummary | null) => run?.weapons.filter((o) => o.level >= MAX_LEVEL).length ?? 0;

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'survive1', name: '1 分生き延びる', coins: 10, done: (r) => r.best >= 60 },
  { id: 'survive5', name: '5 分生き延びる', coins: 50, done: (r) => r.best >= 300 },
  { id: 'survive10', name: '10 分生き延びる', coins: 100, done: (r) => r.best >= 600 },
  { id: 'clear', name: '15 分生き延びてクリア', coins: 200, animal: 'fox', done: (r) => r.clears >= 1 },
  { id: 'run100', name: '1 回で 100 体倒す', coins: 20, done: (_, run) => (run?.kills ?? 0) >= 100 },
  { id: 'run1000', name: '1 回で 1000 体倒す', coins: 100, done: (_, run) => (run?.kills ?? 0) >= 1000 },
  { id: 'run3000', name: '1 回で 3000 体倒す', coins: 200, done: (_, run) => (run?.kills ?? 0) >= 3000 },
  {
    id: 'total3000',
    name: '合計 3000 体倒す',
    coins: 100,
    done: (r) => r.kills >= 3000,
    progress: (r) => [r.kills, 3000]
  },
  {
    id: 'total30000',
    name: '合計 30000 体倒す',
    coins: 300,
    done: (r) => r.kills >= 30000,
    progress: (r) => [r.kills, 30000]
  },
  { id: 'bear', name: '巨大ベアを倒す', coins: 100, done: (r) => r.bosses.includes('bear') },
  {
    id: 'forestFinale',
    name: '森の面の主を倒す',
    coins: 300,
    animal: 'bear',
    done: (r) => r.finales.includes('forest')
  },
  {
    id: 'total20000',
    name: '合計 20000 体倒す',
    coins: 200,
    animal: 'rabbit',
    done: (r) => r.kills >= 20000,
    progress: (r) => [r.kills, 20000]
  },
  { id: 'yeti', name: '大雪男を倒す', coins: 200, animal: 'tiger', done: (r) => r.bosses.includes('yeti') },
  { id: 'queen', name: '女王グモを倒す', coins: 150, done: (r) => r.bosses.includes('spiderQueen') },
  {
    id: 'bothBosses',
    name: '1 回でボスを 2 体とも倒す',
    coins: 200,
    done: (_, run) => new Set(run?.bosses).size >= 2
  },
  { id: 'lv20', name: 'Lv20 になる', coins: 30, done: (_, run) => (run?.level ?? 0) >= 20 },
  { id: 'lv50', name: 'Lv50 になる', coins: 150, done: (_, run) => (run?.level ?? 0) >= 50 },
  { id: 'weapon5', name: '武器を 1 つ Lv5 にする', coins: 50, done: (_, run) => lv5(run) >= 1 },
  { id: 'weapons5', name: '武器 3 つを Lv5 にする', coins: 150, done: (_, run) => lv5(run) >= 3 },
  {
    id: 'allAnimals',
    name: '9 匹がそろう',
    coins: 200,
    done: (r) => r.unlocked.length >= ANIMALS.length,
    progress: (r) => [r.unlocked.length, ANIMALS.length]
  },
  {
    id: 'clear3',
    name: '3 匹でクリア',
    coins: 150,
    done: (r) => r.clearedBy.length >= 3,
    progress: (r) => [r.clearedBy.length, 3]
  },
  {
    id: 'clear7',
    name: '7 匹すべてでクリア',
    coins: 500,
    done: (r) => r.clearedBy.length >= ANIMALS.length,
    progress: (r) => [r.clearedBy.length, ANIMALS.length]
  },
  {
    id: 'chests10',
    name: '宝箱を合計 10 個開ける',
    coins: 50,
    done: (r) => r.chests >= 10,
    progress: (r) => [r.chests, 10]
  },
  { id: 'firstBuy', name: 'はじめてのパワーアップ', coins: 20, done: (r) => Object.values(r.ranks).some((n) => n > 0) },
  { id: 'oneMax', name: 'どれか 1 品を最大の段に', coins: 100, done: (r) => maxed(r) >= 1 },
  {
    id: 'allMax',
    name: '全部の品を最大の段に',
    coins: 500,
    done: (r) => maxed(r) >= UPGRADES.length,
    progress: (r) => [maxed(r), UPGRADES.length]
  },
  { id: 'evolve1', name: 'はじめての進化', coins: 100, done: (r) => r.evolved.length >= 1 },
  {
    id: 'evolveAll',
    name: '12 種すべて進化',
    coins: 500,
    done: (r) => r.evolved.length >= EVOLUTIONS.length,
    progress: (r) => [r.evolved.length, EVOLUTIONS.length]
  },
  { id: 'metal', name: 'きらきらハリネズミを倒す', coins: 200, done: (_, run) => run?.metal ?? false },
  {
    id: 'graveClear',
    name: '夜の墓地をクリア',
    coins: 300,
    animal: 'panda',
    done: (r) => r.stages.includes('graveyard')
  },
  { id: 'snowClear', name: '雪山をクリア', coins: 400, animal: 'drake', done: (r) => r.stages.includes('snow') },
  {
    id: 'snowBosses',
    name: '雪山の 2 体のボスを倒す',
    coins: 300,
    done: (r) => r.bosses.includes('yeti') && r.bosses.includes('dragon')
  },
  {
    id: 'graveBosses',
    name: '墓地の 2 体のボスを倒す',
    coins: 200,
    done: (r) => r.bosses.includes('pumpkin') && r.bosses.includes('knight')
  }
];

/**
 * まだの実績を達成にしてコインと動物を渡し、表の順に返す。ごほうびの動物で次の実績が満ちることがあるので、増えなくなるまで見る。
 * 返す実績の animal は、この判定で新しく仲間になったときだけ残す（前の版で仲間になった動物を「NEW」と出さないため）
 */
export function grant(r: Records, run: RunSummary | null): AchievementDef[] {
  const out: AchievementDef[] = [];
  const joined = new Set<AnimalId>();
  for (let more = true; more;) {
    more = false;
    for (const a of ACHIEVEMENTS) {
      if (r.achieved.includes(a.id) || !a.done(r, run)) continue;
      r.achieved.push(a.id);
      r.coins += a.coins;
      if (a.animal && !r.unlocked.includes(a.animal)) {
        r.unlocked.push(a.animal);
        joined.add(a.animal);
      }
      out.push(a);
      more = true;
    }
  }
  return ACHIEVEMENTS.filter((a) => out.includes(a)).map((a) =>
    a.animal && !joined.has(a.animal) ? { ...a, animal: undefined } : a
  );
}
