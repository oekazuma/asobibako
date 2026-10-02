import type { Art } from '../pixels';

/** 右向き。左向きは描くときに反転する。歩きは体を 1 ドット上下させ、足の形を入れ替えている */
export const ANIMAL_ART: Record<'dog' | 'cat' | 'wolf', { walk: Art; attack: Art; hurt: Art }> = {
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
  }
};
