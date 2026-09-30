<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { closeCamera, openCamera, scan, type Facing } from './camera';
  import { host, isAnswer, isOffer, join, type Link } from './link';
  import Qr from './Qr.svelte';

  let {
    role,
    onlink,
    onfail
  }: { role: 'host' | 'guest'; onlink: (link: Link) => void; onfail: (note: string) => void } = $props();

  interface Wanted {
    match: (text: string) => boolean;
    connect: (text: string) => Promise<void>;
  }

  /** 自分が見せる QR の中身 */
  let code = $state('');
  /** QR とカメラを同時に出すと、どちらに向ければよいか迷うので、どちらか一方だけを出す */
  let looking = $state(false);
  let linking = $state(false);
  let facing = $state<Facing>('user');
  let stream = $state<MediaStream>();
  let video = $state<HTMLVideoElement>();
  let wanted = $state.raw<Wanted>();
  /** やめたあとにカメラが開いたり、つながったりしても、拾わずに閉じる */
  let alive = true;

  const step = $derived(role === 'host' ? (looking ? 2 : 1) : looking ? 1 : 2);

  // カメラの映像が画面に出ているあいだだけ読む
  $effect(() => {
    if (!video || !wanted) return;
    const { match, connect } = wanted;
    video.srcObject = stream ?? null;
    return scan(video, match, (text) => {
      looking = false;
      linking = true;
      connect(text).catch(() => {
        closeCamera(stream);
        onfail('つながりませんでした。おなじ Wi-Fi に いるか たしかめてね');
      });
    });
  });

  function done(link: Link) {
    closeCamera(stream);
    if (alive) onlink(link);
    else link.close();
  }

  onMount(async () => {
    try {
      // 接続情報を作る前にカメラを開く。許可がないと自分のアドレスが伏せられ、つながらないことがある
      const opened = await openCamera(facing);
      if (!alive) return closeCamera(opened);
      stream = opened;
    } catch {
      onfail('カメラを つかえませんでした');
      return;
    }
    if (role === 'host') {
      const offer = await host();
      code = offer.code;
      wanted = { match: isAnswer, connect: async (text) => done(await offer.accept(text)) };
    } else {
      looking = true;
      wanted = {
        match: isOffer,
        connect: async (text) => {
          const answer = await join(text);
          code = answer.code;
          done(await answer.link);
        }
      };
    }
  });

  async function turn() {
    facing = facing === 'user' ? 'environment' : 'user';
    closeCamera(stream);
    stream = await openCamera(facing);
  }

  onDestroy(() => {
    alive = false;
    closeCamera(stream);
  });
</script>

{#if looking}
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
  <p role="status">{linking ? 'つないでいます…' : 'じゅんびちゅう…'}</p>
{/if}

<style>
  .step {
    font-size: clamp(17px, 3vmin, 24px);
    font-weight: 800;
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
