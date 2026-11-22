/* Operasi Bayang — all drawing on one canvas.
 * Dark, readable top-down look: slate floor with seeded shading, walls with
 * a lit top edge, bushes as leafy clusters, shadow patches as cool dark
 * pools, loot as glinting gold, the exit as a green doorway that stays
 * locked until every loot is taken, and guards as warm bodies under bright
 * vision cones so the danger is readable at a glance. */
'use strict';

const Renderer = {
  draw: function (ctx, game) {
    this.drawFloor(ctx, game);
    this.drawLootAndExit(ctx, game);
    this.drawGuards(ctx, game);
    this.drawPlayer(ctx, game);
    this.drawDarkness(ctx, game);
    this.drawHud(ctx, game);
    if (game.state === 'title') this.drawTitle(ctx, game);
    else if (game.state === 'levelclear') this.drawLevelClear(ctx, game);
    else if (game.state === 'gameover') this.drawGameOver(ctx, game);
    else if (game.state === 'victory') this.drawVictory(ctx, game);
  },

  drawFloor: function (ctx, game) {
    const level = game.level;
    ctx.fillStyle = '#0a0e18';
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const ch = level.grid[ty][tx];
        const x = tx * TILE;
        const y = HUD_H + ty * TILE;
        const shade = level.shades[ty][tx];
        if (ch === '#') {
          ctx.fillStyle = '#232c42';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = '#38445f';
          ctx.fillRect(x, y, TILE, 5);
          ctx.fillStyle = '#1a2133';
          ctx.fillRect(x, y + TILE - 4, TILE, 4);
          ctx.strokeStyle = 'rgba(0,0,0,0.35)';
          ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        } else {
          const base = 16 + Math.floor(shade * 10);
          ctx.fillStyle = 'rgb(' + base + ',' + (base + 4) + ',' + (base + 14) + ')';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = 'rgba(255,255,255,0.03)';
          ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
          if (ch === 'S') {
            ctx.fillStyle = 'rgba(8,12,28,0.55)';
            ctx.fillRect(x, y, TILE, TILE);
            ctx.fillStyle = 'rgba(120,150,255,0.10)';
            ctx.beginPath();
            ctx.ellipse(x + TILE / 2, y + TILE / 2, 16, 10, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          if (ch === 'B') {
            ctx.fillStyle = 'rgba(10,40,22,0.9)';
            ctx.fillRect(x, y, TILE, TILE);
            ctx.fillStyle = '#1d5c33';
            const blobs = [[12, 14], [30, 10], [38, 28], [16, 32], [26, 22]];
            for (let i = 0; i < blobs.length; i++) {
              ctx.beginPath();
              ctx.arc(x + blobs[i][0], y + blobs[i][1], 9 + shade * 3, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.fillStyle = '#2f7d47';
            ctx.beginPath();
            ctx.arc(x + 20, y + 18, 6, 0, Math.PI * 2);
            ctx.arc(x + 32, y + 30, 5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  },

  drawLootAndExit: function (ctx, game) {
    const level = game.level;
    const t = game.time;
    /* exit doorway */
    const ex = level.exit;
    const open = game.lootLeft() === 0;
    ctx.save();
    ctx.translate(ex.x, ex.y);
    ctx.fillStyle = open ? '#123524' : '#241a12';
    ctx.fillRect(-20, -20, 40, 40);
    ctx.strokeStyle = open ? '#39d98a' : '#8a6d3b';
    ctx.lineWidth = 3;
    ctx.strokeRect(-20, -20, 40, 40);
    if (open) {
      ctx.shadowColor = '#39d98a';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#39d98a';
      ctx.fillRect(-13, -13, 26, 26);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#06281a';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('EXIT', 0, 1);
    } else {
      ctx.fillStyle = '#c9a227';
      ctx.beginPath();
      ctx.arc(0, -4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-3, 0, 6, 12);
      ctx.fillStyle = '#8a6d3b';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(game.lootLeft() + ' LAGI', 0, 30);
    }
    ctx.restore();
    /* loot: gold diamonds that bob and glint */
    for (let i = 0; i < level.loot.length; i++) {
      const l = level.loot[i];
      if (l.taken) continue;
      const bob = Math.sin(t * 2.4 + l.bob) * 3;
      ctx.save();
      ctx.translate(l.x, l.y + bob);
      ctx.shadowColor = '#ffd34d';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(9, 0);
      ctx.lineTo(0, 11);
      ctx.lineTo(-9, 0);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(4, 0);
      ctx.lineTo(0, 6);
      ctx.lineTo(-4, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  },

  drawGuards: function (ctx, game) {
    const level = game.level;
    for (let i = 0; i < game.guards.length; i++) {
      const g = game.guards[i];
      const poly = g.conePolygon(level, 14);
      let fill = 'rgba(255,196,66,0.16)';
      let edge = 'rgba(255,196,66,0.45)';
      if (g.state === 'chase') {
        fill = 'rgba(255,64,64,0.30)';
        edge = 'rgba(255,64,64,0.65)';
      } else if (g.state === 'search' || g.awareness > 45) {
        fill = 'rgba(255,140,50,0.24)';
        edge = 'rgba(255,140,50,0.55)';
      }
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let k = 1; k < poly.length; k++) ctx.lineTo(poly[k].x, poly[k].y);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      /* body */
      ctx.beginPath();
      ctx.arc(g.x, g.y, GUARD_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = g.state === 'chase' ? '#e5484d' : '#f76b15';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#2b0d0d';
      ctx.stroke();
      /* facing tick + eye */
      const ex = g.x + Math.cos(g.dir) * 10;
      const ey = g.y + Math.sin(g.dir) * 10;
      ctx.beginPath();
      ctx.arc(ex, ey, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff7ed';
      ctx.fill();
      /* alert mark */
      if (g.awareness > 45 || g.state !== 'patrol') {
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = g.state === 'chase' ? '#ff5a5a' : '#ffb020';
        ctx.fillText(g.state === 'chase' ? '!' : '?', g.x, g.y - GUARD_RADIUS - 4);
      }
    }
  },

  drawPlayer: function (ctx, game) {
    const p = game.player;
    if (p.invulnerable > 0 && Math.floor(game.time * 12) % 2 === 0 && game.state === 'playing') {
      return; /* blink while invulnerable after being caught */
    }
    ctx.save();
    ctx.globalAlpha = p.hidden ? 0.55 : 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = '#22d3ee';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#083344';
    ctx.stroke();
    /* facing wedge */
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.dir) * 6, p.y + Math.sin(p.dir) * 6);
    ctx.lineTo(p.x + Math.cos(p.dir + 2.6) * 12, p.y + Math.sin(p.dir + 2.6) * 12);
    ctx.lineTo(p.x + Math.cos(p.dir - 2.6) * 12, p.y + Math.sin(p.dir - 2.6) * 12);
    ctx.closePath();
    ctx.fillStyle = '#083344';
    ctx.fill();
    ctx.restore();
    if (p.hidden) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, PLAYER_RADIUS + 5, 0, Math.PI * 2);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(57,217,138,0.8)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#39d98a';
      ctx.fillText('SEMBUNYI', p.x, p.y - PLAYER_RADIUS - 8);
    }
  },

  drawDarkness: function (ctx, game) {
    /* soft vignette: the edges of the floor stay darker than the middle */
    const g = ctx.createRadialGradient(
      GAME_W / 2, GAME_H / 2, GAME_H * 0.35,
      GAME_W / 2, GAME_H / 2, GAME_H * 0.85
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = g;
    ctx.fillRect(0, HUD_H, GAME_W, ROWS * TILE);
    if (game.detection > 55 && game.state === 'playing') {
      const pulse = 0.10 + 0.08 * Math.sin(game.time * 6);
      ctx.strokeStyle = 'rgba(255,60,60,' + pulse.toFixed(3) + ')';
      ctx.lineWidth = 10;
      ctx.strokeRect(5, HUD_H + 5, GAME_W - 10, ROWS * TILE - 10);
    }
  },

  drawHud: function (ctx, game) {
    ctx.fillStyle = '#0d1526';
    ctx.fillRect(0, 0, GAME_W, HUD_H);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, HUD_H - 2, GAME_W, 2);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText('LEVEL ' + (game.levelIndex + 1) + ' · ' + game.level.name.toUpperCase(), 14, 22);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px sans-serif';
    ctx.fillText(game.level.sub, 14, 45);
    /* detection meter */
    const mx = 400;
    const mw = 210;
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('DETEKSI', mx, 22);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(mx, 32, mw, 14);
    const d = game.detection / 100;
    ctx.fillStyle = d < 0.45 ? '#39d98a' : d < 0.8 ? '#ffb020' : '#ff5a5a';
    ctx.fillRect(mx, 32, Math.max(0, mw * d), 14);
    ctx.strokeStyle = '#475569';
    ctx.strokeRect(mx + 0.5, 32.5, mw, 14);
    /* loot */
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.moveTo(650, 32);
    ctx.lineTo(657, 39);
    ctx.lineTo(650, 46);
    ctx.lineTo(643, 39);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(game.player.lootGot + '/' + game.level.loot.length, 664, 39);
    /* lives */
    for (let i = 0; i < 3; i++) {
      const hx = 730 + i * 26;
      ctx.fillStyle = i < game.player.lives ? '#ff5a7a' : '#334155';
      ctx.beginPath();
      ctx.arc(hx, 36, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(hx - 6, 38);
      ctx.lineTo(hx, 48);
      ctx.lineTo(hx + 6, 38);
      ctx.closePath();
      ctx.fill();
    }
    /* score */
    ctx.textAlign = 'right';
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('SKOR ' + String(game.player.score).padStart(5, '0'), GAME_W - 14, 24);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px sans-serif';
    ctx.fillText(SoundFX.enabled ? 'M: suara ON' : 'M: suara OFF', GAME_W - 14, 45);
    ctx.textAlign = 'left';
  },

  panel: function (ctx, title, lines, accent) {
    ctx.fillStyle = 'rgba(4,7,14,0.82)';
    ctx.fillRect(0, HUD_H, GAME_W, ROWS * TILE);
    const pw = 620;
    const ph = 150 + lines.length * 30;
    const px = (GAME_W - pw) / 2;
    const py = (GAME_H - ph) / 2;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = accent || '#22d3ee';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, pw, ph);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = accent || '#22d3ee';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText(title, GAME_W / 2, py + 52);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '16px sans-serif';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], GAME_W / 2, py + 108 + i * 30);
    }
  },

  drawTitle: function (ctx, game) {
    this.panel(ctx, 'OPERASI BAYANG', [
      'Game stealth top-down — curi jarahan, hindari penjaga, capai pintu keluar.',
      'WASD / Panah: bergerak      SHIFT: menyelinap (lebih sulit terlihat)',
      'Semak & bayangan menyembunyikanmu saat diam atau menyelinap.',
      '3 level · penjaga berpatroli · kerucut pandang · alarm bisa pulih',
      '',
      'Tekan ENTER atau klik untuk mulai misi'
    ], '#22d3ee');
  },

  drawLevelClear: function (ctx, game) {
    this.panel(ctx, 'LEVEL SELESAI!', [
      'Semua jarahan diamankan. Bonus level: +' + game.lastBonus + ' poin.',
      game.ghostBonus ? 'Bonus HANTU +150 — tidak satu pun penjaga sempat membunyikan alarm!' : 'Alarm sempat berbunyi — lain kali, lebih senyap lagi.',
      '',
      'Tekan ENTER untuk misi berikutnya'
    ], '#39d98a');
  },

  drawGameOver: function (ctx, game) {
    this.panel(ctx, 'TERTANGKAP!', [
      'Para penjaga menemukanmu. Misi gagal.',
      'Skor akhir: ' + game.player.score + ' poin.',
      '',
      'Tekan R untuk mencoba lagi'
    ], '#ff5a5a');
  },

  drawVictory: function (ctx, game) {
    this.panel(ctx, 'MISI SELESAI!', [
      'Semua brankas dibobol tanpa jejak. Kau legenda bayangan.',
      'Skor akhir: ' + game.player.score + ' poin  ·  Nyawa tersisa: ' + game.player.lives,
      'Waktu total: ' + Math.floor(game.totalTime / 60) + ':' + String(Math.floor(game.totalTime % 60)).padStart(2, '0'),
      '',
      'Tekan R untuk main lagi'
    ], '#ffd34d');
  }
};
