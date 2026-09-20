import { games } from './games/index.js';

const top = document.getElementById('top');
const bottom = document.getElementById('bottom');
// プレイヤー1 = 手前 (bottom)、プレイヤー2 = 向かい (top)
const seats = [[bottom, 1], [top, 2]];

let cleanup = null;
let current = null;
let shownAt = 0;

function clearScreen() {
  shownAt = performance.now();
  if (cleanup) cleanup();
  cleanup = null;
  for (const [el] of seats) {
    el.replaceChildren();
    el.className = `half ${el.id}`;
  }
}

function panel(...children) {
  const el = document.createElement('div');
  el.className = 'panel';
  el.append(...children);
  return el;
}

function h(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

function button(text, onClick) {
  const el = h('button', null, text);
  el.addEventListener('click', () => {
    // pointerdown で決着した指を離すと、その座標に現れたボタンへ合成 click が届いて
    // 結果画面が一瞬で飛ばされる。描画直後の click は捨てる
    if (performance.now() - shownAt < 300) return;
    onClick();
  });
  return el;
}

function showMenu() {
  clearScreen();
  current = null;
  for (const [el] of seats) {
    const list = h('div', 'menu-list');
    for (const game of games) {
      list.append(button(`${game.name} — ${game.desc}`, () => start(game)));
    }
    el.append(panel(h('h1', null, 'Table Duel'), h('p', null, '2人でiPadを囲んで対戦'), list));
  }
}

function start(game) {
  clearScreen();
  current = game;
  let done = false;
  const finish = (winner, note) => {
    if (done) return;
    done = true;
    showResult(winner, note);
  };
  cleanup = game.mount({ top, bottom, finish }) ?? null;
}

function showResult(winner, note) {
  const game = current;
  clearScreen();
  for (const [el, player] of seats) {
    const outcome = winner === 0 ? 'draw' : winner === player ? 'win' : 'lose';
    el.classList.add(outcome);
    const buttons = h('div', 'buttons');
    buttons.append(button('もう一度', () => start(game)), button('ゲーム選択', showMenu));
    el.append(panel(
      h('div', 'result', { win: 'WIN', lose: 'LOSE', draw: 'DRAW' }[outcome]),
      note ? h('div', 'note', note) : h('div', 'note', ''),
      buttons,
    ));
  }
}

showMenu();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}
