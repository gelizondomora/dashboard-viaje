import { prueba, verdadero } from './t.js';

prueba('Codigo.gs carga y define los puntos de entrada', () => {
  for (const f of ['doGet', 'doPost', 'prepararHoja', 'leerLibro_', 'ejecutarEnHoja_']) verdadero(typeof globalThis[f] === 'function', `falta ${f}`);
});
