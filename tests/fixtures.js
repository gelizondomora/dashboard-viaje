import { crearServidorFalso } from '../js/servidor-falso.js';

export const libroEjemplo = () => globalThis.migrarLibro(globalThis.LIBRO_ORIGINAL, globalThis.ENLACES_ORIGINALES, globalThis.DATOS_EJEMPLO);
export const servidorEjemplo = () => crearServidorFalso(libroEjemplo());
export const rawEjemplo = () => servidorEjemplo().leer();

export function conValores(raw, tabla, id, valores) {
  const r = structuredClone(raw);
  Object.assign(r.tablas[tabla].filas.find(f => f.id === id).valores, valores);
  return r;
}

export function conFila(raw, tabla, id, valores) {
  const r = structuredClone(raw);
  const base = {};
  for (const h of r.tablas[tabla].encabezados) if (h !== 'ID') base[h] = '';
  r.tablas[tabla].filas.push({ id, valores: { ...base, ...valores } });
  return r;
}
