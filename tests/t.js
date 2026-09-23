const pruebas = [];

export function prueba(nombre, fn) { pruebas.push({ nombre, fn }); }

export function igual(real, esperado, msg = '') {
  const a = JSON.stringify(real), b = JSON.stringify(esperado);
  if (a !== b) throw new Error(`${msg} esperado ${b}, obtenido ${a}`.trim());
}

export function cerca(real, esperado, tol = 0.005, msg = '') {
  if (typeof real !== 'number' || Math.abs(real - esperado) > tol) throw new Error(`${msg} esperado ≈${esperado}, obtenido ${real}`.trim());
}

export function verdadero(v, msg = 'se esperaba verdadero') { if (!v) throw new Error(msg); }

export async function ejecutar(extras = []) {
  const fallos = [];
  let ok = 0;
  for (const p of pruebas) {
    try { await p.fn(); ok++; } catch (e) { fallos.push(`${p.nombre}: ${e.message}`); }
  }
  for (const r of extras) { if (r.ok) ok++; else fallos.push(`${r.nombre}: ${r.error}`); }
  document.getElementById('resumen').textContent = `RESUMEN: ${ok} ok, ${fallos.length} fallas`;
  document.getElementById('fallos').textContent = fallos.join('\n');
}
