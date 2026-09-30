<script lang="ts">
  import { onDestroy } from 'svelte';
  import { closeCamera, openCamera, scan, type Facing } from './camera';
  import { host, isAnswer, isOffer, join, type Net } from './link';
  import Qr from './Qr.svelte';

  let { name, onlink, onback }: { name: string; onlink: (net: Net) => void; onback: () => void } = $props();

  interface Wanted {
    match: (text: string) => boolean;
    connect: (text: string) => Promise<void>;
  }

  let role = $state<'host' | 'guest' | null>(null);
  /** 自分が見せる QR の中身 */
  let code = $state('');
  /** QR とカメラを同時に出すと、どちらに向ければよいか迷うので、どちらか一方だけを出す */
  let looking = $state(false);
  let linking = $state(false);
  let note = $state('');
  let facing = $state<Facing>('user');
  let stream = $state<MediaStream>();
  let video = $state<HTMLVideoElement>();
  let wanted = $state.raw<Wanted>();

  const step = $derived(role === 'host' ? (looking ? 2 : 1) : looking ? 1 : 2);

  // カメラの映像が画面に出ているあいだだけ読む
  $effect(() => {
    if (!video || !wanted) return;
    const { match, connect } = wanted;
    video.srcObject = stream ?? null;
    return scan(video, match, (text) => {
      looking = false;
      linking = true;
      connect(text).catch(fail);
    });
  });

  function reset() {
    closeCamera(stream);
    stream = undefined;
    role = null;
    code = '';
    looking = linking = false;
    wanted = undefined;
  }

  function done(net: Net) {
    reset();
    onlink(net);
  }

  function fail() {
    reset();
    note = 'つながりませんでした。2だいが おなじ Wi-Fi に いるか たしかめてね';
  }

  async function begin(as: 'host' | 'guest') {
    note = '';
    try {
      // 接続情報を作る前にカメラを開く。許可がないと自分のアドレスが伏せられ、つながらないことがある
      stream = await openCamera(facing);
    } catch {
      note = 'カメラを つかえませんでした';
      return;
    }
    role = as;
    if (as === 'host') {
      const offer = await host();
      code = offer.code;
      wanted = { match: isAnswer, connect: async (text) => done({ me: 1, link: await offer.accept(text) }) };
    } else {
      looking = true;
      wanted = {
        match: isOffer,
        connect: async (text) => {
          const answer = await join(text);
          code = answer.code;
          done({ me: 2, link: await answer.link });
        }
      };
    }
  }

  async function turn() {
    facing = facing === 'user' ? 'environment' : 'user';
    closeCamera(stream);
    stream = await openCamera(facing);
  }

  onDestroy(() => closeCamera(stream));
</script>

<main class="pair">
  <h1 class="yuru">{name}<br />2だいで あそぶ</h1>
  {#if !role}
    <p>おなじ Wi-Fi の 2だいを QR で つなぎます</p>
    <button class="pill p1" onclick={() => begin('host')}>さきに QR を だす</button>
    <button class="pill p2" onclick={() => begin('guest')}>QR を よみとる</button>
  {:else if looking}
    <p class="step">{step}. あいての QR を うつしてね</p>
    <video class:mirror={facing === 'user'} bind:this={video} autoplay muted playsinline></video>
    <button class="pill" onclick={turn}>カメラを きりかえ</button>
    {#if role === 'host'}
      <button class="pill" onclick={() => (looking = false)}>じぶんの QR に もどる</button>
    {/if}
  {:else if code && !(role === 'host' && linking)}
    <p class="step">{step}. この QR を あいてに よみとってもらってね</p>
    <div class="code"><Qr text={code} /></div>
    {#if role === 'host'}
      <button class="pill gold" onclick={() => (looking = true)}>よみとってもらったら つぎへ</button>
    {:else}
      <p role="status">よみとってもらうと はじまるよ</p>
    {/if}
  {:else}
    <p role="status">つないでいます…</p>
  {/if}
  {#if note}<p role="alert">{note}</p>{/if}
  <button class="pill" onclick={onback}>もどる</button>
</main>

<style>
  .pair {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    min-height: 100dvh;
    padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom));
    background: var(--paper-dots), var(--paper);
    color: var(--line);
    font-weight: 700;
    text-align: center;
  }

  .step {
    font-size: clamp(17px, 3vmin, 24px);
    font-weight: 800;
  }

  h1 {
    font-size: clamp(22px, 4vmin, 36px);
  }

  .code {
    width: min(86vw, 52dvh);
    aspect-ratio: 1;
    padding: 8px;
    border: 3px solid var(--line);
    border-radius: 16px;
    background: #fff;
  }

  video {
    width: min(80vw, 50dvh);
    aspect-ratio: 4 / 3;
    border: 3px solid var(--line);
    border-radius: 16px;
    background: #000;
    object-fit: cover;
  }

  /* 前のカメラは鏡に映したほうが向きを合わせやすい。読み取りは映像そのものを使うので影響しない */
  video.mirror {
    scale: -1 1;
  }
</style>
