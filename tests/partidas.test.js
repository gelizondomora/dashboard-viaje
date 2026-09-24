import { prueba, igual, cerca, verdadero } from './t.js';
import { parsearDatos } from '../js/parse.js';
import { costosAgrupados, totales, porCategoria, efectivoRestante } from '../js/compute.js';
import { costoAValores } from '../js/editores.js';
import { renderCostos } from '../js/render-costos.js';
import { rawEjemplo, conFila } from './fixtures.js';

// Compras (ID 4, presupuesto ₡175.000) con dos compras hijas.
function conCompras() {
  let raw = conFila(rawEjemplo(), 'Costos', 17, { 'Detalle': 'Camisa', 'Real CRC': 30000, 'Partida ID': 4 });
  return conFila(raw, 'Costos', 18, { 'Detalle': 'Zapatos', 'Real CRC': 32000, 'Partida ID': 4, 'Efectivo?': 'Si' });
}

prueba('partidas: se lee la partida de cada gasto', () => {
  const v = parsearDatos(conCompras());
  igual([v.costos.find(c => c.id === 17).partidaId, v.costos.find(c => c.id === 1).partidaId], [4, null]);
});
prueba('partidas: agrupa los hijos bajo su partida con lo gastado y lo que queda', () => {
  const g = costosAgrupados(parsearDatos(conCompras()));
  igual(g.length, 16);
  const compras = g.find(x => x.costo.id === 4);
  igual(compras.hijos.map(h => h.id), [17, 18]);
  cerca(compras.real.casa, 62000, 0.01);
  cerca(compras.restante.casa, 113000, 0.01);
});
prueba('partidas: un gasto con partida inexistente queda suelto', () => {
  const g = costosAgrupados(parsearDatos(conFila(rawEjemplo(), 'Costos', 17, { 'Detalle': 'X', 'Real USD': 5, 'Partida ID': 99 })));
  igual(g.length, 17);
});
prueba('partidas: totales sin doble conteo del presupuesto', () => {
  const t = totales(parsearDatos(conCompras()));
  cerca(t.presupuesto.casa, 1298836.3, 1);
  cerca(t.real.casa, 62000, 0.01);
  cerca(t.diferencia.casa, -113000, 0.01);
  igual([t.conReal, t.pendientes], [1, 15]);
});
prueba('partidas: los hijos cuentan en la categoría de su partida', () => {
  const c = porCategoria(parsearDatos(conCompras())).find(x => x.categoria === 'Compras');
  cerca(c.realUsd, 62000 / 455, 0.01);
  cerca(c.presupuestoUsd, 434.62, 0.01);
});
prueba('partidas: efectivo disponible resta los hijos pagados en efectivo', () => {
  cerca(efectivoRestante(parsearDatos(conCompras())).gastadoUsd, 32000 / 455, 0.01);
});
prueba('partidas: gastar dentro del presupuesto no cambia el pronóstico', () => {
  const raw = conFila(rawEjemplo(), 'Costos', 17, { 'Detalle': 'Recuerdo', 'Real USD': 20, 'Partida ID': 9, 'Efectivo?': 'Si' });
  const e = efectivoRestante(parsearDatos(raw));
  cerca(e.usd, 180, 0.001);
  cerca(e.pronosticadoUsd, 50.38, 0.001);
  cerca(e.comprometidoUsd, 129.62, 0.001);
});
prueba('partidas: pasarse del presupuesto baja el pronóstico', () => {
  const raw = conFila(rawEjemplo(), 'Costos', 17, { 'Detalle': 'Recuerdo', 'Real USD': 70, 'Partida ID': 9, 'Efectivo?': 'Si' });
  cerca(efectivoRestante(parsearDatos(raw)).pronosticadoUsd, 30.38, 0.001);
});
prueba('partidas: el editor escribe la partida solo cuando corresponde', () => {
  const base = { detalle: 'Camisa', categoria: 'Compras', fecha: '', efectivo: false, presupuesto: { cantidad: '', moneda: 'USD' }, real: { cantidad: 30, moneda: 'USD' } };
  igual(costoAValores({ ...base, partida: '4' }, 'CRC')['Partida ID'], 4);
  igual('Partida ID' in costoAValores({ ...base, partida: '' }, 'CRC'), false);
  igual(costoAValores({ ...base, partida: '' }, 'CRC', { conPartida: true })['Partida ID'], '');
});
prueba('partidas: Costos muestra avance, hijos y botón para agregar', () => {
  const html = renderCostos(parsearDatos(conCompras()), { filtro: '', abiertas: new Set([4]) });
  for (const s of ['quedan ₡113,000', 'Camisa', 'Zapatos', 'data-accion="agregar-en-partida" data-id="4"']) verdadero(html.includes(s), `falta ${s}`);
  igual((html.match(/data-accion="editar-costo"/g) || []).length, 18);
});
