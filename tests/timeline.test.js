import { prueba, igual, verdadero } from './t.js';
import { parsearDatos } from '../js/parse.js';
import { asignarCarriles, renderTimeline } from '../js/timeline.js';
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
