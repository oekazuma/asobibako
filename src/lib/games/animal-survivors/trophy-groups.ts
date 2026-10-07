/** 実績の画面の見出し。実績の表は id を変えずに書き換えてきたので、並べ方は見せる側だけで持つ */
export const TROPHY_GROUPS: [string, string[]][] = [
  ['生き延びる', ['survive1', 'survive5', 'survive10', 'clear', 'overtime5', 'overtime10']],
  [
    'ステージ',
    ['graveClear', 'snowClear', 'volcanoClear', 'clear3', 'clear7', 'heat5', 'heat9', 'relic1', 'relicAll', 'shrine10']
  ],
  ['倒す', ['run100', 'run1000', 'run3000', 'total3000', 'total20000', 'total30000', 'metal', 'lava300']],
  ['ボス', ['bear', 'queen', 'forestFinale', 'bothBosses', 'graveBosses', 'yeti', 'snowBosses', 'volcanoBosses']],
  [
    '育てる',
    [
      'lv20',
      'lv50',
      'weapon5',
      'weapons5',
      'evolve1',
      'evolveAll',
      'union1',
      'unionAll',
      'union3',
      'limit50',
      'allAnimals',
      'chests10'
    ]
  ],
  [
    'お店・図鑑・お題',
    ['firstBuy', 'oneMax', 'allMax', 'bookEnemies', 'bookBosses', 'bookForms', 'bookItems', 'daily1', 'daily7']
  ]
];
