import { hazard } from './bosses';
import type { Item } from './drops';
import type { StageEvent } from './stages/forest';
import type { World } from './world';

/** 宝の地図の宝箱が消えるまでの秒 */
export const TREASURE_LIFE = 30;
/** 流れ星が降り続ける秒と、予告を出す間 */
export const METEOR_TIME = 10;
export const METEOR_EVERY = 0.5;
/** お祭りの秒 */
export const FESTIVAL = 20;
const TREASURE_NEAR = 350;
const TREASURE_FAR = 450;
const METEOR_REACH = 120;
export const METEOR_WARN = 1.2;
/** 流れ星が落ちたあと、衝撃の輪を見せる秒 */
export const METEOR_IMPACT = 0.3;
const METEOR_R = 22;
const METEOR_DMG = 20;

/** 時間の続く出来事を始める。spawnEvents が群れ・輪のほかの種類を渡す */
export function startEvent(w: World, ev: StageEvent): void {
  if (ev.kind === 'treasure') {
    const a = w.rand() * Math.PI * 2;
    const d = TREASURE_NEAR + w.rand() * (TREASURE_FAR - TREASURE_NEAR);
    const it: Item = {
      alive: true,
      kind: 'chest',
      x: w.player.x + Math.cos(a) * d,
      y: w.player.y + Math.sin(a) * d,
      pulled: false,
      life: TREASURE_LIFE
    };
    const free = w.items.findIndex((o) => !o.alive);
    if (free >= 0) w.items[free] = it;
    else w.items.push(it);
    w.treasure = it;
  } else if (ev.kind === 'meteor') w.meteors = { left: METEOR_TIME, next: 0 };
  else if (ev.kind === 'festival') w.festival = FESTIVAL;
}

/** step の中で呼ぶ（3 択・宝箱・一時停止では進まない）。時計で止まっているあいだは呼ばない */
export function stepEvents(w: World, dt: number): void {
  const t = w.treasure;
  if (t) {
    t.life = (t.life ?? 0) - dt;
    if (!t.alive || t.life <= 0) {
      if (t.alive) w.events.push({ type: 'swarm', text: '宝箱が消えてしまった…' });
      t.alive = false;
      w.treasure = null;
    }
  }
  const m = w.meteors;
  if (m.left > 0) {
    m.left -= dt;
    m.next -= dt;
    while (m.next <= 0 && m.left > -1e-9) {
      m.next += METEOR_EVERY;
      const a = w.rand() * Math.PI * 2;
      const d = Math.sqrt(w.rand()) * METEOR_REACH;
      hazard(w, {
        kind: 'meteor',
        owner: -1,
        x: w.player.x + Math.cos(a) * d,
        y: w.player.y + Math.sin(a) * d,
        vx: 0,
        vy: 0,
        r: METEOR_R,
        delay: METEOR_WARN,
        life: METEOR_IMPACT,
        dmg: METEOR_DMG * w.stage.fury(w.time)
      });
    }
  }
  w.festival = Math.max(0, w.festival - dt);
}
