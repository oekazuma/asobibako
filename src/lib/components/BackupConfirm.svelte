<script lang="ts">
  import { Gate, MAX_FAILS } from '$lib/gate.svelte';
  import { importAll, summarize, type Backup } from '$lib/backup';

  let {
    pending,
    from = '書き出し',
    oncancel,
    onfail
  }: { pending: Backup; from?: string; oncancel: () => void; onfail: (message: string) => void } = $props();

  // 親が選び直すたびにこの部品ごと作り直すので、計算と入力もそのたびにまっさらになる
  const gate = new Gate();
  const sum = $derived(summarize(pending));
  let ans = $state('');
  let agreed = $state(false);

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!gate.submit(ans)) return void (ans = '');
    if (importAll(pending)) return location.reload();
    onfail('読み込めませんでした（保存できる容量を超えています）。いまの記録は元のままです。');
  }
</script>

<form class="confirm" onsubmit={submit}>
  <p><b>{sum.games} 本</b>のゲームの記録・{sum.keys} 件（{sum.at} に{from}）</p>
  <p class="warn">いまこの端末にある記録は<b>すべて置き換わります</b>。元に戻せません。</p>
  {#if gate.locked}
    <p class="err">きょうは {MAX_FAILS} 回間違えたため、読み込みは明日まで行えません。</p>
  {:else}
    <label class="gate"
      >保護者の方が計算に答えてください <b>{gate.a} × {gate.b} =</b>
      <input type="number" inputmode="numeric" bind:value={ans} required /></label
    >
    {#if gate.wrong}<p class="err">違います。あと {gate.left} 回。</p>{/if}
    <label class="agree"><input type="checkbox" bind:checked={agreed} /> 置き換えることを確認しました</label>
  {/if}
  <div class="row">
    <button type="button" class="pill" onclick={oncancel}>やめる</button>
    <button type="submit" class="pill p2" disabled={gate.locked || !agreed || !ans}>読み込む</button>
  </div>
</form>

<style>
  p {
    font-size: 14px;
    font-weight: 700;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 12px;
  }

  .pill {
    padding: 8px 18px;
    font-size: 14px;
  }

  .pill:disabled {
    cursor: default;
    opacity: 0.45;
  }

  .confirm {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 3px dashed var(--pastel-p2);
  }

  .warn,
  .err {
    color: var(--p2-deep);
  }

  .gate {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    font-size: 14px;
    font-weight: 700;
  }

  .gate input {
    width: 90px;
    padding: 4px 10px;
    border: 3px solid var(--line);
    border-radius: 12px;
    color: var(--line);
    font: inherit;
    font-size: 18px;
    /* 全体の user-select: none を継ぐと iOS Safari で入力できなくなる */
    user-select: text;
    -webkit-user-select: text;
  }

  .agree {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    font-size: 14px;
    font-weight: 700;
  }

  .agree input {
    width: 20px;
    height: 20px;
    accent-color: var(--pastel-p2);
  }
</style>
