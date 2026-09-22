<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
</script>

<!-- 雪原のクマと、お肉を背負った主人公、キャンプのたき火 -->
<div class="thumb" aria-hidden="true">
  <span class="e tree a"><Icon name="pine" /></span>
  <span class="e tree b"><Icon name="pine" /></span>
  <span class="e bear"><Icon name="bear" /></span>
  <span class="e hero"><Icon name="kid" /></span>
  <span class="e meat"><Icon name="meat" /></span>
  <span class="e fire"><Icon name="fire" /></span>
  <span class="camp"></span>
</div>

<style>
  .thumb {
    position: relative;
    height: 100%;
    background: #eef6ff;
  }

  .camp {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 30%;
    background: #fff4e2;
    border-top: 4px solid #b07a4f;
  }

  .e {
    position: absolute;
    z-index: 1;
    translate: -50% -50%;
  }

  .tree {
    font-size: 26px;
  }

  .a {
    left: 12%;
    top: 30%;
  }

  .b {
    left: 88%;
    top: 22%;
  }

  .bear {
    left: 34%;
    top: 36%;
    font-size: 34px;
  }

  .hero {
    left: 58%;
    top: 55%;
    font-size: 28px;
  }

  .meat {
    left: 58%;
    top: 30%;
    font-size: 18px;
  }

  .fire {
    left: 80%;
    top: 84%;
    font-size: 26px;
  }
</style>
