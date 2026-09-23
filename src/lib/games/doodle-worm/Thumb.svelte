<!-- まるい頭に太い胴体のムシが 2 匹はっている -->
<div class="thumb" aria-hidden="true">
  <span class="worm a"><span class="body"></span><span class="head"></span></span>
  <span class="worm b"><span class="body"></span><span class="head"></span></span>
</div>

<style>
  .thumb {
    position: relative;
    height: 100%;
    background: #fff4f6;
  }

  .worm {
    position: absolute;
    width: 110px;
    height: 44px;
  }

  .a {
    top: 18%;
    left: 8%;
    --head: #ffd84d;
    --body: #b3ec3a;
  }

  .b {
    bottom: 12%;
    right: 6%;
    --head: #63a8f7;
    --body: #a974f2;
    scale: -0.8 0.8;
  }

  .body {
    position: absolute;
    top: 8px;
    left: 30px;
    width: 76px;
    height: 28px;
    border-radius: 14px;
    background: var(--body);
    rotate: -6deg;
  }

  .head {
    position: absolute;
    left: 0;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background:
      radial-gradient(ellipse 3px 6px at 38% 50%, #2b2d42 95%, transparent),
      radial-gradient(ellipse 3px 6px at 62% 50%, #2b2d42 95%, transparent), var(--head);
  }

  .head::before {
    content: '';
    position: absolute;
    top: -12px;
    left: 12px;
    width: 20px;
    height: 12px;
    background:
      linear-gradient(#2b2d42, #2b2d42) left / 3px 100% no-repeat,
      linear-gradient(#2b2d42, #2b2d42) center / 3px 100% no-repeat,
      linear-gradient(#2b2d42, #2b2d42) right / 3px 100% no-repeat;
  }
</style>
