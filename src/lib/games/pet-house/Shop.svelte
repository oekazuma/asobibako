<script lang="ts">
  import { onDestroy } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import type { RoomLook } from './decor';
  import DecorShop from './DecorShop.svelte';
  import { SHOP, type Save, type ShopItem } from './engine';
  import type { AccessoryId, FoodId, ToyId } from './types';
  import { ITEM_ICON } from './ui';

  let {
    save,
    trying,
    onbuy,
    ontry,
    onroom
  }: {
    save: Save;
    /** 試着しているアクセサリー */
    trying: AccessoryId | null;
    onbuy: (id: ShopItem['id']) => void;
    /** アクセサリーを見た目だけ着せる。null で元に戻す */
    ontry: (acc: AccessoryId | null) => void;
    onroom: (look: Partial<RoomLook>) => void;
  } = $props();

  const TABS: { type: ShopItem['type']; label: string }[] = [
    { type: 'food', label: 'たべもの' },
    { type: 'toy', label: 'おもちゃ' },
    { type: 'accessory', label: 'きるもの' },
    { type: 'room', label: 'へや' }
  ];
  let tab = $state<ShopItem['type']>('food');
  const items = $derived(SHOP.filter((i) => i.type === tab));

  function owned(item: ShopItem): boolean {
    if (item.type === 'toy') return save.toys.includes(item.id as ToyId);
    return item.type === 'accessory' && save.accessories.includes(item.id as AccessoryId);
  }

  // 閉じ方（✕・外を押す・パネルの切り替え）によらず、おみせを出たら試着を戻す
  onDestroy(() => ontry(null));
</script>

<div class="tabs">
  {#each TABS as t (t.type)}
    <button
      class="tab"
      class:on={tab === t.type}
      aria-pressed={tab === t.type}
      onclick={() => ((tab = t.type), ontry(null))}
    >
      {t.label}
    </button>
  {/each}
  <span class="wallet"><Icon name="coin" />{save.money}</span>
</div>
{#if tab === 'room'}
  <DecorShop {save} {onbuy} {onroom} />
{:else}
  <div class="grid">
    {#each items as item (item.id)}
      {@const have = owned(item)}
      {@const acc = item.type === 'accessory' ? (item.id as AccessoryId) : null}
      {#if acc && acc === trying}
        <!-- 子どもがまちがえて買わないよう、1 回目は試着だけにして、買うのはこのボタン -->
        <div class="pet-choice on">
          <Icon name={acc} size="40px" />
          <span class="name">{item.name}</span>
          <button class="pill p2 buy" disabled={save.money < item.price} onclick={() => onbuy(item.id)}>
            <Icon name="coin" />{item.price} かう
          </button>
        </div>
      {:else}
        <button
          class="pet-choice"
          disabled={have || (!acc && save.money < item.price)}
          onclick={() => (acc ? ontry(acc) : onbuy(item.id))}
        >
          <Icon name={acc ?? ITEM_ICON[item.id as FoodId | ToyId]} size="40px" />
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
      {/if}
    {/each}
  </div>
{/if}

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

  .buy {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    font-size: 16px;
    white-space: nowrap;
  }

  .price {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 17px;
  }
</style>
