'use strict';
// Pruebas de la capa web: rutas, cabeceras de seguridad, HTTPS forzado, gzip, caché, errores y protección de rutas; más guard.js y config.js.
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path'), zlib = require('zlib');
const { createHandler } = require('../src/http'), { originAllowed, clientIp, ConnLimiter } = require('../src/guard'), load = require('../src/config');
let fails = 0, pass = 0; const ok = (c, m) => { if (c) { pass++; console.log('ok  :', m); } else { fails++; console.log('FALLO:', m); } };
const pub = path.join(__dirname, '..', 'public'), vend = fs.mkdtempSync(path.join(os.tmpdir(), 'vend-')); fs.writeFileSync(path.join(vend, 'three.min.js'), '/* three de prueba */'.repeat(200));
function start(opts) { return new Promise(res => { const s = http.createServer(createHandler(Object.assign({ publicDir: pub, vendorDir: vend, health: () => ({ rooms: 0, players: 0 }) }, opts))); s.listen(0, '127.0.0.1', () => res(s)); }); }
const get = (s, p, o = {}) => new Promise((res, rej) => { const r = http.request({ host: '127.0.0.1', port: s.address().port, path: p, method: o.method || 'GET', headers: o.headers || {} }, x => { const ch = []; x.on('data', c => ch.push(c)); x.on('end', () => res({ status: x.statusCode, h: x.headers, body: Buffer.concat(ch) })); }); r.on('error', rej); r.end(); });

(async () => {
  const s = await start({ forceHttps: false, version: '9.9.9' });
  let r = await get(s, '/'); ok(r.status === 200 && /text\/html/.test(r.h['content-type']) && r.body.toString().includes('LA ÚLTIMA SEÑAL') && r.h['cache-control'] === 'no-cache', 'GET / sirve la página (index.html) sin caché');
  ok(/default-src 'self'/.test(r.h['content-security-policy']) && /frame-ancestors 'none'/.test(r.h['content-security-policy']) && r.h['x-content-type-options'] === 'nosniff' && r.h['referrer-policy'] === 'no-referrer' && r.h['x-frame-options'] === 'DENY', 'cabeceras de seguridad (CSP, nosniff, referrer, frame)');
  ok(!r.h['strict-transport-security'], 'sin HSTS en HTTP plano');
  const ver = (r.body.toString().match(/boot\.js\?v=([a-f0-9]+)/) || [])[1]; ok(!!ver, 'index.html carga boot.js con versión (' + ver + ')');
  r = await get(s, '/boot.js?v=' + ver); ok(r.status === 200 && /javascript/.test(r.h['content-type']) && /immutable/.test(r.h['cache-control']), 'boot.js con versión: caché larga e inmutable');
  const appFile = fs.readFileSync(path.join(pub, 'app.js')); r = await get(s, '/app.js?v=' + ver, { headers: { 'accept-encoding': 'gzip' } });
  ok(r.status === 200 && r.h['content-encoding'] === 'gzip' && zlib.gunzipSync(r.body).equals(appFile) && r.body.length < appFile.length / 2, `app.js comprimido con gzip (${appFile.length} -> ${r.body.length} bytes) y íntegro`);
  r = await get(s, '/app.js'); ok(r.status === 200 && !r.h['content-encoding'] && r.body.equals(appFile), 'sin Accept-Encoding se sirve sin comprimir');
  const et = r.h.etag; r = await get(s, '/app.js', { headers: { 'if-none-match': et } }); ok(r.status === 304 && r.body.length === 0, 'ETag: 304 si no ha cambiado');
  r = await get(s, '/', { method: 'HEAD' }); ok(r.status === 200 && r.body.length === 0 && r.h['content-length'] > 0, 'HEAD devuelve cabeceras sin cuerpo');
  r = await get(s, '/health'); const j = JSON.parse(r.body); ok(r.status === 200 && j.ok === true && j.rooms === 0, '/health responde JSON (para el healthcheck del hosting)');
  r = await get(s, '/version'); ok(JSON.parse(r.body).version === '9.9.9', '/version');
  r = await get(s, '/favicon.svg'); ok(r.status === 200 && r.h['content-type'] === 'image/svg+xml', 'favicon.svg'); r = await get(s, '/robots.txt'); ok(r.status === 200, 'robots.txt'); r = await get(s, '/solo.html'); ok(r.status === 200, 'solo.html disponible');
  r = await get(s, '/vendor/three.min.js'); ok(r.status === 200 && /javascript/.test(r.h['content-type']), 'motor three.js servido desde el propio servidor (/vendor/three.min.js)');
  const s2 = await start({ vendorDir: path.join(os.tmpdir(), 'no-existe-xyz') }); r = await get(s2, '/vendor/three.min.js'); ok(r.status === 404, 'si falta three.js responde 404 (el cargador usa el respaldo del CDN)'); s2.close();
  r = await get(s, '/no-existe', { headers: { accept: 'text/html' } }); ok(r.status === 404 && /text\/html/.test(r.h['content-type']) && r.body.toString().includes('404'), '404 con página amigable');
  r = await get(s, '/no-existe.js'); ok(r.status === 404 && /text\/plain/.test(r.h['content-type']), '404 en texto para recursos');
  r = await get(s, '/', { method: 'POST' }); ok(r.status === 405 && r.h.allow === 'GET, HEAD', '405 para métodos no permitidos');
  r = await get(s, '/%E0%A4%A'); ok(r.status === 400, '400 para URL mal codificada');
  const bad = ['/../package.json', '/%2e%2e/package.json', '/..%2fpackage.json', '/%2e%2e%2f%2e%2e%2fetc/passwd', '/.env', '/.git/config', '/src/rooms.js', '/shared/world.js', '/node_modules/three/package.json', '/index.html/../../package.json', '/%00', '/....//....//etc/passwd'];
  const res = await Promise.all(bad.map(p => get(s, p))); ok(res.every(x => x.status === 404 || x.status === 400) && res.every(x => !x.body.toString().includes('"name": "la-ultima-senal-server"') && !x.body.toString().includes('class Rooms')), `rutas peligrosas bloqueadas (${bad.length} intentos de salirse de /public)`);
  const sb = await start({ health: () => { throw new Error('fallo simulado'); } }); const log = console.error; console.error = () => {}; r = await get(sb, '/health'); console.error = log; ok(r.status === 500 && !/fallo simulado|at /.test(r.body.toString()), 'errores internos -> 500 sin filtrar detalles'); sb.close();
  s.close();
  // HTTPS forzado detrás de un proxy (Render/Railway envían X-Forwarded-Proto)
  const f = await start({ forceHttps: true });
  r = await get(f, '/jugar?x=1', { headers: { host: 'mi-juego.onrender.com' } }); ok(r.status === 301 && r.h.location === 'https://mi-juego.onrender.com/jugar?x=1', 'HTTP -> redirección 301 a HTTPS conservando ruta y parámetros');
  r = await get(f, '/', { headers: { host: 'mi-juego.onrender.com', 'x-forwarded-proto': 'https' } }); ok(r.status === 200 && /max-age=31536000/.test(r.h['strict-transport-security']), 'detrás del proxy HTTPS: se sirve la página con HSTS');
  r = await get(f, '/', { headers: { host: 'x.com', 'x-forwarded-proto': 'https,http' } }); ok(r.status === 200, 'X-Forwarded-Proto con varios valores: se usa el primero');
  r = await get(f, '/health'); ok(r.status === 200, '/health no se redirige (los healthchecks internos usan HTTP)'); f.close();
  const nt = await start({ forceHttps: true, trustProxy: false }); r = await get(nt, '/', { headers: { host: 'x.com', 'x-forwarded-proto': 'https' } }); ok(r.status === 301, 'con TRUST_PROXY=0 se ignora X-Forwarded-Proto'); nt.close();
  // guard.js
  ok(originAllowed('https://juego.com', 'juego.com') && !originAllowed('https://malo.com', 'juego.com') && originAllowed(undefined, 'juego.com') && !originAllowed('no-es-url', 'juego.com') && originAllowed('https://otro.com', 'juego.com', ['otro.com']) && originAllowed('https://x.com', 'juego.com', ['*']), 'WebSocket: solo orígenes de la misma dirección o autorizados');
  ok(clientIp({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }, '10.0.0.1', true) === '1.2.3.4' && clientIp({ 'x-forwarded-for': '1.2.3.4' }, '10.0.0.1', false) === '10.0.0.1', 'IP real del cliente detrás del proxy');
  const L = new ConnLimiter(3); ok(L.take('a') && L.take('a') && L.take('a') && !L.take('a') && L.take('b'), 'límite de conexiones por IP'); L.release('a'); ok(L.take('a'), 'al liberar, se permite otra conexión');
  const c = load({ PORT: '8080', NODE_ENV: 'production', FORCE_HTTPS: '1', ALLOWED_ORIGINS: 'a.com, b.com ' }); const d = load({}); ok(c.port === 8080 && c.prod && c.forceHttps && c.allowedOrigins.length === 2 && d.port === 3000 && !d.forceHttps && d.trustProxy, 'configuración por variables de entorno (con valores por defecto seguros)');
  console.log(`\n${pass} pruebas correctas, ${fails} fallos`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
