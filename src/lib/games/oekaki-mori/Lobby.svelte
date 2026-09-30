<script lang="ts">
  import Handshake from '$lib/net/Handshake.svelte';
  import type { Link } from '$lib/net/link';
  import { Party } from '$lib/net/party.svelte';

  let {
    party,
    note = '',
    onparty,
    onstart,
    onpractice
  }: {
    party: Party | null;
    note?: string;
    onparty: (party: Party) => void;
    onstart: () => void;
    onpractice: () => void;
  } = $props();

  let joining = $state<'host' | 'guest' | null>(null);
  let failed = $state('');

  function linked(link: Link) {
    if (joining === 'host') {
      const p = party ?? Party.host();
      p.add(link);
      if (!party) onparty(p);
    } else onparty(Party.guest(link));
    joining = null;
  }

  function join(as: 'host' | 'guest') {
    failed = '';
    joining = as;
  }
</script>

<div class="lobby">
  <h1 class="yuru">おえかきのもり</h1>
  {#if joining}
    <Handshake
      role={joining}
      onlink={linked}
      onfail={(text) => {
        failed = text;
        joining = null;
      }}
    />
    <button class="pill" onclick={() => (joining = null)}>やめる</button>
  {:else if !party}
    <p>2〜3にんで、ひとり 1だいずつ つかって あそぶよ</p>
    <button class="pill p1" onclick={() => join('host')}>なかまを よぶ（QR を だす）</button>
    <button class="pill p2" onclick={() => join('guest')}>QR を よみとる</button>
    <button class="pill practice" onclick={onpractice}>ひとりで れんしゅう</button>
  {:else}
    <ul class="members">
      {#each party.members as seat (seat)}
        <li class="pill p{seat}">{seat}P{seat === party.me ? '（あなた）' : ''}</li>
      {/each}
    </ul>
    {#if party.host}
      {#if party.members.length < 3}
        <button class="pill p1" onclick={() => join('host')}>
          {party.members.length < 2 ? 'なかまを よぶ' : 'もうひとり よぶ'}
        </button>
      {/if}
      <button class="pill gold" disabled={party.members.length < 2} onclick={onstart}>はじめる</button>
    {:else}
      <p role="status">おやが はじめるのを まってね</p>
    {/if}
  {/if}
  {#if failed || note}<p role="alert">{failed || note}</p>{/if}
</div>

<style>
  .lobby {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 16px;
    background: var(--paper-dots), var(--paper);
    color: var(--line);
    font-weight: 700;
    text-align: center;
  }

  h1 {
    font-size: clamp(28px, min(6cqh, 9cqw), 52px);
  }

  .members {
    display: flex;
    gap: 10px;
    list-style: none;
  }
</style>
