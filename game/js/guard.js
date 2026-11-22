/* Operasi Bayang — guard AI.
 * A guard patrols waypoints, pauses at each one and scans, and watches a
 * vision cone. Seeing the player raises its awareness (0-100); at 100 the
 * whole floor goes on alarm and every guard chases. Lose sight for a while
 * and guards search the last seen spot, then return to patrol — the player
 * always gets a chance to recover. */
'use strict';

const GUARD_RADIUS = 15;
const GUARD_CATCH_DIST = 26;

function Guard(def, level) {
  this.waypoints = def.waypoints.map(function (w) {
    return { x: (w[0] + 0.5) * TILE, y: HUD_H + (w[1] + 0.5) * TILE };
  });
  this.x = this.waypoints[0].x;
  this.y = this.waypoints[0].y;
  this.wpIndex = 1 % this.waypoints.length;
  this.dir = 0;
  this.patrolSpeed = def.speed;
  this.chaseSpeed = def.speed * 1.55;
  this.range = def.range;
  this.fov = def.fov;
  this.awareness = 0;
  this.state = 'patrol'; // patrol | search | chase
  this.pauseTimer = 0;
  this.searchTimer = 0;
  this.loseTimer = 0;
  this.lastSeen = null;
  this.scanPhase = 0;
  this.alarm = false;
}

Guard.prototype.reset = function () {
  this.x = this.waypoints[0].x;
  this.y = this.waypoints[0].y;
  this.wpIndex = 1 % this.waypoints.length;
  this.dir = 0;
  this.awareness = 0;
  this.state = 'patrol';
  this.pauseTimer = 0;
  this.searchTimer = 0;
  this.loseTimer = 0;
  this.lastSeen = null;
  this.alarm = false;
};

/* Move with axis-separated wall sliding so guards hug corridors instead of
 * sticking on corners. Returns true when the guard actually moved. */
Guard.prototype.tryMove = function (level, dx, dy) {
  let moved = false;
  if (dx !== 0 && !circleHitsWall(level, this.x + dx, this.y, GUARD_RADIUS)) {
    this.x += dx;
    moved = true;
  }
  if (dy !== 0 && !circleHitsWall(level, this.x, this.y + dy, GUARD_RADIUS)) {
    this.y += dy;
    moved = true;
  }
  return moved;
};

Guard.prototype.moveToward = function (level, tx, ty, speed, dt) {
  const dx = tx - this.x;
  const dy = ty - this.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1) return true;
  const step = Math.min(d, speed * dt);
  this.dir = Math.atan2(dy, dx);
  return this.tryMove(level, (dx / d) * step, (dy / d) * step);
};

/* Can this guard see the player right now? Range, cone angle, line of
 * sight, and the player's cover all matter. A player crouched still inside
 * a bush or a shadow patch is invisible even inside the cone. */
Guard.prototype.canSee = function (level, player) {
  if (player.invulnerable > 0) return false;
  const dx = player.x - this.x;
  const dy = player.y - this.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > this.range) return false;
  let ang = Math.atan2(dy, dx) - this.dir;
  while (ang > Math.PI) ang -= Math.PI * 2;
  while (ang < -Math.PI) ang += Math.PI * 2;
  if (Math.abs(ang) > this.fov / 2) return false;
  if (!lineOfSightClear(level, this.x, this.y, player.x, player.y)) return false;
  if (player.hidden) return false;
  return true;
};

Guard.prototype.update = function (dt, level, player, alarmOn) {
  const sees = this.canSee(level, player);
  if (sees) {
    this.lastSeen = { x: player.x, y: player.y };
    this.loseTimer = 0;
    const dist = Math.sqrt((player.x - this.x) * (player.x - this.x) + (player.y - this.y) * (player.y - this.y));
    const closeness = 1 - dist / this.range;
    let rate = 26 + 58 * closeness;
    if (player.sneaking) rate *= 0.55;
    if (this.state === 'chase') rate *= 1.4;
    this.awareness = Math.min(100, this.awareness + rate * dt);
  } else {
    this.awareness = Math.max(0, this.awareness - 26 * dt);
    if (this.state === 'chase') {
      this.loseTimer += dt;
    }
  }

  if (alarmOn || this.awareness >= 100) {
    this.state = 'chase';
    this.awareness = Math.max(this.awareness, alarmOn ? 100 : this.awareness);
  } else if (this.state === 'chase' && this.loseTimer > 2.6) {
    this.state = 'search';
    this.searchTimer = 2.2;
    this.loseTimer = 0;
  } else if (this.state === 'search' && this.searchTimer <= 0) {
    this.state = 'patrol';
  }

  if (this.state === 'chase') {
    const target = this.lastSeen || { x: player.x, y: player.y };
    this.moveToward(level, target.x, target.y, this.chaseSpeed, dt);
    if (this.lastSeen && Math.abs(this.x - this.lastSeen.x) < 6 && Math.abs(this.y - this.lastSeen.y) < 6) {
      this.lastSeen = null;
    }
    return;
  }

  if (this.state === 'search') {
    this.searchTimer -= dt;
    if (this.lastSeen) {
      const arrived = this.moveToward(level, this.lastSeen.x, this.lastSeen.y, this.patrolSpeed * 1.15, dt);
      if (arrived) this.lastSeen = null;
    } else {
      /* stand and scan: slow sweep of the cone */
      this.scanPhase += dt * 1.4;
      this.dir += Math.sin(this.scanPhase) * 0.02;
    }
    return;
  }

  /* patrol */
  if (this.pauseTimer > 0) {
    this.pauseTimer -= dt;
    this.scanPhase += dt * 0.9;
    this.dir += Math.sin(this.scanPhase) * 0.012;
    return;
  }
  const wp = this.waypoints[this.wpIndex];
  const arrived = this.moveToward(level, wp.x, wp.y, this.patrolSpeed, dt);
  if (arrived) {
    this.wpIndex = (this.wpIndex + 1) % this.waypoints.length;
    this.pauseTimer = 0.9;
  }
};

/* Vision-cone polygon with wall occlusion: cast a fan of rays and stop each
 * one at the first wall (or at range). Used by the renderer. */
Guard.prototype.conePolygon = function (level, rays) {
  const pts = [{ x: this.x, y: this.y }];
  const n = rays || 14;
  for (let i = 0; i <= n; i++) {
    const a = this.dir - this.fov / 2 + (this.fov * i) / n;
    const stepX = Math.cos(a);
    const stepY = Math.sin(a);
    let r = this.range;
    for (let d = 8; d <= this.range; d += 8) {
      if (pointInWall(level, this.x + stepX * d, this.y + stepY * d)) {
        r = d;
        break;
      }
    }
    pts.push({ x: this.x + stepX * r, y: this.y + stepY * r });
  }
  return pts;
};
