/* Operasi Bayang — sound effects.
 * All sounds are synthesized live with WebAudio (oscillators only, no audio
 * files, no network). The context is created lazily on the first user
 * gesture, so automated screenshot runs stay silent. */
'use strict';

const SoundFX = {
  ctx: null,
  enabled: true,
  lastStep: 0,

  init: function () {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    } catch (e) {
      this.ctx = null;
    }
  },

  resume: function () {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  toggle: function () {
    this.enabled = !this.enabled;
    return this.enabled;
  },

  tone: function (freq, dur, type, gain, when) {
    if (!this.enabled || !this.ctx) return;
    try {
      const t0 = this.ctx.currentTime + (when || 0);
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain || 0.08, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch (e) {
      /* audio is cosmetic; never let it break the game */
    }
  },

  click: function () {
    this.tone(660, 0.06, 'triangle', 0.06);
  },

  pickup: function () {
    this.tone(880, 0.09, 'sine', 0.09);
    this.tone(1318, 0.14, 'sine', 0.08, 0.08);
  },

  alert: function () {
    this.tone(196, 0.16, 'sawtooth', 0.07);
    this.tone(147, 0.22, 'sawtooth', 0.07, 0.14);
  },

  caught: function () {
    this.tone(110, 0.4, 'sawtooth', 0.1);
    this.tone(82, 0.5, 'square', 0.06, 0.1);
  },

  levelClear: function () {
    this.tone(523, 0.12, 'triangle', 0.09);
    this.tone(659, 0.12, 'triangle', 0.09, 0.11);
    this.tone(784, 0.2, 'triangle', 0.1, 0.22);
  },

  victory: function () {
    const notes = [523, 659, 784, 1046, 1318];
    for (let i = 0; i < notes.length; i++) {
      this.tone(notes[i], 0.22, 'triangle', 0.09, i * 0.13);
    }
  },

  gameOver: function () {
    const notes = [392, 330, 262, 196];
    for (let i = 0; i < notes.length; i++) {
      this.tone(notes[i], 0.25, 'triangle', 0.08, i * 0.16);
    }
  },

  footstep: function (now) {
    if (!this.enabled || !this.ctx) return;
    if (now - this.lastStep < 0.3) return;
    this.lastStep = now;
    this.tone(120, 0.04, 'sine', 0.025);
  }
};
