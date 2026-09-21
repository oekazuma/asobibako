<!-- 導火線の火花がついた爆弾が、赤く光りながら相手の陣地へ飛んでいく -->
<div class="thumb" aria-hidden="true">
  <span class="zone p2"></span>
  <span class="zone p1"></span>
  <span class="trail"></span>
  <span class="bomb"><span class="spark"></span></span>
</div>

<style>
  .thumb {
    position: relative;
    height: 100%;
    overflow: hidden;
  }

  .zone {
    position: absolute;
    left: 0;
    right: 0;
    height: 50%;
  }

  .zone.p2 {
    top: 0;
    background: var(--p2-soft);
  }

  .zone.p1 {
    bottom: 0;
    background: var(--p1-soft);
    box-shadow: 0 -4px 0 #fff;
  }

  .trail {
    position: absolute;
    left: 30%;
    top: 58%;
    width: 30%;
    height: 10px;
    border-radius: 999px;
    background: linear-gradient(to right, transparent, rgb(255 90 40 / 0.55));
    rotate: -28deg;
  }

  .bomb {
    position: absolute;
    left: 62%;
    top: 40%;
    width: 30%;
    max-width: 62px;
    aspect-ratio: 1;
    border: 3px solid #fff;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #6d7390, #2b2d42 62%);
    box-shadow:
      0 0 0 6px rgb(255 90 40 / 0.25),
      0 4px 0 rgb(43 45 66 / 0.25);
    translate: -50% -50%;
  }

  .spark {
    position: absolute;
    top: -18%;
    right: -6%;
    width: 38%;
    aspect-ratio: 1;
    border-radius: 50%;
    background: radial-gradient(circle, #fff6c2, #ffb020 45%, transparent 70%);
  }
</style>
