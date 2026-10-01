<script lang="ts">
  import { resolve } from '$app/paths';
  import Handshake from '$lib/net/Handshake.svelte';
  import type { Link } from '$lib/net/link';
  import { MISMATCH, Party, type Seat } from '$lib/net/party.svelte';
  import Face from './Face.svelte';
  import LookPicker from './LookPicker.svelte';
  import { who } from './looks';
  import { readLook, saveLook } from './prefs';

  let {
    party,
    note = '',
    retry = false,
    was,
    onparty,
    onstart
  }: {
    party: Party | null;
    note?: string;
    /** 親とのつながりが切れた子。親が同じ番号で呼び直せるので、すぐ QR を読みに行けるようにする */
    retry?: boolean;
    /** 切れる前の自分の番号。親はこの番号が空いていれば同じ番号で迎える */
    was?: Seat;
    onparty: (party: Party) => void;
    onstart: () => void;
  } = $props();

  let joining = $state<'host' | 'guest' | null>(null);
  let failed = $state('');
  /** この端末の動物。つなぐときに親へ知らせる */
  let look = $state(readLook());
  const SEATS: Seat[] = [1, 2, 3];

  async function linked(link: Link) {
    if (joining === 'host') {
      const p = party ?? Party.host(look);
      // hello を待つあいだも QR の手順の画面のままにする。ロビーに戻すと、もう一度よべて親が 2 つできる
      const seat = await p.add(link);
      joining = null;
      if (seat === 'mismatch') failed = MISMATCH;
      // 最初の子を断ったら、誰もいない Party でロビーを進めない
      else if (!party) onparty(p);
    } else {
      joining = null;
      onparty(Party.guest(link, { was, look }));
    }
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
    {#if retry}
      <p role="alert">{note}</p>
      <button class="pill p2 card" onclick={() => join('guest')}>
        もういちど つなぐ
        <small>おやに QR を だしてもらってね</small>
      </button>
    {:else}
      <p>2〜3にんで、ひとり 1だいずつ つかって あそぶよ</p>
      <p>あなたの どうぶつ</p>
      <LookPicker
        {look}
        onlook={(next) => {
          look = next;
          saveLook(next);
        }}
      />
      <button class="pill p1 card" onclick={() => join('host')}>
        なかまを よぶ
        <small>この たんまつに QR が でる</small>
      </button>
      <button class="pill p2 card" onclick={() => join('guest')}>
        なかまに はいる
        <small>おやの QR を よみとる</small>
      </button>
    {/if}
    <a class="pill solo" href={resolve('/games/[id]', { id: 'nurie' })}>ひとりで ぬりえ</a>
  {:else}
    <ul class="members">
      {#each SEATS as seat (seat)}
        {@const here = party.members.includes(seat)}
        <li class="face p{seat}" class:empty={!here}>
          {#if here}<Face {seat} look={party.looks[seat]} size="52px" />{:else}＋{/if}
        </li>
      {/each}
    </ul>
    <p>あなたは {who(party.me, party.looks)}{party.host ? '（おや）' : ''}</p>
    {#if party.host}
      {#if party.members.length < 3}
        <button class="pill" onclick={() => join('host')}>
          {party.members.length < 2 ? 'なかまを よぶ' : 'もうひとり よぶ'}
        </button>
      {/if}
      <button class="pill gold card" disabled={party.members.length < 2} onclick={onstart}>あそびを えらぶ</button>
    {:else}
      <p role="status">おやが えらぶのを まってね</p>
    {/if}
  {/if}
  {#if failed || (note && !retry)}<p role="alert">{failed || note}</p>{/if}
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

  .card {
    flex-direction: column;
    width: min(420px, 86cqw);
    padding: 18px 16px;
    font-size: clamp(22px, 3.6cqh, 30px);
  }

  .card small {
    font-size: 0.58em;
    font-weight: 700;
  }

  .solo {
    margin-top: 12px;
    border-style: dashed;
    background: transparent;
    text-decoration: none;
  }

  .members {
    display: flex;
    gap: 12px;
    list-style: none;
  }

  .face {
    display: grid;
    place-items: center;
    width: 64px;
    height: 64px;
    border: 3px solid var(--line);
    border-radius: 50%;
    font-size: 20px;
  }

  .face.p1 {
    background: var(--pastel-p1);
  }

  .face.p2 {
    background: var(--pastel-p2);
  }

  .face.p3 {
    background: var(--pastel-p3);
  }

  .face.empty {
    border-style: dashed;
    background: transparent;
    color: color-mix(in srgb, var(--line) 50%, transparent);
  }
</style>
