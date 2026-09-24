<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { SHOP, type Save, type ShopItem } from './engine';
  import type { AccessoryId, FoodId, ToyId } from './types';
  import { ACCESSORY_COLOR, ITEM_ICON } from './ui';

  let { save, onbuy }: { save: Save; onbuy: (id: ShopItem['id']) => void } = $props();

  const TABS: { type: ShopItem['type']; label: string }[] = [
    { type: 'food', label: 'たべもの' },
    { type: 'toy', label: 'おもちゃ' },
    { type: 'accessory', label: 'きるもの' }
  ];
  let tab = $state<ShopItem['type']>('food');
  const items = $derived(SHOP.filter((i) => i.type === tab));

  function owned(item: ShopItem): boolean {
    if (item.type === 'toy') return save.toys.includes(item.id as ToyId);
    return item.type === 'accessory' && save.accessories.includes(item.id as AccessoryId);
  }
</script>

<div class="tabs">
  {#each TABS as t (t.type)}
    <button class="tab" class:on={tab === t.type} aria-pressed={tab === t.type} onclick={() => (tab = t.type)}>
      {t.label}
    </button>
  {/each}
  <span class="wallet"><Icon name="coin" />{save.money}</span>
</div>
<div class="grid">
  {#each items as item (item.id)}
    {@const have = owned(item)}
    <button class="pet-choice" disabled={have || save.money < item.price} onclick={() => onbuy(item.id)}>
      {#if item.type === 'accessory'}
        <span class="swatch" style:background={ACCESSORY_COLOR[item.id as AccessoryId]}></span>
      {:else}
        <Icon name={ITEM_ICON[item.id as FoodId | ToyId]} size="40px" />
      {/if}
      <span class="name">{item.name}{item.count ? ` ${item.count}こ` : ''}</span>
      {#if item.kind}
        <span class="for"><Icon name={item.kind} />{item.kind === 'dog' ? 'いぬ' : 'ねこ'}むけ</span>
      {/if}
      {#if have}
        <span class="price"><Icon name="check" />もってる</span>
      {:else}
        <span class="price"><Icon name="coin" />{item.price}</span>
      {/if}
      {#if item.type === 'food'}
        <span class="stock">いま {save.food[item.id as FoodId]}こ</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .tabs {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  .tab {
    padding: 6px 16px;
    border: 3px solid var(--line);
    border-radius: 999px;
    background: #fff;
    color: var(--line);
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
  }

  .tab.on {
    background: var(--pastel-p1);
  }

  .wallet {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
    font-size: 18px;
    font-weight: 800;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 12px;
  }

  .swatch {
    width: 40px;
    aspect-ratio: 1;
    border: 3px solid var(--line);
    border-radius: 50%;
  }

  /* 分かち書きの空白でだけ折り返す（「おもち / ゃ」のように語の途中で割らない） */
  .name {
    font-size: 15px;
    text-align: center;
    word-break: keep-all;
  }

  .for,
  .stock {
    display: flex;
    align-items: center;
    gap: 2px;
    color: var(--line-soft);
    font-size: 12px;
  }

  .price {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 17px;
  }
</style>
