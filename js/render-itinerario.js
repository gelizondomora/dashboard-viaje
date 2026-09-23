import { diasDelItinerario, idsEnChoque } from './compute.js';
import { esc, hora, fechaLarga, marcas } from './formato.js';
import { renderTimeline } from './timeline.js';

const urlMapa = m => (/^https?:\/\//.test(m) ? m : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(m)}`);

function lugarHtml(l) {
  return `<li class="${l.hecho ? 'hecho' : ''}${l.pendiente ? ' pendiente' : ''}">
    <button class="check" data-accion="hecho" data-id="${l.id}" aria-label="Marcar como hecho">${l.hecho ? '✓' : '○'}</button>
    <span class="nombre" data-accion="editar-lugar" data-id="${l.id}">${esc(l.lugar)}${l.notas ? ` — <small>${esc(l.notas)}</small>` : ''}</span>
    ${l.mapa ? `<a href="${esc(urlMapa(l.mapa))}" target="_blank" rel="noopener">mapa</a>` : ''}${marcas(l)}
  </li>`;
}

export function tarjetaActividad(a, { choque = false } = {}) {
  const horario = a.intervalo ? `${hora(a.intervalo.ini)}–${hora(a.intervalo.fin)}` : '';
  return `<article class="actividad${a.opcional ? ' opcional' : ''}${choque ? ' en-choque' : ''}${a.pendiente ? ' pendiente' : ''}" id="act-${a.id}">
    <header><span class="franja">${esc(a.franja)}${horario ? ` · ${horario}` : ''}</span>${marcas(a)}${choque ? '<span class="alerta">⚠ choque</span>' : ''}
      <button class="icono" data-accion="editar-actividad" data-id="${a.id}" aria-label="Editar">✎</button></header>
    <h3>${esc(a.actividad)}${a.opcional ? ' <small>opcional</small>' : ''}</h3>
    ${a.lugares.length ? `<ul class="lugares">${a.lugares.map(lugarHtml).join('')}</ul>` : ''}
    <button class="enlace" data-accion="agregar-lugar" data-actividad="${a.id}">＋ lugar</button>
  </article>`;
}

export function renderItinerario(v, { vista, choques, hoy }) {
  const ids = idsEnChoque(choques);
  const boton = (valor, texto) => `<button data-accion="vista-itinerario" data-vista="${valor}" class="${vista === valor ? 'activo' : ''}">${texto}</button>`;
  const estado = choques.length
    ? `<button class="alerta" data-accion="ir-choque">⚠ ${choques.length} ${choques.length === 1 ? 'choque' : 'choques'}</button>`
    : '<span class="ok">Sin choques</span>';
  const cabecera = `<div class="barra"><div class="interruptor">${boton('lista', 'Lista')}${boton('timeline', 'Timeline')}</div>${estado}
    <span class="espacio"></span><button class="primario" data-accion="agregar-actividad">＋ actividad</button></div>`;
  if (vista === 'timeline') return cabecera + renderTimeline(v, ids);
  let ciudad = null;
  const dias = diasDelItinerario(v).map(d => {
    const separador = d.ciudad !== ciudad ? `<h2 class="ciudad">${esc(d.ciudad)}</h2>` : '';
    ciudad = d.ciudad;
    return `${separador}<section class="dia${d.fecha === hoy ? ' hoy' : ''}"><h3 class="fecha">${esc(fechaLarga(d.fecha))}</h3>`
      + `${d.actividades.map(a => tarjetaActividad(a, { choque: ids.has(a.id) })).join('')}</section>`;
  }).join('');
  const sinFecha = v.actividades.filter(a => !a.fecha)
    .map(a => tarjetaActividad({ ...a, intervalo: null, lugares: v.lugares.filter(l => l.actividadId === a.id) })).join('');
  return cabecera + dias + (sinFecha ? `<h2>Sin fecha</h2>${sinFecha}` : '');
}
