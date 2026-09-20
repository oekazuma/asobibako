<script lang="ts">
	import { onMount } from 'svelte';
	import { sfx, wake } from '$lib/audio.svelte';
	import {
		createState,
		HOLD_MS,
		ORB_LIFE_MS,
		pop,
		removeOrb,
		spawnOrb,
		type Orb,
		type Player,
	} from './engine';

	let { onfinish }: { onfinish: (winner: Player) => void } = $props();

	const MAX_PER_PLAYER = 3;
	const SPAWN_MS = 340;
	const CONTEST_CHANCE = 0.16;

	const game = $state(createState());
	let holding = $state<number[]>([]);

	const timers = new Set<ReturnType<typeof setTimeout>>();
	const holdTimers = new Map<number, ReturnType<typeof setTimeout>>();

	function later(fn: () => void, ms: number) {
		const t = setTimeout(() => {
			timers.delete(t);
			fn();
		}, ms);
		timers.add(t);
		return t;
	}

	function addOrb(owner: Player | null) {
		const kind = owner === null ? 'contest' : Math.random() < 0.28 ? 'hold' : 'tap';
		const orb = spawnOrb(game, kind, owner);
		later(() => removeOrb(game, orb.id), ORB_LIFE_MS);
	}

	function tick() {
		if (game.winner !== null) return;
		for (const p of [1, 2] as const) {
			if (game.orbs.filter((o) => o.owner === p).length < MAX_PER_PLAYER) addOrb(p);
		}
		if (!game.orbs.some((o) => o.owner === null) && Math.random() < CONTEST_CHANCE) addOrb(null);
	}

	function take(orb: Orb, by: Player) {
		if (!pop(game, orb.id, by)) return;
		sfx[orb.kind]();
		if (game.winner !== null) {
			sfx.finish();
			onfinish(game.winner);
		}
	}

	function startHold(orb: Orb, by: Player) {
		if (holdTimers.has(orb.id)) return;
		holding.push(orb.id);
		holdTimers.set(
			orb.id,
			later(() => {
				endHold(orb.id);
				take(orb, by);
			}, HOLD_MS),
		);
	}

	function endHold(id: number) {
		const t = holdTimers.get(id);
		if (t !== undefined) {
			clearTimeout(t);
			timers.delete(t);
			holdTimers.delete(id);
		}
		const i = holding.indexOf(id);
		if (i >= 0) holding.splice(i, 1);
	}

	function grab(event: PointerEvent, orb: Orb, by: Player) {
		event.preventDefault();
		wake();
		if (orb.kind === 'hold') {
			try {
				(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
			} catch {
				// 合成イベントなどで捕捉できなくても長押し自体は成立させる
			}
			startHold(orb, by);
		} else {
			take(orb, by);
		}
	}

	const label = (orb: Orb, by: Player) =>
		`プレイヤー${by}の${orb.kind === 'hold' ? '長押しの玉' : orb.kind === 'contest' ? '奪い合いの玉' : '玉'}`;

	// $effect だと tick() が game を読むぶん依存に入り、玉が出るたび interval が張り直される
	onMount(() => {
		tick();
		const interval = setInterval(tick, SPAWN_MS);
		return () => {
			clearInterval(interval);
			for (const t of timers) clearTimeout(t);
			timers.clear();
			holdTimers.clear();
		};
	});
</script>

<div
	class="field"
	style:--b={game.border}
	style:--hold="{HOLD_MS}ms"
	style:--life="{ORB_LIFE_MS}ms"
>
	<div class="zone p2"></div>
	<div class="zone p1"></div>

	{#each game.orbs as orb (orb.id)}
		{#if orb.owner !== null}
			<button
				class="orb {orb.kind} p{orb.owner}"
				class:holding={holding.includes(orb.id)}
				style:left="{orb.x * 100}%"
				style:top="{orb.y * 100}%"
				aria-label={label(orb, orb.owner)}
				onpointerdown={(e) => grab(e, orb, orb.owner as Player)}
				onpointerup={() => endHold(orb.id)}
				onpointercancel={() => endHold(orb.id)}
			>
				{#if orb.kind === 'hold'}<span class="fill"></span>{/if}
			</button>
		{/if}
	{/each}

	<div class="border-layer">
		{#each game.orbs as orb (orb.id)}
			{#if orb.owner === null}
				<div class="contest" style:left="{orb.x * 100}%">
					<button
						class="contest-half top"
						aria-label={label(orb, 2)}
						onpointerdown={(e) => grab(e, orb, 2)}
					></button>
					<button
						class="contest-half bottom"
						aria-label={label(orb, 1)}
						onpointerdown={(e) => grab(e, orb, 1)}
					></button>
				</div>
			{/if}
		{/each}
	</div>

	<p class="sr-only" role="status">
		下側の陣地 {Math.round((1 - game.border) * 100)}パーセント
	</p>
</div>

<style>
	.field {
		position: absolute;
		inset: 0;
		overflow: hidden;
		touch-action: none;
	}

	.zone {
		position: absolute;
		inset: 0;
		transition: transform 160ms ease-out;
	}

	.zone.p2 {
		background: var(--zone-2);
		transform: translateY(calc((var(--b) - 1) * 100%));
	}

	.zone.p1 {
		background: var(--zone-1);
		transform: translateY(calc(var(--b) * 100%));
		box-shadow: inset 0 3px 0 rgba(255, 255, 255, 0.85);
	}

	.orb {
		position: absolute;
		width: max(52px, 10dvh);
		height: max(52px, 10dvh);
		padding: 0;
		border: none;
		border-radius: 50%;
		translate: -50% -50%;
		animation: life var(--life) linear forwards;
		touch-action: none;
		cursor: pointer;
	}

	.orb.p1 {
		background: var(--p1);
	}

	.orb.p2 {
		background: var(--p2);
	}

	.orb.hold {
		background: transparent;
		border: 6px solid currentColor;
		display: grid;
		place-items: center;
	}

	.orb.hold.p1 {
		color: var(--p1);
	}

	.orb.hold.p2 {
		color: var(--p2);
	}

	.fill {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		background: currentColor;
		transform: scale(0);
	}

	.orb.holding .fill {
		animation: fill var(--hold) linear forwards;
	}

	.border-layer {
		position: absolute;
		inset: 0;
		pointer-events: none;
		transform: translateY(calc((var(--b) - 0.5) * 100%));
		transition: transform 160ms ease-out;
	}

	.contest {
		position: absolute;
		top: 50%;
		width: max(58px, 11dvh);
		height: max(58px, 11dvh);
		translate: -50% -50%;
		pointer-events: auto;
		animation: life var(--life) linear forwards;
	}

	.contest-half {
		position: absolute;
		left: 0;
		width: 100%;
		height: 50%;
		padding: 0;
		border: none;
		background: var(--gold);
		touch-action: none;
		cursor: pointer;
	}

	.contest-half.top {
		top: 0;
		border-radius: 999px 999px 0 0;
		box-shadow: inset 0 3px 0 var(--p2);
	}

	.contest-half.bottom {
		bottom: 0;
		border-radius: 0 0 999px 999px;
		box-shadow: inset 0 -3px 0 var(--p1);
	}

	@keyframes life {
		0% {
			transform: scale(0.4);
			opacity: 0;
		}
		10% {
			transform: scale(1);
			opacity: 1;
		}
		80% {
			transform: scale(1);
			opacity: 1;
		}
		100% {
			transform: scale(0.6);
			opacity: 0.35;
		}
	}

	@keyframes fill {
		to {
			transform: scale(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.zone,
		.border-layer {
			transition: none;
		}

		.orb,
		.contest {
			animation-name: none;
		}
	}
</style>
