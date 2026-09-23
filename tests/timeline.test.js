import { prueba, igual, verdadero } from './t.js';
import { parsearDatos } from '../js/parse.js';
import { asignarCarriles, renderTimeline, franjaEnPosicion } from '../js/timeline.js';
import { rawEjemplo } from './fixtures.js';

prueba('timeline: carriles para bloques que se solapan', () => {
  igual(asignarCarriles([{ ini: 360, fin: 720 }, { ini: 600, fin: 800 }, { ini: 720, fin: 900 }]), [0, 1, 0]);
});
prueba('timeline: dibuja un bloque por actividad y marca choques', () => {
  const html = renderTimeline(parsearDatos(rawEjemplo()), new Set([4]));
  igual((html.match(/class="bloque /g) || []).length, 13);
  verdadero(html.includes('data-bloque="4"') && html.includes('en-choque'), 'falta el bloque en choque');
  verdadero(html.includes('Bogota') && html.includes('Medellin'), 'falta la leyenda de ciudades');
});
prueba('timeline: la posición del clic da la franja', () => {
  igual([franjaEnPosicion(0), franjaEnPosicion(0.3), franjaEnPosicion(0.34), franjaEnPosicion(0.66), franjaEnPosicion(0.7), franjaEnPosicion(1)], ['Mañana', 'Mañana', 'Tarde', 'Tarde', 'Noche', 'Noche']);
});
prueba('timeline: cada día tiene una pista para crear actividades', () => {
  const html = renderTimeline(parsearDatos(rawEjemplo()), new Set());
  igual((html.match(/data-accion="nueva-en-timeline"/g) || []).length, 10);
  verdadero(html.includes('data-fecha="2026-09-27" data-ciudad="Bogota"'), 'falta fecha/ciudad en la pista');
});
