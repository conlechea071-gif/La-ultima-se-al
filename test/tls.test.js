'use strict';
// HTTPS + WebSocket seguro (wss) desde la MISMA dirección que la página, con un certificado autofirmado generado al vuelo.
// (En Render/Railway el TLS lo pone la plataforma delante; aquí se prueba que el código funciona también con TLS directo y con wss.)
const https = require('https'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';   // solo para esta prueba: el certificado es autofirmado
const { createHandler } = require('../src/http'), { Rooms } = require('../src/rooms'), { WsIO, WsClient } = require('./helpers/wsio');
let fails = 0, pass = 0; const ok = (c, m) => { if (c) { pass++; console.log('ok  :', m); } else { fails++; console.log('FALLO:', m); } };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tls-')), key = path.join(dir, 'k.pem'), crt = path.join(dir, 'c.pem');
try { cp.execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', crt, '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore' }); }
catch (e) { console.log('SALTADA: openssl no disponible, no se puede generar el certificado de prueba'); process.exit(0); }
(async () => {
  const server = https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(crt) }, createHandler({ forceHttps: true, health: () => ({}) }));
  const rooms = new Rooms(null, { log: () => {} }); const io = new WsIO(s => rooms.attach(s), { server }); rooms.io = io; rooms.start();
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port, base = `https://127.0.0.1:${port}`;
  const r = await fetch(base + '/'); const html = await r.text();
  ok(r.status === 200 && html.includes('LA ÚLTIMA SEÑAL') && /max-age=31536000/.test(r.headers.get('strict-transport-security')), 'HTTPS: la página se sirve con HSTS y sin redirecciones (conexión cifrada detectada)');
  const h = await fetch(base + '/health'); ok(h.status === 200, 'HTTPS: /health');
  for (const n of [2, 6]) {
    const cs = []; for (let i = 0; i < n; i++) { const c = new WsClient(`wss://127.0.0.1:${port}`); await c.open; cs.push(c); }
    const cr = await cs[0].call('room:create', { nick: 'Host', max: n, c: 0 }); cs[0].me = cr.you;
    const js = await Promise.all(cs.slice(1).map((c, i) => c.call('room:join', { code: cr.code, nick: 'P' + i, c: 1 }).then(x => { c.me = x.you; return x; })));
    ok(cr.ok && js.every(x => x.ok), `WSS: ${n} clientes conectados por wss:// a la misma dirección que la página`);
    cs.forEach(c => c.inbox.length = 0); const st = await cs[0].call('room:start'); await new Promise(r2 => setTimeout(r2, 300));
    const roles = cs.map(c => (c.last('game:start') || {}).role); ok(st.ok && roles.filter(x => x === 'monster').length === 1, `WSS: partida de ${n} iniciada, 1 monstruo elegido por el servidor`);
    cs[1].send('p:state', { x: cs[1].last('game:start').spawn.x + .1, z: cs[1].last('game:start').spawn.z, yaw: 1, fl: 1, run: 0 }); await new Promise(r2 => setTimeout(r2, 300));
    ok(cs[0].last('snap') && cs[0].last('snap').p.find(p => p[0] === cs[1].me.id)[5] === 1, `WSS: movimiento y linterna sincronizados en tiempo real (${n} jugadores)`);
    cs.forEach(c => c.close());
  }
  rooms.stop(); io.close(); server.close(); console.log(`\n${pass} pruebas correctas, ${fails} fallos`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
