/* Operasi Bayang — the player: a thief slipping through the dark.
 * WASD / arrows to move, Shift to sneak (slower, harder to spot). Bushes
 * and shadow patches hide a player who stays still or sneaks inside them.
 * Getting caught costs a life and sends the player back to the start. */
'use strict';

const PLAYER_RADIUS = 13;
const PLAYER_WALK_SPEED = 148;
const PLAYER_SNEAK_SPEED = 84;

function Player(startX, startY) {
  this.x = startX;
  this.y = startY;
  this.startX = startX;
  this.startY = startY;
  this.dir = 0;
  this.moving = false;
  this.sneaking = false;
  this.hidden = false;
  this.lives = 3;
  this.score = 0;
  this.lootGot = 0;
  this.invulnerable = 0;
  this.caughtFlash = 0;
}

Player.prototype.resetToStart = function () {
  this.x = this.startX;
  this.y = this.startY;
  this.dir = 0;
  this.moving = false;
  this.hidden = false;
  this.invulnerable = 2.0;
  this.caughtFlash = 0.6;
};

Player.prototype.tryMove = function (level, dx, dy) {
  let moved = false;
  if (dx !== 0 && !circleHitsWall(level, this.x + dx, this.y, PLAYER_RADIUS)) {
    this.x += dx;
    moved = true;
  }
  if (dy !== 0 && !circleHitsWall(level, this.x, this.y + dy, PLAYER_RADIUS)) {
    this.y += dy;
    moved = true;
  }
  return moved;
};

/* input: {x, y} normalized wish direction, sneak boolean. Returns true
 * while the player is actually moving (for footsteps). */
Player.prototype.update = function (dt, level, input) {
  if (this.invulnerable > 0) this.invulnerable -= dt;
  if (this.caughtFlash > 0) this.caughtFlash -= dt;
  const speed = input.sneak ? PLAYER_SNEAK_SPEED : PLAYER_WALK_SPEED;
  this.sneaking = !!input.sneak;
  const mag = Math.sqrt(input.x * input.x + input.y * input.y);
  this.moving = mag > 0.01;
  if (this.moving) {
    const nx = input.x / (mag || 1);
    const ny = input.y / (mag || 1);
    this.dir = Math.atan2(ny, nx);
    this.tryMove(level, nx * speed * dt, ny * speed * dt);
  }
  /* cover: bush or shadow hides the player only while sneaking or still */
  const tile = tileUnder(level, this.x, this.y);
  const inCover = tile === 'B' || tile === 'S';
  this.hidden = inCover && (this.sneaking || !this.moving);
};
