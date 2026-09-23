import { estadoViaje, efectivoRestante, totales, actividadesDelDia, reservasDelDia } from './compute.js';
import { esc, dinero, fechaLarga } from './formato.js';
import { tarjetaActividad } from './render-itinerario.js';
import { tarjetaReserva } from './render-reservas.js';

export function renderHoy(v, { hoy }) {
  const est = estadoViaje(v, hoy);
  const ef = efectivoRestante(v);
  const partes = [];
  if (est.fase === 'antes') {
    partes.push(`<section class="tarjeta destacada"><p class="grande">Faltan ${est.faltan} ${est.faltan === 1 ? 'día' : 'días'}</p><p>El viaje empieza el ${esc(fechaLarga(est.inicio))}.</p></section>`);
  }
  if (est.fase === 'despues') {
    const t = totales(v);
    partes.push(`<section class="tarjeta destacada"><p class="grande">Viaje terminado</p><p>Gasto real: ${dinero(t.real.usd, 'USD')} · ${dinero(t.real.casa, v.monedaCasa)}</p></section>`);
  }
  if (est.dia) {
    const titulo = est.fase === 'antes' ? `Primer día · ${fechaLarga(est.dia)}` : `Hoy · ${fechaLarga(est.dia)}`;
    const acts = actividadesDelDia(v, est.dia);
    partes.push(`<h2>${esc(titulo)}</h2>`
      + reservasDelDia(v, est.dia).map(r => tarjetaReserva(r)).join('')
      + (acts.length ? acts.map(a => tarjetaActividad(a)).join('') : '<p class="vacio">Nada planeado para este día.</p>'));
  }
  partes.push(`<section class="tarjeta"><h2>Efectivo disponible</h2><p class="grande${ef.usd < 0 ? ' negativo' : ''}">${dinero(ef.usd, 'USD')}</p>`
    + `<p>${dinero(ef.casa, v.monedaCasa)} · pagado ${dinero(ef.gastadoUsd, 'USD')} de ${dinero(v.efectivoInicialUsd, 'USD')}</p>`
    + `<p class="nota${ef.pronosticadoUsd < 0 ? ' negativo' : ''}">Balance pronosticado: ${dinero(ef.pronosticadoUsd, 'USD')} · ${dinero(ef.pronosticadoCasa, v.monedaCasa)}`
    + ` (faltan por pagar ${dinero(ef.comprometidoUsd, 'USD')})</p></section>`);
  partes.push(`<section class="tarjeta"><h2>Conversor</h2><label class="campo" for="conv-monto"><span>Monto en ${esc(v.monedaLocal)}</span>`
    + `<input id="conv-monto" type="number" inputmode="decimal" step="any" placeholder="85000"></label><p id="conv-resultado" class="grande">—</p></section>`);
  return partes.join('');
}
