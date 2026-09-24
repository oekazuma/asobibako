<script lang="ts">
  import { HOLE_R, HOLES, POTS } from './engine';
</script>

<!-- 動かない家具。上から見た植木鉢と、ネズミだけが通れる壁の穴 -->
{#each POTS as pot (pot.x)}
  <div class="pot" style:left="{pot.x * 100}%" style:top="{pot.y * 100}%" style:height="{pot.r * 200}%">
    <svg viewBox="-50 -50 100 100" aria-hidden="true">
      <circle r="48" fill="#c8693a" stroke="#8a4520" stroke-width="3" />
      <circle r="38" fill="#6b4226" />
      <!-- 真ん中から 4 方向へ広がる葉 -->
      <path
        d="M0 0Q-18-26-32-10Q-20 2 0 0ZM0 0Q20-28 32-12Q22 2 0 0ZM0 0Q12 20 4 32Q-8 22 0 0ZM0 0Q-22 10-28 24Q-8 20 0 0Z"
        fill="#4caf50"
        stroke="#2e7d32"
        stroke-width="2"
      />
      <circle r="5" fill="#ffc233" />
    </svg>
  </div>
{/each}

{#each HOLES as hole (hole.x)}
  <div class="hole" class:right={hole.x === 1} style:top="{hole.y * 100}%" style:height="{HOLE_R * 200}%"></div>
{/each}

<style>
  .pot,
  .hole {
    position: absolute;
    pointer-events: none;
  }

  .pot {
    aspect-ratio: 1;
    translate: -50% -50%;
    filter: drop-shadow(0 5px 2px rgb(60 36 16 / 0.35));
  }

  .pot svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  /* 壁ぎわの暗いアーチ。左右どちらの穴も同じトンネルにつながっていることを、同じ形で見せる */
  .hole {
    left: 0;
    aspect-ratio: 0.55;
    translate: 0 -50%;
    border: 4px solid #8a4520;
    border-left: none;
    border-radius: 0 999px 999px 0;
    background: radial-gradient(circle at 0 50%, #1c120b 55%, #3a2414);
  }

  .hole.right {
    left: auto;
    right: 0;
    border-left: 4px solid #8a4520;
    border-right: none;
    border-radius: 999px 0 0 999px;
    background: radial-gradient(circle at 100% 50%, #1c120b 55%, #3a2414);
  }
</style>
