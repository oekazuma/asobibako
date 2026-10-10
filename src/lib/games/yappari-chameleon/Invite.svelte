<script lang="ts">
  import Handshake from '$lib/net/Handshake.svelte';
  import type { Link } from '$lib/net/link';
  import { MISMATCH, type Seat } from '$lib/net/party.svelte';
  import { nameOf } from './match.svelte';

  let {
    away,
    open = $bindable(false),
    onlink
  }: { away: Seat[]; open?: boolean; onlink: (link: Link) => Promise<Seat | null | 'mismatch'> } = $props();
  let failed = $state('');
  /** 断った・つなげなかった QR は使い終わっているので、数を進めて手順を作り直す */
  let tries = $state(0);

  function close() {
    open = false;
    failed = '';
  }

  /** 閉じたあとに届いた結果は、次に開いた手順のものではないので捨てる */
  function fail(text: string) {
    if (!open) return;
    failed = text;
    tries++;
  }
</script>

{#if open}
  <!-- 試合は止めずに、上に重ねて QR の手順を出す。戻った子は同じ番号で迎える（Party.away） -->
  <div class="invite">
    {#key tries}
      <Handshake
        role="host"
        onlink={async (link) => {
          const seat = await onlink(link);
          if (typeof seat === 'number') return close();
          fail(seat === 'mismatch' ? MISMATCH : 'つながりませんでした。もう一度試してください');
        }}
        onfail={fail}
      />
    {/key}
    {#if failed}<p role="alert">{failed}</p>{/if}
    <button class="pill" onclick={close}>とじる</button>
  </div>
{:else if away.length}
  <p class="lost" role="status">
    {away.map((seat) => nameOf(seat)).join('と')}の接続が切れました
    <button onclick={() => (open = true)}>よびなおす</button>
  </p>
{/if}

<style>
  .invite {
    position: absolute;
    inset: 0;
    z-index: 6;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 16px;
    background: var(--paper-dots), var(--paper);
    color: var(--line);
    font-weight: 800;
    text-align: center;
  }

  /* 答え合わせの「勝者…!」（Reveal.svelte、上から 84px に 30px の字）の下に置く */
  .lost {
    position: absolute;
    top: calc(max(10px, env(safe-area-inset-top)) + 130px);
    left: 50%;
    translate: -50% 0;
    z-index: 4;
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    padding: 6px 8px 6px 16px;
    border-radius: 999px;
    background: rgb(0 0 0 / 0.55);
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    white-space: nowrap;
  }

  .lost button {
    padding: 4px 14px;
    border: 2px solid rgb(255 255 255 / 0.85);
    border-radius: 999px;
    background: #b3261e;
    color: #fff;
    font: inherit;
  }
</style>
