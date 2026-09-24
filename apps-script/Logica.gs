/* Lógica pura del Dashboard de Viaje. No usa SpreadsheetApp: se prueba en el navegador y en Apps Script. */
const TABLAS_EDITABLES = ['Costos', 'Itinerario', 'Lugares', 'Reservas'];
const MESES_ES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };

function normalizar(s) {
  return String(s === null || s === undefined ? '' : s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function indiceColumna(encabezados, nombre) {
  const n = normalizar(nombre);
  for (let i = 0; i < encabezados.length; i++) if (normalizar(encabezados[i]) === n) return i;
  return -1;
}

function filaVacia(fila) {
  return fila.every(c => c === '' || c === null || c === undefined);
}

function tablaAObjetos(valores) {
  if (!valores || !valores.length) return { encabezados: [], filas: [] };
  const encabezados = valores[0].map(String);
  const iId = indiceColumna(encabezados, 'ID');
  const filas = valores.slice(1).filter(f => !filaVacia(f)).map(f => {
    const v = {};
    encabezados.forEach((h, i) => { if (i !== iId && h !== '') v[h] = f[i] === undefined || f[i] === null ? '' : f[i]; });
    return { id: iId >= 0 && f[iId] !== '' ? Number(f[iId]) : null, valores: v };
  });
  return { encabezados: encabezados, filas: filas };
}

function configComoObjeto(valores) {
  const c = {};
  (valores || []).slice(1).forEach(f => { const k = String(f[0]).trim(); if (k) c[k] = f[1]; });
  return c;
}

function siguienteId(valores) {
  const i = indiceColumna(valores[0] || [], 'ID');
  let max = 0;
  valores.slice(1).forEach(f => { const n = Number(f[i]); if (f[i] !== '' && Number.isFinite(n) && n > max) max = n; });
  return max + 1;
}

function buscarFila(valores, id) {
  if (id === null || id === undefined || id === '') return -1;
  const i = indiceColumna(valores[0] || [], 'ID');
  for (let j = 1; j < valores.length; j++) if (valores[j][i] !== '' && Number(valores[j][i]) === Number(id)) return j;
  return -1;
}

function fechaAClave(v) {
  const s = String(v === null || v === undefined ? '' : v).trim();
  const p = n => String(n).padStart(2, '0');
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + p(m[2]) + '-' + p(m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return m[3] + '-' + p(m[2]) + '-' + p(m[1]);
  m = normalizar(s).match(/(\d{1,2}) de ([a-z]+) de (\d{4})/);
  if (m && MESES_ES[m[2]]) return m[3] + '-' + p(MESES_ES[m[2]]) + '-' + p(m[1]);
  return '';
}

/* Las celdas de solo hora vienen como fechas de 1899; leer el texto mostrado evita el desfase histórico de zona horaria. */
function horaDesdeTexto(texto) {
  const s = String(texto || '');
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (!m) return '';
  let h = Number(m[1]);
  if (/p\.?\s?m/i.test(s) && h < 12) h += 12;
  if (/a\.?\s?m/i.test(s) && h === 12) h = 0;
  return h + ':' + m[2];
}

const CATEGORIAS_PROPUESTAS = {
  Transporte: ['vuelos', 'vuelo interno', 'transporte aeropuerto', 'metro cable arvi', 'metro medellin comuna 13', 'metro medellin arvi'],
  Hospedaje: ['bogota hospedaje', 'medellin hospedaje'],
  Comida: ['comida'],
  Tours: ['zipaquira y lago guatavita', 'guatape desde medellin', 'tiquete catedral de sal', 'entrada parque nacional'],
  Compras: ['compras', 'compras varias'],
};

function categoriaPropuesta(detalle) {
  const n = normalizar(detalle);
  for (const cat of Object.keys(CATEGORIAS_PROPUESTAS)) if (CATEGORIAS_PROPUESTAS[cat].indexOf(n) >= 0) return cat;
  return 'Otros';
}

function migrarLibro(libro, enlacesReservas, datos) {
  const casa = datos.monedaCasa;
  const celda = (f, i) => (i >= 0 && f[i] !== undefined && f[i] !== null ? f[i] : '');

  // Costos: separa efectivo inicial, sobrante y tipos de cambio; agrega columnas nuevas.
  const co = libro.Costos && libro.Costos.length ? libro.Costos : [['Detalle']];
  const hc = co[0].map(String);
  const c = n => indiceColumna(hc, n);
  const iDet = c('Detalle'), iEf = c('Efectivo?'), iUsd = c('Monto Dos Personas'), iCrc = c('Colones'), iPp = c('Por Persona'), iTc = c('Tipo de Cambio');
  let efectivo = '';
  const tasas = [];
  const gastos = [];
  co.slice(1).forEach(f => {
    if (iTc >= 0 && String(celda(f, iTc)).trim() !== '' && celda(f, iTc + 1) !== '') tasas.push([String(f[iTc]).trim(), f[iTc + 1]]);
    const ef = normalizar(celda(f, iEf));
    if (ef === 'inicio') { efectivo = celda(f, iUsd); return; }
    if (ef === 'total' || String(celda(f, iDet)).trim() === '') return;
    gastos.push(f);
  });
  const costos = [['ID', 'Detalle', 'Categoría', 'Fecha', 'Efectivo?', 'Presupuesto USD', 'Presupuesto ' + casa, 'Real USD', 'Real ' + casa, 'Por Persona', 'Partida ID']]
    .concat(gastos.map((f, i) => [
      i + 1, celda(f, iDet), categoriaPropuesta(celda(f, iDet)), '', normalizar(celda(f, iEf)) === 'si' ? 'Si' : '',
      celda(f, iUsd), celda(f, iCrc), '', '', celda(f, iPp), '',
    ]));
  const config = [['Clave', 'Valor'], ['Nombre del viaje', datos.nombre], ['Personas', datos.personas],
    ['Moneda local', datos.monedaLocal], ['Moneda de casa', casa], ['Efectivo inicial (USD)', efectivo]].concat(tasas);

  // Itinerario: ID al inicio, Hora inicio y Hora fin después de Tiempo.
  const it = libro.Itinerario && libro.Itinerario.length ? libro.Itinerario : [['Fechas', 'Tiempo', 'Ciudad', 'Actividad', 'Obligatorio/Opcional']];
  const hi = it[0].map(String);
  const iT = indiceColumna(hi, 'Tiempo');
  const pos = iT >= 0 ? iT + 1 : hi.length;
  const partir = f => { const a = hi.map((_, i) => celda(f, i)); return a.slice(0, pos).concat(['', ''], a.slice(pos)); };
  const itinerario = [['ID'].concat(hi.slice(0, pos), ['Hora inicio', 'Hora fin'], hi.slice(pos))]
    .concat(it.slice(1).filter(f => !filaVacia(f)).map((f, i) => [i + 1].concat(partir(f))));

  // Reservas: ID, Enlace (hipervínculo original) y Actividad ID (misma fecha y mismo nombre).
  const re = libro.Reservas && libro.Reservas.length ? libro.Reservas : [['Tour', 'Fecha y hora', 'Recogida']];
  const hr = re[0].map(String);
  const iTour = indiceColumna(hr, 'Tour'), iFh = indiceColumna(hr, 'Fecha y hora');
  const iAct = indiceColumna(itinerario[0], 'Actividad'), iFec = indiceColumna(itinerario[0], 'Fechas');
  const iEnl = indiceColumna(hr, 'Enlace');
  const reservas = [['ID'].concat(hr, iEnl < 0 ? ['Enlace'] : [], ['Actividad ID'])];
  re.forEach((f, j) => {
    if (j === 0 || filaVacia(f)) return;
    const tour = normalizar(celda(f, iTour)), fecha = fechaAClave(celda(f, iFh));
    const coinciden = itinerario.slice(1).filter(a => normalizar(a[iAct]) === tour && fechaAClave(a[iFec]) === fecha);
    const celdas = hr.map((_, i) => celda(f, i));
    const enlace = enlacesReservas[j] || '';
    if (iEnl >= 0 && String(celdas[iEnl]).trim() === '') celdas[iEnl] = enlace;
    reservas.push([reservas.length].concat(celdas, iEnl < 0 ? [enlace] : [], [coinciden.length === 1 ? coinciden[0][0] : '']));
  });

  return {
    Config: config,
    Costos: costos,
    Itinerario: itinerario,
    Lugares: [['ID', 'Actividad ID', 'Lugar', 'Dirección / Mapa', 'Notas', 'Hecho']],
    Reservas: reservas,
    _Registro: [['opId', 'fecha', 'resultado']],
    _IDs: [['Tabla', 'Ultimo ID'], ['Costos', costos.length - 1], ['Itinerario', itinerario.length - 1], ['Lugares', 0], ['Reservas', reservas.length - 1]],
  };
}

function planOperacion(libro, op) {
  if (TABLAS_EDITABLES.indexOf(op.tabla) < 0) return { ok: false, error: 'tabla desconocida: ' + op.tabla };
  const t = libro[op.tabla];
  if (!t || !t.length) return { ok: false, error: 'la pestaña ' + op.tabla + ' no existe' };
  const enc = t[0];
  const iId = indiceColumna(enc, 'ID');
  const valores = op.valores || {};
  const cols = {};
  const claves = Object.keys(valores);
  for (let k = 0; k < claves.length; k++) {
    const i = indiceColumna(enc, claves[k]);
    if (i < 0 || i === iId) return { ok: false, error: 'columna desconocida: ' + claves[k] };
    cols[i] = valores[claves[k]];
  }
  if (op.op === 'agregar') {
    const id = proximoId(libro, op.tabla);
    const acciones = [{ tipo: 'agregarFila', tabla: op.tabla, valores: enc.map((_, i) => (i === iId ? id : (i in cols ? cols[i] : ''))) }];
    const contador = accionContador(libro, op.tabla, id);
    if (contador) acciones.unshift(contador);
    return { ok: true, id: id, acciones: acciones };
  }
  const fila = buscarFila(t, op.id);
  if (fila < 0) return { ok: false, error: 'no existe' };
  if (op.op === 'modificar') {
    return { ok: true, id: Number(op.id), acciones: Object.keys(cols).map(i => ({ tipo: 'poner', tabla: op.tabla, fila: fila, col: Number(i), valor: cols[i] })) };
  }
  if (op.op === 'eliminar') {
    const acciones = [];
    if (op.tabla === 'Itinerario') {
      const vinculada = (r, ia) => ia >= 0 && r[ia] !== '' && Number(r[ia]) === Number(op.id);
      const res = libro.Reservas;
      if (res && res.length) {
        const ia = indiceColumna(res[0], 'Actividad ID');
        res.forEach((r, j) => { if (j > 0 && vinculada(r, ia)) acciones.push({ tipo: 'poner', tabla: 'Reservas', fila: j, col: ia, valor: '' }); });
      }
      const lug = libro.Lugares;
      if (lug && lug.length) {
        const ia = indiceColumna(lug[0], 'Actividad ID');
        const borrar = [];
        lug.forEach((r, j) => { if (j > 0 && vinculada(r, ia)) borrar.push(j); });
        borrar.sort((a, b) => b - a).forEach(j => acciones.push({ tipo: 'borrarFila', tabla: 'Lugares', fila: j }));
      }
    }
    acciones.push({ tipo: 'borrarFila', tabla: op.tabla, fila: fila });
    return { ok: true, id: Number(op.id), acciones: acciones };
  }
  return { ok: false, error: 'operación desconocida: ' + op.op };
}

function ejecutarAcciones(libro, acciones) {
  const n = {};
  Object.keys(libro).forEach(k => { n[k] = libro[k].map(f => f.slice()); });
  acciones.forEach(a => {
    if (a.tipo === 'poner') n[a.tabla][a.fila][a.col] = a.valor;
    else if (a.tipo === 'borrarFila') n[a.tabla].splice(a.fila, 1);
    else if (a.tipo === 'agregarFila') n[a.tabla].push(a.valores.slice());
  });
  return n;
}

function resolverTemporales(op, mapa) {
  const r = Object.assign({}, op, { valores: Object.assign({}, op.valores || {}) });
  const clave = (tabla, id) => tabla + ':' + Number(id);
  if (Number(r.id) < 0 && mapa[clave(r.tabla, r.id)] !== undefined) r.id = mapa[clave(r.tabla, r.id)];
  Object.keys(r.valores).forEach(k => {
    const v = r.valores[k];
    if (normalizar(k) === 'actividad id' && v !== '' && Number(v) < 0 && mapa[clave('Itinerario', v)] !== undefined) r.valores[k] = mapa[clave('Itinerario', v)];
  });
  return r;
}

function procesarLote(libro, ops, ahora) {
  let actual = libro;
  const resultados = [], pasos = [], nuevosRegistros = [], mapa = {};
  const registro = {};
  (libro._Registro || []).slice(1).forEach(f => { if (f[0] !== '') registro[f[0]] = f[2]; });
  ops.forEach(original => {
    const temporal = original.op === 'agregar' && Number(original.id) < 0 ? original.tabla + ':' + Number(original.id) : null;
    if (registro[original.opId] !== undefined) {
      const previo = JSON.parse(registro[original.opId]);
      if (previo.ok && temporal) mapa[temporal] = previo.id;
      resultados.push(previo);
      return;
    }
    const op = resolverTemporales(original, mapa);
    const plan = planOperacion(actual, op);
    const res = plan.ok ? { opId: op.opId, ok: true, id: plan.id } : { opId: op.opId, ok: false, error: plan.error };
    if (plan.ok) {
      pasos.push(plan.acciones);
      actual = ejecutarAcciones(actual, plan.acciones);
      if (temporal) mapa[temporal] = plan.id;
    }
    registro[op.opId] = JSON.stringify(res);
    nuevosRegistros.push([op.opId, ahora, JSON.stringify(res)]);
    resultados.push(res);
  });
  return { libro: actual, resultados: resultados, pasos: pasos, nuevosRegistros: nuevosRegistros };
}

/* Último ID entregado por pestaña (pestaña oculta _IDs): evita reutilizar IDs de filas borradas a mano. */
function ultimoId(libro, tabla) {
  const t = libro._IDs;
  if (!t) return 0;
  for (let j = 1; j < t.length; j++) if (normalizar(t[j][0]) === normalizar(tabla)) return Number(t[j][1]) || 0;
  return 0;
}

function proximoId(libro, tabla) {
  return Math.max(siguienteId(libro[tabla]), ultimoId(libro, tabla) + 1);
}

function accionContador(libro, tabla, id) {
  const t = libro._IDs;
  if (!t) return null;
  for (let j = 1; j < t.length; j++) if (normalizar(t[j][0]) === normalizar(tabla)) return { tipo: 'poner', tabla: '_IDs', fila: j, col: 1, valor: id };
  return { tipo: 'agregarFila', tabla: '_IDs', valores: [tabla, id] };
}

/* Asigna ID a las filas agregadas a mano en la hoja (sin ID). */
function asignarIdsFaltantes(libro) {
  const acciones = [];
  TABLAS_EDITABLES.forEach(tabla => {
    const t = libro[tabla];
    if (!t || !t.length) return;
    const iId = indiceColumna(t[0], 'ID');
    if (iId < 0) return;
    let siguiente = proximoId(libro, tabla);
    t.forEach((f, j) => {
      if (j === 0 || filaVacia(f) || f[iId] !== '') return;
      acciones.push({ tipo: 'poner', tabla: tabla, fila: j, col: iId, valor: siguiente });
      siguiente++;
    });
    const contador = siguiente > proximoId(libro, tabla) ? accionContador(libro, tabla, siguiente - 1) : null;
    if (contador) acciones.push(contador);
  });
  return acciones;
}

/* Sheets interpreta como fórmula el texto que empieza con = + - @; el apóstrofo lo guarda como texto. */
function valorParaHoja(v) {
  return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v;
}
