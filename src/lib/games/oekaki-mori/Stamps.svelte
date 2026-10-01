<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import type { Seat } from '$lib/net/party.svelte';
  import Face from './Face.svelte';
  import { STAMPS, stampOf } from './stamps';

  let {
    stamps,
    looks = {},
    canSend,
    onsend
  }: {
    stamps: { key: number; seat: Seat; id: string }[];
    looks?: Record<number, string>;
    canSend: boolean;
    onsend: (id: string) => void;
  } = $props();
</script>

<ul class="floating" aria-live="polite">
  {#each stamps as s (s.key)}
    {@const stamp = stampOf(s.id)}
    {#if stamp}
      <!-- 続けて届いても重ならないよう、横の位置を番号でずらす -->
      <li style:left="{10 + ((s.key * 37) % 60)}%" aria-label={stamp.name}>
        <Face seat={s.seat} look={looks[s.seat]} size="28px" />
        <Icon name={stamp.icon} size="44px" />
      </li>
    {/if}
  {/each}
</ul>
{#if canSend}
  <div class="send">
    {#each STAMPS as stamp (stamp.id)}
      <button class="round" aria-label={stamp.name} onclick={() => onsend(stamp.id)}>
        <Icon name={stamp.icon} size="26px" />
      </button>
    {/each}
  </div>
{/if}

<style>
  .floating {
    position: absolute;
    inset: 0;
    list-style: none;
    pointer-events: none;
    overflow: hidden;
  }

  .floating li {
    position: absolute;
    bottom: 8%;
    display: flex;
    align-items: center;
    gap: 4px;
    animation: rise 2s ease-out forwards;
  }

  @keyframes rise {
    from {
      translate: 0 0;
      opacity: 1;
    }

    to {
      translate: 0 -40cqh;
      opacity: 0;
    }
  }

  .send {
    position: absolute;
    right: 12px;
    bottom: 12px;
    display: grid;
    gap: 6px;
  }

  .send .round {
    width: 44px;
    height: 44px;
  }

  @media (prefers-reduced-motion: reduce) {
    .floating li {
      animation: none;
    }
  }
</style>
