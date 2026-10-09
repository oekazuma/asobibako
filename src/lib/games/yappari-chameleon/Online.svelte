<script lang="ts">
  import { onMount } from 'svelte';
  import { bus } from '$lib/audio.svelte';
  import { Loop } from '$lib/music/loop';
  import type { Party } from '$lib/net/party.svelte';
  import { pick } from './bgm';
  import type { Host } from './host';
  import Overlay from './Overlay.svelte';
  import { Play } from './play.svelte';
  import { Session, type Inbox } from './session.svelte';
  import { SONGS } from './songs';
  import { mount3d, pad } from './stage3d';
  import './stage3d.css';

  let {
    party,
    host,
    inbox,
    onleave
  }: { party: Party; host: Host | null; inbox: Inbox | null; onleave: (note?: string) => void } = $props();
  let canvas: HTMLCanvasElement;
  let box: HTMLDivElement;
  let portrait = $state(false);
  let failed = $state(false);
  let session = $state.raw<Session | null>(null);
  const radius = 70;
  const loop = new Loop(bus);

  $effect(() => {
    const t = pick(session?.match.phase ?? 'lobby', session?.play.mode ?? 'walk');
    loop.play(t.song, t.bpm, t.gain);
  });

  onMount(() => {
    // 曲はフェーズで急に替わるので、出だしの音の計算で詰まらないよう先に作っておく
    loop.warm(SONGS.hide.song);
    loop.warm(SONGS.search.song);
    // 曲は AudioContext の時計で 0.5 秒先まで予約するので、描画とは別に 0.1 秒ごとに足せば足りる
    const id = setInterval(() => loop.tick(), 100);
    return () => {
      clearInterval(id);
      loop.stop();
    };
  });

  onMount(() =>
    mount3d(canvas, box, {
      ready: (world, makeRig) => {
        session = new Session(party, new Play(world, radius), makeRig, host, inbox ?? undefined);
        if (import.meta.env.DEV) {
          const w = window as unknown as { __chameleon?: Play; __session?: Session };
          w.__chameleon = session.play;
          w.__session = session;
        }
      },
      frame: (dt, now) => session?.frame(dt, now),
      interrupt: () => session?.play.interrupt(),
      restore: () => session?.restore(),
      fail: () => (failed = true),
      portrait: (on) => (portrait = on),
      dispose: () => session?.dispose()
    })
  );

  // 親は子の回線を閉じられないので、版ちがいを知らされた子が自分で抜ける
  $effect(() => {
    if (session?.mismatch) onleave('アプリの版が違います。どちらも最新版にしてください');
  });
</script>

<div class="chameleon" bind:this={box}>
  <canvas bind:this={canvas}></canvas>
  <div
    class="pad"
    role="presentation"
    {...pad(
      () => session?.play,
      () => box
    )}
  ></div>
  {#if session}
    <Overlay {session} {radius} center={() => [box.clientWidth / 2, box.clientHeight / 2]} onleave={() => onleave()} />
  {:else if failed}
    <div class="notice failed">
      <p>この端末では 3D を表示できません</p>
      <button onclick={() => onleave()}>入口へ</button>
    </div>
  {:else}
    <p class="notice">準備中…</p>
  {/if}
  {#if portrait}
    <p class="notice cover">横向きにしてください</p>
  {/if}
</div>
