'use strict';
// Transporte falso en memoria: ejecuta el MISMO código de src/rooms.js sin red (para pruebas de lógica rápidas y deterministas).
class FakeSocket {
  constructor(io) { this.io = io; this.h = {}; this.rooms = new Set(); this.inbox = []; this.connected = true; this.id = Math.random().toString(36).slice(2); }
  on(e, f) { this.h[e] = f; }
  emit(e, d) { if (this.connected) this.inbox.push({ ev: e, d: JSON.parse(JSON.stringify(d === undefined ? null : d)) }); }
  join(r) { this.rooms.add(r); } leave(r) { this.rooms.delete(r); }
}
class FakeIO {
  constructor() { this.socks = new Set(); }
  to(room) { return { emit: (e, d) => { for (const s of this.socks) if (s.connected && s.rooms.has(room)) s.emit(e, d); } }; }
}
class Client {
  constructor(io, rooms) { this.io = io; this.s = new FakeSocket(io); io.socks.add(this.s); rooms.attach(this.s); this.me = null; this.code = null; }
  call(ev, d) { let r; const p = d === undefined ? undefined : JSON.parse(JSON.stringify(d)); if (this.s.h[ev]) this.s.h[ev](p, x => { r = x; }); return r; }
  raw(ev, p) { let r; if (this.s.h[ev]) this.s.h[ev](p, x => { r = x; }); return r; }
  got(ev) { return this.s.inbox.filter(m => m.ev === ev).map(m => m.d); }
  last(ev) { const a = this.got(ev); return a[a.length - 1]; }
  clear() { this.s.inbox.length = 0; }
  disconnect() { this.s.connected = false; if (this.s.h.disconnect) this.s.h.disconnect(); this.io.socks.delete(this.s); }
}
module.exports = { FakeIO, FakeSocket, Client };
