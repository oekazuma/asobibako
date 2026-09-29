<script lang="ts">
  import type { Level } from './chart';
  import { bonusOf, recordKey, THEMES, type Save } from './outfits';
  import { SONGS } from './songs';

  /** きょうの曲とむずかしさを選ぶ。まだ遊べない曲は、あと何人のファンで遊べるかを見せる */
  let { save, onsong, onlevel }: { save: Save; onsong: (id: string) => void; onlevel: (level: Level) => void } =
    $props();

  const LEVELS: { id: Level; name: string }[] = [
    { id: 'easy', name: 'かんたん' },
    { id: 'normal', name: 'ふつう' }
  ];

  const best = $derived(save.records[recordKey(save.song, save.level)]);
</script>

<section class="card">
  <p class="label">きょうの きょく</p>
  <div class="songs">
    {#each SONGS as s (s.id)}
      {@const open = save.fans >= s.fans}
      <button
        class="song"
        style:--c={THEMES[s.theme].color}
        aria-pressed={save.song === s.id}
        disabled={!open}
        onclick={() => onsong(s.id)}
      >
        <span class="title">{open ? s.title : `ファン ${s.fans}にんで`}</span>
        <span class="theme">{THEMES[s.theme].name}</span>
        {#if save.song === s.id}<span class="bonus">コーデ +{Math.round(bonusOf(save.coord, s.theme) * 100)}%</span
          >{/if}
      </button>
    {/each}
  </div>
  <div class="foot">
    <div class="levels">
      {#each LEVELS as l (l.id)}
        <button class="level" aria-pressed={save.level === l.id} onclick={() => onlevel(l.id)}>{l.name}</button>
      {/each}
    </div>
    <p class="best">
      {#if best}ハイスコア <b>{best.score.toLocaleString()}</b> ランク <b>{best.rank}</b>{:else}まだ きろく なし{/if}
    </p>
  </div>
</section>

<style>
  .card {
    display: grid;
    gap: 8px;
    padding: 10px 14px;
    border: 3px solid var(--line);
    border-radius: 18px;
    background: #fff;
    font-size: clamp(13px, min(1.9cqh, 3.6cqw), 20px);
  }

  p {
    margin: 0;
  }

  .label {
    font-size: 0.8em;
  }

  .songs {
    display: grid;
    gap: 6px;
  }

  .song {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 12px;
    padding: 6px 12px;
    border: 3px solid var(--line);
    border-radius: 14px;
    background: #fff;
    color: var(--line);
    text-align: left;
  }

  .song[aria-pressed='true'] {
    background: color-mix(in srgb, var(--c) 18%, #fff);
    outline: 4px solid var(--c);
  }

  .song:disabled {
    opacity: 0.55;
    filter: grayscale(0.7);
  }

  .title {
    font-weight: 800;
    font-size: 1.25em;
  }

  .theme {
    padding: 1px 10px;
    border-radius: 999px;
    background: var(--c);
    color: #fff;
    font-weight: 800;
    font-size: 0.85em;
  }

  .bonus {
    color: #ff5c9a;
    font-weight: 800;
  }

  .foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 6px 12px;
  }

  .levels {
    display: flex;
    gap: 6px;
  }

  .level {
    padding: 4px 14px;
    border: 3px solid var(--line);
    border-radius: 999px;
    background: #fff;
    color: var(--line);
    font-weight: 800;
  }

  .level[aria-pressed='true'] {
    background: var(--pastel-gold);
  }

  .best b {
    color: #ff5c9a;
  }
</style>
