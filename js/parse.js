const MESES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
const pad = n => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const minutos = (h, m) => (h === undefined ? null : Number(h) * 60 + Number(m));
const vacio = v => v === null || v === undefined || v === '';

export function normalizar(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

export function valorDe(valores, nombre) {
  const n = normalizar(nombre);
  for (const k of Object.keys(valores)) if (normalizar(k) === n) return valores[k];
  return '';
}

export function leerMonto(v) {
  if (vacio(v)) return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[$₡\s,]/g, '');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export function leerHora(v) {
  if (vacio(v)) return null;
  const m = String(v).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m || Number(m[1]) > 24 || Number(m[2]) > 59) return NaN;
  return minutos(m[1], m[2]);
}

export function leerFechaHora(v) {
  if (vacio(v)) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) return { fecha: iso(m[1], m[2], m[3]), hora: minutos(m[4], m[5]) };
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (m) return { fecha: iso(m[3], m[2], m[1]), hora: minutos(m[4], m[5]) };
  m = normalizar(s).match(/(\d{1,2}) de ([a-z]+) de (\d{4})(?:,?\s*(\d{1,2}):(\d{2}))?/);
  if (m && MESES[m[2]]) return { fecha: iso(m[3], MESES[m[2]], m[1]), hora: minutos(m[4], m[5]) };
  return false;
}

export function parsearDatos(raw) {
  const cfg = {};
  for (const [k, v] of Object.entries(raw.config || {})) cfg[normalizar(k)] = v;
  const local = String(cfg['moneda local'] || 'COP').trim().toUpperCase();
  const casa = String(cfg['moneda de casa'] || 'CRC').trim().toUpperCase();
  const numero = k => { const n = leerMonto(cfg[normalizar(k)]); return Number.isFinite(n) ? n : null; };
  const nombresTasas = { usdCasa: `USD-${casa}`, localCasa: `${local}-${casa}`, localUsd: `${local}-USD` };
  const tasas = Object.fromEntries(Object.entries(nombresTasas).map(([k, n]) => [k, numero(n)]));
  const advertencias = Object.entries(nombresTasas).filter(([k]) => tasas[k] === null).map(([, n]) => `Falta el tipo de cambio ${n} en Config`);
  const filas = n => raw.tablas?.[n]?.filas || [];
  const meta = f => ({ pendiente: !!f.pendiente, errorSync: f.errorSync || null });
  const idDe = v => { const n = leerMonto(v); return Number.isFinite(n) ? n : null; };

  const costos = filas('Costos').map(f => {
    const val = n => valorDe(f.valores, n);
    const errores = [];
    const monto = (colUsd, colCasa) => {
      const u = leerMonto(val(colUsd)), c = leerMonto(val(colCasa));
      if (Number.isNaN(u) || Number.isNaN(c)) { errores.push('monto ilegible'); return null; }
      if (u !== null) return { usd: u, casa: u * tasas.usdCasa, moneda: 'USD', cantidad: u };
      if (c !== null) return { usd: c / tasas.usdCasa, casa: c, moneda: casa, cantidad: c };
      return null;
    };
    const presupuesto = monto('Presupuesto USD', `Presupuesto ${casa}`);
    const real = monto('Real USD', `Real ${casa}`);
    const fh = leerFechaHora(val('Fecha'));
    if (fh === false) errores.push('fecha ilegible');
    return {
      id: f.id, detalle: String(val('Detalle')), categoria: String(val('Categoría')).trim() || 'Otros',
      fecha: fh ? fh.fecha : null, efectivo: normalizar(val('Efectivo?')) === 'si',
      presupuesto, real, error: errores[0] || null, ...meta(f),
    };
  });

  const actividades = filas('Itinerario').map(f => {
    const val = n => valorDe(f.valores, n);
    const fh = leerFechaHora(val('Fechas'));
    const inicio = leerHora(val('Hora inicio')), fin = leerHora(val('Hora fin'));
    let error = null;
    if (!fh) error = fh === null ? 'sin fecha' : 'fecha ilegible';
    else if (Number.isNaN(inicio) || Number.isNaN(fin)) error = 'hora ilegible';
    else if (inicio !== null && fin !== null && fin <= inicio) error = 'hora fin antes de inicio';
    return {
      id: f.id, fecha: fh ? fh.fecha : null, franja: String(val('Tiempo')).trim(),
      inicio: Number.isNaN(inicio) ? null : inicio, fin: Number.isNaN(fin) ? null : fin,
      ciudad: String(val('Ciudad')).trim(), actividad: String(val('Actividad')).trim(),
      opcional: normalizar(val('Obligatorio/Opcional')).startsWith('opcional'), error, ...meta(f),
    };
  });

  const lugares = filas('Lugares').map(f => {
    const val = n => valorDe(f.valores, n);
    return {
      id: f.id, actividadId: idDe(val('Actividad ID')), lugar: String(val('Lugar')), mapa: String(val('Dirección / Mapa')).trim(),
      notas: String(val('Notas')), hecho: normalizar(val('Hecho')) === 'si', ...meta(f),
    };
  });

  const reservas = filas('Reservas').map(f => {
    const val = n => valorDe(f.valores, n);
    const fh = leerFechaHora(val('Fecha y hora'));
    return {
      id: f.id, tour: String(val('Tour')), fecha: fh ? fh.fecha : null, hora: fh ? fh.hora : null,
      recogida: String(val('Recogida')), enlace: String(val('Enlace')).trim(), actividadId: idDe(val('Actividad ID')),
      error: fh === false ? 'fecha ilegible' : null, ...meta(f),
    };
  });

  return {
    nombre: String(cfg['nombre del viaje'] || 'Mi viaje'), personas: numero('Personas') || 1,
    monedaLocal: local, monedaCasa: casa, efectivoInicialUsd: numero('Efectivo inicial (USD)') || 0,
    tasas, leidoEn: raw.leidoEn || null, advertencias, costos, actividades, lugares, reservas,
  };
}
