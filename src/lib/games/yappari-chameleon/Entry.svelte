<script lang="ts">
  import { resolve } from '$app/paths';
  import Handshake from '$lib/net/Handshake.svelte';
  import type { Link } from '$lib/net/link';
  import { MISMATCH, Party, type Seat } from '$lib/net/party.svelte';

  let {
    note = '',
    was,
    onhost,
    onparty,
    onsolo
  }: {
    note?: string;
    /** 親とのつながりが切れた子の、切れる前の番号。親が同じ番号で呼び直せるので、すぐ QR を読みに行けるようにする */
    was?: Seat;
    /** 親になった。最初の子の知らせ（join と hi）を受けるため、迎える前に審判を作らせる。迎えそこねたら戻り値で片付ける */
    onhost: (party: Party) => () => void;
    onparty: (party: Party) => void;
    onsolo: () => void;
  } = $props();

  let joining = $state<'host' | 'guest' | null>(null);
  let failed = $state('');

  async function linked(link: Link) {
    if (joining !== 'host') {
      joining = null;
      onparty(Party.guest(link, { was }));
      return;
    }
    const p = Party.host();
    const stop = onhost(p);
    // hello を待つあいだも QR の手順の画面のままにする。戻すと、もう一度呼べて親が 2 つできる
    const seat = await p.add(link);
    const cancelled = joining !== 'host';
    joining = null;
    if (typeof seat === 'number' && !cancelled) return onparty(p);
    stop();
    p.close();
    if (!cancelled) failed = seat === 'mismatch' ? MISMATCH : 'つながりませんでした。もう一度試してください';
  }

  function join(as: 'host' | 'guest') {
    failed = '';
    joining = as;
  }
</script>

<div class="entry">
  <h1>やっぱりカメレオン</h1>
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
      <button class="pill" onclick={() => (joining = null)}>やめる</button>
    </div>
  {:else}
    <p class="rule">体を塗って屋敷に溶け込み、ハンターから隠れる。ハンターはペイント銃で撃って探す。</p>
    <p class="rule">自分の iPad の画面は見せないでね</p>
    {#if was !== undefined}
      <button class="go" onclick={() => join('guest')}>もう一度つなぐ<small>ホストに QR を出してもらう</small></button>
    {/if}
    <!-- 切れた子も、親が戻らなければほかの人と遊び直せるよう、ふだんの 2 つを残す -->
    <div class="row">
      <button class="go" onclick={() => join('host')}>なかまを呼ぶ<small>この iPad に QR が出る</small></button>
      <button class="go" onclick={() => join('guest')}>なかまに入る<small>ホストの QR を読み取る</small></button>
    </div>
    <button class="solo" onclick={onsolo}>ひとりで試す</button>
  {/if}
  {#if failed || note}<p role="alert">{failed || note}</p>{/if}
  <a class="back" href={resolve('/')} aria-label="ゲーム選択へ戻る">✕</a>
</div>

<style>
  .entry {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 16px;
    overflow: auto;
    background: #1d1a17;
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    text-align: center;
    text-shadow: 0 2px 4px #000;
  }

  h1 {
    margin: 0;
    font-size: min(9cqh, 7cqw);
    font-weight: normal;
  }

  .rule {
    margin: 0;
    font-size: 17px;
  }

  .row {
    display: flex;
    gap: 16px;
  }

  .go,
  .solo {
    border: 2px solid rgb(255 255 255 / 0.85);
    border-radius: 18px;
    background: rgb(0 0 0 / 0.35);
    color: #fff;
    font: inherit;
  }

  .go {
    display: grid;
    gap: 4px;
    width: min(300px, 40cqw);
    padding: 16px;
    font-size: 24px;
  }

  .go small {
    font-size: 13px;
  }

  .solo {
    padding: 8px 24px;
    border-style: dashed;
    font-size: 18px;
  }

  /* QR の手順の部品はふだんの紙の地の色で描くので、白い札に載せる */
  .shake {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 14px;
    border-radius: 18px;
    background: var(--paper);
    color: var(--line);
    font-family: inherit;
    text-shadow: none;
  }

  .back {
    position: absolute;
    top: max(12px, env(safe-area-inset-top));
    left: max(12px, env(safe-area-inset-left));
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border: 2px solid rgb(255 255 255 / 0.85);
    border-radius: 50%;
    color: #fff;
    font-size: 22px;
    text-decoration: none;
  }
</style>
