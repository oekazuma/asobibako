// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { BREEDS } from './breeds';
import { loadSave, STORAGE_KEY } from './engine';
import { MAX_CALLS, addCalls, callKey, normalize, parse } from './voice';

const PETS = [
  { id: 'a', name: 'ポチ' },
  { id: 'b', name: 'タマ' },
  { id: 'c', name: 'ココ' },
  { id: 'd', name: 'ココア' }
];

const act = (text: string) => parse(text, PETS)?.action ?? null;
const who = (text: string) => parse(text, PETS)?.petId ?? null;

describe('normalize', () => {
  it('カタカナ・全角・長音・小さい「っ」・記号の揺れをならす', () => {
    expect(normalize('オスワリ')).toBe(normalize('おすわり'));
    expect(normalize('おすわーりっ！')).toBe(normalize('おすわり'));
    expect(normalize('ｵｽﾜﾘ')).toBe(normalize('おすわり'));
    expect(normalize('ポチ、 おすわり。')).toBe(normalize('ぽちおすわり'));
  });

  it('濁点・半濁点の聞き違いを吸収する', () => {
    expect(normalize('おいて')).toBe(normalize('おいで'));
    expect(normalize('ころん')).toBe(normalize('ゴロン'));
  });
});

describe('芸', () => {
  it.each([
    ['おすわり', 'sit'],
    ['お座り', 'sit'],
    ['座って', 'sit'],
    ['すわれ！', 'sit'],
    ['オスワリ', 'sit'],
    ['ふせ', 'down'],
    ['伏せ', 'down'],
    ['フセ！', 'down'],
    ['おて', 'paw'],
    ['お手', 'paw'],
    ['おててして', 'paw'],
    ['猫パンチ', 'paw'],
    ['ねこぱんち', 'paw'],
    ['ネコパンチして', 'paw'],
    ['ごろん', 'roll'],
    ['ころん', 'roll'],
    ['ゴロンして', 'roll'],
    ['転がれ', 'roll'],
    ['ごろごろ', 'roll'],
    ['ジャンプ', 'jump'],
    ['じゃんぷ！', 'jump'],
    ['跳べ', 'jump'],
    ['飛んで', 'jump'],
    ['とべー', 'jump'],
    ['ちんちん', 'beg'],
    ['チンチン！', 'beg'],
    ['お願い', 'beg'],
    ['たって', 'beg'],
    ['おまわり', 'spin'],
    ['お回り', 'spin'],
    ['まわって', 'spin'],
    ['くるりん', 'spin'],
    ['クルクル', 'spin'],
    ['ハイタッチ', 'high'],
    ['はいたっち！', 'high'],
    ['タッチ', 'high'],
    ['おじぎ', 'bow'],
    ['お辞儀', 'bow'],
    ['のびー', 'bow'],
    ['伸びて', 'bow'],
    ['しんだふり', 'dead'],
    ['死んだふり', 'dead'],
    ['バタンキュー', 'dead']
  ])('「%s」は %s', (text, trick) => {
    expect(act(text)).toBe(trick);
  });

  it('「〜して」「〜！」や長音がついても当たる', () => {
    expect(act('おすわりして')).toBe('sit');
    expect(act('おすわーり！')).toBe('sit');
    expect(act('ジャーンプ')).toBe('jump');
    expect(act('ふせっ')).toBe('down');
  });

  it('よくある聞き違いも少し吸収する', () => {
    expect(act('お触り')).toBe('sit');
    expect(act('おさわり')).toBe('sit');
    expect(act('大手')).toBe('paw');
    expect(act('布施')).toBe('down');
    expect(act('チャンプ')).toBe('jump');
    expect(act('ゴロゴロ')).toBe('roll');
  });
});

describe('よぶ・ほめる', () => {
  it.each(['おいで', 'こっち', 'こっちおいで', '来て', 'おいでー', '置いて', 'おいて'])('「%s」は呼ぶ', (text) => {
    expect(act(text)).toBe('call');
  });

  it.each([
    'いいこ',
    'いいこいいこ',
    'いい子',
    '良い子だね',
    'よしよし',
    'えらい',
    '偉いね',
    'じょうず',
    '上手！',
    'すごい'
  ])('「%s」はほめる', (text) => {
    expect(act(text)).toBe('praise');
  });

  it('関係ない言葉は null', () => {
    expect(parse('きょうは いい てんき', PETS)).toBe(null);
    expect(parse('', PETS)).toBe(null);
    expect(parse('あいうえお', PETS)).toBe(null);
  });
});

describe('名前', () => {
  it('名前だけなら、そのペットを呼ぶ', () => {
    expect(parse('ポチ', PETS)).toEqual({ petId: 'a', action: 'call' });
    expect(parse('ぽち', PETS)).toEqual({ petId: 'a', action: 'call' });
    expect(parse('ポチー！', PETS)).toEqual({ petId: 'a', action: 'call' });
  });

  it('「〇〇、おすわり」は、そのペットに切り替えて芸', () => {
    expect(parse('ポチ おすわり', PETS)).toEqual({ petId: 'a', action: 'sit' });
    expect(parse('ぽち、お座り！', PETS)).toEqual({ petId: 'a', action: 'sit' });
    expect(parse('タマちゃん猫パンチ', PETS)).toEqual({ petId: 'b', action: 'paw' });
    expect(parse('おすわりポチ', PETS)).toEqual({ petId: 'a', action: 'sit' });
  });

  it('用意した名前は漢字で聞き取られても当たる', () => {
    expect(parse('玉おいで', PETS)).toEqual({ petId: 'b', action: 'call' });
    expect(parse('タマ、ジャンプ', PETS)).toEqual({ petId: 'b', action: 'jump' });
  });

  it('用意した名前はどれも、名前だけで呼べて芸の言葉とぶつからない', () => {
    const pets = Object.values(BREEDS).flatMap((b) => b.names.map((name) => ({ id: name, name })));
    for (const { name } of pets) {
      expect(parse(name, pets), name).toEqual({ petId: name, action: 'call' });
      expect(parse(`${name} ふせ`, pets), name).toEqual({ petId: name, action: 'down' });
    }
  });

  it('濁点の聞き違いでも当たる', () => {
    expect(who('ボチ')).toBe('a');
  });

  it('長い名前を先に当てる', () => {
    expect(who('ココア おすわり')).toBe('d');
    expect(who('ココ おすわり')).toBe('c');
  });

  it('名前の中の言葉を命令と取りちがえない', () => {
    const pets = [{ id: 'k', name: 'オテンバ' }];
    expect(parse('オテンバ', pets)).toEqual({ petId: 'k', action: 'call' });
    expect(parse('おてんば ふせ', pets)).toEqual({ petId: 'k', action: 'down' });
  });

  it('ひらがなや漢字で付けた名前も当たる', () => {
    const pets = [
      { id: 'x', name: 'もも' },
      { id: 'y', name: '大福' }
    ];
    expect(parse('モモ おて', pets)).toEqual({ petId: 'x', action: 'paw' });
    expect(parse('桃 おて', pets)).toEqual({ petId: 'x', action: 'paw' });
    expect(parse('大福ふせ', pets)).toEqual({ petId: 'y', action: 'down' });
  });
});

describe('いくつも当たるとき', () => {
  it('芸 → よぶ → ほめる の順', () => {
    expect(act('おいで、おすわり')).toBe('sit');
    expect(act('いいこ、ふせ')).toBe('down');
    expect(act('こっちおいで いいこ')).toBe('call');
  });
});

describe('声で覚えさせた呼び名', () => {
  it('呼んだ声から、命令と「ちゃん」「くん」を外して覚える', () => {
    expect(callKey('ダイフク')).toBe(normalize('だいふく'));
    expect(callKey('大福ちゃん')).toBe('大福');
    expect(callKey('小太郎くーん')).toBe('小太郎');
    expect(callKey('だいふく おいで')).toBe(normalize('だいふく'));
    expect(callKey('麦')).toBe('麦');
  });

  it('命令だけ・かな 1 字・長い文は覚えない', () => {
    expect(callKey('おいで')).toBe(null);
    expect(callKey('おすわり')).toBe(null);
    expect(callKey('む')).toBe(null);
    expect(callKey('')).toBe(null);
    expect(callKey('きょうは とても いい てんきですね')).toBe(null);
  });

  it('候補は上から 3 つまで、重ねずに上限まで足す', () => {
    const one = addCalls([], ['大福', 'だいふく', '台風', 'たいふく']);
    expect(one).toEqual(['大福', normalize('だいふく'), normalize('台風')]);
    expect(addCalls(one, ['大福', 'だいふく'])).toEqual(one);
    let many: string[] = [];
    for (let i = 0; i < 5; i++) many = addCalls(many, [`名${i}あ`, `名${i}い`, `名${i}う`]);
    expect(many).toHaveLength(MAX_CALLS);
    expect(many[0]).toBe('名0あ');
  });

  it('自分で付けた名前が漢字で聞き取られても、呼び名で当たる', () => {
    const pets = [
      { id: 'a', name: 'ダイフク' },
      { id: 'b', name: 'たろう' }
    ];
    expect(parse('大福 おすわり', pets)).toEqual({ petId: null, action: 'sit' });
    expect(parse('大福', pets)).toBe(null);
    const calls = addCalls(addCalls([], ['大福', 'ダイフク']), ['大福ちゃん']);
    const taught = [{ ...pets[0], calls }, pets[1]];
    expect(parse('大福 おすわり', taught)).toEqual({ petId: 'a', action: 'sit' });
    expect(parse('大福ちゃん', taught)).toEqual({ petId: 'a', action: 'call' });
    expect(parse('たろう ふせ', taught)).toEqual({ petId: 'b', action: 'down' });
  });

  it('呼び名を覚えた子の名前でも、ほかの子の名前は取らない', () => {
    const pets = [
      { id: 'a', name: 'モコ', calls: ['桃子'] },
      { id: 'b', name: 'モモ' }
    ];
    expect(parse('桃子 おて', pets)?.petId).toBe('a');
    expect(parse('もも おて', pets)?.petId).toBe('b');
  });
});

describe('呼び名の保存', () => {
  const load = (calls: unknown) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pets: [{ id: 'a', breed: 'shiba', name: 'ダイフク', calls }] }));
    return loadSave()?.pets[0];
  };

  it('文字の呼び名だけを上限まで残し、壊れていれば持たない', () => {
    expect(load(['大福', 'たいふく'])?.calls).toEqual(['大福', 'たいふく']);
    expect(load(['大福', 3, '', null, 'x'.repeat(40)])?.calls).toEqual(['大福']);
    expect(load(Array.from({ length: 20 }, (_, i) => `名${i}`))?.calls).toHaveLength(MAX_CALLS);
    expect(load('大福')).not.toHaveProperty('calls');
    expect(load(undefined)).not.toHaveProperty('calls');
  });
});
