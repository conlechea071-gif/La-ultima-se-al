'use strict';
/**
 * Servidor HTTP de la página (sin dependencias): sirve public/ y el motor three.js, cabeceras de seguridad,
 * redirección a HTTPS, HSTS, gzip, caché, 404/405/500 y /health.  Socket.IO se engancha al mismo servidor en server.js.
 */
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' };
const COMPRESS = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt']);
const CSP = ["default-src 'self'", "script-src 'self' https://cdnjs.cloudflare.com 'unsafe-inline'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "connect-src 'self' ws: wss:", "font-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"].join('; ');
const PAGE = (t, m) => `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t}</title><body style="background:#050607;color:#d8d4c4;font-family:Georgia,serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center"><h1 style="letter-spacing:.25em;font-weight:400">${t}</h1><p style="color:#8a948c">${m}</p><p><a style="color:#d8d4c4" href="/">Volver al juego</a></p></body></html>`;

function createHandler(o) {
  const cfg = Object.assign({ publicDir: path.join(__dirname, '..', 'public'), vendorDir: path.join(__dirname, '..', 'node_modules', 'three', 'build'), forceHttps: false, trustProxy: true, health: () => ({}), version: '0' }, o);
  const cache = new Map();
  const isHttps = req => !!(req.socket && req.socket.encrypted) || (cfg.trustProxy && String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https');
  const base = (req, res, status, type, extra = {}) => {
    const h = Object.assign({ 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': CSP, 'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'fullscreen=(self), camera=(), microphone=(), geolocation=(), payment=()', 'Cross-Origin-Opener-Policy': 'same-origin' }, extra);
    if (isHttps(req)) h['Strict-Transport-Security'] = 'max-age=31536000'; res.writeHead(status, h);
  };
  const send = (req, res, status, type, body, extra) => { const b = Buffer.from(body); base(req, res, status, type, Object.assign({ 'Content-Length': b.length, 'Cache-Control': 'no-store' }, extra)); res.end(req.method === 'HEAD' ? undefined : b); };
  function load(file) {
    const st = fs.statSync(file); if (!st.isFile()) return null; const c = cache.get(file);
    if (c && c.mtime === st.mtimeMs) return c; const buf = fs.readFileSync(file), ext = path.extname(file).toLowerCase();
    const e = { buf, gz: COMPRESS.has(ext) && buf.length > 512 ? zlib.gzipSync(buf, { level: 9 }) : null, type: MIME[ext] || 'application/octet-stream', etag: '"' + crypto.createHash('sha1').update(buf).digest('hex').slice(0, 20) + '"', mtime: st.mtimeMs };
    cache.set(file, e); return e;
  }
  function serveFile(req, res, file, url) {
    let e; try { e = load(file); } catch (_) { e = null; } if (!e) return notFound(req, res);
    const ver = /[?&]v=/.test(url), cc = file.endsWith('index.html') ? 'no-cache' : ver ? 'public, max-age=31536000, immutable' : 'public, max-age=3600';
    if (req.headers['if-none-match'] === e.etag) { base(req, res, 304, e.type, { ETag: e.etag, 'Cache-Control': cc }); return res.end(); }
    const useGz = e.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || ''), body = useGz ? e.gz : e.buf;
    base(req, res, 200, e.type, Object.assign({ ETag: e.etag, 'Cache-Control': cc, 'Content-Length': body.length, Vary: 'Accept-Encoding' }, useGz ? { 'Content-Encoding': 'gzip' } : {}));
    res.end(req.method === 'HEAD' ? undefined : body);
  }
  function notFound(req, res) { const html = /text\/html/.test(req.headers.accept || ''); send(req, res, 404, html ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8', html ? PAGE('404', 'Esta página no existe.') : 'No encontrado'); }
  return function handler(req, res) {
    try {
      const url = req.url || '/', host = req.headers.host || '';
      let p; try { p = decodeURIComponent(url.split('?')[0]); } catch (_) { return send(req, res, 400, 'text/plain; charset=utf-8', 'Solicitud inválida'); }
      if (p === '/health') { const b = JSON.stringify(Object.assign({ ok: true, uptime: Math.round(process.uptime()) }, cfg.health())); return send(req, res, 200, 'application/json; charset=utf-8', b); }
      if (cfg.forceHttps && !isHttps(req) && host) { res.writeHead(301, { Location: 'https://' + host + url, 'Cache-Control': 'no-store' }); return res.end(); }
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(req, res, 405, 'text/plain; charset=utf-8', 'Método no permitido', { Allow: 'GET, HEAD' });
      if (p === '/version') return send(req, res, 200, 'application/json; charset=utf-8', JSON.stringify({ version: cfg.version }));
      if (p.includes('\0') || p.split('/').some(s => s === '..' || (s.startsWith('.') && s.length > 1))) return notFound(req, res);
      if (p === '/vendor/three.min.js') return serveFile(req, res, path.join(cfg.vendorDir, 'three.min.js'), url);
      if (p === '/') p = '/index.html';
      const file = path.normalize(path.join(cfg.publicDir, p));
      if (!file.startsWith(cfg.publicDir + path.sep)) return notFound(req, res);
      return serveFile(req, res, file, url);
    } catch (e) { try { console.error('[http]', e && e.stack || e); send(req, res, 500, 'text/plain; charset=utf-8', 'Error interno del servidor'); } catch (_) {} }
  };
}
module.exports = { createHandler, CSP };
