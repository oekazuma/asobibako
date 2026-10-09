import type { V3 } from '$lib/sculpt';
import type { Bone } from './doll';

export interface Pose {
  id: string;
  label: string;
  drop?: number;
  bones: Partial<Record<Bone, V3>>;
}

const ARMS_DOWN: Partial<Record<Bone, V3>> = {
  'upperarm.l': [0, 0, -0.75],
  'upperarm.r': [0, 0, 0.75],
  'forearm.l': [0, 0, -0.15],
  'forearm.r': [0, 0, 0.15]
};

export const STAND: Pose = { id: 'stand', label: '立つ', bones: ARMS_DOWN };

export const POSES: Pose[] = [
  {
    id: 'curl',
    label: '丸まる',
    drop: -0.33,
    bones: {
      hips: [0.3, 0, 0],
      spine: [1.0, 0, 0],
      chest: [0.8, 0, 0],
      head: [0.6, 0, 0],
      'thigh.l': [-2.5, 0, 0.1],
      'thigh.r': [-2.5, 0, -0.1],
      'shin.l': [2.6, 0, 0],
      'shin.r': [2.6, 0, 0],
      'upperarm.l': [-0.6, 0, -2.0],
      'upperarm.r': [-0.6, 0, 2.0]
    }
  },
  { id: 'lie', label: '寝そべる', drop: -0.364, bones: { hips: [Math.PI / 2, 0, 0], ...ARMS_DOWN } },
  {
    id: 'crouch',
    label: 'しゃがむ',
    drop: -0.25,
    bones: {
      spine: [0.35, 0, 0],
      'thigh.l': [-1.7, 0, 0.12],
      'thigh.r': [-1.7, 0, -0.12],
      'shin.l': [2.1, 0, 0],
      'shin.r': [2.1, 0, 0],
      'upperarm.l': [-0.8, 0, -0.6],
      'upperarm.r': [-0.8, 0, 0.6]
    }
  },
  {
    id: 'cross',
    label: 'あぐら',
    drop: -0.395,
    bones: {
      'thigh.l': [-1.45, 0, 0.9],
      'thigh.r': [-1.45, 0, -0.9],
      'shin.l': [0, 0, -2.4],
      'shin.r': [0, 0, 2.4],
      'upperarm.l': [-0.5, 0, -0.6],
      'upperarm.r': [-0.5, 0, 0.6]
    }
  },
  {
    id: 'bridge',
    label: 'ブリッジ',
    drop: -0.12,
    bones: {
      hips: [-1.0, 0, 0],
      spine: [-0.3, 0, 0],
      chest: [-0.3, 0, 0],
      head: [-0.4, 0, 0],
      'upperarm.l': [2.4, 0, 0.2],
      'upperarm.r': [2.4, 0, -0.2],
      'forearm.l': [-0.8, 0, 0],
      'forearm.r': [-0.8, 0, 0],
      'thigh.l': [0, 0, 0.15],
      'thigh.r': [0, 0, -0.15],
      'shin.l': [1.5, 0, 0],
      'shin.r': [1.5, 0, 0]
    }
  },
  { id: 't', label: 'Tポーズ', bones: { 'upperarm.l': [0, 0, 0.61], 'upperarm.r': [0, 0, -0.61] } },
  {
    id: 'one-leg',
    label: '片足立ち',
    bones: {
      'thigh.r': [-1.4, 0, 0],
      'shin.r': [1.7, 0, 0],
      'upperarm.l': [0, 0, 0.35],
      'upperarm.r': [0, 0, -0.35]
    }
  },
  {
    id: 'lean',
    label: '寄りかかる',
    bones: {
      hips: [0, 0, -0.12],
      spine: [0, 0, -0.14],
      'upperarm.l': [0, 0, 1.1],
      'forearm.l': [0, 0, 0.9],
      'upperarm.r': [0, 0, 0.75],
      'forearm.r': [0, 0, 0.15],
      'thigh.l': [0, 0, 0.12],
      'shin.l': [0.3, 0, 0],
      'thigh.r': [0, 0, 0.1],
      'shin.r': [0.8, 0, 0]
    }
  },
  {
    id: 'split',
    label: '開脚',
    drop: -0.389,
    bones: { 'thigh.l': [0, 0, 1.5], 'thigh.r': [0, 0, -1.5], 'upperarm.l': [0, 0, 0.3], 'upperarm.r': [0, 0, -0.3] }
  },
  {
    id: 'bend',
    label: '前屈',
    bones: {
      spine: [1.0, 0, 0],
      chest: [0.6, 0, 0],
      head: [0.3, 0, 0],
      'upperarm.l': [-1.2, 0, -0.75],
      'upperarm.r': [-1.2, 0, 0.75]
    }
  },
  {
    id: 'eagle',
    label: 'ワシ',
    bones: {
      'upperarm.l': [0, 0, 0.75],
      'upperarm.r': [0, 0, -0.75],
      'forearm.l': [0, 0, 0.15],
      'forearm.r': [0, 0, -0.15],
      'thigh.l': [0, 0, 0.3],
      'thigh.r': [0, 0, -0.3]
    }
  },
  {
    id: 'arch',
    label: 'のけぞり',
    bones: {
      spine: [-0.45, 0, 0],
      chest: [-0.4, 0, 0],
      head: [-0.45, 0, 0],
      'upperarm.l': [0.9, 0, -0.4],
      'upperarm.r': [0.9, 0, 0.4],
      'shin.l': [0.3, 0, 0],
      'shin.r': [0.3, 0, 0]
    }
  }
];

/** ハンターが銃を両手で前に構える形。輪には出さず、ほかの人から見えるハンターの体に使う */
export const AIM: Pose = {
  id: 'aim',
  label: '構える',
  bones: {
    'upperarm.l': [-1.35, 0, -0.55],
    'upperarm.r': [-1.45, 0, 0.75],
    'forearm.l': [0, 0.5, -0.15],
    'forearm.r': [0, 0, 0.15]
  }
};

const ALL = [AIM, ...POSES];

export const poseById = (id: string): Pose => ALL.find((p) => p.id === id) ?? STAND;
