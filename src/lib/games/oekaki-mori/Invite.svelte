<script lang="ts">
  import Handshake from '$lib/net/Handshake.svelte';
  import type { Link } from '$lib/net/link';
  import { MISMATCH, type Seat } from '$lib/net/party.svelte';
  import { who } from './looks';

  let {
    away,
    onlink,
    looks = {},
    open = $bindable(false)
  }: {
    away: Seat[];
    onlink: (link: Link) => Promise<unknown>;
    looks?: Record<number, string>;
    open?: boolean;
  } = $props();
  let failed = $state('');

  function close() {
    open = false;
    failed = '';
  }
</script>

{#if open}
  <!-- 遊びは止めずに、上に重ねて QR の手順を出す -->
  <div class="invite">
    <Handshake
      role="host"
      onlink={async (link) => {
        if ((await onlink(link)) === 'mismatch') failed = MISMATCH;
        else close();
      }}
      onfail={(text) => (failed = text)}
    />
    {#if failed}<p role="alert">{failed}</p>{/if}
    <button class="pill" onclick={close}>とじる</button>
  </div>
{:else if away.length}
  <p class="lost" role="status">
    {away.map((s) => who(s, looks)).join('と')} の つながりが きれました
    <button class="pill p2" onclick={() => (open = true)}>よびなおす</button>
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

  .lost {
    position: absolute;
    /* 遊んでいるあいだの上の帯（点数の丸）を隠さないよう、その下に出す */
    top: calc(max(10px, env(safe-area-inset-top)) + 104px);
    left: 50%;
    translate: -50% 0;
    z-index: 4;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 8px 6px 16px;
    border: 3px solid var(--line);
    border-radius: 999px;
    background: var(--pastel-p2);
    color: var(--line);
    font-weight: 800;
    white-space: nowrap;
    /* 描く人の盤面の上の端に重なるので、ボタンのほかは指を通して線を引けるようにする */
    pointer-events: none;
  }

  .lost button {
    pointer-events: auto;
  }
</style>
