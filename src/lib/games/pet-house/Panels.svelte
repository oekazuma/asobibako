<script lang="ts">
  import Album from './Album.svelte';
  import { ContestPlay } from './contest-play.svelte';
  import ContestEntry from './ContestEntry.svelte';
  import Feed from './Feed.svelte';
  import type { Panel } from './Menu.svelte';
  import Pets from './Pets.svelte';
  import { Plaza } from './plaza.svelte';
  import type { Session } from './session.svelte';
  import Sheet from './Sheet.svelte';
  import Shop from './Shop.svelte';
  import TeachHud from './TeachHud.svelte';
  import Tricks from './Tricks.svelte';
  import type { ContestId, Kind } from './types';

  let { session, kind, panel = $bindable() }: { session: Session; kind: Kind; panel: Panel | null } = $props();

  const pet = $derived(session.current);
  const close = () => (panel = null);

  function enter(id: ContestId, rank: number) {
    panel = null;
    session.start(new ContestPlay(id, rank), 'コンテストの かいじょうへ いくよ');
  }

  /** ペットに何かさせたら、シートを閉じて 3D の様子を見せる */
  function act(run: () => void) {
    run();
    close();
  }
</script>

{#if !pet}
  <!-- 0 匹のあいだは PetHouse がふれあいひろばを出している -->
{:else if panel === 'feed'}
  <Sheet title="ごはん" onclose={close}>
    <Feed
      food={session.save.food}
      {kind}
      onfeed={(f) => act(() => session.feed(f))}
      onwater={() => act(() => session.water())}
    />
  </Sheet>
{:else if panel === 'tricks'}
  <Sheet title="しつけ" onclose={close}>
    <Tricks {pet} ontrick={(t) => act(() => session.trick(t))} onteach={(t) => act(() => session.teach(t))} />
  </Sheet>
{:else if panel === 'shop'}
  <Sheet title="おみせ" onclose={close}>
    <Shop
      save={session.save}
      trying={session.trying}
      onbuy={(id) => session.buy(id)}
      ontry={(acc) => session.tryOn(acc)}
      onroom={(look) => session.redecorate(look)}
    />
  </Sheet>
{:else if panel === 'album'}
  <Sheet title="アルバム" onclose={close}>
    <Album save={session.save} />
  </Sheet>
{:else if panel === 'contest'}
  <Sheet title="コンテスト" onclose={close}>
    <ContestEntry save={session.save} {pet} onstart={enter} />
  </Sheet>
{:else if panel === 'pets'}
  <Sheet title="なかま" onclose={close}>
    <Pets
      save={session.save}
      {pet}
      onselect={(id) => session.select(id)}
      onwear={(id, acc) => session.wear(id, acc)}
      onname={(id, name, calls) => session.setName(id, name, calls)}
      onadopt={() => {
        close();
        session.visit(new Plaza(), 'ふれあいひろばへ いくよ');
      }}
    />
  </Sheet>
{/if}

{#if session.teaching && !session.activity && !panel}
  <TeachHud {session} trick={session.teaching} {kind} />
{/if}

<style>
  /* シートの中の選ぶボタン。色は各部品が自分のクラスで上書きする */
  :global(.pet-choice) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 8px;
    border: 3px solid var(--line);
    border-radius: 20px;
    background: #fff;
    box-shadow: var(--soft-shadow);
    color: var(--line);
    font-weight: 800;
    cursor: pointer;
  }

  :global(.pet-choice:active) {
    translate: 0 3px;
    box-shadow: var(--soft-press);
  }

  :global(.pet-choice:disabled) {
    background: #eee5db;
    box-shadow: none;
    cursor: default;
  }

  :global(.pet-choice.on) {
    background: var(--pastel-gold);
  }
</style>
