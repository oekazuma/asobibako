<script lang="ts">
  import type { SoloProps } from '$lib/games';
  import Dress from './Dress.svelte';
  import type { Result } from './judge';
  import Live from './Live.svelte';
  import LiveResult from './LiveResult.svelte';
  import { bonusOf, fansOf, load, NAMES, record, store, unlockedBetween } from './outfits';
  import { SONGS, trackOf } from './songs';

  // クリアのない自由あそび（じゅんび → ライブ → けっか をくり返す）なので、シェルの onfinish は呼ばない
  let { onhint }: SoloProps = $props();

  /** 知らせは、はじめの 3 回のライブだけ出す */
  const COACHED = 3;

  const save = $state(load(SONGS.map((s) => s.id)));
  const track = $derived(trackOf(save.song));
  let screen = $state<'dress' | 'live'>('dress');
  let round = $state(0);
  let reward = $state<{
    result: Result;
    fans: number;
    record: boolean;
    news: string[];
  } | null>(null);

  function start() {
    store(save);
    reward = null;
    round += 1;
    screen = 'live';
  }

  function finish(result: Result) {
    const fans = fansOf(result.score);
    const news = [
      ...unlockedBetween(save.fans, save.fans + fans).map(
        (u) => `あたらしい いしょう「${NAMES[u.theme][u.slot]}」を てにいれた！`
      ),
      ...SONGS.filter((s) => s.fans > save.fans && s.fans <= save.fans + fans).map(
        (s) => `あたらしい きょく「${s.title}」が あそべるように なった！`
      )
    ];
    save.fans += fans;
    save.lives += 1;
    const best = record(save, result.score, result.rank);
    store(save);
    reward = { result, fans, record: best, news };
  }
</script>

{#if screen === 'dress'}
  <Dress
    {save}
    onwear={(slot, theme) => (save.coord[slot] = theme)}
    onsong={(id) => (save.song = id)}
    onlevel={(level) => (save.level = level)}
    onstart={start}
  />
{:else}
  {#key round}
    <Live
      setup={{
        track,
        coord: { ...save.coord },
        bonus: bonusOf(save.coord, track.def.theme),
        notes: track.charts[save.level],
        coach: save.lives < COACHED
      }}
      onend={finish}
      {onhint}
    />
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
