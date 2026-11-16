'use strict';
// Protecciones de conexión: origen de WebSocket y límite de conexiones por IP.
function originAllowed(origin, host, allowed = []) {
  if (!origin) return true;                              // clientes que no son navegadores (pruebas, herramientas)
  let u; try { u = new URL(origin); } catch (_) { return false; }
  if (u.host === String(host || '').toLowerCase()) return true;   // misma dirección que la página
  return allowed.some(a => a === '*' || a === origin || a === u.host);
}
function clientIp(headers, remote, trust) {
  if (trust) { const f = String((headers || {})['x-forwarded-for'] || '').split(',')[0].trim(); if (f) return f; }
  return remote || 'unknown';
}
class ConnLimiter {
  constructor(max) { this.max = max; this.n = new Map(); }
  take(ip) { const c = this.n.get(ip) || 0; if (c >= this.max) return false; this.n.set(ip, c + 1); return true; }
  release(ip) { const c = (this.n.get(ip) || 1) - 1; if (c <= 0) this.n.delete(ip); else this.n.set(ip, c); }
}
module.exports = { originAllowed, clientIp, ConnLimiter };
