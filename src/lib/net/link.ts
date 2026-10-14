import { inflate } from '$lib/inflate';
import { remember } from '$lib/last-error';
import type { Player } from '$lib/player';

/**
 * 2 台の端末を WebRTC の DataChannel で直接つなぐ。サーバーを置けないので、接続情報（SDP）は QR で 1 往復だけ見せ合う。
 * QR は 1 回しか渡せないので候補を小出しにせず、集め終えてから SDP ごと渡す。STUN は使わず、同じ Wi-Fi の中だけでつなぐ
 */
export interface Net {
  /** 親（QR を先に出した側）が 1、子が 2 */
  me: Player;
  link: Link;
}

export type Message = { t: string } & Record<string, unknown>;

const OFFER = 'O:';
const ANSWER = 'A:';
const OPEN_MS = 15000;
/** 1 通の上限が分からないときの値で、上限の上限。Chrome は接続のときに 256KiB と伝え、Firefox は Infinity を返すので、これを超えない */
const MAX_BYTES = 256 * 1024;
/** QR から読んだ SDP を戻す上限。縮める前の SDP は数百バイトから 2KB ほどで、これを超えるものは SDP ではない */
const MAX_SDP = 16 * 1024;
/** 上限を超える知らせを分けたものの印。古い版の端末は知らない知らせとして読み飛ばすが、分けるのは今は送れない大きさの知らせだけ */
const PART = '~part';
/** 分けた知らせをつなぐ数の上限。相手が大きな n を宣言して送り続けても、集めるのは 16MiB（256KiB × 64）まで */
const MAX_PARTS = 64;

export const isOffer = (text: string) => text.startsWith(OFFER);
export const isAnswer = (text: string) => text.startsWith(ANSWER);

export class Link {
  readonly #pc: RTCPeerConnection;
  readonly #channel: RTCDataChannel;
  readonly #listeners = new Set<(message: Message) => void>();
  /** つながった直後に届いた知らせ。受け取る側の部品ができる前に来ても落とさないよう、最初の聞き手が付くまでためる */
  readonly #queue: Message[] = [];
  #parts: string[] = [];
  readonly closed: Promise<void>;

  constructor(pc: RTCPeerConnection, channel: RTCDataChannel) {
    this.#pc = pc;
    this.#channel = channel;
    channel.onmessage = (event) => {
      let message = JSON.parse(event.data) as Message;
      if (message.t === PART) {
        if (message.i === 0) this.#parts = [];
        const n = Number(message.n);
        // 順を守る channel では i は集めた数と一致する。ずれた・数が不正な列は捨てて、次の知らせから受け直す
        if (!Number.isInteger(n) || n < 1 || n > MAX_PARTS || message.i !== this.#parts.length) {
          this.#parts = [];
          return;
        }
        this.#parts.push(String(message.s));
        if (this.#parts.length < n) return;
        message = JSON.parse(this.#parts.join('')) as Message;
        this.#parts = [];
      }
      if (!this.#listeners.size) this.#queue.push(message);
      for (const listener of this.#listeners) listener(message);
    };
    this.closed = new Promise((resolve) => {
      channel.addEventListener('close', () => resolve());
      // 相手が画面を閉じずに寝た・Wi-Fi から外れたときは channel の close が来ず、接続の状態だけが failed になる
      pc.addEventListener('connectionstatechange', () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') resolve();
      });
    });
  }

  send(message: Message): void {
    if (this.#channel.readyState !== 'open') return;
    const text = JSON.stringify(message);
    const max = Math.min(this.#pc.sctp?.maxMessageSize || MAX_BYTES, MAX_BYTES);
    try {
      // UTF-8 は 1 字 3 バイトまでなので、字数の 3 倍が上限以下なら測らずに 1 通で送る
      if (text.length * 3 <= max || new TextEncoder().encode(text).byteLength <= max) this.#channel.send(text);
      else for (const part of split(text, max)) this.#channel.send(part);
    } catch (e) {
      // 送れなかった 1 通のせいで、呼んだ側の残り（ほかの人への知らせ・迎えた子の番号を返すこと）まで止めない
      remember(e instanceof Error ? e.message : String(e));
    }
  }

  /** 戻り値で聞くのをやめる */
  on(listener: (message: Message) => void): () => void {
    this.#listeners.add(listener);
    for (const message of this.#queue.splice(0)) listener(message);
    return () => this.#listeners.delete(listener);
  }

  close(): void {
    this.#pc.close();
  }
}

/** 包んだ JSON が 1 字 3 バイトでも上限に収まる字数で切る。切り口の片割れのサロゲートは \uXXXX になるので、少し余らせる */
function split(text: string, max: number): string[] {
  const size = Math.floor(max / 3) - 64;
  const n = Math.ceil(text.length / size);
  return Array.from({ length: n }, (_, i) =>
    JSON.stringify({ t: PART, i, n, s: text.slice(i * size, (i + 1) * size) })
  );
}

function opened(pc: RTCPeerConnection, channel: RTCDataChannel): Promise<Link> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pc.close();
      reject(new Error('timeout'));
    }, OPEN_MS);
    const ready = () => {
      clearTimeout(timer);
      resolve(new Link(pc, channel));
    };
    if (channel.readyState === 'open') ready();
    else channel.addEventListener('open', ready, { once: true });
  });
}

/** STUN が無ければ候補集めはすぐ終わるが、終わりの知らせが来ない端末に備えて見切る */
function gathered(pc: RTCPeerConnection): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve();
    pc.addEventListener('icegatheringstatechange', () => pc.iceGatheringState === 'complete' && resolve());
    setTimeout(resolve, 3000);
  });
}

/**
 * QR の点を大きく保つため、つなぐのに要らない行を落とす。
 * TCP の候補は自分から掛けに行く側（active）だけで相手に待ち受けがなく、候補の末尾の generation 以降は省ける拡張
 */
export const slim = (sdp: string) =>
  sdp
    .split('\r\n')
    .filter((line) => !/^a=(extmap-allow-mixed|msid-semantic)|^a=candidate:\S+ \d+ tcp /.test(line))
    .map((line) => line.replace(/ generation \d+.*$/, ''))
    .join('\r\n');

async function describe(pc: RTCPeerConnection, prefix: string): Promise<string> {
  await gathered(pc);
  return prefix + (await pack(slim(pc.localDescription!.sdp)));
}

/**
 * 親になる。code を QR で見せ、子の QR を accept に渡すとつながる。
 * Safari と Chrome は、カメラの許可がないページでは自分の LAN のアドレスを伏せる（mDNS 名にする）ので、先にカメラを開いてから呼ぶ。
 * close はつながる前にやめるときに呼ぶ。Link を受け取ったあとは Link.close で閉じる
 */
export async function host(): Promise<{ code: string; accept: (answer: string) => Promise<Link>; close: () => void }> {
  const pc = new RTCPeerConnection({ iceServers: [] });
  // offer を作る前に開かないと、SDP にデータ用の行が入らない
  const channel = pc.createDataChannel('game');
  await pc.setLocalDescription();
  return {
    code: await describe(pc, OFFER),
    accept: async (answer) => {
      await pc.setRemoteDescription({ type: 'answer', sdp: await unpack(answer.slice(ANSWER.length)) });
      return opened(pc, channel);
    },
    close: () => pc.close()
  };
}

/**
 * 子になる。親の QR を渡し、返ってきた code を親に見せる。link は親が読み取るとつながる。
 * close はつながる前にやめるときに呼ぶ。Link を受け取ったあとは Link.close で閉じる
 */
export async function join(offer: string): Promise<{ code: string; link: Promise<Link>; close: () => void }> {
  const pc = new RTCPeerConnection({ iceServers: [] });
  const channel = new Promise<RTCDataChannel>((resolve) =>
    pc.addEventListener('datachannel', (event) => resolve(event.channel), { once: true })
  );
  await pc.setRemoteDescription({ type: 'offer', sdp: await unpack(offer.slice(OFFER.length)) });
  await pc.setLocalDescription();
  return { code: await describe(pc, ANSWER), link: channel.then((c) => opened(pc, c)), close: () => pc.close() };
}

/** SDP は QR に入れるには長いので、縮めて base64url にする（QR が細かいほど画面越しに読みにくい） */
export async function pack(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

export async function unpack(code: string): Promise<string> {
  const bytes = Uint8Array.from(atob(code.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(await inflate(bytes, MAX_SDP));
}
