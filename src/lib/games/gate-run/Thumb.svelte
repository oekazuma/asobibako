<!-- 奥へ続く道と、青と赤の門、手前の青い群れ -->
<div class="thumb" aria-hidden="true">
  <span class="road"></span>
  <span class="gate good">×2</span>
  <span class="gate bad">-10</span>
  <span class="crowd"></span>
</div>

<style>
  .thumb {
    position: relative;
    height: 100%;
    overflow: hidden;
    background: linear-gradient(to bottom, #6ec8ff, #d9f2ff 28%, #9fdc7c 28%, #58b947);
  }

  .road {
    position: absolute;
    inset: 28% 0 0;
    background: repeating-linear-gradient(to bottom, #f3f0ff 0 12px, #e2ddf7 12px 24px);
    clip-path: polygon(44% 0, 56% 0, 100% 100%, 0 100%);
  }

  .gate {
    position: absolute;
    top: 38%;
    width: 25%;
    height: 22%;
    display: grid;
    place-items: center;
    border: 2px solid #fff;
    border-radius: 6px;
    color: #fff;
    font-size: 16px;
    font-weight: 800;
  }

  .good {
    left: 25%;
    background: linear-gradient(to bottom, rgb(120 200 255 / 0.95), rgb(31 155 255 / 0.7));
  }

  .bad {
    left: 50%;
    background: linear-gradient(to bottom, rgb(255 140 150 / 0.95), rgb(255 77 94 / 0.7));
  }

  .crowd {
    position: absolute;
    bottom: 6%;
    left: 50%;
    width: 70px;
    height: 30px;
    background: radial-gradient(circle, #4db5ff 4px, #0b6fcc 5px, transparent 6px) 0 0 / 10px 10px;
    translate: -50% 0;
  }
</style>
