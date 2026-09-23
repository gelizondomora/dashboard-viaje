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
    if (e.name === 'AbortError') throw Object.assign(new Error('tiempo de espera agotado'), { red: true });
    if (e instanceof TypeError) e.red = true;
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

/* Traduce un error a lo que ve la persona. Un fallo de red sin datos previos suele ser una URL o un acceso mal configurado. */
export function mensajeError(e, hayDatos) {
  if (e.autorizacion) return { tipo: 'clave', texto: 'La clave no es correcta. Revísala en Ajustes.' };
  if (e.configuracion) return { tipo: 'config', texto: e.message };
  if (e.red && !hayDatos) return { tipo: 'config', texto: 'No se pudo contactar el script. Revisa que la URL termine en /exec y que el acceso sea "Cualquier usuario"; si todo está bien, revisa tu conexión.' };
  return { tipo: 'sin-conexion', texto: `No se pudieron cargar los datos (${e.message}).` };
}
