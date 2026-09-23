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
