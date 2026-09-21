<!-- 白いリンク・センターライン・ゴール・パックと 2 人のマレット -->
<div class="thumb" aria-hidden="true">
  <span class="goal p2"></span>
  <span class="goal p1"></span>
  <span class="line"></span>
  <span class="circle"></span>
  <span class="mallet p2" style:left="36%" style:top="24%"></span>
  <span class="mallet p1" style:left="62%" style:top="78%"></span>
  <span class="puck" style:left="48%" style:top="60%"></span>
</div>

<style>
  .thumb {
    position: relative;
    height: 100%;
    overflow: hidden;
    background: linear-gradient(to bottom, #fff 0 50%, #f3f9ff 50%);
  }

  .line {
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 4px;
    background: var(--p2);
    translate: 0 -50%;
  }

  .circle {
    position: absolute;
    top: 50%;
    left: 50%;
    height: 44%;
    aspect-ratio: 1;
    border: 3px solid var(--p1);
    border-radius: 50%;
    translate: -50% -50%;
  }

  .goal {
    position: absolute;
    left: 30%;
    width: 40%;
    height: 8px;
  }

  .goal.p2 {
    top: 0;
    border-radius: 0 0 8px 8px;
    background: var(--p2);
  }

  .goal.p1 {
    bottom: 0;
    border-radius: 8px 8px 0 0;
    background: var(--p1);
  }

  .mallet,
  .puck {
    position: absolute;
    aspect-ratio: 1;
    border-radius: 50%;
    translate: -50% -50%;
  }

  .mallet {
    width: 22%;
    max-width: 46px;
    border: 3px solid #fff;
    box-shadow:
      inset 0 0 0 7px rgb(0 0 0 / 0.12),
      0 3px 0 rgb(43 45 66 / 0.2);
  }

  .mallet.p1 {
    background: var(--p1);
  }

  .mallet.p2 {
    background: var(--p2);
  }

  .puck {
    width: 12%;
    max-width: 24px;
    background: radial-gradient(circle at 35% 30%, #6d7390, #2b2d42 62%);
  }
</style>
