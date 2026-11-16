'use strict';
// Adaptador de PRUEBA: expone WebSockets reales (librería ws) con la misma interfaz mínima que Socket.IO (on/emit/join/to).
// Sirve para probar el código real de src/rooms.js a través de TCP/localhost con clientes concurrentes.
// (En producción se usa Socket.IO: src/server.js).
const { WebSocketServer } = require('ws');
class WsSock {
  constructor(io, ws) {
    this.io = io; this.ws = ws; this.h = {}; this.rooms = new Set(); this.connected = true; this.id = Math.random().toString(36).slice(2);
    ws.on('message', raw => {
      let m; try { m = JSON.parse(raw); } catch (_) { return; } if (!Array.isArray(m)) return;
      const [ev, d, ackId] = m, f = this.h[ev]; if (!f) return;
      f(d, ackId === undefined ? undefined : res => { if (ws.readyState === 1) ws.send(JSON.stringify(['ack', ackId, res])); });
    });
    ws.on('close', () => { this.connected = false; io.socks.delete(this); if (this.h.disconnect) this.h.disconnect(); });
  }
  on(e, f) { this.h[e] = f; }
  emit(e, d) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify([e, d])); }
  join(r) { this.rooms.add(r); } leave(r) { this.rooms.delete(r); }
}
class WsIO {
  constructor(onConn, opts = {}) {   // opts.server: engancha los WebSockets a un servidor http/https existente (misma dirección que la página)
    this.socks = new Set(); this.wss = new WebSocketServer(opts.server ? { server: opts.server } : { port: 0, host: '127.0.0.1' });
    this.ready = opts.server ? Promise.resolve() : new Promise(r => this.wss.on('listening', r));
    this.wss.on('connection', ws => { const s = new WsSock(this, ws); this.socks.add(s); onConn(s); });
  }
  get port() { return this.wss.address().port; }
  to(room) { return { emit: (e, d) => { const msg = JSON.stringify([e, d]); for (const s of this.socks) if (s.rooms.has(room) && s.ws.readyState === 1) s.ws.send(msg); } }; }
  close() { for (const s of this.socks) s.ws.terminate(); this.wss.close(); }
}
class WsClient {
  constructor(url) {
    this.ws = new WebSocket(url); this.acks = new Map(); this.n = 0; this.inbox = []; this.me = null; this.code = null;
    this.open = new Promise((res, rej) => { this.ws.addEventListener('open', res); this.ws.addEventListener('error', rej); });
    this.ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m[0] === 'ack') { const f = this.acks.get(m[1]); this.acks.delete(m[1]); if (f) f(m[2]); return; } this.inbox.push({ ev: m[0], d: m[1], t: Date.now() }); });
  }
  call(ev, d) { return new Promise(res => { const id = ++this.n; this.acks.set(id, res); this.ws.send(JSON.stringify([ev, d, id])); setTimeout(() => { if (this.acks.has(id)) { this.acks.delete(id); res({ ok: false, err: 'timeout' }); } }, 4000); }); }
  send(ev, d) { this.ws.send(JSON.stringify([ev, d])); }
  got(ev) { return this.inbox.filter(m => m.ev === ev).map(m => m.d); }
  last(ev) { const a = this.got(ev); return a[a.length - 1]; }
  close() { try { this.ws.close(); } catch (_) {} }
}
module.exports = { WsIO, WsClient };
