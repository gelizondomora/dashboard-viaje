export function crearMemoria() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); } };
}

function almacenLocal() {
  try { return globalThis.localStorage || crearMemoria(); } catch { return crearMemoria(); }
}

export function crearStore(clave = 'dashboard-viaje', storage = almacenLocal()) {
  return {
    cargar() {
      let d = {};
      try { d = JSON.parse(storage.getItem(clave)) || {}; } catch { d = {}; }
      return { raw: d.raw || null, ops: d.ops || [], ajustes: d.ajustes || { url: '', clave: '' } };
    },
    guardar(estado) {
      try { storage.setItem(clave, JSON.stringify({ raw: estado.raw, ops: estado.ops, ajustes: estado.ajustes })); return true; } catch { return false; }
    },
  };
}
