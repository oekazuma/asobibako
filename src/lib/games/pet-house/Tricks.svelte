<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { kindOf, trickName, trickSteps, tricksFor, type Pet } from './engine';
  import type { TrickId } from './types';
  import { HELP } from './voice';

  let { pet, ontrick, onteach }: { pet: Pet; ontrick: (trick: TrickId) => void; onteach: (trick: TrickId) => void } =
    $props();

  const kind = $derived(kindOf(pet.breed));
</script>

<p class="lead">できたら すぐに なでて ほめてあげよう。「おしえる」は おんがくに あわせて おしえるよ</p>
<div class="list">
  {#each tricksFor(kind) as trick (trick.id)}
    {@const done = pet.tricks[trick.id] ?? 0}
    {@const steps = trickSteps(trick, kind)}
    <div class="tile">
      <button class="pet-choice trick" class:learned={done >= steps} onclick={() => ontrick(trick.id)}>
        <span class="name">{trickName(trick, kind)}</span>
        <span class="sr-only">おぼえた ぐあい {Math.min(done, steps)} / {steps}</span>
        <span class="steps">
          {#each { length: steps }, i (i)}
            <span class="step" class:dim={i >= done}><Icon name="star" /></span>
          {/each}
        </span>
        {#if done >= steps}
          <span class="badge"><Icon name="check" />おぼえた</span>
        {/if}
      </button>
      <button class="teach" onclick={() => onteach(trick.id)}>
        <Icon name="paw" size="16px" />おしえる
      </button>
    </div>
  {/each}
</div>
<details class="voice">
  <summary><Icon name="speaker" size="20px" />こえで できること</summary>
  <p>「こえ」の ボタンを おしながら はなしてね。なまえを よぶと その子が するよ</p>
  <ul>
    {#each HELP as h (h.action)}
      <li><b>{h.say.map((w) => `「${w}」`).join('')}</b>{h.does}</li>
    {/each}
  </ul>
</details>

<style>
  .lead {
    margin-bottom: 12px;
    font-size: 15px;
    font-weight: 700;
    text-align: center;
  }

  .list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 12px;
  }

  .tile {
    display: grid;
    gap: 6px;
  }

  .trick {
    position: relative;
  }

  .learned {
    background: #fff4cc;
  }

  .name {
    font-size: 19px;
  }

  .steps {
    display: flex;
    gap: 2px;
    font-size: 16px;
  }

  .dim {
    opacity: 0.25;
    filter: grayscale(1);
  }

  .badge {
    position: absolute;
    top: -10px;
    right: -6px;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 2px 8px 2px 4px;
    border: 2px solid var(--line);
    border-radius: 999px;
    background: var(--pastel-gold);
    font-size: 12px;
  }

  .teach {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 6px 8px;
    border: 2px solid var(--line);
    border-radius: 999px;
    background: var(--pastel-p1);
    color: var(--line);
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
  }

  .teach:active {
    translate: 0 2px;
  }

  .voice {
    margin-top: 16px;
    padding: 10px 14px;
    border: 3px solid var(--line);
    border-radius: 20px;
    background: #fff;
    font-weight: 700;
  }

  .voice summary {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 17px;
    font-weight: 800;
    cursor: pointer;
  }

  .voice p {
    margin: 8px 0;
    font-size: 14px;
  }

  .voice ul {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 4px 16px;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 15px;
  }

  .voice b {
    margin-right: 6px;
  }
</style>
