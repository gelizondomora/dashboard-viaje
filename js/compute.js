import { normalizar } from './parse.js';

export const CATEGORIAS = ['Transporte', 'Hospedaje', 'Comida', 'Tours', 'Compras', 'Otros'];

const validos = v => v.costos.filter(c => !c.error);
const suma = (lista, f) => lista.reduce((t, x) => { const m = f(x); return m ? { usd: t.usd + m.usd, casa: t.casa + m.casa } : t; }, { usd: 0, casa: 0 });
const dividir = (m, n) => ({ usd: m.usd / n, casa: m.casa / n });

// Partidas: un gasto cuyo "Partida ID" apunta a otro gasto sin partida es un hijo que consume ese presupuesto.
// Devuelve un grupo por gasto de primer nivel: { costo, hijos, real (propio + hijos, o null), restante (o null) }.
export function costosAgrupados(v) {
  const cs = validos(v);
  const porId = new Map(cs.map(c => [c.id, c]));
  const esHijo = c => c.partidaId !== null && c.partidaId !== c.id && porId.get(c.partidaId)?.partidaId === null;
  return cs.filter(c => !esHijo(c)).map(c => {
    const hijos = cs.filter(h => esHijo(h) && h.partidaId === c.id);
    const conReal = [c, ...hijos].filter(x => x.real);
    const real = conReal.length ? suma(conReal, x => x.real) : null;
    const restante = c.presupuesto ? { usd: c.presupuesto.usd - (real?.usd || 0), casa: c.presupuesto.casa - (real?.casa || 0) } : null;
    return { costo: c, hijos, real, restante };
  });
}

export function totales(v) {
  const cs = validos(v);
  const grupos = costosAgrupados(v);
  const conReal = grupos.filter(g => g.real);
  const presupuesto = suma(cs, c => c.presupuesto);
  const real = suma(cs, c => c.real);
  const planDeReales = suma(conReal, g => g.costo.presupuesto);
  return {
    presupuesto, real,
    diferencia: { usd: real.usd - planDeReales.usd, casa: real.casa - planDeReales.casa },
    conReal: conReal.length, pendientes: grupos.length - conReal.length,
    porPersona: { presupuesto: dividir(presupuesto, v.personas), real: dividir(real, v.personas) },
  };
}

// Disponible = inicial − lo realmente pagado en efectivo.
// Pronóstico = disponible − lo que falta pagar en efectivo: el presupuesto de lo que aún no tiene real
// y, en una partida con gastos hijos, lo que queda de su presupuesto.
export function efectivoRestante(v) {
  const pagado = suma(validos(v).filter(c => c.efectivo), c => c.real);
  let pendiente = 0;
  for (const g of costosAgrupados(v)) {
    if (!g.costo.efectivo) continue;
    if (g.hijos.length) pendiente += Math.max(0, (g.costo.presupuesto?.usd || 0) - (g.real?.usd || 0));
    else if (!g.costo.real) pendiente += g.costo.presupuesto?.usd || 0;
  }
  const usd = v.efectivoInicialUsd - pagado.usd;
  const pronosticadoUsd = usd - pendiente;
  return {
    usd, casa: usd * v.tasas.usdCasa, gastadoUsd: pagado.usd,
    pronosticadoUsd, pronosticadoCasa: pronosticadoUsd * v.tasas.usdCasa, comprometidoUsd: pendiente,
  };
}

export function porCategoria(v) {
  const m = new Map();
  for (const g of costosAgrupados(v)) {
    const k = g.costo.categoria || 'Otros';
    const e = m.get(k) || { categoria: k, presupuestoUsd: 0, realUsd: 0 };
    e.presupuestoUsd += g.costo.presupuesto?.usd || 0;
    e.realUsd += g.real?.usd || 0;
    m.set(k, e);
  }
  const orden = k => { const i = CATEGORIAS.indexOf(k); return i < 0 ? CATEGORIAS.length : i; };
  return [...m.values()].sort((a, b) => orden(a.categoria) - orden(b.categoria) || a.categoria.localeCompare(b.categoria));
}

export function acumuladoPorDia(v) {
  const cs = validos(v);
  const conFecha = cs.filter(c => c.fecha);
  const dias = [...new Set(conFecha.map(c => c.fecha))].sort();
  let p = 0, r = 0;
  const planeado = [], real = [];
  for (const d of dias) {
    for (const c of conFecha.filter(x => x.fecha === d)) { p += c.presupuesto?.usd || 0; r += c.real?.usd || 0; }
    planeado.push(p);
    real.push(r);
  }
  return { dias, planeado, real, sinFecha: cs.length - conFecha.length };
}

export function convertir(monto, v) {
  return { usd: monto * v.tasas.localUsd, casa: monto * v.tasas.localCasa };
}

export const FRANJAS = { 'manana': [360, 720], 'manana-tarde': [360, 1080], 'tarde': [720, 1080], 'noche': [1080, 1440] };
const ORDEN_FRANJA = ['manana', 'manana-tarde', 'tarde', 'noche'];
const pad2 = n => String(n).padStart(2, '0');

export function hoyISO(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function diasEntre(a, b) {
  const t = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((t(b) - t(a)) / 86400000);
}

export function estadoViaje(v, hoy) {
  const fechas = v.actividades.filter(a => a.fecha).map(a => a.fecha).sort();
  if (!fechas.length) return { fase: 'sin-datos', dia: null };
  const inicio = fechas[0], fin = fechas[fechas.length - 1];
  if (hoy < inicio) return { fase: 'antes', faltan: diasEntre(hoy, inicio), dia: inicio, inicio, fin };
  if (hoy > fin) return { fase: 'despues', dia: null, inicio, fin };
  return { fase: 'durante', dia: hoy, inicio, fin };
}

export function intervalo(a, v) {
  if (a.error || !a.fecha) return null;
  const base = FRANJAS[normalizar(a.franja)] || null;
  let ini = a.inicio;
  if (ini === null && a.id !== undefined) {
    const r = v.reservas.find(x => x.actividadId === a.id && x.hora !== null);
    if (r) ini = r.hora;
  }
  const fin = a.fin;
  if (ini !== null && fin !== null) return { ini, fin };
  if (ini !== null) return { ini, fin: base && base[1] > ini ? base[1] : ini + 60 };
  if (fin !== null) return { ini: base && base[0] < fin ? base[0] : fin - 60, fin };
  return base ? { ini: base[0], fin: base[1] } : null;
}

const ordenFranja = a => { const i = ORDEN_FRANJA.indexOf(normalizar(a.franja)); return i < 0 ? ORDEN_FRANJA.length : i; };

export function actividadesDelDia(v, fecha) {
  return v.actividades
    .filter(a => a.fecha === fecha)
    .map(a => ({ ...a, intervalo: intervalo(a, v), lugares: v.lugares.filter(l => l.actividadId === a.id) }))
    .sort((a, b) => (a.intervalo?.ini ?? 1e4) - (b.intervalo?.ini ?? 1e4) || ordenFranja(a) - ordenFranja(b) || a.id - b.id);
}

export function reservasDelDia(v, fecha) {
  return v.reservas.filter(r => r.fecha === fecha).sort((a, b) => (a.hora ?? 1e4) - (b.hora ?? 1e4));
}

const solapan = (x, y) => x.ini < y.fin && y.ini < x.fin;

export function choques(v) {
  const res = [];
  const porDia = new Map();
  for (const a of v.actividades) {
    const i = intervalo(a, v);
    if (!i) continue;
    if (!porDia.has(a.fecha)) porDia.set(a.fecha, []);
    porDia.get(a.fecha).push({ id: a.id, ...i });
  }
  const dias = [...porDia.keys()].sort();
  for (const fecha of dias) {
    const lista = porDia.get(fecha).sort((a, b) => a.id - b.id);
    for (let i = 0; i < lista.length; i++)
      for (let j = i + 1; j < lista.length; j++)
        if (solapan(lista[i], lista[j])) res.push({ fecha, ids: [lista[i].id, lista[j].id] });
  }
  const idsAct = new Set(v.actividades.map(a => a.id));
  for (const r of v.reservas) {
    if (r.hora === null || !r.fecha || (r.actividadId !== null && idsAct.has(r.actividadId))) continue;
    for (const a of porDia.get(r.fecha) || []) if (a.ini <= r.hora && r.hora < a.fin) res.push({ fecha: r.fecha, ids: [a.id], reservaId: r.id });
  }
  return res;
}

export function choquesDe(v, cand) {
  const i = intervalo({ error: null, ...cand }, v);
  if (!i) return [];
  return v.actividades
    .filter(a => a.fecha === cand.fecha && a.id !== cand.id)
    .map(a => ({ a, i: intervalo(a, v) }))
    .filter(x => x.i && solapan(i, x.i))
    .map(x => ({ id: x.a.id, actividad: x.a.actividad, ...x.i }));
}

export function idsEnChoque(lista) {
  return new Set(lista.flatMap(c => c.ids));
}

export function diasDelItinerario(v) {
  const fechas = [...new Set(v.actividades.filter(a => a.fecha).map(a => a.fecha))].sort();
  return fechas.map(fecha => {
    const actividades = actividadesDelDia(v, fecha);
    return { fecha, ciudad: actividades[0]?.ciudad || '', actividades };
  });
}
