'use strict';
// Prueba de INTEGRACIÓN cliente<->servidor: ejecuta el código REAL del cliente (public/index.html) en 3 contextos
// (public/app.js, con THREE/DOM simulados) conectados al código REAL del servidor (src/rooms.js) por un puente en memoria que imita a socket.io.
// Comprueba el flujo de extremo a extremo: crear/unirse/iniciar, roles, sincronización, papeles, transformación, captura, reconexión y fin.
const fs = require('fs'), vm = require('vm'), path = require('path');
const { Rooms, CFG } = require('../src/rooms'); const W = require('../shared/world.js'); const { FakeIO, FakeSocket } = require('./helpers/fake');
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');   // el juego tal como lo sirve el servidor
let T = 1e9, fails = 0, pass = 0; const ok = (c, m) => { if (c) { pass++; console.log('ok  :', m); } else { fails++; console.log('FALLO:', m); } };
const clone = x => JSON.parse(JSON.stringify(x === undefined ? null : x));
const mk = () => new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => 0 : (k === 'length' ? 0 : mk()), apply: () => mk(), construct: () => mk(), set: () => true });
const fio = new FakeIO(), rooms = new Rooms(fio, { now: () => T, log: e => console.log('  [server]', e) });
class Bridge { // socket del cliente (API tipo socket.io) enlazado a un FakeSocket del servidor
  constructor() { this.h = {}; this.attach(); }
  attach() { const s = this.srv = new FakeSocket(fio); s.emit = (e, d) => { if (!s.connected) return; const c = clone(d); (this.h[e] || []).forEach(f => f(c)); }; fio.socks.add(s); rooms.attach(s); }
  on(e, f) { (this.h[e] = this.h[e] || []).push(f); }
  emit(e, d, ack) { if (typeof d === 'function') { ack = d; d = undefined; } const f = this.srv.h[e]; if (f) f(clone(d), ack ? r => ack(clone(r)) : undefined); }
  get volatile() { return this; }
  fire(e, d) { (this.h[e] || []).forEach(f => f(d)); }
  drop() { this.srv.connected = false; fio.socks.delete(this.srv); this.srv.h.disconnect && this.srv.h.disconnect(); this.fire('disconnect'); }
  reconnect() { this.attach(); this.fire('connect'); }
}
function mkClient() {
  const els = {}, store = {}; const el = id => els[id] || (els[id] = { id, hidden: false, textContent: '', value: '', checked: true, style: {}, kids: [], onclick: null, onchange: null, oninput: null, appendChild(c) { this.kids.push(c); }, addEventListener() {}, classList: { toggle() {} }, getContext: () => mk() });
  const L = {}; let perf = 0; const ctx = { THREE: mk(), URLSearchParams, location: { search: '', reload() {} }, sessionStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } },
    document: { getElementById: el, querySelectorAll: () => [], createElement: () => el('_c' + Math.random()), addEventListener() {}, pointerLockElement: null, exitPointerLock() {} }, localStorage: { getItem: () => null, setItem() {} },
    matchMedia: () => ({ matches: false }), addEventListener: (t, f) => { (L[t] = L[t] || []).push(f); }, requestAnimationFrame() {}, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, setTimeout: () => 0, setInterval: () => 0, clearInterval() {},
    performance: { now: () => perf }, console, Math, JSON, Object, Array, Set, Map, Float32Array, Date, Promise };
  ctx.window = ctx; ctx.io = () => (ctx.bridge = new Bridge()); vm.createContext(ctx);
  vm.runInContext(src + '\n;globalThis.__t={$,MP,P,M,PAPERS,K,update,interact,cfg,get state(){return state},get yaw(){return yaw},set yaw(v){yaw=v},get flashOn(){return flashOn},get hemiBase(){return hemiBase},counter,found};', ctx);
  ctx.__t.tick = dt => { perf += dt * 1000; ctx.__t.update(dt); }; ctx.el = el; return ctx;
}
const frames = (cs, n, mv) => { for (let i = 0; i < n; i++) { T += 1000 / 60; if (i % 3 === 0) rooms.tick(); cs.forEach(c => { c.__t.K.KeyW = !!mv; c.__t.tick(1 / 60); }); } };
const srvP = (code, c) => rooms.rooms.get(code).players.get(c.__t.MP.me.id);

(async () => {
  const [A, B, C] = [mkClient(), mkClient(), mkClient()], cs = [A, B, C];
  ok(A.__t.state === 'menu', 'el cliente real carga en el menú');
  A.el('mpb').onclick(); A.bridge.fire('connect'); ok(A.__t.MP.conn, 'el cliente se conecta y muestra el indicador de conexión'); ok(A.el('net').textContent.includes('●'), 'indicador de conexión visible');
  A.el('nick').value = 'Ana'; A.__t.MP.max = 5; A.el('create').onclick(); const code = A.__t.MP.code; ok(/^[A-Z2-9]{5}$/.test(code) && A.__t.state === 'wait' && A.el('wcode').textContent === code, `crear sala: código ${code} y sala de espera`);
  for (const [c, n] of [[B, 'Beto'], [C, 'Cris']]) { c.el('mpb').onclick(); c.bridge.fire('connect'); c.el('nick').value = n; const l = []; c.__t.MP.sock.emit('rooms:list', {}, r => l.push(r)); ok(l[0].rooms.some(r => r.code === code), `${n} encuentra la sala al buscar`); c.el('code').value = code.toLowerCase(); c.el('join').onclick(); }
  ok(cs.every(c => c.__t.MP.room && c.__t.MP.room.players.length === 3 && c.__t.state === 'wait'), 'los 3 clientes ven la lista de 3 participantes en la sala de espera');
  ok(A.el('startbtn').hidden === false && B.el('startbtn').hidden === true, 'solo el anfitrión ve el botón de iniciar');
  A.el('startbtn').onclick(); ok(cs.every(c => c.__t.state === 'play' && c.__t.MP.on), 'al iniciar, los 3 clientes entran en la partida');
  const mon = cs.filter(c => c.__t.MP.role === 'monster'), sur = cs.filter(c => c.__t.MP.role === 'survivor'); ok(mon.length === 1 && sur.length === 2, 'un solo monstruo humano (rol asignado por el servidor)');
  ok(sur.every(c => c.el('role').textContent.includes('SUPERVIVIENTE')) && mon[0].el('role').textContent.includes('MONSTRUO'), 'la interfaz muestra el rol de cada jugador (solo el monstruo conoce el suyo)');
  ok(sur.every(c => c.__t.MP.monId === null), 'los supervivientes no conocen la identidad del monstruo');
  // movimiento sincronizado
  frames(cs, 150, true); const dumps = cs.map(c => ({ x: c.__t.P.x, z: c.__t.P.z }));
  let maxErr = 0, n = 0; cs.forEach((c, i) => cs.forEach((o, j) => { if (i === j) return; const e = [...c.__t.MP.ents.values()].find(q => q.id === o.__t.MP.me.id); if (e) { n++; maxErr = Math.max(maxErr, Math.hypot(e.x - dumps[j].x, e.z - dumps[j].z)); } }));
  ok(n === 6 && maxErr < .6, `cada cliente ve a los otros 2 moviéndose en tiempo real (error máx ${maxErr.toFixed(2)} m con latencia de 50 ms)`);
  ok(cs.every((c, i) => Math.hypot(srvP(code, c).x - dumps[i].x, srvP(code, c).z - dumps[i].z) < .5), 'el servidor tiene la misma posición que cada jugador (sin correcciones)'); ok(!cs.some(c => c.__t.P.x !== c.__t.P.x), 'sin valores NaN');
  // papeles
  const s1 = sur[0], s2 = sur[1], q = W.PAPERS[4], sp = srvP(code, s1); sp.x = q.x; sp.z = q.z; sp.lastT = T; s1.__t.P.x = q.x; s1.__t.P.z = q.z; s1.__t.P.yaw = 0; s1.__t.yaw = Math.atan2(0, 1) + Math.PI; s1.__t.P.vx = s1.__t.P.vz = 0;
  s1.__t.interact(); ok(cs.every(c => W.PAPERS[4].found !== undefined) && cs.every(c => c.__t.PAPERS[4].found === true) && cs.every(c => c.el('cnt').textContent.includes('1/29')), 'recoger un papel actualiza el contador PAPELES ENCONTRADOS 1/29 en todos los clientes');
  s2.__t.P.x = q.x; s2.__t.P.z = q.z; s2.__t.interact(); ok(cs.every(c => c.__t.found() === 1), 'no se puede recoger el mismo papel dos veces');
  mon[0].__t.interact(); ok(cs.every(c => c.__t.found() === 1), 'el monstruo no recoge papeles (E es embestida)');
  // transformación
  rooms.rooms.get(code).transformAt = T; frames(cs, 12, false);
  ok(cs.every(c => c.__t.MP.phase === 'hunt' && c.__t.MP.monId === mon[0].__t.MP.me.id), 'transformación: todos los clientes conocen al monstruo real');
  ok(mon[0].__t.P.sp === 4.7 && mon[0].__t.flashOn === false && mon[0].__t.hemiBase > .5, 'el monstruo jugador cambia de velocidad y visión'); frames(cs, 60, false);
  ok(sur.every(c => c.__t.M.st !== 'gone'), 'los supervivientes ven el modelo del monstruo controlado por un humano');
  // captura
  const pv = srvP(code, s2), pm = srvP(code, mon[0]); pm.x = 0; pm.z = 6; pm.lastT = T; pv.x = .7; pv.z = 6; pv.lastT = T; s2.__t.P.x = .7; s2.__t.P.z = 6; mon[0].__t.P.x = 0; mon[0].__t.P.z = 6; frames(cs, 12, false);
  ok(s2.__t.P.captured === true && s2.__t.MP.lives === 2 && cs.every(c => c.__t.MP.cap && c.__t.MP.cap.victim === s2.__t.MP.me.id), 'captura sincronizada: la víctima queda incapacitada y todos la ven');
  const px = s2.__t.P.x; s2.__t.K.KeyW = true; frames([s2], 30, true); ok(s2.__t.P.x === px && s2.__t.M.capT > .3, 'durante la captura el jugador no puede moverse y corre la secuencia de captura');
  frames(cs, 300, false); ok(s2.__t.P.captured === false && cs.every(c => !c.__t.MP.cap), 'tras la captura la víctima reaparece en el campamento');
  // reconexión
  const b = s1; b.bridge.drop(); ok(b.__t.MP.conn === false && b.el('net').textContent.includes('RECONECTANDO'), 'indicador: reconectando al perder la conexión'); frames([A, B, C].filter(c => c !== b), 30, false);
  ok(rooms.rooms.get(code).players.get(b.__t.MP.me.id).connected === false, 'el servidor marca al jugador como desconectado'); b.bridge.reconnect();
  ok(b.__t.MP.conn === true && b.__t.state === 'play' && b.__t.found() === 1 && rooms.rooms.get(code).players.get(b.__t.MP.me.id).connected, 'reconexión automática: vuelve a su partida con los papeles encontrados'); frames(cs, 30, false); ok([...b.__t.MP.ents.values()].length === 2, 'tras reconectar vuelve a recibir a los demás jugadores');
  // fin de partida
  const r = rooms.rooms.get(code); for (const p of W.PAPERS) if (!r.found.has(p.id)) { const pp = r.players.get(s1.__t.MP.me.id); pp.state = 'alive'; pp.x = p.x; pp.z = p.z; rooms.onPickup(r, pp, { id: p.id }); } frames(cs, 6, false);
  ok(cs.every(c => c.el('end2').hidden === false && c.el('end2s').textContent.includes('29')), 'al completar los 29 papeles, todos ven la pantalla de resultado');
  ok(sur.every(c => c.el('end2t').textContent === '¡VICTORIA!') && mon[0].el('end2t').textContent === 'DERROTA', 'victoria para los supervivientes y derrota para el monstruo');
  for (let i = 0; i < 300; i++) { T += 50; rooms.tick(); } ok(cs.every(c => c.__t.state === 'wait' && !c.__t.MP.on), 'tras la partida todos vuelven a la sala de espera'); const hostC = cs.find(c => c.__t.MP.me.id === c.__t.MP.room.host); hostC.el('startbtn').onclick();
  ok(cs.every(c => c.__t.state === 'play') && cs.filter(c => c.__t.MP.role === 'monster').length === 1 && cs.every(c => c.__t.found() === 0), 'revancha: nueva partida con nuevo monstruo y papeles reiniciados');
  console.log(`\n${pass} pruebas correctas, ${fails} fallos`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERROR', e.stack); process.exit(2); });
