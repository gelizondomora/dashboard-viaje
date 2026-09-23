import { abrirFormulario } from './forms.js';
import { CATEGORIAS, choquesDe } from './compute.js';
import { leerHora } from './parse.js';
import { hora, horaInput, fechaCorta } from './formato.js';

const FRANJAS_OPC = ['Mañana', 'Mañana-Tarde', 'Tarde', 'Noche'].map(x => ({ valor: x, texto: x }));

export function montoAValores(m, prefijo, casa) {
  const usd = `${prefijo} USD`, loc = `${prefijo} ${casa}`;
  if (m.cantidad === '') return { [usd]: '', [loc]: '' };
  return m.moneda === 'USD' ? { [usd]: m.cantidad, [loc]: '' } : { [usd]: '', [loc]: m.cantidad };
}

export function costoAValores(f, casa) {
  return {
    'Detalle': f.detalle, 'Categoría': f.categoria, 'Fecha': f.fecha, 'Efectivo?': f.efectivo ? 'Si' : '',
    ...montoAValores(f.presupuesto, 'Presupuesto', casa), ...montoAValores(f.real, 'Real', casa),
  };
}

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

export function editarCosto(v, costo, { guardar, eliminar }) {
  const monedas = ['USD', v.monedaCasa];
  const inicial = m => (m ? { cantidad: m.cantidad, moneda: m.moneda } : { cantidad: '', moneda: 'USD' });
  abrirFormulario({
    titulo: costo ? 'Editar gasto' : 'Nuevo gasto',
    campos: [
      { nombre: 'real', etiqueta: 'Real (lo que pagaste)', tipo: 'monto', monedas, valor: inicial(costo?.real) },
      { nombre: 'detalle', etiqueta: 'Detalle', tipo: 'texto', requerido: true, valor: costo?.detalle },
      { nombre: 'categoria', etiqueta: 'Categoría', tipo: 'lista', opciones: CATEGORIAS.map(c => ({ valor: c, texto: c })), valor: costo?.categoria || 'Otros' },
      { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', valor: costo?.fecha || '' },
      { nombre: 'efectivo', etiqueta: 'Pagado en efectivo', tipo: 'si-no', valor: costo?.efectivo },
      { nombre: 'presupuesto', etiqueta: 'Presupuesto', tipo: 'monto', monedas, valor: inicial(costo?.presupuesto) },
    ],
    onGuardar: f => guardar(costoAValores(f, v.monedaCasa)),
    onEliminar: costo ? eliminar : null,
  });
}

export function editarActividad(v, act, { guardar, eliminar }) {
  const ciudades = [...new Set(v.actividades.map(a => a.ciudad).filter(Boolean))];
  abrirFormulario({
    titulo: act ? 'Editar actividad' : 'Nueva actividad',
    campos: [
      { nombre: 'actividad', etiqueta: 'Actividad', tipo: 'texto', requerido: true, valor: act?.actividad },
      { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true, valor: act?.fecha || '' },
      { nombre: 'franja', etiqueta: 'Franja', tipo: 'lista', opciones: FRANJAS_OPC, valor: act?.franja || 'Mañana' },
      { nombre: 'inicio', etiqueta: 'Hora inicio (opcional)', tipo: 'hora', valor: horaInput(act?.inicio) },
      { nombre: 'fin', etiqueta: 'Hora fin (opcional)', tipo: 'hora', valor: horaInput(act?.fin) },
      { nombre: 'ciudad', etiqueta: 'Ciudad', tipo: 'texto', sugerencias: ciudades, valor: act?.ciudad || ciudades.at(-1) || '' },
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
