<!-- 押す力が強まった合図を、両方のプレイヤーに向けて 1 回だけ出す -->
{#each [1, 2] as player (player)}
  <div class="rush-call p{player}" aria-hidden="true"><span class="sticker">ラッシュ！</span></div>
{/each}

<style>
  .rush-call {
    position: absolute;
    left: 0;
    right: 0;
    height: 50%;
    display: grid;
    place-items: center;
    pointer-events: none;
  }

  .rush-call.p1 {
    bottom: 0;
  }

  .rush-call.p2 {
    top: 0;
    rotate: 180deg;
  }

  .sticker {
    color: var(--gold-deep);
    font-size: min(10cqh, 16cqw);
    animation: call 1400ms var(--spring) forwards;
  }

  @keyframes call {
    0% {
      scale: 0.3;
      opacity: 0;
    }
    15% {
      scale: 1;
      opacity: 1;
    }
    80% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  /* 動きを止めても、出たまま残らないよう薄れて消える */
  @media (prefers-reduced-motion: reduce) {
    .sticker {
      animation-name: fade;
    }
  }

  @keyframes fade {
    80% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
</style>
