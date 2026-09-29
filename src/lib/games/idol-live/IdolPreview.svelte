<script lang="ts">
  import { onMount } from 'svelte';
  import { PerspectiveCamera, Scene } from 'three';
  import { animate } from '$lib/loop';
  import { blend, groove, POSES } from './dance';
  import { Idol3D } from './idol3d';
  import type { Coord } from './outfits';
  import { Blink, draw, free, mount } from './view3d';

  /** じゅんびの画面で、着せた服のままリズムに乗って待つアイドル。着がえるたびにポーズをきめる */
  let { coord }: { coord: Coord } = $props();

  let box: HTMLDivElement;

  onMount(() => {
    const unmount = mount(box);
    const scene = new Scene();
    const idol = new Idol3D();
    const camera = new PerspectiveCamera(26, 1, 0.05, 30);
    const blink = new Blink();
    scene.add(idol.group);
    let t = 0;
    let show = 0;
    let last = '';
    const stop = animate((dt) => {
      t += dt;
      const key = Object.values(coord).join();
      if (key !== last) {
        idol.dress({ ...coord });
        [last, show] = [key, last ? 1.4 : 0];
      }
      show = Math.max(0, show - dt);
      const w = box.clientWidth;
      const h = box.clientHeight;
      if (!w || !h) return;
      const u = Math.min(1, show * 3, (1.4 - show) * 4);
      const p = groove(blend(POSES.idle, POSES.appealR, show > 0 ? u : 0), t * 2, 0.6);
      idol.pose(p, { face: show > 0 ? 'wink' : 'smile', mouth: 0, blink: blink.step(dt) }, dt);
      camera.aspect = w / h;
      camera.position.set(0.45, 1.0, 4.2);
      camera.lookAt(0, 0.84, 0);
      camera.updateProjectionMatrix();
      draw(scene, camera, w, h);
    });
    return () => {
      stop();
      free(scene);
      unmount();
    };
  });
</script>

<div class="preview" bind:this={box} role="img" aria-label="ミオ"></div>

<style>
  .preview {
    position: relative;
    width: 100%;
    height: 100%;
  }
</style>
