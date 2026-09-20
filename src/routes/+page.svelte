<script lang="ts">
	import { audio, sfx, toggleMute, wake } from '$lib/audio.svelte';
	import { games } from '$lib/games';
	import type { Player } from '$lib/games/border-rush/engine';

	const game = games[0];
	const Game = game.component;

	let screen = $state<'title' | 'playing' | 'result'>('title');
	let winner = $state<Player>(1);
	let round = $state(0);
	/** 決着タップで指を離した位置にボタンが現れると合成 click が着弾してしまう */
	let shownAt = $state(0);

	const ready = $state<Record<Player, boolean>>({ 1: false, 2: false });
	const pads: Record<Player, Set<number>> = { 1: new Set(), 2: new Set() };

	/** 合成イベントや既に解放されたポインタでは失敗するが、掴み自体は続行してよい */
	function capture(event: PointerEvent) {
		try {
			(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		} catch {
			// noop
		}
	}

	function padDown(event: PointerEvent, player: Player) {
		event.preventDefault();
		wake();
		capture(event);
		pads[player].add(event.pointerId);
		ready[player] = true;
	}

	function padUp(event: PointerEvent, player: Player) {
		pads[player].delete(event.pointerId);
		ready[player] = pads[player].size > 0;
	}

	function start() {
		sfx.start();
		ready[1] = ready[2] = false;
		pads[1].clear();
		pads[2].clear();
		round += 1;
		screen = 'playing';
	}

	function finish(won: Player) {
		winner = won;
		shownAt = Date.now();
		screen = 'result';
	}

	function again() {
		if (Date.now() - shownAt < 350) return;
		start();
	}

	$effect(() => {
		if (screen !== 'title' || !ready[1] || !ready[2]) return;
		const t = setTimeout(start, 550);
		return () => clearTimeout(t);
	});
</script>

{#snippet legend()}
	<span class="legend">
		<span class="item"><span class="mark tap"></span>タップ</span>
		<span class="item"><span class="mark hold"></span>長押し</span>
		<span class="item"><span class="mark contest"></span>早い者勝ち</span>
	</span>
{/snippet}

{#snippet face(player: Player)}
	<span class="title">{game.name}</span>
	<span class="rule">自分の玉を消して境界線を押し込む</span>
	{@render legend()}
	<span class="cta">{ready[player] ? '相手を待っています…' : '長押しでスタート'}</span>
{/snippet}

<main class="board">
	{#if screen === 'playing'}
		{#key round}
			<Game onfinish={finish} />
		{/key}
	{:else if screen === 'title'}
		{#each [2, 1] as const as player (player)}
			<button
				class="half p{player}"
				class:armed={ready[player]}
				onpointerdown={(e) => padDown(e, player)}
				onpointerup={(e) => padUp(e, player)}
				onpointercancel={(e) => padUp(e, player)}
			>
				{@render face(player)}
			</button>
		{/each}
		<button class="mute" onclick={toggleMute} aria-pressed={audio.muted}>
			{audio.muted ? '🔇' : '🔊'}
			<span class="sr-only">音を{audio.muted ? 'オンにする' : 'オフにする'}</span>
		</button>
	{:else}
		{#each [2, 1] as const as player (player)}
			<div class="half result" class:won={winner === player}>
				<span class="outcome" role="status">
					{winner === player ? 'WIN' : 'LOSE'}
				</span>
				<span class="sub">
					{winner === player ? '相手を押し切った' : '押し切られた'}
				</span>
				<button class="again" onclick={again}>もう一度</button>
			</div>
		{/each}
	{/if}
</main>

<style>
	.board {
		position: relative;
		display: flex;
		flex-direction: column;
		height: 100dvh;
		overflow: hidden;
	}

	.half {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: clamp(8px, 1.6dvh, 18px);
		padding: max(12px, env(safe-area-inset-top)) 16px max(12px, env(safe-area-inset-bottom));
		border: none;
		background: var(--bg);
		text-align: center;
		touch-action: none;
		cursor: pointer;
		transition: background-color 140ms;
	}

	.half:first-child {
		transform: rotate(180deg);
		box-shadow: inset 0 -2px 0 #262c39;
	}

	.half.p1.armed {
		background: var(--zone-1);
	}

	.half.p2.armed {
		background: var(--zone-2);
	}

	.title {
		font-size: clamp(26px, 5dvh, 46px);
		font-weight: 800;
		letter-spacing: 0.12em;
	}

	.rule {
		font-size: clamp(12px, 1.9dvh, 17px);
		opacity: 0.75;
	}

	.legend {
		display: flex;
		gap: clamp(12px, 3vw, 28px);
		font-size: clamp(11px, 1.6dvh, 15px);
		opacity: 0.85;
	}

	.item {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.mark {
		width: clamp(14px, 2.2dvh, 22px);
		aspect-ratio: 1;
		border-radius: 50%;
	}

	.mark.tap {
		background: currentColor;
	}

	.mark.hold {
		border: 3px solid currentColor;
	}

	.mark.contest {
		background: var(--gold);
	}

	.cta {
		margin-top: clamp(4px, 1dvh, 12px);
		padding: 10px 22px;
		border: 1px solid #39404f;
		border-radius: 999px;
		font-size: clamp(13px, 2dvh, 18px);
	}

	.mute {
		position: absolute;
		top: 50%;
		right: 10px;
		translate: 0 -50%;
		width: 44px;
		height: 44px;
		border: 1px solid #262c39;
		border-radius: 50%;
		background: #171c26;
		font-size: 18px;
		cursor: pointer;
	}

	.half.result {
		background: #2a1113;
	}

	.half.result.won {
		background: #0d3b34;
	}

	.outcome {
		font-size: clamp(40px, 11dvh, 110px);
		font-weight: 800;
		letter-spacing: 0.1em;
	}

	.sub {
		font-size: clamp(13px, 2.2dvh, 20px);
		opacity: 0.8;
	}

	.again {
		margin-top: clamp(8px, 2dvh, 24px);
		padding: 14px 30px;
		border: 1px solid #ffffff44;
		border-radius: 14px;
		background: #ffffff1a;
		font-size: clamp(15px, 2.4dvh, 20px);
		cursor: pointer;
	}

	@media (prefers-reduced-motion: reduce) {
		.half {
			transition: none;
		}
	}
</style>
