// Portada de Jumpet: lugares destacados (se pagan con Stripe a través de jumpet-api) y ofertas reales.
const API = location.hostname === 'localhost' ? 'http://localhost:8792' : 'https://api.jumpet.app'; // en local, «wrangler dev»
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pedir = (ruta, o) => fetch(API + ruta, o).then(async r => {
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'No se pudo conectar. Prueba otra vez en un momento.');
  return j;
});

// ---- Aparición suave al bajar, y los 5 envíos del encuadre ----
const vista = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && (e.target.classList.add('visible'), vista.unobserve(e.target))), { threshold: .12 });
document.querySelectorAll('.aparece').forEach(el => vista.observe(el));
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  let n = 0;
  setInterval(() => {
    const puntos = document.querySelectorAll('#envios span');
    n = n % 6 + 1;
    puntos.forEach((p, i) => p.classList.toggle('ok', i < n && n < 6));
  }, 900);
} else document.querySelectorAll('#envios span').forEach(p => p.classList.add('ok'));

// ---- Lugares destacados ----
let LUGARES = [], PAGOS = false, elegido = null;
function pintarLugares() {
  $('#lugares').innerHTML = LUGARES.map(l => {
    const ocupado = !!l.nombre;
    const foto = ocupado
      ? `<a class="foto" href="${esc(l.web)}" target="_blank" rel="sponsored noopener"><img src="${API}/api/img/${esc(l.img)}" alt="${esc(l.nombre)}" loading="lazy"></a>`
      : `<div class="foto">+</div>`;
    return `<div class="lugar${ocupado ? ' ocupado' : ''}${l.n === 1 ? ' uno' : ''}">
      <span class="num">Nº ${l.n}</span>${foto}
      <div class="nombre">${ocupado ? esc(l.nombre) : 'Lugar libre'}</div>
      <div class="precio">${ocupado ? 'Retómalo por' : 'Ocúpalo por'} <b>${l.precio} USD</b></div>
      <button class="boton${ocupado ? ' sec' : ''}" data-n="${l.n}"${PAGOS ? '' : ' disabled title="Muy pronto"'}>${PAGOS ? (ocupado ? 'Retomar' : 'Ocupar') : 'Muy pronto'}</button>
    </div>`;
  }).join('');
}
function cargarLugares() {
  pedir('/api/lugares').then(r => { LUGARES = r.lugares; PAGOS = r.pagos; pintarLugares(); })
    .catch(() => { LUGARES = Array.from({ length: 5 }, (_, i) => ({ n: i + 1, precio: 5 })); PAGOS = false; pintarLugares(); });
}
$('#lugares').addEventListener('click', e => {
  const b = e.target.closest('button[data-n]');
  if (!b) return;
  elegido = LUGARES[b.dataset.n - 1];
  $('#compraTitulo').textContent = `${elegido.nombre ? 'Retomar' : 'Ocupar'} el lugar nº ${elegido.n}`;
  $('#compraTexto').textContent = `Precio: ${elegido.precio} USD, pago único. El lugar es tuyo hasta que otra empresa pague ${elegido.precio + (elegido.n === 1 ? 10 : 5)} USD por él.`;
  $('#cPagar').textContent = `Pagar ${elegido.precio} USD con Stripe`;
  $('#cError').textContent = '';
  $('#compra').showModal();
});

// El logo se reduce en el navegador a 320 × 320 sobre fondo blanco, para que pese poco.
let imagen = '';
$('#cImg').addEventListener('change', async e => {
  imagen = '';
  const f = e.target.files[0];
  if (!f) return;
  try {
    const bm = await createImageBitmap(f), lado = 320, c = document.createElement('canvas');
    c.width = c.height = lado;
    const x = c.getContext('2d'), k = Math.min(lado / bm.width, lado / bm.height);
    x.fillStyle = '#fff';
    x.fillRect(0, 0, lado, lado);
    x.drawImage(bm, (lado - bm.width * k) / 2, (lado - bm.height * k) / 2, bm.width * k, bm.height * k);
    imagen = c.toDataURL('image/webp', .86);
    if (!imagen.startsWith('data:image/webp')) imagen = c.toDataURL('image/jpeg', .86);
    $('#previaImg').src = imagen;
    $('#previa').hidden = false;
  } catch { $('#cError').textContent = 'No se pudo leer esa imagen. Prueba con otra.'; }
});
$('#formCompra').addEventListener('submit', e => {
  if (e.submitter && e.submitter.value === 'cancelar') return;
  e.preventDefault();
  if (!imagen) return $('#cError').textContent = 'Elige el logo o la foto.';
  const b = $('#cPagar');
  b.disabled = true;
  $('#cError').textContent = '';
  pedir(`/api/lugares/${elegido.n}/comprar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nombre: $('#cNombre').value, web: $('#cWeb').value, img: imagen })
  }).then(r => location.href = r.url).catch(err => { $('#cError').textContent = err.message; b.disabled = false; });
});

// ---- Ofertas reales ----
function buscar() {
  const p = new URLSearchParams({ q: $('#q').value.trim() || 'bilingual', donde: $('#donde').value.trim(), pais: $('#pais').value, remoto: $('#remoto').checked ? 1 : '' });
  $('#listaOfertas').innerHTML = '<div class="fantasma"></div>'.repeat(6);
  $('#fuente').textContent = '';
  pedir('/api/empleos?' + p).then(r => {
    $('#listaOfertas').innerHTML = r.ofertas.length ? r.ofertas.map((o, i) => `<a class="oferta" href="${esc(o.url)}" target="_blank" rel="noopener" style="animation-delay:${Math.min(i, 12) * 45}ms">
        <h3>${esc(o.titulo)}</h3>
        <div class="meta">${esc([o.empresa, o.lugar].filter(Boolean).join(' · '))}${o.salario ? ' · ' + esc(o.salario) : ''}</div>
        <div class="res">${esc(o.resumen)}…</div>
        <span class="ver">Ver oferta ↗</span>
      </a>`).join('') : '<p class="fuente">No hay ofertas con esa búsqueda. Prueba con otra palabra o quita la ciudad.</p>';
    $('#fuente').innerHTML = `Ofertas de <a href="${esc(r.fuente.web)}" target="_blank" rel="noopener">${esc(r.fuente.nombre)}</a>. Para postularte con tu currículum, <a href="app.html">entra en Jumpet</a>.`;
  }).catch(() => { $('#listaOfertas').innerHTML = '<p class="fuente">Las ofertas se están conectando. Vuelve en un rato.</p>'; });
}
$('#formOfertas').addEventListener('submit', e => { e.preventDefault(); buscar(); });
$('#remoto').addEventListener('change', buscar);

cargarLugares();
buscar();
