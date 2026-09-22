import { sprite } from '$lib/fx';

/** 走る人。frame 0 と 1 で足を入れ替える。色は群れごと */
export function runner(color: string, deep: string, frame: 0 | 1) {
  return sprite(`runner:${color}:${frame}`, 96, (c) => {
    c.beginPath();
    c.ellipse(0.5, 0.93, 0.2, 0.05, 0, 0, Math.PI * 2);
    c.fillStyle = 'rgb(43 45 66 / 0.2)';
    c.fill();
    c.lineCap = 'round';
    c.lineWidth = 0.1;
    c.strokeStyle = deep;
    const step = frame === 0 ? 0.08 : -0.08;
    for (const s of [step, -step]) {
      c.beginPath();
      c.moveTo(0.5, 0.66);
      c.lineTo(0.5 + s, 0.88);
      c.stroke();
    }
    const body = c.createLinearGradient(0.3, 0, 0.7, 0);
    body.addColorStop(0, color);
    body.addColorStop(1, deep);
    c.fillStyle = body;
    c.beginPath();
    c.roundRect(0.33, 0.36, 0.34, 0.34, 0.14);
    c.fill();
    const head = c.createRadialGradient(0.45, 0.18, 0.02, 0.5, 0.24, 0.16);
    head.addColorStop(0, '#fff');
    head.addColorStop(0.35, color);
    head.addColorStop(1, deep);
    c.fillStyle = head;
    c.beginPath();
    c.arc(0.5, 0.24, 0.15, 0, Math.PI * 2);
    c.fill();
  });
}

/** 道の終わりの敵の城 */
export const castle = () =>
  sprite('castle', 256, (c) => {
    const wall = c.createLinearGradient(0, 0.3, 0, 1);
    wall.addColorStop(0, '#ff8a95');
    wall.addColorStop(1, '#c42a3b');
    c.fillStyle = wall;
    c.strokeStyle = '#fff';
    c.lineWidth = 0.02;
    c.beginPath();
    c.rect(0.12, 0.4, 0.76, 0.56);
    c.fill();
    c.stroke();
    for (const x of [0.06, 0.72]) {
      c.beginPath();
      c.rect(x, 0.22, 0.22, 0.74);
      c.fill();
      c.stroke();
      c.fillStyle = '#8f1a28';
      c.beginPath();
      c.moveTo(x - 0.03, 0.23);
      c.lineTo(x + 0.11, 0.04);
      c.lineTo(x + 0.25, 0.23);
      c.fill();
      c.fillStyle = wall;
    }
    c.fillStyle = '#5b1620';
    c.beginPath();
    c.roundRect(0.38, 0.62, 0.24, 0.34, [0.12, 0.12, 0, 0]);
    c.fill();
    c.fillStyle = '#ffc233';
    c.beginPath();
    c.moveTo(0.5, 0.18);
    c.lineTo(0.5, 0.4);
    c.stroke();
    c.beginPath();
    c.moveTo(0.5, 0.18);
    c.lineTo(0.64, 0.23);
    c.lineTo(0.5, 0.28);
    c.fill();
  });

/** 道ばたの木 */
export const tree = () =>
  sprite('tree', 128, (c) => {
    c.fillStyle = '#8a5a3b';
    c.fillRect(0.45, 0.62, 0.1, 0.32);
    const leaf = c.createRadialGradient(0.4, 0.3, 0.05, 0.5, 0.45, 0.4);
    leaf.addColorStop(0, '#9be36b');
    leaf.addColorStop(1, '#2f9e44');
    c.fillStyle = leaf;
    for (const [x, y, r] of [
      [0.5, 0.3, 0.24],
      [0.33, 0.48, 0.2],
      [0.67, 0.48, 0.2]
    ]) {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
  });
