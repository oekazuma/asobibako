<script lang="ts">
  import Handshake from './Handshake.svelte';
  import type { Net } from './link';

  let { name, onlink, onback }: { name: string; onlink: (net: Net) => void; onback: () => void } = $props();

  let role = $state<'host' | 'guest' | null>(null);
  let note = $state('');

  function begin(as: 'host' | 'guest') {
    note = '';
    role = as;
  }
</script>

<main class="pair">
  <h1 class="yuru">{name}<br />2だいで あそぶ</h1>
  {#if !role}
    <p>おなじ Wi-Fi の 2だいを QR で つなぎます</p>
    <button class="pill p1" onclick={() => begin('host')}>さきに QR を だす</button>
    <button class="pill p2" onclick={() => begin('guest')}>QR を よみとる</button>
  {:else}
    <Handshake
      {role}
      onlink={(link) => onlink({ me: role === 'host' ? 1 : 2, link })}
      onfail={(text) => {
        note = text;
        role = null;
      }}
    />
  {/if}
  {#if note}<p role="alert">{note}</p>{/if}
  <button class="pill" onclick={onback}>もどる</button>
</main>

<style>
  .pair {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    min-height: 100dvh;
    padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom));
    background: var(--paper-dots), var(--paper);
    color: var(--line);
    font-weight: 700;
    text-align: center;
  }

  h1 {
    font-size: clamp(22px, 4vmin, 36px);
  }
</style>
