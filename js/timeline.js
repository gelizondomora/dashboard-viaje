import { diasDelItinerario } from './compute.js';
import { esc, hora, fechaCorta } from './formato.js';

const INICIO = 360, FIN = 1440, ALTO = 2.2;

export function asignarCarriles(bloques) {
  const finCarril = [];
  return bloques.map(b => {
    let c = finCarril.findIndex(f => f <= b.ini);
    if (c < 0) { c = finCarril.length; finCarril.push(0); }
    finCarril[c] = b.fin;
    return c;
  });
}

export function renderTimeline(v, idsChoque) {
  const colores = new Map();
  const color = c => { if (!colores.has(c)) colores.set(c, colores.size % 4); return colores.get(c); };
  const pct = m => ((Math.min(Math.max(m, INICIO), FIN) - INICIO) / (FIN - INICIO)) * 100;
  const horas = [6, 9, 12, 15, 18, 21, 24].map(h => `<span style="left:${pct(h * 60)}%">${h}</span>`).join('');
  const sinHorario = [];
  const filas = diasDelItinerario(v).map(d => {
    sinHorario.push(...d.actividades.filter(a => !a.intervalo));
    const orden = d.actividades.filter(a => a.intervalo).sort((a, b) => a.intervalo.ini - b.intervalo.ini);
    const carriles = asignarCarriles(orden.map(a => a.intervalo));
    const n = Math.max(1, ...carriles.map(c => c + 1));
    const bloques = orden.map((a, i) => {
      const choque = idsChoque.has(a.id);
      const izq = pct(a.intervalo.ini), ancho = pct(a.intervalo.fin) - izq;
      return `<button class="bloque c${color(a.ciudad)}${a.opcional ? ' opcional' : ''}${choque ? ' en-choque' : ''}" data-accion="editar-actividad" data-id="${a.id}" data-bloque="${a.id}"`
        + ` style="left:${izq}%;width:${ancho}%;top:${carriles[i] * ALTO}rem" title="${esc(a.actividad)} ${hora(a.intervalo.ini)}–${hora(a.intervalo.fin)}">${choque ? '⚠ ' : ''}${esc(a.actividad)}</button>`;
    }).join('');
    const reservas = v.reservas
      .filter(r => r.fecha === d.fecha && r.hora !== null && !v.actividades.some(a => a.id === r.actividadId))
      .map(r => `<span class="marca-reserva" style="left:${pct(r.hora)}%" title="${esc(r.tour)} ${hora(r.hora)}">◆</span>`).join('');
    return `<div class="tl-dia"><div class="tl-fecha">${esc(fechaCorta(d.fecha))}<small>${esc(d.ciudad)}</small></div>`
      + `<div class="tl-pista" style="height:${n * ALTO}rem">${bloques}${reservas}</div></div>`;
  }).join('');
  const leyenda = [...colores.entries()].map(([c, i]) => `<span class="ley c${i}">${esc(c)}</span>`).join('');
  const sin = sinHorario.length
    ? `<h3>Sin horario</h3><ul>${sinHorario.map(a => `<li>${esc(fechaCorta(a.fecha))} · ${esc(a.actividad)}</li>`).join('')}</ul>`
    : '';
  return `<div class="timeline"><div class="tl-horas">${horas}</div>${filas}<div class="tl-leyenda">${leyenda}</div>${sin}</div>`;
}
