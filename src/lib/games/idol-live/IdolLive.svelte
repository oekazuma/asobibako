<script lang="ts">
  import type { SoloProps } from '$lib/games';
  import Dress from './Dress.svelte';
  import type { Result } from './judge';
  import Live from './Live.svelte';
  import LiveResult from './LiveResult.svelte';
  import { better, bonusOf, fansOf, load, store, unlockedBetween, type Slot, type Theme } from './outfits';
  import { THEME } from './song';

  // クリアのない自由あそび（じゅんび → ライブ → けっか をくり返す）なので、シェルの onfinish は呼ばない
  const _props: SoloProps = $props();

  const save = $state(load());
  let screen = $state<'dress' | 'live'>('dress');
  let round = $state(0);
  let reward = $state<{
    result: Result;
    fans: number;
    record: boolean;
    unlocked: { theme: Theme; slot: Slot }[];
  } | null>(null);

  function start() {
    store(save);
    reward = null;
    round += 1;
    screen = 'live';
  }

  function finish(result: Result) {
    const fans = fansOf(result.score);
    const unlocked = unlockedBetween(save.fans, save.fans + fans);
    const record = result.score > save.best;
    save.fans += fans;
    save.best = Math.max(save.best, result.score);
    save.bestRank = better(save.bestRank, result.rank);
    save.lives += 1;
    store(save);
    reward = { result, fans, record, unlocked };
  }
</script>

{#if screen === 'dress'}
  <Dress {save} onwear={(slot, theme) => (save.coord[slot] = theme)} onstart={start} />
{:else}
  {#key round}
    <Live coord={{ ...save.coord }} bonus={bonusOf(save.coord, THEME)} onend={finish} />
  {/key}
  {#if reward}
    <LiveResult
      {...reward}
      onagain={start}
      ondress={() => {
        reward = null;
        screen = 'dress';
      }}
    />
  {/if}
{/if}
