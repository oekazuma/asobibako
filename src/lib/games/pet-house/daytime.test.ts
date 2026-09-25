import { afterEach, describe, expect, it } from 'vitest';
import { createActor, think, type WorldView } from './behavior';
import { daylight, greeting, now, phaseOf, weatherOn, type Weather } from './daytime';
import { Rng } from '$lib/levels';
import { adopt, newSave, type Pet } from './engine';
import { ROOM } from './layout';

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const bright = (hex: string) => rgb(hex).reduce((s, v) => s + v, 0) / 3;

describe('daylight', () => {
  it('昼の晴れは、時間帯を入れる前の光と同じ', () => {
    const d = daylight(12, 'sunny');
    const sun = [-2.6, 4, -0.8].map((v) => v / Math.hypot(2.6, 4, 0.8));
    d.sun.dir.forEach((v, i) => expect(v).toBeCloseTo(sun[i], 3));
    expect(d.sun).toMatchObject({ color: '#ffe2c2', power: 3 });
    expect(d.room.power).toBe(3);
    expect(d.lamps).toBe(0);
    expect(d.patch.power).toBe(1);
    expect(d.view).toBe('#ffffff');
  });

  it('時間帯の境目で光が飛ばない', () => {
    for (let h = 0; h < 24; h += 0.1) {
      const a = daylight(h, 'sunny');
      const b = daylight(h + 0.1, 'sunny');
      expect(Math.abs(a.sun.power - b.sun.power)).toBeLessThan(0.15);
      expect(Math.abs(a.lamps - b.lamps)).toBeLessThan(0.1);
      expect(Math.abs(bright(a.sky[0]) - bright(b.sky[0]))).toBeLessThan(10);
    }
  });

  it('朝は日が低く白っぽい、夕方は低くオレンジ色、夜は日だまりが消えてランプがつく', () => {
    const noon = daylight(12, 'sunny');
    const morning = daylight(8, 'sunny');
    const evening = daylight(17, 'sunny');
    const night = daylight(22, 'sunny');
    expect(morning.sun.dir[1]).toBeLessThan(noon.sun.dir[1]);
    const [r, g, b] = rgb(morning.sun.color);
    expect(Math.min(r, g, b)).toBeGreaterThan(215);
    expect(evening.sun.dir[1]).toBeLessThan(morning.sun.dir[1]);
    const [er, , eb] = rgb(evening.sun.color);
    expect(er - eb).toBeGreaterThan(120);
    expect(evening.patch.power).toBeGreaterThan(1);
    expect(night.patch.power).toBe(0);
    expect(night.lamps).toBe(1);
    expect(night.stars).toBe(1);
    expect(bright(night.sky[0])).toBeLessThan(60);
  });

  it('夜でも真っ暗にしない（ペットと床が見える）', () => {
    for (const w of ['sunny', 'rain', 'snow'] as Weather[]) {
      const d = daylight(2, w);
      // 雨の夜は月がほとんど無いぶん、空の照り返しで見せる
      expect(d.sun.power + d.hemi.power).toBeGreaterThan(1.2);
      expect(d.hemi.power).toBeGreaterThan(0.9);
      expect(d.room.power).toBeGreaterThan(1.2);
    }
  });

  it('日だまりが向かいの壁を突き抜けないよう、日は 33 度より下がらない', () => {
    for (let h = 0; h < 24; h += 0.25) {
      const [x, y, z] = daylight(h, 'sunny').sun.dir;
      expect(Math.atan2(y, Math.hypot(x, z))).toBeGreaterThan((33 * Math.PI) / 180);
      // いつも左の窓の側から差す
      expect(x).toBeLessThan(0);
    }
  });

  it('雨の日は日だまりがなく、空が灰色になり、部屋の明かりが少しつく', () => {
    const rain = daylight(12, 'rain');
    const [r, g, b] = rgb(rain.sky[0]);
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(40);
    expect(rain.patch.power).toBe(0);
    expect(rain.sun.power).toBeLessThan(1.5);
    expect(rain.lamps).toBeGreaterThan(0.3);
    expect(rain.stars).toBe(0);
  });

  it('時間帯の名前', () => {
    expect([4.9, 5, 9.9, 10, 15.9, 16, 18.9, 19, 23].map(phaseOf)).toEqual([
      'night',
      'morning',
      'morning',
      'day',
      'day',
      'evening',
      'evening',
      'night',
      'night'
    ]);
    expect(greeting('day', 'rain')).toBe('きょうは あめだね');
  });
});

describe('weatherOn', () => {
  it('同じ日は同じ天気', () => {
    expect(weatherOn(2026, 9, 25)).toBe(weatherOn(2026, 9, 25));
  });

  it('雨は 2 割、くもりは 2 割くらい、雪は冬だけ', () => {
    const tally = (months: number[]) => {
      const n: Record<Weather, number> = { sunny: 0, cloudy: 0, rain: 0, snow: 0 };
      let all = 0;
      for (let y = 2025; y < 2035; y++)
        for (const m of months)
          for (let d = 1; d <= 28; d++) {
            n[weatherOn(y, m, d)]++;
            all++;
          }
      return Object.fromEntries(Object.entries(n).map(([k, v]) => [k, v / all])) as Record<Weather, number>;
    };
    const summer = tally([3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(summer.snow).toBe(0);
    expect(summer.rain).toBeGreaterThan(0.15);
    expect(summer.rain).toBeLessThan(0.25);
    expect(summer.cloudy).toBeGreaterThan(0.15);
    expect(summer.cloudy).toBeLessThan(0.25);
    const winter = tally([12, 1, 2]);
    expect(winter.snow).toBeGreaterThan(0.15);
    expect(winter.snow).toBeLessThan(0.25);
  });
});

describe('now', () => {
  afterEach(() => {
    delete (globalThis as { __asobibakoClock?: unknown }).__asobibakoClock;
  });

  it('端末の時計の時刻', () => {
    expect(now(new Date(2026, 8, 25, 18, 30)).hour).toBe(18.5);
  });

  it('隠しの口で時刻と天気を差し替えられる', () => {
    (globalThis as { __asobibakoClock?: unknown }).__asobibakoClock = { hour: 21, weather: 'snow' };
    expect(now(new Date(2026, 8, 25, 12))).toEqual({ hour: 21, weather: 'snow' });
  });
});

describe('夜の眠さ', () => {
  const sleeps = (night: number) => {
    const save = newSave(0);
    save.money = 10000;
    const pet = adopt(save, 'shiba', 'ポチ') as Pet;
    pet.stats = { food: 100, water: 100, clean: 100, energy: 30 };
    const a = createActor(pet, { x: ROOM.front.x, z: ROOM.front.z });
    const view: WorldView = {
      scene: 'room',
      layout: ROOM,
      bowls: { food: null, foodLeft: 0, waterLeft: 0 },
      toy: null,
      wand: null,
      presents: [],
      night
    };
    const rng = new Rng(3).next;
    for (let i = 0; i < 30 * 60; i++) {
      think([a], [pet], view, 1 / 30, rng);
      if (a.asleep) return true;
    }
    return false;
  };

  it('げんき 30 は、昼は寝ず、夜は寝る', () => {
    expect(sleeps(0)).toBe(false);
    expect(sleeps(1)).toBe(true);
  });
});
