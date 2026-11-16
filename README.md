# LA ÚLTIMA SEÑAL — juego web multijugador (página + servidor en una sola dirección)

Un único servicio Node.js sirve **la página del juego y el servidor Socket.IO desde la misma dirección HTTPS**.
Los jugadores solo abren un enlace en su navegador (Chrome, Edge, Android): **sin descargas y sin comandos**.
Los comandos de esta guía los ejecuta **una sola vez quien publica el juego**, no los jugadores.

> ## ⚠️ Estado real
> **El juego todavía NO está publicado**: no existe una URL pública. Este proyecto está *preparado* para desplegarlo;
> la URL definitiva (algo como `https://la-ultima-senal.onrender.com`) solo existirá cuando completes la sección
> **"Publicar"**. No se ha probado en un hosting real, ni con dispositivos reales en redes distintas.
>
> | Prueba | Resultado | Qué demuestra / qué NO |
> |---|---|---|
> | `test/rooms.test.js` (97) | ✅ | Lógica de salas 2/5/6/10/20, códigos, monstruo aleatorio y secreto, validación, capturas, reconexión, robustez. Transporte simulado. |
> | `test/http.test.js` (32) | ✅ | Capa web: rutas, cabeceras de seguridad, redirección a HTTPS, HSTS, gzip, caché, 404/405/400/500, bloqueo de rutas peligrosas, orígenes de WebSocket, límite por IP, configuración. |
> | `test/tls.test.js` (8) | ✅ | **HTTPS + WSS** reales (certificado autofirmado generado al vuelo): página y WebSocket seguro en la misma dirección, 2 y 6 clientes. |
> | `test/net.ws.test.js` (80) | ✅ | Red real TCP/WebSocket en localhost con **2, 5, 6 y 20 clientes**. |
> | `test/client.integration.js` (32) y `client.solo.test.js` (12) | ✅ | El cliente real (`public/app.js`, con THREE/DOM simulados) contra el servidor real: sala, partida, sincronización, papeles, transformación, captura, reconexión, fin y revancha; y el modo solo. |
> | **Socket.IO real** (`src/server.js` ejecutado, `npm run test:socketio`) | ⛔ **no ejecutado** | Donde se escribió no se podía instalar `socket.io` (sin red). `src/server.js` solo tiene la sintaxis verificada. |
> | **Despliegue en Render/Railway + `npm run check`** | ⛔ **no hecho** | Lo haces tú (guía abajo). |
> | **Móviles/PC reales**, rendimiento, gráficos, audio | ⛔ **no probado** | Hay que probarlo con dispositivos reales tras publicar. |
>
> **No consideres el multijugador terminado hasta pasar la sección "Verificar".**

---

## Publicar (conseguir la URL pública HTTPS)

Necesitas: una cuenta gratuita en **GitHub** y otra en **Render** (o **Railway**). Tiempo: ~15 minutos.

### Opción A — Render (recomendada)
1. **Sube el proyecto a GitHub.** En github.com → *New repository* (p. ej. `la-ultima-senal`, privado o público) → *uploading an existing file* → arrastra **el contenido** de esta carpeta (`src`, `shared`, `client`, `public`, `scripts`, `test`, `package.json`, `render.yaml`, etc.) → *Commit changes*.
   - Debe incluir la carpeta **`public/`** (contiene el juego ya generado) y **no** hace falta `node_modules`.
2. En **render.com** → *New +* → **Blueprint** → conecta tu GitHub → elige el repositorio → *Apply*.
   (Alternativa manual: *New +* → **Web Service** → mismo repositorio → *Runtime* **Node** → *Build Command* `npm install --omit=dev` → *Start Command* `npm start` → *Health Check Path* `/health` → añade las variables de la tabla de abajo.)
3. Espera al primer despliegue (*Live*). Render te muestra tu dirección: **`https://<nombre>.onrender.com`**. Esa es la URL que compartes.
   Render pone HTTPS y WebSocket seguro (wss) automáticamente.
4. Comparte el enlace. Cada jugador lo abre en su navegador.

> **Plan gratuito:** el servicio se *duerme* tras ~15 min sin visitas (la primera visita tarda ~1 min en despertarlo) y **se pierden las salas** al dormir o reiniciar. Para partidas en serio usa un plan de pago (*Starter*) para que esté siempre activo.
> **Regiones:** elige la más cercana a tus jugadores (en `render.yaml`, `region:`).

### Opción B — Railway
1. Sube el proyecto a GitHub (paso 1 de arriba).
2. En **railway.app** → *New Project* → *Deploy from GitHub repo* → elige el repositorio. Railway detecta Node y usa `railway.json`.
3. En el servicio → *Settings* → *Networking* → **Generate Domain** → obtienes **`https://<algo>.up.railway.app`**.
4. En *Variables* añade las de la tabla (`NODE_ENV=production`, `FORCE_HTTPS=1`).
5. Comparte el enlace.

### Opción C — Docker / VPS
`docker build -t lus . && docker run -p 3000:3000 -e NODE_ENV=production -e FORCE_HTTPS=1 lus` detrás de un proxy con HTTPS (nginx/Caddy). Ejemplo nginx:
```nginx
location / { proxy_pass http://127.0.0.1:3000; proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";
  proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto $scheme; proxy_set_header X-Forwarded-For $remote_addr; proxy_read_timeout 120s; }
```
Sin proxy: define `TLS_KEY` y `TLS_CERT` (rutas a tu certificado, p. ej. Let's Encrypt) y el propio servidor sirve HTTPS/WSS.

## Variables de entorno
| Variable | Valor recomendado | Para qué |
|---|---|---|
| `NODE_ENV` | `production` | Modo producción. |
| `PORT` | *(la pone la plataforma)* | Puerto de escucha (por defecto 3000). |
| `FORCE_HTTPS` | `1` | Redirige `http://` → `https://` (Render/Railway envían `X-Forwarded-Proto`). Déjalo en `0` en pruebas locales. |
| `TRUST_PROXY` | `1` | Lee protocolo e IP reales que reenvía el proxy del hosting. |
| `PUBLIC_URL` | `https://tu-juego.onrender.com` *(opcional)* | Se añade a los orígenes permitidos y a los logs. |
| `ALLOWED_ORIGINS` | *(vacío)* | Solo si alojas la página en OTRO dominio: orígenes extra autorizados para WebSockets, separados por comas. |
| `MAX_CONN_PER_IP` | `40` | Conexiones simultáneas por IP (protección anti-abuso). |
| `TLS_KEY` / `TLS_CERT` | *(vacío)* | Solo VPS sin proxy. |
No hay claves secretas ni base de datos. Plantilla: `.env.example`.

## Verificar tras publicar (obligatorio)
Con la URL real (desde cualquier PC con Node ≥ 22; no hace falta para jugar):
```bash
npm install
npm run check -- https://tu-juego.onrender.com          # página, HTTPS/HSTS, Socket.IO y wss
SERVER=https://tu-juego.onrender.com N=5 npm run test:socketio   # sala de N jugadores reales sobre Socket.IO (N = 2, 5, 6, 10 ó 20)
```
Después, prueba a mano con **dispositivos distintos y redes distintas** (un PC en Chrome, un Edge, un Android con datos móviles…):
crear sala → compartir código → unirse → iniciar → ver a los demás moverse, linternas, papeles, transformación del monstruo y captura → cortar el wifi 10 s y comprobar la reconexión.
Si algo falla, anota el síntoma y consulta "Solución de problemas".

## Compatibilidad prevista (no verificada en dispositivos reales)
- **Chrome y Edge (PC)**: ratón (pointer lock), teclado WASD, SHIFT alterna correr, E, F. Android: Chrome/Edge/Samsung Internet con joystick virtual, cámara táctil y botones; se pide pantalla completa y horizontal al jugar.
- Requiere **WebGL** (si no hay, se muestra un aviso claro) y JavaScript. Calidad inicial automática según el dispositivo (Baja/Media/Alta) y **reducción automática** si los FPS bajan; se puede cambiar en CONFIGURACIÓN.
- iPhone/Safari: no se ha tenido en cuenta ni probado.

## Qué incluye el proyecto
```
├─ src/server.js     arranque: HTTP(S) + Socket.IO en la misma dirección, límites por IP, cierre limpio
├─ src/http.js       página: rutas, CSP y cabeceras, HTTPS forzado, HSTS, gzip, caché, 404/405/500, /health
├─ src/rooms.js      lógica autoritativa: salas, códigos, roles, validación, papeles, capturas, reconexión
├─ src/guard.js      origen de WebSocket y límite de conexiones por IP
├─ src/config.js     variables de entorno
├─ shared/world.js   bosque (terreno, colisiones, 29 papeles): mismo archivo para cliente y servidor
├─ client/           fuente del cliente (head.html, game.js, net.js, tail.js, boot.js, static/)
├─ public/           cliente generado: index.html, boot.js, app.js, solo.html, favicon.svg, robots.txt
├─ scripts/          build-client.js · check-deploy.js
├─ test/             pruebas
├─ render.yaml · railway.json · Procfile · Dockerfile · .env.example · .node-version
```
Si cambias algo en `client/` o `shared/`: `npm run build:client` y vuelve a subir `public/`.
Dependencias: `socket.io` (servidor) y `three@0.128.0` (motor 3D, servido por el propio servidor con respaldo en CDN). `ws` y `socket.io-client` solo para pruebas.

## Cómo funciona el multijugador
1. **MULTIJUGADOR** → apodo, personaje, tamaño de sala (2, 5, 6, 10 ó 20) → **CREAR SALA** (pública o privada) y comparte el código de 5 caracteres.
2. Otros: **BUSCAR SALAS** o **código** → **UNIRSE**. Sala de espera con lista de participantes; el anfitrión pulsa **INICIAR** (mínimo 2).
3. El servidor elige **al azar y en secreto** al monstruo (un jugador humano). Tras 60–120 s (o con **T** pasados 45 s) se transforma y se revela.
4. Supervivientes: 29 papeles compartidos, 3 vidas. Monstruo: persigue, **E** = embestida. Capturas, vidas y fin de partida los decide el servidor.
5. Reconexión automática con token (2 min de margen en partida). Indicador de conexión en pantalla.
El **modo solo** (IA del monstruo) sigue disponible con **JUGAR**.

## Operación y límites
- Estado **en memoria** y **una sola instancia** (no escales a varias réplicas; se perderían las salas entre ellas). Reiniciar/redesplegar cierra las partidas en curso (los clientes lo avisan y reintentan).
- Sin entradas tardías (la sala se cierra al iniciar), sin chat de texto/voz en esta etapa.
- Autoridad en el servidor, pero el movimiento lo envía el cliente y el servidor lo valida (velocidad, colisiones, límites): protección básica, no infalible.
- Logs: salida estándar (panel de Render/Railway). `GET /health` → estado y número de salas/jugadores.

## Solución de problemas
| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| La primera carga tarda ~1 min | Plan gratuito dormido | Espera; o usa plan de pago. |
| "No se puede conectar con el servidor…" | Servicio dormido/reiniciando o bloqueo de red | Recarga; prueba otra red; revisa logs. |
| Bucle de redirecciones | `FORCE_HTTPS=1` sin proxy que envíe `X-Forwarded-Proto` | Pon `FORCE_HTTPS=0` o usa un proxy correcto. |
| El juego se queda en "CARGANDO…" | No cargó three.js/app.js | Revisa que `public/` esté subido y que `three` esté en `dependencies`; hay respaldo en CDN. |
| Se conecta pero "Origen no permitido"/no entra | Página y servidor en dominios distintos | Sirve todo desde el mismo dominio o define `ALLOWED_ORIGINS`. |
| "Demasiadas conexiones" | Muchos jugadores tras la misma IP (colegio, evento) | Sube `MAX_CONN_PER_IP`. |
| Salas desaparecen | Reinicio/sueño del servicio | Plan siempre activo. |
| Va lento en móvil | Dispositivo modesto | CONFIGURACIÓN → GRÁFICOS: BAJA. |

## Desarrollo local (solo para quien programa)
```bash
npm install && npm start          # http://localhost:3000   (en local déjalo con FORCE_HTTPS=0)
npm test                          # todas las pruebas que no necesitan red externa (usa `ws`)
```
