import { totales, costosAgrupados } from './compute.js';
import { esc, dinero, fechaCorta, marcas } from './formato.js';
import { graficosHtml } from './charts.js';

function filaGasto(c, { hijo = false } = {}) {
  return `<li class="gasto${hijo ? ' hijo' : ''}${c.pendiente ? ' pendiente' : ''}" data-accion="editar-costo" data-id="${c.id}">
      <div><strong>${esc(c.detalle)}</strong>${marcas(c)}<small>${hijo ? '' : esc(c.categoria)}${c.fecha ? `${hijo ? '' : ' · '}${esc(fechaCorta(c.fecha))}` : ''}${c.efectivo ? ' · efectivo' : ''}</small></div>
      <div class="montos"><span>${c.real ? (hijo ? dinero(c.real.cantidad, c.real.moneda) : dinero(c.real.usd, 'USD')) : '<em>sin real</em>'}</span>${hijo ? '' : `<small>plan ${c.presupuesto ? dinero(c.presupuesto.usd, 'USD') : '—'}</small>`}</div>
    </li>`;
}

// Partida con gastos hijos: avance del presupuesto y lista desplegable de sus gastos.
function filaPartida(g, abierta) {
  const c = g.costo;
  const moneda = c.presupuesto.moneda;
  const en = m => (moneda === 'USD' ? m.usd : m.casa);
  const gastado = g.real ? en(g.real) : 0;
  const total = en(c.presupuesto);
  const queda = en(g.restante);
  const pct = total > 0 ? Math.min(100, (gastado / total) * 100) : 100;
  const estado = queda >= 0 ? `quedan ${dinero(queda, moneda)}` : `excedido por ${dinero(-queda, moneda)}`;
  return `<li class="partida${queda < 0 ? ' excedida' : ''}">
    <div class="gasto${c.pendiente ? ' pendiente' : ''}" data-accion="editar-costo" data-id="${c.id}">
      <div><strong>${esc(c.detalle)}</strong>${marcas(c)}<small>${esc(c.categoria)}${c.efectivo ? ' · efectivo' : ''}</small></div>
      <div class="montos"><span>${dinero(gastado, moneda)}</span><small>de ${dinero(total, moneda)}</small></div>
    </div>
    <div class="barra-avance"><span style="width:${pct}%"></span></div>
    <p class="nota">${estado}</p>
    <details data-partida="${c.id}"${abierta ? ' open' : ''}>
      <summary>${g.hijos.length} ${g.hijos.length === 1 ? 'gasto' : 'gastos'}</summary>
      <ul class="lista-gastos">${g.hijos.map(h => filaGasto(h, { hijo: true })).join('')}</ul>
      <button class="enlace" data-accion="agregar-en-partida" data-id="${c.id}">＋ gasto en esta partida</button>
    </details>
  </li>`;
}

export function renderCostos(v, { filtro, abiertas = new Set() }) {
  const t = totales(v);
  const casa = v.monedaCasa;
  const kpi = (titulo, m, extra = '') => `<div class="kpi"><span>${titulo}</span><strong>${dinero(m.usd, 'USD')}</strong><small>${dinero(m.casa, casa)}${extra}</small></div>`;
  const kpis = `<section class="kpis">
    ${kpi('Presupuesto', t.presupuesto)}
    ${kpi('Real', t.real, ` · ${t.conReal} con monto real`)}
    ${kpi('Diferencia', t.diferencia, t.conReal ? ' · solo gastos con real' : ' · aún sin reales')}
    ${kpi('Por persona', t.porPersona.presupuesto, ' · presupuesto')}
  </section>`;
  const categorias = [...new Set(v.costos.map(c => c.categoria))];
  const lista = costosAgrupados(v)
    .filter(g => !filtro || g.costo.categoria === filtro)
    .map(g => (g.hijos.length && g.costo.presupuesto ? filaPartida(g, abiertas.has(g.costo.id))
      : filaGasto(g.costo) + g.hijos.map(h => filaGasto(h, { hijo: true })).join('')))
    .join('');
  const conError = v.costos.filter(c => c.error && (!filtro || c.categoria === filtro)).map(c => filaGasto(c)).join('');
  return kpis + graficosHtml() + `<section class="tarjeta"><div class="barra"><h2>Gastos</h2>
      <select id="filtro-categoria"><option value="">Todas</option>${categorias.map(c => `<option${c === filtro ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <button class="primario" data-accion="agregar-costo">＋ gasto</button></div>
    <ul class="lista-gastos">${lista}${conError}</ul></section>`;
}
