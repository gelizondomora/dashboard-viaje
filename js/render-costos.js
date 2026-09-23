import { totales } from './compute.js';
import { esc, dinero, fechaCorta, marcas } from './formato.js';

export function renderCostos(v, { filtro }) {
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
  const lista = v.costos.filter(c => !filtro || c.categoria === filtro).map(c => `
    <li class="gasto${c.pendiente ? ' pendiente' : ''}" data-accion="editar-costo" data-id="${c.id}">
      <div><strong>${esc(c.detalle)}</strong>${marcas(c)}<small>${esc(c.categoria)}${c.fecha ? ` · ${esc(fechaCorta(c.fecha))}` : ''}${c.efectivo ? ' · efectivo' : ''}</small></div>
      <div class="montos"><span>${c.real ? dinero(c.real.usd, 'USD') : '<em>sin real</em>'}</span><small>plan ${c.presupuesto ? dinero(c.presupuesto.usd, 'USD') : '—'}</small></div>
    </li>`).join('');
  return kpis + `<section class="tarjeta"><div class="barra"><h2>Gastos</h2>
      <select id="filtro-categoria"><option value="">Todas</option>${categorias.map(c => `<option${c === filtro ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <button class="primario" data-accion="agregar-costo">＋ gasto</button></div>
    <ul class="lista-gastos">${lista}</ul></section>`;
}
