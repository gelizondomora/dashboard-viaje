import { prueba, igual } from './t.js';
import { parsearDatos } from '../js/parse.js';
import { crearOp, idTemporal, aplicarPendientes, consolidar, sincronizar, aplicarReemplazos, reintentar, descartar } from '../js/queue.js';
import { rawEjemplo, servidorEjemplo, conFila } from './fixtures.js';

const fijo = id => () => id;
const cena = { 'Fechas': '2026-10-01', 'Tiempo': 'Noche', 'Ciudad': 'Medellin', 'Actividad': 'Cena' };

prueba('cola: agregar se ve al instante marcado pendiente', () => {
  const raw = rawEjemplo();
  const op = crearOp('agregar', 'Costos', { id: idTemporal(raw, []), valores: { 'Detalle': 'Taxi', 'Real USD': 12 } }, fijo('a'));
  const v = parsearDatos(aplicarPendientes(raw, [op]));
  const c = v.costos.at(-1);
  igual([v.costos.length, c.id, c.detalle, c.pendiente, c.real.usd], [17, -1, 'Taxi', true, 12]);
});
prueba('cola: eliminar una actividad oculta sus lugares y desvincula reservas', () => {
  const raw = conFila(rawEjemplo(), 'Lugares', 1, { 'Actividad ID': 8, 'Lugar': 'X' });
  const v = parsearDatos(aplicarPendientes(raw, [crearOp('eliminar', 'Itinerario', { id: 8 }, fijo('e'))]));
  igual([v.actividades.some(a => a.id === 8), v.lugares.length, v.reservas.find(r => r.id === 1).actividadId], [false, 0, null]);
});
prueba('cola: una operación con error sigue visible con ⚠', () => {
  const op = { ...crearOp('eliminar', 'Costos', { id: 3 }, fijo('e')), estado: 'error', error: 'no existe' };
  const c = parsearDatos(aplicarPendientes(rawEjemplo(), [op])).costos.find(x => x.id === 3);
  igual([c.pendiente, c.errorSync], [false, 'no existe']);
});
prueba('cola: sincronizar envía en orden y consolida', async () => {
  const s = servidorEjemplo();
  const raw = s.leer();
  const ops = [
    crearOp('agregar', 'Costos', { id: -1, valores: { 'Detalle': 'Taxi', 'Real USD': 12 } }, fijo('a')),
    crearOp('modificar', 'Costos', { id: 2, valores: { 'Real CRC': 140000 } }, fijo('b')),
  ];
  const r = await sincronizar(ops, async x => s.enviar(x));
  igual([r.ops, r.reemplazos, r.enviado], [[], [{ tabla: 'Costos', temp: -1, real: 17 }], true]);
  const v = parsearDatos(consolidar(raw, r.confirmadas));
  igual([v.costos.find(c => c.id === 17).detalle, v.costos.find(c => c.id === 2).real.casa, v.costos.some(c => c.pendiente)], ['Taxi', 140000, false]);
  igual(s.libro.Costos.length, 18);
});
prueba('cola: reintentar después de perder la respuesta no duplica', async () => {
  const s = servidorEjemplo();
  const ops = [crearOp('agregar', 'Costos', { id: -1, valores: { 'Detalle': 'Taxi' } }, fijo('a'))];
  s.fallarDespues = true;
  let mensaje = null;
  try { await sincronizar(ops, async x => s.enviar(x)); } catch (e) { mensaje = e.message; }
  igual(mensaje, 'respuesta perdida');
  const r = await sincronizar(ops, async x => s.enviar(x));
  igual([r.ops, s.libro.Costos.filter(f => f[1] === 'Taxi').length], [[], 1]);
});
prueba('cola: ID temporal dentro del mismo lote', async () => {
  const s = servidorEjemplo();
  await sincronizar([
    crearOp('agregar', 'Itinerario', { id: -1, valores: cena }, fijo('a')),
    crearOp('agregar', 'Lugares', { id: -2, valores: { 'Actividad ID': -1, 'Lugar': 'Carmen' } }, fijo('b')),
  ], async x => s.enviar(x));
  igual(s.libro.Lugares[1].slice(0, 3), [1, 14, 'Carmen']);
});
prueba('cola: ID temporal en operaciones creadas durante el envío', async () => {
  const s = servidorEjemplo();
  const r = await sincronizar([crearOp('agregar', 'Itinerario', { id: -1, valores: cena }, fijo('a'))], async x => s.enviar(x));
  const [b] = aplicarReemplazos([crearOp('agregar', 'Lugares', { id: -2, valores: { 'Actividad ID': -1, 'Lugar': 'Carmen' } }, fijo('b'))], r.reemplazos);
  igual(b.valores['Actividad ID'], 14);
});
prueba('cola: "no existe" queda como error; reintentar y descartar', async () => {
  const s = servidorEjemplo();
  const r = await sincronizar([crearOp('modificar', 'Costos', { id: 99, valores: { 'Real USD': 1 } }, fijo('x'))], async x => s.enviar(x));
  igual([r.ops[0].estado, r.ops[0].error], ['error', 'no existe']);
  igual(reintentar(r.ops, 'x')[0].estado, 'pendiente');
  igual(descartar(r.ops, 'x'), []);
});
prueba('cola: sin conexión la cola queda intacta', async () => {
  const s = servidorEjemplo();
  s.caido = true;
  const ops = [crearOp('modificar', 'Costos', { id: 1, valores: { 'Real USD': 1 } }, fijo('x'))];
  let mensaje = null;
  try { await sincronizar(ops, async x => s.enviar(x)); } catch (e) { mensaje = e.message; }
  igual([mensaje, ops[0].estado], ['sin conexión', 'pendiente']);
});
prueba('cola: sin pendientes no envía nada', async () => {
  let llamadas = 0;
  const r = await sincronizar([], async () => { llamadas++; return []; });
  igual([r.enviado, llamadas], [false, 0]);
});
