import type { Kind, PetAction } from './types';

/**
 * action ごとの目標のかっこう。models.ts がどの値も目標へ damp で寄せ、
 * 揺れ（足運び・しっぽ・呼吸）はその振れ幅だけを寄せて、位相は自分で進める。
 * 長さは肩の高さを 1 とした単位、角度はラジアン
 */
// y・z は腰の上下と前後、pitch は前が上がる向き、spine は背中を丸める、bend は背中を横へ曲げる。
// hp・hy・hr は首の下向き・左右・かしげ。fz・fy は前足の先を前・上へ、fa は手首から先を前へ倒す角度（b は後ろ足）。
// fr* は右前足だけに足す分（おて）。ff は前足の足先を曲げて足の裏を前へ向ける角度（負で前）。level は胴を傾けても肩の位置を保つ割合（おすわり）。
// tuck は足を体に引き寄せる、reach は跳ぶときに前足を前・後ろ足を後ろへのばす、splay はひざを外へ開く。
// shake はぬれた体をぶるぶる振る強さ（振るのは models.ts が自分の位相で行う）
export const KEYS = [
  'y',
  'z',
  'pitch',
  'roll',
  'spine',
  'bend',
  'level',
  'hp',
  'hy',
  'hr',
  'fz',
  'fy',
  'fa',
  'bz',
  'by',
  'ba',
  'frz',
  'fry',
  'fra',
  'ff',
  'frf',
  'splay',
  'tuck',
  'reach',
  'swing',
  'gait',
  'bob',
  'tail',
  'tailYaw',
  'tailBend',
  'curl',
  'wag',
  'ear',
  'eye',
  'jaw',
  'tongue',
  'chew',
  'breath',
  'wiggle',
  'prance',
  'smile',
  'shake'
] as const;
export type Pose = Record<(typeof KEYS)[number], number>;

function rest(kind: Kind): Pose {
  const p = Object.fromEntries(KEYS.map((k) => [k, 0])) as Pose;
  p.hp = kind === 'cat' ? 0.05 : -0.1;
  p.eye = 1;
  p.breath = 0.012;
  return p;
}

export const ease = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

/** action の目標のかっこう。since はその action になってからの秒 */
export function target(kind: Kind, action: PetAction, since: number, o: { speed: number; wag: number }): Pose {
  const p = rest(kind);
  const cat = kind === 'cat';
  p.wag = cat ? 0.1 + 0.25 * o.wag : 0.15 + 0.5 * o.wag;
  if (cat) p.tail = 0.25;
  switch (action) {
    case 'walk':
      p.swing = 1;
      p.bob = 0.012;
      if (cat) {
        p.tail = 1.35;
        p.curl = 0.25;
        p.hp = 0.15;
      }
      break;
    case 'run':
      p.swing = 1;
      p.gait = 1;
      p.bob = 0.03;
      p.ear = 0.6;
      p.hp = 0.1;
      if (cat) p.tail = 0.6;
      else {
        p.jaw = 0.5;
        p.tongue = 0.8;
      }
      break;
    case 'sit':
      sit(p, cat);
      break;
    case 'paw':
      sit(p, cat);
      p.fry = 0.42;
      p.frz = 0.28;
      p.fra = -0.5;
      p.frf = -1.3;
      p.hr = 0.22;
      p.jaw = cat ? 0 : 0.35;
      p.tongue = cat ? 0 : 0.4;
      break;
    case 'down':
      down(p, cat);
      break;
    case 'sleep':
      down(p, cat);
      p.y -= 0.02;
      p.roll = cat ? 0.35 : 0.2;
      p.bend = cat ? 0.75 : 0.5;
      p.hp = cat ? 0.9 : 0.75;
      p.hy = cat ? 0.9 : 0.75;
      p.hr = cat ? -0.4 : -0.3;
      p.fz = cat ? 0.15 : 0.25;
      p.eye = 0;
      p.ear = 0.5;
      p.breath = 0.035;
      // しっぽを体に沿わせて前へ回す
      p.tail = cat ? 0.5 : -0.9;
      p.tailYaw = cat ? 1.25 : 1.1;
      p.tailBend = cat ? 0.28 : 0.18;
      p.curl = 0;
      p.wag = 0;
      break;
    case 'eat':
      p.pitch = -0.1;
      p.hp = cat ? 1.05 : 1.1;
      p.fz = 0.04;
      p.chew = 1;
      break;
    case 'roll':
      down(p, cat);
      p.y = cat ? -0.5 : -0.48;
      p.tuck = 1;
      p.eye = 0.1;
      p.smile = 1;
      p.jaw = cat ? 0 : 0.5;
      p.tongue = cat ? 0 : 0.5;
      p.prance = 0.3;
      p.hp = -0.2;
      break;
    case 'jump': {
      const u = (since % 0.95) / 0.95;
      const air = u > 0.15 && u < 0.7;
      p.y = air ? 0 : -0.12;
      p.pitch = air ? 0.25 - 0.5 * ((u - 0.15) / 0.55) : -0.05;
      p.reach = air ? 0.8 : 0;
      p.eye = 1.05;
      p.jaw = cat ? 0 : 0.6;
      p.ear = 0.4;
      p.wag = 0.7;
      break;
    }
    case 'pounce': {
      const u = since % 1.8;
      if (u < 1.05) {
        // 足先を床に残したまま低くかがむ。関節は models.ts が足先から逆に解いて曲げる
        p.y = -0.3;
        p.pitch = -0.06;
        p.fz = 0.1;
        p.bz = 0.08;
        p.hp = -0.2;
        p.wiggle = ease(u / 0.3);
        p.eye = 1.2;
        p.ear = 0.3;
        p.tail = cat ? -0.6 : -0.2;
      } else if (u < 1.45) {
        p.pitch = 0.2;
        p.z = 0.47;
        p.reach = 1;
        p.eye = 1.2;
        p.ear = 0.6;
      } else {
        p.y = -0.08;
        p.z = 0.47;
        p.fz = 0.1;
      }
      break;
    }
    case 'shake':
      // 足を開いてふんばり、目を細めて頭から体を振る
      p.splay = 0.35;
      p.y = -0.03;
      p.hp = 0.12;
      p.eye = 0.3;
      p.ear = 0.35;
      p.jaw = cat ? 0 : 0.25;
      p.shake = 1;
      p.wag = 0.8;
      if (cat) p.tail = 0.5;
      break;
    case 'happy':
      // 座って両前足を上げ、足の裏（肉球）を見せる。口を少し開けて舌を出す
      sit(p, cat);
      p.pitch += 0.2;
      // 胴をさらに起こすと腰が床へ沈むので、そのぶん持ち上げる
      p.y += 0.06;
      // 顔を上げて、なでる人（カメラ）を見上げる
      p.hp = p.pitch * 1.3 - 0.2;
      // 前足は胸の前に寄せ、手首から先を曲げて肉球を正面へ向ける
      p.fy = 0.44;
      p.fz = cat ? 0.12 : 0.06;
      p.fa = -0.4;
      p.ff = -1.35;
      p.prance = 0.6;
      p.hr = 0.14 * Math.sin(since * 3.2);
      p.ear = 0.3;
      p.eye = 0.95;
      if (cat) {
        p.tail = 1.1;
        p.curl = 0.3;
        p.wag = 0.06;
        p.jaw = 0.22;
        p.tongue = 0.25;
      } else {
        p.jaw = 0.7;
        p.tongue = 1;
        p.wag = 1;
      }
      break;
  }
  return p;
}

function sit(p: Pose, cat: boolean) {
  p.pitch = cat ? 0.72 : 0.7;
  p.level = 1;
  // 猫は胴が長いぶん、肩を保つと腰が床へ沈むので少し持ち上げる
  if (cat) p.y = 0.16;
  p.bz = cat ? 0.42 : 0.36;
  p.ba = 1.35;
  p.splay = 0.25;
  // 胴を起こした分だけ首を下げ、顔は前を向かせる（頭の向きは hp − 1.3 × pitch になる）
  p.hp = p.pitch * 1.3 + 0.08;
  if (cat) {
    // 腰が床近くまで下がるので、しっぽは持ち上げて床の上を前足へ回す
    p.tail = 0.75;
    p.tailYaw = 1.45;
    p.tailBend = 0.24;
    p.curl = 0.35;
  }
}

function down(p: Pose, cat: boolean) {
  p.y = cat ? -0.44 : -0.42;
  p.pitch = 0.03;
  p.fz = cat ? 0.22 : 0.3;
  p.fa = 1.35;
  p.bz = cat ? 0.34 : 0.3;
  p.ba = 1.45;
  p.splay = 0.7;
  p.hp = -0.25;
  p.breath = 0.018;
  if (cat) {
    p.tail = 0.4;
    p.tailYaw = 0.5;
    p.tailBend = 0.15;
  }
}

/** 跳ねている高さ（肩の高さを 1 とした単位）。0.95 秒ごとに 1 回跳ぶ */
export function jumpArc(since: number) {
  const u = (since % 0.95) / 0.95;
  return u > 0.15 && u < 0.7 ? 0.65 * Math.sin((Math.PI * (u - 0.15)) / 0.55) : 0;
}

export function pounceArc(since: number) {
  const u = since % 1.8;
  return u > 1.05 && u < 1.45 ? 0.35 * Math.sin((Math.PI * (u - 1.05)) / 0.4) : 0;
}
