<script lang="ts">
  let { host, onsave, onagain }: { host: boolean; onsave: () => void; onagain: () => void } = $props();
</script>

<div class="finished">
  <p class="yuru">できた！</p>
  <button class="pill" onclick={onsave}>しゃしんに ほぞん</button>
  {#if host}
    <button class="pill gold" onclick={onagain}>あそびを えらぶ</button>
  {:else}
    <p role="status">おやが つぎの あそびを えらぶのを まってね</p>
  {/if}
</div>

<style>
  .finished {
    position: absolute;
    bottom: 16px;
    display: grid;
    justify-items: center;
    gap: 10px;
    padding: 16px 24px;
    border: 3px solid var(--line);
    border-radius: 20px;
    background: var(--paper);
    box-shadow: var(--soft-shadow);
    color: var(--line);
    font-weight: 800;
  }

  .finished .yuru {
    font-size: clamp(28px, 6cqh, 48px);
  }
</style>
