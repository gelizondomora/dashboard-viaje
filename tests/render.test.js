import { prueba, verdadero, igual } from './t.js';
import { parsearDatos } from '../js/parse.js';
import { renderHoy } from '../js/render-hoy.js';
import { renderItinerario } from '../js/render-itinerario.js';
import { renderReservas } from '../js/render-reservas.js';
import { renderCostos } from '../js/render-costos.js';
import { rawEjemplo, conValores } from './fixtures.js';

const v = () => parsearDatos(rawEjemplo());
const cuenta = (html, s) => html.split(s).length - 1;

prueba('render: Hoy durante el viaje con reserva y efectivo', () => {
  const h = renderHoy(v(), { hoy: '2026-09-29' });
  for (const s of ['Zipaquirá y Lago Guatavita', 'Recogida: Hotel', '$50.38', 'id="conv-monto"']) verdadero(h.includes(s), `falta ${s}`);
});
prueba('render: Hoy antes del viaje', () => {
  verdadero(renderHoy(v(), { hoy: '2026-09-23' }).includes('Faltan 4 días'));
});
prueba('render: Itinerario en lista y en timeline', () => {
  const l = renderItinerario(v(), { vista: 'lista', choques: [], hoy: '2026-09-29' });
  for (const s of ['Bogota', 'Medellin', 'Sin choques', 'class="dia hoy"']) verdadero(l.includes(s), `falta ${s}`);
  igual(cuenta(l, 'data-accion="editar-actividad"'), 13);
  const t = renderItinerario(v(), { vista: 'timeline', choques: [{ fecha: '2026-09-29', ids: [4, 5] }], hoy: '2026-09-29' });
  verdadero(t.includes('class="timeline"') && t.includes('⚠ 1 choque'));
});
prueba('render: Reservas y Costos', () => {
  igual(cuenta(renderReservas(v()), 'Abrir reserva'), 2);
  const c = renderCostos(v(), { filtro: '' });
  igual(cuenta(c, 'data-accion="editar-costo"'), 16);
  verdadero(c.includes('Presupuesto') && c.includes('id="filtro-categoria"'));
  igual(cuenta(renderCostos(v(), { filtro: 'Hospedaje' }), 'data-accion="editar-costo"'), 2);
});
prueba('render: el texto de la hoja se escapa', () => {
  const html = renderCostos(parsearDatos(conValores(rawEjemplo(), 'Costos', 1, { 'Detalle': '<img src=x>' })), { filtro: '' });
  verdadero(html.includes('&lt;img src=x&gt;') && !html.includes('<img src=x>'));
});
prueba('render: Costos incluye los tres gráficos', () => {
  const c = renderCostos(v(), { filtro: '' });
  for (const id of ['g-categorias', 'g-acumulado', 'g-efectivo']) verdadero(c.includes(`id="${id}"`), `falta ${id}`);
});
