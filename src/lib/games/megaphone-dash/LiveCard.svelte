<script lang="ts">
  let { face, fans }: { face: string | null; fans: number } = $props();
</script>

<!-- 配信中の画面の隅に出る、主人公の顔のカード -->
<div class="live">
  <span class="onair"><i></i>LIVE</span>
  {#if face}
    <img src={face} alt="" width="256" height="256" />
  {/if}
  <span class="viewers">しちょう {fans}</span>
  <span class="name">メガホンちゃん</span>
</div>

<style>
  .live {
    position: absolute;
    top: calc(max(12px, env(safe-area-inset-top)) + 60px);
    right: 3cqw;
    width: min(22cqh, 36cqw);
    aspect-ratio: 1.15;
    border: 4px solid #262833;
    border-radius: 6px;
    background: #ffd23a;
    box-shadow: 6px 6px 0 rgb(38 40 51 / 0.85);
    rotate: 5deg;
    overflow: hidden;
    pointer-events: none;
    color: #fff;
    font-style: italic;
    font-weight: 900;
  }

  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .onair,
  .viewers,
  .name {
    position: absolute;
    z-index: 1;
    font-size: min(1.5cqh, 2.6cqw);
  }

  .onair i {
    display: inline-block;
    width: 0.6em;
    height: 0.6em;
    margin-right: 0.3em;
    border-radius: 50%;
    background: #fff;
  }

  .onair {
    top: 6%;
    left: 6%;
    padding: 1px 8px;
    border-radius: 999px;
    background: #ff3b4e;
  }

  .viewers {
    right: 4%;
    bottom: 22%;
    padding: 1px 8px;
    border-radius: 999px;
    background: rgb(38 40 51 / 0.75);
  }

  .name {
    left: 0;
    right: 0;
    bottom: 0;
    padding: 3px 0;
    background: #262833;
    text-align: center;
  }
</style>
