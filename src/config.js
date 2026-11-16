'use strict';
// Configuración por variables de entorno (ver .env.example y README).
const bool = (v, d) => (v === undefined || v === '' ? d : /^(1|true|yes|on)$/i.test(String(v)));
const list = v => String(v || '').split(',').map(s => s.trim()).filter(Boolean);
module.exports = function load(env = process.env) {
  return {
    port: Number(env.PORT) || 3000,
    host: env.HOST || '0.0.0.0',
    prod: env.NODE_ENV === 'production',
    forceHttps: bool(env.FORCE_HTTPS, false),      // redirige http -> https (actívalo detrás de Render/Railway)
    trustProxy: bool(env.TRUST_PROXY, true),       // lee X-Forwarded-Proto / X-Forwarded-For del proxy del hosting
    publicUrl: env.PUBLIC_URL || '',                // p. ej. https://la-ultima-senal.onrender.com (opcional, para logs/orígenes)
    allowedOrigins: list(env.ALLOWED_ORIGINS),      // orígenes extra con permiso para abrir WebSockets (si usas otro dominio)
    maxConnPerIp: Number(env.MAX_CONN_PER_IP) || 40,
    tlsKey: env.TLS_KEY || '', tlsCert: env.TLS_CERT || '', // solo si NO hay proxy y quieres HTTPS directo (VPS)
  };
};
