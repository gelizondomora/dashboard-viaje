import { normalizar } from './parse.js';

export function crearOp(op, tabla, { id = null, valores = {} } = {}, uuid = () => crypto.randomUUID()) {
  return { opId: uuid(), op, tabla, id, valores: { ...valores }, estado: 'pendiente', error: null };
}

export function idTemporal(raw, ops) {
  let min = 0;
  for (const t of Object.values(raw?.tablas || {})) for (const f of t.filas) if (f.id < min) min = f.id;
  for (const o of ops) if (o.id < min) min = o.id;
  return min - 1;
}

const claveNorm = (valores, nombre) => Object.keys(valores).find(k => normalizar(k) === normalizar(nombre));

function asignar(destino, origen) {
  for (const [k, v] of Object.entries(origen)) destino[claveNorm(destino, k) ?? k] = v;
}

function aplicarOps(raw, ops, { marcar }) {
  if (!raw) return raw;
  const r = structuredClone(raw);
  for (const o of ops) {
    const t = r.tablas[o.tabla];
    if (!t) continue;
    const marca = f => {
      if (!marcar) return;
      f.pendiente = o.estado !== 'error';
      f.errorSync = o.estado === 'error' ? o.error : null;
    };
    if (o.op === 'agregar') {
      const f = { id: o.id, valores: {} };
      for (const h of t.encabezados) if (normalizar(h) !== 'id') f.valores[h] = '';
      asignar(f.valores, o.valores);
      marca(f);
      t.filas.push(f);
      continue;
    }
    const f = t.filas.find(x => x.id === o.id);
    if (!f) continue;
    if (o.op === 'modificar') { asignar(f.valores, o.valores); marca(f); }
    if (o.op === 'eliminar') {
      if (marcar && o.estado === 'error') { marca(f); continue; }
      t.filas = t.filas.filter(x => x !== f);
      if (o.tabla === 'Itinerario') {
        const vinculo = x => { const k = claveNorm(x.valores, 'Actividad ID'); return k && x.valores[k] !== '' && Number(x.valores[k]) === o.id ? k : null; };
        if (r.tablas.Lugares) r.tablas.Lugares.filas = r.tablas.Lugares.filas.filter(x => !vinculo(x));
        for (const x of r.tablas.Reservas?.filas || []) { const k = vinculo(x); if (k) x.valores[k] = ''; }
      }
    }
  }
  return r;
}

export const aplicarPendientes = (raw, ops) => aplicarOps(raw, ops, { marcar: true });
export const consolidar = (raw, ops) => aplicarOps(raw, ops, { marcar: false });

function reemplazarId(o, { tabla, temp, real }) {
  let x = o;
  if (x.tabla === tabla && x.id === temp) x = { ...x, id: real };
  if (tabla === 'Itinerario') {
    const k = claveNorm(x.valores, 'Actividad ID');
    if (k && x.valores[k] !== '' && Number(x.valores[k]) === temp) x = { ...x, valores: { ...x.valores, [k]: real } };
  }
  return x;
}

export const aplicarReemplazos = (ops, reemplazos) => ops.map(o => reemplazos.reduce(reemplazarId, o));

export async function sincronizar(ops, enviar) {
  const lote = ops.filter(o => o.estado === 'pendiente');
  if (!lote.length) return { ops, confirmadas: [], reemplazos: [], enviado: false };
  const resultados = await enviar(lote.map(({ opId, op, tabla, id, valores }) => ({ opId, op, tabla, id, valores })));
  let restantes = ops.slice();
  const confirmadas = [], reemplazos = [];
  for (const r of resultados) {
    const o = restantes.find(x => x.opId === r.opId);
    if (!o) continue;
    if (r.ok) {
      restantes = restantes.filter(x => x !== o);
      if (o.op === 'agregar' && o.id < 0 && r.id != null) {
        const rep = { tabla: o.tabla, temp: o.id, real: r.id };
        reemplazos.push(rep);
        confirmadas.push(reemplazarId(o, rep));
        restantes = restantes.map(x => reemplazarId(x, rep));
      } else {
        confirmadas.push(o);
      }
    } else {
      restantes = restantes.map(x => (x === o ? { ...x, estado: 'error', error: r.error } : x));
    }
  }
  return { ops: restantes, confirmadas, reemplazos, enviado: true };
}

export const reintentar = (ops, opId) => ops.map(o => (o.opId === opId ? { ...o, estado: 'pendiente', error: null } : o));
export const descartar = (ops, opId) => ops.filter(o => o.opId !== opId);
