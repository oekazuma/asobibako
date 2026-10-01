<script lang="ts">
  import type { Link } from '$lib/net/link';
  import { handshake } from './handshake-hold';

  // 本物の QR の手順はカメラと WebRTC が要るので、つながったことにする口だけをテストへ渡す
  let { onlink }: { onlink: (link: Link) => void } & Record<string, unknown> = $props();
  $effect.pre(() => {
    handshake.onlink = onlink;
  });
</script>

<p class="stub-handshake">handshake</p>
