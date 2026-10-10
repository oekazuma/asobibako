import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

// 頭脳から先で three を読み込むと、ここで投げて import が失敗する
vi.mock('three', () => {
  throw new Error('three を読み込んだ');
});

describe('CPU の頭脳', () => {
  it('three を読み込まない', async () => {
    await expect(import('./bot')).resolves.toBeDefined();
  });

  it('DOM を使わない（3D に聞くのは senses3d.ts だけ）', () => {
    // vitest はリポジトリの根で走る（games.test.ts の static/thumbs と同じ読み方）
    const dir = 'src/lib/games/yappari-chameleon/cpu';
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'senses3d.ts');
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(readFileSync(`${dir}/${f}`, 'utf8'), f).not.toMatch(/\bdocument\.|\bwindow\./);
  });
});
