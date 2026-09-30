<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { closeCamera, openCamera, scan, type Facing } from './camera';
  import { host, isAnswer, isOffer, join, type Net } from './link';
  import Qr from './Qr.svelte';

  let { name, onlink, onback }: { name: string; onlink: (net: Net) => void; onback: () => void } = $props();

  let role = $state<'host' | 'guest' | null>(null);
  /** 自分が見せる QR の中身 */
  let code = $state('');
  let linking = $state(false);
  let note = $state('');
  let facing = $state<Facing>('user');
  let stream = $state<MediaStream>();
  let video = $state<HTMLVideoElement>();
  let stopScan = () => {};

  $effect(() => {
    if (video) video.srcObject = stream ?? null;
  });

  function reset() {
    stopScan();
    closeCamera(stream);
    stream = undefined;
    role = null;
    code = '';
    linking = false;
  }

  function done(net: Net) {
    reset();
    onlink(net);
  }

  function fail() {
    reset();
    note = 'つながりませんでした。2だいが おなじ Wi-Fi に いるか たしかめてね';
  }

  async function read(wanted: (text: string) => boolean, connect: (text: string) => Promise<void>) {
    await tick();
    if (!video) return;
    stopScan = scan(video, wanted, (text) => {
      linking = true;
      connect(text).catch(fail);
    });
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
      read(isAnswer, async (text) => done({ me: 1, link: await offer.accept(text) }));
    } else {
      read(isOffer, async (text) => {
        const answer = await join(text);
        code = answer.code;
        done({ me: 2, link: await answer.link });
      });
    }
  }

  async function turn() {
    facing = facing === 'user' ? 'environment' : 'user';
    closeCamera(stream);
    stream = await openCamera(facing);
  }

  onDestroy(() => {
    stopScan();
    closeCamera(stream);
  });
</script>

<main class="pair">
  <h1 class="yuru">{name}<br />2だいで あそぶ</h1>
  {#if !role}
    <p>おなじ Wi-Fi の 2だいを QR で つなぎます</p>
    <button class="pill p1" onclick={() => begin('host')}>さきに QR を だす</button>
    <button class="pill p2" onclick={() => begin('guest')}>QR を よみとる</button>
  {:else}
    {#if code}
      <div class="code"><Qr text={code} /></div>
      <p>この QR を あいての カメラに みせてね</p>
    {/if}
    {#if !code || (role === 'host' && !linking)}
      <video class:mirror={facing === 'user'} bind:this={video} autoplay muted playsinline></video>
      <p>あいての QR を カメラに うつしてね</p>
      <button class="pill" onclick={turn}>カメラを きりかえ</button>
    {/if}
    {#if linking}<p role="status">つないでいます…</p>{/if}
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

  h1 {
    font-size: clamp(22px, 4vmin, 36px);
  }

  .code {
    width: min(80vw, 40dvh);
    aspect-ratio: 1;
    padding: 8px;
    border: 3px solid var(--line);
    border-radius: 16px;
    background: #fff;
  }

  video {
    width: min(60vw, 22dvh);
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
