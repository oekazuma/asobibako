<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { Settle } from '$lib/settle.svelte';
  import Arena from './Arena.svelte';
  import type { Entry } from './arena-draw';
  import Ladder from './Ladder.svelte';
  import type { Look } from './looks';
  import { portrait } from './paint';
  import Pick from './Pick.svelte';
  import { lineup, RIVAL_CHEER, ROUND_NAMES } from './rivals';
  import type { Doodle } from './stock';

  let { doodles, look, onclose }: { doodles: Doodle[]; look: Look; onclose: () => void } = $props();

  type Mode = 'duo' | 'solo' | 'cup';
  const NAMES: Record<Mode, string[]> = {
    duo: ['1P の こ', '2P の こ'],
    solo: ['きみの こ', 'あいての こ'],
    cup: ['きみの こ']
  };
  /** ひとりで 2 体を戦わせるときの、あいての応援の速さ */
  const SOLO_CHEER = 3.2;

  let mode = $state<Mode>('duo');
  let phase = $state<'menu' | 'pick' | 'ladder' | 'fight' | 'result'>('menu');
  let picked = $state.raw<Entry[]>([]);
  let rivals = $state.raw<Entry[]>([]);
  let round = $state(0);
  let winner = $state<0 | 1>(0);
  /** 同じ顔ぶれでもう 1 戦するとき、Arena を作り直すための番号 */
  let bout = $state(0);
  const settle = new Settle();

  const entries = $derived<[Entry, Entry]>(mode === 'cup' ? [picked[0], rivals[round]] : [picked[0], picked[1]]);
  const cleared = $derived(mode === 'cup' && winner === 0 && round === rivals.length - 1);
  const headline = $derived(
    mode === 'duo'
      ? `${winner ? '2P' : '1P'} の かち！`
      : winner
        ? 'まけちゃった…'
        : cleared
          ? 'ゆうしょう！'
          : mode === 'cup'
            ? `${ROUND_NAMES[round]} とっぱ！`
            : 'かった！'
  );

  function begin(next: Mode) {
    mode = next;
    picked = [];
    phase = 'pick';
  }

  function pick(d: Doodle) {
    picked = [...picked, { name: NAMES[mode][picked.length], strokes: d.strokes }];
    if (picked.length < NAMES[mode].length) return;
    if (mode === 'cup') {
      rivals = lineup();
      round = 0;
      phase = 'ladder';
    } else fight();
  }

  function fight() {
    bout += 1;
    phase = 'fight';
  }

  function end(w: 0 | 1) {
    winner = w;
    phase = 'result';
    settle.begin();
  }

  function next() {
    if (cleared) {
      rivals = lineup();
      round = 0;
    } else round += 1;
    phase = 'ladder';
  }

  onMount(settle.listen);
</script>

{#if phase === 'fight'}
  {#key bout}
    <Arena {entries} {look} duo={mode === 'duo'} cpu={mode === 'cup' ? RIVAL_CHEER[round] : SOLO_CHEER} onend={end} />
  {/key}
{:else}
  <div class="screen" class:settling={settle.active}>
    {#if phase === 'menu'}
      <h2 class="yuru">バトル</h2>
      <p>ずかんの こが じどうで たたかうよ。ボタンを れんだして おうえんしよう！</p>
      <div class="modes">
        <button class="pill p1" onclick={() => begin('duo')}>ふたりで たいせん</button>
        <button class="pill p2" onclick={() => begin('solo')}>ひとりで たいせん</button>
        <button class="pill gold" onclick={() => begin('cup')}>トーナメント</button>
      </div>
    {:else if phase === 'pick'}
      <Pick title={`${NAMES[mode][picked.length]}を えらんでね`} {doodles} {look} onpick={pick} />
    {:else if phase === 'ladder'}
      <Ladder me={picked[0]} {rivals} {round} {look} onfight={fight} />
    {:else}
      {#if cleared}
        <Icon name="trophy" size="72px" />
      {/if}
      <h2 class="yuru">{headline}</h2>
      <img src={portrait(entries[winner].strokes, look)} style:background={look.bg} width="160" height="160" alt="" />
      <div class="modes">
        {#if mode !== 'cup'}
          <button class="pill p2" onclick={fight}>もういちど</button>
          <button class="pill" onclick={() => begin(mode)}>えらびなおす</button>
        {:else if winner === 0}
          <button class="pill gold" onclick={next}>{cleared ? 'さいしょから' : 'つぎへ'}</button>
        {:else}
          <button class="pill p2" onclick={fight}>もういちど</button>
        {/if}
      </div>
    {/if}
    <button class="pill back" onclick={phase === 'menu' ? onclose : () => (phase = 'menu')}>もどる</button>
  </div>
{/if}

<style>
  .screen {
    position: absolute;
    inset: 0;
    z-index: 3;
    padding: 72px 16px max(24px, env(safe-area-inset-bottom));
    overflow-y: auto;
    touch-action: pan-y;
    background: var(--paper-dots), var(--paper);
    color: var(--line);
    text-align: center;
  }

  .settling {
    pointer-events: none;
  }

  h2 {
    margin: 0 0 12px;
  }

  p {
    margin: 0 auto 20px;
    max-width: 30em;
  }

  .modes {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    margin-bottom: 20px;
  }

  img {
    width: min(50cqw, 240px);
    height: auto;
    margin: 8px auto 20px;
    border-radius: 24px;
  }

  .back {
    margin-top: 12px;
  }
</style>
