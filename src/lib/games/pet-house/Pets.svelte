<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { BREEDS } from './breeds';
  import { adoptPrice, hearts, MAX_PETS, SHOP, type Pet, type Save } from './engine';
  import { canListen } from './listen';
  import NameCall from './NameCall.svelte';
  import type { AccessoryId } from './types';
  import { ACCESSORY_COLOR } from './ui';

  let {
    save,
    pet,
    onselect,
    onwear,
    onname,
    onadopt
  }: {
    save: Save;
    /** いまのペット */
    pet: Pet;
    onselect: (petId: string) => void;
    onwear: (petId: string, acc: AccessoryId | null) => void;
    /** 名前と、声で覚えさせた呼び名を書きかえる */
    onname: (petId: string, name: string, calls: string[]) => void;
    onadopt: () => void;
  } = $props();

  const price = $derived(adoptPrice(save));
  const full = $derived(save.pets.length >= MAX_PETS);
  const accName = (id: AccessoryId) => SHOP.find((i) => i.id === id)?.name ?? '';
  const voice = canListen();

  let mode = $state<'rename' | 'learn' | null>(null);
  let draft = $state('');

  // 呼び名は前の名前の聞き取りなので、名前を変えたら消して覚え直してもらう
  function rename(event: SubmitEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    onname(pet.id, draft.trim(), []);
    mode = voice ? 'learn' : null;
  }

  function learned(calls: string[]) {
    if (calls.length) onname(pet.id, pet.name, calls);
    mode = null;
  }
</script>

<div class="pets">
  {#each save.pets as p (p.id)}
    <button class="pet-choice" class:on={p.id === pet.id} aria-pressed={p.id === pet.id} onclick={() => onselect(p.id)}>
      <span class="face" style:background={BREEDS[p.breed].color}><Icon name={BREEDS[p.breed].kind} size="80%" /></span>
      <span class="name">{p.name}</span>
      <span class="love"><Icon name="heart" />{hearts(p)}</span>
    </button>
  {/each}
  <button class="pet-choice adopt" disabled={full} onclick={onadopt}>
    <Icon name="plus" size="48px" />
    <span class="name">むかえる</span>
    <span class="love">
      {#if full}
        {MAX_PETS}びきまで
      {:else}
        <Icon name="coin" />{price}
      {/if}
    </span>
  </button>
</div>

<h3>{pet.name}の なまえ</h3>
{#if mode === 'rename'}
  <form class="row" onsubmit={rename}>
    <input bind:value={draft} maxlength="8" aria-label="あたらしい なまえ" autocomplete="off" />
    <button type="submit" class="pill p2" disabled={!draft.trim()}>かえる</button>
    <button type="button" class="pill" onclick={() => (mode = null)}>やめる</button>
  </form>
{:else if mode === 'learn'}
  <div class="row"><NameCall name={pet.name} breed={pet.breed} onfinish={learned} /></div>
{:else}
  <div class="row">
    <button class="pill" onclick={() => ((draft = pet.name), (mode = 'rename'))}>なまえを かえる</button>
    {#if voice}
      <button class="pill" onclick={() => (mode = 'learn')}>よびかたを おぼえなおす</button>
    {/if}
  </div>
{/if}

<h3>{pet.name}の きせかえ</h3>
{#if save.accessories.length === 0}
  <p class="empty">おみせで かえるよ</p>
{:else}
  <div class="wear">
    <button class="pet-choice" class:on={pet.accessory === null} onclick={() => onwear(pet.id, null)}>
      <Icon name="cross" size="36px" /><span>なし</span>
    </button>
    {#each save.accessories as acc (acc)}
      <button class="pet-choice" class:on={pet.accessory === acc} onclick={() => onwear(pet.id, acc)}>
        <span class="swatch" style:background={ACCESSORY_COLOR[acc]}></span><span>{accName(acc)}</span>
      </button>
    {/each}
  </div>
{/if}

<style>
  .pets,
  .wear {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 12px;
  }

  .face {
    display: grid;
    place-items: center;
    width: 52px;
    aspect-ratio: 1;
    border: 3px solid var(--line);
    border-radius: 50%;
  }

  .name {
    max-width: 100%;
    overflow: hidden;
    font-size: 17px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .love {
    display: flex;
    align-items: center;
    gap: 2px;
    font-size: 14px;
  }

  .adopt:not(:disabled) {
    background: var(--pastel-p2);
  }

  h3 {
    margin: 20px 0 10px;
    font-size: 17px;
  }

  .empty {
    font-size: 15px;
    font-weight: 700;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
  }

  input {
    width: min(100%, 240px);
    padding: 8px 16px;
    border: 3px solid var(--line);
    border-radius: 999px;
    background: #fff;
    color: var(--line);
    /* 16px より小さいと iOS がフォーカス時に拡大する */
    font: inherit;
    font-size: 18px;
    font-weight: 800;
    text-align: center;
    touch-action: manipulation;
    user-select: text;
    -webkit-user-select: text;
  }

  .swatch {
    width: 36px;
    aspect-ratio: 1;
    border: 3px solid var(--line);
    border-radius: 50%;
  }
</style>
