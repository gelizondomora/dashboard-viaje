import { abrirFormulario } from './forms.js';
import { CATEGORIAS, choquesDe, costosAgrupados, repartoDe } from './compute.js';
import { leerHora } from './parse.js';
import { hora, horaInput, fechaCorta } from './formato.js';

const FRANJAS_OPC = ['Mañana', 'Mañana-Tarde', 'Tarde', 'Noche'].map(x => ({ valor: x, texto: x }));

export function montoAValores(m, prefijo, casa) {
  const usd = `${prefijo} USD`, loc = `${prefijo} ${casa}`;
  if (m.cantidad === '') return { [usd]: '', [loc]: '' };
  return m.moneda === 'USD' ? { [usd]: m.cantidad, [loc]: '' } : { [usd]: '', [loc]: m.cantidad };
}

// "Partida ID" solo se escribe si se eligió una partida o si hay que limpiar una anterior (conPartida),
// para que la edición funcione aunque la hoja todavía no tenga esa columna.
// "Reparto" sigue la misma regla: solo se escribe si hay un reparto desigual o si hay que limpiar uno anterior.
export function costoAValores(f, casa, { conPartida = false, conReparto = false, conPago = false } = {}) {
  const valores = {
    'Detalle': f.detalle, 'Categoría': f.categoria, 'Fecha': f.fecha, 'Efectivo?': f.efectivo ? 'Si' : '',
    ...montoAValores(f.presupuesto, 'Presupuesto', casa), ...montoAValores(f.real, 'Real', casa),
  };
  if (f.partida !== undefined && f.partida !== '') valores['Partida ID'] = Number(f.partida);
  else if (conPartida) valores['Partida ID'] = '';
  if (f.reparto) valores['Reparto'] = f.reparto;
  else if (conReparto) valores['Reparto'] = '';
  // "Pagó" vacío = automático (quien tiene el 100 %, si no la persona 1); solo se escribe si alguien se eligió a mano.
  if (f.pago) valores['Pagó'] = f.pago;
  else if (conPago) valores['Pagó'] = '';
  return valores;
}

// Porcentajes por persona → texto de la columna Reparto. Partes iguales → '' (es el comportamiento por defecto).
export function repartoATexto(porcentajes, nombres) {
  const igual = 100 / nombres.length;
  if (porcentajes.every(p => Math.abs(p - igual) < 0.01)) return '';
  return nombres.map((n, i) => `${n}=${porcentajes[i]}`).join(';');
}

const PCT_PREDEFINIDOS = ['100', '50', '0'];
const pctTexto = fraccion => String(Math.round(fraccion * 10000) / 100);
const leerPct = t => { const n = Number(String(t).replace('%', '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };

export function actividadAValores(f) {
  return {
    'Fechas': f.fecha, 'Tiempo': f.franja, 'Hora inicio': f.inicio, 'Hora fin': f.fin, 'Ciudad': f.ciudad,
    'Actividad': f.actividad, 'Obligatorio/Opcional': f.opcional ? 'Opcional' : 'Obligatorio',
  };
}

export function lugarAValores(f, actividadId) {
  return { 'Actividad ID': actividadId, 'Lugar': f.lugar, 'Dirección / Mapa': f.mapa, 'Notas': f.notas, 'Hecho': f.hecho ? 'Si' : '' };
}

export function reservaAValores(f) {
  return {
    'Tour': f.tour, 'Fecha y hora': f.fecha ? (f.hora ? `${f.fecha} ${f.hora}` : f.fecha) : '', 'Recogida': f.recogida,
    'Enlace': f.enlace, 'Actividad ID': f.actividad === '' ? '' : Number(f.actividad),
  };
}

// `pre.partidaId` abre un gasto nuevo dentro de una partida: hereda su categoría y "Pagado en efectivo".
export function editarCosto(v, costo, { guardar, eliminar }, pre = {}) {
  const monedas = ['USD', v.monedaCasa];
  const inicial = m => (m ? { cantidad: m.cantidad, moneda: m.moneda } : { cantidad: '', moneda: 'USD' });
  const grupos = costosAgrupados(v);
  const tieneHijos = costo && grupos.some(g => g.costo.id === costo.id && g.hijos.length);
  const candidatas = grupos.map(g => g.costo).filter(c => c.presupuesto && c.id !== costo?.id);
  const partida = candidatas.find(c => c.id === (costo?.partidaId ?? pre.partidaId));
  const campos = [
    { nombre: 'real', etiqueta: 'Real (lo que pagaste)', tipo: 'monto', monedas, valor: inicial(costo?.real) },
    { nombre: 'detalle', etiqueta: 'Detalle', tipo: 'texto', requerido: true, valor: costo?.detalle },
    { nombre: 'categoria', etiqueta: 'Categoría', tipo: 'lista', opciones: CATEGORIAS.map(c => ({ valor: c, texto: c })), valor: costo?.categoria || partida?.categoria || 'Otros' },
    { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', valor: costo?.fecha || '' },
    { nombre: 'efectivo', etiqueta: 'Pagado en efectivo', tipo: 'si-no', valor: costo ? costo.efectivo : partida?.efectivo },
  ];
  // Una partida que ya tiene gastos hijos no puede pasar a ser hija de otra.
  if (!tieneHijos && candidatas.length) {
    campos.push({ nombre: 'partida', etiqueta: 'Partida (presupuesto del que descuenta)', tipo: 'lista', valor: partida?.id ?? '',
      opciones: [{ valor: '', texto: '(ninguna: gasto independiente)' }, ...candidatas.map(c => ({ valor: c.id, texto: c.detalle }))] });
  }
  if (!partida) campos.push({ nombre: 'presupuesto', etiqueta: 'Presupuesto', tipo: 'monto', monedas, valor: inicial(costo?.presupuesto) });
  // Reparto por persona: 100 / 50 / 0 u otro porcentaje. Por defecto, el del gasto, el de su partida o partes iguales.
  const nombres = v.personasNombres;
  const conPersonas = nombres.length > 1;
  if (conPersonas) {
    const actual = repartoDe(costo || { reparto: null }, v, partida);
    nombres.forEach((n, i) => campos.push({
      nombre: `rep${i}`, etiqueta: `% que paga ${n}`, tipo: 'lista-otra', opciones: PCT_PREDEFINIDOS,
      textoOtra: 'Otro %…', placeholderOtra: 'Porcentaje, por ejemplo 33.3', valor: pctTexto(actual[n]),
    }));
    campos.push({
      nombre: 'pago', etiqueta: 'Pagó', tipo: 'lista', valor: costo?.pago ? (nombres.find(n => n.toLowerCase() === costo.pago.toLowerCase()) ?? '') : '',
      opciones: [{ valor: '', texto: `Automático (quien tiene el 100 %; si no, ${nombres[0]})` }, ...nombres.map(n => ({ valor: n, texto: n }))],
    });
  }
  const porcentajes = f => nombres.map((_, i) => leerPct(f[`rep${i}`]));
  abrirFormulario({
    titulo: costo ? 'Editar gasto' : partida ? `Nuevo gasto en ${partida.detalle}` : 'Nuevo gasto',
    campos,
    validar: f => {
      if (!conPersonas) return null;
      const suma = porcentajes(f).reduce((a, b) => a + b, 0);
      return Math.abs(suma - 100) > 0.5 ? `Los porcentajes suman ${Math.round(suma * 100) / 100}%, no 100%.` : null;
    },
    onGuardar: f => guardar(costoAValores(
      { presupuesto: { cantidad: '', moneda: 'USD' }, ...f, reparto: conPersonas ? repartoATexto(porcentajes(f), nombres) : '' },
      v.monedaCasa, { conPartida: costo?.partidaId != null, conReparto: !!costo?.reparto, conPago: !!costo?.pago })),
    onEliminar: costo ? eliminar : null,
  });
}

// Personas del viaje: nombres separados por coma. Se guardan en Config.
export function editarPersonas(v, { guardar }) {
  abrirFormulario({
    titulo: 'Personas del viaje',
    campos: [{ nombre: 'nombres', etiqueta: 'Nombres, separados por coma', tipo: 'texto', requerido: true, valor: v.personasNombres.join(', ') }],
    validar: f => {
      const n = f.nombres.split(/[;,]/).map(s => s.trim()).filter(Boolean);
      return new Set(n.map(s => s.toLowerCase())).size !== n.length ? 'Hay nombres repetidos: los repartos se guardan por nombre.' : null;
    },
    onGuardar: f => {
      const n = f.nombres.split(/[;,]/).map(s => s.trim()).filter(Boolean);
      guardar({ 'Nombres de personas': n.join('; '), 'Personas': n.length });
    },
  });
}

export function editarEfectivo(v, { guardar }) {
  abrirFormulario({
    titulo: 'Efectivo inicial',
    campos: [{ nombre: 'monto', etiqueta: 'Efectivo con el que empieza el viaje (USD)', tipo: 'numero', requerido: true, valor: v.efectivoInicialUsd }],
    onGuardar: f => guardar({ 'Efectivo inicial (USD)': f.monto }),
  });
}

// `pre` rellena una actividad nueva (por ejemplo, desde un clic en el timeline): { fecha, franja, ciudad }.
export function editarActividad(v, act, { guardar, eliminar }, pre = {}) {
  const ciudades = [...new Set(v.actividades.map(a => a.ciudad).filter(Boolean))];
  abrirFormulario({
    titulo: act ? 'Editar actividad' : 'Nueva actividad',
    campos: [
      { nombre: 'actividad', etiqueta: 'Actividad', tipo: 'texto', requerido: true, valor: act?.actividad },
      { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true, valor: act?.fecha || pre.fecha || '' },
      { nombre: 'franja', etiqueta: 'Franja', tipo: 'lista', opciones: FRANJAS_OPC, valor: act?.franja || pre.franja || 'Mañana' },
      { nombre: 'inicio', etiqueta: 'Hora inicio (opcional)', tipo: 'hora', valor: horaInput(act?.inicio) },
      { nombre: 'fin', etiqueta: 'Hora fin (opcional)', tipo: 'hora', valor: horaInput(act?.fin) },
      { nombre: 'ciudad', etiqueta: 'Ciudad', tipo: 'lista-otra', opciones: ciudades, valor: act?.ciudad || pre.ciudad || ciudades.at(-1) || '' },
      { nombre: 'opcional', etiqueta: 'Opcional', tipo: 'si-no', valor: act?.opcional },
    ],
    validar: f => {
      const inicio = leerHora(f.inicio), fin = leerHora(f.fin);
      if (inicio !== null && fin !== null && fin <= inicio) return 'La hora fin es igual o anterior a la hora inicio.';
      const c = choquesDe(v, { id: act?.id, fecha: f.fecha, franja: f.franja, inicio: Number.isNaN(inicio) ? null : inicio, fin: Number.isNaN(fin) ? null : fin });
      return c.length ? `Choca con ${c.map(x => `${x.actividad} (${hora(x.ini)}–${hora(x.fin)})`).join(', ')}.` : null;
    },
    onGuardar: f => guardar(actividadAValores(f)),
    onEliminar: act ? eliminar : null,
  });
}

export function editarLugar(v, actividadId, lugar, { guardar, eliminar }) {
  abrirFormulario({
    titulo: lugar ? 'Editar lugar' : 'Nuevo lugar',
    campos: [
      { nombre: 'lugar', etiqueta: 'Lugar', tipo: 'texto', requerido: true, valor: lugar?.lugar },
      { nombre: 'mapa', etiqueta: 'Dirección o enlace de Maps', tipo: 'texto', valor: lugar?.mapa },
      { nombre: 'notas', etiqueta: 'Notas', tipo: 'area', valor: lugar?.notas },
      { nombre: 'hecho', etiqueta: 'Hecho', tipo: 'si-no', valor: lugar?.hecho },
    ],
    onGuardar: f => guardar(lugarAValores(f, actividadId)),
    onEliminar: lugar ? eliminar : null,
  });
}

export function editarReserva(v, reserva, { guardar, eliminar }) {
  const actividades = v.actividades.filter(a => a.fecha).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id);
  abrirFormulario({
    titulo: reserva ? 'Editar reserva' : 'Nueva reserva',
    campos: [
      { nombre: 'tour', etiqueta: 'Tour o reserva', tipo: 'texto', requerido: true, valor: reserva?.tour },
      { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', valor: reserva?.fecha || '' },
      { nombre: 'hora', etiqueta: 'Hora', tipo: 'hora', valor: horaInput(reserva?.hora) },
      { nombre: 'recogida', etiqueta: 'Recogida', tipo: 'texto', valor: reserva?.recogida },
      { nombre: 'enlace', etiqueta: 'Enlace', tipo: 'texto', valor: reserva?.enlace },
      { nombre: 'actividad', etiqueta: 'Actividad del itinerario', tipo: 'lista', valor: reserva?.actividadId ?? '',
        opciones: [{ valor: '', texto: '(ninguna)' }, ...actividades.map(a => ({ valor: a.id, texto: `${fechaCorta(a.fecha)} · ${a.actividad}` }))] },
    ],
    onGuardar: f => guardar(reservaAValores(f)),
    onEliminar: reserva ? eliminar : null,
  });
}
