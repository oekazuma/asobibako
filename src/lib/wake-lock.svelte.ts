/** 机に置いて遊ぶので、画面が暗転するとゲームが中断してしまう */
export function keepScreenAwake(): () => void {
	let sentinel: WakeLockSentinel | undefined;

	const acquire = async () => {
		if (document.visibilityState !== 'visible') return;
		try {
			sentinel = await navigator.wakeLock?.request('screen');
		} catch {
			// 非対応ブラウザ、またはユーザー操作なしで拒否された場合
		}
	};

	void acquire();
	document.addEventListener('visibilitychange', acquire);

	return () => {
		document.removeEventListener('visibilitychange', acquire);
		void sentinel?.release();
	};
}
