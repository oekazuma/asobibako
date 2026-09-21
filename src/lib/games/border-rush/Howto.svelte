<span class="rule">自分の玉を消して境界線を押し込む</span>
<span class="legend">
  <span class="item"><span class="mark tap"></span>タップ</span>
  <span class="item"><span class="mark hold"></span>長押し</span>
  <span class="item"><span class="mark contest"></span>早い者勝ち</span>
</span>

<style>
  .rule {
    font-size: clamp(12px, 1.9dvh, 17px);
    opacity: 0.75;
  }

  .legend {
    display: flex;
    gap: clamp(12px, 3vw, 28px);
    font-size: clamp(11px, 1.6dvh, 15px);
    opacity: 0.85;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .mark {
    width: clamp(14px, 2.2dvh, 22px);
    aspect-ratio: 1;
    border-radius: 50%;
  }

  .mark.tap {
    background: currentColor;
  }

  .mark.hold {
    border: 3px solid currentColor;
  }

  .mark.contest {
    background: var(--gold);
  }
</style>
