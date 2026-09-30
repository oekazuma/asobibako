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

export const isOffer = (text: string) => text.startsWith(OFFER);
export const isAnswer = (text: string) => text.startsWith(ANSWER);

export class Link {
  readonly #pc: RTCPeerConnection;
  readonly #channel: RTCDataChannel;
  readonly #listeners = new Set<(message: Message) => void>();
  /** つながった直後に届いた知らせ。受け取る側の部品ができる前に来ても落とさないよう、最初の聞き手が付くまでためる */
  readonly #queue: Message[] = [];
  readonly closed: Promise<void>;

  constructor(pc: RTCPeerConnection, channel: RTCDataChannel) {
    this.#pc = pc;
    this.#channel = channel;
    channel.onmessage = (event) => {
      const message = JSON.parse(event.data) as Message;
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
    if (this.#channel.readyState === 'open') this.#channel.send(JSON.stringify(message));
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
 * Safari と Chrome は、カメラの許可がないページでは自分の LAN のアドレスを伏せる（mDNS 名にする）ので、先にカメラを開いてから呼ぶ
 */
export async function host(): Promise<{ code: string; accept: (answer: string) => Promise<Link> }> {
  const pc = new RTCPeerConnection({ iceServers: [] });
  // offer を作る前に開かないと、SDP にデータ用の行が入らない
  const channel = pc.createDataChannel('game');
  await pc.setLocalDescription();
  return {
    code: await describe(pc, OFFER),
    accept: async (answer) => {
      await pc.setRemoteDescription({ type: 'answer', sdp: await unpack(answer.slice(ANSWER.length)) });
      return opened(pc, channel);
    }
  };
}

/** 子になる。親の QR を渡し、返ってきた code を親に見せる。link は親が読み取るとつながる */
export async function join(offer: string): Promise<{ code: string; link: Promise<Link> }> {
  const pc = new RTCPeerConnection({ iceServers: [] });
  const channel = new Promise<RTCDataChannel>((resolve) =>
    pc.addEventListener('datachannel', (event) => resolve(event.channel), { once: true })
  );
  await pc.setRemoteDescription({ type: 'offer', sdp: await unpack(offer.slice(OFFER.length)) });
  await pc.setLocalDescription();
  return { code: await describe(pc, ANSWER), link: channel.then((c) => opened(pc, c)) };
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
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
}
