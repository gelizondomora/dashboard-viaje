import { ejecutar } from './t.js';
import './entorno.test.js';
import './codigo.test.js';

await ejecutar(typeof globalThis.probarTodo === 'function' ? globalThis.probarTodo() : []);
