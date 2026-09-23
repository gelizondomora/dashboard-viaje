async function pedir(fetchFn, url, opciones, timeout) {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), timeout);
  try {
    const resp = await fetchFn(url, { ...opciones, signal: control.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    let json;
    try { json = await resp.json(); } catch {
      const e = new Error('El script no devolvió datos válidos: revisa el despliegue (acceso "Cualquier usuario").');
      e.configuracion = true;
      throw e;
    }
    if (!json.ok) {
      const e = new Error(json.error || 'error desconocido');
      e.autorizacion = json.error === 'no autorizado';
      throw e;
    }
    return json;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('tiempo de espera agotado');
    throw e;
  } finally {
    clearTimeout(reloj);
  }
}

export function crearApi({ url, clave }, { timeout = 10000, fetchFn = (...a) => fetch(...a) } = {}) {
  return {
    leer: () => pedir(fetchFn, `${url}?op=leer&clave=${encodeURIComponent(clave)}`, {}, timeout),
    enviar: async ops => (await pedir(fetchFn, url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ clave, ops }),
    }, timeout)).resultados,
  };
}
