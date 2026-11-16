'use strict';
/**
 * Verifica un despliegue PÚBLICO ya publicado:   node scripts/check-deploy.js https://tu-juego.onrender.com
 * (Node >= 18; para la comprobación de WebSocket seguro, Node >= 22). No necesita dependencias.
 */
const base = String(process.argv[2] || process.env.URL || '').replace(/\/+$/, '');
if (!/^https?:\/\//.test(base)) { console.log('Uso: node scripts/check-deploy.js https://tu-juego.onrender.com'); process.exit(2); }
let fails = 0, warns = 0; const ok = (c, m) => { if (c) console.log('ok  :', m); else { fails++; console.log('FALLO:', m); } }, warn = (c, m) => { if (c) console.log('ok  :', m); else { warns++; console.log('AVISO:', m); } };
const t = (p, o) => fetch(base + p, Object.assign({ redirect: 'manual', signal: AbortSignal.timeout(60000) }, o));
(async () => {
  const u = new URL(base); console.log(`Comprobando ${base} (si el plan gratuito estaba dormido, la primera respuesta puede tardar ~1 min)…`);
  ok(u.protocol === 'https:', 'la dirección pública usa HTTPS' + (u.hostname === 'localhost' || u.hostname === '127.0.0.1' ? ' (¡esto es localhost, no una dirección pública!)' : ''));
  let r = await t('/health'); const j = await r.json().catch(() => ({})); ok(r.status === 200 && j.ok === true, `/health responde (${JSON.stringify(j)})`);
  r = await t('/'); const html = await r.text(); ok(r.status === 200 && html.includes('LA ÚLTIMA SEÑAL'), 'la página principal carga');
  warn(/max-age=\d+/.test(r.headers.get('strict-transport-security') || ''), 'HSTS activo (el hosting envía X-Forwarded-Proto y FORCE_HTTPS=1)');
  ok(/default-src 'self'/.test(r.headers.get('content-security-policy') || ''), 'cabeceras de seguridad presentes');
  const v = (html.match(/boot\.js\?v=([a-f0-9]+)/) || [])[1]; for (const p of ['/boot.js?v=' + v, '/app.js?v=' + v]) { r = await t(p); ok(r.status === 200, `${p.split('?')[0]} carga`); }
  r = await t('/vendor/three.min.js'); warn(r.status === 200, 'motor three.js servido localmente (si no, se usa el respaldo del CDN; revisa que "three" esté en dependencies)');
  if (u.protocol === 'https:') { const h = await fetch('http://' + u.host + '/', { redirect: 'manual', signal: AbortSignal.timeout(30000) }).catch(() => null); warn(!h || (h.status >= 301 && h.status <= 308 && /^https:/.test(h.headers.get('location') || '')), 'http:// redirige a https://'); }
  r = await t('/socket.io/?EIO=4&transport=polling'); const sio = await r.text(); ok(r.status === 200 && sio.startsWith('0{') && sio.includes('"sid"'), 'Socket.IO responde (handshake de sondeo)');
  if (typeof WebSocket === 'function') {
    const wsu = base.replace(/^http/, 'ws') + '/socket.io/?EIO=4&transport=websocket'; const t0 = Date.now();
    const first = await new Promise(res => { const w = new WebSocket(wsu), to = setTimeout(() => { try { w.close(); } catch (_) {} res(null); }, 20000); w.onmessage = e => { clearTimeout(to); w.close(); res(String(e.data)); }; w.onerror = () => { clearTimeout(to); res(null); }; });
    ok(first && first.startsWith('0{'), `WebSocket seguro (${u.protocol === 'https:' ? 'wss' : 'ws'}) conecta y negocia con Socket.IO (${Date.now() - t0} ms)`);
  } else console.log('AVISO: este Node no incluye WebSocket global (usa Node >= 22) — omito la prueba wss');
  console.log(fails ? `\n${fails} FALLO(S), ${warns} aviso(s). Revisa el README (solución de problemas).` : `\nDESPLIEGUE OK (${warns} aviso(s)). Ahora ejecuta la prueba completa:  SERVER=${base} N=5 npm run test:socketio  y prueba con móviles reales.`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(2); });
