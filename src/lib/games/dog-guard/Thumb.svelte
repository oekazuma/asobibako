<!-- ドームの線に守られた犬と、上から来るハチ -->
<div class="thumb" aria-hidden="true">
  <span class="bee a">🐝</span>
  <span class="bee b">🐝</span>
  <span class="dome"></span>
  <span class="dog">🐶</span>
  <span class="ground"></span>
</div>

<style>
  .thumb {
    position: relative;
    height: 100%;
    background: linear-gradient(to bottom, #cdeeff, #f4fbe9);
  }

  .bee {
    position: absolute;
    font-size: 20px;
  }

  .a {
    top: 12%;
    left: 30%;
  }

  .b {
    top: 26%;
    left: 62%;
  }

  .dome {
    position: absolute;
    bottom: 12%;
    left: 50%;
    width: 84px;
    height: 46px;
    border: 5px solid var(--ink);
    border-bottom: none;
    border-radius: 50px 50px 0 0;
    translate: -50% 0;
  }

  .dog {
    position: absolute;
    bottom: 13%;
    left: 50%;
    font-size: 28px;
    translate: -50% 0;
  }

  .ground {
    position: absolute;
    bottom: 8%;
    left: 0;
    right: 0;
    height: 6px;
    background: #5aa84f;
  }
</style>
