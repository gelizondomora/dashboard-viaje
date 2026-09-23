import { prueba, igual, cerca, verdadero } from './t.js';
import { leerMonto, leerHora, leerFechaHora, parsearDatos } from '../js/parse.js';
import { rawEjemplo } from './fixtures.js';

prueba('parse: montos con símbolos, comas y signo', () => {
  igual([leerMonto('$696.92'), leerMonto('-$50.38'), leerMonto('₡317,098.60'), leerMonto(903.18), leerMonto('')], [696.92, -50.38, 317098.6, 903.18, null]);
  verdadero(Number.isNaN(leerMonto('abc')));
});
prueba('parse: horas', () => {
  igual([leerHora('7:00'), leerHora('07:30'), leerHora('')], [420, 450, null]);
  verdadero(Number.isNaN(leerHora('x')));
});
prueba('parse: fechas en los tres formatos', () => {
  igual(leerFechaHora('27/9/2026'), { fecha: '2026-09-27', hora: null });
  igual(leerFechaHora('Martes, 29 de septiembre de 2026, 8:00'), { fecha: '2026-09-29', hora: 480 });
  igual(leerFechaHora('2026-10-02 7:00'), { fecha: '2026-10-02', hora: 420 });
  igual([leerFechaHora(''), leerFechaHora('x')], [null, false]);
});
prueba('parse: Config y tipos de cambio', () => {
  const v = parsearDatos(rawEjemplo());
  igual([v.nombre, v.personas, v.monedaLocal, v.monedaCasa, v.efectivoInicialUsd], ['Colombia 2026', 2, 'COP', 'CRC', 200]);
  igual(v.tasas, { usdCasa: 455, localCasa: 0.14, localUsd: 0.00031 });
  igual(v.advertencias, []);
});
prueba('parse: costos en USD o en colones', () => {
  const v = parsearDatos(rawEjemplo());
  igual(v.costos.length, 16);
  const vuelos = v.costos[0], comida = v.costos[1];
  igual([vuelos.id, vuelos.detalle, vuelos.categoria, vuelos.presupuesto.moneda, vuelos.real], [1, 'Vuelos', 'Transporte', 'USD', null]);
  cerca(vuelos.presupuesto.casa, 317098.6, 0.01);
  igual([comida.presupuesto.moneda, comida.presupuesto.casa], ['CRC', 150000]);
  cerca(comida.presupuesto.usd, 329.67, 0.01);
  igual(v.costos.filter(c => c.efectivo).length, 6);
});
prueba('parse: actividades, lugares y reservas', () => {
  const v = parsearDatos(rawEjemplo());
  igual(v.actividades.length, 13);
  const g = v.actividades.find(a => a.id === 8);
  igual([g.fecha, g.franja, g.opcional, g.inicio, g.error], ['2026-10-02', 'Mañana-Tarde', false, null, null]);
  igual(v.actividades.find(a => a.id === 2).opcional, true);
  const r = v.reservas[0];
  igual([r.tour, r.fecha, r.hora, r.actividadId], ['Guatapé desde Medellín', '2026-10-02', 420, 8]);
  verdadero(r.enlace.startsWith('https://'));
  igual(v.lugares, []);
});
prueba('parse: encabezados con otra capitalización y sin tildes', () => {
  const raw = rawEjemplo();
  for (const f of raw.tablas.Costos.filas) {
    f.valores['categoria'] = f.valores['Categoría']; delete f.valores['Categoría'];
    f.valores['presupuesto usd'] = f.valores['Presupuesto USD']; delete f.valores['Presupuesto USD'];
  }
  const v = parsearDatos(raw);
  igual([v.costos[0].categoria, v.costos[0].presupuesto.usd], ['Transporte', 696.92]);
});
prueba('parse: monto o fecha ilegible marca error en la fila', () => {
  const raw = rawEjemplo();
  raw.tablas.Costos.filas[0].valores['Real USD'] = 'mucho';
  raw.tablas.Itinerario.filas[0].valores['Hora inicio'] = '15:00';
  raw.tablas.Itinerario.filas[0].valores['Hora fin'] = '14:00';
  const v = parsearDatos(raw);
  igual(v.costos[0].error, 'monto ilegible');
  igual(v.actividades[0].error, 'hora fin antes de inicio');
});
prueba('parse: falta un tipo de cambio → advertencia', () => {
  const raw = rawEjemplo();
  delete raw.config['COP-USD'];
  igual(parsearDatos(raw).advertencias, ['Falta el tipo de cambio COP-USD en Config']);
});
