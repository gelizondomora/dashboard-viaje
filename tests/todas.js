import { ejecutar } from './t.js';
import './entorno.test.js';
import './codigo.test.js';
import './parse.test.js';
import './compute-dinero.test.js';
import './compute-horarios.test.js';
import './api-store.test.js';

await ejecutar(typeof globalThis.probarTodo === 'function' ? globalThis.probarTodo() : []);
