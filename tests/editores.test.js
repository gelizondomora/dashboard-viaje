import { prueba, igual } from './t.js';
import { esc, dinero, hora, horaInput, fechaCorta, fechaLarga, hace } from '../js/formato.js';
import { abrirFormulario } from '../js/forms.js';
import { montoAValores, costoAValores, actividadAValores, lugarAValores, reservaAValores } from '../js/editores.js';

prueba('formato: dinero, horas y fechas', () => {
  igual([dinero(26.35, 'USD'), dinero(-50.38, 'USD'), dinero(1298836.3, 'CRC'), dinero(85000, 'COP'), dinero(null, 'USD')],
    ['$26.35', '-$50.38', '₡1,298,836', 'COP 85,000', '—']);
  igual([hora(420), hora(1440), horaInput(420), horaInput(null)], ['7:00', '24:00', '07:00', '']);
  igual([fechaCorta('2026-09-27'), fechaLarga('2026-09-27')], ['dom 27/9', 'domingo 27 de septiembre']);
  igual(hace('2026-09-23T10:00:00Z', new Date('2026-09-23T10:05:00Z')), 'hace 5 min');
  igual(esc('<b>"x"</b>'), '&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
});
prueba('editores: montos a columnas', () => {
  igual(montoAValores({ cantidad: 12, moneda: 'USD' }, 'Real', 'CRC'), { 'Real USD': 12, 'Real CRC': '' });
  igual(montoAValores({ cantidad: 5000, moneda: 'CRC' }, 'Real', 'CRC'), { 'Real USD': '', 'Real CRC': 5000 });
  igual(montoAValores({ cantidad: '', moneda: 'USD' }, 'Real', 'CRC'), { 'Real USD': '', 'Real CRC': '' });
});
prueba('editores: costo a columnas', () => {
  igual(costoAValores({ detalle: 'Taxi', categoria: 'Transporte', fecha: '2026-09-28', efectivo: true, presupuesto: { cantidad: '', moneda: 'USD' }, real: { cantidad: 12, moneda: 'USD' } }, 'CRC'), {
    'Detalle': 'Taxi', 'Categoría': 'Transporte', 'Fecha': '2026-09-28', 'Efectivo?': 'Si',
    'Presupuesto USD': '', 'Presupuesto CRC': '', 'Real USD': 12, 'Real CRC': '',
  });
});
prueba('editores: actividad, lugar y reserva a columnas', () => {
  igual(actividadAValores({ fecha: '2026-09-29', franja: 'Tarde', inicio: '14:00', fin: '', ciudad: 'Bogota', actividad: 'Café', opcional: true }), {
    'Fechas': '2026-09-29', 'Tiempo': 'Tarde', 'Hora inicio': '14:00', 'Hora fin': '', 'Ciudad': 'Bogota', 'Actividad': 'Café', 'Obligatorio/Opcional': 'Opcional',
  });
  igual(lugarAValores({ lugar: 'Tienda Vélez', mapa: '', notas: 'chaqueta', hecho: false }, 5), {
    'Actividad ID': 5, 'Lugar': 'Tienda Vélez', 'Dirección / Mapa': '', 'Notas': 'chaqueta', 'Hecho': '',
  });
  igual(reservaAValores({ tour: 'Tour', fecha: '2026-10-02', hora: '07:00', recogida: 'Hotel', enlace: '', actividad: '8' }), {
    'Tour': 'Tour', 'Fecha y hora': '2026-10-02 07:00', 'Recogida': 'Hotel', 'Enlace': '', 'Actividad ID': 8,
  });
});
prueba('formulario: el aviso no bloquea (segundo Guardar guarda)', () => {
  let guardado = null;
  abrirFormulario({
    titulo: 'Prueba',
    campos: [{ nombre: 'actividad', etiqueta: 'Actividad', tipo: 'texto', valor: 'Café', requerido: true }, { nombre: 'real', etiqueta: 'Real', tipo: 'monto', monedas: ['USD', 'CRC'], valor: { cantidad: 3, moneda: 'CRC' } }],
    validar: () => 'Choca con Guatapé.',
    onGuardar: v => { guardado = v; },
  });
  const dlg = document.getElementById('hoja');
  const form = dlg.querySelector('form');
  form.requestSubmit();
  igual([guardado, dlg.querySelector('.aviso-form').hidden, dlg.querySelector('[data-f=guardar]').textContent], [null, false, 'Guardar de todos modos']);
  form.requestSubmit();
  igual(guardado, { actividad: 'Café', real: { cantidad: 3, moneda: 'CRC' } });
  igual(dlg.open, false);
});
prueba('formulario: un campo requerido vacío no guarda', () => {
  let guardado = null;
  abrirFormulario({ titulo: 'Prueba', campos: [{ nombre: 'detalle', etiqueta: 'Detalle', tipo: 'texto', requerido: true }], onGuardar: v => { guardado = v; } });
  const dlg = document.getElementById('hoja');
  dlg.querySelector('form').requestSubmit();
  igual([guardado, dlg.querySelector('.aviso-form').textContent], [null, 'Falta: Detalle']);
  dlg.close();
});
prueba('formulario: lista con "Otra…" permite escribir un valor nuevo', () => {
  let guardado = null;
  abrirFormulario({ titulo: 'Prueba', campos: [{ nombre: 'ciudad', etiqueta: 'Ciudad', tipo: 'lista-otra', opciones: ['Bogota', 'Medellin'], valor: 'Medellin' }], onGuardar: v => { guardado = v; } });
  const dlg = document.getElementById('hoja');
  const form = dlg.querySelector('form');
  igual([...form.elements.ciudad.options].map(o => o.textContent), ['Bogota', 'Medellin', 'Otra ciudad…']);
  igual(form.elements.ciudad.value, 'Medellin');
  form.requestSubmit();
  igual(guardado, { ciudad: 'Medellin' });
  abrirFormulario({ titulo: 'Prueba', campos: [{ nombre: 'ciudad', etiqueta: 'Ciudad', tipo: 'lista-otra', opciones: ['Bogota', 'Medellin'], valor: 'Medellin' }], onGuardar: v => { guardado = v; } });
  const f2 = document.getElementById('hoja').querySelector('form');
  f2.elements.ciudad.value = '__otra';
  f2.elements.ciudad.dispatchEvent(new Event('change', { bubbles: true }));
  igual(f2.elements.ciudad__otra.hidden, false);
  f2.elements.ciudad__otra.value = ' Cartagena ';
  f2.requestSubmit();
  igual(guardado, { ciudad: 'Cartagena' });
});
