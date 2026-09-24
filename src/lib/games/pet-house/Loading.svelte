<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
</script>

<div class="loading" role="status">
  <div class="paws" aria-hidden="true">
    {#each [0, 1, 2] as i (i)}
      <span style:animation-delay="{i * 180}ms"><Icon name="paw" size="100%" /></span>
    {/each}
  </div>
  <p class="yuru">よみこみちゅう…</p>
  <p class="note">いぬや ねこが じゅんびを しているよ</p>
</div>

<style>
  .loading {
    position: absolute;
    inset: 0;
    z-index: 6;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: clamp(8px, 1.6cqh, 16px);
    background: var(--paper-dots), var(--paper);
    color: var(--line);
    text-align: center;
  }

  .paws {
    display: flex;
    gap: clamp(10px, 2cqw, 18px);
  }

  .paws span {
    width: clamp(36px, min(6cqh, 11cqw), 60px);
    aspect-ratio: 1;
    animation: hop 900ms var(--spring) infinite;
  }

  .yuru {
    font-size: clamp(22px, min(4cqh, 7cqw), 36px);
  }

  .note {
    font-size: clamp(13px, min(2cqh, 3.6cqw), 18px);
    font-weight: 700;
  }

  @keyframes hop {
    0%,
    60%,
    100% {
      translate: 0 0;
    }
    30% {
      translate: 0 -30%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .paws span {
      animation: none;
    }
  }
</style>
