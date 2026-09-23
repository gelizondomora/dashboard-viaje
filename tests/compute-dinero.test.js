import { prueba, igual, cerca } from './t.js';
import { parsearDatos } from '../js/parse.js';
import { totales, efectivoRestante, porCategoria, acumuladoPorDia, convertir } from '../js/compute.js';
import { rawEjemplo, conValores } from './fixtures.js';

const viaje = (raw = rawEjemplo()) => parsearDatos(raw);

prueba('dinero: totales sin reales', () => {
  const t = totales(viaje());
  cerca(t.presupuesto.usd, 2854.59, 0.01);
  cerca(t.presupuesto.casa, 1298836.3, 1);
  igual([t.real.usd, t.conReal, t.pendientes], [0, 0, 16]);
  cerca(t.porPersona.presupuesto.usd, 1427.29, 0.01);
});
prueba('dinero: la diferencia usa solo filas con real', () => {
  const t = totales(viaje(conValores(rawEjemplo(), 'Costos', 1, { 'Real USD': 700 })));
  cerca(t.diferencia.usd, 3.08, 0.001);
  igual(t.conReal, 1);
});
prueba('dinero: efectivo restante = $50.38', () => {
  const e = efectivoRestante(viaje());
  cerca(e.usd, 50.38, 0.001);
  cerca(e.casa, 22922.9, 0.1);
  cerca(e.gastadoUsd, 149.62, 0.001);
});
prueba('dinero: el efectivo usa el real cuando existe', () => {
  cerca(efectivoRestante(viaje(conValores(rawEjemplo(), 'Costos', 11, { 'Real USD': 35 }))).usd, 45.76, 0.001);
});
prueba('dinero: presupuesto por categoría', () => {
  const c = porCategoria(viaje());
  igual(c.map(x => x.categoria), ['Transporte', 'Hospedaje', 'Comida', 'Tours', 'Compras']);
  [987.96, 853.04, 329.67, 249.3, 434.62].forEach((n, i) => cerca(c[i].presupuestoUsd, n, 0.01));
});
prueba('dinero: acumulado por día', () => {
  let raw = conValores(rawEjemplo(), 'Costos', 1, { 'Fecha': '2026-09-27' });
  raw = conValores(raw, 'Costos', 10, { 'Fecha': '2026-09-29', 'Real USD': 40 });
  const a = acumuladoPorDia(viaje(raw));
  igual([a.dias, a.real, a.sinFecha], [['2026-09-27', '2026-09-29'], [0, 40], 14]);
  cerca(a.planeado[1], 736.52, 0.001);
});
prueba('dinero: conversor COP → USD y CRC', () => {
  const r = convertir(85000, viaje());
  cerca(r.usd, 26.35, 0.001);
  cerca(r.casa, 11900, 0.001);
});
