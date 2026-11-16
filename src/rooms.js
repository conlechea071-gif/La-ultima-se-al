'use strict';
/**
 * LA ÚLTIMA SEÑAL — lógica del servidor de partidas (autoritativa).
 * No depende de Socket.IO: sólo usa la interfaz mínima  socket.on / emit / join / leave  e  io.to(sala).emit.
 * Así se puede probar con sockets falsos, con WebSocket reales o con Socket.IO (src/server.js).
 */
const crypto = require('crypto');
const W = require('../shared/world.js');

const CFG = {
  MAXES: [2, 5, 6, 10, 20], ALPHA: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', CODE_LEN: 5, MAX_ROOMS: 300,
  LIVES: 3, CAP_MS: 4600, IMMUNE_MS: 6000, CAP_DIST: 1.4, PICK_DIST: 3.4,
  GRACE_LOBBY: 20000, GRACE_GAME: 120000, MON_GRACE: 30000, BACK_MS: 12000,
  TRANSFORM_MIN: 45000, TRANSFORM_AUTO: [60000, 120000],
  SURV_V: 5.0, MON_V: 4.7, LUNGE_V: 9.2, LUNGE_MS: 550, LUNGE_CD: 10000,
  TICK: 50, SNAP_EVERY: 2, CHARS: 6, MAX_STRIKES: 400,
};
const clean = (s, n) => String(s == null ? '' : s).normalize('NFC').replace(/[^\p{L}\p{N} _.\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, n);
const isNum = (v, l) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= l;
const r2 = v => Math.round(v * 100) / 100;
const hex = n => crypto.randomBytes(n).toString('hex');
const tokenOk = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

class Rooms {
  constructor(io, o = {}) {
    this.io = io; this.cfg = Object.assign({}, CFG, o.cfg); this.now = o.now || Date.now;
    this.rnd = o.rnd || (n => crypto.randomInt(n)); this.log = o.log || (() => {});
    this.rooms = new Map(); this.timer = null; this.tickN = 0;
  }
  start() { if (!this.timer) { this.timer = setInterval(() => this.tick(), this.cfg.TICK); if (this.timer.unref) this.timer.unref(); } }
  stop() { clearInterval(this.timer); this.timer = null; }

  // ---------- utilidades ----------
  newCode() {
    for (let t = 0; t < 60; t++) {
      let c = ''; for (let i = 0; i < this.cfg.CODE_LEN; i++) c += this.cfg.ALPHA[this.rnd(this.cfg.ALPHA.length)];
      if (!this.rooms.has(c)) return c;
    }
    return null;
  }
  emitRoom(r, ev, d) { this.io.to('r:' + r.code).emit(ev, d); }
  pub(r) {
    return { code: r.code, name: r.name, max: r.max, phase: r.phase, host: r.host,
      players: [...r.players.values()].map(p => ({ id: p.id, name: p.name, c: p.c, on: p.connected, st: p.state, lives: p.lives })) };
  }
  broadcastRoom(r) { this.emitRoom(r, 'room:update', this.pub(r)); }
  take(ctx, cost) {
    const now = this.now(); ctx.n = Math.min(80, ctx.n + (now - ctx.t) / 1000 * 40); ctx.t = now;
    if (ctx.n >= cost) { ctx.n -= cost; return true; } return false;
  }
  uniqueName(r, nick) {
    const taken = new Set([...r.players.values()].map(p => p.name.toLowerCase())); let n = nick, i = 2;
    while (taken.has(n.toLowerCase())) n = nick.slice(0, 12) + i++;
    return n;
  }
  addPlayer(r, sock, ctx, nick, c) {
    const p = { id: hex(6), token: hex(16), name: this.uniqueName(r, nick), c: Number.isInteger(c) && c >= 0 && c < this.cfg.CHARS ? c : 0,
      sock, ctx, connected: true, discAt: 0, state: 'alive', lives: this.cfg.LIVES, captures: 0, strikes: 0,
      x: 0, z: 6, yaw: Math.PI, v: 0, fl: 0, lastT: this.now(), immUntil: 0, capUntil: 0, lungeUntil: 0, lungeCd: 0 };
    r.players.set(p.id, p); ctx.pid = p.id; ctx.code = r.code; sock.join('r:' + r.code);
    return p;
  }

  // ---------- conexión de un socket ----------
  attach(sock) {
    const self = this, ctx = { sock, pid: null, code: null, n: 80, t: this.now(), made: 0 };
    const on = (ev, cost, fn) => sock.on(ev, (d, ack) => {
      if (typeof ack !== 'function') ack = () => {};
      try {
        if (!self.take(ctx, cost)) return ack({ ok: false, err: 'rate' });
        fn(d && typeof d === 'object' ? d : {}, ack);
      } catch (e) { self.log('error', ev, e && e.stack || e); try { ack({ ok: false, err: 'internal' }); } catch (_) {} }
    });
    const me = () => { const r = self.rooms.get(ctx.code); if (!r) return [null, null]; const p = r.players.get(ctx.pid); return p && p.sock === sock ? [r, p] : [null, null]; };

    on('net:ping', 1, (d, ack) => ack({ ok: true, t: self.now() }));
    on('rooms:list', 5, (d, ack) => ack({ ok: true, rooms: [...self.rooms.values()].filter(r => r.pub && r.phase === 'lobby')
      .map(r => ({ code: r.code, name: r.name, max: r.max, n: r.players.size })) }));

    on('room:create', 5, (d, ack) => {
      if (ctx.pid) return ack({ ok: false, err: 'already' });
      const max = Number(d.max); if (!self.cfg.MAXES.includes(max)) return ack({ ok: false, err: 'max' });
      if (self.rooms.size >= self.cfg.MAX_ROOMS) return ack({ ok: false, err: 'busy' });
      if (ctx.made >= 3) return ack({ ok: false, err: 'limit' });
      const nick = clean(d.nick, 14); if (nick.length < 2) return ack({ ok: false, err: 'nick' });
      const code = self.newCode(); if (!code) return ack({ ok: false, err: 'busy' });
      const r = { code, name: clean(d.name, 20) || ('Sala de ' + nick), max, pub: d.pub !== false, phase: 'lobby', host: null,
        players: new Map(), found: new Set(), monster: null, startedAt: 0, transformAt: 0, backAt: 0, emptySince: 0 };
      ctx.made++; const p = self.addPlayer(r, sock, ctx, nick, d.c); r.host = p.id; self.rooms.set(code, r);
      self.broadcastRoom(r); ack({ ok: true, code, you: { id: p.id, token: p.token }, room: self.pub(r) });
    });

    on('room:join', 5, (d, ack) => {
      if (ctx.pid) return ack({ ok: false, err: 'already' });
      const r = self.rooms.get(clean(d.code, 8).toUpperCase().replace(/ /g, '')); if (!r) return ack({ ok: false, err: 'notfound' });
      if (r.phase !== 'lobby') return ack({ ok: false, err: 'started' });
      if (r.players.size >= r.max) return ack({ ok: false, err: 'full' });
      const nick = clean(d.nick, 14); if (nick.length < 2) return ack({ ok: false, err: 'nick' });
      const p = self.addPlayer(r, sock, ctx, nick, d.c); self.broadcastRoom(r);
      ack({ ok: true, code: r.code, you: { id: p.id, token: p.token }, room: self.pub(r) });
    });

    on('room:reconnect', 5, (d, ack) => {
      const r = self.rooms.get(clean(d.code, 8).toUpperCase()); const p = r && r.players.get(String(d.id || ''));
      if (!p || !tokenOk(p.token, d.token)) return ack({ ok: false, err: 'invalid' });
      if (ctx.pid && ctx.pid !== p.id) return ack({ ok: false, err: 'already' });
      if (p.sock && p.sock !== sock) { try { p.sock.emit('kicked', { reason: 'sesión abierta en otro lugar' }); p.sock.leave('r:' + r.code); } catch (_) {} }
      p.sock = sock; p.connected = true; p.discAt = 0; p.ctx = ctx; ctx.pid = p.id; ctx.code = r.code; sock.join('r:' + r.code);
      ack({ ok: true, code: r.code, you: { id: p.id, token: p.token }, room: self.pub(r), game: self.resumeInfo(r, p) });
      self.broadcastRoom(r);
    });

    on('room:leave', 5, (d, ack) => { const [r, p] = me(); if (!p) return ack({ ok: false, err: 'noroom' }); self.removePlayer(r, p, 'left'); ack({ ok: true }); });

    on('p:character', 5, (d, ack) => {
      const [r, p] = me(); if (!p || r.phase !== 'lobby') return ack({ ok: false, err: 'phase' });
      if (!Number.isInteger(d.c) || d.c < 0 || d.c >= self.cfg.CHARS) return ack({ ok: false, err: 'char' });
      p.c = d.c; self.broadcastRoom(r); ack({ ok: true });
    });

    on('room:start', 5, (d, ack) => {
      const [r, p] = me(); if (!p) return ack({ ok: false, err: 'noroom' });
      if (r.host !== p.id) return ack({ ok: false, err: 'host' }); if (r.phase !== 'lobby') return ack({ ok: false, err: 'phase' });
      const on2 = [...r.players.values()].filter(x => x.connected); if (on2.length < 2) return ack({ ok: false, err: 'min' });
      self.startGame(r, on2); ack({ ok: true });
    });

    on('p:state', 1, (d) => { const [r, p] = me(); if (p) self.onMove(r, p, d); });
    on('paper:pickup', 5, (d, ack) => { const [r, p] = me(); if (!p) return ack({ ok: false, err: 'noroom' }); ack(self.onPickup(r, p, d)); });
    on('monster:transform', 5, (d, ack) => {
      const [r, p] = me(); if (!p || r.monster !== p.id || r.phase !== 'hidden') return ack({ ok: false, err: 'role' });
      if (self.now() - r.startedAt < self.cfg.TRANSFORM_MIN) return ack({ ok: false, err: 'early' });
      self.transform(r); ack({ ok: true });
    });
    on('monster:lunge', 5, (d, ack) => {
      const [r, p] = me(); const now = self.now(); if (!p || r.monster !== p.id || r.phase !== 'hunt' || p.state !== 'alive') return ack({ ok: false, err: 'role' });
      if (now < p.lungeCd) return ack({ ok: false, err: 'cooldown' });
      p.lungeUntil = now + self.cfg.LUNGE_MS; p.lungeCd = now + self.cfg.LUNGE_CD; self.emitRoom(r, 'lunge', { id: p.id }); ack({ ok: true, cd: self.cfg.LUNGE_CD });
    });
    sock.on('disconnect', () => self.onDisc(ctx, sock));
  }

  // ---------- desconexión / salida ----------
  onDisc(ctx, sock) {
    const r = this.rooms.get(ctx.code); if (!r) return; const p = r.players.get(ctx.pid); if (!p || p.sock !== sock) return;
    p.sock = null; p.connected = false; p.discAt = this.now();
    if (r.host === p.id) this.reassignHost(r);
    this.broadcastRoom(r);
  }
  reassignHost(r) { const n = [...r.players.values()].find(x => x.connected); if (n) r.host = n.id; }
  removePlayer(r, p, reason) {
    const wasMon = r.monster === p.id, running = r.phase === 'hidden' || r.phase === 'hunt';
    r.players.delete(p.id); try { if (p.sock) p.sock.leave('r:' + r.code); } catch (_) {}
    if (p.ctx) { p.ctx.pid = null; p.ctx.code = null; } else if (p.sock) { /* ctx se limpia abajo */ }
    if (r.players.size === 0) return this.rooms.delete(r.code);
    if (r.host === p.id) this.reassignHost(r);
    if (running) { if (wasMon) this.reassignMonster(r); else this.checkEnd(r); }
    this.emitRoom(r, 'player:left', { id: p.id, reason }); this.broadcastRoom(r);
  }

  // ---------- inicio de partida y selección secreta del monstruo ----------
  startGame(r, on) {
    const now = this.now(), c = this.cfg;
    for (const p of [...r.players.values()]) if (!p.connected) { r.players.delete(p.id); }
    r.phase = 'hidden'; r.startedAt = now; r.found.clear(); r.backAt = 0;
    r.monster = on[this.rnd(on.length)].id;
    r.transformAt = now + c.TRANSFORM_AUTO[0] + this.rnd(c.TRANSFORM_AUTO[1] - c.TRANSFORM_AUTO[0]);
    const list = [...r.players.values()]; list.forEach((p, i) => {
      const a = i / list.length * Math.PI * 2; Object.assign(p, { state: 'alive', lives: c.LIVES, captures: 0, strikes: 0, x: r2(Math.cos(a) * 3), z: r2(6 + Math.sin(a) * 3), yaw: Math.PI, v: 0, fl: 0, lastT: now, immUntil: 0, capUntil: 0, lungeUntil: 0, lungeCd: 0 });
    });
    for (const p of list) if (p.sock) p.sock.emit('game:start', { role: p.id === r.monster ? 'monster' : 'survivor', spawn: { x: p.x, z: p.z }, lives: c.LIVES, npapers: W.NPAPERS });
    this.broadcastRoom(r);
  }
  transform(r) { r.phase = 'hunt'; r.huntAt = this.now(); this.emitRoom(r, 'game:phase', { phase: 'hunt', monster: r.monster }); }
  reassignMonster(r) {
    const cand = [...r.players.values()].filter(p => p.connected && p.state === 'alive' && p.id !== r.monster);
    const old = r.players.get(r.monster); if (old) { old.state = 'out'; }
    if (!cand.length) return this.end(r, 'survivors', 'monster-left');
    const n = cand[this.rnd(cand.length)]; r.monster = n.id;
    if (r.phase === 'hunt') this.emitRoom(r, 'game:phase', { phase: 'hunt', monster: n.id, reassigned: true });
    else if (n.sock) n.sock.emit('game:role', { role: 'monster' });
    this.checkEnd(r);
  }
  resumeInfo(r, p) {
    if (r.phase !== 'hidden' && r.phase !== 'hunt') return null;
    return { phase: r.phase, role: p.id === r.monster ? 'monster' : 'survivor', lives: p.lives, state: p.state, found: [...r.found],
      monster: r.phase === 'hunt' ? r.monster : null, x: p.x, z: p.z, yaw: p.yaw };
  }

  // ---------- validación de acciones ----------
  correct(p) { if (p.sock) p.sock.emit('correct', { x: p.x, z: p.z }); }
  onMove(r, p, d) {
    if ((r.phase !== 'hidden' && r.phase !== 'hunt') || p.state !== 'alive') return;
    if (!isNum(d.x, 500) || !isNum(d.z, 500) || !isNum(d.yaw, 100)) { p.strikes++; return; }
    const now = this.now(), c = this.cfg, dt = Math.min(1, Math.max(.016, (now - p.lastT) / 1000));
    const mon = r.monster === p.id && r.phase === 'hunt', lunge = mon && now < p.lungeUntil + 150;
    const vmax = (mon ? (lunge ? c.LUNGE_V : c.MON_V) : c.SURV_V) * 1.3 + .5, dist = Math.hypot(d.x - p.x, d.z - p.z);
    if (dist > vmax * dt + .4 || Math.hypot(d.x, d.z) > W.WR - W.PR + .05 || !W.freeM(d.x, d.z, W.PR - .12)) {
      if (++p.strikes > c.MAX_STRIKES && p.sock) { try { p.sock.emit('kicked', { reason: 'movimiento inválido repetido' }); } catch (_) {} }
      this.correct(p); return;
    }
    p.v = dist / dt; p.x = d.x; p.z = d.z; p.yaw = d.yaw; p.fl = d.fl ? 1 : 0; p.lastT = now;
  }
  onPickup(r, p, d) {
    if ((r.phase !== 'hidden' && r.phase !== 'hunt') || p.state !== 'alive') return { ok: false, err: 'state' };
    if (r.monster === p.id) return { ok: false, err: 'role' };
    const id = d.id; if (!Number.isInteger(id) || id < 0 || id >= W.NPAPERS) return { ok: false, err: 'id' };
    if (r.found.has(id)) return { ok: false, err: 'taken' };
    const q = W.PAPERS[id]; if (Math.hypot(q.x - p.x, q.z - p.z) > this.cfg.PICK_DIST) return { ok: false, err: 'far' };
    r.found.add(id); this.emitRoom(r, 'paper:found', { id, by: p.id, count: r.found.size });
    if (r.found.size >= W.NPAPERS) this.end(r, 'survivors', 'papers');
    return { ok: true, count: r.found.size };
  }

  // ---------- bucle del servidor ----------
  tick() { const now = this.now(); this.tickN++; for (const r of [...this.rooms.values()]) this.stepRoom(r, now); }
  stepRoom(r, now) {
    const c = this.cfg, all = [...r.players.values()];
    if (!all.some(p => p.connected)) {
      r.emptySince = r.emptySince || now;
      if (now - r.emptySince > (r.phase === 'lobby' ? c.GRACE_LOBBY : c.GRACE_GAME)) this.rooms.delete(r.code);
      return;
    }
    r.emptySince = 0;
    for (const p of all) if (!p.connected) {
      const running = r.phase === 'hidden' || r.phase === 'hunt';
      if (running && p.id === r.monster && now - p.discAt > c.MON_GRACE) this.reassignMonster(r);
      else if (now - p.discAt > (running ? c.GRACE_GAME : c.GRACE_LOBBY)) this.removePlayer(r, p, 'timeout');
    }
    if (!this.rooms.has(r.code)) return;
    if (r.phase === 'hidden' && now >= r.transformAt) this.transform(r);
    if (r.phase === 'hunt') this.stepHunt(r, now);
    if ((r.phase === 'hidden' || r.phase === 'hunt') && this.tickN % c.SNAP_EVERY === 0) this.snap(r, now);
    if (r.phase === 'ended' && now >= r.backAt) this.backToLobby(r);
  }
  stepHunt(r, now) {
    const c = this.cfg;
    for (const p of r.players.values()) if (p.state === 'captured' && now >= p.capUntil) {
      if (p.lives > 0) {
        p.state = 'alive'; p.x = r2(Math.cos(this.rnd(628) / 100) * 2); p.z = r2(6 + Math.sin(this.rnd(628) / 100) * 2); p.immUntil = now + c.IMMUNE_MS; p.lastT = now; p.v = 0;
        this.emitRoom(r, 'respawn', { id: p.id, x: p.x, z: p.z, imm: c.IMMUNE_MS }); this.correct(p);
      } else { p.state = 'out'; this.emitRoom(r, 'out', { id: p.id }); }
      this.checkEnd(r);
      if (r.phase !== 'hunt') return;
    }
    const m = r.players.get(r.monster);
    if (m && m.connected && m.state === 'alive') for (const p of r.players.values()) {
      if (p.id === m.id || p.state !== 'alive' || !p.connected || now < p.immUntil) continue;
      if (Math.hypot(p.x - m.x, p.z - m.z) < c.CAP_DIST) {
        p.state = 'captured'; p.lives--; p.capUntil = now + c.CAP_MS; p.v = 0; m.captures++;
        this.emitRoom(r, 'capture', { victim: p.id, monster: m.id, lives: p.lives, ms: c.CAP_MS });
        this.checkEnd(r); if (r.phase !== 'hunt') return;
      }
    }
  }
  snap(r, now) {
    const a = []; for (const p of r.players.values()) if (p.state !== 'out') a.push([p.id, r2(p.x), r2(p.z), r2(p.yaw), r2(p.v), p.fl ? 1 : 0, p.state === 'captured' ? 1 : 0]);
    this.emitRoom(r, 'snap', { t: now, p: a });
  }
  checkEnd(r) {
    if (r.phase !== 'hidden' && r.phase !== 'hunt') return;
    const surv = [...r.players.values()].filter(p => p.id !== r.monster);
    if (!surv.length) return this.end(r, 'monster', 'abandoned');
    if (surv.every(p => p.state === 'out' || (p.state === 'captured' && p.lives <= 0))) this.end(r, 'monster', 'all-captured');
  }
  end(r, winner, reason) {
    if (r.phase === 'ended') return; const m = r.players.get(r.monster);
    r.phase = 'ended'; r.backAt = this.now() + this.cfg.BACK_MS;
    this.emitRoom(r, 'game:end', { winner, reason, monster: r.monster, monsterName: m ? m.name : '?', found: r.found.size,
      players: [...r.players.values()].map(p => ({ id: p.id, name: p.name, captures: p.captures, lives: p.lives, st: p.state })) });
  }
  backToLobby(r) {
    for (const p of [...r.players.values()]) { if (!p.connected) { r.players.delete(p.id); continue; } Object.assign(p, { state: 'alive', lives: this.cfg.LIVES, v: 0 }); }
    r.phase = 'lobby'; r.monster = null; r.found.clear(); if (!r.players.has(r.host)) this.reassignHost(r);
    if (!r.players.size) return this.rooms.delete(r.code); this.broadcastRoom(r);
  }
}
module.exports = { Rooms, CFG, clean };
