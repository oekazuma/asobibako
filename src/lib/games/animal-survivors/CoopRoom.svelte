<script lang="ts">
  import { onDestroy } from 'svelte';
  import Handshake from '$lib/net/Handshake.svelte';
  import type { Link } from '$lib/net/link';
  import { MISMATCH, Party } from '$lib/net/party.svelte';
  import type { AnimalId } from './animals';
  import { openArcana } from './arcana';
  import Back from './Back.svelte';
  import Cauldron from './Cauldron.svelte';
  import { CoopGuest, CoopHost } from './coop';
  import CoopPick from './CoopPick.svelte';
  import CoopPlay from './CoopPlay.svelte';
  import { wornKeys } from './gacha';
  import { loadRecords, payHeat, saveRecords } from './records';
  import StageSelect from './StageSelect.svelte';
  import { createWorld, type World } from './world';

  let { onback }: { onback: () => void } = $props();

  let records = $state(loadRecords());
  let joining = $state<'host' | 'guest' | null>(null);
  let failed = $state('');
  let party: Party | null = null;
  let host = $state.raw<CoopHost | null>(null);
  let guest = $state.raw<CoopGuest | null>(null);
  let world = $state.raw<World | null>(null);
  /** 親で子が動物を選んだ／子で親が受け取った・版がちがった */
  let ready = $state(false);
  let picked = $state(false);
  let mismatch = $state(false);
  /** 自分の動物。親はこのあとステージと釜を選ぶ */
  let mine = $state<AnimalId | null>(null);
  let step = $state<'pick' | 'stage' | 'cauldron'>('pick');
  let stage = $state('forest');
  /** 釜で選んだ強さ（もう一度も同じ強さで賭け直す） */
  let want = 2;
  let playing = $state(false);

  async function linked(link: Link) {
    if (joining === 'host') {
      const p = Party.host();
      // 子の最初の知らせ（hi と pick）を聞き逃さないよう、迎え入れる前に聞き手を付ける
      host = new CoopHost(p);
      party = p;
      const seat = await p.add(link);
      if (seat === 'mismatch') failed = MISMATCH;
    } else {
      party = Party.guest(link);
      guest = new CoopGuest(party);
    }
    joining = null;
  }

  function choose(id: AnimalId) {
    mine = id;
    guest?.pick({ animal: id, ranks: records.ranks, gear: wornKeys(records) });
    if (host) step = 'stage';
  }

  /** 釜の「はじめる」。賭けは親だけが払う */
  function begin(h: number) {
    want = h;
    const r = loadRecords();
    const heat = payHeat(r, h);
    saveRecords(r);
    records = r;
    const seed = Date.now() % 2 ** 31;
    const w = createWorld(mine!, seed, { w: 260, h: 380 }, r.ranks, stage, {
      heat,
      arcana: openArcana(r.achieved),
      gear: wornKeys(r)
    });
    host?.start(w, seed, stage);
    world = w;
    playing = true;
  }

  // CoopHost と CoopGuest はふつうの class なので、画面に出す旗はここで写す
  const timer = setInterval(() => {
    if (host) ready = host.ready;
    if (guest) {
      mismatch = guest.mismatch;
      picked = guest.picked;
      if (guest.view && guest.view !== world) {
        world = guest.view;
        playing = true;
      }
    }
  }, 150);

  onDestroy(() => {
    clearInterval(timer);
    party?.close();
  });
</script>

{#if playing && world}
  <!-- もう一度で World が替わったら、遊ぶ画面を作り直す（遊ぶ画面は受け取った World を進め続ける） -->
  {#key world}
    <CoopPlay {host} {guest} {world} onend={onback} onagain={host ? () => begin(want) : undefined} />
  {/key}
{:else if host && mine && ready && step === 'stage'}
  <StageSelect
    {records}
    onpick={(id) => {
      stage = id;
      step = 'cauldron';
    }}
    onback={() => (mine = null)}
  />
{:else if host && mine && ready && step === 'cauldron'}
  <Cauldron coins={records.coins} start={records.heatLast} {stage} onstart={begin} onback={() => (step = 'stage')} />
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
      {:else if (host || guest) && mismatch}
        <p class="note">{MISMATCH}</p>
      {:else if (host || guest) && !mine}
        <CoopPick {records} onpick={choose} />
      {:else if host}
        <p class="note">なかまが 子を えらぶのを まっています</p>
      {:else if guest}
        <p class="note">{picked ? 'おやが ステージを えらんでいます' : 'おやに しらせています…'}</p>
      {:else}
        <p class="note">それぞれの端末で、自分の子と いっしょに 生き延びよう</p>
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
</style>
