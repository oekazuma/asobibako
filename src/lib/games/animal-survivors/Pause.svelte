<script lang="ts">
  import { onDestroy } from 'svelte';
  import { audio, toggleMute } from '$lib/audio.svelte';
  import { itemArt } from './art/evolved';
  import { clock } from './hud';
  import { Lock } from './lock.svelte';
  import PixelIcon from './PixelIcon.svelte';
  import { WEAPONS } from './weapons';
  import type { RunSummary } from './world';

  let {
    run,
    finger,
    onresume,
    onrestart,
    onquit
  }: {
    run: RunSummary;
    /** 開いたときに残っていたスティックの指 */
    finger: number | null;
    onresume: () => void;
    onrestart: () => void;
    onquit: () => void;
  } = $props();

  let asking = $state<'restart' | 'quit' | null>(null);
  // 確かめの「やめる」はメニューの「やめる」と近い位置に出るので、2 度押しで決まらないよう少し止める。
  // スティックを親指で押さえたまま開いたときは、その指を離した合成 click もメニューと確かめで受けない
  const lock = new Lock();
  // svelte-ignore state_referenced_locally
  lock.begin(finger);
  onDestroy(() => lock.stop());

  function ask(what: 'restart' | 'quit') {
    asking = what;
    lock.begin(finger);
  }

  /** 延長戦では自分で終えるとコインを全部もらえるので、やめるを引き上げると呼ぶ */
  const quit = $derived(run.overtime ? '引き上げる' : 'やめる');
  const owned = $derived([
    ...run.weapons.map((o) => ({ ...o, key: `weapon-${o.id}`, star: WEAPONS[o.id]?.evolved ?? false })),
    ...run.passives.map((o) => ({ ...o, key: `passive-${o.id}`, star: false }))
  ]);
</script>

<svelte:window onpointerup={(e) => lock.lift(e.pointerId)} onpointercancel={(e) => lock.lift(e.pointerId)} />

<div class="veil">
  {#if asking}
    <section class="as-panel" class:as-locked={lock.active} aria-label="確かめ">
      <h2 class="as-title">{asking === 'quit' ? `${quit}？` : 'やり直す？'}</h2>
      <p class="note">
        {asking === 'quit'
          ? `本当に${run.overtime ? '引き上げますか' : 'やめますか'}？`
          : '本当に最初からやり直しますか？'}<br />{run.overtime
          ? '延長戦のコインは全部もらえます'
          : 'ここまでのコインと記録は残ります'}
      </p>
      <button class="as-card danger" onclick={asking === 'quit' ? onquit : onrestart}
        >{asking === 'quit' ? quit : 'やり直す'}</button
      >
      <button class="as-card" onclick={() => (asking = null)}>つづける</button>
    </section>
  {:else}
    <section class="as-panel" class:as-locked={lock.active} aria-label="ポーズ">
      <h2 class="as-title">ポーズ</h2>
      <p class="now"><span>{clock(run.time)}</span><span>Lv.{run.level}</span><span>コイン {run.coins}</span></p>
      <ul class="owned" aria-label="取った武器とパッシブ">
        {#each owned as o (o.key)}
          <li class="slot">
            <PixelIcon art={itemArt(o.key)} size="min(8cqw, 4.6cqh, 40px)" /><span class="lv"
              >{o.star ? '★' : o.level}</span
            >
          </li>
        {/each}
      </ul>
      <button class="as-card" onclick={onresume}>つづける</button>
      <button class="as-card" onclick={toggleMute}>音 {audio.muted ? 'オフ' : 'オン'}</button>
      <button class="as-card" onclick={() => ask('restart')}>最初からやり直す</button>
      <button class="as-card" onclick={() => ask('quit')}>{quit}</button>
    </section>
  {/if}
</div>

<style>
  .veil {
    position: absolute;
    inset: 0;
    z-index: 6;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgb(20 10 30 / 0.7);
    color: #fff3d6;
    font-weight: 800;
  }

  .as-card {
    justify-content: center;
    font-size: min(4.6cqw, 2.8cqh, 24px);
  }

  .danger {
    background: #ffb4a8;
  }

  .now {
    display: flex;
    gap: 1.2em;
    justify-content: center;
  }

  .now,
  .note {
    margin: 0;
    text-align: center;
    font-size: min(4cqw, 2.4cqh, 20px);
  }

  .owned {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .slot {
    position: relative;
    padding: 3px;
    background: #1f1530;
  }

  .lv {
    position: absolute;
    right: 2px;
    bottom: 0;
    color: #ffd84a;
    font-size: min(3cqw, 1.8cqh, 14px);
    text-shadow: 1px 1px 0 #24151f;
  }
</style>
