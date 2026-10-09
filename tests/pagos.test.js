import { prueba, igual, cerca, verdadero } from './t.js';
import { parsearDatos } from '../js/parse.js';
import { pagadorDe, deudas } from '../js/compute.js';
import { costoAValores } from '../js/editores.js';
import { renderCostos } from '../js/render-costos.js';
import { rawEjemplo, conValores, conFila } from './fixtures.js';

function conNombres(nombres = 'Gaga; Luis', raw = rawEjemplo()) { const r = structuredClone(raw); r.config['Nombres de personas'] = nombres; return r; }

// Vuelos 700 (50/50, pagó automático = Gaga) · Bogota Hospedaje 200 (50/50, pagó Luis)
// Comida 60 (100 % Gaga, pagó Luis) · Camisa 30 dentro de Compras (100 % Luis, pagó automático = Luis)
function escenario() {
  let raw = conValores(conNombres(), 'Costos', 1, { 'Real USD': 700 });
  raw = conValores(raw, 'Costos', 5, { 'Real USD': 200, 'Pagó': 'luis' });
  raw = conValores(raw, 'Costos', 2, { 'Real USD': 60, 'Reparto': 'Gaga=100;Luis=0', 'Pagó': 'Luis' });
  return conFila(raw, 'Costos', 17, { 'Detalle': 'Camisa', 'Real USD': 30, 'Partida ID': 4, 'Reparto': 'Gaga=0;Luis=100' });
}

prueba('pagos: quién pagó — explícito, 100 % o la persona 1', () => {
  const v = parsearDatos(escenario());
  const c = id => v.costos.find(x => x.id === id);
  igual([c(1).pago, c(5).pago], [null, 'luis']);
  igual([pagadorDe(c(1), v), pagadorDe(c(5), v), pagadorDe(c(2), v), pagadorDe(c(17), v, c(4))], ['Gaga', 'Luis', 'Luis', 'Luis']);
});
prueba('pagos: un nombre que no es de ninguna persona usa la regla automática', () => {
  const v = parsearDatos(conValores(conNombres(), 'Costos', 1, { 'Pagó': 'Pedro' }));
  igual(pagadorDe(v.costos[0], v), 'Gaga');
});
prueba('pagos: pagado, consumido y balance por persona', () => {
  const d = deudas(parsearDatos(escenario()));
  igual([d.pagado.Gaga, d.pagado.Luis, d.consumo.Gaga, d.consumo.Luis], [700, 290, 510, 480]);
  igual([d.balance.Gaga, d.balance.Luis], [190, -190]);
});
prueba('pagos: la matriz compensa las deudas entre cada par', () => {
  const d = deudas(parsearDatos(escenario()));
  igual([d.matriz.Luis.Gaga, d.matriz.Gaga.Luis], [190, 0]);
  igual(d.transferencias, [{ de: 'Luis', a: 'Gaga', usd: 190 }]);
});
prueba('pagos: con tres personas, la lista mínima de pagos', () => {
  const v = parsearDatos(conValores(conNombres('A; B; C'), 'Costos', 1, { 'Real USD': 300 }));
  const d = deudas(v);
  igual([d.matriz.B.A, d.matriz.C.A, d.matriz.A.B].map(Math.round), [100, 100, 0]);
  igual(d.transferencias.map(t => [t.de, t.a, Math.round(t.usd)]), [['B', 'A', 100], ['C', 'A', 100]]);
});
prueba('pagos: sin gastos reales no hay deudas', () => {
  const d = deudas(parsearDatos(conNombres()));
  igual([d.transferencias, d.balance.Gaga], [[], 0]);
});
prueba('pagos: el editor guarda "Pagó" solo si no es automático', () => {
  const base = { detalle: 'X', categoria: 'Otros', fecha: '', efectivo: false, presupuesto: { cantidad: '', moneda: 'USD' }, real: { cantidad: 1, moneda: 'USD' } };
  igual(costoAValores({ ...base, pago: 'Luis' }, 'CRC')['Pagó'], 'Luis');
  igual('Pagó' in costoAValores({ ...base, pago: '' }, 'CRC'), false);
  igual(costoAValores({ ...base, pago: '' }, 'CRC', { conPago: true })['Pagó'], '');
});
prueba('pagos: Costos muestra quién pagó y las cuentas entre personas', () => {
  const html = renderCostos(parsearDatos(escenario()), { filtro: '' });
  for (const s of ['Cuentas entre personas', 'Luis le paga', '$190.00', 'pagó Gaga', 'pagó Luis', 'class="matriz"']) verdadero(html.includes(s), `falta ${s}`);
});
