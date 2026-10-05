<script lang="ts">
  import type { CoopGuest, CoopHost, Outcome, Pauser } from './coop';
  import Pause from './Pause.svelte';
  import { loadRecords } from './records';
  import Result from './Result.svelte';
  import { summary, type World } from './world';

  /** ふたりで遊ぶ画面の上に重ねるもの。抜ける ✕・一時停止・相手を待つ帯・リザルト */
  let {
    me,
    side,
    world,
    paused,
    waiting,
    result,
    locked,
    busy,
    onend,
    onquit,
    onagain
  }: {
    me: 'host' | 'guest';
    side: CoopHost | CoopGuest | null | undefined;
    world: World;
    paused: Pauser;
    waiting: string;
    result: Outcome | null;
    /** 倒れた指が離れるまで、リザルトを押せなくする */
    locked: boolean;
    /** 3 択や宝箱を出しているあいだは一時停止を出さない */
    busy: boolean;
    onend: () => void;
    /** この回を抜ける（親は 2 人ともの回を終え、子は自分だけ抜ける） */
    onquit: () => void;
    onagain?: () => void;
  } = $props();

  /** ✕ は 1 回めで確かめ、もう一度押すとやめる（親の端末が眠っても子が抜けられるように、いつでも出す） */
  let sure = $state(false);
</script>

{#if !result}
  <button class="round quit" data-quit onclick={() => (sure ? onquit() : (sure = true))} aria-label="やめる"
    >{sure ? 'やめる？' : '✕'}</button
  >
{/if}
{#if !result && !world.over && !paused && !busy}
  <button class="as-pause" onclick={() => side?.pause()} aria-label="一時停止">Ⅱ</button>
{/if}
{#if paused === me}
  <Pause
    run={summary(world)}
    finger={null}
    restart={false}
    onresume={() => side?.resume()}
    onrestart={() => {}}
    {onquit}
  />
{:else if paused}
  <p class="note">なかまが とめています</p>
{/if}
{#if waiting}<p class="note">{waiting}</p>{/if}
{#if result}
  <Result
    run={result.run}
    got={result.got}
    total={loadRecords().coins}
    {locked}
    again={!!onagain}
    onagain={() => onagain?.()}
    onselect={onend}
  />
{/if}

<style>
  .quit {
    position: absolute;
    top: max(12px, env(safe-area-inset-top));
    right: max(12px, env(safe-area-inset-right));
    z-index: 6;
    width: auto;
    min-width: 44px;
    padding: 0 10px;
  }

  .note {
    position: absolute;
    top: 30%;
    left: 50%;
    margin: 0;
    padding: 6px 14px;
    translate: -50% 0;
    background: rgb(36 21 31 / 0.8);
    color: #fff3d6;
    font-weight: 800;
    pointer-events: none;
  }
</style>
