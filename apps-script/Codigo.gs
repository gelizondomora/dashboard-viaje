/* Pegamento con Google Sheets. La lógica está en Logica.gs; las pruebas en PruebasLogica.gs (ejecuta probarTodo). */
const DATOS_VIAJE = { nombre: 'Colombia 2026', personas: 2, monedaLocal: 'COP', monedaCasa: 'CRC' };
const HOJAS_LIBRO = ['Config', 'Costos', 'Itinerario', 'Lugares', 'Reservas', '_Registro', '_IDs'];

function doGet(e) {
  return responder_(() => {
    const p = (e && e.parameter) || {};
    autorizar_(p.clave);
    if (p.op !== 'leer') throw new Error('operación desconocida');
    const ss = SpreadsheetApp.getActive();
    let libro = leerLibro_(ss);
    const faltantes = asignarIdsFaltantes(libro);
    if (faltantes.length) {
      // Filas agregadas a mano en la hoja: se les asigna ID bajo el candado para poder editarlas.
      const lock = LockService.getScriptLock();
      lock.waitLock(20000);
      try {
        libro = leerLibro_(ss);
        const acciones = asignarIdsFaltantes(libro);
        ejecutarEnHoja_(ss, acciones);
        libro = ejecutarAcciones(libro, acciones);
      } finally {
        lock.releaseLock();
      }
    }
    const tablas = {};
    TABLAS_EDITABLES.forEach(n => { tablas[n] = tablaAObjetos(libro[n]); });
    return { ok: true, leidoEn: new Date().toISOString(), config: configComoObjeto(libro.Config), tablas: tablas };
  });
}

function doPost(e) {
  return responder_(() => {
    const cuerpo = JSON.parse(e.postData.contents);
    autorizar_(cuerpo.clave);
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const ss = SpreadsheetApp.getActive();
      const r = procesarLote(leerLibro_(ss), cuerpo.ops || [], new Date().toISOString());
      r.pasos.forEach(acciones => ejecutarEnHoja_(ss, acciones));
      if (r.nuevosRegistros.length) {
        const h = ss.getSheetByName('_Registro');
        h.getRange(h.getLastRow() + 1, 1, r.nuevosRegistros.length, 3).setValues(r.nuevosRegistros);
      }
      SpreadsheetApp.flush();
      return { ok: true, resultados: r.resultados };
    } finally {
      lock.releaseLock();
    }
  });
}

/* Ejecutar a mano UNA vez desde el editor. Crea un respaldo y convierte la hoja a la estructura del dashboard. */
function prepararHoja() {
  const ss = SpreadsheetApp.getActive();
  if (ss.getSheetByName('Config')) { Logger.log('La hoja ya está preparada: no se hizo ningún cambio.'); return; }
  const tz = ss.getSpreadsheetTimeZone();
  const respaldo = DriveApp.getFileById(ss.getId()).makeCopy(ss.getName() + ' — respaldo ' + Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm'));
  const libro = leerLibro_(ss);
  const hr = ss.getSheetByName('Reservas');
  const enlaces = hr && hr.getLastRow() > 0
    ? hr.getRange(1, 1, hr.getLastRow(), 1).getRichTextValues().map(f => f[0].getLinkUrl() || '')
    : [];
  const nuevo = migrarLibro(libro, enlaces, DATOS_VIAJE);
  HOJAS_LIBRO.forEach(n => escribirHoja_(ss, n, nuevo[n]));
  ss.getSheetByName('_Registro').hideSheet();
  ss.getSheetByName('_IDs').hideSheet();
  Logger.log('Hoja preparada. Respaldo: ' + respaldo.getUrl());
}

function responder_(fn) {
  let salida;
  try { salida = fn(); } catch (err) { salida = { ok: false, error: err.message }; }
  return ContentService.createTextOutput(JSON.stringify(salida)).setMimeType(ContentService.MimeType.JSON);
}

function autorizar_(clave) {
  const esperada = PropertiesService.getScriptProperties().getProperty('CLAVE');
  if (!esperada || clave !== esperada) throw new Error('no autorizado');
}

function celdaATexto_(v, mostrado, tz) {
  if (!(v instanceof Date)) return v;
  if (v.getFullYear() < 1900) return horaDesdeTexto(mostrado);
  const hm = Utilities.formatDate(v, tz, 'H:mm');
  return Utilities.formatDate(v, tz, 'yyyy-MM-dd') + (hm === '0:00' ? '' : ' ' + hm);
}

function leerLibro_(ss) {
  const tz = ss.getSpreadsheetTimeZone();
  const libro = {};
  HOJAS_LIBRO.forEach(n => {
    const h = ss.getSheetByName(n);
    if (!h || h.getLastRow() === 0) { libro[n] = []; return; }
    const rango = h.getDataRange();
    const valores = rango.getValues(), mostrados = rango.getDisplayValues();
    libro[n] = valores.map((f, i) => f.map((v, j) => celdaATexto_(v, mostrados[i][j], tz)));
  });
  return libro;
}

function ejecutarEnHoja_(ss, acciones) {
  acciones.forEach(a => {
    const h = ss.getSheetByName(a.tabla);
    if (a.tipo === 'poner') {
      h.getRange(a.fila + 1, a.col + 1).setValue(valorParaHoja(a.valor));
    } else if (a.tipo === 'borrarFila') {
      // Sheets no permite borrar la última fila no congelada: se agrega una vacía antes.
      if (h.getMaxRows() <= a.fila + 1) h.insertRowAfter(h.getMaxRows());
      h.deleteRow(a.fila + 1);
    } else if (a.tipo === 'agregarFila') {
      h.appendRow(a.valores.map(valorParaHoja));
    }
  });
}

function escribirHoja_(ss, nombre, valores) {
  const h = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
  h.clear();
  const ancho = Math.max.apply(null, valores.map(f => f.length));
  const filas = valores.map(f => f.concat(Array(ancho - f.length).fill('')));
  h.getRange(1, 1, filas.length, ancho).setValues(filas);
  h.setFrozenRows(1);
}
