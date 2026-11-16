// Cargador: motor 3D (local con respaldo en CDN) -> Socket.IO -> juego. Muestra errores claros si algo falla.
(function () {
  var L = document.getElementById('loading');
  function msg(t) { if (L) { L.style.letterSpacing = '0'; L.style.padding = '24px'; L.style.textAlign = 'center'; L.textContent = t; } }
  function load(src, ok, fail) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = fail; document.head.appendChild(s); }
  var V = 'ab6f177dff';
  load('/vendor/three.min.js', net, function () {
    load('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', net, function () { msg('No se pudo cargar el motor 3D. Comprueba tu conexión y recarga la página.'); });
  });
  function net() { load('/socket.io/socket.io.js', app, app); }   // si falla Socket.IO, el juego carga igualmente (modo solo)
  function app() { load('/app.js?v=' + V, function () {}, function () { msg('No se pudo cargar el juego. Recarga la página.'); }); }
})();
