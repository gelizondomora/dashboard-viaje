import { esc, hora, fechaLarga, marcas, urlSegura } from './formato.js';

export function tarjetaReserva(r, { editable = false } = {}) {
  return `<article class="reserva${r.pendiente ? ' pendiente' : ''}">
    <header><span class="franja">${r.fecha ? esc(fechaLarga(r.fecha)) : 'Sin fecha'}${r.hora !== null ? ` · ${hora(r.hora)}` : ''}</span>${marcas(r)}
      ${editable ? `<button class="icono" data-accion="editar-reserva" data-id="${r.id}" aria-label="Editar">✎</button>` : ''}</header>
    <h3>🎟 ${esc(r.tour)}</h3>
    ${r.recogida ? `<p>Recogida: ${esc(r.recogida)}</p>` : ''}
    ${urlSegura(r.enlace) ? `<a class="boton" href="${esc(urlSegura(r.enlace))}" target="_blank" rel="noopener">Abrir reserva</a>` : ''}
  </article>`;
}

export function renderReservas(v) {
  const lista = v.reservas.slice().sort((a, b) => (a.fecha || '9999').localeCompare(b.fecha || '9999') || (a.hora ?? 1e4) - (b.hora ?? 1e4));
  return `<div class="barra"><h2>Reservas</h2><button class="primario" data-accion="agregar-reserva">＋ reserva</button></div>`
    + (lista.length ? lista.map(r => tarjetaReserva(r, { editable: true })).join('') : '<p class="vacio">Sin reservas.</p>');
}
