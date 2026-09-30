<script lang="ts">
  import type { Work } from './book';
  import { LINE, TEMPLATES, type Template } from './templates';

  let {
    works,
    ontemplate,
    onwork,
    onphoto,
    onremove
  }: {
    works: Work[];
    ontemplate: (t: Template) => void;
    onwork: (w: Work) => void;
    onphoto: () => void;
    onremove: (w: Work) => void;
  } = $props();

  /** 押し間違いで消えないよう、「けす」を押しているあいだだけ作品を消せる */
  let erasing = $state(false);
</script>

<div class="picker">
  <h2 class="yuru">どれを ぬる？</h2>
  <ul class="grid">
    {#each TEMPLATES as t (t.id)}
      <li>
        <button class="card" aria-label={t.name} onclick={() => ontemplate(t)}>
          <svg viewBox="0 0 100 100">
            <path
              d={t.d}
              fill="none"
              stroke="#3b2f2a"
              stroke-width={LINE}
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span>{t.name}</span>
        </button>
      </li>
    {/each}
    <li>
      <button class="card photo" onclick={onphoto}><span>しゃしんから つくる</span></button>
    </li>
  </ul>
  {#if works.length}
    <div class="book-head">
      <h2 class="yuru">ぬりえちょう</h2>
      <button class="pill" aria-pressed={erasing} onclick={() => (erasing = !erasing)}>
        {erasing ? 'けしおわる' : 'けす'}
      </button>
    </div>
    <ul class="grid">
      {#each works as w (w.id)}
        <li>
          <button
            class="card"
            class:erasing
            aria-label={erasing ? 'この さくひんを けす' : 'つづきから ぬる'}
            onclick={() => (erasing ? onremove(w) : onwork(w))}
          >
            <img src={w.thumb} alt="" width="200" height="200" />
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .picker {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom));
    overflow-y: auto;
    touch-action: pan-y;
    background: var(--paper-dots), var(--paper);
    color: var(--line);
  }

  h2 {
    font-size: clamp(22px, min(4cqh, 7cqw), 36px);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(clamp(110px, 22cqw, 180px), 1fr));
    gap: 12px;
    list-style: none;
  }

  .card {
    display: grid;
    place-items: center;
    gap: 4px;
    width: 100%;
    aspect-ratio: 1;
    padding: 8px;
    border: 3px solid var(--line);
    border-radius: 16px;
    background: #fff;
    box-shadow: var(--soft-shadow);
    color: var(--line);
    font-weight: 800;
    cursor: pointer;
  }

  .card svg,
  .card img {
    width: 78%;
    height: auto;
  }

  .card img {
    width: 100%;
    border-radius: 10px;
  }

  .card.photo {
    background: var(--pastel-gold);
  }

  .card.erasing {
    outline: 4px dashed var(--p2);
  }

  .book-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
</style>
