/* Operasi Bayang — seeded random number generator.
 * A tiny mulberry32 generator so the game is deterministic for a given seed:
 * the same seed always builds the same floor shading and the same autopilot
 * detours, which keeps the ?shot= modes reproducible. */
'use strict';

function createRng(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

function rngPick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}
