<script lang="ts">
  import { onDestroy } from 'svelte';
  import Handshake from '$lib/net/Handshake.svelte';
  import type { Link } from '$lib/net/link';
  import { MISMATCH, Party } from '$lib/net/party.svelte';
  import Back from './Back.svelte';
  import { CoopGuest, CoopHost } from './coop';
  import CoopPlay from './CoopPlay.svelte';
  import { wornKeys } from './gacha';
  import { loadRecords } from './records';
  import { createWorld, type World } from './world';

  let { onback }: { onback: () => void } = $props();

  const records = loadRecords();

  let joining = $state<'host' | 'guest' | null>(null);
  let failed = $state('');
  let party: Party | null = null;
  let host = $state.raw<CoopHost | null>(null);
  let guest = $state.raw<CoopGuest | null>(null);
  let world = $state.raw<World | null>(null);
  /** 親で、子が入った */
  let ready = $state(false);
  let mismatch = $state(false);
  let playing = $state(false);

  /** どちらも、キャラ選択で選んでいた子と自分のパワーアップ・装備で遊ぶ */
  const me = () => ({ animal: records.animal, ranks: records.ranks, gear: wornKeys(records) });

  async function linked(link: Link) {
    if (joining === 'host') {
      const p = Party.host();
      const w = createWorld(records.animal, Date.now() % 2 ** 31, { w: 260, h: 380 }, records.ranks, 'forest', {
        gear: wornKeys(records)
      });
      // 子の最初の知らせ（hi）を聞き逃さないよう、迎え入れる前に聞き手を付ける
      host = new CoopHost(p, w);
      world = w;
      party = p;
      const seat = await p.add(link);
      if (seat === 'mismatch') failed = MISMATCH;
    } else {
      party = Party.guest(link);
      guest = new CoopGuest(party, me());
    }
    joining = null;
  }

  // CoopHost と CoopGuest はふつうの class なので、画面に出す旗はここで写す
  const timer = setInterval(() => {
    if (host) ready = host.ready;
    if (guest) {
      mismatch = guest.mismatch;
      if (guest.view && !playing) {
        world = guest.view;
        playing = true;
      }
    }
  }, 150);

  onDestroy(() => {
    clearInterval(timer);
    party?.close();
  });

  function start() {
    host?.start();
    playing = true;
  }
</script>

{#if playing && world}
  <CoopPlay {host} {guest} {world} onend={onback} />
{:else}
  <div class="as-screen">
    <section class="as-panel" aria-label="ふたりで遊ぶ">
      <h2 class="as-title">ふたりで遊ぶ</h2>
      {#if joining}
        <div class="shake">
          <Handshake
            role={joining}
            onlink={linked}
            onfail={(text) => {
              failed = text;
              joining = null;
            }}
          />
        </div>
      {:else if host}
        <p class="note">{ready ? 'なかまが はいりました' : 'なかまを まっています'}</p>
        <button class="as-card as-go" disabled={!ready} onclick={start}>はじめる</button>
      {:else if guest}
        <p class="note">{mismatch ? MISMATCH : 'おやが はじめるのを まっています'}</p>
      {:else}
        <p class="note">それぞれの端末で、キャラ選択で選んだ子と いっしょに 森を 生き延びよう</p>
        <button class="as-card" onclick={() => (joining = 'host')}>なかまを よぶ</button>
        <button class="as-card" onclick={() => (joining = 'guest')}>なかまに はいる</button>
      {/if}
      {#if failed}<p class="warn">{failed}</p>{/if}
    </section>
  </div>
  <Back {onback} />
{/if}

<style>
  /* QR の手順は画面いっぱいに出す大きさなので、枠の中では枠の幅に収める（はみ出すと枠で切れて読めない） */
  .shake {
    display: grid;
    gap: 12px;
    justify-items: center;
  }

  .shake :global(.code),
  .shake :global(video) {
    width: min(100%, 52cqh);
    box-sizing: border-box;
  }

  .note {
    margin: 0;
    color: #fff3d6;
    text-align: center;
  }

  .warn {
    margin: 0;
    color: #f093a3;
    text-align: center;
  }

  .as-card {
    justify-content: center;
    font-size: min(4.6cqw, 2.8cqh, 24px);
  }

  .as-card:disabled {
    opacity: 0.45;
    cursor: default;
  }
</style>
