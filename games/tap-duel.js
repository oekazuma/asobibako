export default {
  id: 'tap-duel',
  name: '反射タップ',
  desc: '光ったら先にタップ',

  mount({ top, bottom, finish }) {
    const seats = [[bottom, 1], [top, 2]];
    let phase = 'wait';
    let goAt = 0;

    for (const [el] of seats) {
      el.classList.add('tap-wait');
      el.append(Object.assign(document.createElement('div'), { className: 'big', textContent: 'まて…' }));
    }

    const timer = setTimeout(() => {
      phase = 'go';
      goAt = performance.now();
      for (const [el] of seats) {
        el.classList.replace('tap-wait', 'tap-go');
        el.querySelector('.big').textContent = 'いま!';
      }
    }, 1500 + Math.random() * 3500);

    const handlers = seats.map(([el, player]) => {
      const onDown = (e) => {
        e.preventDefault();
        if (phase === 'done') return;
        if (phase === 'wait') {
          phase = 'done';
          clearTimeout(timer);
          finish(player === 1 ? 2 : 1, `プレイヤー${player} のお手つき`);
          return;
        }
        phase = 'done';
        finish(player, `${((performance.now() - goAt) / 1000).toFixed(3)} 秒`);
      };
      el.addEventListener('pointerdown', onDown);
      return () => el.removeEventListener('pointerdown', onDown);
    });

    return () => {
      clearTimeout(timer);
      for (const off of handlers) off();
    };
  },
};
