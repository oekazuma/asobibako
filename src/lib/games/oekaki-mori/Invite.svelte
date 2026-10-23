<script lang="ts">
  import Handshake from '$lib/net/Handshake.svelte';
  import type { Link } from '$lib/net/link';
  import { MISMATCH, type Seat } from '$lib/net/party.svelte';
  import { who } from './looks';

  let {
    away,
    onlink,
    looks = {},
    wait = 0,
    open = $bindable(false)
  }: {
    away: Seat[];
    onlink: (link: Link) => Promise<Seat | null | 'mismatch' | undefined>;
    looks?: Record<number, string>;
    /** 遊びを終えるまでの残り秒。2 人で遊んでいて 1 人が切れたときだけ 0 より大きい */
    wait?: number;
    open?: boolean;
  } = $props();
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
  <!-- 遊びは止めずに、上に重ねて QR の手順を出す -->
  <div class="invite">
    {#key tries}
      <Handshake
        role="host"
        onlink={async (link) => {
          const seat = await onlink(link);
          if (typeof seat === 'number') return close();
          fail(seat === 'mismatch' ? MISMATCH : 'つながりませんでした。もういちど ためしてね');
        }}
        onfail={fail}
      />
    {/key}
    {#if failed}<p role="alert">{failed}</p>{/if}
    <button class="pill" onclick={close}>とじる</button>
  </div>
{:else if away.length}
  <p class="lost" role="status">
    {away.map((s) => who(s, looks)).join('と')} の つながりが きれました{wait ? `。あと ${wait} びょう まつよ` : ''}
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
    top: calc(max(10px, var(--safe-top)) + 104px);
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
