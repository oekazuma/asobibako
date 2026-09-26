import { afterEach, describe, expect, it, vi } from 'vitest';
import { dataUrlFile, saveImage } from './share';

describe('share', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('dataUrlFile は data URL を同じ中身の File にする', () => {
    const file = dataUrlFile('data:image/png;base64,iVBORw0KGgo=', 'a.png');
    expect(file.type).toBe('image/png');
    expect(file.name).toBe('a.png');
    expect(file.size).toBe(8);
  });

  it('saveImage は共有シートを使える端末で share を呼ぶ', () => {
    const share = vi.fn(async () => {});
    vi.stubGlobal('navigator', { canShare: () => true, share });
    saveImage('data:image/png;base64,iVBORw0KGgo=', 'a.png');
    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0][0].files[0].name).toBe('a.png');
  });

  it('saveImage は url が空なら何もしない', () => {
    const share = vi.fn(async () => {});
    vi.stubGlobal('navigator', { canShare: () => true, share });
    saveImage('', 'a.png');
    expect(share).not.toHaveBeenCalled();
  });
});
