/* Operasi Bayang — level definitions and tile map helpers.
 * Three hand-drawn maps. Tile legend:
 *   '#' wall (blocks movement and sight)   '.' floor
 *   'B' bush (hides a still, sneaking player) 'S' shadow (same, darker floor)
 *   'L' loot to steal   'E' exit (opens once all loot is taken)
 *   'P' player start    'G' guard spawn (patrol waypoints listed per guard)
 * Maps are 20 columns x 12 rows; TILE is 48 px, so the playfield is
 * 960 x 576 under a 64 px HUD bar (canvas 960 x 640). */
'use strict';

const TILE = 48;
const COLS = 20;
const ROWS = 12;
const HUD_H = 64;
const GAME_W = COLS * TILE;
const GAME_H = HUD_H + ROWS * TILE;

const LEVELS = [
  {
    name: 'Gudang Senja',
    sub: 'Misi 1 — curi 2 berkas, jangan sampai terlihat',
    map: [
      '####################',
      '#P....#......B.....#',
      '#.....#.....#...L..#',
      '#..B..#..B..#......#',
      '#.....#.....#..#...#',
      '#.....#..G..#..#...#',
      '#..#......#....#..##',
      '#..#..B...#..B.....#',
      '#..#......#....#.L.#',
      '#.....B......#.....#',
      '#..G.......B....E..#',
      '####################'
    ],
    guards: [
      { waypoints: [[8, 5], [8, 8], [13, 8], [13, 5]], speed: 62, range: 225, fov: 1.31 },
      { waypoints: [[3, 10], [3, 9], [10, 9], [10, 10]], speed: 55, range: 210, fov: 1.31 }
    ]
  },
  {
    name: 'Arsip Tengah Malam',
    sub: 'Misi 2 — 3 penjaga, patroli lebih rapat',
    map: [
      '####################',
      '#P..B....#....L....#',
      '#....#...#..#..G...#',
      '#.B..#..B...#.B....#',
      '#....#......#..#...#',
      '#..G....#...#..#...#',
      '#....#..#...#..#...#',
      '#..B.#..#..B...#.L.#',
      '#....#..#....#.....#',
      '#.L..#..B...#..G...#',
      '#....#.....B...#..E#',
      '####################'
    ],
    guards: [
      { waypoints: [[3, 5], [3, 8], [7, 8], [7, 5]], speed: 72, range: 235, fov: 1.36 },
      { waypoints: [[15, 2], [14, 2], [14, 4], [18, 4], [18, 2]], speed: 68, range: 230, fov: 1.36 },
      { waypoints: [[16, 9], [18, 9], [18, 6], [16, 6]], speed: 76, range: 240, fov: 1.4 }
    ]
  },
  {
    name: 'Bilik Brankas',
    sub: 'Misi 3 — brankas utama, 4 penjaga, tanpa ampun',
    map: [
      '####################',
      '#P...#..B...#..L..G#',
      '#....#......#......#',
      '#.B..#..#..B....G..#',
      '#....#..#....#.....#',
      '#..G.......B....#..#',
      '#....#..#....#..#..#',
      '#..B.#..#..B...#...#',
      '#..........#..L....#',
      '#.L..#..B...#..G...#',
      '#....#.....B...#.E.#',
      '####################'
    ],
    guards: [
      { waypoints: [[16, 3], [15, 3], [15, 5], [13, 5], [13, 3]], speed: 84, range: 250, fov: 1.44 },
      { waypoints: [[3, 5], [3, 8], [7, 8], [7, 5]], speed: 80, range: 245, fov: 1.44 },
      { waypoints: [[15, 9], [18, 9], [18, 7], [14, 7]], speed: 88, range: 250, fov: 1.48 },
      { waypoints: [[18, 1], [18, 4], [14, 4], [14, 1]], speed: 82, range: 245, fov: 1.44 }
    ]
  }
];

/* Turn a level definition into a live level: tile grid, loot list, exit,
 * player start, guard spawn points and per-tile floor shading (seeded, so a
 * given seed always renders the same floor). */
function buildLevel(defIndex, seed) {
  const def = LEVELS[defIndex];
  const rng = createRng((seed || 1) * 7919 + defIndex * 104729);
  const grid = [];
  const loot = [];
  let playerStart = { x: 1.5 * TILE, y: HUD_H + 1.5 * TILE };
  let exit = { x: 18.5 * TILE, y: HUD_H + 10.5 * TILE };
  const shades = [];
  for (let r = 0; r < ROWS; r++) {
    const row = def.map[r];
    const gridRow = [];
    const shadeRow = [];
    for (let c = 0; c < COLS; c++) {
      const ch = row[c];
      gridRow.push(ch);
      shadeRow.push(rng());
      if (ch === 'L') loot.push({ tx: c, ty: r, x: (c + 0.5) * TILE, y: HUD_H + (r + 0.5) * TILE, taken: false, bob: rng() * 6.28 });
      if (ch === 'P') playerStart = { x: (c + 0.5) * TILE, y: HUD_H + (r + 0.5) * TILE };
      if (ch === 'E') exit = { x: (c + 0.5) * TILE, y: HUD_H + (r + 0.5) * TILE };
    }
    grid.push(gridRow);
    shades.push(shadeRow);
  }
  return {
    defIndex: defIndex,
    name: def.name,
    sub: def.sub,
    grid: grid,
    shades: shades,
    loot: loot,
    exit: exit,
    playerStart: playerStart,
    guardDefs: def.guards
  };
}

function tileAt(level, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#';
  return level.grid[ty][tx];
}

function isWallTile(level, tx, ty) {
  return tileAt(level, tx, ty) === '#';
}

/* Is the point (px, py) inside a wall tile? Playfield coordinates: the HUD
 * occupies the top HUD_H pixels, tiles start below it. */
function pointInWall(level, px, py) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor((py - HUD_H) / TILE);
  return isWallTile(level, tx, ty);
}

/* Circle (px, py, radius) against wall tiles: true when it overlaps a wall. */
function circleHitsWall(level, px, py, radius) {
  const x0 = Math.floor((px - radius) / TILE);
  const x1 = Math.floor((px + radius) / TILE);
  const y0 = Math.floor((py - HUD_H - radius) / TILE);
  const y1 = Math.floor((py - HUD_H + radius) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!isWallTile(level, tx, ty)) continue;
      const wx = tx * TILE;
      const wy = HUD_H + ty * TILE;
      const cx = Math.max(wx, Math.min(px, wx + TILE));
      const cy = Math.max(wy, Math.min(py, wy + TILE));
      const dx = px - cx;
      const dy = py - cy;
      if (dx * dx + dy * dy < radius * radius) return true;
    }
  }
  return false;
}

/* Line of sight between two playfield points: sampled every 6 px; a wall
 * tile anywhere along the segment blocks sight. */
function lineOfSightClear(level, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (pointInWall(level, x0 + dx * t, y0 + dy * t)) return false;
  }
  return true;
}

/* Tile character under a playfield point. */
function tileUnder(level, px, py) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor((py - HUD_H) / TILE);
  return tileAt(level, tx, ty);
}
