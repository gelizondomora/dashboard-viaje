import { parsearDatos } from './parse.js';
import { choques, convertir, hoyISO } from './compute.js';
import { crearOp, idTemporal, aplicarPendientes, consolidar, sincronizar, aplicarReemplazos, reintentar, descartar, crearSincronizador } from './queue.js';
import { crearApi, mensajeError } from './api.js';
import { crearStore, crearMemoria } from './store.js';
import { esc, dinero, hace } from './formato.js';
import { abrirFormulario } from './forms.js';
import { editarCosto, editarActividad, editarLugar, editarReserva } from './editores.js';
import { renderHoy } from './render-hoy.js';
import { renderItinerario } from './render-itinerario.js';
import { renderCostos } from './render-costos.js';
import { renderReservas } from './render-reservas.js';
import { pintarGraficos } from './charts.js';

const params = new URLSearchParams(location.search);
const demo = params.has('demo');
const hoy = () => params.get('hoy') || hoyISO();
const store = crearStore(demo ? 'dashboard-viaje-demo' : 'dashboard-viaje', demo ? crearMemoria() : undefined);
const estado = {
  ...store.cargar(),
  pestana: params.get('pestana') || 'hoy',
  vistaItinerario: params.get('vista') || 'lista',
  filtroCategoria: '', conversor: '', sinConexion: false, error: null,
};
let api = null;
let sincronizando = false;
let vista = null;

const guardar = () => store.guardar(estado);
const VERBO = { agregar: 'agregar', modificar: 'modificar', eliminar: 'eliminar' };

function cabeceraHtml() {
  const pendientes = estado.ops.filter(o => o.estado === 'pendiente').length;
  const partes = [];
  if (estado.raw?.leidoEn) partes.push(`Actualizado ${hace(estado.raw.leidoEn)}`);
  if (pendientes) partes.push(`⏳ ${pendientes} ${pendientes === 1 ? 'pendiente' : 'pendientes'}`);
  if (demo) partes.push('modo demo');
  return `<h1>${esc(vista?.nombre || 'Dashboard de Viaje')}</h1><div class="estado">${partes.map(esc).join('<br>')}</div>`
    + '<button class="icono" data-accion="recargar" aria-label="Recargar">⟳</button><button class="icono" data-accion="ajustes" aria-label="Ajustes">⚙</button>';
}

function avisoHtml() {
  const p = [];
  if (estado.sinConexion && estado.raw) p.push(`Sin conexión · datos de ${esc(hace(estado.raw.leidoEn))}`);
  if (estado.error && estado.raw) p.push(esc(estado.error));
  for (const a of vista?.advertencias || []) p.push(esc(a));
  for (const o of estado.ops.filter(x => x.estado === 'error')) {
    p.push(`⚠ No se pudo ${VERBO[o.op]} en ${esc(o.tabla)}: ${esc(o.error)} `
      + `<button class="enlace" data-accion="reintentar-op" data-op="${esc(o.opId)}">Reintentar</button> `
      + `<button class="enlace" data-accion="descartar-op" data-op="${esc(o.opId)}">Descartar</button>`);
  }
  return p.map(x => `<p>${x}</p>`).join('');
}

function pintar() {
  vista = estado.raw ? parsearDatos(aplicarPendientes(estado.raw, estado.ops)) : null;
  document.getElementById('cabecera').innerHTML = cabeceraHtml();
  const aviso = document.getElementById('aviso');
  aviso.innerHTML = avisoHtml();
  aviso.hidden = !aviso.innerHTML;
  const c = document.getElementById('contenido');
  if (!vista) {
    c.innerHTML = estado.error
      ? `<section class="tarjeta"><p>${esc(estado.error)}</p><button class="primario" data-accion="recargar">Reintentar</button></section>`
      : '<p class="vacio">Cargando…</p>';
  } else if (estado.pestana === 'hoy') {
    c.innerHTML = renderHoy(vista, { hoy: hoy() });
  } else if (estado.pestana === 'itinerario') {
    c.innerHTML = renderItinerario(vista, { vista: estado.vistaItinerario, choques: choques(vista), hoy: hoy() });
  } else if (estado.pestana === 'costos') {
    c.innerHTML = renderCostos(vista, { filtro: estado.filtroCategoria });
    pintarGraficos(vista);
  } else {
    c.innerHTML = renderReservas(vista);
  }
  document.querySelectorAll('#navegacion button').forEach(b => b.classList.toggle('activo', b.dataset.pestana === estado.pestana));
  const conv = document.getElementById('conv-monto');
  if (conv) { conv.value = estado.conversor; actualizarConversor(); }
}

function actualizarConversor() {
  const out = document.getElementById('conv-resultado');
  if (!out || !vista) return;
  const n = Number(estado.conversor);
  if (estado.conversor === '' || !Number.isFinite(n)) { out.textContent = '—'; return; }
  const r = convertir(n, vista);
  out.textContent = `${dinero(r.usd, 'USD')} · ${dinero(r.casa, vista.monedaCasa)}`;
}

function manejarError(e) {
  const m = mensajeError(e, !!estado.raw);
  if (m.tipo === 'clave') { estado.error = m.texto; abrirAjustes(); }
  else if (m.tipo === 'config') estado.error = m.texto;
  else { estado.sinConexion = true; if (!estado.raw) estado.error = m.texto; }
}

async function leerHoja() {
  if (!api) return;
  try {
    estado.raw = await api.leer();
    estado.sinConexion = false;
    estado.error = null;
  } catch (e) { manejarError(e); }
  guardar();
  pintar();
}

async function sincronizarCola() {
  if (!api || sincronizando) return;
  sincronizando = true;
  const enviadas = estado.ops;
  try {
    const r = await sincronizar(enviadas, api.enviar);
    const nuevas = estado.ops.filter(o => !enviadas.includes(o));
    estado.ops = r.ops.concat(aplicarReemplazos(nuevas, r.reemplazos));
    if (r.confirmadas.length) estado.raw = consolidar(estado.raw, r.confirmadas);
    if (r.enviado) estado.sinConexion = false;
  } catch (e) {
    manejarError(e);
  } finally {
    sincronizando = false;
    guardar();
  }
}

// Serializado: si se llama mientras corre, vuelve a correr al terminar (así no se queda nada pendiente).
const sincronizarYLeer = crearSincronizador(async () => {
  await sincronizarCola();
  if (!estado.ops.some(o => o.estado === 'pendiente')) await leerHoja();
  else pintar();
});

async function encolar(op, tabla, id, valores) {
  const idOp = op === 'agregar' ? idTemporal(estado.raw, estado.ops) : id;
  estado.ops = [...estado.ops, crearOp(op, tabla, { id: idOp, valores })];
  guardar();
  pintar();
  await sincronizarYLeer();
}

const acciones = (tabla, id) => ({
  guardar: valores => encolar(id === null ? 'agregar' : 'modificar', tabla, id, valores),
  eliminar: () => encolar('eliminar', tabla, id, {}),
});

function abrirAjustes() {
  if (demo) return;
  abrirFormulario({
    titulo: 'Ajustes',
    campos: [
      { nombre: 'url', etiqueta: 'URL del Apps Script (termina en /exec)', tipo: 'texto', requerido: true, valor: estado.ajustes.url },
      { nombre: 'clave', etiqueta: 'Clave', tipo: 'texto', requerido: true, valor: estado.ajustes.clave },
    ],
    onGuardar: f => {
      estado.ajustes = { url: f.url, clave: f.clave };
      estado.error = null;
      api = crearApi(estado.ajustes);
      guardar();
      sincronizarYLeer();
    },
  });
}

function irAlPrimerChoque() {
  const c = choques(vista)[0];
  if (!c) return;
  const el = document.querySelector(`[data-bloque="${c.ids[0]}"]`) || document.getElementById(`act-${c.ids[0]}`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

document.addEventListener('click', ev => {
  const nav = ev.target.closest('#navegacion button');
  if (nav) { estado.pestana = nav.dataset.pestana; pintar(); window.scrollTo(0, 0); return; }
  const el = ev.target.closest('[data-accion]');
  if (!el) return;
  const id = Number(el.dataset.id);
  if (el.dataset.id !== undefined && !Number.isFinite(id)) return; // fila todavía sin ID: se asigna al recargar
  const buscar = lista => lista.find(x => x.id === id);
  switch (el.dataset.accion) {
    case 'recargar': sincronizarYLeer(); break;
    case 'ajustes': abrirAjustes(); break;
    case 'vista-itinerario': estado.vistaItinerario = el.dataset.vista; pintar(); break;
    case 'ir-choque': irAlPrimerChoque(); break;
    case 'agregar-actividad': editarActividad(vista, null, acciones('Itinerario', null)); break;
    case 'editar-actividad': editarActividad(vista, buscar(vista.actividades), acciones('Itinerario', id)); break;
    case 'agregar-lugar': editarLugar(vista, Number(el.dataset.actividad), null, acciones('Lugares', null)); break;
    case 'editar-lugar': { const l = buscar(vista.lugares); editarLugar(vista, l.actividadId, l, acciones('Lugares', id)); break; }
    case 'hecho': { const l = buscar(vista.lugares); if (!l) break; encolar('modificar', 'Lugares', id, { 'Hecho': l.hecho ? '' : 'Si' }); break; }
    case 'agregar-costo': editarCosto(vista, null, acciones('Costos', null)); break;
    case 'editar-costo': editarCosto(vista, buscar(vista.costos), acciones('Costos', id)); break;
    case 'agregar-reserva': editarReserva(vista, null, acciones('Reservas', null)); break;
    case 'editar-reserva': editarReserva(vista, buscar(vista.reservas), acciones('Reservas', id)); break;
    case 'reintentar-op': if (!sincronizando) { estado.ops = reintentar(estado.ops, el.dataset.op); guardar(); sincronizarYLeer(); } break;
    case 'descartar-op': if (!sincronizando) { estado.ops = descartar(estado.ops, el.dataset.op); guardar(); pintar(); } break;
  }
});
document.addEventListener('change', ev => { if (ev.target.id === 'filtro-categoria') { estado.filtroCategoria = ev.target.value; pintar(); } });
document.addEventListener('input', ev => { if (ev.target.id === 'conv-monto') { estado.conversor = ev.target.value; actualizarConversor(); } });

function cargarScript(src) {
  return new Promise((ok, mal) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = ok;
    s.onerror = () => mal(new Error(`no se pudo cargar ${src}`));
    document.head.appendChild(s);
  });
}

async function crearApiDemo() {
  await cargarScript('apps-script/Logica.gs');
  await cargarScript('apps-script/PruebasLogica.gs');
  const { crearServidorFalso } = await import('./servidor-falso.js');
  const g = globalThis;
  const servidor = crearServidorFalso(g.migrarLibro(g.LIBRO_ORIGINAL, g.ENLACES_ORIGINALES, g.DATOS_EJEMPLO));
  return { leer: async () => servidor.leer(), enviar: async ops => servidor.enviar(ops) };
}

async function iniciar() {
  pintar();
  if (demo) api = await crearApiDemo();
  else if (estado.ajustes.url && estado.ajustes.clave) api = crearApi(estado.ajustes);
  if (!api) { abrirAjustes(); return; }
  window.addEventListener('online', sincronizarYLeer);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sincronizarYLeer(); });
  await sincronizarYLeer();
}

if ('serviceWorker' in navigator && !demo && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
iniciar();
