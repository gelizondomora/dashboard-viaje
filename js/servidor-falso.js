// Apps Script simulado en memoria sobre Logica.gs (cargado como script global). Se usa en pruebas y en ?demo.
const TABLAS = ['Costos', 'Itinerario', 'Lugares', 'Reservas'];

export function crearServidorFalso(libroInicial) {
  const g = globalThis;
  let libro = JSON.parse(JSON.stringify(libroInicial));
  let caido = false;
  let fallarDespues = false;
  const recibidos = [];
  return {
    get libro() { return libro; },
    set caido(v) { caido = v; },
    set fallarDespues(v) { fallarDespues = v; },
    recibidos,
    leer() {
      if (caido) throw new Error('sin conexión');
      return {
        ok: true,
        leidoEn: new Date().toISOString(),
        config: g.configComoObjeto(libro.Config),
        tablas: Object.fromEntries(TABLAS.map(n => [n, g.tablaAObjetos(libro[n])])),
      };
    },
    enviar(ops) {
      if (caido) throw new Error('sin conexión');
      const copia = JSON.parse(JSON.stringify(ops));
      recibidos.push(copia);
      const r = g.procesarLote(libro, copia, new Date().toISOString());
      libro = r.libro;
      libro._Registro = libro._Registro.concat(r.nuevosRegistros);
      if (fallarDespues) { fallarDespues = false; throw new Error('respuesta perdida'); }
      return r.resultados;
    },
  };
}
