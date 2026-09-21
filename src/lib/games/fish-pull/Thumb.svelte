<!-- 池の真ん中の魚を、上下から釣り糸で引っ張り合う -->
<div class="thumb" aria-hidden="true">
  <span class="line top"></span>
  <span class="line bottom"></span>
  <span class="fish"><span class="eye"></span></span>
  <span class="tail"></span>
</div>

<style>
  .thumb {
    position: relative;
    height: 100%;
    overflow: hidden;
    background: linear-gradient(to bottom, var(--p2-soft), #9fe0fc 50%, var(--p1-soft));
  }

  .line {
    position: absolute;
    left: 50%;
    width: 4px;
    background: #fff;
    translate: -50% 0;
  }

  .line.top {
    top: 0;
    height: 50%;
  }

  .line.bottom {
    bottom: 0;
    height: 50%;
  }

  .fish {
    position: absolute;
    left: 54%;
    top: 50%;
    width: 30%;
    max-width: 70px;
    aspect-ratio: 1.6;
    border: 3px solid #fff;
    border-radius: 55% 45% 45% 55% / 60% 60% 40% 40%;
    background: linear-gradient(to bottom, #ffb347, #ff7a1a);
    translate: -50% -50%;
    box-shadow: 0 3px 0 rgb(43 45 66 / 0.2);
  }

  .eye {
    position: absolute;
    top: 26%;
    right: 16%;
    width: 16%;
    aspect-ratio: 1;
    border-radius: 50%;
    background: var(--ink);
  }

  .tail {
    position: absolute;
    left: 30%;
    top: 50%;
    width: 12%;
    max-width: 28px;
    aspect-ratio: 0.8;
    clip-path: polygon(100% 50%, 0 0, 18% 50%, 0 100%);
    background: #ff7a1a;
    translate: -50% -50%;
  }
</style>
