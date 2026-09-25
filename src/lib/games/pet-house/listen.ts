import { hush } from '$lib/audio.svelte';

/** lib.dom には結果とエラーのイベントしかなく、認識そのものの型がないので必要な分だけ書く */
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type Ctor = new () => Recognition;

function recognizer(): Ctor | undefined {
  const w = globalThis as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export const canListen = (): boolean => recognizer() !== undefined;

/** 押しなおしても変わらない理由。ボタンを薄くして、ボタンで遊べることを示す */
const LASTING: SpeechRecognitionErrorCode[] = [
  'not-allowed',
  'service-not-allowed',
  'audio-capture',
  'language-not-supported'
];

const REASONS: Partial<Record<SpeechRecognitionErrorCode, string>> = {
  'not-allowed': 'マイクを きょか すると こえで よべるよ',
  'service-not-allowed': 'せっていの「Siri と音声入力」を オンに すると こえで よべるよ',
  network: 'インターネットに つながると こえで よべるよ',
  'no-speech': 'きこえなかった。ボタンを おしながら はなしてね',
  'audio-capture': 'マイクが みつからないよ',
  'language-not-supported': 'にほんごの こえに たいおう していないみたい'
};

export interface Listener {
  /** 聞き取れた。候補はよさそうな順 */
  result(alts: string[]): void;
  /** 聞けなかった理由（子ども向けの文）。取り消しただけのときは呼ばない */
  error(reason: string, lasting: boolean): void;
  /** 聞き終わった。result / error のあとにも、何も来なかったときにも必ず 1 回 */
  end(): void;
}

/**
 * 1 回だけ聞く。iOS Safari は操作イベントの外で start() すると断られるので、押したイベントの中で呼ぶ。
 * continuous は iOS で効かないことがあり、無音でも勝手に止まるので、短い 1 言ずつ聞く形にしている
 */
export function listen(on: Listener): { stop(): void } {
  const Rec = recognizer();
  if (!Rec) {
    on.error('この ブラウザでは こえで よべないよ。ボタンで あそんでね', true);
    on.end();
    return { stop() {} };
  }
  const rec = new Rec();
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    clearTimeout(giveUp);
    hush(false);
    on.end();
  };
  // stop() しても onend が来ない実装があると、ボタンが聞いている見た目のまま戻らなくなる
  const giveUp = setTimeout(() => {
    try {
      rec.abort();
    } catch {
      // 止まっていれば投げる。どちらでも終わらせる
    }
    end();
  }, 12_000);
  rec.lang = 'ja-JP';
  rec.continuous = false;
  rec.interimResults = false;
  rec.maxAlternatives = 5;
  rec.onresult = (e) => {
    const result = e.results[e.results.length - 1];
    const alts: string[] = [];
    for (let i = 0; i < result.length; i++) alts.push(result[i].transcript);
    if (alts.some(Boolean)) on.result(alts);
  };
  rec.onerror = (e) => {
    if (e.error !== 'aborted')
      on.error(REASONS[e.error] ?? 'うまく きけなかった。もう いちど', LASTING.includes(e.error));
  };
  rec.onend = end;
  try {
    hush(true);
    rec.start();
  } catch {
    on.error('うまく きけなかった。もう いちど', false);
    end();
  }
  return {
    stop() {
      try {
        rec.stop();
      } catch {
        end();
      }
    }
  };
}

/**
 * 押して話すボタンの配線。iOS は操作イベントの外で start() すると断られるので、押した瞬間に聞きはじめる。
 * 長く押したら離したときに止め、短く押しただけの子のためには話し終わって勝手に止まるまで聞く（もう 1 度押すと止まる）
 */
export function pushToTalk(begin: () => Listener) {
  let rec: { stop(): void } | null = null;
  let pressedAt = 0;
  const start = () => {
    const on = begin();
    let ended = false;
    const r = listen({
      ...on,
      end() {
        ended = true;
        rec = null;
        on.end();
      }
    });
    rec = ended ? null : r;
  };
  return {
    down(e: PointerEvent) {
      if (rec) return rec.stop();
      pressedAt = e.timeStamp;
      try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      } catch {
        // 合成イベントでは失敗しうる。捕まえられなくても離したときに止まらないだけ
      }
      start();
    },
    up(e: PointerEvent) {
      if (rec && e.timeStamp - pressedAt > 400) rec.stop();
    },
    /** キーボードで押したときは pointerdown が来ないので、押すたびに聞く・止めるを切り替える */
    click(e: MouseEvent) {
      if (e.detail !== 0) return;
      if (rec) rec.stop();
      else start();
    },
    stop() {
      rec?.stop();
    }
  };
}
