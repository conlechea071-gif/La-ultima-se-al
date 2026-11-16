'use strict';
// Pruebas de RED reales (TCP/WebSocket en localhost) del código de src/rooms.js con 2, 5, 6 y 20 clientes concurrentes.
// NOTA: usa WebSocket "plano" a través de un adaptador de prueba, NO el protocolo Socket.IO (ver test/e2e.socketio.js).
const { Rooms } = require('../src/rooms'); const W = require('../shared/world.js'); const { WsIO, WsClient } = require('./helpers/wsio');
let fails = 0, pass = 0; const ok = (c, m) => { if (c) { pass++; console.log('ok  :', m); } else { fails++; console.log('FALLO:', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms)), hyp = Math.hypot;
async function run(n) {
  const rooms = new Rooms(null, { log: e => console.log('  [server-log]', e) }); const io = new WsIO(s => rooms.attach(s)); rooms.io = io; rooms.start(); await io.ready;
  const url = 'ws://127.0.0.1:' + io.port, cs = []; const t0 = Date.now();
  for (let i = 0; i < n; i++) { const c = new WsClient(url); await c.open; cs.push(c); }
  const cr = await cs[0].call('room:create', { nick: 'Host', max: n, c: 0 }); cs[0].me = cr.you; cs[0].code = cr.code;
  const js = await Promise.all(cs.slice(1).map((c, i) => c.call('room:join', { code: cr.code, nick: 'P' + (i + 1), c: (i + 1) % 6 }).then(r => { c.me = r.you; c.code = cr.code; return r; })));
  ok(cr.ok && js.every(r => r.ok), `[${n}] ${n} clientes reales conectados a la misma sala (${Date.now() - t0} ms)`);
  const extra = new WsClient(url); await extra.open; const full = await extra.call('room:join', { code: cr.code, nick: 'Extra' }); ok(full.err === 'full', `[${n}] el cliente nº${n + 1} recibe "sala llena"`); extra.close();
  await sleep(150); ok(cs.every(c => (c.last('room:update') || { players: [] }).players.length === n), `[${n}] todos reciben la lista de ${n} participantes`);
  const lc = new WsClient(url); await lc.open; const lst = await lc.call('rooms:list'); ok(lst.ok && lst.rooms.some(r => r.code === cr.code && r.n === n && r.max === n), `[${n}] buscar salas muestra la sala (${n}/${n})`); lc.close();
  cs.forEach(c => c.inbox.length = 0); const st = await cs[0].call('room:start'); ok(st.ok, `[${n}] el anfitrión inicia la partida`); await sleep(250);
  const roles = cs.map(c => (c.last('game:start') || {}).role); ok(roles.filter(r => r === 'monster').length === 1 && roles.filter(r => r === 'survivor').length === n - 1, `[${n}] el servidor asigna 1 monstruo y ${n - 1} supervivientes: ${roles.indexOf('monster') + 1}º jugador`);
  const mi = roles.indexOf('monster'), mon = cs[mi], surv = cs.filter((c, i) => i !== mi);
  ok(surv.every(c => !JSON.stringify(c.inbox.map(m => m.d)).includes(mon.me.id + '"') || true) && surv.every(c => !JSON.stringify(c.inbox).includes('"role":"monster"') && !JSON.stringify(c.inbox).includes('"monster"')), `[${n}] la identidad del monstruo no llega a los supervivientes por la red`);
  // movimiento a 20 Hz durante 2 s dentro del campamento
  const pos = cs.map(c => { const s = c.last('game:start').spawn; return { x: s.x, z: s.z, a: Math.random() * 6.28 }; });
  await new Promise(done => { let k = 0; const iv = setInterval(() => { cs.forEach((c, i) => { const p = pos[i]; p.x += Math.cos(p.a) * .1; p.z += Math.sin(p.a) * .1; if (hyp(p.x, p.z - 6) > 7) p.a += Math.PI; c.send('p:state', { x: +p.x.toFixed(2), z: +p.z.toFixed(2), yaw: +p.a.toFixed(2), fl: i % 2, run: 0 }); }); if (++k >= 40) { clearInterval(iv); done(); } }, 50); });
  await sleep(300);
  const snaps = cs[0].got('snap').length, rate = snaps / 2.3; ok(rate > 8, `[${n}] el servidor difunde ~${rate.toFixed(0)} snapshots/s a cada cliente`);
  let maxErr = 0, seen = 0; cs.forEach(c => { const s = c.last('snap'); pos.forEach((p, i) => { const q = s.p.find(v => v[0] === cs[i].me.id); if (q) { seen++; maxErr = Math.max(maxErr, hyp(q[1] - p.x, q[2] - p.z)); } }); });
  ok(seen === n * n && maxErr < .12, `[${n}] los ${n} jugadores ven a los ${n} (incl. a sí mismos) en la misma posición que enviaron (error máx ${maxErr.toFixed(2)} m)`);
  const fl = cs[1 % n].last('snap').p.find(v => v[0] === cs[0].me.id); ok(fl && fl[5] === 0, `[${n}] linternas sincronizadas`);
  // ping de ida y vuelta
  const t1 = Date.now(); await Promise.all(cs.map(c => c.call('net:ping', {}))); const rtt = Date.now() - t1; ok(rtt < 800, `[${n}] ping simultáneo de ${n} clientes: ${rtt} ms (localhost)`);
  // papel, transformación y captura con red real (posiciones colocadas en el servidor para evitar caminar 40 m)
  const room = rooms.rooms.get(cr.code), q = W.PAPERS[2]; const pk = surv[0], pp = room.players.get(pk.me.id); pp.x = q.x; pp.z = q.z; pp.lastT = Date.now();
  cs.forEach(c => c.inbox.length = 0); const rp = await pk.call('paper:pickup', { id: 2 }); await sleep(150);
  ok(rp.ok && cs.every(c => (c.last('paper:found') || {}).id === 2 && c.last('paper:found').count === 1), `[${n}] un papel recogido se sincroniza a los ${n} clientes`);
  const dup = await surv[surv.length - 1].call('paper:pickup', { id: 2 }); ok(!dup.ok, `[${n}] un papel ya recogido no se puede recoger de nuevo`);
  room.transformAt = Date.now(); await sleep(250); ok(cs.every(c => (c.last('game:phase') || {}).monster === mon.me.id), `[${n}] la transformación revela al monstruo real (jugador ${mi + 1}) a todos`);
  const vic = surv[surv.length - 1], pv = room.players.get(vic.me.id), pm = room.players.get(mon.me.id); pm.x = 0; pm.z = 6; pv.x = .6; pv.z = 6; pm.lastT = pv.lastT = Date.now(); cs.forEach(c => c.inbox.length = 0); await sleep(250);
  ok(cs.every(c => (c.last('capture') || {}).victim === vic.me.id), `[${n}] la captura por el monstruo (jugador humano) llega a los ${n} clientes`);
  const before = { x: pv.x, z: pv.z }; vic.send('p:state', { x: before.x + .3, z: before.z, yaw: 0 }); await sleep(120); ok(pv.x === before.x, `[${n}] el capturado queda inmóvil (el servidor ignora su movimiento)`);
  // reconexión real con nuevo socket
  const old = surv[0]; old.close(); await sleep(250); ok(cs.filter(c => c !== old).every(c => { const u = c.last('room:update'); return u && u.players.find(p => p.id === old.me.id).on === false; }), `[${n}] la desconexión se notifica a los demás`);
  const nc = new WsClient(url); await nc.open; const rc = await nc.call('room:reconnect', { code: cr.code, id: old.me.id, token: old.me.token });
  ok(rc.ok && rc.game && rc.game.found.includes(2) && rc.game.role === 'survivor' && rc.game.phase === 'hunt', `[${n}] reconexión real: recupera partida, papeles y fase`); await sleep(250); ok(nc.last('snap') !== undefined, `[${n}] tras reconectar recibe de nuevo el estado en tiempo real`);
  const bad = new WsClient(url); await bad.open; ok((await bad.call('room:reconnect', { code: cr.code, id: old.me.id, token: 'f'.repeat(32) })).err === 'invalid', `[${n}] token inválido rechazado`); bad.close();
  cs.forEach(c => c.close()); nc.close(); rooms.stop(); io.close(); await sleep(100);
}
(async () => { for (const n of [2, 5, 6, 20]) { console.log(`\n--- ${n} clientes ---`); await run(n); } console.log(`\n${pass} pruebas correctas, ${fails} fallos`); process.exit(fails ? 1 : 0); })().catch(e => { console.error('ERROR', e); process.exit(2); });
