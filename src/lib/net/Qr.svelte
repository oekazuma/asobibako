<script lang="ts">
  import { encode } from 'uqr';

  let { text }: { text: string } = $props();

  // 画面越しに読むので、誤り訂正は最小（L）にして点を大きく保つ
  const qr = $derived(encode(text, { ecc: 'L', border: 2 }));
  const path = $derived(qr.data.flatMap((row, y) => row.map((dark, x) => (dark ? `M${x} ${y}h1v1h-1z` : ''))).join(''));
</script>

<svg class="qr" viewBox={`0 0 ${qr.size} ${qr.size}`} role="img" aria-label="つなぐための QR コード" data-code={text}>
  <rect width={qr.size} height={qr.size} fill="#fff" />
  <path d={path} fill="#000" />
</svg>

<style>
  .qr {
    display: block;
    width: 100%;
    height: 100%;
    shape-rendering: crispEdges;
  }
</style>
