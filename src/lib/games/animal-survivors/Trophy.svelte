<script lang="ts">
  import type { AchievementDef } from './achievements';

  let { a }: { a: AchievementDef } = $props();
</script>

<p class="trophy"><b>実績達成！</b><span>{a.name}</span><span class="coins">+{a.coins}</span></p>

<style>
  .trophy {
    display: flex;
    flex-wrap: wrap;
    gap: 0 0.8em;
    justify-content: center;
    margin: 0;
    padding: 6px 12px;
    border: 3px solid #ffd84a;
    background: #3a2a14;
    color: #fff3d6;
    font-size: min(4cqw, 2.4cqh, 20px);
    animation: pop 360ms steps(4);
  }

  b,
  .coins {
    color: #ffd84a;
  }

  @keyframes pop {
    from {
      scale: 0.5;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .trophy {
      animation: none;
    }
  }
</style>
