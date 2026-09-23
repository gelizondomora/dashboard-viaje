import { normalizar } from './parse.js';

export const CATEGORIAS = ['Transporte', 'Hospedaje', 'Comida', 'Tours', 'Compras', 'Otros'];

const validos = v => v.costos.filter(c => !c.error);
const suma = (lista, f) => lista.reduce((t, x) => { const m = f(x); return m ? { usd: t.usd + m.usd, casa: t.casa + m.casa } : t; }, { usd: 0, casa: 0 });
const dividir = (m, n) => ({ usd: m.usd / n, casa: m.casa / n });

export function totales(v) {
  const cs = validos(v);
  const conReal = cs.filter(c => c.real);
  const presupuesto = suma(cs, c => c.presupuesto);
  const real = suma(conReal, c => c.real);
  const planDeReales = suma(conReal, c => c.presupuesto);
  return {
    presupuesto, real,
    diferencia: { usd: real.usd - planDeReales.usd, casa: real.casa - planDeReales.casa },
    conReal: conReal.length, pendientes: cs.length - conReal.length,
    porPersona: { presupuesto: dividir(presupuesto, v.personas), real: dividir(real, v.personas) },
  };
}

export function efectivoRestante(v) {
  const gastado = suma(validos(v).filter(c => c.efectivo), c => c.real || c.presupuesto);
  const usd = v.efectivoInicialUsd - gastado.usd;
  return { usd, casa: usd * v.tasas.usdCasa, gastadoUsd: gastado.usd };
}

export function porCategoria(v) {
  const m = new Map();
  for (const c of validos(v)) {
    const k = c.categoria || 'Otros';
    const e = m.get(k) || { categoria: k, presupuestoUsd: 0, realUsd: 0 };
    e.presupuestoUsd += c.presupuesto?.usd || 0;
    e.realUsd += c.real?.usd || 0;
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
