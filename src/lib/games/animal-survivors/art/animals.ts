import type { Art } from '../pixels';
import { GROWN } from './grown';

export type Pose = { walk: Art; attack: Art; hurt: Art };
type AnimalId = 'dog' | 'cat' | 'wolf' | 'fox' | 'bear' | 'rabbit' | 'panda' | 'tiger' | 'drake';

/** 右向き。左向きは描くときに反転する。歩きは体を 1 ドット上下させ、足の形を入れ替えている */
const BASE: Record<AnimalId, Pose> = {
  dog: {
    walk: {
      w: 16,
      h: 16,
      frames: [
        [
          '................',
          '....kkkkkkkk....',
          '...kbbbbbbbbk...',
          '.kkbbbbbbbbbbkk.',
          'kBBkbbbbbbbbkBBk',
          'kBBkbkwbbkwbkBBk',
          'kBBkbkkbbkkbkBBk',
          'kBBkbbccccbbkBBk',
          '.kBkbcckkccbkBk.',
          '..kkbbcppcbbkk..',
          '.k..krrrrrrk....',
          'kbkkbbbccbbbk...',
          'kbbbbbbccbbBk...',
          '.kkkBbbbbbBBk...',
          '...kbbk..kbbk...',
          '...kkkk..kkkk...'
        ],
        [
          '....kkkkkkkk....',
          '...kbbbbbbbbk...',
          '.kkbbbbbbbbbbkk.',
          'kBBkbbbbbbbbkBBk',
          'kBBkbkwbbkwbkBBk',
          'kBBkbkkbbkkbkBBk',
          'kBBkbbccccbbkBBk',
          '.kBkbcckkccbkBk.',
          '..kkbbcppcbbkk..',
          '.k..krrrrrrk....',
          'kbkkbbbccbbbk...',
          'kbbbbbbccbbBk...',
          '.kkkBbbbbbBBk...',
          '.kkkBbbbbbBBk...',
          '..kbbk....kbbk..',
          '..kkkk....kkkk..'
        ],
        [
          '................',
          '....kkkkkkkk....',
          '...kbbbbbbbbk...',
          '.kkbbbbbbbbbbkk.',
          'kBBkbbbbbbbbkBBk',
          'kBBkbkwbbkwbkBBk',
          'kBBkbkkbbkkbkBBk',
          'kBBkbbccccbbkBBk',
          '.kBkbcckkccbkBk.',
          '..kkbbcppcbbkk..',
          '.k..krrrrrrk....',
          'kbkkbbbccbbbk...',
          'kbbbbbbccbbBk...',
          '.kkkBbbbbbBBk...',
          '...kbbk..kbbk...',
          '...kkkk..kkkk...'
        ],
        [
          '....kkkkkkkk....',
          '...kbbbbbbbbk...',
          '.kkbbbbbbbbbbkk.',
          'kBBkbbbbbbbbkBBk',
          'kBBkbkwbbkwbkBBk',
          'kBBkbkkbbkkbkBBk',
          'kBBkbbccccbbkBBk',
          '.kBkbcckkccbkBk.',
          '..kkbbcppcbbkk..',
          '.k..krrrrrrk....',
          'kbkkbbbccbbbk...',
          'kbbbbbbccbbBk...',
          '.kkkBbbbbbBBk...',
          '.kkkBbbbbbBBk...',
          '....kbbkkbbk....',
          '....kkkkkkkk....'
        ]
      ]
    },
    attack: {
      w: 16,
      h: 16,
      frames: [
        [
          '................',
          '.....kkkkkkkk...',
          '....kbbbbbbbbk..',
          '..kkbbbbbbbbbbkk',
          '.kBBkbbbbbbbbkBB',
          '.kBBkbkwbbkwbkBB',
          '.kBBkbkkbbkkbkBB',
          '.kBBkbbccccbbkBB',
          '..kBkbcckkccbkBk',
          '...kkbkppppkbkk.',
          '..k..krrrrrrk...',
          '.kbkkbbbccbbbk..',
          '.kbbbbbbccbbBk..',
          '..kkkBbbbbbBBk..',
          '...kbbk....kbbk.',
          '...kkkk....kkkk.'
        ]
      ]
    },
    hurt: {
      w: 16,
      h: 16,
      frames: [
        [
          '................',
          '....kkkkkkkk....',
          '...kbbbbbbbbk...',
          '.kkbbbbbbbbbbkk.',
          'kBBkbbbbbbbbkBBk',
          'kBBkbkbbbbkbkBBk',
          'kBBkbbkbbkbbkBBk',
          'kBBkbbccccbbkBBk',
          '.kBkbcckkccbkBk.',
          '..kkbbcppcbbkk..',
          '.k..krrrrrrk....',
          'kbkkbbbccbbbk...',
          'kbbbbbbccbbBk...',
          '.kkkBbbbbbBBk...',
          '....kbbkkbbk....',
          '....kkkkkkkk....'
        ]
      ]
    }
  },
  cat: {
    walk: {
      w: 16,
      h: 16,
      pal: { O: '#b4612a' },
      frames: [
        [
          '..k..........k..',
          '..kk........kk..',
          '..kpk......kpk..',
          '..kpokkkkkkopk..',
          '..koooOooOoook..',
          '..kokwooookwok..',
          '..kokkooookkok..',
          'kkkoowwppwwookkk',
          '..koowwkkwwook..',
          '.k.kkkkkkkkkk...',
          'kOkkoowwwwook...',
          'kokkoOwwwwOok...',
          'kooooowwwwook...',
          '.kkkOoooooOOk...',
          '...kook..kook...',
          '...kkkk..kkkk...'
        ],
        [
          '..kk........kk..',
          '..kpk......kpk..',
          '..kpokkkkkkopk..',
          '..koooOooOoook..',
          '..kokwooookwok..',
          '..kokkooookkok..',
          'kkkoowwppwwookkk',
          '..koowwkkwwook..',
          '.k.kkkkkkkkkk...',
          'kOkkoowwwwook...',
          'kokkoOwwwwOok...',
          'kooooowwwwook...',
          '.kkkOoooooOOk...',
          '.kkkOoooooOOk...',
          '..kook....kook..',
          '..kkkk....kkkk..'
        ],
        [
          '..k..........k..',
          '..kk........kk..',
          '..kpk......kpk..',
          '..kpokkkkkkopk..',
          '..koooOooOoook..',
          '..kokwooookwok..',
          '..kokkooookkok..',
          'kkkoowwppwwookkk',
          '..koowwkkwwook..',
          '.k.kkkkkkkkkk...',
          'kOkkoowwwwook...',
          'kokkoOwwwwOok...',
          'kooooowwwwook...',
          '.kkkOoooooOOk...',
          '...kook..kook...',
          '...kkkk..kkkk...'
        ],
        [
          '..kk........kk..',
          '..kpk......kpk..',
          '..kpokkkkkkopk..',
          '..koooOooOoook..',
          '..kokwooookwok..',
          '..kokkooookkok..',
          'kkkoowwppwwookkk',
          '..koowwkkwwook..',
          '.k.kkkkkkkkkk...',
          'kOkkoowwwwook...',
          'kokkoOwwwwOok...',
          'kooooowwwwook...',
          '.kkkOoooooOOk...',
          '.kkkOoooooOOk...',
          '....kookkook....',
          '....kkkkkkkk....'
        ]
      ]
    },
    attack: {
      w: 16,
      h: 16,
      pal: { O: '#b4612a' },
      frames: [
        [
          '...k..........k.',
          '...kk........kk.',
          '...kpk......kpk.',
          '...kpokkkkkkopk.',
          '...koooOooOoook.',
          '...kokwooookwok.',
          '...kokkooookkok.',
          '.kkkoowwppwwookk',
          '...koowkppkwook.',
          '..k.kkkkkkkkkk..',
          '.kOkkoowwwwook..',
          '.kokkoOwwwwOok..',
          '.kooooowwwwook..',
          '..kkkOoooooOOk..',
          '...kook....kook.',
          '...kkkk....kkkk.'
        ]
      ]
    },
    hurt: {
      w: 16,
      h: 16,
      pal: { O: '#b4612a' },
      frames: [
        [
          '..k..........k..',
          '..kk........kk..',
          '..kpk......kpk..',
          '..kpokkkkkkopk..',
          '..koooOooOoook..',
          '..kokooooookok..',
          '..kookooookook..',
          'kkkoowwppwwookkk',
          '..koowwkkwwook..',
          '.k.kkkkkkkkkk...',
          'kOkkoowwwwook...',
          'kokkoOwwwwOok...',
          'kooooowwwwook...',
          '.kkkOoooooOOk...',
          '....kookkook....',
          '....kkkkkkkk....'
        ]
      ]
    }
  },
  wolf: {
    walk: {
      w: 16,
      h: 16,
      frames: [
        [
          '..k..........k..',
          '..kk........kk..',
          '..kGk......kGk..',
          '..kGgkkkkkkgGk..',
          '..kggGGGGGGggk..',
          '..kgkkggggkkgk..',
          '..kggykggkyggk..',
          '..kggggwwggggk..',
          '..kwgwwwwwwgwk..',
          '.k.kwwwkkwwwk...',
          'kwgkkwwwwwkk....',
          'kggggwwwwgggk...',
          'kgggggwwwggGk...',
          '.kkkGGggggGGk...',
          '...kGGk..kGGk...',
          '...kkkk..kkkk...'
        ],
        [
          '..kk........kk..',
          '..kGk......kGk..',
          '..kGgkkkkkkgGk..',
          '..kggGGGGGGggk..',
          '..kgkkggggkkgk..',
          '..kggykggkyggk..',
          '..kggggwwggggk..',
          '..kwgwwwwwwgwk..',
          '.k.kwwwkkwwwk...',
          'kwgkkwwwwwkk....',
          'kggggwwwwgggk...',
          'kgggggwwwggGk...',
          '.kkkGGggggGGk...',
          '.kkkGGggggGGk...',
          '..kGGk....kGGk..',
          '..kkkk....kkkk..'
        ],
        [
          '..k..........k..',
          '..kk........kk..',
          '..kGk......kGk..',
          '..kGgkkkkkkgGk..',
          '..kggGGGGGGggk..',
          '..kgkkggggkkgk..',
          '..kggykggkyggk..',
          '..kggggwwggggk..',
          '..kwgwwwwwwgwk..',
          '.k.kwwwkkwwwk...',
          'kwgkkwwwwwkk....',
          'kggggwwwwgggk...',
          'kgggggwwwggGk...',
          '.kkkGGggggGGk...',
          '...kGGk..kGGk...',
          '...kkkk..kkkk...'
        ],
        [
          '..kk........kk..',
          '..kGk......kGk..',
          '..kGgkkkkkkgGk..',
          '..kggGGGGGGggk..',
          '..kgkkggggkkgk..',
          '..kggykggkyggk..',
          '..kggggwwggggk..',
          '..kwgwwwwwwgwk..',
          '.k.kwwwkkwwwk...',
          'kwgkkwwwwwkk....',
          'kggggwwwwgggk...',
          'kgggggwwwggGk...',
          '.kkkGGggggGGk...',
          '.kkkGGggggGGk...',
          '....kGGkkGGk....',
          '....kkkkkkkk....'
        ]
      ]
    },
    attack: {
      w: 16,
      h: 16,
      frames: [
        [
          '...k..........k.',
          '...kk........kk.',
          '...kGk......kGk.',
          '...kGgkkkkkkgGk.',
          '...kggGGGGGGggk.',
          '...kgkkggggkkgk.',
          '...kggykggkyggk.',
          '...kggggwwggggk.',
          '...kwgwwwwwwgwk.',
          '..k.kwkrrrrkwk..',
          '.kwgkkwwwwwkk...',
          '.kggggwwwwgggk..',
          '.kgggggwwwggGk..',
          '..kkkGGggggGGk..',
          '...kGGk....kGGk.',
          '...kkkk....kkkk.'
        ]
      ]
    },
    hurt: {
      w: 16,
      h: 16,
      frames: [
        [
          '..k..........k..',
          '..kk........kk..',
          '..kGk......kGk..',
          '..kGgkkkkkkgGk..',
          '..kggGGGGGGggk..',
          '..kggkggggkggk..',
          '..kggkggggkggk..',
          '..kggggwwggggk..',
          '..kwgwwwwwwgwk..',
          '.k.kwwwkkwwwk...',
          'kwgkkwwwwwkk....',
          'kggggwwwwgggk...',
          'kgggggwwwggGk...',
          '.kkkGGggggGGk...',
          '....kGGkkGGk....',
          '....kkkkkkkk....'
        ]
      ]
    }
  },
  fox: {
    walk: {
      w: 16,
      h: 16,
      pal: { F: '#e06a28', D: '#9c3f12' },
      frames: [
        [
          '..k..........k..',
          '..kk........kk..',
          '..kkk......kkk..',
          '..kDFkkkkkkFDk..',
          '..kFFFFFFFFFFk..',
          '..kFkwFFFFkwFk..',
          '..kwkkFFFFkkwk..',
          '..kwwwwFFwwwwk..',
          '...kwwwkkwwwk...',
          'kwwkkwwwwwk.....',
          'kFFkFFwwwwFFk...',
          'kFFFFFwwwwFFk...',
          'kFFFFFFwwFFDk...',
          '.kkkDFFFFFDDk...',
          '...kGGk..kGGk...',
          '...kkkk..kkkk...'
        ],
        [
          '..kk........kk..',
          '..kkk......kkk..',
          '..kDFkkkkkkFDk..',
          '..kFFFFFFFFFFk..',
          '..kFkwFFFFkwFk..',
          '..kwkkFFFFkkwk..',
          '..kwwwwFFwwwwk..',
          '...kwwwkkwwwk...',
          'kwwkkwwwwwk.....',
          'kFFkFFwwwwFFk...',
          'kFFFFFwwwwFFk...',
          'kFFFFFFwwFFDk...',
          '.kkkDFFFFFDDk...',
          '.kkkDFFFFFDDk...',
          '..kGGk....kGGk..',
          '..kkkk....kkkk..'
        ],
        [
          '..k..........k..',
          '..kk........kk..',
          '..kkk......kkk..',
          '..kDFkkkkkkFDk..',
          '..kFFFFFFFFFFk..',
          '..kFkwFFFFkwFk..',
          '..kwkkFFFFkkwk..',
          '..kwwwwFFwwwwk..',
          '...kwwwkkwwwk...',
          'kwwkkwwwwwk.....',
          'kFFkFFwwwwFFk...',
          'kFFFFFwwwwFFk...',
          'kFFFFFFwwFFDk...',
          '.kkkDFFFFFDDk...',
          '...kGGk..kGGk...',
          '...kkkk..kkkk...'
        ],
        [
          '..kk........kk..',
          '..kkk......kkk..',
          '..kDFkkkkkkFDk..',
          '..kFFFFFFFFFFk..',
          '..kFkwFFFFkwFk..',
          '..kwkkFFFFkkwk..',
          '..kwwwwFFwwwwk..',
          '...kwwwkkwwwk...',
          'kwwkkwwwwwk.....',
          'kFFkFFwwwwFFk...',
          'kFFFFFwwwwFFk...',
          'kFFFFFFwwFFDk...',
          '.kkkDFFFFFDDk...',
          '.kkkDFFFFFDDk...',
          '....kGGkkGGk....',
          '....kkkkkkkk....'
        ]
      ]
    },
    attack: {
      w: 16,
      h: 16,
      pal: { F: '#e06a28', D: '#9c3f12' },
      frames: [
        [
          '...k..........k.',
          '...kk........kk.',
          '...kkk......kkk.',
          '...kDFkkkkkkFDk.',
          '...kFFFFFFFFFFk.',
          '...kFkwFFFFkwFk.',
          '...kwkkFFFFkkwk.',
          '...kwwwwFFwwwwk.',
          '....kwwkppkwwk..',
          '.kwwkkwwwwwk....',
          '.kFFkFFwwwwFFk..',
          '.kFFFFFwwwwFFk..',
          '.kFFFFFFwwFFDk..',
          '..kkkDFFFFFDDk..',
          '...kGGk....kGGk.',
          '...kkkk....kkkk.'
        ]
      ]
    },
    hurt: {
      w: 16,
      h: 16,
      pal: { F: '#e06a28', D: '#9c3f12' },
      frames: [
        [
          '..k..........k..',
          '..kk........kk..',
          '..kkk......kkk..',
          '..kDFkkkkkkFDk..',
          '..kFFFFFFFFFFk..',
          '..kFkFFFFFFkFk..',
          '..kwwkFFFFkwwk..',
          '..kwwwwFFwwwwk..',
          '...kwwwkkwwwk...',
          'kwwkkwwwwwk.....',
          'kFFkFFwwwwFFk...',
          'kFFFFFwwwwFFk...',
          'kFFFFFFwwFFDk...',
          '.kkkDFFFFFDDk...',
          '....kGGkkGGk....',
          '....kkkkkkkk....'
        ]
      ]
    }
  },
  bear: {
    walk: {
      w: 16,
      h: 16,
      frames: [
        [
          '................',
          '..kk........kk..',
          '.kBbk......kbBk.',
          '.kBbBkkkkkkBbBk.',
          '..kBBBBBBBBBBk..',
          '..kBkwBBBBkwBk..',
          '..kBkkBBBBkkBk..',
          '..kBBBccccBBBk..',
          '..kBBcckkccBBk..',
          '...kBBccccBBk...',
          '..kBBBBBBBBBBk..',
          '.kBBBtttttBBBBk.',
          '.kBBBtttttBBBBk.',
          '...kTBBBBBBTk...',
          '...kBBk..kBBk...',
          '...kkkk..kkkk...'
        ],
        [
          '..kk........kk..',
          '.kBbk......kbBk.',
          '.kBbBkkkkkkBbBk.',
          '..kBBBBBBBBBBk..',
          '..kBkwBBBBkwBk..',
          '..kBkkBBBBkkBk..',
          '..kBBBccccBBBk..',
          '..kBBcckkccBBk..',
          '...kBBccccBBk...',
          '..kBBBBBBBBBBk..',
          '.kBBBtttttBBBBk.',
          '.kBBBtttttBBBBk.',
          '...kTBBBBBBTk...',
          '...kTBBBBBBTk...',
          '..kBBk....kBBk..',
          '..kkkk....kkkk..'
        ],
        [
          '................',
          '..kk........kk..',
          '.kBbk......kbBk.',
          '.kBbBkkkkkkBbBk.',
          '..kBBBBBBBBBBk..',
          '..kBkwBBBBkwBk..',
          '..kBkkBBBBkkBk..',
          '..kBBBccccBBBk..',
          '..kBBcckkccBBk..',
          '...kBBccccBBk...',
          '..kBBBBBBBBBBk..',
          '.kBBBtttttBBBBk.',
          '.kBBBtttttBBBBk.',
          '...kTBBBBBBTk...',
          '...kBBk..kBBk...',
          '...kkkk..kkkk...'
        ],
        [
          '..kk........kk..',
          '.kBbk......kbBk.',
          '.kBbBkkkkkkBbBk.',
          '..kBBBBBBBBBBk..',
          '..kBkwBBBBkwBk..',
          '..kBkkBBBBkkBk..',
          '..kBBBccccBBBk..',
          '..kBBcckkccBBk..',
          '...kBBccccBBk...',
          '..kBBBBBBBBBBk..',
          '.kBBBtttttBBBBk.',
          '.kBBBtttttBBBBk.',
          '...kTBBBBBBTk...',
          '...kTBBBBBBTk...',
          '....kBBkkBBk....',
          '....kkkkkkkk....'
        ]
      ]
    },
    attack: {
      w: 16,
      h: 16,
      frames: [
        [
          '................',
          '...kk........kk.',
          '..kBbk......kbBk',
          '..kBbBkkkkkkBbBk',
          '...kBBBBBBBBBBk.',
          '...kBkwBBBBkwBk.',
          '...kBkkBBBBkkBk.',
          '...kBBBccccBBBk.',
          '...kBBcckkccBBk.',
          '....kBkppppkBk..',
          '...kBBBBBBBBBBk.',
          '..kBBBtttttBBBBk',
          '..kBBBtttttBBBBk',
          '....kTBBBBBBTk..',
          '...kBBk....kBBk.',
          '...kkkk....kkkk.'
        ]
      ]
    },
    hurt: {
      w: 16,
      h: 16,
      frames: [
        [
          '................',
          '..kk........kk..',
          '.kBbk......kbBk.',
          '.kBbBkkkkkkBbBk.',
          '..kBBBBBBBBBBk..',
          '..kBkBBBBBBkBk..',
          '..kBBkBBBBkBBk..',
          '..kBBBccccBBBk..',
          '..kBBcckkccBBk..',
          '...kBBccccBBk...',
          '..kBBBBBBBBBBk..',
          '.kBBBtttttBBBBk.',
          '.kBBBtttttBBBBk.',
          '...kTBBBBBBTk...',
          '....kBBkkBBk....',
          '....kkkkkkkk....'
        ]
      ]
    }
  },
  rabbit: {
    walk: {
      w: 16,
      h: 16,
      frames: [
        [
          '...kk.....kk....',
          '..kwwk...kwwk...',
          '..kwpk...kpwk...',
          '..kwpk...kpwk...',
          '..kwwkkkkkwwk...',
          '..kwwwwwwwwwk...',
          '..kwkwwwwkwwk...',
          '..kwwwwpwwwwk...',
          '..kswwwkwwwsk...',
          '...ksssssssk....',
          '...kwwwwwwwwk...',
          'kwwkwwwwwwwwk...',
          'kwwkwwwwwwwsk...',
          '.kkksswwwwssk...',
          '...kwwk..kwwk...',
          '...kkkk..kkkk...'
        ],
        [
          '..kwwk...kwwk...',
          '..kwpk...kpwk...',
          '..kwpk...kpwk...',
          '..kwwkkkkkwwk...',
          '..kwwwwwwwwwk...',
          '..kwkwwwwkwwk...',
          '..kwwwwpwwwwk...',
          '..kswwwkwwwsk...',
          '...ksssssssk....',
          '...kwwwwwwwwk...',
          'kwwkwwwwwwwwk...',
          'kwwkwwwwwwwsk...',
          '.kkksswwwwssk...',
          '.kkksswwwwssk...',
          '..kwwk....kwwk..',
          '..kkkk....kkkk..'
        ],
        [
          '...kk.....kk....',
          '..kwwk...kwwk...',
          '..kwpk...kpwk...',
          '..kwpk...kpwk...',
          '..kwwkkkkkwwk...',
          '..kwwwwwwwwwk...',
          '..kwkwwwwkwwk...',
          '..kwwwwpwwwwk...',
          '..kswwwkwwwsk...',
          '...ksssssssk....',
          '...kwwwwwwwwk...',
          'kwwkwwwwwwwwk...',
          'kwwkwwwwwwwsk...',
          '.kkksswwwwssk...',
          '...kwwk..kwwk...',
          '...kkkk..kkkk...'
        ],
        [
          '..kwwk...kwwk...',
          '..kwpk...kpwk...',
          '..kwpk...kpwk...',
          '..kwwkkkkkwwk...',
          '..kwwwwwwwwwk...',
          '..kwkwwwwkwwk...',
          '..kwwwwpwwwwk...',
          '..kswwwkwwwsk...',
          '...ksssssssk....',
          '...kwwwwwwwwk...',
          'kwwkwwwwwwwwk...',
          'kwwkwwwwwwwsk...',
          '.kkksswwwwssk...',
          '.kkksswwwwssk...',
          '....kwwkkwwk....',
          '....kkkkkkkk....'
        ]
      ]
    },
    attack: {
      w: 16,
      h: 16,
      frames: [
        [
          '....kk.....kk...',
          '...kwwk...kwwk..',
          '...kwpk...kpwk..',
          '...kwpk...kpwk..',
          '...kwwkkkkkwwk..',
          '...kwwwwwwwwwk..',
          '...kwkwwwwkwwk..',
          '...kwwwwpwwwwk..',
          '...kswwkpkwwsk..',
          '....ksssssssk...',
          '....kwwwwwwwwk..',
          '.kwwkwwwwwwwwk..',
          '.kwwkwwwwwwwsk..',
          '..kkksswwwwssk..',
          '...kwwk....kwwk.',
          '...kkkk....kkkk.'
        ]
      ]
    },
    hurt: {
      w: 16,
      h: 16,
      frames: [
        [
          '...kk.....kk....',
          '..kwwk...kwwk...',
          '..kwpk...kpwk...',
          '..kwpk...kpwk...',
          '..kwwkkkkkwwk...',
          '..kwkwwwkwwwk...',
          '..kwwkwwwkwwk...',
          '..kwwwwpwwwwk...',
          '..kswwwkwwwsk...',
          '...ksssssssk....',
          '...kwwwwwwwwk...',
          'kwwkwwwwwwwwk...',
          'kwwkwwwwwwwsk...',
          '.kkksswwwwssk...',
          '....kwwkkwwk....',
          '....kkkkkkkk....'
        ]
      ]
    }
  },
  panda: {
    walk: {
      w: 16,
      h: 16,
      frames: [
        [
          '................',
          '..kkk......kkk..',
          '.kkkk......kkkk.',
          '.kkkkkkkkkkkkkk.',
          '..kwwwwwwwwwwk..',
          '..kwkkwwwwkkwk..',
          '..kwkkwwwwkkwk..',
          '..kwwwwwwwwwwk..',
          '...kwwwkkwwwk...',
          '....kkkkkkkk....',
          '.kkkkwwwwwwkkkk.',
          '.kkkwwwwwwwwkkk.',
          '..kkwwwwwwwwkk..',
          '...kswwwwwwsk...',
          '...kkkk..kkkk...',
          '...kkkk..kkkk...'
        ],
        [
          '..kkk......kkk..',
          '.kkkk......kkkk.',
          '.kkkkkkkkkkkkkk.',
          '..kwwwwwwwwwwk..',
          '..kwkkwwwwkkwk..',
          '..kwkkwwwwkkwk..',
          '..kwwwwwwwwwwk..',
          '...kwwwkkwwwk...',
          '....kkkkkkkk....',
          '.kkkkwwwwwwkkkk.',
          '.kkkwwwwwwwwkkk.',
          '..kkwwwwwwwwkk..',
          '...kswwwwwwsk...',
          '...kswwwwwwsk...',
          '..kkkk....kkkk..',
          '..kkkk....kkkk..'
        ],
        [
          '................',
          '..kkk......kkk..',
          '.kkkk......kkkk.',
          '.kkkkkkkkkkkkkk.',
          '..kwwwwwwwwwwk..',
          '..kwkkwwwwkkwk..',
          '..kwkkwwwwkkwk..',
          '..kwwwwwwwwwwk..',
          '...kwwwkkwwwk...',
          '....kkkkkkkk....',
          '.kkkkwwwwwwkkkk.',
          '.kkkwwwwwwwwkkk.',
          '..kkwwwwwwwwkk..',
          '...kswwwwwwsk...',
          '...kkkk..kkkk...',
          '...kkkk..kkkk...'
        ],
        [
          '..kkk......kkk..',
          '.kkkk......kkkk.',
          '.kkkkkkkkkkkkkk.',
          '..kwwwwwwwwwwk..',
          '..kwkkwwwwkkwk..',
          '..kwkkwwwwkkwk..',
          '..kwwwwwwwwwwk..',
          '...kwwwkkwwwk...',
          '....kkkkkkkk....',
          '.kkkkwwwwwwkkkk.',
          '.kkkwwwwwwwwkkk.',
          '..kkwwwwwwwwkk..',
          '...kswwwwwwsk...',
          '...kswwwwwwsk...',
          '....kkkkkkkk....',
          '....kkkkkkkk....'
        ]
      ]
    },
    attack: {
      w: 16,
      h: 16,
      frames: [
        [
          '................',
          '...kkk......kkk.',
          '..kkkk......kkkk',
          '..kkkkkkkkkkkkkk',
          '...kwwwwwwwwwwk.',
          '...kwkkwwwwkkwk.',
          '...kwkkwwwwkkwk.',
          '...kwwwwwwwwwwk.',
          '....kwwkppkwwk..',
          '.....kkkkkkkk...',
          '..kkkkwwwwwwkkkk',
          '..kkkwwwwwwwwkkk',
          '...kkwwwwwwwwkk.',
          '....kswwwwwwsk..',
          '...kkkk....kkkk.',
          '...kkkk....kkkk.'
        ]
      ]
    },
    hurt: {
      w: 16,
      h: 16,
      frames: [
        [
          '................',
          '..kkk......kkk..',
          '.kkkk......kkkk.',
          '.kkkkkkkkkkkkkk.',
          '..kwwwwwwwwwwk..',
          '..kwkkwwwwkkwk..',
          '..kwkkwwwwkkwk..',
          '..kwwkwwwwkwwk..',
          '...kwwwkkwwwk...',
          '....kkkkkkkk....',
          '.kkkkwwwwwwkkkk.',
          '.kkkwwwwwwwwkkk.',
          '..kkwwwwwwwwkk..',
          '...kswwwwwwsk...',
          '....kkkkkkkk....',
          '....kkkkkkkk....'
        ]
      ]
    }
  },
  tiger: {
    walk: {
      w: 16,
      h: 16,
      frames: [
        [
          '...kookkkkkook..',
          '..kowokoookowok.',
          '..kowookkkoowok.',
          '..koooooooooook.',
          '...koooooooook..',
          '....kowkowkok...',
          '....kokppwkok...',
          '...kopwwwwwpok..',
          '....kkowwwokk...',
          'kk.kkoowwook....',
          'kkkookokwokok...',
          'kkkookokwokok...',
          '..koooooooook...',
          '...kkOOOOOOk....',
          '....kOOkkOOk....',
          '.....kk..kk.....'
        ],
        [
          '..kowokoookowok.',
          '..kowookkkoowok.',
          '..koooooooooook.',
          '...koooooooook..',
          '....kowkowkok...',
          '....kokppwkok...',
          '...kopwwwwwpok..',
          '....kkowwwokk...',
          'kk.kkoowwook....',
          'kkkookokwokok...',
          'kkkookokwokok...',
          '..koooooooook...',
          '...koOOOOOOok...',
          '...kookkkkook...',
          '...kOOk..kOOk...',
          '....kk....kk....'
        ],
        [
          '...kookkkkkook..',
          '..kowokoookowok.',
          '..kowookkkoowok.',
          '..koooooooooook.',
          '...koooooooook..',
          '....kowkowkok...',
          '....kokppwkok...',
          '...kopwwwwwpok..',
          '....kkowwwokk...',
          'kk.kkoowwook....',
          'kkkookokwokok...',
          'kkkookokwokok...',
          '..koooooooook...',
          '...kkOOOOOOk....',
          '....kOOkkOOk....',
          '.....kk..kk.....'
        ],
        [
          '..kowokoookowok.',
          '..kowookkkoowok.',
          '..koooooooooook.',
          '...koooooooook..',
          '....kowkowkok...',
          '....kokppwkok...',
          '...kopwwwwwpok..',
          '....kkowwwokk...',
          'kk.kkoowwook....',
          'kkkookokwokok...',
          'kkkookokwokok...',
          '..koooooooook...',
          '...kkOOOOOOk....',
          '.....kooook.....',
          '.....kOOOOk.....',
          '......kkkk......'
        ]
      ],
      pal: { O: '#b4612a' }
    },
    attack: {
      w: 16,
      h: 16,
      frames: [
        [
          '...kookkkkkook..',
          '..kowokoookowok.',
          '..kowookkkoowok.',
          '..koooooooooook.',
          '...koooooooook..',
          '....kowkowkok...',
          '....kokppwkok...',
          '...kopwRRRwpok..',
          '....kkoRRRokk...',
          'kk.kkoowwook....',
          'kkkookokwokok...',
          'kkkookokwokok...',
          '..koooooooook...',
          '...kkOOOOOOk....',
          '....kOOkkOOk....',
          '.....kk..kk.....'
        ]
      ],
      pal: { O: '#b4612a' }
    },
    hurt: {
      w: 16,
      h: 16,
      frames: [
        [
          '...kookkkkkook..',
          '..kowokoookowok.',
          '..kowookkkoowok.',
          '..koooooooooook.',
          '...koooooooouk..',
          '....koooooook...',
          '....kkkppwkkk...',
          '...koowwwwwook..',
          '....kkowwwokk...',
          'kk.kkoowwook....',
          'kkkookokwokok...',
          'kkkookokwokok...',
          '..koooooooook...',
          '...kkOOOOOOk....',
          '....kOOkkOOk....',
          '.....kk..kk.....'
        ]
      ],
      pal: { O: '#b4612a' }
    }
  },
  drake: {
    walk: {
      w: 16,
      h: 16,
      frames: [
        [
          '....kcckkkcck...',
          '....kccrrrcck...',
          '....krrrrrrrk...',
          '...krrrrrrrrrk..',
          '...krrrrrrrrrk..',
          '...krrwkrwkrrk..',
          '...krrkRRckrrk..',
          '...krpcccccprk..',
          '....kkrcccrkk...',
          '....krrccrrk....',
          'kkkkrrroorrrk...',
          'RRRrrrrccrrrk...',
          'RRRrrrroorrrk...',
          'kkkkkRRRRRRk....',
          '....kRRkkRRk....',
          '.....kk..kk.....'
        ],
        [
          '....kccrrrcck...',
          '....krrrrrrrk...',
          '...krrrrrrrrrk..',
          '...krrrrrrrrrk..',
          '...krrwkrwkrrk..',
          '...krrkRRckrrk..',
          '...krpcccccprk..',
          '....kkrcccrkk...',
          '....krrccrrk....',
          'kkkkrrroorrrk...',
          'RRRrrrrccrrrk...',
          'RRRrrrroorrrk...',
          'kkkkrRRRRRRrk...',
          '...krrkkkkrrk...',
          '...kRRk..kRRk...',
          '....kk....kk....'
        ],
        [
          '....kcckkkcck...',
          '....kccrrrcck...',
          '....krrrrrrrk...',
          '...krrrrrrrrrk..',
          '...krrrrrrrrrk..',
          '...krrwkrwkrrk..',
          '...krrkRRckrrk..',
          '...krpcccccprk..',
          '....kkrcccrkk...',
          '....krrccrrk....',
          'kkkkrrroorrrk...',
          'RRRrrrrccrrrk...',
          'RRRrrrroorrrk...',
          'kkkkkRRRRRRk....',
          '....kRRkkRRk....',
          '.....kk..kk.....'
        ],
        [
          '....kccrrrcck...',
          '....krrrrrrrk...',
          '...krrrrrrrrrk..',
          '...krrrrrrrrrk..',
          '...krrwkrwkrrk..',
          '...krrkRRckrrk..',
          '...krpcccccprk..',
          '....kkrcccrkk...',
          '....krrccrrk....',
          'kkkkrrroorrrk...',
          'RRRrrrrccrrrk...',
          'RRRrrrroorrrk...',
          'kkkkkRRRRRRk....',
          '.....krrrrk.....',
          '.....kRRRRk.....',
          '......kkkk......'
        ]
      ]
    },
    attack: {
      w: 16,
      h: 16,
      frames: [
        [
          '....kcckkkcck...',
          '....kccrrrcck...',
          '....krrrrrrrk...',
          '...krrrrrrrrrk..',
          '...krrrrrrrrrk..',
          '...krrwkrwkrrk..',
          '...krrkRRckrrk..',
          '...krpcRRRcprk..',
          '....kkrRRRrkk...',
          '....krrccrrk....',
          'kkkkrrroorrrk...',
          'RRRrrrrccrrrk...',
          'RRRrrrroorrrk...',
          'kkkkkRRRRRRk....',
          '....kRRkkRRk....',
          '.....kk..kk.....'
        ]
      ]
    },
    hurt: {
      w: 16,
      h: 16,
      frames: [
        [
          '....kcckkkcck...',
          '....kccrrrcck...',
          '....krrrrrrrk...',
          '...krrrrrrrrrk..',
          '...krrrrrrrruk..',
          '...krrrrrrrrrk..',
          '...krkkRRckkrk..',
          '...krrcccccrrk..',
          '....kkrcccrkk...',
          '....krrccrrk....',
          'kkkkrrroorrrk...',
          'RRRrrrrccrrrk...',
          'RRRrrrroorrrk...',
          'kkkkkRRRRRRk....',
          '....kRRkkRRk....',
          '.....kk..kk.....'
        ]
      ]
    }
  }
};

/** 育つ 3 段階の絵。forms[0] がキャラ選択でも使う 1 段階め */
export const ANIMAL_ART = Object.fromEntries(
  Object.entries(BASE).map(([id, pose]) => [id, { forms: [pose, ...GROWN[id]] }])
) as Record<AnimalId, { forms: [Pose, Pose, Pose] }>;
