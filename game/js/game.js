/* Operasi Bayang — game controller.
 * Owns the state machine (title / playing / levelclear / gameover /
 * victory), keyboard + mouse input, the fixed-step loop, scoring, and the
 * deterministic ?shot= modes the screenshots are taken from:
 *   ?shot=start — title screen over level 1, guards mid-patrol
 *   ?shot=play  — level 1 in motion, autopilot sneaking toward the loot
 *   ?shot=end   — victory screen over level 3
 * ?seed= picks the seed (default 1). No network is used anywhere. */
'use strict';

const Game = {
  canvas: null,
  ctx: null,
  state: 'title',
  levelIndex: 0,
  level: null,
  guards: [],
  player: null,
  detection: 0,
  alarm: false,
  time: 0,
  totalTime: 0,
  levelTime: 0,
  lastBonus: 0,
  ghostBonus: false,
  alarmRaised: false,
  keys: {},
  seed: 1,
  shot: null,
  autopilot: false,
  apTarget: null,
  apStuck: 0,
  apDetour: 0,
  apDetourDir: 0,
  lastX: 0,
  lastY: 0,
  raf: 0,
  lastTs: 0,
  acc: 0,
  /* Frames rendered since init; useful when checking the ?shot= poses. */
  framesRendered: 0,

  init: function () {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    const params = new URLSearchParams(window.location.search);
    this.shot = params.get('shot');
    const seedParam = parseInt(params.get('seed') || '1', 10);
    this.seed = Number.isFinite(seedParam) && seedParam > 0 ? seedParam : 1;
    this.loadLevel(0);
    this.bindInput();

    if (this.shot === 'start') {
      this.state = 'title';
      this.simulate(150);
    } else if (this.shot === 'play') {
      this.state = 'playing';
      this.autopilot = true;
      this.simulate(240);
    } else if (this.shot === 'end') {
      this.loadLevel(LEVELS.length - 1);
      this.player.score = 4850;
      this.player.lootGot = this.level.loot.length;
      for (let i = 0; i < this.level.loot.length; i++) this.level.loot[i].taken = true;
      this.totalTime = 274;
      this.state = 'victory';
      this.simulate(90);
    } else {
      this.state = 'title';
    }
    this.render();
    const self = this;
    this.lastTs = performance.now();
    const loop = function (ts) {
      self.frame(ts);
      self.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  },

  loadLevel: function (idx) {
    this.levelIndex = idx;
    this.level = buildLevel(idx, this.seed);
    this.guards = this.level.guardDefs.map(function (def) {
      return new Guard(def, this.level);
    }, this);
    this.player = new Player(this.level.playerStart.x, this.level.playerStart.y);
    this.player.score = this.player.score || 0;
    this.detection = 0;
    this.alarm = false;
    this.levelTime = 0;
    this.alarmRaised = false;
    this.ghostBonus = false;
    this.apTarget = null;
    this.apStuck = 0;
    this.apDetour = 0;
  },

  /* Keep the running score when moving to the next level. */
  startLevel: function (idx, keepScore, keepLives) {
    const score = keepScore ? this.player.score : 0;
    const lives = keepLives ? this.player.lives : 3;
    this.loadLevel(idx);
    this.player.score = score;
    this.player.lives = lives;
    this.state = 'playing';
  },

  lootLeft: function () {
    let n = 0;
    for (let i = 0; i < this.level.loot.length; i++) {
      if (!this.level.loot[i].taken) n++;
    }
    return n;
  },

  bindInput: function () {
    const self = this;
    window.addEventListener('keydown', function (e) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].indexOf(e.key) >= 0) {
        e.preventDefault();
      }
      SoundFX.init();
      SoundFX.resume();
      self.keys[e.key.toLowerCase()] = true;
      if (e.key === 'Enter') self.onConfirm();
      if (e.key === 'r' || e.key === 'R') self.onRestart();
      if (e.key === 'm' || e.key === 'M') SoundFX.toggle();
    });
    window.addEventListener('keyup', function (e) {
      self.keys[e.key.toLowerCase()] = false;
    });
    this.canvas.addEventListener('click', function () {
      SoundFX.init();
      SoundFX.resume();
      self.onConfirm();
    });
  },

  onConfirm: function () {
    if (this.shot) return;
    if (this.state === 'title') {
      SoundFX.click();
      this.startLevel(0, false, false);
    } else if (this.state === 'levelclear') {
      SoundFX.click();
      if (this.levelIndex + 1 < LEVELS.length) {
        this.startLevel(this.levelIndex + 1, true, true);
      } else {
        this.state = 'victory';
        SoundFX.victory();
      }
    } else if (this.state === 'gameover' || this.state === 'victory') {
      this.onRestart();
    }
  },

  onRestart: function () {
    if (this.shot) return;
    SoundFX.click();
    if (this.state === 'victory') {
      this.totalTime = 0;
      this.startLevel(0, false, false);
    } else if (this.state === 'gameover') {
      this.totalTime = 0;
      this.startLevel(0, false, false);
    } else {
      this.startLevel(this.levelIndex, true, true);
    }
  },

  readInput: function () {
    const k = this.keys;
    let x = 0;
    let y = 0;
    if (k['a'] || k['arrowleft']) x -= 1;
    if (k['d'] || k['arrowright']) x += 1;
    if (k['w'] || k['arrowup']) y -= 1;
    if (k['s'] || k['arrowdown']) y += 1;
    return { x: x, y: y, sneak: !!(k['shift']) };
  },

  /* Autopilot for the ?shot=play screenshot: steer toward the nearest
   * remaining loot, then the exit; if stuck against a wall, detour sideways
   * for a while. Deterministic: detours come from the seeded rng. */
  autopilotInput: function () {
    const p = this.player;
    if (!this.apTarget || this.apTarget.taken) {
      let best = null;
      let bestD = Infinity;
      for (let i = 0; i < this.level.loot.length; i++) {
        const l = this.level.loot[i];
        if (l.taken) continue;
        const d = (l.x - p.x) * (l.x - p.x) + (l.y - p.y) * (l.y - p.y);
        if (d < bestD) {
          bestD = d;
          best = l;
        }
      }
      this.apTarget = best || this.level.exit;
    }
    const t = this.apTarget;
    const dx = t.x - p.x;
    const dy = t.y - p.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    if (this.apDetour > 0) {
      this.apDetour--;
      const perp = this.apDetourDir;
      return { x: -dy / d * perp, y: dx / d * perp, sneak: true };
    }
    const moved = Math.sqrt((p.x - this.lastX) * (p.x - this.lastX) + (p.y - this.lastY) * (p.y - this.lastY));
    if (moved < 0.4 && (Math.abs(dx) > 24 || Math.abs(dy) > 24)) {
      this.apStuck++;
      if (this.apStuck > 40) {
        this.apStuck = 0;
        this.apDetour = 55;
        this.apDetourDir = Math.abs(dx) > Math.abs(dy) ? 1 : -1;
      }
    } else {
      this.apStuck = 0;
    }
    this.lastX = p.x;
    this.lastY = p.y;
    return { x: dx / d, y: dy / d, sneak: d < 170 };
  },

  step: function (dt) {
    this.time += dt;
    if (this.state !== 'playing') {
      /* guards keep patrolling behind the title / end screens */
      for (let i = 0; i < this.guards.length; i++) {
        const g = this.guards[i];
        const px = this.player.x;
        const py = this.player.y;
        this.player.x = -9999;
        this.player.y = -9999;
        g.update(dt, this.level, this.player, false);
        this.player.x = px;
        this.player.y = py;
      }
      return;
    }
    this.levelTime += dt;
    this.totalTime += dt;
    const input = this.autopilot ? this.autopilotInput() : this.readInput();
    this.player.update(dt, this.level, input);
    if (this.player.moving) SoundFX.footstep(this.time);

    let maxAware = 0;
    for (let i = 0; i < this.guards.length; i++) {
      const g = this.guards[i];
      g.update(dt, this.level, this.player, this.alarm);
      if (g.awareness > maxAware) maxAware = g.awareness;
    }
    const wasAlarm = this.alarm;
    this.detection = maxAware;
    if (maxAware >= 100 && !this.alarm) {
      this.alarm = true;
      this.alarmRaised = true;
      SoundFX.alert();
    }
    if (this.alarm && maxAware < 40) {
      this.alarm = false;
      for (let i = 0; i < this.guards.length; i++) {
        if (this.guards[i].state === 'chase') this.guards[i].state = 'search';
      }
    }

    /* loot pickup */
    for (let i = 0; i < this.level.loot.length; i++) {
      const l = this.level.loot[i];
      if (l.taken) continue;
      const dx = l.x - this.player.x;
      const dy = l.y - this.player.y;
      if (dx * dx + dy * dy < 26 * 26) {
        l.taken = true;
        this.player.lootGot++;
        this.player.score += 100;
        SoundFX.pickup();
      }
    }

    /* caught? */
    if (this.player.invulnerable <= 0) {
      for (let i = 0; i < this.guards.length; i++) {
        const g = this.guards[i];
        const dx = g.x - this.player.x;
        const dy = g.y - this.player.y;
        if (dx * dx + dy * dy < GUARD_CATCH_DIST * GUARD_CATCH_DIST) {
          this.player.lives--;
          SoundFX.caught();
          if (this.player.lives <= 0) {
            this.state = 'gameover';
            SoundFX.gameOver();
          } else {
            this.player.resetToStart();
            for (let j = 0; j < this.guards.length; j++) this.guards[j].reset();
            this.detection = 0;
            this.alarm = false;
          }
          break;
        }
      }
    }

    /* exit: only opens once every loot is taken */
    if (this.state === 'playing' && this.lootLeft() === 0) {
      const ex = this.level.exit;
      const dx = ex.x - this.player.x;
      const dy = ex.y - this.player.y;
      if (dx * dx + dy * dy < 30 * 30) {
        const timeBonus = Math.max(0, 300 - Math.floor(this.levelTime) * 2);
        this.ghostBonus = !this.alarmRaised;
        this.lastBonus = timeBonus + (this.ghostBonus ? 150 : 0);
        this.player.score += this.lastBonus;
        if (this.levelIndex + 1 >= LEVELS.length) {
          this.state = 'victory';
          SoundFX.victory();
        } else {
          this.state = 'levelclear';
          SoundFX.levelClear();
        }
      }
    }
  },

  /* Run n fixed steps without rendering (used to pose the ?shot= scenes). */
  simulate: function (n) {
    for (let i = 0; i < n; i++) this.step(1 / 60);
  },

  frame: function (ts) {
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000 || 0);
    this.lastTs = ts;
    this.acc += dt;
    while (this.acc >= 1 / 60) {
      this.step(1 / 60);
      this.acc -= 1 / 60;
    }
    this.render();
  },

  render: function () {
    this.framesRendered++;
    Renderer.draw(this.ctx, this);
  }
};

Game.init();
