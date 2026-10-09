import { totales, costosAgrupados, porPersona, pagadorDe, deudas } from './compute.js';
import { esc, dinero, fechaCorta, marcas } from './formato.js';
import { graficosHtml } from './charts.js';

function filaGasto(c, { hijo = false, extra = '' } = {}) {
  return `<li class="gasto${hijo ? ' hijo' : ''}${c.pendiente ? ' pendiente' : ''}" data-accion="editar-costo" data-id="${c.id}">
      <div><strong>${esc(c.detalle)}</strong>${marcas(c)}<small>${[hijo ? '' : esc(c.categoria), c.fecha ? esc(fechaCorta(c.fecha)) : '', c.efectivo ? 'efectivo' : '', extra].filter(Boolean).join(' · ')}</small></div>
      <div class="montos"><span>${c.real ? (hijo ? dinero(c.real.cantidad, c.real.moneda) : dinero(c.real.usd, 'USD')) : '<em>sin real</em>'}</span>${hijo ? '' : `<small>plan ${c.presupuesto ? dinero(c.presupuesto.usd, 'USD') : '—'}</small>`}</div>
    </li>`;
}

// Partida con gastos hijos: avance del presupuesto y lista desplegable de sus gastos.
function filaPartida(g, abierta, pago) {
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
      <ul class="lista-gastos">${g.hijos.map(h => filaGasto(h, { hijo: true, extra: pago(h, c) })).join('')}</ul>
      <button class="enlace" data-accion="agregar-en-partida" data-id="${c.id}">＋ gasto en esta partida</button>
    </details>
  </li>`;
}

// Quién le debe a quién, con lo realmente pagado: pagos para quedar a mano, matriz neta y balance por persona.
function cuentasHtml(v) {
  const d = deudas(v);
  const nombres = v.personasNombres;
  const doble = usd => `${dinero(usd, 'USD')} <small>${dinero(usd * v.tasas.usdCasa, v.monedaCasa)}</small>`;
  const pagos = d.transferencias.length
    ? d.transferencias.map(t => `<li><strong>${esc(t.de)} le paga ${dinero(t.usd, 'USD')} a ${esc(t.a)}</strong> · ${dinero(t.usd * v.tasas.usdCasa, v.monedaCasa)}</li>`).join('')
    : '<li>Están a mano.</li>';
  const matriz = `<div class="tabla-desplazable"><table class="matriz"><thead><tr><th>Debe ↓ · a →</th>${nombres.map(n => `<th>${esc(n)}</th>`).join('')}</tr></thead><tbody>`
    + nombres.map(a => `<tr><th>${esc(a)}</th>${nombres.map(b => `<td>${a === b ? '—' : d.matriz[a][b] > 0.005 ? doble(d.matriz[a][b]) : '·'}</td>`).join('')}</tr>`).join('')
    + '</tbody></table></div>';
  const balance = nombres.map(n => `<li>${esc(n)}: pagó ${dinero(d.pagado[n], 'USD')} · le corresponde ${dinero(d.consumo[n], 'USD')} · <strong class="${d.balance[n] < -0.005 ? 'negativo' : ''}">${d.balance[n] >= 0 ? '+' : ''}${dinero(d.balance[n], 'USD')}</strong></li>`).join('');
  return `<section class="tarjeta"><h2>Cuentas entre personas</h2>
    <ul class="pagos">${pagos}</ul>
    ${matriz}
    <ul class="balances">${balance}</ul>
    <p class="nota">Solo cuentan los montos reales. Cada fila de la matriz es lo que esa persona le debe a la de la columna, ya compensado entre las dos.</p></section>`;
}

export function renderCostos(v, { filtro, abiertas = new Set() }) {
  const t = totales(v);
  const casa = v.monedaCasa;
  const variasPersonas = v.personasNombres.length > 1;
  const pago = (c, partida = null) => (variasPersonas && c.real ? `pagó ${esc(pagadorDe(c, v, partida))}` : '');
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
    .map(g => (g.hijos.length && g.costo.presupuesto ? filaPartida(g, abiertas.has(g.costo.id), pago)
      : filaGasto(g.costo, { extra: pago(g.costo) }) + g.hijos.map(h => filaGasto(h, { hijo: true, extra: pago(h, g.costo) })).join('')))
    .join('');
  const conError = v.costos.filter(c => c.error && (!filtro || c.categoria === filtro)).map(c => filaGasto(c)).join('');
  const personas = porPersona(v).map(p => `<li class="gasto"><div><strong>${esc(p.nombre)}</strong><small>presupuesto ${dinero(p.presupuestoUsd, 'USD')} · ${dinero(p.presupuestoUsd * v.tasas.usdCasa, casa)}</small></div>
      <div class="montos"><span>${dinero(p.realUsd, 'USD')}</span><small>real · ${dinero(p.realUsd * v.tasas.usdCasa, casa)}</small></div></li>`).join('');
  const porPersonaHtml = `<section class="tarjeta"><div class="barra"><h2>Por persona</h2><button class="enlace" data-accion="editar-personas">👥 Personas</button></div>
    <ul class="lista-gastos sin-accion">${personas}</ul>
    <p class="nota">Cada gasto se reparte en partes iguales, salvo que le asignes otro porcentaje al editarlo.</p></section>`;
  return kpis + porPersonaHtml + (variasPersonas ? cuentasHtml(v) : '') + graficosHtml() + `<section class="tarjeta"><div class="barra"><h2>Gastos</h2>
      <select id="filtro-categoria"><option value="">Todas</option>${categorias.map(c => `<option${c === filtro ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <button class="primario" data-accion="agregar-costo">＋ gasto</button></div>
    <ul class="lista-gastos">${lista}${conError}</ul></section>`;
}
