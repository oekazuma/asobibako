<script lang="ts">
  let { locked, onanswer }: { locked: boolean; onanswer: (go: boolean) => void } = $props();
</script>

<div class="veil">
  <section class="as-panel" class:as-locked={locked} aria-label="延長戦">
    <h2 class="as-title">生存成功！</h2>
    <ul class="rules">
      <li>1 分ごとにボスが出て、敵はどんどん強くなる</li>
      <li>延長戦のコインは 1 分ごとに +0.5 倍</li>
      <li>倒れると延長戦のコインは半分。ポーズの「引き上げる」なら全部もらえる</li>
    </ul>
    <button class="as-card as-go" onclick={() => onanswer(true)}>延長戦へ</button>
    <button class="as-card" onclick={() => onanswer(false)}>おわる</button>
  </section>
</div>

<style>
  .veil {
    position: absolute;
    inset: 0;
    z-index: 6;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgb(20 10 30 / 0.7);
    color: #fff3d6;
    font-weight: 800;
  }

  .rules {
    margin: 0;
    padding-left: 1.2em;
    font-size: min(3.8cqw, 2.3cqh, 19px);
    line-height: 1.6;
  }

  .as-card {
    justify-content: center;
    font-size: min(4.6cqw, 2.8cqh, 24px);
  }
</style>
