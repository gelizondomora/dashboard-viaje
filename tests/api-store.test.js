import { prueba, igual } from './t.js';
import { crearApi, mensajeError } from '../js/api.js';
import { crearStore, crearMemoria } from '../js/store.js';

const respuesta = json => Promise.resolve({ ok: true, status: 200, json: async () => json });
async function error(fn) { try { await fn(); } catch (e) { return e; } return null; }

prueba('api: leer arma la URL con la clave', async () => {
  let url = null;
  const api = crearApi({ url: 'https://x/exec', clave: 'a b' }, { fetchFn: u => { url = u; return respuesta({ ok: true, tablas: {} }); } });
  igual((await api.leer()).ok, true);
  igual(url, 'https://x/exec?op=leer&clave=a%20b');
});
prueba('api: enviar hace POST text/plain con clave y ops', async () => {
  let pedido = null;
  const api = crearApi({ url: 'https://x/exec', clave: 'k' }, { fetchFn: (u, o) => { pedido = o; return respuesta({ ok: true, resultados: [{ opId: '1', ok: true }] }); } });
  igual(await api.enviar([{ opId: '1' }]), [{ opId: '1', ok: true }]);
  igual([pedido.method, pedido.headers['Content-Type'], JSON.parse(pedido.body)], ['POST', 'text/plain;charset=utf-8', { clave: 'k', ops: [{ opId: '1' }] }]);
});
prueba('api: "no autorizado" se marca como error de autorización', async () => {
  const api = crearApi({ url: 'u', clave: 'mala' }, { fetchFn: () => respuesta({ ok: false, error: 'no autorizado' }) });
  const e = await error(() => api.leer());
  igual([e.message, e.autorizacion], ['no autorizado', true]);
});
prueba('api: una respuesta que no es JSON da un mensaje claro', async () => {
  const api = crearApi({ url: 'u', clave: 'k' }, { fetchFn: () => Promise.resolve({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } }) });
  const e = await error(() => api.leer());
  igual([e.message, e.configuracion], ['El script no devolvió datos válidos: revisa el despliegue (acceso "Cualquier usuario").', true]);
});
prueba('api: tiempo de espera agotado', async () => {
  const colgado = (u, o) => new Promise((_, rechazar) => o.signal.addEventListener('abort', () => rechazar(new DOMException('abortado', 'AbortError'))));
  const e = await error(() => crearApi({ url: 'u', clave: 'k' }, { timeout: 20, fetchFn: colgado }).leer());
  igual(e.message, 'tiempo de espera agotado');
});
prueba('store: guarda y carga solo lo persistente', () => {
  const s = crearStore('k', crearMemoria());
  igual(s.guardar({ raw: { a: 1 }, ops: [{ opId: 'x' }], ajustes: { url: 'u', clave: 'c' }, pestana: 'hoy' }), true);
  igual(s.cargar(), { raw: { a: 1 }, ops: [{ opId: 'x' }], ajustes: { url: 'u', clave: 'c' } });
});
prueba('store: sin almacenamiento disponible no rompe', () => {
  const roto = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } };
  const s = crearStore('k', roto);
  igual(s.cargar(), { raw: null, ops: [], ajustes: { url: '', clave: '' } });
  igual(s.guardar({ raw: null, ops: [], ajustes: {} }), false);
});
prueba('api: fallo de red se marca y el mensaje depende de si ya hubo datos', async () => {
  const api = crearApi({ url: 'u', clave: 'k' }, { fetchFn: () => Promise.reject(new TypeError('Failed to fetch')) });
  const e = await error(() => api.leer());
  igual(e.red, true);
  igual(mensajeError(e, false).tipo, 'config');
  igual(mensajeError(e, true).tipo, 'sin-conexion');
  igual(mensajeError(Object.assign(new Error('no autorizado'), { autorizacion: true }), true).tipo, 'clave');
});
