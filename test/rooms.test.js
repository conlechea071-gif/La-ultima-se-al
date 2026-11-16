'use strict';
// Pruebas de LÓGICA del servidor con transporte falso (misma lógica que en producción, sin red).
const { Rooms, CFG } = require('../src/rooms');
const W = require('../shared/world.js');
const { FakeIO, Client } = require('./helpers/fake');
let T = 1e9, fails = 0, pass = 0;
const ok = (c, m) => { if (c) { pass++; console.log('ok  :', m); } else { fails++; console.log('FALLO:', m); } };
const env = () => { const io = new FakeIO(); const rooms = new Rooms(io, { now: () => T, log: () => {} }); return { io, rooms, cl: () => new Client(io, rooms) }; };
const adv = (rooms, ms) => { const end = T + ms; while (T < end) { T += 50; rooms.tick(); } };
const hyp = Math.hypot;
function lobby(e, n, max) {
  const host = e.cl(); const r = host.call('room:create', { nick: 'Host', max, c: 0 }); host.me = r.you; host.code = r.code;
  const cs = [host]; for (let i = 1; i < n; i++) { const c = e.cl(); const j = c.call('room:join', { code: r.code, nick: 'P' + i, c: i % 6 }); if (!j.ok) throw new Error('join ' + JSON.stringify(j)); c.me = j.you; c.code = r.code; cs.push(c); }
  return { host, cs, code: r.code, room: () => e.rooms.rooms.get(r.code) };
}
function started(e, n, max) { const L = lobby(e, n, max); L.cs.forEach(c => c.clear()); const s = L.host.call('room:start'); if (!s.ok) throw new Error('start ' + JSON.stringify(s)); L.mon = L.cs.find(c => c.last('game:start').role === 'monster'); L.surv = L.cs.filter(c => c !== L.mon); return L; }
const srv = (L, c) => L.room().players.get(c.me.id);

// ---------- A. salas ----------
for (const max of CFG.MAXES) {
  const e = env(); const L = lobby(e, max, max); const extra = e.cl(); const r = extra.call('room:join', { code: L.code, nick: 'Extra' });
  ok(L.room().players.size === max && !r.ok && r.err === 'full', `sala de ${max}: admite exactamente ${max} jugadores y rechaza al siguiente (${r.err})`);
  ok(L.cs.every(c => (c.last('room:update') || {}).players.length === max), `sala de ${max}: todos reciben la lista de participantes (${max})`);
}
{ const e = env(); const c = e.cl(); const bad = [1, 3, 4, 7, 21, 100, 'x', null, undefined, -5, 2.5].map(m => c.call('room:create', { nick: 'Ab', max: m }).err);
  ok(bad.every(x => x === 'max'), 'tamaños de sala inválidos rechazados (solo 2, 5, 6, 10, 20)'); }
{ const e = env(); const c = e.cl(); ok(c.call('room:create', { nick: 'x', max: 5 }).err === 'nick', 'apodo demasiado corto rechazado');
  const r = c.call('room:create', { nick: '<b>Al</b>;DROP', max: 5 }); ok(r.ok && !/[<>;]/.test(e.rooms.rooms.get(r.code).players.get(r.you.id).name), 'apodo saneado (sin caracteres peligrosos)'); }
{ const e = env(); const L = lobby(e, 5, 5); const names = [...L.room().players.values()].map(p => p.name.toLowerCase()); ok(new Set(names).size === 5, 'nombres únicos');
  const e2 = env(); const h = e2.cl(); const r = h.call('room:create', { nick: 'Sam', max: 5 }); const c2 = e2.cl(); const j = c2.call('room:join', { code: r.code, nick: 'sam' }); ok(j.ok && e2.rooms.rooms.get(r.code).players.get(j.you.id).name !== 'sam', 'apodo repetido se renombra'); }
{ const e = env(); const seen = new Set(); let allOk = true, busy = null;
  for (let i = 0; i < 300; i++) { const c = e.cl(); const r = c.call('room:create', { nick: 'Host' + i, max: 5 }); if (!r.ok) { busy = r.err; break; } seen.add(r.code); allOk = allOk && /^[A-HJ-NP-Z2-9]{5}$/.test(r.code); }
  ok(seen.size === 300 && allOk, '300 códigos de invitación únicos y legibles (sin 0/O/1/I)'); const c = e.cl(); ok(c.call('room:create', { nick: 'Extra', max: 5 }).err === 'busy', 'límite global de salas respetado'); }
{ const e = env(); const L = lobby(e, 2, 5); const c = e.cl();
  ok(c.call('room:join', { code: 'ZZZZZ', nick: 'Zed' }).err === 'notfound', 'código inexistente rechazado');
  const j = c.call('room:join', { code: ' ' + L.code.toLowerCase() + ' ', nick: 'Zed' }); ok(j.ok, 'el código admite minúsculas y espacios');
  ok(c.call('room:join', { code: L.code, nick: 'Zed2' }).err === 'already', 'un socket no puede estar en dos salas'); }
{ const e = env(); const c = e.cl(); const r = c.call('room:create', { nick: 'Host', max: 5, pub: false }); const o = e.cl(); const l = o.call('rooms:list'); ok(l.ok && l.rooms.length === 0, 'sala privada no aparece al buscar salas');
  const h2 = e.cl(); const r2 = h2.call('room:create', { nick: 'Host2', max: 6, name: 'Mi bosque' }); const l2 = o.call('rooms:list'); ok(l2.rooms.length === 1 && l2.rooms[0].code === r2.code && l2.rooms[0].n === 1 && l2.rooms[0].max === 6, 'buscar salas lista las públicas con jugadores/máximo'); }
{ const e = env(); const L = lobby(e, 3, 5); const r1 = L.cs[1].call('room:start'); ok(r1.err === 'host', 'solo el anfitrión puede iniciar');
  const e2 = env(); const h = e2.cl(); h.call('room:create', { nick: 'Solo', max: 2 }); ok(h.call('room:start').err === 'min', 'se necesitan al menos 2 jugadores');
  const s = L.host.call('room:start'); const late = e.cl(); ok(s.ok && late.call('room:join', { code: L.code, nick: 'Tarde' }).err === 'started', 'tras iniciar, no se admiten nuevos jugadores'); }
{ const e = env(); const L = lobby(e, 3, 5); L.host.call('room:leave'); ok(L.room().host !== L.host.me.id && L.cs[1].last('room:update').players.length === 2, 'si el anfitrión sale, otro jugador pasa a ser anfitrión');
  L.cs[1].call('room:leave'); L.cs[2].call('room:leave'); ok(!L.room(), 'la sala se elimina cuando queda vacía'); }

// ---------- B. monstruo aleatorio y secreto ----------
for (const [n, max] of [[2, 2], [5, 5], [6, 6], [10, 10], [20, 20]]) {
  const e = env(); const L = started(e, n, max); const mons = L.cs.filter(c => c.last('game:start').role === 'monster');
  ok(mons.length === 1 && L.surv.length === n - 1, `partida de ${n}: el servidor elige exactamente 1 monstruo humano y ${n - 1} supervivientes`);
  adv(e.rooms, 5000); const leaks = L.surv.filter(c => { const s = JSON.stringify(c.s.inbox); return s.includes('"monster"') || s.includes('"role":"monster"'); });
  ok(leaks.length === 0, `partida de ${n}: la identidad del monstruo es secreta antes de la transformación (fugas=${leaks.length})`);
  ok(L.cs.every(c => c.last('game:start').spawn && c.last('game:start').lives === 3), `partida de ${n}: todos reciben posición inicial y vidas`);
}
{ const tally = [0, 0]; for (let i = 0; i < 400; i++) { const e = env(); const L = started(e, 2, 2); tally[L.cs.indexOf(L.mon)]++; } ok(tally[0] > 140 && tally[1] > 140, `selección aleatoria equitativa (2 jugadores, 400 partidas: ${tally.join(' / ')})`);
  const t5 = [0, 0, 0, 0, 0]; for (let i = 0; i < 500; i++) { const e = env(); const L = started(e, 5, 5); t5[L.cs.indexOf(L.mon)]++; } ok(t5.every(v => v > 60), `selección aleatoria equitativa (5 jugadores, 500 partidas: ${t5.join(' / ')})`); }
{ const e = env(); const L = started(e, 5, 5);
  ok(L.mon.call('monster:transform').err === 'early', 'el monstruo no puede transformarse antes de 45 s'); adv(e.rooms, 46000);
  ok(L.surv[0].call('monster:transform').err === 'role', 'un superviviente no puede transformar al monstruo'); const r = L.mon.call('monster:transform');
  ok(r.ok && L.cs.every(c => (c.last('game:phase') || {}).monster === L.mon.me.id), 'transformación: todos reciben quién es el monstruo y la fase de caza');
  const e2 = env(); const L2 = started(e2, 5, 5); adv(e2.rooms, 121000); ok(L2.cs.every(c => (c.last('game:phase') || {}).phase === 'hunt'), 'transformación automática antes de 120 s'); }

// ---------- C. sincronización y validación de movimiento ----------
{ const e = env(); const L = started(e, 5, 5); const a = L.surv[0], pa = srv(L, a); let x = pa.x, z = pa.z, good = 0;
  for (let i = 0; i < 40; i++) { T += 50; x += .2; a.call('p:state', { x, z, yaw: 1.2, fl: i > 10 ? 1 : 0, run: 0 }); e.rooms.tick(); good++; }
  ok(Math.abs(pa.x - x) < 1e-6 && L.surv.slice(1).every(c => { const s = c.last('snap').p.find(q => q[0] === a.me.id); return s && Math.abs(s[1] - x) < .01 && s[5] === 1 && Math.abs(s[3] - 1.2) < .01; }), 'posición, rotación y linterna de un jugador llegan a todos los demás');
  const before = { x: pa.x, z: pa.z }; a.clear(); T += 50; a.call('p:state', { x: pa.x + 50, z: pa.z, yaw: 0 }); ok(pa.x === before.x && a.last('correct') && Math.abs(a.last('correct').x - before.x) < 1e-6, 'teletransporte rechazado: el servidor corrige la posición');
  T += 50; a.call('p:state', { x: pa.x + 3, z: pa.z, yaw: 0 }); ok(pa.x === before.x, 'hack de velocidad (60 m/s) rechazado');
  const tree = W.circles.find(c => c.k === 'tree' && hyp(c.x, c.z) < 40 && hyp(c.x, c.z) > 20); pa.x = tree.x + tree.r + .4; pa.z = tree.z; pa.lastT = T; T += 1000; a.call('p:state', { x: tree.x, z: tree.z, yaw: 0 }); ok(pa.x === tree.x + tree.r + .4, 'no se puede entrar en un árbol (validación de colisiones en el servidor)');
  pa.x = W.WR - .6; pa.z = 0; pa.lastT = T; T += 1000; a.call('p:state', { x: W.WR + 1, z: 0, yaw: 0 }); ok(pa.x === W.WR - .6, 'no se puede salir del límite del bosque');
  a.clear(); a.raw('p:state', { x: NaN, z: 1, yaw: 0 }); a.raw('p:state', { x: 'a', z: 1, yaw: 0 }); a.raw('p:state', { x: Infinity, z: 1, yaw: 0 }); ok(Number.isFinite(pa.x), 'valores NaN/Infinity/texto ignorados'); }
{ const e = env(); const L = lobby(e, 3, 5); const p = L.room().players.get(L.cs[1].me.id); const x0 = p.x; L.cs[1].call('p:state', { x: x0 + .1, z: p.z, yaw: 0 }); ok(p.x === x0, 'en la sala de espera los movimientos se ignoran'); }
for (const n of [2, 5, 6, 20]) {
  const e = env(); const L = started(e, n, n); const ang = L.cs.map(() => Math.random() * 6.28); const st = L.cs.map(c => ({ x: srv(L, c).x, z: srv(L, c).z }));
  for (let i = 0; i < 80; i++) { T += 50; L.cs.forEach((c, k) => { st[k].x += Math.cos(ang[k]) * .15; st[k].z += Math.sin(ang[k]) * .15; if (hyp(st[k].x, st[k].z - 6) > 8) ang[k] += Math.PI; c.call('p:state', { x: st[k].x, z: st[k].z, yaw: ang[k], fl: k % 2, run: 0 }); }); e.rooms.tick(); }
  let maxErr = 0, cnt = 0; L.cs.forEach(c => { const s = c.last('snap'); L.cs.forEach((o, k) => { const q = s.p.find(v => v[0] === o.me.id); if (q) { maxErr = Math.max(maxErr, hyp(q[1] - srv(L, o).x, q[2] - srv(L, o).z)); cnt++; } }); });
  ok(cnt === n * n && maxErr < .02, `${n} jugadores: todos ven la misma posición de los demás que el servidor (error máx ${maxErr.toFixed(3)} m)`); }

// ---------- D. papeles ----------
{ const e = env(); const L = started(e, 5, 5); const a = L.surv[0], pa = srv(L, a), q = W.PAPERS[3];
  ok(a.call('paper:pickup', { id: 3 }).err === 'far', 'recoger un papel lejano es rechazado');
  pa.x = q.x + 1; pa.z = q.z; const r = a.call('paper:pickup', { id: 3 }); ok(r.ok && r.count === 1 && L.cs.every(c => (c.last('paper:found') || {}).id === 3 && c.last('paper:found').by === a.me.id), 'recoger un papel: el servidor lo confirma y lo sincroniza a todos');
  const b = L.surv[1], pb = srv(L, b); pb.x = q.x + 1; pb.z = q.z; ok(b.call('paper:pickup', { id: 3 }).err === 'taken', 'dos jugadores no pueden recoger el mismo papel');
  ok(['x', -1, 29, 2.5, null].map(v => a.call('paper:pickup', { id: v }).err).every(x => x === 'id'), 'identificadores de papel inválidos rechazados');
  const m = srv(L, L.mon); m.x = W.PAPERS[5].x; m.z = W.PAPERS[5].z; ok(L.mon.call('paper:pickup', { id: 5 }).err === 'role', 'el monstruo no puede recoger papeles');
  pb.state = 'captured'; ok(b.call('paper:pickup', { id: 5 }).err === 'state', 'un jugador capturado no puede recoger papeles'); }
{ const e = env(); const L = started(e, 6, 6); const ids = L.surv; let n = 0;
  for (const q of W.PAPERS) { const c = ids[n++ % ids.length], p = srv(L, c); p.x = q.x; p.z = q.z; c.call('paper:pickup', { id: q.id }); }
  ok(L.cs.every(c => (c.last('game:end') || {}).winner === 'survivors' && c.last('game:end').found === 29), 'los 29 papeles recogidos: ganan los supervivientes y todos lo ven');
  adv(e.rooms, CFG.BACK_MS + 200); ok(L.room().phase === 'lobby' && L.host.last('room:update').phase === 'lobby', 'tras la partida la sala vuelve a la sala de espera'); ok(L.host.call('room:start').ok, 'revancha: el anfitrión puede iniciar otra partida'); }

// ---------- E. capturas, vidas, fin de partida y embestida ----------
{ const e = env(); const L = started(e, 4, 5); const m = srv(L, L.mon), v = L.surv[0], pv = srv(L, v); m.x = 0; m.z = 6; pv.x = .8; pv.z = 6; adv(e.rooms, 2000);
  ok(!L.cs.some(c => c.got('capture').length), 'no hay capturas mientras el monstruo sigue oculto');
  pv.x = m.x + 8; adv(e.rooms, 120000); pv.x = m.x + .8; pv.z = m.z; pv.lastT = T; adv(e.rooms, 100);
  const cap = L.cs.map(c => c.last('capture')); ok(cap.every(c => c && c.victim === v.me.id && c.monster === L.mon.me.id && c.lives === 2), 'captura sincronizada a todos (víctima, monstruo, vidas)');
  const px = pv.x; T += 50; v.call('p:state', { x: px + .2, z: pv.z, yaw: 0 }); ok(pv.x === px && pv.state === 'captured', 'el capturado queda incapacitado (no se mueve)');
  adv(e.rooms, CFG.CAP_MS + 200); ok(pv.state === 'alive' && L.cs.every(c => (c.last('respawn') || {}).id === v.me.id), 'tras la captura reaparece en el campamento con inmunidad');
  m.x = pv.x + .5; m.z = pv.z; adv(e.rooms, 1000); ok(pv.state === 'alive' && pv.lives === 2, 'inmunidad: no es capturado de inmediato'); adv(e.rooms, CFG.IMMUNE_MS);
  for (let k = 0; k < 2; k++) { m.x = pv.x + .5; m.z = pv.z; adv(e.rooms, 200); ok(pv.state === 'captured', `captura nº${k + 2}`); adv(e.rooms, CFG.CAP_MS + CFG.IMMUNE_MS + 300); }
  ok(pv.state === 'out' && pv.lives === 0 && L.cs.every(c => (c.last('out') || {}).id === v.me.id), 'sin vidas: el jugador queda eliminado');
  L.surv.slice(1).forEach(s => { const ps = srv(L, s); for (let k = 0; k < 3 && L.room().phase === 'hunt'; k++) { m.x = ps.x + .5; m.z = ps.z; ps.immUntil = 0; adv(e.rooms, 200); adv(e.rooms, CFG.CAP_MS + 300); } });
  ok(L.cs.every(c => (c.last('game:end') || {}).winner === 'monster'), 'si todos los supervivientes caen, gana el monstruo'); }
{ const e = env(); const L = started(e, 3, 5); adv(e.rooms, 121000); const m = srv(L, L.mon); m.lungeCd = 0;
  const r1 = L.mon.call('monster:lunge'); const r2 = L.mon.call('monster:lunge'); ok(r1.ok && r2.err === 'cooldown' && L.cs.every(c => c.last('lunge')), 'embestida: sincronizada y con enfriamiento');
  const xa = m.x; m.lastT = T; T += 100; L.mon.call('p:state', { x: xa + 1.4, z: m.z, yaw: 0 }); ok(Math.abs(m.x - (xa + 1.4)) < 1e-6, 'durante la embestida se acepta mayor velocidad (14 m/s)');
  T += 2000; const x0 = m.x; m.lastT = T - 100; L.mon.call('p:state', { x: x0 + 1.4, z: m.z, yaw: 0 }); ok(m.x === x0, 'fuera de la embestida el mismo movimiento se rechaza'); }

// ---------- F. desconexiones y reconexiones ----------
{ const e = env(); const L = started(e, 5, 5); const a = L.surv[0], pa = srv(L, a), q = W.PAPERS[7]; pa.x = q.x; pa.z = q.z; a.call('paper:pickup', { id: 7 });
  const tok = a.me; a.disconnect(); ok(L.cs.filter(c => c !== a).every(c => c.last('room:update').players.find(p => p.id === tok.id).on === false), 'desconexión: los demás ven al jugador como desconectado');
  adv(e.rooms, 10000); const b = e.cl(); ok(b.call('room:reconnect', { code: L.code, id: tok.id, token: 'x'.repeat(32) }).err === 'invalid', 'reconexión con token falso rechazada');
  const r = b.call('room:reconnect', { code: L.code, id: tok.id, token: tok.token }); ok(r.ok && r.game && r.game.role === 'survivor' && r.game.found.includes(7) && r.game.lives === 3 && r.game.phase === 'hidden', 'reconexión: recupera su sitio, papeles de la partida, rol y vidas');
  L.cs[0].clear(); adv(e.rooms, 200); ok(b.last('snap'), 'tras reconectar vuelve a recibir el estado de la partida');
  const c2 = e.cl(); const r2 = c2.call('room:reconnect', { code: L.code, id: tok.id, token: tok.token }); ok(r2.ok && b.last('kicked'), 'una segunda sesión del mismo jugador expulsa a la anterior');
  b.call('p:state', { x: 1, z: 1, yaw: 0 }); ok(Math.hypot(pa.x - 1, pa.z - 1) > .01, 'el socket expulsado ya no puede actuar'); }
{ const e = env(); const L = started(e, 4, 5); const a = L.surv[0]; a.disconnect(); adv(e.rooms, CFG.GRACE_GAME + 1000);
  ok(!L.room().players.has(a.me.id) && L.cs.filter(c => c !== a).every(c => c.last('player:left')), 'tras el tiempo de gracia el jugador desconectado es eliminado de la partida'); }
{ const e = env(); const L = started(e, 4, 5); const old = L.mon; old.disconnect(); adv(e.rooms, CFG.MON_GRACE + 1000);
  const nm = L.surv.find(c => c.last('game:role')); ok(nm && L.room().monster === nm.me.id, 'si el monstruo se desconecta, el servidor elige otro monstruo humano (fase oculta)');
  const e2 = env(); const L2 = started(e2, 4, 5); adv(e2.rooms, 121000); L2.mon.disconnect(); adv(e2.rooms, CFG.MON_GRACE + 1000);
  ok(L2.surv.filter(c => c.s.connected).every(c => (c.last('game:phase') || {}).reassigned === true && c.last('game:phase').monster !== L2.mon.me.id), 'monstruo desconectado en caza: nuevo monstruo anunciado a todos'); }
{ const e = env(); const L = lobby(e, 3, 5); const h = L.host; h.disconnect(); ok(L.room().host !== h.me.id, 'anfitrión desconectado: se reasigna el anfitrión');
  adv(e.rooms, CFG.GRACE_LOBBY + 500); ok(!L.room().players.has(h.me.id), 'en la sala de espera, el desconectado se elimina tras 20 s');
  const e2 = env(); const L2 = lobby(e2, 2, 5); const c = L2.cs[1]; c.disconnect(); const n = e2.cl(); ok(n.call('room:reconnect', { code: L2.code, id: c.me.id, token: c.me.token }).ok, 'reconexión en la sala de espera'); }

// ---------- G. robustez y seguridad ----------
{ const e = env(); const L = started(e, 3, 5); const c = L.surv[0]; let threw = false;
  const evs = ['room:create', 'room:join', 'room:reconnect', 'room:leave', 'p:character', 'room:start', 'p:state', 'paper:pickup', 'monster:transform', 'monster:lunge', 'rooms:list', 'net:ping'];
  const junk = [null, undefined, 'x', 123, [], [1, 2], {}, { x: {}, z: [] }, JSON.parse('{"__proto__":{"admin":1},"id":{"a":1},"code":{"b":2}}'), { id: 'a'.repeat(1e5), code: 'b'.repeat(1e5) }, { x: 1e308, z: -1e308, yaw: 1e308 }];
  try { for (const ev of evs) for (const j of junk) { T += 1000; c.raw(ev, j); } } catch (x) { threw = true; }
  ok(!threw && ({}).admin === undefined, 'cargas malformadas, enormes o con __proto__ no provocan fallos ni contaminación');
  adv(e.rooms, 1000); ok(L.room() && L.room().phase !== undefined, 'el servidor sigue funcionando tras la entrada maliciosa'); }
{ const e = env(); const c = e.cl(); let rate = 0; for (let i = 0; i < 100; i++) { const r = c.call('rooms:list'); if (r && r.err === 'rate') rate++; } ok(rate > 70, `límite de frecuencia por socket (${rate}/100 peticiones bloqueadas)`);
  const L = started(env(), 2, 2); const a = L.surv[0]; const p = srv(L, a); let acc = 0; for (let i = 0; i < 500; i++) { const x0 = p.x; a.call('p:state', { x: x0 + .001, z: p.z, yaw: 0 }); if (p.x !== x0) acc++; } ok(acc < 120, `inundar de estados no desborda al servidor (${acc} aceptados de 500)`); }
{ const e = env(); const A = lobby(e, 2, 5), B = lobby(e, 2, 5); B.cs.forEach(c => c.clear()); A.host.call('room:start'); ok(B.cs.every(c => !c.s.inbox.length), 'las salas están aisladas: lo que ocurre en una no llega a otra'); }
console.log(`\n${pass} pruebas correctas, ${fails} fallos`); process.exit(fails ? 1 : 0);
