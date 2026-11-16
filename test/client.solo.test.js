'use strict';
// Regresión del modo SOLO (IA del monstruo, 29 papeles, SHIFT, linterna, captura) con el cliente final (public/solo.html), THREE/DOM simulados.
const fs = require('fs'), vm = require('vm'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'solo.html'), 'utf8'); const src = html.slice(html.indexOf('<script>\n') + 9, html.lastIndexOf('</script>'));
const mk = () => new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => 0 : (k === 'length' ? 0 : mk()), apply: () => mk(), construct: () => mk(), set: () => true });
const els = {}, el = id => els[id] || (els[id] = { id, hidden: false, textContent: '', value: '', checked: true, style: {}, onclick: null, appendChild() {}, addEventListener() {}, classList: { toggle() {} }, getContext: () => mk() });
const L = {}, raf = []; const ctx = { THREE: mk(), URLSearchParams, location: { search: '', reload() {} }, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} }, document: { getElementById: el, querySelectorAll: () => [], createElement: () => el('_c'), addEventListener() {}, pointerLockElement: null, exitPointerLock() {} },
  localStorage: { getItem: () => null, setItem() {} }, matchMedia: () => ({ matches: false }), addEventListener: (t, f) => { (L[t] = L[t] || []).push(f); }, requestAnimationFrame: f => raf.push(f), innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, setTimeout: () => 0, setInterval: () => 0, clearInterval() {}, performance: { now: () => 0 }, console, Math, JSON, Object, Array, Set, Map, Float32Array };
ctx.window = ctx; vm.createContext(ctx); let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FALLO:', m); } else console.log('ok  :', m); };
try {
  vm.runInContext(src + '\n;globalThis.__t={get state(){return state},set state(v){state=v},P,K,M,update,interact,found,PAPERS,get run(){return P.run},get flash(){return flashOn},get time(){return time},set time(v){time=v}};', ctx); const t = ctx.__t;
  for (let i = 0; i < 3; i++) raf.splice(0).forEach(f => f(16)); ok(true, '[solo] carga y renderiza el menú sin excepciones');
  el('mpb').onclick(); ok(el('msg').textContent.includes('servidor'), '[solo] MULTIJUGADOR explica la limitación del Artifact en lugar de simular conexiones');
  t.state = 'play'; const key = (c, rep = false) => (L.keydown || []).forEach(f => f({ code: c, repeat: rep }));
  key('ShiftLeft'); ok(t.run === true, '[solo] SHIFT activa correr'); key('ShiftLeft', true); ok(t.run === true, '[solo] SHIFT mantenido no alterna'); key('ShiftLeft'); ok(t.run === false, '[solo] SHIFT vuelve a caminar');
  const f0 = t.flash; key('KeyF'); ok(t.flash === !f0, '[solo] F alterna la linterna');
  const q = t.PAPERS[0]; t.P.x = q.x + .4; t.P.z = q.z; t.P.yaw = Math.atan2(.4, 0) + Math.PI; t.interact(); ok(t.found() === 1, '[solo] E recoge un papel'); t.interact(); ok(t.found() === 1, '[solo] sin doble recogida');
  t.M.st = 'gone'; t.M.cool = 0; t.time = 60; const seen = new Set(); for (let i = 0; i < 60 * 600; i++) { t.K.KeyW = i % 400 < 300; t.update(1 / 60); seen.add(t.M.st); } ok(seen.has('appear'), '[solo] la IA del monstruo sigue funcionando (estados: ' + [...seen].join(', ') + ')');
  vm.runInContext("M.st='gone';M.cool=999;M.x=P.x+9;M.z=P.z;startChase(evf,P)", ctx); let cap = false; for (let i = 0; i < 60 * 30; i++) { t.K.KeyW = false; t.update(1 / 60); if (t.M.st === 'capture') { cap = true; break; } } ok(cap, '[solo] persecución y captura funcionan');
  for (let i = 0; i < 60 * 6; i++) t.update(1 / 60); ok(!t.P.captured, '[solo] tras la captura el jugador despierta');
  t.PAPERS.forEach(p => { p.found = false; }); t.PAPERS.forEach(p => { t.P.x = p.x + .3; t.P.z = p.z; t.P.yaw = Math.atan2(.3, 0) + Math.PI; t.interact(); }); ok(t.found() === 29 && t.state === 'end', '[solo] 29 papeles -> misión completada');
} catch (e) { fails++; console.log('FALLO (excepción):', e.stack.split('\n').slice(0, 5).join('\n')); }
console.log(fails ? `\n${fails} FALLO(S)` : '\nSOLO OK'); process.exit(fails ? 1 : 0);
