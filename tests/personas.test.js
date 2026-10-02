import { prueba, igual, cerca, verdadero } from './t.js';
import { parsearDatos } from '../js/parse.js';
import { repartoDe, porPersona, acumuladoPorDia, efectivoRestante } from '../js/compute.js';
import { crearOp, aplicarPendientes, sincronizar } from '../js/queue.js';
import { repartoATexto, costoAValores } from '../js/editores.js';
import { renderCostos } from '../js/render-costos.js';
import { renderHoy } from '../js/render-hoy.js';
import { rawEjemplo, servidorEjemplo, conValores, conFila } from './fixtures.js';

function conNombres(raw = rawEjemplo()) { const r = structuredClone(raw); r.config['Nombres de personas'] = 'Ana; Luis'; return r; }
const persona = (lista, n) => lista.find(p => p.nombre === n);

prueba('personas: nombres desde Config, o genéricos si no hay', () => {
  igual(parsearDatos(rawEjemplo()).personasNombres, ['Persona 1', 'Persona 2']);
  const v = parsearDatos(conNombres());
  igual([v.personasNombres, v.personas], [['Ana', 'Luis'], 2]);
});
prueba('personas: sin reparto se divide en partes iguales', () => {
  const v = parsearDatos(conNombres());
  igual(repartoDe(v.costos[0], v), { Ana: 0.5, Luis: 0.5 });
  const p = porPersona(v);
  cerca(persona(p, 'Ana').presupuestoUsd, 2854.585 / 2, 0.01);
  cerca(persona(p, 'Luis').presupuestoUsd, 2854.585 / 2, 0.01);
});
prueba('personas: reparto 100/0 en un gasto', () => {
  const v = parsearDatos(conValores(conNombres(), 'Costos', 1, { 'Reparto': 'ana=100; Luis=0', 'Real USD': 700 }));
  igual(v.costos[0].reparto, { ana: 100, Luis: 0 });
  igual(repartoDe(v.costos[0], v), { Ana: 1, Luis: 0 });
  const p = porPersona(v);
  cerca(persona(p, 'Ana').presupuestoUsd, 696.92 + (2854.585 - 696.92) / 2, 0.01);
  igual([persona(p, 'Ana').realUsd, persona(p, 'Luis').realUsd], [700, 0]);
  cerca(persona(p, 'Ana').categorias.Transporte.realUsd, 700, 0.001);
});
prueba('personas: un gasto hijo hereda el reparto de su partida', () => {
  let raw = conValores(conNombres(), 'Costos', 9, { 'Reparto': 'Ana=0;Luis=100' });
  raw = conFila(raw, 'Costos', 17, { 'Detalle': 'Recuerdo', 'Real USD': 20, 'Partida ID': 9 });
  raw = conFila(raw, 'Costos', 18, { 'Detalle': 'Llavero', 'Real USD': 10, 'Partida ID': 9, 'Reparto': 'Ana=100;Luis=0' });
  const p = porPersona(parsearDatos(raw));
  igual([persona(p, 'Ana').realUsd, persona(p, 'Luis').realUsd], [10, 20]);
});
prueba('acumulado: real día a día contra el presupuesto total, en todos los días del viaje', () => {
  let raw = conValores(rawEjemplo(), 'Costos', 1, { 'Fecha': '2026-09-27', 'Real USD': 700 });
  raw = conValores(raw, 'Costos', 10, { 'Fecha': '2026-09-29', 'Real USD': 40 });
  raw = conValores(raw, 'Costos', 2, { 'Real USD': 5 });
  const a = acumuladoPorDia(parsearDatos(raw));
  igual([a.dias.length, a.dias[0], a.dias[9]], [10, '2026-09-27', '2026-10-06']);
  igual(a.real.slice(0, 4), [700, 700, 740, 740]);
  igual(a.real[9], 740);
  cerca(a.presupuesto[0], 2854.585, 0.01);
  cerca(a.presupuesto[9], 2854.585, 0.01);
  igual(a.sinFecha, 1);
});
prueba('config: el efectivo inicial se cambia desde la app', async () => {
  const s = servidorEjemplo();
  const op = crearOp('config', 'Config', { valores: { 'Efectivo inicial (USD)': 300 } }, () => 'c');
  const v = parsearDatos(aplicarPendientes(s.leer(), [op]));
  igual([v.efectivoInicialUsd, efectivoRestante(v).usd], [300, 300]);
  const r = await sincronizar([op], async x => s.enviar(x));
  igual([r.ops, parsearDatos(s.leer()).efectivoInicialUsd], [[], 300]);
});
prueba('editor: el reparto igualitario no se escribe; el desigual sí', () => {
  igual(repartoATexto([50, 50], ['Ana', 'Luis']), '');
  igual(repartoATexto([100, 0], ['Ana', 'Luis']), 'Ana=100;Luis=0');
  const base = { detalle: 'X', categoria: 'Otros', fecha: '', efectivo: false, presupuesto: { cantidad: '', moneda: 'USD' }, real: { cantidad: 1, moneda: 'USD' } };
  igual('Reparto' in costoAValores({ ...base, reparto: '' }, 'CRC'), false);
  igual(costoAValores({ ...base, reparto: 'Ana=100;Luis=0' }, 'CRC').Reparto, 'Ana=100;Luis=0');
  igual(costoAValores({ ...base, reparto: '' }, 'CRC', { conReparto: true }).Reparto, '');
});
prueba('render: Costos muestra la sección por persona y Hoy permite editar el efectivo', () => {
  const v = parsearDatos(conNombres());
  const c = renderCostos(v, { filtro: '' });
  for (const s of ['Por persona', 'Ana', 'Luis', 'id="g-personas"', 'id="g-personas-cat"', 'data-accion="editar-personas"']) verdadero(c.includes(s), `falta ${s}`);
  verdadero(renderHoy(v, { hoy: '2026-09-29' }).includes('data-accion="editar-efectivo"'), 'falta editar efectivo');
});
