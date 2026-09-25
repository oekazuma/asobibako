// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { BREEDS } from './breeds';
import { loadSave, STORAGE_KEY } from './engine';
import { HELP, MAX_CALLS, addCalls, callKey, normalize, parse } from './voice';

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

describe('芸のほかの頼みごと', () => {
  it.each([
    ['ねんね', 'sleep'],
    ['ねんねして', 'sleep'],
    ['ネンネ', 'sleep'],
    ['おやすみ', 'sleep'],
    ['お休み', 'sleep'],
    ['おやすみなさい', 'sleep'],
    ['寝て', 'sleep'],
    ['ねて', 'sleep'],
    ['寝んね', 'sleep'],
    ['おきて', 'wake'],
    ['起きて', 'wake'],
    ['おきろー', 'wake'],
    ['おはよう', 'wake'],
    ['おはよー', 'wake'],
    ['ごはん', 'feed'],
    ['ごはんだよ', 'feed'],
    ['ご飯だよー', 'feed'],
    ['コハン', 'feed'],
    ['おみず', 'water'],
    ['お水', 'water'],
    ['ソファ', 'sofa'],
    ['ソファー', 'sofa'],
    ['ソファに のって', 'sofa'],
    ['ソファにおいで', 'sofa'],
    ['ベッド', 'bed'],
    ['ベット', 'bed'],
    ['ベッドに のって', 'bed'],
    ['まて', 'stay'],
    ['待て', 'stay'],
    ['まって', 'stay'],
    ['待って！', 'stay'],
    ['ストップ', 'stay'],
    ['おすわり、まて', 'stay'],
    ['よし', 'release'],
    ['よーし', 'release'],
    ['良し', 'release'],
    ['オッケー', 'release'],
    ['とってこい', 'fetch'],
    ['取ってこい', 'fetch'],
    ['とってきて', 'fetch'],
    ['もってきて', 'fetch'],
    ['もってこい', 'fetch'],
    ['持って来い', 'fetch'],
    ['取って来い！', 'fetch'],
    ['持って来て', 'fetch'],
    ['ボール', 'fetch'],
    ['ぼーる なげるよ', 'fetch'],
    ['ねずみ', 'fetch'],
    ['ボールで あそぼ', 'fetch'],
    ['あそぼ', 'play'],
    ['あそぼう', 'play'],
    ['遊ぼう', 'play'],
    ['あそんで', 'play'],
    ['おさんぽ いこう', 'walk'],
    ['お散歩', 'walk'],
    ['さんぽ', 'walk'],
    ['こうえん', 'walk'],
    ['公園に行こう', 'walk'],
    ['こうえんで あそぼ', 'walk'],
    ['おうち かえろう', 'home'],
    ['お家に帰ろう', 'home'],
    ['かえろう', 'home'],
    ['おふろ', 'bath'],
    ['お風呂', 'bath'],
    ['おふろに はいろう', 'bath'],
    ['はい チーズ', 'photo'],
    ['はいチーズ！', 'photo'],
    ['しゃしん', 'photo'],
    ['写真とるよ', 'photo'],
    ['だめ', 'scold'],
    ['ダメ！', 'scold'],
    ['駄目', 'scold'],
    ['こら', 'scold'],
    ['こらー！', 'scold'],
    ['やめて', 'scold']
  ])('「%s」は %s', (text, action) => {
    expect(act(text)).toBe(action);
  });

  it('芸の言葉とぶつからない', () => {
    expect(act('はねて')).toBe('jump');
    expect(act('ふせ')).toBe('down');
    expect(act('ねんね')).toBe('sleep');
    expect(act('たって')).toBe('beg');
    expect(act('まって')).toBe('stay');
    expect(act('まわって')).toBe('spin');
    expect(act('のびて')).toBe('bow');
  });

  it('「おきて」は呼ぶではなく起きる。「きて」だけなら呼ぶ', () => {
    expect(act('おきて')).toBe('wake');
    expect(act('きて')).toBe('call');
    expect(act('こっち きて')).toBe('call');
  });

  it('「よしよし」はほめる、「よし」だけなら「まて」のおしまい', () => {
    expect(act('よしよし')).toBe('praise');
    expect(act('よし')).toBe('release');
    expect(act('よし おいで')).toBe('call');
  });

  it('いくつも言ったら、くわしい方を取る', () => {
    expect(act('ベッドで ねんね')).toBe('sleep');
    expect(act('おうちで ねんね')).toBe('sleep');
    expect(act('ごはんと おみず')).toBe('feed');
    expect(act('おいで ねんね')).toBe('sleep');
    expect(act('いいこ まて')).toBe('stay');
  });

  it('名前と一緒でも、その子への頼みごとになる', () => {
    expect(parse('ポチ ねんね', PETS)).toEqual({ petId: 'a', action: 'sleep' });
    expect(parse('タマちゃん おきて', PETS)).toEqual({ petId: 'b', action: 'wake' });
    expect(parse('ポチ、まて！', PETS)).toEqual({ petId: 'a', action: 'stay' });
    expect(parse('ココア とってこい', PETS)).toEqual({ petId: 'd', action: 'fetch' });
    expect(parse('だめ ポチ', PETS)).toEqual({ petId: 'a', action: 'scold' });
    expect(parse('はい チーズ', PETS)).toEqual({ petId: null, action: 'photo' });
  });

  it('命令の中に名前が入っていても、名前ではなく命令として聞く', () => {
    const pets = [
      { id: 's', name: 'スミ' },
      { id: 'p', name: 'ポチ' }
    ];
    expect(parse('おやすみ', pets)).toEqual({ petId: null, action: 'sleep' });
    expect(parse('ポチ おやすみ', pets)).toEqual({ petId: 'p', action: 'sleep' });
    expect(parse('スミ おやすみ', pets)).toEqual({ petId: 's', action: 'sleep' });
    expect(parse('スミ', pets)).toEqual({ petId: 's', action: 'call' });
    expect(parse('ねずみ', pets)).toEqual({ petId: null, action: 'fetch' });
  });

  it('しつけのシートの「こえで できること」は、どれも書いたとおりに聞き取れる', () => {
    for (const h of HELP) for (const say of h.say) expect(act(say), say).toBe(h.action);
  });

  it.each([
    'ねてない',
    'ねてないよ',
    '寝てない',
    'ねない',
    '寝ない',
    'おきない',
    '起きないの',
    'たべない',
    'だめじゃない',
    'ポチ ねてない',
    'おすわり しないで',
    'ごはん たべないで'
  ])('打ち消しの「%s」は頼みごとにしない', (text) => {
    expect(parse(text, PETS)).toBe(null);
  });

  it('打ち消しの前に言った頼みごとは受ける', () => {
    expect(act('ねてないで おきて')).toBe('wake');
    expect(act('なかないで ねんね')).toBe('sleep');
  });

  it('「ペット」は、ならすと同じになる「ベッド」と取りちがえない', () => {
    expect(normalize('ペット')).toBe(normalize('ベッド'));
    expect(act('ペット')).toBe(null);
    expect(act('ペットの ポチ')).toBe('call');
    expect(act('ぺっと')).toBe(null);
    expect(act('べっど')).toBe('bed');
    expect(act('ねどこ')).toBe('bed');
    expect(act('ポチ ベッド')).toBe('bed');
  });

  it.each([
    ['ここまで おいで', 'call'],
    ['そこまで きて', 'call'],
    ['あそこまで いって', null],
    ['どこまで いくの', null],
    ['ここで まて', 'stay'],
    ['ちょっと まって', 'stay'],
    ['ここまで きたら まて', 'stay']
  ])('「%s」の「まで」は「まて」にしない', (text, action) => {
    expect(act(text)).toBe(action);
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
      for (const h of HELP)
        for (const say of h.say)
          expect(parse(`${name} ${say}`, pets), `${name} ${say}`).toEqual({ petId: name, action: h.action });
    }
    for (const h of HELP) for (const say of h.say) expect(parse(say, pets)?.action, say).toBe(h.action);
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

  it('2 字の命令（まて・よし）が入った名前は崩さない', () => {
    expect(callKey('マテオ')).toBe(normalize('まておー'));
    expect(callKey('ヨシコちゃん')).toBe(normalize('よしこ'));
    expect(callKey('ポチ ねんね')).toBe(normalize('ぽち'));
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
