import { sprite } from '$lib/fx';

/** 雪の積もったもみの木 */
export const pine = () =>
  sprite('pine', 128, (c) => {
    c.fillStyle = '#7a4e2e';
    c.fillRect(0.45, 0.78, 0.1, 0.16);
    const tiers = [
      [0.62, 0.34, 0.95],
      [0.42, 0.27, 0.72],
      [0.22, 0.2, 0.5]
    ];
    for (const [y, w, bottom] of tiers) {
      const g = c.createLinearGradient(0.2, 0, 0.8, 0);
      g.addColorStop(0, '#2f8f5b');
      g.addColorStop(1, '#1d6b41');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0.5, y - 0.2);
      c.lineTo(0.5 + w, bottom - 0.12);
      c.lineTo(0.5 - w, bottom - 0.12);
      c.fill();
      c.fillStyle = '#fff';
      c.beginPath();
      c.moveTo(0.5, y - 0.2);
      c.lineTo(0.5 + w * 0.45, y - 0.02);
      c.quadraticCurveTo(0.5, y + 0.04, 0.5 - w * 0.45, y - 0.02);
      c.fill();
    }
  });

/** たき火のまわりの光 */
export const fireGlow = () =>
  sprite('fire-glow', 128, (c) => {
    const g = c.createRadialGradient(0.5, 0.5, 0, 0.5, 0.5, 0.5);
    g.addColorStop(0, 'rgb(255 170 60 / 0.55)');
    g.addColorStop(1, 'rgb(255 120 30 / 0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 1, 1);
  });
