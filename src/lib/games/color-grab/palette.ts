import type { Color } from './engine';

/** 色の見分けがつきにくい人にも伝わるよう、形とセットで見せる */
export const GLYPH: Record<Color, string> = { red: '●', blue: '■', yellow: '▲', green: '★' };
export const HEX: Record<Color, string> = { red: '#ef4444', blue: '#3b82f6', yellow: '#facc15', green: '#22c55e' };
export const NAME: Record<Color, string> = { red: 'あか', blue: 'あお', yellow: 'きいろ', green: 'みどり' };
