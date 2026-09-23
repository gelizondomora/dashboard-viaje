/* Pruebas de Logica.gs. Corren en Apps Script (ejecuta probarTodo) y en el navegador (tests.html). */
var PRUEBAS_LOGICA = [];
function pruebaLogica(nombre, fn) { PRUEBAS_LOGICA.push({ nombre: nombre, fn: fn }); }
function igualL(real, esperado, msg) {
  const a = JSON.stringify(real), b = JSON.stringify(esperado);
  if (a !== b) throw new Error(((msg || '') + ' esperado ' + b + ', obtenido ' + a).trim());
}
function probarTodo() {
  const res = PRUEBAS_LOGICA.map(p => {
    try { p.fn(); return { nombre: 'gs/' + p.nombre, ok: true }; }
    catch (e) { return { nombre: 'gs/' + p.nombre, ok: false, error: e.message }; }
  });
  if (typeof Logger !== 'undefined') {
    const fallas = res.filter(r => !r.ok);
    Logger.log((res.length - fallas.length) + ' ok, ' + fallas.length + ' fallas');
    fallas.forEach(r => Logger.log(r.nombre + ': ' + r.error));
  }
  return res;
}

const DATOS_EJEMPLO = { nombre: 'Colombia 2026', personas: 2, monedaLocal: 'COP', monedaCasa: 'CRC' };

const LIBRO_ORIGINAL = {
  Costos: [
    ['Detalle', 'Efectivo?', 'Monto Dos Personas', 'Colones', 'Por Persona', '', 'Tipo de Cambio', ''],
    ['Vuelos', '', 696.92, 317098.6, 158549.3, '', 'COP-CRC', 0.14],
    ['Comida', '', '', 150000, 75000, '', 'COP-USD', 0.00031],
    ['Medellin Hospedaje', '', '', 254000, 127000, '', 'USD-CRC', 455],
    ['Compras', '', '', 175000, 87500, '', '', ''],
    ['Bogota Hospedaje', '', '', 134133, 67066.5, '', '', ''],
    ['Vuelo interno', '', 217.4, 98917, 49458.5, '', '', ''],
    ['Efectivo', 'Inicio', 200, 91000, 45500, '', '', ''],
    ['Zipaquirá y lago Guatavita', '', 138, 62790, 31395, '', '', ''],
    ['Guatapé desde Medellín', '', 50, 22750, 11375, '', '', ''],
    ['Compras Varias', 'Si', 50, 22750, 11375, '', '', ''],
    ['Sobrante', 'Total', -50.38, 33215, 16607.5, '', '', ''],
    ['Tiquete Catedral de Sal', 'Si', 39.6, 18018, 9009, '', '', ''],
    ['Metro Cable Arvi', 'Si', 30.38, 13822.9, 6911.45, '', '', ''],
    ['Entrada Parque Nacional', 'Si', 21.7, 9873.5, 4936.75, '', '', ''],
    ['Transporte Aeropuerto', '', 17.66, 8035.3, 4017.65, '', '', ''],
    ['Transporte Aeropuerto', '', 17.66, 8035.3, 4017.65, '', '', ''],
    ['Metro Medellin Comuna 13', 'Si', 3.97, 1806.35, 903.175, '', '', ''],
    ['Metro Medellin Arvi', 'Si', 3.97, 1805.44, 902.72, '', '', ''],
  ],
  Itinerario: [
    ['Fechas', 'Tiempo', 'Ciudad', 'Actividad', 'Obligatorio/Opcional'],
    ['2026-09-27', 'Tarde', 'Bogota', 'Centro Histórico', 'Obligatorio'],
    ['2026-09-28', 'Noche', 'Bogota', 'Cena Zona T', 'Opcional'],
    ['2026-09-28', 'Tarde', 'Bogota', 'Monserrate', 'Obligatorio'],
    ['2026-09-29', 'Mañana-Tarde', 'Bogota', 'Zipaquirá y Lago Guatavita', 'Obligatorio'],
    ['2026-09-30', 'Tarde', 'Bogota', 'Zona T / Compras', 'Obligatorio'],
    ['2026-09-30', 'Mañana', 'Bogota', 'Parque de la 93', 'Opcional'],
    ['2026-10-01', 'Tarde', 'Medellin', 'Parque Explora', 'Opcional'],
    ['2026-10-02', 'Mañana-Tarde', 'Medellin', 'Guatapé desde Medellín', 'Obligatorio'],
    ['2026-10-03', 'Noche', 'Medellin', 'Fiesta El Poblado', 'Opcional'],
    ['2026-10-03', 'Tarde', 'Medellin', 'Compras', 'Obligatorio'],
    ['2026-10-04', 'Mañana', 'Medellin', 'Comuna 13', 'Obligatorio'],
    ['2026-10-05', 'Mañana-Tarde', 'Medellin', 'Santa Fe de Antioquia', 'Obligatorio'],
    ['2026-10-06', 'Mañana', 'Medellin', 'Parque Arví', 'Obligatorio'],
  ],
  Reservas: [
    ['Tour', 'Fecha y hora', 'Recogida'],
    ['Guatapé desde Medellín', 'Viernes, 2 de octubre de 2026, 7:00', 'Parque del Poblado, frente a la iglesia'],
    ['Zipaquirá y lago Guatavita', 'Martes, 29 de septiembre de 2026, 8:00', 'Hotel'],
  ],
};
const ENLACES_ORIGINALES = ['', 'https://www.getyourguide.com/booking/EJEMPLO-GUATAPE', 'https://www.getyourguide.com/booking/EJEMPLO-ZIPAQUIRA'];

pruebaLogica('normalizar quita tildes, mayúsculas y espacios', () => {
  igualL(normalizar('  Mañana-Tarde '), 'manana-tarde');
  igualL(normalizar('Categoría'), 'categoria');
  igualL(normalizar(null), '');
});
pruebaLogica('indiceColumna compara normalizado', () => {
  igualL(indiceColumna(['ID', 'Dirección / Mapa'], 'direccion / mapa'), 1);
  igualL(indiceColumna(['ID'], 'Lugar'), -1);
});
pruebaLogica('tablaAObjetos omite filas vacías y saca el ID', () => {
  igualL(tablaAObjetos([['ID', 'Lugar'], [1, 'A'], ['', ''], [2, 'B']]), {
    encabezados: ['ID', 'Lugar'],
    filas: [{ id: 1, valores: { Lugar: 'A' } }, { id: 2, valores: { Lugar: 'B' } }],
  });
  igualL(tablaAObjetos([]), { encabezados: [], filas: [] });
});
pruebaLogica('configComoObjeto', () => {
  igualL(configComoObjeto([['Clave', 'Valor'], ['Personas', 2], ['', 'x']]), { Personas: 2 });
});
pruebaLogica('siguienteId y buscarFila', () => {
  const t = [['ID', 'x'], [3, 'a'], [7, 'b']];
  igualL(siguienteId(t), 8);
  igualL(siguienteId([['ID']]), 1);
  igualL(buscarFila(t, 7), 2);
  igualL(buscarFila(t, 99), -1);
  igualL(buscarFila(t, ''), -1);
});
pruebaLogica('fechaAClave entiende los tres formatos', () => {
  igualL(fechaAClave('2026-09-29'), '2026-09-29');
  igualL(fechaAClave('29/9/2026'), '2026-09-29');
  igualL(fechaAClave('Martes, 29 de septiembre de 2026, 8:00'), '2026-09-29');
  igualL(fechaAClave('2026-10-02 7:00'), '2026-10-02');
  igualL(fechaAClave('basura'), '');
});
pruebaLogica('horaDesdeTexto lee lo que muestra la hoja', () => {
  igualL(horaDesdeTexto('7:00:00'), '7:00');
  igualL(horaDesdeTexto('7:30 p. m.'), '19:30');
  igualL(horaDesdeTexto('12:05 a. m.'), '0:05');
  igualL(horaDesdeTexto(''), '');
});

function libroMigrado() { return migrarLibro(LIBRO_ORIGINAL, ENLACES_ORIGINALES, DATOS_EJEMPLO); }

pruebaLogica('migrar: Config con efectivo inicial y tipos de cambio', () => {
  igualL(libroMigrado().Config, [
    ['Clave', 'Valor'], ['Nombre del viaje', 'Colombia 2026'], ['Personas', 2], ['Moneda local', 'COP'],
    ['Moneda de casa', 'CRC'], ['Efectivo inicial (USD)', 200], ['COP-CRC', 0.14], ['COP-USD', 0.00031], ['USD-CRC', 455],
  ]);
});
pruebaLogica('migrar: Costos sin filas Efectivo/Sobrante y con columnas nuevas', () => {
  const c = libroMigrado().Costos;
  igualL(c[0], ['ID', 'Detalle', 'Categoría', 'Fecha', 'Efectivo?', 'Presupuesto USD', 'Presupuesto CRC', 'Real USD', 'Real CRC', 'Por Persona']);
  igualL(c.length, 17);
  igualL(c[1], [1, 'Vuelos', 'Transporte', '', '', 696.92, 317098.6, '', '', 158549.3]);
  igualL(c[2], [2, 'Comida', 'Comida', '', '', '', 150000, '', '', 75000]);
  igualL(c[9], [9, 'Compras Varias', 'Compras', '', 'Si', 50, 22750, '', '', 11375]);
  igualL(c.some(f => f[1] === 'Efectivo' || f[1] === 'Sobrante'), false);
});
pruebaLogica('migrar: categorías propuestas', () => {
  const cat = {};
  libroMigrado().Costos.slice(1).forEach(f => { cat[f[1]] = f[2]; });
  igualL(cat, {
    'Vuelos': 'Transporte', 'Comida': 'Comida', 'Medellin Hospedaje': 'Hospedaje', 'Compras': 'Compras',
    'Bogota Hospedaje': 'Hospedaje', 'Vuelo interno': 'Transporte', 'Zipaquirá y lago Guatavita': 'Tours',
    'Guatapé desde Medellín': 'Tours', 'Compras Varias': 'Compras', 'Tiquete Catedral de Sal': 'Tours',
    'Metro Cable Arvi': 'Transporte', 'Entrada Parque Nacional': 'Tours', 'Transporte Aeropuerto': 'Transporte',
    'Metro Medellin Comuna 13': 'Transporte', 'Metro Medellin Arvi': 'Transporte',
  });
});
pruebaLogica('migrar: Itinerario con ID y horas', () => {
  const it = libroMigrado().Itinerario;
  igualL(it[0], ['ID', 'Fechas', 'Tiempo', 'Hora inicio', 'Hora fin', 'Ciudad', 'Actividad', 'Obligatorio/Opcional']);
  igualL(it.length, 14);
  igualL(it[4], [4, '2026-09-29', 'Mañana-Tarde', '', '', 'Bogota', 'Zipaquirá y Lago Guatavita', 'Obligatorio']);
});
pruebaLogica('migrar: Reservas con enlace y actividad vinculada', () => {
  igualL(libroMigrado().Reservas, [
    ['ID', 'Tour', 'Fecha y hora', 'Recogida', 'Enlace', 'Actividad ID'],
    [1, 'Guatapé desde Medellín', 'Viernes, 2 de octubre de 2026, 7:00', 'Parque del Poblado, frente a la iglesia', ENLACES_ORIGINALES[1], 8],
    [2, 'Zipaquirá y lago Guatavita', 'Martes, 29 de septiembre de 2026, 8:00', 'Hotel', ENLACES_ORIGINALES[2], 4],
  ]);
});
pruebaLogica('migrar: pestañas nuevas vacías', () => {
  const l = libroMigrado();
  igualL(l.Lugares, [['ID', 'Actividad ID', 'Lugar', 'Dirección / Mapa', 'Notas', 'Hecho']]);
  igualL(l._Registro, [['opId', 'fecha', 'resultado']]);
});
