// 実行: pnpm spots
// やっぱりカメレオンの隠れる CPU の候補（cpu/spots.ts の SPOTS）を 1 つずつ置いて CPU と同じ塗り方で塗り、
// その部屋の網の点の目の高さから強い CPU の目で描いた目立ちの平均を cpu/spot-seen.ts に書く。
// --skill weak|normal|strong で塗る強さを、--from <json> で測る候補の並びを替え、--out <json> に点ごとの値を書く（表は書かない）。
// ブラウザはダウンロードせず、端末の Google Chrome を使う
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { chromium, type Browser } from 'playwright-core';
import { createServer } from 'vite';
import type { Spot } from '../src/lib/games/yappari-chameleon/cpu/spots.ts';

const OUT = 'src/lib/games/yappari-chameleon/cpu/spot-seen.ts';
const BASE = '/asobibako/src/lib/games/yappari-chameleon';
const { values: args } = parseArgs({
  options: { skill: { type: 'string', default: 'strong' }, from: { type: 'string' }, out: { type: 'string' } }
});
if ((args.skill !== 'strong' || args.from) && !args.out) throw new Error('--skill と --from は --out といっしょに使う');

interface Row {
  key: string | null;
  room: string;
  seen: number;
  max: number;
  eyes: number[];
  rays: number;
  dabs: number;
}

/** ページの中で測る口を作る。ひとりで試すの体（席 1）を候補に置き、CPU の頭脳と 3D の目をそのまま使う */
async function setup(base: string): Promise<number> {
  const load = (p: string) => import(/* @vite-ignore */ `${base}/${p}`);
  const [hider, levels, spots, senses3d, paths, layout, move, oversight, rngs] = await Promise.all(
    [
      'cpu/hider.ts',
      'cpu/levels.ts',
      'cpu/spots.ts',
      'cpu/senses3d.ts',
      'cpu/paths.ts',
      'mansion/layout.ts',
      'move.ts',
      'oversight.ts',
      'rng.ts'
    ].map(load)
  );
  type V3 = [number, number, number];
  interface Body {
    pos: V3;
    yaw: number;
  }
  /** ひとりで試すの Play のうち、ここで使うところ */
  interface Play {
    mode: string;
    toggleEye(): void;
    ghost: Body;
    body: Body;
    setPose(id: string): void;
    log: { clear(): void; add(dabs: unknown[]): void };
    rebuildPaint(): void;
    world: { level: unknown; rig: unknown };
  }
  const play = (window as unknown as { __chameleon: Play }).__chameleon;
  const world = play.world;
  const eye = new senses3d.Senses3d(world, (seat: number) => (seat === 1 ? world.rig : null));
  let rays = 0;
  const senses = {
    visible: eye.visible.bind(eye),
    surface: eye.surface.bind(eye),
    colorAt: (o: V3, d: V3) => (rays++, eye.colorAt(o, d))
  };
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const H = move.EYE_HEIGHT;
  (window as unknown as { __spots: unknown }).__spots = {
    list: spots.SPOTS,
    async measure(spot: Spot, skill: string): Promise<Row> {
      const room: string = layout.placeOf(spot.pos);
      const eyes = Object.entries(paths.NODES as Record<string, V3>)
        .filter(([k, n]) => layout.placeOf(n) === room || (room === '大広間' && k === 'entrance'))
        .map(([, n]) => [n[0], n[1] + H, n[2]] as V3);
      // カメラ（一人称）を部屋の網の点に置き、画面の明るさをその部屋に合わせる。一人称のあいだ体は動かない
      if (play.mode !== 'eye') play.toggleEye();
      play.ghost = move.newBody([eyes[0][0], eyes[0][1] - H, eyes[0][2]]);
      play.body = { ...move.newBody([...spot.pos]), yaw: spot.yaw, cling: spot.cling, ground: !spot.cling };
      play.setPose(spot.pose);
      play.log.clear();
      play.rebuildPaint();
      await sleep(1500);
      const me = { ...play.body, ms: 0, pose: spot.pose, crouch: false, paint: false, look: [spot.yaw, 0], eye: null };
      const brain = new hider.HiderBrain(spot, levels.SKILLS[skill], rngs.rng(7));
      const ctx = { me: 1, view: { phase: 'hide' }, level: world.level, bodies: new Map(), senses, now: 0, act() {} };
      rays = 0;
      for (let i = 0; i < 60 * 60 && !brain.done; i++) {
        ctx.now += 1000 / 60;
        brain.step(ctx, 1 / 60);
        if (i % 30 === 0) await frame();
      }
      play.log.add(brain.log.dabs);
      play.rebuildPaint();
      await frame();
      await frame();
      const at = oversight.bodyPoints(me)[0];
      const seen: number[] = [];
      // 目で描くと 1 回ごとに止まるので、古い 3D と言われないよう 1 回ずつ画面を描かせる
      for (const e of eyes) {
        await frame();
        seen.push(eye.visible(1, 2, e, at, levels.SKILLS.strong.diff) ?? NaN);
      }
      return {
        key: spots.spotKey?.(spot) ?? null,
        room,
        seen: seen.reduce((a, v) => a + v, 0) / seen.length,
        max: Math.max(...seen),
        eyes: seen,
        rays,
        dabs: brain.log.dabs.length
      };
    }
  };
  return spots.SPOTS.length;
}

const server = await createServer({ server: { port: 0, hmr: false, watch: null }, logLevel: 'error' });
let browser: Browser | undefined;
try {
  await server.listen();
  const base = server.resolvedUrls?.local[0];
  if (!base) throw new Error('dev サーバーの URL が取れない');
  browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  page.on('pageerror', (e) => console.error(e.message));
  await page.goto(`${base}/games/yappari-chameleon`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'ひとりで試す' }).click();
  await page.waitForFunction(() => 'world' in ((window as unknown as { __chameleon?: object }).__chameleon ?? {}));
  const count = await page.evaluate(setup, BASE);
  const from = args.from ? (JSON.parse(await readFile(args.from, 'utf8')) as unknown[]) : null;
  const rows: Row[] = [];
  for (let i = 0; i < (from?.length ?? count); i++) {
    const row = await page.evaluate(
      ([i, spot, skill]) => {
        const s = (window as unknown as { __spots: { list: unknown[]; measure(s: unknown, k: string): Promise<Row> } })
          .__spots;
        return s.measure(spot ?? s.list[i], skill);
      },
      [i, from?.[i] ?? null, args.skill] as const
    );
    rows.push(row);
    console.log(
      `${i} ${row.room} ${row.key ?? ''} seen ${row.seen.toFixed(3)} max ${row.max.toFixed(3)} rays ${row.rays}`
    );
  }
  if (args.out) await writeFile(args.out, JSON.stringify(rows, null, 2));
  else {
    const lines = rows.map((r, i) => `  '${r.key}': ${Number(r.seen.toFixed(3))}${i < rows.length - 1 ? ',' : ''}`);
    await writeFile(
      OUT,
      [
        '// pnpm spots が書く表。手で直さず、spots.ts の候補を変えたら測り直す',
        '',
        '/** 候補（spotKey）ごとの、その部屋の網の点から強い CPU の目で見た目立ちの平均（0..1） */',
        'export const SEEN: Record<string, number> = {',
        ...lines,
        '};',
        ''
      ].join('\n')
    );
    console.log(OUT);
  }
} finally {
  await browser?.close();
  await server.close();
}
