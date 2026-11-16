// ===== MULTIJUGADOR (cliente): Socket.IO, lobby, avatares remotos y sincronización =====
// El servidor es la autoridad (papeles, capturas, fases, roles). Aquí solo se envía el estado propio y se pinta el de los demás.
let hemiBase = .32;
const MP = { on: false, sock: null, me: null, code: '', room: null, role: null, phase: 'lobby', monId: null, ents: new Map(), lives: 3, out: false, conn: false, ping: 0, capT: 0, cap: null, lungeT: 0, sendT: 0, max: 5, pub: true, tried: false, pingT: 0, endShown: false };
const mpMonster = () => MP.on && MP.role === 'monster';
const SS = { get() { try { return JSON.parse(sessionStorage.getItem('lus_sess') || 'null'); } catch (e) { return null; } }, set(v) { try { v ? sessionStorage.setItem('lus_sess', JSON.stringify(v)) : sessionStorage.removeItem('lus_sess'); } catch (e) {} } };
const mpMsg = t => { $('mpmsg').textContent = t; };
const ERR = { full: 'La sala está llena.', notfound: 'No existe esa sala.', started: 'La partida ya comenzó.', nick: 'Elige un apodo de 2 a 14 caracteres.', max: 'Tamaño de sala inválido.', rate: 'Demasiadas acciones seguidas, espera un momento.', busy: 'El servidor está lleno, inténtalo más tarde.', limit: 'Has creado demasiadas salas.', already: 'Ya estás en una sala.', host: 'Solo el anfitrión puede hacerlo.', min: 'Se necesitan al menos 2 jugadores conectados.', invalid: 'Sesión no válida.', timeout: 'El servidor no responde.', internal: 'Error del servidor.' };
const errT = r => ERR[r && r.err] || ('Error: ' + (r && r.err || 'desconocido'));
const CHD = [{ n: 'Valeria', sk: 0xe3b99b, hr: 0x2b1810, hs: 'long', tp: 0x7a2e3c, pn: 0x1b2230, f: 1 }, { n: 'Mateo', sk: 0xc58f6b, hr: 0x14100d, hs: 'short', tp: 0x2f4a3b, pn: 0x23262c }, { n: 'Camila', sk: 0xf0cdb5, hr: 0x7a4a2a, hs: 'bun', tp: 0x2a3f66, pn: 0x15171c, f: 1 }, { n: 'Diego', sk: 0x8d5a3c, hr: 0x0d0b0a, hs: 'cap', tp: 0x3a3a3f, pn: 0x2a3140 }, { n: 'Lucía', sk: 0xd9a88a, hr: 0x0f0a08, hs: 'curly', tp: 0xb89b5e, pn: 0x1d1d22, f: 1 }, { n: 'Andrés', sk: 0xb9876a, hr: 0x3b2a1c, hs: 'buzz', tp: 0x5a2a2a, pn: 0x2b2f3a }];

// ---------- Avatar de superviviente (los demás jugadores lo ven así) ----------
function avatar(d) {
  const g = new THREE.Group(), m = new THREE.Group(); g.add(m);
  const Mt = c => new THREE.MeshStandardMaterial({ color: c, roughness: .85 }), sk = new THREE.MeshStandardMaterial({ color: d.sk, roughness: .6 }), tp = Mt(d.tp), pn = Mt(d.pn), hr = Mt(d.hr), dk = Mt(0x0a0a0a), f = d.f ? 1 : 0;
  const cy = (a, b, h, mt, x, y, z, p, s) => { const o = new THREE.Mesh(Cy(a, b, h, 8), mt); o.position.set(x, y, z); if (s) o.scale.set(s[0], 1, s[1]); p.add(o); return o; };
  const sp = (r, mt, x, y, z, s, p) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mt); o.position.set(x, y, z); if (s) o.scale.set(s[0], s[1], s[2]); p.add(o); return o; };
  cy(.17, .15, .2, pn, 0, .9, 0, m, [f ? 1.15 : 1, .75]); cy(.2, .165, .58, tp, 0, 1.2, 0, m, [f ? .95 : 1.12, .68]); sp(.2, tp, 0, 1.47, 0, [f ? 1 : 1.15, .45, .7], m); cy(.055, .06, .1, sk, 0, 1.58, 0, m);
  sp(.115, sk, 0, 1.69, 0, [.9, 1.12, 1], m); sp(.014, dk, -.04, 1.7, .102, null, m); sp(.014, dk, .04, 1.7, .102, null, m); sp(.016, sk, 0, 1.675, .115, [1, 1.2, 1.4], m);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(.124, 10, 8, 0, Math.PI * 2, 0, Math.PI * .6), d.hs === 'cap' ? tp : hr); cap.position.set(0, 1.7, -.012); cap.scale.set(.95, 1.12, 1.05); m.add(cap);
  if (d.hs === 'long') cy(.1, .12, .42, hr, 0, 1.5, -.07, m, [1, .6]); if (d.hs === 'bun') sp(.05, hr, 0, 1.82, -.06, null, m);
  const bag = new THREE.Mesh(new THREE.BoxGeometry(.32, .42, .15), Mt(0x2a2a28)); bag.position.set(0, 1.25, -.22); m.add(bag);
  const limb = (x, y, r1, r2, l1, r3, r4, l2, mt) => { const q = new THREE.Group(); q.position.set(x, y, 0); m.add(q); cy(r1, r2, l1, mt, 0, -l1 / 2, 0, q); const k = new THREE.Group(); k.position.y = -l1; q.add(k); sp(r2 * 1.1, mt, 0, 0, 0, null, k); cy(r3, r4, l2, mt, 0, -l2 / 2, 0, k); q.k = k; return q; };
  const legL = limb(-.095, .88, .085, .065, .43, .062, .048, .42, pn), legR = limb(.095, .88, .085, .065, .43, .062, .048, .42, pn), armL = limb(-.26, 1.46, .052, .045, .28, .043, .036, .26, tp), armR = limb(.26, 1.46, .052, .045, .28, .043, .036, .26, tp);
  [armL, armR].forEach(q => sp(.045, sk, 0, -.27, 0, null, q.k)); armR.k.rotation.x = -.25;
  cy(.03, .034, .2, Mt(0x1a1a1a), 0, -.3, 0, armR.k); const lens = sp(.03, new THREE.MeshBasicMaterial({ color: 0x222222 }), 0, -.405, 0, [1, .4, 1], armR.k);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(.5, 2.4, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd49a, transparent: true, opacity: .07, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); cone.position.set(0, -1.6, 0); armR.k.add(cone); cone.visible = false;
  return { g, m, legL, legR, armL, armR, lens, cone, ph: 0 };
}
function animAv(a, mv, dt) { const mo = mv > .3; if (mo) a.ph += mv * dt * 2.4; const sw = mo ? Math.sin(a.ph) * .8 : 0; a.legL.rotation.x = sw; a.legR.rotation.x = -sw; a.legL.k.rotation.x = mo ? Math.max(0, -Math.cos(a.ph)) * .9 : 0; a.legR.k.rotation.x = mo ? Math.max(0, Math.cos(a.ph)) * .9 : 0; a.armL.rotation.x = -sw * .7; a.armR.rotation.x = -1.2; a.m.position.y = mo ? Math.abs(Math.sin(a.ph)) * .04 : 0; }
function entOf(id) {
  let e = MP.ents.get(id); if (e) return e;
  const pl = MP.room && MP.room.players.find(p => p.id === id), a = avatar(CHD[(pl ? pl.c : 0) % CHD.length]); a.g.visible = false; scene.add(a.g);
  e = { id, a, x: 0, z: 0, yaw: 0, tx: 0, tz: 0, tyaw: 0, v: 0, fl: 0, st: 0, init: false, seen: 0, stT: 0 }; MP.ents.set(id, e); return e;
}

// ---------- Pantallas ----------
function showOnly(n) { for (const id of ['menu', 'mp', 'wait', 'cfg', 'pause', 'done', 'end2']) $(id).hidden = id !== n; state = n === 'wait' ? 'wait' : 'menu'; }
function showWait() { showOnly('wait'); renderWait(); }
function renderWait() {
  const r = MP.room; if (!r) return; $('wcode').textContent = r.code; $('wname').textContent = r.name + ' · máx. ' + r.max;
  const pl = $('plist'); pl.textContent = ''; r.players.forEach(p => { const d = document.createElement('div'); d.textContent = `${p.name} · ${CHD[p.c % CHD.length].n}${p.id === r.host ? ' · ANFITRIÓN' : ''}${p.id === (MP.me && MP.me.id) ? ' · (tú)' : ''}${p.on ? '' : ' · desconectado'}`; pl.appendChild(d); });
  $('pcount').textContent = `${r.players.length}/${r.max} jugadores`; $('startbtn').hidden = !(MP.me && r.host === MP.me.id);
}
function hudMP() {
  if (!MP.sock) { $('net').textContent = ''; $('role').textContent = ''; return; }
  $('net').textContent = (MP.conn ? '● ' + MP.ping + ' ms' : '○ RECONECTANDO…'); $('net').style.color = MP.conn ? '#7fbf7f' : '#d88';
  let t = ''; if (MP.on) { if (MP.out) t = 'ELIMINADO · observas la partida'; else if (MP.role === 'monster') t = MP.phase === 'hunt' ? 'ERES EL MONSTRUO · [E] embestida' : 'ERES EL MONSTRUO (oculto) · [T] transformarte'; else t = 'SUPERVIVIENTE · vidas ' + '♥'.repeat(Math.max(0, MP.lives)); }
  $('role').textContent = t;
}
function banner(t, s = 5) { sub(t, s); }
function applyRole() {
  if (MP.role === 'monster' && MP.phase === 'hunt') { P.sp = 4.7; flashOn = false; hemiBase = .8; } else { P.sp = undefined; hemiBase = .32; }
  $('bT').style.display = mpMonster() ? 'flex' : 'none'; hudMP();
}

// ---------- Conexión ----------
function mpConnect() {
  if (MP.sock) return true; if (typeof io === 'undefined') return false;
  const url = new URLSearchParams(location.search).get('server'), opt = { reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 500, reconnectionDelayMax: 4000, timeout: 10000 };
  const s = MP.sock = url ? io(url, opt) : io(opt);
  s.on('connect', () => {
    MP.conn = true; hudMP(); const ss = SS.get();
    if (ss && (MP.room || !MP.tried)) { MP.tried = true; s.emit('room:reconnect', ss, r => { if (r && r.ok) restore(r); else { SS.set(null); if (MP.room) mpBack('La sala ya no existe o tu sesión caducó.'); } }); }
  });
  s.on('disconnect', () => { MP.conn = false; hudMP(); });
  s.on('connect_error', () => { MP.conn = false; hudMP(); mpMsg('No se puede conectar con el servidor…'); });
  s.on('room:update', d => { MP.room = d; if (MP.on && d.phase === 'lobby') { stopMP(); showWait(); } else if (!MP.on && MP.room) renderWait(); hudMP(); });
  s.on('game:start', d => startMP(d));
  s.on('game:role', d => { MP.role = d.role; applyRole(); banner('Ahora eres el monstruo. Mézclate con los demás.', 7); });
  s.on('game:phase', d => { if (!MP.on) return; MP.phase = d.phase; MP.monId = d.monster; if (d.monster === (MP.me && MP.me.id)) MP.role = 'monster'; else if (MP.role === 'monster') MP.role = 'survivor'; applyRole(); stinger(mpos(), 1);
    banner(mpMonster() ? '¡TE HAS TRANSFORMADO! Caza a los supervivientes.' : (d.reassigned ? 'Un nuevo monstruo ha tomado el control…' : '¡EL MONSTRUO SE HA REVELADO! Uno de vosotros era la criatura. ¡CORRED!'), 7); });
  s.on('snap', d => { const now = performance.now(); for (const a of d.p) { if (MP.me && a[0] === MP.me.id) continue; const e = entOf(a[0]); e.tx = a[1]; e.tz = a[2]; e.tyaw = a[3]; e.v = a[4]; e.fl = a[5]; e.st = a[6]; e.seen = now; if (!e.init) { e.x = e.tx; e.z = e.tz; e.yaw = e.tyaw; e.init = true; } } });
  s.on('paper:found', d => { const q = PAPERS[d.id]; if (q && collect(q)) { q.m.visible = false; q.s.visible = false; counter(); burst(.25, 'highpass', 3500, .25); tone(520, 780, .3, 'sine', .08); banner(d.by === (MP.me && MP.me.id) ? `Papel recogido (${d.count}/${NPAPERS}).` : `Un compañero encontró un papel (${d.count}/${NPAPERS}).`, 3); } });
  s.on('capture', d => { MP.cap = { victim: d.victim, t: 0 }; if (MP.me && d.victim === MP.me.id) { P.captured = true; MP.capT = 0; M.capT = 0; MP.lives = d.lives; scream(); hudMP(); } else { stinger(mpos(), .9); if (d.monster === (MP.me && MP.me.id)) banner('¡Has capturado a un superviviente!', 3); } });
  s.on('respawn', d => { if (MP.cap && MP.cap.victim === d.id) MP.cap = null; if (MP.me && d.id === MP.me.id) { P.captured = false; P.x = d.x; P.z = d.z; P.vx = P.vz = 0; sub('Despiertas en el campamento… tienes unos segundos de inmunidad.', 5); hudMP(); } });
  s.on('out', d => { if (MP.cap && MP.cap.victim === d.id) MP.cap = null; if (MP.me && d.id === MP.me.id) { MP.out = true; P.captured = false; sub('Has sido eliminado. Puedes observar la partida.', 6); hudMP(); } });
  s.on('lunge', d => { if (MP.me && d.id === MP.me.id) { MP.lungeT = .55; P.sp = 9.2; } const e = MP.ents.get(d.id); burst(.5, 'bandpass', 500, .5, e ? V3(e.x, 1.5, e.z) : null); });
  s.on('correct', d => { P.x = d.x; P.z = d.z; P.vx = P.vz = 0; });
  s.on('player:left', d => { const e = MP.ents.get(d.id); if (e) { scene.remove(e.a.g); MP.ents.delete(d.id); } if (MP.on) sub('Un jugador abandonó la partida.', 3); });
  s.on('kicked', d => { SS.set(null); MP.room = null; stopMP(); mpBack('Sesión cerrada: ' + (d && d.reason || 'otra pestaña')); });
  s.on('game:end', d => showEnd(d));
  s.on('server:msg', d => { if (d && d.type === 'restart') { if (MP.on) sub('El servidor se está reiniciando. Se intentará reconectar…', 8); else mpMsg('El servidor se está reiniciando…'); } });
  MP.pingT = setInterval(() => { if (MP.conn) { const t = performance.now(); s.emit('net:ping', {}, () => { MP.ping = Math.round(performance.now() - t); hudMP(); }); } }, 2000);
  return true;
}
function restore(r) {
  MP.me = r.you; MP.code = r.code; MP.room = r.room; SS.set({ code: r.code, id: r.you.id, token: r.you.token });
  if (r.game && r.game.phase) { if (!MP.on) startMP({ role: r.game.role, spawn: { x: r.game.x, z: r.game.z }, lives: r.game.lives, found: r.game.found, phase: r.game.phase, monster: r.game.monster, state: r.game.state, yaw: r.game.yaw }); else { P.x = r.game.x; P.z = r.game.z; P.vx = P.vz = 0; } }
  else { if (MP.on) stopMP(); showWait(); }
}
function mpBack(msg) { showOnly('mp'); mpMsg(msg || ''); }
function mpQuit() { try { if (MP.sock && MP.room) MP.sock.emit('room:leave', {}); } catch (e) {} SS.set(null); setTimeout(() => location.reload(), 150); }

// ---------- Partida ----------
function startMP(info) {
  initAudio(); MP.on = true; flashOn = true; MP.role = info.role; MP.phase = info.phase || 'hidden'; MP.monId = info.monster || null; MP.lives = info.lives; MP.out = info.state === 'out'; MP.endShown = false;
  PAPERS.forEach(q => { q.found = false; q.m.visible = true; q.s.visible = true; }); (info.found || []).forEach(id => { const q = PAPERS[id]; if (q) { q.found = true; q.m.visible = false; q.s.visible = false; } });
  P.x = info.spawn.x; P.z = info.spawn.z; P.vx = P.vz = 0; P.captured = false; P.run = false; yaw = info.yaw !== undefined ? info.yaw : Math.PI; pitch = 0; MP.cap = null; MP.capT = 0; M.st = 'gone'; M.capT = 0;
  MP.ents.forEach(e => { scene.remove(e.a.g); }); MP.ents.clear();
  state = 'play'; for (const id of ['menu', 'mp', 'wait', 'cfg', 'pause', 'done', 'end2']) $(id).hidden = true; $('hud').hidden = false;
  applyRole(); counter(); hudRun();
  banner(info.role === 'monster' ? 'ERES EL MONSTRUO. Mézclate con los demás; el servidor te transformará en unos instantes (o pulsa T pasados 45 s).' : 'Encuentra los 29 papeles. Uno de vosotros no es lo que parece…', 9);
  if (!touch) { try { renderer.domElement.requestPointerLock(); } catch (e) {} }
}
function stopMP() {
  MP.on = false; MP.role = null; MP.phase = 'lobby'; MP.monId = null; MP.ents.forEach(e => scene.remove(e.a.g)); MP.ents.clear(); M.st = 'gone'; P.captured = false; P.sp = undefined; hemiBase = .32; flashOn = true; MP.out = false;
  $('hud').hidden = true; $('bT').style.display = 'none'; try { document.exitPointerLock && document.exitPointerLock(); } catch (e) {} for (const id of ['done', 'end2']) $(id).hidden = true; $('cap').style.opacity = 0; $('capt').style.opacity = 0; $('blk').style.opacity = 0;
}
function showEnd(d) {
  if (!MP.on) return; MP.endShown = true; state = 'end'; P.captured = false; const w = d.winner === 'survivors';
  const imMon = MP.role === 'monster'; $('end2t').textContent = (w ? !imMon : imMon) ? '¡VICTORIA!' : 'DERROTA';
  $('end2s').textContent = (w ? `Los supervivientes reunieron los ${d.found} papeles.` : 'El monstruo atrapó a todos los supervivientes.') + ` El monstruo era ${d.monsterName}.`;
  const l = $('end2l'); l.textContent = ''; d.players.forEach(p => { const x = document.createElement('div'); x.textContent = `${p.name}${p.id === d.monster ? ' (monstruo)' : ''} · capturas: ${p.captures}`; l.appendChild(x); }); $('end2').hidden = false; try { document.exitPointerLock && document.exitPointerLock(); } catch (e) {}
}
function mpInteract() {
  if (MP.role === 'monster') { if (MP.phase === 'hunt' && MP.lungeT <= 0) MP.sock.emit('monster:lunge', {}, r => { if (r && !r.ok && r.err === 'cooldown') sub('Embestida en enfriamiento…', 1); }); return; }
  if (MP.out) return; const q = pickPaper(P); if (q) MP.sock.emit('paper:pickup', { id: q.id }, r => { if (r && !r.ok && r.err === 'taken') sub('Otro jugador ya lo recogió.', 2); });
}
function mpTransform() { if (mpMonster() && MP.phase === 'hidden') MP.sock.emit('monster:transform', {}, r => { if (r && !r.ok && r.err === 'early') sub('Aún es pronto para transformarte…', 3); }); }

// ---------- Por fotograma en partida multijugador ----------
function mpFrame(dt) {
  const now = performance.now();
  for (const [id, e] of MP.ents) {
    const k = Math.min(1, dt * 12); e.x += (e.tx - e.x) * k; e.z += (e.tz - e.z) * k; let da = e.tyaw - e.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); e.yaw += da * k;
    const isMon = MP.phase === 'hunt' && id === MP.monId, vis = e.init && now - e.seen < 2500 && e.st !== 2; e.a.g.visible = vis && !isMon && e.st !== 1;
    e.a.g.position.set(e.x, H(e.x, e.z), e.z); e.a.m.rotation.y = e.yaw + Math.PI; animAv(e.a, e.v, dt); e.a.lens.material.color.setHex(e.fl ? 0xffffff : 0x222222); e.a.cone.visible = !!e.fl;
    if (vis && e.v > .5) { e.stT -= dt; if (e.stT <= 0) { e.stT = e.v > 3.5 ? .34 : .55; burst(.12, 'bandpass', 1100, .2, V3(e.x, .2, e.z), .8); } }
  }
  // criatura visible (modelo del monstruo) para todos menos para el propio monstruo
  const me = MP.ents.get(MP.monId);
  if (MP.role === 'monster' || MP.phase !== 'hunt' || !me || !me.init || now - me.seen > 2500) M.st = 'gone';
  else { M.x = me.x; M.z = me.z; M.rot = me.yaw + Math.PI; M.mv = me.v; M.st = MP.cap ? 'capture' : (me.v > 3.4 ? 'chase' : 'stalk'); }
  if (P.captured) { MP.capT += dt; M.capT = MP.capT; if (me) { M.x = me.x; M.z = me.z; } }
  if (MP.lungeT > 0) { MP.lungeT -= dt; if (MP.lungeT <= 0 && MP.role === 'monster') P.sp = 4.7; }
  MP.sendT -= dt; if (MP.sendT <= 0 && MP.sock && MP.conn && !MP.out && !P.captured) { MP.sendT = .05; MP.sock.volatile.emit('p:state', { x: +P.x.toFixed(2), z: +P.z.toFixed(2), yaw: +yaw.toFixed(2), pt: +pitch.toFixed(2), fl: flashOn ? 1 : 0, run: P.run ? 1 : 0 }); }
}

// ---------- Interfaz del lobby ----------
function buildChars() { const el = $('chars'); el.textContent = ''; CHD.forEach((d, i) => { const b = document.createElement('button'); b.className = 'chip' + (i === cfg.ch ? ' on' : ''); b.textContent = d.n; b.onclick = () => { cfg.ch = i; saveCfg(); buildChars(); if (MP.sock && MP.room && MP.me && MP.room.phase === 'lobby') MP.sock.emit('p:character', { c: i }); }; el.appendChild(b); }); }
function refreshRooms() {
  if (!MP.sock || !MP.conn) return; MP.sock.emit('rooms:list', {}, r => { const el = $('rooms'); el.textContent = ''; if (!r || !r.ok || !r.rooms.length) { el.textContent = 'No hay salas públicas ahora mismo.'; return; }
    r.rooms.forEach(x => { const b = document.createElement('button'); b.className = 'b sm'; b.textContent = `${x.name} · ${x.code} · ${x.n}/${x.max}`; b.onclick = () => joinRoom(x.code); el.appendChild(b); }); });
}
function nick() { const v = ($('nick').value || '').trim(); cfg.nick = v; saveCfg(); return v; }
function joinRoom(code) { if (!MP.conn) return mpMsg('Sin conexión con el servidor.'); mpMsg('Entrando…'); MP.sock.emit('room:join', { code, nick: nick(), c: cfg.ch }, r => { if (!r || !r.ok) return mpMsg(errT(r)); restore(r); showWait(); }); }
$('mpb').onclick = () => {
  if (!mpConnect()) { $('msg').textContent = BUILD_TARGET === 'server' ? 'No se pudo cargar el cliente de red (Socket.IO). Recarga la página; si persiste, el servidor puede estar reiniciándose.' : 'Multijugador: este modo solo funciona abriendo el juego desde su dirección web pública (servidor propio). Un Artifact no puede conectarse a servidores externos.'; return; }
  goFull();
  $('nick').value = cfg.nick || ''; buildChars(); showOnly('mp'); mpMsg(MP.conn ? '' : 'Conectando con el servidor…'); refreshRooms();
};
document.querySelectorAll('.mx').forEach(b => b.onclick = () => { MP.max = +b.dataset.v; document.querySelectorAll('.mx').forEach(x => x.classList.toggle('on', x === b)); });
$('pubc').onchange = () => { MP.pub = $('pubc').checked; };
$('create').onclick = () => { goFull(); if (!MP.conn) return mpMsg('Sin conexión con el servidor.'); mpMsg('Creando sala…'); MP.sock.emit('room:create', { nick: nick(), max: MP.max, c: cfg.ch, pub: MP.pub }, r => { if (!r || !r.ok) return mpMsg(errT(r)); restore(r); showWait(); }); };
$('join').onclick = () => { const c = ($('code').value || '').trim(); if (c) joinRoom(c); };
$('refresh').onclick = refreshRooms; $('mpback').onclick = () => showOnly('menu');
$('startbtn').onclick = () => { MP.sock.emit('room:start', {}, r => { if (!r || !r.ok) $('wmsg').textContent = errT(r); }); };
$('leave').onclick = () => { MP.sock.emit('room:leave', {}); SS.set(null); MP.room = null; MP.me = null; mpMsg(''); showOnly('mp'); refreshRooms(); };
$('again2').onclick = () => { $('end2').hidden = true; };
$('bT').addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); mpTransform(); }, { passive: false });
setInterval(() => { if (state === 'menu' && !$('mp').hidden) refreshRooms(); }, 4000);
