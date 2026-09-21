<!-- 境界線を押し合う盤面：上下の陣地・白い境界線・両者の玉・線の上の金の玉 -->
<div class="thumb" aria-hidden="true">
  <span class="zone p2"></span>
  <span class="zone p1"></span>
  <span class="orb p2" style:left="22%" style:top="22%"></span>
  <span class="orb p2 ring" style:left="70%" style:top="30%"></span>
  <span class="orb p1" style:left="34%" style:top="80%"></span>
  <span class="orb p1" style:left="78%" style:top="74%"></span>
  <span class="orb gold" style:left="52%" style:top="58%"></span>
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
  }

  .zone.p2 {
    top: 0;
    height: 58%;
    background: var(--p2-soft);
  }

  .zone.p1 {
    bottom: 0;
    height: 42%;
    background: var(--p1-soft);
    box-shadow: 0 -4px 0 #fff;
  }

  .orb {
    position: absolute;
    width: 22%;
    aspect-ratio: 1;
    max-width: 44px;
    border: 3px solid #fff;
    border-radius: 50%;
    translate: -50% -50%;
    box-shadow: 0 3px 0 rgb(43 45 66 / 0.18);
  }

  .orb.p1 {
    background: var(--p1);
  }

  .orb.p2 {
    background: var(--p2);
  }

  .orb.ring {
    border: 6px solid var(--p2);
    background: #fff;
  }

  .orb.gold {
    background: var(--gold);
  }
</style>
