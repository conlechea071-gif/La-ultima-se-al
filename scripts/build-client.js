'use strict';
// Genera el cliente a partir de shared/world.js + client/*.
//   public/index.html + boot.js + app.js : página pública (carga three.js local con respaldo en CDN, Socket.IO y el juego)
//   public/solo.html                      : versión de un solo archivo sin multijugador (apta para publicar como Claude Artifact)
const fs = require('fs'), path = require('path'), crypto = require('crypto'), root = path.join(__dirname, '..'), pub = path.join(root, 'public');
const rd = f => fs.readFileSync(path.join(root, f), 'utf8'), wr = (f, s) => fs.writeFileSync(path.join(pub, f), s);
fs.mkdirSync(pub, { recursive: true });
const head = rd('client/head.html'); if (!head.includes('<!--SCRIPTS-->')) throw new Error('falta <!--SCRIPTS--> en head.html');
const code = t => `const BUILD_TARGET='${t}';\n` + [rd('shared/world.js'), rd('client/game.js'), rd('client/net.js'), rd('client/tail.js')].join('\n');
const app = code('server'), ver = crypto.createHash('sha1').update(app).digest('hex').slice(0, 10);
wr('app.js', app); wr('boot.js', rd('client/boot.js').replace('__V__', ver));
wr('index.html', head.replace('<!--SCRIPTS-->', `<script src="/boot.js?v=${ver}"></script>\n</body></html>\n`));
wr('solo.html', head.replace('<!--SCRIPTS-->', '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>\n<script>\n' + code('solo') + '\n</script></body></html>\n'));
for (const f of fs.readdirSync(path.join(root, 'client/static'))) fs.copyFileSync(path.join(root, 'client/static', f), path.join(pub, f));
console.log(`Cliente generado (versión ${ver}): public/index.html, boot.js, app.js, solo.html`);
