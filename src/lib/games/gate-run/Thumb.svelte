<!-- 青と赤の門の手前に、青い仲間の群れ -->
<div class="thumb" aria-hidden="true">
  <span class="gate good">×2</span>
  <span class="gate bad">-10</span>
  <span class="crowd"></span>
</div>

<style>
  .thumb {
    position: relative;
    height: 100%;
    background: repeating-linear-gradient(to bottom, #fff 0 22px, #e8f6ff 22px 44px);
  }

  .gate {
    position: absolute;
    top: 14%;
    width: 44%;
    height: 34%;
    display: grid;
    place-items: center;
    border: 3px solid #fff;
    color: #fff;
    font-size: 22px;
    font-weight: 800;
  }

  .good {
    left: 3%;
    background: rgb(31 155 255 / 0.7);
  }

  .bad {
    right: 3%;
    background: rgb(255 77 94 / 0.7);
  }

  .crowd {
    position: absolute;
    bottom: 10%;
    left: 22%;
    width: 60px;
    height: 34px;
    background: radial-gradient(circle, var(--p1) 4px, #fff 5px, transparent 6px) 0 0 / 11px 11px;
    translate: -50% 0;
  }
</style>
