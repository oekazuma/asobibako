<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import type { SoloProps } from '$lib/games';
  import { animate } from '$lib/loop';
  import { BathPlay } from './bath.svelte';
  import BathHud from './BathHud.svelte';
  import { BREEDS } from './breeds';
  import { ContestPlay } from './contest-play.svelte';
  import ContestHud from './ContestHud.svelte';
  import { kindOf, SHOP } from './engine';
  import Loading from './Loading.svelte';
  import Menu, { type Panel } from './Menu.svelte';
  import Panels from './Panels.svelte';
  import PetCard from './PetCard.svelte';
  import { Plaza } from './plaza.svelte';
  import PlazaHud from './PlazaHud.svelte';
  import { Session } from './session.svelte';
  import Sky from './Sky.svelte';
  import Tools from './Tools.svelte';
  import { createInput } from './touch';
  import { WalkPlay } from './walk.svelte';
  import WalkHud from './WalkHud.svelte';

  let { onhint }: SoloProps = $props();

  /** 3D の部屋と、その上にハートやキラキラを重ねる 2D の canvas */
  let gl: HTMLCanvasElement;
  let fx: HTMLCanvasElement;
  let session = $state<Session>();
  let panel = $state<Panel | null>(null);
  $effect(() => {
    if (session) session.covered = panel !== null;
  });
  /** 3D の組み立て（毛並み・部屋のテクスチャ）は数百 ms 画面を止めるので、そのあいだ出す */
  let loading = $state(true);
  const input = createInput(() => session);

  const pet = $derived(session?.current);
  const kind = $derived(pet ? kindOf(pet.breed) : 'dog');
  const toys = $derived(
    session?.save.toys.filter((id) => {
      const k = SHOP.find((i) => i.id === id)?.kind;
      return !k || k === kind;
    }) ?? []
  );

  function resize() {
    const [w, h] = input.px(1, 1);
    session?.resize(w, h);
  }

  onMount(() => {
    let s: Session | undefined;
    let stop = () => {};
    let frames = 0;
    // 「よみこみちゅう」を 1 度描かせてから重い組み立てに入る（同じフレームで組み立てると表示が出ない）
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        s = new Session(gl, fx, (text) => onhint?.(text));
        session = s;
        resize();
        // 1 匹目はふれあいひろばでえらぶ
        if (!s.current) s.visit(new Plaza(), 'ふれあいひろばへ いくよ');
        stop = animate((dt) => {
          s!.frame(dt);
          // 最初の数フレームはシェーダーの準備で止まりがちなので、落ち着いてから外す
          if (loading && !s!.busy && ++frames > 3) loading = false;
        });
      });
    });
    return () => {
      cancelAnimationFrame(raf);
      stop();
      s?.dispose();
    };
  });
</script>

<div class="house">
  <!-- 画面の部品は盤面の外に置く。盤面の pointerdown は preventDefault するので、中に置くと入力欄に文字を打てない -->
  <div class="scene" use:input.board={resize} role="application" aria-label="わんにゃんハウスの へや">
    <canvas bind:this={gl}></canvas>
    <canvas bind:this={fx}></canvas>
  </div>
  {#if session}
    {#if session.activity}
      <!-- 遊びのモードのあいだは、ふだんのメニューと道具のかわりにモードの HUD だけを出す -->
      {#if session.activity instanceof ContestPlay}
        <ContestHud play={session.activity} ontrick={(t) => session?.trick(t)} />
      {:else if session.activity instanceof Plaza}
        <PlazaHud plaza={session.activity} {session} />
      {:else if session.activity instanceof WalkPlay}
        <WalkHud walk={session.activity} />
      {:else if session.activity instanceof BathPlay}
        <BathHud play={session.activity} />
      {/if}
    {:else if pet}
      <PetCard {pet} money={session.save.money} />
      <Sky sky={session.sky} />
      {#if session.save.pets.length > 1}
        <div class="faces">
          {#each session.save.pets as p (p.id)}
            <button
              class="face"
              class:on={p.id === pet.id}
              style:background={BREEDS[p.breed].color}
              aria-label="{p.name}の おせわを する"
              aria-pressed={p.id === pet.id}
              onclick={() => session?.select(p.id)}
            >
              <Icon name={BREEDS[p.breed].kind} size="80%" />
            </button>
          {/each}
        </div>
      {/if}
      <Tools
        tool={session.tool}
        toy={session.toy}
        {toys}
        onpick={(tool, toy) => session?.setTool(tool, toy)}
        onphoto={() => session?.photo()}
        {session}
      />
      <Menu
        scene={session.scene}
        {kind}
        onopen={(p) => (panel = p)}
        oncall={() => session?.call()}
        onwalk={() => session?.walk()}
      />
    {/if}
    <Panels {session} {kind} bind:panel />
  {/if}
  {#if loading}
    <Loading />
  {:else if session?.moving}
    <Loading title="いどうちゅう…" note={session.moving} />
  {/if}
</div>

<style>
  .house,
  .scene {
    position: absolute;
    inset: 0;
    overflow: hidden;
    touch-action: none;
  }

  .house {
    background: #f3e2c8;
  }

  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .faces {
    position: absolute;
    top: 50%;
    right: max(10px, env(safe-area-inset-right));
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 10px;
    translate: 0 -50%;
  }

  .face {
    display: grid;
    place-items: center;
    width: clamp(44px, min(6.5cqh, 12cqw), 64px);
    aspect-ratio: 1;
    border: 3px solid var(--line);
    border-radius: 50%;
    box-shadow: var(--soft-shadow);
    opacity: 0.7;
    cursor: pointer;
  }

  .face.on {
    outline: 4px solid var(--pastel-gold);
    opacity: 1;
  }
</style>
