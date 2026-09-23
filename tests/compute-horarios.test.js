import { prueba, igual } from './t.js';
import { parsearDatos } from '../js/parse.js';
import { hoyISO, estadoViaje, intervalo, actividadesDelDia, reservasDelDia, choques, choquesDe, diasDelItinerario } from '../js/compute.js';
import { rawEjemplo, conValores, conFila } from './fixtures.js';

const viaje = (raw = rawEjemplo()) => parsearDatos(raw);
const act = (v, id) => v.actividades.find(a => a.id === id);

prueba('hoy: fecha local aunque sea casi medianoche', () => {
  igual(hoyISO(new Date(2026, 8, 29, 23, 30)), '2026-09-29');
});
prueba('hoy: antes, durante y después del viaje', () => {
  const v = viaje();
  igual(estadoViaje(v, '2026-09-23'), { fase: 'antes', faltan: 4, dia: '2026-09-27', inicio: '2026-09-27', fin: '2026-10-06' });
  igual(estadoViaje(v, '2026-09-29').fase, 'durante');
  igual(estadoViaje(v, '2026-09-29').dia, '2026-09-29');
  igual(estadoViaje(v, '2026-10-07').fase, 'despues');
});
prueba('hoy: actividades ordenadas por hora y reservas del día', () => {
  const v = viaje();
  igual(actividadesDelDia(v, '2026-09-28').map(a => a.id), [3, 2]);
  igual(actividadesDelDia(v, '2026-09-30').map(a => a.id), [6, 5]);
  igual(reservasDelDia(v, '2026-09-29').map(r => r.id), [2]);
});
prueba('intervalo: por franja, por reserva vinculada y por horas', () => {
  let raw = conValores(rawEjemplo(), 'Itinerario', 9, { 'Hora inicio': '19:00' });
  raw = conValores(raw, 'Itinerario', 7, { 'Hora fin': '15:00' });
  raw = conFila(raw, 'Itinerario', 14, { 'Fechas': '2026-10-01', 'Tiempo': 'Tarde', 'Hora inicio': '19:00', 'Actividad': 'X' });
  const v = viaje(raw);
  igual(intervalo(act(v, 1), v), { ini: 720, fin: 1080 });
  igual(intervalo(act(v, 4), v), { ini: 480, fin: 1080 });
  igual(intervalo(act(v, 9), v), { ini: 1140, fin: 1440 });
  igual(intervalo(act(v, 7), v), { ini: 720, fin: 900 });
  igual(intervalo(act(v, 14), v), { ini: 1140, fin: 1200 });
});
prueba('choques: los datos reales no tienen choques', () => {
  igual(choques(viaje()), []);
});
prueba('choques: Mañana-Tarde choca con Tarde el mismo día', () => {
  const v = viaje(conFila(rawEjemplo(), 'Itinerario', 14, { 'Fechas': '2026-09-29', 'Tiempo': 'Tarde', 'Actividad': 'Café' }));
  igual(choques(v), [{ fecha: '2026-09-29', ids: [4, 14] }]);
});
prueba('choques: bordes que se tocan no chocan', () => {
  const v = viaje(conFila(rawEjemplo(), 'Itinerario', 14, { 'Fechas': '2026-10-04', 'Hora inicio': '12:00', 'Hora fin': '14:00', 'Actividad': 'Almuerzo' }));
  igual(choques(v), []);
});
prueba('choques: reserva sin vincular dentro de una actividad', () => {
  const v = viaje(conFila(rawEjemplo(), 'Reservas', 3, { 'Tour': 'Graffiti tour', 'Fecha y hora': '2026-10-04 9:00' }));
  igual(choques(v), [{ fecha: '2026-10-04', ids: [11], reservaId: 3 }]);
});
prueba('choques: hora fin antes de inicio se excluye', () => {
  const v = viaje(conValores(rawEjemplo(), 'Itinerario', 4, { 'Hora inicio': '15:00', 'Hora fin': '14:00' }));
  igual([act(v, 4).error, intervalo(act(v, 4), v), choques(v)], ['hora fin antes de inicio', null, []]);
});
prueba('choquesDe: aviso para una actividad candidata', () => {
  const v = viaje();
  igual(choquesDe(v, { fecha: '2026-10-02', franja: 'Noche', inicio: null, fin: null }), []);
  igual(choquesDe(v, { fecha: '2026-10-02', franja: 'Tarde', inicio: null, fin: null }), [{ id: 8, actividad: 'Guatapé desde Medellín', ini: 420, fin: 1080 }]);
  igual(choquesDe(v, { id: 8, fecha: '2026-10-02', franja: 'Mañana-Tarde', inicio: null, fin: null }), []);
});
prueba('itinerario: días con ciudad', () => {
  const d = diasDelItinerario(viaje());
  igual([d.length, d[0].fecha, d[0].ciudad, d[5].ciudad], [10, '2026-09-27', 'Bogota', 'Medellin']);
});
