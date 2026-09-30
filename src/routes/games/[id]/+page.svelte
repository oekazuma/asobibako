<script lang="ts">
  import GameShell from '$lib/components/GameShell.svelte';
  import SoloShell from '$lib/components/SoloShell.svelte';
  import type { Net } from '$lib/net/link';
  import Pairing from '$lib/net/Pairing.svelte';
  import { rememberGame } from '$lib/recent';

  let { data } = $props();

  let pairing = $state(false);
  // 抜けたときに今のつながりと同じものかを比べるので、proxy にしない
  let net = $state.raw<Net>();

  // 別のゲームへ移ってもページの部品は使い回されるので、onMount ではなく id の変化で覚える
  $effect(() => rememberGame(data.play.meta.id));

  // 別のゲームへ移る・つなぎ直すときは前のつながりを切る
  $effect(() => {
    const current = net;
    return () => current?.link.close();
  });

  function linked(next: Net) {
    pairing = false;
    net = next;
    // 相手が抜けたら、1 台で遊ぶタイトルに戻す
    next.link.closed.then(() => {
      if (net === next) net = undefined;
    });
  }
</script>

<!-- タブやアプリを閉じたとき相手にすぐ知らせる。知らせずに消えると、相手が気づくまで 15 秒ほどかかる -->
<svelte:window onpagehide={() => net?.link.close()} />

<svelte:head>
  <title>{data.play.meta.name} — あそびばこ</title>
</svelte:head>

<!-- 別のゲームへ移ったとき、前のゲームの画面状態を持ち越さない -->
{#key data.play.meta.id}
  {#if data.play.kind === 'solo'}
    <SoloShell meta={data.play.meta} Game={data.play.Game} Howto={data.play.Howto} />
  {:else if data.play.kind === 'party'}
    <data.play.Game />
  {:else if pairing}
    <Pairing name={data.play.meta.name} onlink={linked} onback={() => (pairing = false)} />
  {:else}
    {#key net}
      <GameShell
        meta={data.play.meta}
        Game={data.play.Game}
        Howto={data.play.Howto}
        {net}
        onpair={data.play.meta.net ? () => (pairing = true) : undefined}
      />
    {/key}
  {/if}
{/key}
