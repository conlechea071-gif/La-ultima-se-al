'use strict';
/**
 * Prueba de extremo a extremo contra un servidor REAL con Socket.IO (local o desplegado).
 *   npm install
 *   npm start                      # en otra terminal (o usa la URL de tu servidor desplegado)
 *   SERVER=http://localhost:3000 N=5 node test/e2e.socketio.js
 * Crea una sala de N jugadores (2, 5, 6, 10 ó 20), los conecta, inicia la partida y comprueba roles, secreto del monstruo,
 * sincronización de posiciones, sala llena, desconexión/reconexión y salida.  (Esta versión de la prueba NO se ha ejecutado
 * en el entorno donde se escribió: allí no se podía instalar socket.io. Ejecútala tú y revisa el resultado.)
 */
const { io } = require('socket.io-client');
const SERVER = process.env.SERVER || 'http://localhost:3000', N = Number(process.env.N) || 5;
let fails = 0; const ok = (c, m) => { if (c) console.log('ok  :', m); else { fails++; console.log('FALLO:', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms)), call = (s, ev, d) => new Promise(res => { const t = setTimeout(() => res({ ok: false, err: 'timeout' }), 5000); s.emit(ev, d, r => { clearTimeout(t); res(r); }); });
(async () => {
  const cs = []; for (let i = 0; i < N; i++) { const s = io(SERVER, { transports: ['websocket'], forceNew: true }); s.inbox = []; s.onAny((ev, d) => s.inbox.push({ ev, d })); await new Promise((res, rej) => { s.on('connect', res); s.on('connect_error', rej); }); cs.push(s); }
  ok(cs.every(s => s.connected), `${N} clientes Socket.IO conectados a ${SERVER}`);
  const cr = await call(cs[0], 'room:create', { nick: 'Host', max: N, c: 0 }); ok(cr.ok && /^[A-Z2-9]{5}$/.test(cr.code), `sala creada (${cr.code})`); cs[0].me = cr.you;
  const js = await Promise.all(cs.slice(1).map((s, i) => call(s, 'room:join', { code: cr.code, nick: 'P' + (i + 1), c: (i + 1) % 6 }).then(r => { s.me = r.you; return r; }))); ok(js.every(r => r.ok), `${N - 1} jugadores se unen con el código`);
  const extra = io(SERVER, { transports: ['websocket'], forceNew: true }); await new Promise(r => extra.on('connect', r)); ok((await call(extra, 'room:join', { code: cr.code, nick: 'Extra' })).err === 'full', 'el jugador sobrante recibe "sala llena"'); extra.close();
  cs.forEach(s => s.inbox.length = 0); ok((await call(cs[0], 'room:start', {})).ok, 'el anfitrión inicia la partida'); await sleep(500);
  const roles = cs.map(s => (s.inbox.find(m => m.ev === 'game:start') || { d: {} }).d.role); ok(roles.filter(r => r === 'monster').length === 1 && roles.filter(r => r === 'survivor').length === N - 1, `1 monstruo y ${N - 1} supervivientes (monstruo: jugador ${roles.indexOf('monster') + 1})`);
  const mi = roles.indexOf('monster'); ok(cs.every((s, i) => i === mi || !JSON.stringify(s.inbox).includes('"monster"')), 'el monstruo es secreto para los supervivientes');
  const pos = cs.map(s => { const g = s.inbox.find(m => m.ev === 'game:start').d.spawn; return { x: g.x, z: g.z }; });
  for (let k = 0; k < 30; k++) { cs.forEach((s, i) => { pos[i].x += .08; s.volatile.emit('p:state', { x: +pos[i].x.toFixed(2), z: +pos[i].z.toFixed(2), yaw: 1, fl: i % 2, run: 0 }); }); await sleep(50); } await sleep(300);
  let maxErr = 0; cs.forEach(s => { const sn = [...s.inbox].reverse().find(m => m.ev === 'snap'); pos.forEach((p, i) => { const q = sn && sn.d.p.find(v => v[0] === cs[i].me.id); if (!q) maxErr = 99; else maxErr = Math.max(maxErr, Math.hypot(q[1] - p.x, q[2] - p.z)); }); });
  ok(maxErr < .2, `todos ven a todos en la posición correcta (error máx ${maxErr.toFixed(2)} m)`);
  const t = cs[N - 1]; const tok = t.me; t.disconnect(); await sleep(400); const nt = io(SERVER, { transports: ['websocket'], forceNew: true }); await new Promise(r => nt.on('connect', r)); const rc = await call(nt, 'room:reconnect', { code: cr.code, id: tok.id, token: tok.token }); ok(rc.ok && rc.game && rc.game.phase, 'reconexión con token: recupera la partida'); nt.close();
  ok((await call(cs[0], 'room:leave', {})).ok, 'salir de la partida'); cs.forEach(s => s.close()); console.log(fails ? `\n${fails} FALLO(S)` : '\nE2E SOCKET.IO OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message); process.exit(2); });
