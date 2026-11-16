'use strict';
/**
 * LA ÚLTIMA SEÑAL — servidor de producción: página + Socket.IO en la MISMA dirección.
 * En Render/Railway la plataforma pone el HTTPS/WSS por delante (TLS en el proxy) y el servidor escucha en $PORT.
 * Para un VPS sin proxy puedes usar TLS_KEY/TLS_CERT y este mismo proceso servirá HTTPS directamente.
 */
const fs = require('fs'), path = require('path'), http = require('http'), https = require('https');
const { Server } = require('socket.io');
const load = require('./config'), { Rooms } = require('./rooms'), { createHandler } = require('./http'), { originAllowed, clientIp, ConnLimiter } = require('./guard');
const pkg = require('../package.json');

function create(env = process.env) {
  const cfg = load(env);
  const handler = createHandler({ forceHttps: cfg.forceHttps, trustProxy: cfg.trustProxy, version: pkg.version, health: () => ({ rooms: rooms.rooms.size, players: [...rooms.rooms.values()].reduce((n, r) => n + [...r.players.values()].filter(p => p.connected).length, 0), version: pkg.version }) });
  const server = cfg.tlsKey && cfg.tlsCert ? https.createServer({ key: fs.readFileSync(cfg.tlsKey), cert: fs.readFileSync(cfg.tlsCert) }, handler) : http.createServer(handler);
  const allowed = cfg.allowedOrigins.concat(cfg.publicUrl ? [cfg.publicUrl] : []);
  const io = new Server(server, {
    maxHttpBufferSize: 1e4, pingInterval: 5000, pingTimeout: 8000, connectTimeout: 10000, transports: ['websocket', 'polling'],
    allowRequest: (req, cb) => cb(null, originAllowed(req.headers.origin, req.headers.host, allowed)),   // evita WebSockets desde páginas ajenas
  });
  const rooms = new Rooms(io, { log: (...a) => console.error('[rooms]', ...a) }), limiter = new ConnLimiter(cfg.maxConnPerIp);
  io.use((socket, next) => { const ip = clientIp(socket.handshake.headers, socket.handshake.address, cfg.trustProxy); if (!limiter.take(ip)) return next(new Error('demasiadas conexiones')); socket.once('disconnect', () => limiter.release(ip)); next(); });
  io.on('connection', socket => rooms.attach(socket));
  io.engine.on('connection_error', e => { if (!cfg.prod) console.error('[engine]', e.code, e.message); });
  return { cfg, server, io, rooms };
}
module.exports = { create };

if (require.main === module) {
  const { cfg, server, io, rooms } = create();
  rooms.start();
  server.listen(cfg.port, cfg.host, () => console.log(`LA ÚLTIMA SEÑAL escuchando en ${cfg.host}:${cfg.port} (${cfg.tlsKey ? 'HTTPS directo' : 'HTTP; TLS lo pone el proxy del hosting'})${cfg.publicUrl ? ' — ' + cfg.publicUrl : ''}`));
  process.on('unhandledRejection', e => console.error('[unhandledRejection]', e && e.stack || e));
  process.on('uncaughtException', e => console.error('[uncaughtException]', e && e.stack || e));
  let closing = false; const bye = () => { if (closing) return; closing = true; console.log('Cerrando…'); try { io.emit('server:msg', { type: 'restart' }); } catch (_) {} rooms.stop(); io.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); };
  process.on('SIGINT', bye); process.on('SIGTERM', bye);
}
