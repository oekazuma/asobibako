<script lang="ts">
  import { onMount } from 'svelte';

  let {
    onstay,
    onleave,
    text = 'タイトルへ戻ると、塗った体は消えます。',
    leave = '戻る'
  }: { onstay: () => void; onleave: () => void; text?: string; leave?: string } = $props();
  let ready = $state(false);

  // ✕ を押した指を離した位置にこのボタンが現れると、iOS が合成 click を当てる。出てすぐは押せなくする
  onMount(() => {
    const t = setTimeout(() => (ready = true), 350);
    return () => clearTimeout(t);
  });
</script>

<div class="back" role="dialog" aria-modal="true" aria-label="タイトルへ戻る確かめ">
  <div class="box">
    <p>{text}</p>
    <div class="row">
      <button disabled={!ready} onclick={onleave}>{leave}</button>
      <button disabled={!ready} onclick={onstay}>つづける</button>
    </div>
  </div>
</div>

<style>
  .back {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgb(0 0 0 / 0.55);
    touch-action: none;
  }

  .box {
    display: grid;
    gap: 22px;
    padding: 26px 34px;
    border-radius: 14px;
    background: rgb(20 18 16 / 0.9);
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    text-shadow: 0 2px 4px #000;
  }

  p {
    margin: 0;
    font-size: 22px;
  }

  .row {
    display: flex;
    gap: 16px;
    justify-content: center;
  }

  button {
    min-width: 120px;
    padding: 10px 24px;
    border: 2px solid rgb(255 255 255 / 0.85);
    border-radius: 999px;
    background: rgb(0 0 0 / 0.35);
    color: #fff;
    font: inherit;
    font-size: 20px;
    text-shadow: inherit;
  }

  button:disabled {
    opacity: 0.45;
  }
</style>
