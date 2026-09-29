<script lang="ts">
  import { onMount } from 'svelte';
  import { Settle } from '$lib/settle.svelte';
  import Arena from './Arena.svelte';
  import type { Entry } from './arena-draw';
  import BattleMenu, { type Mode } from './BattleMenu.svelte';
  import BattleResult from './BattleResult.svelte';
  import Ladder from './Ladder.svelte';
  import type { Look } from './looks';
  import PickFighter from './PickFighter.svelte';
  import { lineup, RIVAL_CHEER, ROUND_NAMES } from './rivals';
  import type { Doodle } from './stock';
  import Versus from './Versus.svelte';

  let { doodles, look, onclose }: { doodles: Doodle[]; look: Look; onclose: () => void } = $props();

  const NAMES: Record<Mode, string[]> = {
    duo: ['1P の こ', '2P の こ'],
    solo: ['きみの こ', 'あいての こ'],
    cup: ['きみの こ']
  };
  /** ひとりで 2 体を戦わせるときの、あいての応援の速さ */
  const SOLO_CHEER = 3.2;

  let mode = $state<Mode>('duo');
  let phase = $state<'menu' | 'pick' | 'ladder' | 'versus' | 'fight' | 'result'>('menu');
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

  /** 顔ぶれを見せてから戦う */
  function fight() {
    bout += 1;
    phase = 'versus';
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

{#if phase === 'versus'}
  <Versus
    {entries}
    {look}
    note={mode === 'cup' ? ROUND_NAMES[round] : ''}
    flip={mode === 'duo'}
    ondone={() => (phase = 'fight')}
  />
{:else if phase === 'fight'}
  {#key bout}
    <Arena {entries} {look} duo={mode === 'duo'} cpu={mode === 'cup' ? RIVAL_CHEER[round] : SOLO_CHEER} onend={end} />
  {/key}
{:else}
  <!-- 2P の子は向かいの人が選ぶので、画面ごと向かいへ向ける -->
  <div
    class="screen"
    class:settling={settle.active}
    class:flip={phase === 'pick' && mode === 'duo' && picked.length === 1}
  >
    {#if phase === 'menu'}
      <BattleMenu onpick={begin} />
    {:else if phase === 'pick'}
      {#key picked.length}
        <PickFighter title={`${NAMES[mode][picked.length]}を えらんでね`} {doodles} {look} battle onpick={pick} />
      {/key}
    {:else if phase === 'ladder'}
      <Ladder me={picked[0]} {rivals} {round} {look} onfight={fight} />
    {:else}
      <BattleResult {headline} winner={entries[winner].strokes} {look} trophy={cleared} duo={mode === 'duo'}>
        {#if mode !== 'cup'}
          <button class="pill p2" onclick={fight}>もういちど</button>
          <button class="pill" onclick={() => begin(mode)}>えらびなおす</button>
        {:else if winner === 0}
          <button class="pill gold" onclick={next}>{cleared ? 'さいしょから' : 'つぎへ'}</button>
        {:else}
          <button class="pill p2" onclick={fight}>もういちど</button>
        {/if}
      </BattleResult>
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

  .flip {
    rotate: 180deg;
  }

  .back {
    margin-top: 12px;
  }
</style>
