# Dashboard de Viaje (Fase 1) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un dashboard móvil (GitHub Pages) que lee y edita la hoja de Google Sheets del viaje a través de un Apps Script, con cola sin conexión, conversor, lugares, timeline con choques y gráficos de presupuesto contra real.

**Architecture:** Sitio estático con ES modules nativos, sin frameworks ni build. Un Apps Script en la hoja expone `doGet` (leer) y `doPost` (agregar, modificar o eliminar por ID, idempotente por `opId`). Toda la lógica que no depende de Google vive en funciones puras: `apps-script/Logica.gs` en el servidor y `js/parse.js`, `js/compute.js` y `js/queue.js` en el cliente. Todas se prueban en el navegador. `Logica.gs` también hace de "servidor falso" para las pruebas y para el modo demo.

**Tech Stack:** HTML/CSS/JS (ES2022, ES modules), Chart.js 4.4.4 (cdn.jsdelivr.net), Google Apps Script (V8), GitHub Pages, PowerShell 5.1 + Microsoft Edge headless para las pruebas.

**Spec:** `docs/superpowers/specs/2026-09-23-dashboard-viaje-design.md`

## Global Constraints

- Sin Node ni Python: las pruebas corren con `powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1` (Edge headless en `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`).
- Sin frameworks ni build. La única dependencia externa es Chart.js `4.4.4` desde `https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js`.
- Columnas identificadas **por encabezado**, comparadas sin mayúsculas ni tildes (`normalizar`).
- Nombres exactos de pestañas: `Config`, `Costos`, `Itinerario`, `Lugares`, `Reservas`, `_Registro`.
- Encabezados de Costos: `ID, Detalle, Categoría, Fecha, Efectivo?, Presupuesto USD, Presupuesto <casa>, Real USD, Real <casa>, Por Persona`, donde `<casa>` es la moneda de casa de Config (`CRC`).
- Categorías: `Transporte, Hospedaje, Comida, Tours, Compras, Otros`.
- Franjas: Mañana 6:00–12:00, Tarde 12:00–18:00, Noche 18:00–24:00, Mañana-Tarde 6:00–18:00.
- Timeout de red: 10 s. Toda lectura y escritura de `localStorage` va dentro de `try/catch`.
- El repositorio público **no contiene** la URL del script ni la clave. Esas dos se guardan solo en el teléfono.
- Con los datos del 2026-09-23 el efectivo restante debe dar **$50,38** y debe haber **0 choques**.
- Interfaz en español. Repo: `gelizondomora/dashboard-viaje`. URL: `https://gelizondomora.github.io/dashboard-viaje/`.
- Commits con la línea final `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Despliegue mal configurado.** Si el Apps Script devuelve HTML (una página de login) en vez de JSON, la persona espera un mensaje que diga "revisa el despliegue", no "sin conexión". → Prueba en Task 9.
2. **Uso a medianoche.** A las 23:30 en Colombia, "Hoy" debe seguir mostrando el día local, no el día UTC. → Prueba en Task 8.
3. **Una fila borrada en la hoja mientras un cambio esperaba en la cola.** Debe aparecer ⚠ con Reintentar y Descartar, nunca desaparecer en silencio. → Prueba en Task 10 (y aviso visible en Task 14).
4. **`localStorage` no disponible** (modo privado o bloqueado). La app debe funcionar igual, sin caché. → Prueba en Task 9.
5. **Encabezados con otra capitalización o sin tildes** ("categoria", "real crc"). La lectura y la escritura deben seguir funcionando. → Pruebas en Task 4 y Task 6.

## Orden de recorte

Si el tiempo no alcanza antes del 27 de septiembre, estas son las tareas que se pueden posponer, en este orden: **Task 15 (gráficos)**, luego **Task 12 (timeline)**. En Task 13, `renderItinerario` solo necesita la vista Lista para funcionar. Todo lo demás es la base: lectura, edición y cola.

## Estructura de archivos

```
tools/serve.ps1              servidor HTTP estático local (solo para pruebas)
tools/navegador.ps1          arranca el servidor + Edge headless: pruebas, volcado de DOM o captura
tools/iconos.ps1             genera icono-192.png e icono-512.png
apps-script/Logica.gs        lógica pura del servidor (migración, operaciones, lote idempotente)
apps-script/PruebasLogica.gs pruebas de Logica.gs + datos de ejemplo; probarTodo()
apps-script/Codigo.gs        pegamento con SpreadsheetApp: doGet, doPost, prepararHoja
js/parse.js                  puro: JSON del script → objetos del viaje
js/compute.js                puro: totales, efectivo, categorías, acumulado, hoy, intervalos, choques
js/queue.js                  puro: cola de operaciones, aplicación optimista, sincronizar
js/api.js                    fetch al Apps Script con timeout
js/store.js                  persistencia en localStorage con respaldo en memoria
js/servidor-falso.js         Logica.gs en memoria con la interfaz de api (pruebas y ?demo)
js/formato.js                esc, dinero, fechas, horas, marcas ⏳/⚠
js/forms.js                  formulario genérico en <dialog> (bottom sheet)
js/editores.js               formularios de cada entidad + mapeo a columnas de la hoja
js/timeline.js               timeline del itinerario
js/render-hoy.js, js/render-itinerario.js, js/render-reservas.js, js/render-costos.js
js/charts.js                 gráficos con Chart.js
js/main.js                   estado de la app, eventos, sincronización
index.html, styles.css, manifest.json, sw.js, icono.svg, icono-*.png
tests.html, tests/t.js, tests/todas.js, tests/fixtures.js, tests/*.test.js
```

`render.js` del spec se divide en un archivo por pantalla, para que cada uno sea pequeño.

**Estado de partida:** el repo git local ya existe en la raíz del proyecto (`main`, con el spec registrado) y tiene configurado el autor `gelizondomora <gelizondomora@gmail.com>`. `.gitignore` excluye `*.xlsx`. Todos los comandos se ejecutan desde la raíz del proyecto. En los pasos de captura, `$TMP` es el directorio scratchpad de la sesión.

---

### Task 1: Herramientas de prueba

**Files:**
- Create: `tools/serve.ps1`, `tools/navegador.ps1`, `tests/t.js`, `tests/todas.js`, `tests/entorno.test.js`, `tests.html`, `.gitattributes`

**Interfaces:**
- Produces: `tests/t.js` exporta `prueba(nombre, fn)`, `igual(real, esperado, msg?)`, `cerca(real, esperado, tol?, msg?)`, `verdadero(v, msg?)`, `ejecutar(extras)`. Todos los archivos `tests/*.test.js` se importan en `tests/todas.js`, junto a los demás imports y **antes** de la línea `await ejecutar(...)`. `tools/navegador.ps1 [-Pagina <ruta?query>] [-Modo pruebas|dom|captura] [-Salida archivo.png]` sale con código 0 si todo pasa y 1 si hay fallas.

- [ ] **Step 1: Crear `.gitattributes`**

```
* text=auto eol=lf
*.png binary
*.xlsx binary
```

- [ ] **Step 2: Crear `tools/serve.ps1`**

```powershell
param([string]$Root, [int]$Port = 8765)
$tipos = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.gs' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json; charset=utf-8'; '.svg' = 'image/svg+xml'
  '.png' = 'image/png'; '.ps1' = 'text/plain; charset=utf-8'; '.md' = 'text/plain; charset=utf-8'
}
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Port/")
$l.Start()
while ($l.IsListening) {
  $c = $l.GetContext()
  $ruta = [Uri]::UnescapeDataString($c.Request.Url.AbsolutePath.TrimStart('/'))
  if ($ruta -eq '') { $ruta = 'index.html' }
  $archivo = Join-Path $Root $ruta
  $c.Response.Headers.Add('Cache-Control', 'no-store')
  if (Test-Path $archivo -PathType Leaf) {
    $bytes = [IO.File]::ReadAllBytes($archivo)
    $ext = [IO.Path]::GetExtension($archivo)
    $c.Response.ContentType = $(if ($tipos[$ext]) { $tipos[$ext] } else { 'application/octet-stream' })
    $c.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } else { $c.Response.StatusCode = 404 }
  $c.Response.Close()
}
```

- [ ] **Step 3: Crear `tools/navegador.ps1`**

```powershell
param(
  [string]$Pagina = 'tests.html',
  [ValidateSet('pruebas', 'dom', 'captura')] [string]$Modo = 'pruebas',
  [string]$Salida = 'captura.png',
  [int]$Ancho = 390,
  [int]$Alto = 1400
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$raiz = Split-Path -Parent $PSScriptRoot
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$puerto = Get-Random -Minimum 20000 -Maximum 40000
$serve = Join-Path $PSScriptRoot 'serve.ps1'
$servidor = Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -PassThru -ArgumentList @(
  '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$serve`"", '-Root', "`"$raiz`"", '-Port', $puerto)
$codigo = 0
try {
  $listo = $false
  for ($i = 0; $i -lt 30 -and -not $listo; $i++) {
    Start-Sleep -Milliseconds 300
    try { Invoke-WebRequest -Uri "http://localhost:$puerto/tools/serve.ps1" -UseBasicParsing -TimeoutSec 2 | Out-Null; $listo = $true } catch { }
  }
  if (-not $listo) { throw 'El servidor local no arrancó.' }
  $tmp = Join-Path $env:TEMP ('dv-' + [guid]::NewGuid())
  $url = "http://localhost:$puerto/$Pagina"
  $argumentos = @('--headless', '--disable-gpu', '--no-first-run', "--user-data-dir=`"$tmp`"", '--virtual-time-budget=15000')
  if ($Modo -eq 'captura') {
    $destino = if ([IO.Path]::IsPathRooted($Salida)) { $Salida } else { Join-Path (Get-Location) $Salida }
    $argumentos += @("--window-size=$Ancho,$Alto", "--screenshot=`"$destino`"", "`"$url`"")
  } else {
    $argumentos += @('--dump-dom', "`"$url`"")
  }
  Start-Process -FilePath $edge -ArgumentList $argumentos -RedirectStandardOutput "$tmp.html" -RedirectStandardError "$tmp.err" -Wait -NoNewWindow
  if ($Modo -eq 'captura') {
    Write-Output "Captura guardada en $destino"
  } else {
    $dom = Get-Content "$tmp.html" -Raw -Encoding UTF8
    if ($Modo -eq 'dom') {
      Write-Output $dom
    } else {
      $m = [regex]::Match($dom, 'RESUMEN: (\d+) ok, (\d+) fallas')
      if (-not $m.Success) {
        Write-Output 'No se encontró el resumen de pruebas. DOM recibido:'; Write-Output $dom; $codigo = 2
      } else {
        Write-Output $m.Value
        $fallos = [regex]::Match($dom, '<pre id="fallos">([\s\S]*?)</pre>').Groups[1].Value
        if ($fallos) { Write-Output ([System.Net.WebUtility]::HtmlDecode($fallos)) }
        if ([int]$m.Groups[2].Value -gt 0) { $codigo = 1 }
      }
    }
  }
} finally {
  Stop-Process -Id $servidor.Id -Force -ErrorAction SilentlyContinue
}
exit $codigo
```

- [ ] **Step 4: Crear `tests/t.js`**

```js
const pruebas = [];

export function prueba(nombre, fn) { pruebas.push({ nombre, fn }); }

export function igual(real, esperado, msg = '') {
  const a = JSON.stringify(real), b = JSON.stringify(esperado);
  if (a !== b) throw new Error(`${msg} esperado ${b}, obtenido ${a}`.trim());
}

export function cerca(real, esperado, tol = 0.005, msg = '') {
  if (typeof real !== 'number' || Math.abs(real - esperado) > tol) throw new Error(`${msg} esperado ≈${esperado}, obtenido ${real}`.trim());
}

export function verdadero(v, msg = 'se esperaba verdadero') { if (!v) throw new Error(msg); }

export async function ejecutar(extras = []) {
  const fallos = [];
  let ok = 0;
  for (const p of pruebas) {
    try { await p.fn(); ok++; } catch (e) { fallos.push(`${p.nombre}: ${e.message}`); }
  }
  for (const r of extras) { if (r.ok) ok++; else fallos.push(`${r.nombre}: ${r.error}`); }
  document.getElementById('resumen').textContent = `RESUMEN: ${ok} ok, ${fallos.length} fallas`;
  document.getElementById('fallos').textContent = fallos.join('\n');
}
```

- [ ] **Step 5: Crear `tests/entorno.test.js`, `tests/todas.js` y `tests.html`**

`tests/entorno.test.js`:
```js
import { prueba, igual } from './t.js';

prueba('el entorno de pruebas funciona', () => igual(1 + 1, 2));
```

`tests/todas.js`:
```js
import { ejecutar } from './t.js';
import './entorno.test.js';

await ejecutar(typeof globalThis.probarTodo === 'function' ? globalThis.probarTodo() : []);
```

`tests.html`:
```html
<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><title>Pruebas</title></head>
<body>
<pre id="resumen">RESUMEN: pendiente</pre>
<pre id="fallos"></pre>
<dialog id="hoja"></dialog>
<script type="module" src="tests/todas.js"></script>
</body>
</html>
```

- [ ] **Step 6: Ejecutar las pruebas**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1`
Expected: `RESUMEN: 1 ok, 0 fallas` y código de salida 0.

- [ ] **Step 7: Comprobar que el runner detecta fallas**

Cambia temporalmente `igual(1 + 1, 2)` por `igual(1 + 1, 3)` y ejecuta el mismo comando.
Expected: `RESUMEN: 0 ok, 1 fallas`, una línea `el entorno de pruebas funciona: esperado 3, obtenido 2` y código de salida 1. Luego revierte el cambio.

- [ ] **Step 8: Commit**

```bash
git add .gitattributes tools tests tests.html
git commit -m "Add browser test harness (PowerShell server + headless Edge)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Logica.gs — utilidades y datos de ejemplo

**Files:**
- Create: `apps-script/Logica.gs`, `apps-script/PruebasLogica.gs`
- Modify: `tests.html` (cargar los dos `.gs` antes del módulo)

**Interfaces:**
- Produces (funciones globales de `Logica.gs`): `normalizar(s) → string`, `indiceColumna(encabezados, nombre) → int (-1 si no está)`, `filaVacia(fila) → bool`, `tablaAObjetos(valores2D) → {encabezados: string[], filas: [{id: number|null, valores: {encabezado: valor}}]}` (omite filas vacías y la columna ID de `valores`), `configComoObjeto(valores2D) → {clave: valor}`, `siguienteId(valores2D) → int`, `buscarFila(valores2D, id) → int (índice en el 2D, -1 si no está)`, `fechaAClave(v) → 'yyyy-mm-dd' | ''`, `horaDesdeTexto(texto) → 'H:MM' | ''`.
- Produces (globales de `PruebasLogica.gs`): `LIBRO_ORIGINAL` (hoja actual como 2D, fechas como texto), `ENLACES_ORIGINALES` (URL por fila de Reservas, índice 0 = encabezado), `DATOS_EJEMPLO = {nombre, personas, monedaLocal, monedaCasa}`, `pruebaLogica(nombre, fn)`, `igualL(real, esperado, msg?)`, `probarTodo() → [{nombre, ok, error?}]`.

- [ ] **Step 1: Crear `apps-script/PruebasLogica.gs` con el mini framework, los datos y las pruebas de utilidades**

Los enlaces de ejemplo son ficticios a propósito: el repo es público.

```js
/* Pruebas de Logica.gs. Corren en Apps Script (ejecuta probarTodo) y en el navegador (tests.html). */
var PRUEBAS_LOGICA = [];
function pruebaLogica(nombre, fn) { PRUEBAS_LOGICA.push({ nombre: nombre, fn: fn }); }
function igualL(real, esperado, msg) {
  const a = JSON.stringify(real), b = JSON.stringify(esperado);
  if (a !== b) throw new Error(((msg || '') + ' esperado ' + b + ', obtenido ' + a).trim());
}
function probarTodo() {
  const res = PRUEBAS_LOGICA.map(p => {
    try { p.fn(); return { nombre: 'gs/' + p.nombre, ok: true }; }
    catch (e) { return { nombre: 'gs/' + p.nombre, ok: false, error: e.message }; }
  });
  if (typeof Logger !== 'undefined') {
    const fallas = res.filter(r => !r.ok);
    Logger.log((res.length - fallas.length) + ' ok, ' + fallas.length + ' fallas');
    fallas.forEach(r => Logger.log(r.nombre + ': ' + r.error));
  }
  return res;
}

const DATOS_EJEMPLO = { nombre: 'Colombia 2026', personas: 2, monedaLocal: 'COP', monedaCasa: 'CRC' };

const LIBRO_ORIGINAL = {
  Costos: [
    ['Detalle', 'Efectivo?', 'Monto Dos Personas', 'Colones', 'Por Persona', '', 'Tipo de Cambio', ''],
    ['Vuelos', '', 696.92, 317098.6, 158549.3, '', 'COP-CRC', 0.14],
    ['Comida', '', '', 150000, 75000, '', 'COP-USD', 0.00031],
    ['Medellin Hospedaje', '', '', 254000, 127000, '', 'USD-CRC', 455],
    ['Compras', '', '', 175000, 87500, '', '', ''],
    ['Bogota Hospedaje', '', '', 134133, 67066.5, '', '', ''],
    ['Vuelo interno', '', 217.4, 98917, 49458.5, '', '', ''],
    ['Efectivo', 'Inicio', 200, 91000, 45500, '', '', ''],
    ['Zipaquirá y lago Guatavita', '', 138, 62790, 31395, '', '', ''],
    ['Guatapé desde Medellín', '', 50, 22750, 11375, '', '', ''],
    ['Compras Varias', 'Si', 50, 22750, 11375, '', '', ''],
    ['Sobrante', 'Total', -50.38, 33215, 16607.5, '', '', ''],
    ['Tiquete Catedral de Sal', 'Si', 39.6, 18018, 9009, '', '', ''],
    ['Metro Cable Arvi', 'Si', 30.38, 13822.9, 6911.45, '', '', ''],
    ['Entrada Parque Nacional', 'Si', 21.7, 9873.5, 4936.75, '', '', ''],
    ['Transporte Aeropuerto', '', 17.66, 8035.3, 4017.65, '', '', ''],
    ['Transporte Aeropuerto', '', 17.66, 8035.3, 4017.65, '', '', ''],
    ['Metro Medellin Comuna 13', 'Si', 3.97, 1806.35, 903.175, '', '', ''],
    ['Metro Medellin Arvi', 'Si', 3.97, 1805.44, 902.72, '', '', ''],
  ],
  Itinerario: [
    ['Fechas', 'Tiempo', 'Ciudad', 'Actividad', 'Obligatorio/Opcional'],
    ['2026-09-27', 'Tarde', 'Bogota', 'Centro Histórico', 'Obligatorio'],
    ['2026-09-28', 'Noche', 'Bogota', 'Cena Zona T', 'Opcional'],
    ['2026-09-28', 'Tarde', 'Bogota', 'Monserrate', 'Obligatorio'],
    ['2026-09-29', 'Mañana-Tarde', 'Bogota', 'Zipaquirá y Lago Guatavita', 'Obligatorio'],
    ['2026-09-30', 'Tarde', 'Bogota', 'Zona T / Compras', 'Obligatorio'],
    ['2026-09-30', 'Mañana', 'Bogota', 'Parque de la 93', 'Opcional'],
    ['2026-10-01', 'Tarde', 'Medellin', 'Parque Explora', 'Opcional'],
    ['2026-10-02', 'Mañana-Tarde', 'Medellin', 'Guatapé desde Medellín', 'Obligatorio'],
    ['2026-10-03', 'Noche', 'Medellin', 'Fiesta El Poblado', 'Opcional'],
    ['2026-10-03', 'Tarde', 'Medellin', 'Compras', 'Obligatorio'],
    ['2026-10-04', 'Mañana', 'Medellin', 'Comuna 13', 'Obligatorio'],
    ['2026-10-05', 'Mañana-Tarde', 'Medellin', 'Santa Fe de Antioquia', 'Obligatorio'],
    ['2026-10-06', 'Mañana', 'Medellin', 'Parque Arví', 'Obligatorio'],
  ],
  Reservas: [
    ['Tour', 'Fecha y hora', 'Recogida'],
    ['Guatapé desde Medellín', 'Viernes, 2 de octubre de 2026, 7:00', 'Parque del Poblado, frente a la iglesia'],
    ['Zipaquirá y lago Guatavita', 'Martes, 29 de septiembre de 2026, 8:00', 'Hotel'],
  ],
};
const ENLACES_ORIGINALES = ['', 'https://www.getyourguide.com/booking/EJEMPLO-GUATAPE', 'https://www.getyourguide.com/booking/EJEMPLO-ZIPAQUIRA'];

pruebaLogica('normalizar quita tildes, mayúsculas y espacios', () => {
  igualL(normalizar('  Mañana-Tarde '), 'manana-tarde');
  igualL(normalizar('Categoría'), 'categoria');
  igualL(normalizar(null), '');
});
pruebaLogica('indiceColumna compara normalizado', () => {
  igualL(indiceColumna(['ID', 'Dirección / Mapa'], 'direccion / mapa'), 1);
  igualL(indiceColumna(['ID'], 'Lugar'), -1);
});
pruebaLogica('tablaAObjetos omite filas vacías y saca el ID', () => {
  igualL(tablaAObjetos([['ID', 'Lugar'], [1, 'A'], ['', ''], [2, 'B']]), {
    encabezados: ['ID', 'Lugar'],
    filas: [{ id: 1, valores: { Lugar: 'A' } }, { id: 2, valores: { Lugar: 'B' } }],
  });
  igualL(tablaAObjetos([]), { encabezados: [], filas: [] });
});
pruebaLogica('configComoObjeto', () => {
  igualL(configComoObjeto([['Clave', 'Valor'], ['Personas', 2], ['', 'x']]), { Personas: 2 });
});
pruebaLogica('siguienteId y buscarFila', () => {
  const t = [['ID', 'x'], [3, 'a'], [7, 'b']];
  igualL(siguienteId(t), 8);
  igualL(siguienteId([['ID']]), 1);
  igualL(buscarFila(t, 7), 2);
  igualL(buscarFila(t, 99), -1);
  igualL(buscarFila(t, ''), -1);
});
pruebaLogica('fechaAClave entiende los tres formatos', () => {
  igualL(fechaAClave('2026-09-29'), '2026-09-29');
  igualL(fechaAClave('29/9/2026'), '2026-09-29');
  igualL(fechaAClave('Martes, 29 de septiembre de 2026, 8:00'), '2026-09-29');
  igualL(fechaAClave('2026-10-02 7:00'), '2026-10-02');
  igualL(fechaAClave('basura'), '');
});
pruebaLogica('horaDesdeTexto lee lo que muestra la hoja', () => {
  igualL(horaDesdeTexto('7:00:00'), '7:00');
  igualL(horaDesdeTexto('7:30 p. m.'), '19:30');
  igualL(horaDesdeTexto('12:05 a. m.'), '0:05');
  igualL(horaDesdeTexto(''), '');
});
```

- [ ] **Step 2: Cargar los `.gs` en `tests.html`**

Reemplaza la línea del módulo por:
```html
<script src="apps-script/Logica.gs"></script>
<script src="apps-script/PruebasLogica.gs"></script>
<script type="module" src="tests/todas.js"></script>
```

- [ ] **Step 3: Ejecutar las pruebas y verificar que fallan**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1`
Expected: no aparece `RESUMEN` (código 2), porque `PruebasLogica.gs` llama a funciones que no existen (`Logica.gs` da 404).

- [ ] **Step 4: Crear `apps-script/Logica.gs` con las utilidades**

```js
/* Lógica pura del Dashboard de Viaje. No usa SpreadsheetApp: se prueba en el navegador y en Apps Script. */
const TABLAS_EDITABLES = ['Costos', 'Itinerario', 'Lugares', 'Reservas'];
const MESES_ES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };

function normalizar(s) {
  return String(s === null || s === undefined ? '' : s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function indiceColumna(encabezados, nombre) {
  const n = normalizar(nombre);
  for (let i = 0; i < encabezados.length; i++) if (normalizar(encabezados[i]) === n) return i;
  return -1;
}

function filaVacia(fila) {
  return fila.every(c => c === '' || c === null || c === undefined);
}

function tablaAObjetos(valores) {
  if (!valores || !valores.length) return { encabezados: [], filas: [] };
  const encabezados = valores[0].map(String);
  const iId = indiceColumna(encabezados, 'ID');
  const filas = valores.slice(1).filter(f => !filaVacia(f)).map(f => {
    const v = {};
    encabezados.forEach((h, i) => { if (i !== iId && h !== '') v[h] = f[i] === undefined || f[i] === null ? '' : f[i]; });
    return { id: iId >= 0 && f[iId] !== '' ? Number(f[iId]) : null, valores: v };
  });
  return { encabezados: encabezados, filas: filas };
}

function configComoObjeto(valores) {
  const c = {};
  (valores || []).slice(1).forEach(f => { const k = String(f[0]).trim(); if (k) c[k] = f[1]; });
  return c;
}

function siguienteId(valores) {
  const i = indiceColumna(valores[0] || [], 'ID');
  let max = 0;
  valores.slice(1).forEach(f => { const n = Number(f[i]); if (f[i] !== '' && Number.isFinite(n) && n > max) max = n; });
  return max + 1;
}

function buscarFila(valores, id) {
  if (id === null || id === undefined || id === '') return -1;
  const i = indiceColumna(valores[0] || [], 'ID');
  for (let j = 1; j < valores.length; j++) if (valores[j][i] !== '' && Number(valores[j][i]) === Number(id)) return j;
  return -1;
}

function fechaAClave(v) {
  const s = String(v === null || v === undefined ? '' : v).trim();
  const p = n => String(n).padStart(2, '0');
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + p(m[2]) + '-' + p(m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return m[3] + '-' + p(m[2]) + '-' + p(m[1]);
  m = normalizar(s).match(/(\d{1,2}) de ([a-z]+) de (\d{4})/);
  if (m && MESES_ES[m[2]]) return m[3] + '-' + p(MESES_ES[m[2]]) + '-' + p(m[1]);
  return '';
}

/* Las celdas de solo hora vienen como fechas de 1899; leer el texto mostrado evita el desfase histórico de zona horaria. */
function horaDesdeTexto(texto) {
  const s = String(texto || '');
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (!m) return '';
  let h = Number(m[1]);
  if (/p\.?\s?m/i.test(s) && h < 12) h += 12;
  if (/a\.?\s?m/i.test(s) && h === 12) h = 0;
  return h + ':' + m[2];
}
```

- [ ] **Step 5: Ejecutar las pruebas y verificar que pasan**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1`
Expected: `RESUMEN: 8 ok, 0 fallas`.

- [ ] **Step 6: Commit**

```bash
git add apps-script tests.html
git commit -m "Add Apps Script pure helpers with sample trip data

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Logica.gs — migración de la hoja

**Files:**
- Modify: `apps-script/Logica.gs` (agregar al final), `apps-script/PruebasLogica.gs` (agregar al final)

**Interfaces:**
- Consumes: `normalizar`, `indiceColumna`, `filaVacia`, `fechaAClave` (Task 2).
- Produces: `categoriaPropuesta(detalle) → string`, `migrarLibro(libro, enlacesReservas, datos) → {Config, Costos, Itinerario, Lugares, Reservas, _Registro}` (cada una en 2D, con la fila de encabezados en el índice 0).

- [ ] **Step 1: Escribir las pruebas de la migración**

Agregar al final de `apps-script/PruebasLogica.gs`:
```js
function libroMigrado() { return migrarLibro(LIBRO_ORIGINAL, ENLACES_ORIGINALES, DATOS_EJEMPLO); }

pruebaLogica('migrar: Config con efectivo inicial y tipos de cambio', () => {
  igualL(libroMigrado().Config, [
    ['Clave', 'Valor'], ['Nombre del viaje', 'Colombia 2026'], ['Personas', 2], ['Moneda local', 'COP'],
    ['Moneda de casa', 'CRC'], ['Efectivo inicial (USD)', 200], ['COP-CRC', 0.14], ['COP-USD', 0.00031], ['USD-CRC', 455],
  ]);
});
pruebaLogica('migrar: Costos sin filas Efectivo/Sobrante y con columnas nuevas', () => {
  const c = libroMigrado().Costos;
  igualL(c[0], ['ID', 'Detalle', 'Categoría', 'Fecha', 'Efectivo?', 'Presupuesto USD', 'Presupuesto CRC', 'Real USD', 'Real CRC', 'Por Persona']);
  igualL(c.length, 17);
  igualL(c[1], [1, 'Vuelos', 'Transporte', '', '', 696.92, 317098.6, '', '', 158549.3]);
  igualL(c[2], [2, 'Comida', 'Comida', '', '', '', 150000, '', '', 75000]);
  igualL(c[9], [9, 'Compras Varias', 'Compras', '', 'Si', 50, 22750, '', '', 11375]);
  igualL(c.some(f => f[1] === 'Efectivo' || f[1] === 'Sobrante'), false);
});
pruebaLogica('migrar: categorías propuestas', () => {
  const cat = {};
  libroMigrado().Costos.slice(1).forEach(f => { cat[f[1]] = f[2]; });
  igualL(cat, {
    'Vuelos': 'Transporte', 'Comida': 'Comida', 'Medellin Hospedaje': 'Hospedaje', 'Compras': 'Compras',
    'Bogota Hospedaje': 'Hospedaje', 'Vuelo interno': 'Transporte', 'Zipaquirá y lago Guatavita': 'Tours',
    'Guatapé desde Medellín': 'Tours', 'Compras Varias': 'Compras', 'Tiquete Catedral de Sal': 'Tours',
    'Metro Cable Arvi': 'Transporte', 'Entrada Parque Nacional': 'Tours', 'Transporte Aeropuerto': 'Transporte',
    'Metro Medellin Comuna 13': 'Transporte', 'Metro Medellin Arvi': 'Transporte',
  });
});
pruebaLogica('migrar: Itinerario con ID y horas', () => {
  const it = libroMigrado().Itinerario;
  igualL(it[0], ['ID', 'Fechas', 'Tiempo', 'Hora inicio', 'Hora fin', 'Ciudad', 'Actividad', 'Obligatorio/Opcional']);
  igualL(it.length, 14);
  igualL(it[4], [4, '2026-09-29', 'Mañana-Tarde', '', '', 'Bogota', 'Zipaquirá y Lago Guatavita', 'Obligatorio']);
});
pruebaLogica('migrar: Reservas con enlace y actividad vinculada', () => {
  igualL(libroMigrado().Reservas, [
    ['ID', 'Tour', 'Fecha y hora', 'Recogida', 'Enlace', 'Actividad ID'],
    [1, 'Guatapé desde Medellín', 'Viernes, 2 de octubre de 2026, 7:00', 'Parque del Poblado, frente a la iglesia', ENLACES_ORIGINALES[1], 8],
    [2, 'Zipaquirá y lago Guatavita', 'Martes, 29 de septiembre de 2026, 8:00', 'Hotel', ENLACES_ORIGINALES[2], 4],
  ]);
});
pruebaLogica('migrar: pestañas nuevas vacías', () => {
  const l = libroMigrado();
  igualL(l.Lugares, [['ID', 'Actividad ID', 'Lugar', 'Dirección / Mapa', 'Notas', 'Hecho']]);
  igualL(l._Registro, [['opId', 'fecha', 'resultado']]);
});
```

- [ ] **Step 2: Ejecutar las pruebas y verificar que fallan**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1`
Expected: 6 fallas del tipo `gs/migrar: ...: migrarLibro is not defined`.

- [ ] **Step 3: Implementar la migración**

Agregar al final de `apps-script/Logica.gs`:
```js
const CATEGORIAS_PROPUESTAS = {
  Transporte: ['vuelos', 'vuelo interno', 'transporte aeropuerto', 'metro cable arvi', 'metro medellin comuna 13', 'metro medellin arvi'],
  Hospedaje: ['bogota hospedaje', 'medellin hospedaje'],
  Comida: ['comida'],
  Tours: ['zipaquira y lago guatavita', 'guatape desde medellin', 'tiquete catedral de sal', 'entrada parque nacional'],
  Compras: ['compras', 'compras varias'],
};

function categoriaPropuesta(detalle) {
  const n = normalizar(detalle);
  for (const cat of Object.keys(CATEGORIAS_PROPUESTAS)) if (CATEGORIAS_PROPUESTAS[cat].indexOf(n) >= 0) return cat;
  return 'Otros';
}

function migrarLibro(libro, enlacesReservas, datos) {
  const casa = datos.monedaCasa;
  const celda = (f, i) => (i >= 0 && f[i] !== undefined && f[i] !== null ? f[i] : '');

  // Costos: separa efectivo inicial, sobrante y tipos de cambio; agrega columnas nuevas.
  const co = libro.Costos && libro.Costos.length ? libro.Costos : [['Detalle']];
  const hc = co[0].map(String);
  const c = n => indiceColumna(hc, n);
  const iDet = c('Detalle'), iEf = c('Efectivo?'), iUsd = c('Monto Dos Personas'), iCrc = c('Colones'), iPp = c('Por Persona'), iTc = c('Tipo de Cambio');
  let efectivo = '';
  const tasas = [];
  const gastos = [];
  co.slice(1).forEach(f => {
    if (iTc >= 0 && String(celda(f, iTc)).trim() !== '' && celda(f, iTc + 1) !== '') tasas.push([String(f[iTc]).trim(), f[iTc + 1]]);
    const ef = normalizar(celda(f, iEf));
    if (ef === 'inicio') { efectivo = celda(f, iUsd); return; }
    if (ef === 'total' || String(celda(f, iDet)).trim() === '') return;
    gastos.push(f);
  });
  const costos = [['ID', 'Detalle', 'Categoría', 'Fecha', 'Efectivo?', 'Presupuesto USD', 'Presupuesto ' + casa, 'Real USD', 'Real ' + casa, 'Por Persona']]
    .concat(gastos.map((f, i) => [
      i + 1, celda(f, iDet), categoriaPropuesta(celda(f, iDet)), '', normalizar(celda(f, iEf)) === 'si' ? 'Si' : '',
      celda(f, iUsd), celda(f, iCrc), '', '', celda(f, iPp),
    ]));
  const config = [['Clave', 'Valor'], ['Nombre del viaje', datos.nombre], ['Personas', datos.personas],
    ['Moneda local', datos.monedaLocal], ['Moneda de casa', casa], ['Efectivo inicial (USD)', efectivo]].concat(tasas);

  // Itinerario: ID al inicio, Hora inicio y Hora fin después de Tiempo.
  const it = libro.Itinerario && libro.Itinerario.length ? libro.Itinerario : [['Fechas', 'Tiempo', 'Ciudad', 'Actividad', 'Obligatorio/Opcional']];
  const hi = it[0].map(String);
  const iT = indiceColumna(hi, 'Tiempo');
  const pos = iT >= 0 ? iT + 1 : hi.length;
  const partir = f => { const a = hi.map((_, i) => celda(f, i)); return a.slice(0, pos).concat(['', ''], a.slice(pos)); };
  const itinerario = [['ID'].concat(hi.slice(0, pos), ['Hora inicio', 'Hora fin'], hi.slice(pos))]
    .concat(it.slice(1).filter(f => !filaVacia(f)).map((f, i) => [i + 1].concat(partir(f))));

  // Reservas: ID, Enlace (hipervínculo original) y Actividad ID (misma fecha y mismo nombre).
  const re = libro.Reservas && libro.Reservas.length ? libro.Reservas : [['Tour', 'Fecha y hora', 'Recogida']];
  const hr = re[0].map(String);
  const iTour = indiceColumna(hr, 'Tour'), iFh = indiceColumna(hr, 'Fecha y hora');
  const iAct = indiceColumna(itinerario[0], 'Actividad'), iFec = indiceColumna(itinerario[0], 'Fechas');
  const reservas = [['ID'].concat(hr, ['Enlace', 'Actividad ID'])];
  re.forEach((f, j) => {
    if (j === 0 || filaVacia(f)) return;
    const tour = normalizar(celda(f, iTour)), fecha = fechaAClave(celda(f, iFh));
    const coinciden = itinerario.slice(1).filter(a => normalizar(a[iAct]) === tour && fechaAClave(a[iFec]) === fecha);
    reservas.push([reservas.length].concat(hr.map((_, i) => celda(f, i)), [enlacesReservas[j] || '', coinciden.length === 1 ? coinciden[0][0] : '']));
  });

  return {
    Config: config,
    Costos: costos,
    Itinerario: itinerario,
    Lugares: [['ID', 'Actividad ID', 'Lugar', 'Dirección / Mapa', 'Notas', 'Hecho']],
    Reservas: reservas,
    _Registro: [['opId', 'fecha', 'resultado']],
  };
}
```

- [ ] **Step 4: Ejecutar las pruebas y verificar que pasan**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1`
Expected: `RESUMEN: 14 ok, 0 fallas`.

- [ ] **Step 5: Commit**

```bash
git add apps-script
git commit -m "Add sheet migration to the reusable trip structure

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Logica.gs — operaciones y lote idempotente

**Files:**
- Modify: `apps-script/Logica.gs`, `apps-script/PruebasLogica.gs` (agregar al final de cada uno)

**Interfaces:**
- Consumes: Task 2 y `libroMigrado()` (Task 3).
- Produces:
  - `planOperacion(libro, op) → {ok:true, id, acciones} | {ok:false, error}`, donde `op = {opId, op:'agregar'|'modificar'|'eliminar', tabla, id?, valores?}` y cada acción es `{tipo:'poner', tabla, fila, col, valor}`, `{tipo:'borrarFila', tabla, fila}` o `{tipo:'agregarFila', tabla, valores}`. `fila` y `col` son índices del 2D (fila 0 = encabezados). Orden: primero los `poner`, luego `borrarFila` de mayor a menor dentro de cada tabla, y al final `agregarFila`.
  - `ejecutarAcciones(libro, acciones) → libro nuevo` (no modifica el original).
  - `resolverTemporales(op, mapa) → op`.
  - `procesarLote(libro, ops, ahora) → {libro, resultados:[{opId, ok, id?, error?}], pasos:[acciones[]], nuevosRegistros:[[opId, ahora, jsonResultado]]}`. Lee `libro._Registro` para no repetir operaciones. Los ID negativos son temporales: un `agregar` con `id < 0` hace que ese ID temporal se traduzca, en el resto del lote, al ID real (en `op.id` de la misma tabla y en `valores['Actividad ID']` hacia Itinerario).

- [ ] **Step 1: Escribir las pruebas de operaciones**

Agregar al final de `apps-script/PruebasLogica.gs`:
```js
pruebaLogica('op: agregar Lugares asigna ID y ordena columnas', () => {
  const r = planOperacion(libroMigrado(), { opId: 'a', op: 'agregar', tabla: 'Lugares', id: -1, valores: { 'Actividad ID': 5, 'Lugar': 'Tienda Vélez', 'Notas': 'chaqueta' } });
  igualL(r, { ok: true, id: 1, acciones: [{ tipo: 'agregarFila', tabla: 'Lugares', valores: [1, 5, 'Tienda Vélez', '', 'chaqueta', ''] }] });
});
pruebaLogica('op: modificar acepta encabezados en minúsculas', () => {
  igualL(planOperacion(libroMigrado(), { opId: 'b', op: 'modificar', tabla: 'Costos', id: 2, valores: { 'real crc': 140000 } }),
    { ok: true, id: 2, acciones: [{ tipo: 'poner', tabla: 'Costos', fila: 2, col: 8, valor: 140000 }] });
});
pruebaLogica('op: ID inexistente da "no existe"', () => {
  igualL(planOperacion(libroMigrado(), { opId: 'c', op: 'modificar', tabla: 'Costos', id: 99, valores: { 'Real USD': 1 } }), { ok: false, error: 'no existe' });
});
pruebaLogica('op: columna o tabla desconocida', () => {
  igualL(planOperacion(libroMigrado(), { opId: 'd', op: 'modificar', tabla: 'Costos', id: 1, valores: { 'Color': 'rojo' } }), { ok: false, error: 'columna desconocida: Color' });
  igualL(planOperacion(libroMigrado(), { opId: 'e', op: 'agregar', tabla: 'Config', valores: {} }), { ok: false, error: 'tabla desconocida: Config' });
});
pruebaLogica('op: eliminar actividad borra sus lugares y desvincula reservas', () => {
  const base = libroMigrado();
  const conLugar = ejecutarAcciones(base, planOperacion(base, { opId: 'f', op: 'agregar', tabla: 'Lugares', valores: { 'Actividad ID': 8, 'Lugar': 'X' } }).acciones);
  igualL(planOperacion(conLugar, { opId: 'g', op: 'eliminar', tabla: 'Itinerario', id: 8 }).acciones, [
    { tipo: 'poner', tabla: 'Reservas', fila: 1, col: 5, valor: '' },
    { tipo: 'borrarFila', tabla: 'Lugares', fila: 1 },
    { tipo: 'borrarFila', tabla: 'Itinerario', fila: 8 },
  ]);
});
pruebaLogica('op: ejecutarAcciones no modifica el original', () => {
  const l = libroMigrado();
  const antes = JSON.stringify(l);
  const n = ejecutarAcciones(l, [{ tipo: 'poner', tabla: 'Costos', fila: 2, col: 8, valor: 140000 }, { tipo: 'borrarFila', tabla: 'Costos', fila: 1 }]);
  igualL([n.Costos[1][1], n.Costos[1][8], n.Costos.length], ['Comida', 140000, 16]);
  igualL(JSON.stringify(l), antes);
});
function opsConTemporal() {
  return [
    { opId: 'a', op: 'agregar', tabla: 'Itinerario', id: -1, valores: { 'Fechas': '2026-10-01', 'Tiempo': 'Noche', 'Ciudad': 'Medellin', 'Actividad': 'Cena' } },
    { opId: 'b', op: 'agregar', tabla: 'Lugares', id: -2, valores: { 'Actividad ID': -1, 'Lugar': 'Carmen' } },
  ];
}
pruebaLogica('lote: resuelve IDs temporales dentro del lote', () => {
  const r = procesarLote(libroMigrado(), opsConTemporal(), 'AHORA');
  igualL(r.resultados, [{ opId: 'a', ok: true, id: 14 }, { opId: 'b', ok: true, id: 1 }]);
  igualL(r.libro.Lugares[1], [1, 14, 'Carmen', '', '', '']);
  igualL(r.pasos.length, 2);
  igualL(r.nuevosRegistros.map(x => x.slice(0, 2)), [['a', 'AHORA'], ['b', 'AHORA']]);
});
pruebaLogica('lote: un opId repetido no se aplica dos veces', () => {
  const r = procesarLote(libroMigrado(), opsConTemporal(), 'AHORA');
  const libro2 = Object.assign({}, r.libro, { _Registro: r.libro._Registro.concat(r.nuevosRegistros) });
  const r2 = procesarLote(libro2, opsConTemporal(), 'LUEGO');
  igualL(r2.resultados, r.resultados);
  igualL([r2.pasos.length, r2.nuevosRegistros.length, r2.libro.Itinerario.length], [0, 0, 15]);
});
pruebaLogica('lote: eliminar y luego modificar lo mismo da "no existe"', () => {
  const r = procesarLote(libroMigrado(), [
    { opId: 'x', op: 'eliminar', tabla: 'Costos', id: 3 },
    { opId: 'y', op: 'modificar', tabla: 'Costos', id: 3, valores: { 'Real USD': 1 } },
  ], 'AHORA');
  igualL(r.resultados, [{ opId: 'x', ok: true, id: 3 }, { opId: 'y', ok: false, error: 'no existe' }]);
});
```

- [ ] **Step 2: Ejecutar las pruebas y verificar que fallan**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1`
Expected: 9 fallas nuevas (`planOperacion is not defined`, etc.).

- [ ] **Step 3: Implementar las operaciones**

Agregar al final de `apps-script/Logica.gs`:
```js
function planOperacion(libro, op) {
  if (TABLAS_EDITABLES.indexOf(op.tabla) < 0) return { ok: false, error: 'tabla desconocida: ' + op.tabla };
  const t = libro[op.tabla];
  if (!t || !t.length) return { ok: false, error: 'la pestaña ' + op.tabla + ' no existe' };
  const enc = t[0];
  const iId = indiceColumna(enc, 'ID');
  const valores = op.valores || {};
  const cols = {};
  const claves = Object.keys(valores);
  for (let k = 0; k < claves.length; k++) {
    const i = indiceColumna(enc, claves[k]);
    if (i < 0 || i === iId) return { ok: false, error: 'columna desconocida: ' + claves[k] };
    cols[i] = valores[claves[k]];
  }
  if (op.op === 'agregar') {
    const id = siguienteId(t);
    return { ok: true, id: id, acciones: [{ tipo: 'agregarFila', tabla: op.tabla, valores: enc.map((_, i) => (i === iId ? id : (i in cols ? cols[i] : ''))) }] };
  }
  const fila = buscarFila(t, op.id);
  if (fila < 0) return { ok: false, error: 'no existe' };
  if (op.op === 'modificar') {
    return { ok: true, id: Number(op.id), acciones: Object.keys(cols).map(i => ({ tipo: 'poner', tabla: op.tabla, fila: fila, col: Number(i), valor: cols[i] })) };
  }
  if (op.op === 'eliminar') {
    const acciones = [];
    if (op.tabla === 'Itinerario') {
      const vinculada = (r, ia) => ia >= 0 && r[ia] !== '' && Number(r[ia]) === Number(op.id);
      const res = libro.Reservas;
      if (res && res.length) {
        const ia = indiceColumna(res[0], 'Actividad ID');
        res.forEach((r, j) => { if (j > 0 && vinculada(r, ia)) acciones.push({ tipo: 'poner', tabla: 'Reservas', fila: j, col: ia, valor: '' }); });
      }
      const lug = libro.Lugares;
      if (lug && lug.length) {
        const ia = indiceColumna(lug[0], 'Actividad ID');
        const borrar = [];
        lug.forEach((r, j) => { if (j > 0 && vinculada(r, ia)) borrar.push(j); });
        borrar.sort((a, b) => b - a).forEach(j => acciones.push({ tipo: 'borrarFila', tabla: 'Lugares', fila: j }));
      }
    }
    acciones.push({ tipo: 'borrarFila', tabla: op.tabla, fila: fila });
    return { ok: true, id: Number(op.id), acciones: acciones };
  }
  return { ok: false, error: 'operación desconocida: ' + op.op };
}

function ejecutarAcciones(libro, acciones) {
  const n = {};
  Object.keys(libro).forEach(k => { n[k] = libro[k].map(f => f.slice()); });
  acciones.forEach(a => {
    if (a.tipo === 'poner') n[a.tabla][a.fila][a.col] = a.valor;
    else if (a.tipo === 'borrarFila') n[a.tabla].splice(a.fila, 1);
    else if (a.tipo === 'agregarFila') n[a.tabla].push(a.valores.slice());
  });
  return n;
}

function resolverTemporales(op, mapa) {
  const r = Object.assign({}, op, { valores: Object.assign({}, op.valores || {}) });
  const clave = (tabla, id) => tabla + ':' + Number(id);
  if (Number(r.id) < 0 && mapa[clave(r.tabla, r.id)] !== undefined) r.id = mapa[clave(r.tabla, r.id)];
  Object.keys(r.valores).forEach(k => {
    const v = r.valores[k];
    if (normalizar(k) === 'actividad id' && v !== '' && Number(v) < 0 && mapa[clave('Itinerario', v)] !== undefined) r.valores[k] = mapa[clave('Itinerario', v)];
  });
  return r;
}

function procesarLote(libro, ops, ahora) {
  let actual = libro;
  const resultados = [], pasos = [], nuevosRegistros = [], mapa = {};
  const registro = {};
  (libro._Registro || []).slice(1).forEach(f => { if (f[0] !== '') registro[f[0]] = f[2]; });
  ops.forEach(original => {
    const temporal = original.op === 'agregar' && Number(original.id) < 0 ? original.tabla + ':' + Number(original.id) : null;
    if (registro[original.opId] !== undefined) {
      const previo = JSON.parse(registro[original.opId]);
      if (previo.ok && temporal) mapa[temporal] = previo.id;
      resultados.push(previo);
      return;
    }
    const op = resolverTemporales(original, mapa);
    const plan = planOperacion(actual, op);
    const res = plan.ok ? { opId: op.opId, ok: true, id: plan.id } : { opId: op.opId, ok: false, error: plan.error };
    if (plan.ok) {
      pasos.push(plan.acciones);
      actual = ejecutarAcciones(actual, plan.acciones);
      if (temporal) mapa[temporal] = plan.id;
    }
    registro[op.opId] = JSON.stringify(res);
    nuevosRegistros.push([op.opId, ahora, JSON.stringify(res)]);
    resultados.push(res);
  });
  return { libro: actual, resultados: resultados, pasos: pasos, nuevosRegistros: nuevosRegistros };
}
```

- [ ] **Step 4: Ejecutar las pruebas y verificar que pasan**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1`
Expected: `RESUMEN: 23 ok, 0 fallas`.

- [ ] **Step 5: Commit**

```bash
git add apps-script
git commit -m "Add idempotent add/modify/delete batch processing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Codigo.gs — doGet, doPost y prepararHoja

**Files:**
- Create: `apps-script/Codigo.gs`, `tests/codigo.test.js`
- Modify: `tests.html` (cargar `Codigo.gs`), `tests/todas.js` (importar la prueba)

**Interfaces:**
- Consumes: todo `Logica.gs`.
- Produces: el web app. `GET ?op=leer&clave=…` → `{ok, leidoEn, config, tablas:{Costos|Itinerario|Lugares|Reservas:{encabezados, filas}}}`. `POST` con cuerpo `{clave, ops}` (text/plain) → `{ok, resultados}`. Si falla: `{ok:false, error}`, con `error === 'no autorizado'` cuando la clave es incorrecta. `prepararHoja()` se ejecuta a mano. Las fechas salen como `yyyy-mm-dd` o `yyyy-mm-dd H:mm` y las horas como `H:mm`.

- [ ] **Step 1: Escribir la prueba de carga**

`tests/codigo.test.js`:
```js
import { prueba, verdadero } from './t.js';

prueba('Codigo.gs carga y define los puntos de entrada', () => {
  for (const f of ['doGet', 'doPost', 'prepararHoja', 'leerLibro_', 'ejecutarEnHoja_']) verdadero(typeof globalThis[f] === 'function', `falta ${f}`);
});
```
En `tests/todas.js`, agrega `import './codigo.test.js';` después de `import './entorno.test.js';`. En `tests.html`, agrega `<script src="apps-script/Codigo.gs"></script>` después de la línea de `Logica.gs`.

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1`
Expected: 1 falla, `Codigo.gs carga y define los puntos de entrada: falta doGet`.

- [ ] **Step 3: Crear `apps-script/Codigo.gs`**

```js
/* Pegamento con Google Sheets. La lógica está en Logica.gs; las pruebas en PruebasLogica.gs (ejecuta probarTodo). */
const DATOS_VIAJE = { nombre: 'Colombia 2026', personas: 2, monedaLocal: 'COP', monedaCasa: 'CRC' };
const HOJAS_LIBRO = ['Config', 'Costos', 'Itinerario', 'Lugares', 'Reservas', '_Registro'];

function doGet(e) {
  return responder_(() => {
    const p = (e && e.parameter) || {};
    autorizar_(p.clave);
    if (p.op !== 'leer') throw new Error('operación desconocida');
    const libro = leerLibro_(SpreadsheetApp.getActive());
    const tablas = {};
    TABLAS_EDITABLES.forEach(n => { tablas[n] = tablaAObjetos(libro[n]); });
    return { ok: true, leidoEn: new Date().toISOString(), config: configComoObjeto(libro.Config), tablas: tablas };
  });
}

function doPost(e) {
  return responder_(() => {
    const cuerpo = JSON.parse(e.postData.contents);
    autorizar_(cuerpo.clave);
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const ss = SpreadsheetApp.getActive();
      const r = procesarLote(leerLibro_(ss), cuerpo.ops || [], new Date().toISOString());
      r.pasos.forEach(acciones => ejecutarEnHoja_(ss, acciones));
      if (r.nuevosRegistros.length) {
        const h = ss.getSheetByName('_Registro');
        h.getRange(h.getLastRow() + 1, 1, r.nuevosRegistros.length, 3).setValues(r.nuevosRegistros);
      }
      SpreadsheetApp.flush();
      return { ok: true, resultados: r.resultados };
    } finally {
      lock.releaseLock();
    }
  });
}

/* Ejecutar a mano UNA vez desde el editor. Crea un respaldo y convierte la hoja a la estructura del dashboard. */
function prepararHoja() {
  const ss = SpreadsheetApp.getActive();
  if (ss.getSheetByName('Config')) { Logger.log('La hoja ya está preparada: no se hizo ningún cambio.'); return; }
  const tz = ss.getSpreadsheetTimeZone();
  const respaldo = DriveApp.getFileById(ss.getId()).makeCopy(ss.getName() + ' — respaldo ' + Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm'));
  const libro = leerLibro_(ss);
  const hr = ss.getSheetByName('Reservas');
  const enlaces = hr && hr.getLastRow() > 0
    ? hr.getRange(1, 1, hr.getLastRow(), 1).getRichTextValues().map(f => f[0].getLinkUrl() || '')
    : [];
  const nuevo = migrarLibro(libro, enlaces, DATOS_VIAJE);
  HOJAS_LIBRO.forEach(n => escribirHoja_(ss, n, nuevo[n]));
  ss.getSheetByName('_Registro').hideSheet();
  Logger.log('Hoja preparada. Respaldo: ' + respaldo.getUrl());
}

function responder_(fn) {
  let salida;
  try { salida = fn(); } catch (err) { salida = { ok: false, error: err.message }; }
  return ContentService.createTextOutput(JSON.stringify(salida)).setMimeType(ContentService.MimeType.JSON);
}

function autorizar_(clave) {
  const esperada = PropertiesService.getScriptProperties().getProperty('CLAVE');
  if (!esperada || clave !== esperada) throw new Error('no autorizado');
}

function celdaATexto_(v, mostrado, tz) {
  if (!(v instanceof Date)) return v;
  if (v.getFullYear() < 1900) return horaDesdeTexto(mostrado);
  const hm = Utilities.formatDate(v, tz, 'H:mm');
  return Utilities.formatDate(v, tz, 'yyyy-MM-dd') + (hm === '0:00' ? '' : ' ' + hm);
}

function leerLibro_(ss) {
  const tz = ss.getSpreadsheetTimeZone();
  const libro = {};
  HOJAS_LIBRO.forEach(n => {
    const h = ss.getSheetByName(n);
    if (!h || h.getLastRow() === 0) { libro[n] = []; return; }
    const rango = h.getDataRange();
    const valores = rango.getValues(), mostrados = rango.getDisplayValues();
    libro[n] = valores.map((f, i) => f.map((v, j) => celdaATexto_(v, mostrados[i][j], tz)));
  });
  return libro;
}

function ejecutarEnHoja_(ss, acciones) {
  acciones.forEach(a => {
    const h = ss.getSheetByName(a.tabla);
    if (a.tipo === 'poner') {
      h.getRange(a.fila + 1, a.col + 1).setValue(a.valor);
    } else if (a.tipo === 'borrarFila') {
      // Sheets no permite borrar la última fila no congelada: se agrega una vacía antes.
      if (h.getMaxRows() <= a.fila + 1) h.insertRowAfter(h.getMaxRows());
      h.deleteRow(a.fila + 1);
    } else if (a.tipo === 'agregarFila') {
      h.appendRow(a.valores);
    }
  });
}

function escribirHoja_(ss, nombre, valores) {
  const h = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
  h.clear();
  const ancho = Math.max.apply(null, valores.map(f => f.length));
  const filas = valores.map(f => f.concat(Array(ancho - f.length).fill('')));
  h.getRange(1, 1, filas.length, ancho).setValues(filas);
  h.setFrozenRows(1);
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1`
Expected: `RESUMEN: 24 ok, 0 fallas`.

- [ ] **Step 5: Commit**

```bash
git add apps-script tests tests.html
git commit -m "Add Apps Script web app glue (doGet, doPost, prepararHoja)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: parse.js, servidor falso y datos de prueba

**Files:**
- Create: `js/parse.js`, `js/servidor-falso.js`, `tests/fixtures.js`, `tests/parse.test.js`
- Modify: `tests/todas.js`

**Interfaces:**
- Consumes: globales de `Logica.gs` (`configComoObjeto`, `tablaAObjetos`, `procesarLote`, `migrarLibro`) y de `PruebasLogica.gs` (`LIBRO_ORIGINAL`, `ENLACES_ORIGINALES`, `DATOS_EJEMPLO`).
- Produces:
  - `parse.js`: `normalizar(s)`, `valorDe(valores, nombre)`, `leerMonto(v) → number|null|NaN`, `leerHora(v) → minutos|null|NaN`, `leerFechaHora(v) → {fecha:'yyyy-mm-dd', hora:minutos|null} | null | false`, `parsearDatos(raw) → Viaje`.
  - `Viaje = {nombre, personas, monedaLocal, monedaCasa, efectivoInicialUsd, tasas:{usdCasa, localCasa, localUsd}, leidoEn, advertencias:string[], costos: Costo[], actividades: Actividad[], lugares: Lugar[], reservas: Reserva[]}`.
  - `Monto = {usd, casa, moneda:'USD'|<casa>, cantidad}`.
  - `Costo = {id, detalle, categoria, fecha|null, efectivo:bool, presupuesto:Monto|null, real:Monto|null, error|null, pendiente, errorSync}`.
  - `Actividad = {id, fecha|null, franja, inicio|null, fin|null (minutos), ciudad, actividad, opcional:bool, error|null, pendiente, errorSync}`.
  - `Lugar = {id, actividadId|null, lugar, mapa, notas, hecho:bool, pendiente, errorSync}`.
  - `Reserva = {id, tour, fecha|null, hora|null, recogida, enlace, actividadId|null, error|null, pendiente, errorSync}`.
  - `servidor-falso.js`: `crearServidorFalso(libro) → {leer(), enviar(ops) → resultados, libro (getter), caido (setter), fallarDespues (setter), recibidos}`.
  - `tests/fixtures.js`: `libroEjemplo()`, `servidorEjemplo()`, `rawEjemplo()`, `conValores(raw, tabla, id, valores)`, `conFila(raw, tabla, id, valores)`.

- [ ] **Step 1: Crear `js/servidor-falso.js` y `tests/fixtures.js`**

`js/servidor-falso.js`:
```js
// Apps Script simulado en memoria sobre Logica.gs (cargado como script global). Se usa en pruebas y en ?demo.
const TABLAS = ['Costos', 'Itinerario', 'Lugares', 'Reservas'];

export function crearServidorFalso(libroInicial) {
  const g = globalThis;
  let libro = JSON.parse(JSON.stringify(libroInicial));
  let caido = false;
  let fallarDespues = false;
  const recibidos = [];
  return {
    get libro() { return libro; },
    set caido(v) { caido = v; },
    set fallarDespues(v) { fallarDespues = v; },
    recibidos,
    leer() {
      if (caido) throw new Error('sin conexión');
      return {
        ok: true,
        leidoEn: new Date().toISOString(),
        config: g.configComoObjeto(libro.Config),
        tablas: Object.fromEntries(TABLAS.map(n => [n, g.tablaAObjetos(libro[n])])),
      };
    },
    enviar(ops) {
      if (caido) throw new Error('sin conexión');
      const copia = JSON.parse(JSON.stringify(ops));
      recibidos.push(copia);
      const r = g.procesarLote(libro, copia, new Date().toISOString());
      libro = r.libro;
      libro._Registro = libro._Registro.concat(r.nuevosRegistros);
      if (fallarDespues) { fallarDespues = false; throw new Error('respuesta perdida'); }
      return r.resultados;
    },
  };
}
```

`tests/fixtures.js`:
```js
import { crearServidorFalso } from '../js/servidor-falso.js';

export const libroEjemplo = () => globalThis.migrarLibro(globalThis.LIBRO_ORIGINAL, globalThis.ENLACES_ORIGINALES, globalThis.DATOS_EJEMPLO);
export const servidorEjemplo = () => crearServidorFalso(libroEjemplo());
export const rawEjemplo = () => servidorEjemplo().leer();

export function conValores(raw, tabla, id, valores) {
  const r = structuredClone(raw);
  Object.assign(r.tablas[tabla].filas.find(f => f.id === id).valores, valores);
  return r;
}

export function conFila(raw, tabla, id, valores) {
  const r = structuredClone(raw);
  const base = {};
  for (const h of r.tablas[tabla].encabezados) if (h !== 'ID') base[h] = '';
  r.tablas[tabla].filas.push({ id, valores: { ...base, ...valores } });
  return r;
}
```

- [ ] **Step 2: Escribir `tests/parse.test.js`**

```js
import { prueba, igual, cerca, verdadero } from './t.js';
import { leerMonto, leerHora, leerFechaHora, parsearDatos } from '../js/parse.js';
import { rawEjemplo } from './fixtures.js';

prueba('parse: montos con símbolos, comas y signo', () => {
  igual([leerMonto('$696.92'), leerMonto('-$50.38'), leerMonto('₡317,098.60'), leerMonto(903.18), leerMonto('')], [696.92, -50.38, 317098.6, 903.18, null]);
  verdadero(Number.isNaN(leerMonto('abc')));
});
prueba('parse: horas', () => {
  igual([leerHora('7:00'), leerHora('07:30'), leerHora('')], [420, 450, null]);
  verdadero(Number.isNaN(leerHora('x')));
});
prueba('parse: fechas en los tres formatos', () => {
  igual(leerFechaHora('27/9/2026'), { fecha: '2026-09-27', hora: null });
  igual(leerFechaHora('Martes, 29 de septiembre de 2026, 8:00'), { fecha: '2026-09-29', hora: 480 });
  igual(leerFechaHora('2026-10-02 7:00'), { fecha: '2026-10-02', hora: 420 });
  igual([leerFechaHora(''), leerFechaHora('x')], [null, false]);
});
prueba('parse: Config y tipos de cambio', () => {
  const v = parsearDatos(rawEjemplo());
  igual([v.nombre, v.personas, v.monedaLocal, v.monedaCasa, v.efectivoInicialUsd], ['Colombia 2026', 2, 'COP', 'CRC', 200]);
  igual(v.tasas, { usdCasa: 455, localCasa: 0.14, localUsd: 0.00031 });
  igual(v.advertencias, []);
});
prueba('parse: costos en USD o en colones', () => {
  const v = parsearDatos(rawEjemplo());
  igual(v.costos.length, 16);
  const vuelos = v.costos[0], comida = v.costos[1];
  igual([vuelos.id, vuelos.detalle, vuelos.categoria, vuelos.presupuesto.moneda, vuelos.real], [1, 'Vuelos', 'Transporte', 'USD', null]);
  cerca(vuelos.presupuesto.casa, 317098.6, 0.01);
  igual([comida.presupuesto.moneda, comida.presupuesto.casa], ['CRC', 150000]);
  cerca(comida.presupuesto.usd, 329.67, 0.01);
  igual(v.costos.filter(c => c.efectivo).length, 6);
});
prueba('parse: actividades, lugares y reservas', () => {
  const v = parsearDatos(rawEjemplo());
  igual(v.actividades.length, 13);
  const g = v.actividades.find(a => a.id === 8);
  igual([g.fecha, g.franja, g.opcional, g.inicio, g.error], ['2026-10-02', 'Mañana-Tarde', false, null, null]);
  igual(v.actividades.find(a => a.id === 2).opcional, true);
  const r = v.reservas[0];
  igual([r.tour, r.fecha, r.hora, r.actividadId], ['Guatapé desde Medellín', '2026-10-02', 420, 8]);
  verdadero(r.enlace.startsWith('https://'));
  igual(v.lugares, []);
});
prueba('parse: encabezados con otra capitalización y sin tildes', () => {
  const raw = rawEjemplo();
  for (const f of raw.tablas.Costos.filas) {
    f.valores['categoria'] = f.valores['Categoría']; delete f.valores['Categoría'];
    f.valores['presupuesto usd'] = f.valores['Presupuesto USD']; delete f.valores['Presupuesto USD'];
  }
  const v = parsearDatos(raw);
  igual([v.costos[0].categoria, v.costos[0].presupuesto.usd], ['Transporte', 696.92]);
});
prueba('parse: monto o fecha ilegible marca error en la fila', () => {
  const raw = rawEjemplo();
  raw.tablas.Costos.filas[0].valores['Real USD'] = 'mucho';
  raw.tablas.Itinerario.filas[0].valores['Hora inicio'] = '15:00';
  raw.tablas.Itinerario.filas[0].valores['Hora fin'] = '14:00';
  const v = parsearDatos(raw);
  igual(v.costos[0].error, 'monto ilegible');
  igual(v.actividades[0].error, 'hora fin antes de inicio');
});
prueba('parse: falta un tipo de cambio → advertencia', () => {
  const raw = rawEjemplo();
  delete raw.config['COP-USD'];
  igual(parsearDatos(raw).advertencias, ['Falta el tipo de cambio COP-USD en Config']);
});
```

En `tests/todas.js` agrega `import './parse.test.js';`.

- [ ] **Step 3: Ejecutar y verificar que falla**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1`
Expected: no aparece `RESUMEN` (código 2), porque `js/parse.js` no existe y el import del módulo falla.

- [ ] **Step 4: Crear `js/parse.js`**

```js
const MESES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
const pad = n => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const minutos = (h, m) => (h === undefined ? null : Number(h) * 60 + Number(m));
const vacio = v => v === null || v === undefined || v === '';

export function normalizar(s) {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

export function valorDe(valores, nombre) {
  const n = normalizar(nombre);
  for (const k of Object.keys(valores)) if (normalizar(k) === n) return valores[k];
  return '';
}

export function leerMonto(v) {
  if (vacio(v)) return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[$₡\s,]/g, '');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export function leerHora(v) {
  if (vacio(v)) return null;
  const m = String(v).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m || Number(m[1]) > 24 || Number(m[2]) > 59) return NaN;
  return minutos(m[1], m[2]);
}

export function leerFechaHora(v) {
  if (vacio(v)) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) return { fecha: iso(m[1], m[2], m[3]), hora: minutos(m[4], m[5]) };
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (m) return { fecha: iso(m[3], m[2], m[1]), hora: minutos(m[4], m[5]) };
  m = normalizar(s).match(/(\d{1,2}) de ([a-z]+) de (\d{4})(?:,?\s*(\d{1,2}):(\d{2}))?/);
  if (m && MESES[m[2]]) return { fecha: iso(m[3], MESES[m[2]], m[1]), hora: minutos(m[4], m[5]) };
  return false;
}

export function parsearDatos(raw) {
  const cfg = {};
  for (const [k, v] of Object.entries(raw.config || {})) cfg[normalizar(k)] = v;
  const local = String(cfg['moneda local'] || 'COP').trim().toUpperCase();
  const casa = String(cfg['moneda de casa'] || 'CRC').trim().toUpperCase();
  const numero = k => { const n = leerMonto(cfg[normalizar(k)]); return Number.isFinite(n) ? n : null; };
  const nombresTasas = { usdCasa: `USD-${casa}`, localCasa: `${local}-${casa}`, localUsd: `${local}-USD` };
  const tasas = Object.fromEntries(Object.entries(nombresTasas).map(([k, n]) => [k, numero(n)]));
  const advertencias = Object.entries(nombresTasas).filter(([k]) => tasas[k] === null).map(([, n]) => `Falta el tipo de cambio ${n} en Config`);
  const filas = n => raw.tablas?.[n]?.filas || [];
  const meta = f => ({ pendiente: !!f.pendiente, errorSync: f.errorSync || null });
  const idDe = v => { const n = leerMonto(v); return Number.isFinite(n) ? n : null; };

  const costos = filas('Costos').map(f => {
    const val = n => valorDe(f.valores, n);
    const errores = [];
    const monto = (colUsd, colCasa) => {
      const u = leerMonto(val(colUsd)), c = leerMonto(val(colCasa));
      if (Number.isNaN(u) || Number.isNaN(c)) { errores.push('monto ilegible'); return null; }
      if (u !== null) return { usd: u, casa: u * tasas.usdCasa, moneda: 'USD', cantidad: u };
      if (c !== null) return { usd: c / tasas.usdCasa, casa: c, moneda: casa, cantidad: c };
      return null;
    };
    const presupuesto = monto('Presupuesto USD', `Presupuesto ${casa}`);
    const real = monto('Real USD', `Real ${casa}`);
    const fh = leerFechaHora(val('Fecha'));
    if (fh === false) errores.push('fecha ilegible');
    return {
      id: f.id, detalle: String(val('Detalle')), categoria: String(val('Categoría')).trim() || 'Otros',
      fecha: fh ? fh.fecha : null, efectivo: normalizar(val('Efectivo?')) === 'si',
      presupuesto, real, error: errores[0] || null, ...meta(f),
    };
  });

  const actividades = filas('Itinerario').map(f => {
    const val = n => valorDe(f.valores, n);
    const fh = leerFechaHora(val('Fechas'));
    const inicio = leerHora(val('Hora inicio')), fin = leerHora(val('Hora fin'));
    let error = null;
    if (!fh) error = fh === null ? 'sin fecha' : 'fecha ilegible';
    else if (Number.isNaN(inicio) || Number.isNaN(fin)) error = 'hora ilegible';
    else if (inicio !== null && fin !== null && fin <= inicio) error = 'hora fin antes de inicio';
    return {
      id: f.id, fecha: fh ? fh.fecha : null, franja: String(val('Tiempo')).trim(),
      inicio: Number.isNaN(inicio) ? null : inicio, fin: Number.isNaN(fin) ? null : fin,
      ciudad: String(val('Ciudad')).trim(), actividad: String(val('Actividad')).trim(),
      opcional: normalizar(val('Obligatorio/Opcional')).startsWith('opcional'), error, ...meta(f),
    };
  });

  const lugares = filas('Lugares').map(f => {
    const val = n => valorDe(f.valores, n);
    return {
      id: f.id, actividadId: idDe(val('Actividad ID')), lugar: String(val('Lugar')), mapa: String(val('Dirección / Mapa')).trim(),
      notas: String(val('Notas')), hecho: normalizar(val('Hecho')) === 'si', ...meta(f),
    };
  });

  const reservas = filas('Reservas').map(f => {
    const val = n => valorDe(f.valores, n);
    const fh = leerFechaHora(val('Fecha y hora'));
    return {
      id: f.id, tour: String(val('Tour')), fecha: fh ? fh.fecha : null, hora: fh ? fh.hora : null,
      recogida: String(val('Recogida')), enlace: String(val('Enlace')).trim(), actividadId: idDe(val('Actividad ID')),
      error: fh === false ? 'fecha ilegible' : null, ...meta(f),
    };
  });

  return {
    nombre: String(cfg['nombre del viaje'] || 'Mi viaje'), personas: numero('Personas') || 1,
    monedaLocal: local, monedaCasa: casa, efectivoInicialUsd: numero('Efectivo inicial (USD)') || 0,
    tasas, leidoEn: raw.leidoEn || null, advertencias, costos, actividades, lugares, reservas,
  };
}
```

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1`
Expected: `RESUMEN: 33 ok, 0 fallas`.

- [ ] **Step 6: Commit**

```bash
git add js tests
git commit -m "Add sheet JSON parser, in-memory fake server and fixtures

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: compute.js — dinero

**Files:**
- Create: `js/compute.js`, `tests/compute-dinero.test.js`
- Modify: `tests/todas.js`

**Interfaces:**
- Consumes: `Viaje` (Task 6), `normalizar` de `parse.js`.
- Produces: `CATEGORIAS`, `totales(v) → {presupuesto, real, diferencia, conReal, pendientes, porPersona:{presupuesto, real}}` (cada monto como `{usd, casa}`), `efectivoRestante(v) → {usd, casa, gastadoUsd}`, `porCategoria(v) → [{categoria, presupuestoUsd, realUsd}]`, `acumuladoPorDia(v) → {dias, planeado, real, sinFecha}`, `convertir(montoLocal, v) → {usd, casa}`.

- [ ] **Step 1: Escribir las pruebas**

`tests/compute-dinero.test.js`:
```js
import { prueba, igual, cerca } from './t.js';
import { parsearDatos } from '../js/parse.js';
import { totales, efectivoRestante, porCategoria, acumuladoPorDia, convertir } from '../js/compute.js';
import { rawEjemplo, conValores } from './fixtures.js';

const viaje = (raw = rawEjemplo()) => parsearDatos(raw);

prueba('dinero: totales sin reales', () => {
  const t = totales(viaje());
  cerca(t.presupuesto.usd, 2854.59, 0.01);
  cerca(t.presupuesto.casa, 1298836.3, 1);
  igual([t.real.usd, t.conReal, t.pendientes], [0, 0, 16]);
  cerca(t.porPersona.presupuesto.usd, 1427.29, 0.01);
});
prueba('dinero: la diferencia usa solo filas con real', () => {
  const t = totales(viaje(conValores(rawEjemplo(), 'Costos', 1, { 'Real USD': 700 })));
  cerca(t.diferencia.usd, 3.08, 0.001);
  igual(t.conReal, 1);
});
prueba('dinero: efectivo restante = $50.38', () => {
  const e = efectivoRestante(viaje());
  cerca(e.usd, 50.38, 0.001);
  cerca(e.casa, 22922.9, 0.1);
  cerca(e.gastadoUsd, 149.62, 0.001);
});
prueba('dinero: el efectivo usa el real cuando existe', () => {
  cerca(efectivoRestante(viaje(conValores(rawEjemplo(), 'Costos', 11, { 'Real USD': 35 }))).usd, 45.76, 0.001);
});
prueba('dinero: presupuesto por categoría', () => {
  const c = porCategoria(viaje());
  igual(c.map(x => x.categoria), ['Transporte', 'Hospedaje', 'Comida', 'Tours', 'Compras']);
  [987.96, 853.04, 329.67, 249.3, 434.62].forEach((n, i) => cerca(c[i].presupuestoUsd, n, 0.01));
});
prueba('dinero: acumulado por día', () => {
  let raw = conValores(rawEjemplo(), 'Costos', 1, { 'Fecha': '2026-09-27' });
  raw = conValores(raw, 'Costos', 10, { 'Fecha': '2026-09-29', 'Real USD': 40 });
  const a = acumuladoPorDia(viaje(raw));
  igual([a.dias, a.real, a.sinFecha], [['2026-09-27', '2026-09-29'], [0, 40], 14]);
  cerca(a.planeado[1], 736.52, 0.001);
});
prueba('dinero: conversor COP → USD y CRC', () => {
  const r = convertir(85000, viaje());
  cerca(r.usd, 26.35, 0.001);
  cerca(r.casa, 11900, 0.001);
});
```

En `tests/todas.js` agrega `import './compute-dinero.test.js';`.

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1`
Expected: código 2 (el módulo `js/compute.js` no existe).

- [ ] **Step 3: Crear `js/compute.js` con la parte de dinero**

```js
import { normalizar } from './parse.js';

export const CATEGORIAS = ['Transporte', 'Hospedaje', 'Comida', 'Tours', 'Compras', 'Otros'];

const validos = v => v.costos.filter(c => !c.error);
const suma = (lista, f) => lista.reduce((t, x) => { const m = f(x); return m ? { usd: t.usd + m.usd, casa: t.casa + m.casa } : t; }, { usd: 0, casa: 0 });
const dividir = (m, n) => ({ usd: m.usd / n, casa: m.casa / n });

export function totales(v) {
  const cs = validos(v);
  const conReal = cs.filter(c => c.real);
  const presupuesto = suma(cs, c => c.presupuesto);
  const real = suma(conReal, c => c.real);
  const planDeReales = suma(conReal, c => c.presupuesto);
  return {
    presupuesto, real,
    diferencia: { usd: real.usd - planDeReales.usd, casa: real.casa - planDeReales.casa },
    conReal: conReal.length, pendientes: cs.length - conReal.length,
    porPersona: { presupuesto: dividir(presupuesto, v.personas), real: dividir(real, v.personas) },
  };
}

export function efectivoRestante(v) {
  const gastado = suma(validos(v).filter(c => c.efectivo), c => c.real || c.presupuesto);
  const usd = v.efectivoInicialUsd - gastado.usd;
  return { usd, casa: usd * v.tasas.usdCasa, gastadoUsd: gastado.usd };
}

export function porCategoria(v) {
  const m = new Map();
  for (const c of validos(v)) {
    const k = c.categoria || 'Otros';
    const e = m.get(k) || { categoria: k, presupuestoUsd: 0, realUsd: 0 };
    e.presupuestoUsd += c.presupuesto?.usd || 0;
    e.realUsd += c.real?.usd || 0;
    m.set(k, e);
  }
  const orden = k => { const i = CATEGORIAS.indexOf(k); return i < 0 ? CATEGORIAS.length : i; };
  return [...m.values()].sort((a, b) => orden(a.categoria) - orden(b.categoria) || a.categoria.localeCompare(b.categoria));
}

export function acumuladoPorDia(v) {
  const cs = validos(v);
  const conFecha = cs.filter(c => c.fecha);
  const dias = [...new Set(conFecha.map(c => c.fecha))].sort();
  let p = 0, r = 0;
  const planeado = [], real = [];
  for (const d of dias) {
    for (const c of conFecha.filter(x => x.fecha === d)) { p += c.presupuesto?.usd || 0; r += c.real?.usd || 0; }
    planeado.push(p);
    real.push(r);
  }
  return { dias, planeado, real, sinFecha: cs.length - conFecha.length };
}

export function convertir(monto, v) {
  return { usd: monto * v.tasas.localUsd, casa: monto * v.tasas.localCasa };
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1`
Expected: `RESUMEN: 40 ok, 0 fallas`.

- [ ] **Step 5: Commit**

```bash
git add js tests
git commit -m "Add budget, cash, category and daily spend calculations

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: compute.js — hoy, intervalos y choques

**Files:**
- Modify: `js/compute.js` (agregar al final)
- Create: `tests/compute-horarios.test.js`
- Modify: `tests/todas.js`

**Interfaces:**
- Produces: `FRANJAS`, `hoyISO(date?) → 'yyyy-mm-dd'` (fecha local), `diasEntre(a, b) → int`, `estadoViaje(v, hoy) → {fase:'antes'|'durante'|'despues'|'sin-datos', dia, faltan?, inicio?, fin?}`, `intervalo(actividad, v) → {ini, fin}|null`, `actividadesDelDia(v, fecha) → (Actividad & {intervalo, lugares})[]`, `reservasDelDia(v, fecha) → Reserva[]`, `choques(v) → [{fecha, ids:[idA, idB]} | {fecha, ids:[idA], reservaId}]`, `choquesDe(v, {id?, fecha, franja, inicio, fin}) → [{id, actividad, ini, fin}]`, `idsEnChoque(choques) → Set<id>`, `diasDelItinerario(v) → [{fecha, ciudad, actividades}]`.

- [ ] **Step 1: Escribir las pruebas**

`tests/compute-horarios.test.js`:
```js
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
```

En `tests/todas.js` agrega `import './compute-horarios.test.js';`.

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1`
Expected: código 2 (los imports `hoyISO`, etc. no existen en `compute.js`).

- [ ] **Step 3: Implementar**

Agregar al final de `js/compute.js`:
```js
export const FRANJAS = { 'manana': [360, 720], 'manana-tarde': [360, 1080], 'tarde': [720, 1080], 'noche': [1080, 1440] };
const ORDEN_FRANJA = ['manana', 'manana-tarde', 'tarde', 'noche'];
const pad2 = n => String(n).padStart(2, '0');

export function hoyISO(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function diasEntre(a, b) {
  const t = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((t(b) - t(a)) / 86400000);
}

export function estadoViaje(v, hoy) {
  const fechas = v.actividades.filter(a => a.fecha).map(a => a.fecha).sort();
  if (!fechas.length) return { fase: 'sin-datos', dia: null };
  const inicio = fechas[0], fin = fechas[fechas.length - 1];
  if (hoy < inicio) return { fase: 'antes', faltan: diasEntre(hoy, inicio), dia: inicio, inicio, fin };
  if (hoy > fin) return { fase: 'despues', dia: null, inicio, fin };
  return { fase: 'durante', dia: hoy, inicio, fin };
}

export function intervalo(a, v) {
  if (a.error || !a.fecha) return null;
  const base = FRANJAS[normalizar(a.franja)] || null;
  let ini = a.inicio;
  if (ini === null && a.id !== undefined) {
    const r = v.reservas.find(x => x.actividadId === a.id && x.hora !== null);
    if (r) ini = r.hora;
  }
  const fin = a.fin;
  if (ini !== null && fin !== null) return { ini, fin };
  if (ini !== null) return { ini, fin: base && base[1] > ini ? base[1] : ini + 60 };
  if (fin !== null) return { ini: base && base[0] < fin ? base[0] : fin - 60, fin };
  return base ? { ini: base[0], fin: base[1] } : null;
}

const ordenFranja = a => { const i = ORDEN_FRANJA.indexOf(normalizar(a.franja)); return i < 0 ? ORDEN_FRANJA.length : i; };

export function actividadesDelDia(v, fecha) {
  return v.actividades
    .filter(a => a.fecha === fecha)
    .map(a => ({ ...a, intervalo: intervalo(a, v), lugares: v.lugares.filter(l => l.actividadId === a.id) }))
    .sort((a, b) => (a.intervalo?.ini ?? 1e4) - (b.intervalo?.ini ?? 1e4) || ordenFranja(a) - ordenFranja(b) || a.id - b.id);
}

export function reservasDelDia(v, fecha) {
  return v.reservas.filter(r => r.fecha === fecha).sort((a, b) => (a.hora ?? 1e4) - (b.hora ?? 1e4));
}

const solapan = (x, y) => x.ini < y.fin && y.ini < x.fin;

export function choques(v) {
  const res = [];
  const porDia = new Map();
  for (const a of v.actividades) {
    const i = intervalo(a, v);
    if (!i) continue;
    if (!porDia.has(a.fecha)) porDia.set(a.fecha, []);
    porDia.get(a.fecha).push({ id: a.id, ...i });
  }
  const dias = [...porDia.keys()].sort();
  for (const fecha of dias) {
    const lista = porDia.get(fecha).sort((a, b) => a.id - b.id);
    for (let i = 0; i < lista.length; i++)
      for (let j = i + 1; j < lista.length; j++)
        if (solapan(lista[i], lista[j])) res.push({ fecha, ids: [lista[i].id, lista[j].id] });
  }
  const idsAct = new Set(v.actividades.map(a => a.id));
  for (const r of v.reservas) {
    if (r.hora === null || !r.fecha || (r.actividadId !== null && idsAct.has(r.actividadId))) continue;
    for (const a of porDia.get(r.fecha) || []) if (a.ini <= r.hora && r.hora < a.fin) res.push({ fecha: r.fecha, ids: [a.id], reservaId: r.id });
  }
  return res;
}

export function choquesDe(v, cand) {
  const i = intervalo({ error: null, ...cand }, v);
  if (!i) return [];
  return v.actividades
    .filter(a => a.fecha === cand.fecha && a.id !== cand.id)
    .map(a => ({ a, i: intervalo(a, v) }))
    .filter(x => x.i && solapan(i, x.i))
    .map(x => ({ id: x.a.id, actividad: x.a.actividad, ...x.i }));
}

export function idsEnChoque(lista) {
  return new Set(lista.flatMap(c => c.ids));
}

export function diasDelItinerario(v) {
  const fechas = [...new Set(v.actividades.filter(a => a.fecha).map(a => a.fecha))].sort();
  return fechas.map(fecha => {
    const actividades = actividadesDelDia(v, fecha);
    return { fecha, ciudad: actividades[0]?.ciudad || '', actividades };
  });
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1`
Expected: `RESUMEN: 51 ok, 0 fallas`.

- [ ] **Step 5: Commit**

```bash
git add js tests
git commit -m "Add today view, time intervals and overlap detection

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: api.js y store.js

**Files:**
- Create: `js/api.js`, `js/store.js`, `tests/api-store.test.js`
- Modify: `tests/todas.js`

**Interfaces:**
- Produces:
  - `crearApi({url, clave}, {timeout=10000, fetchFn}?) → {leer() → raw, enviar(ops) → resultados}`. Los errores lanzados tienen `e.autorizacion = true` cuando la clave es incorrecta y `e.configuracion = true` cuando la respuesta no es JSON.
  - `crearMemoria() → {getItem, setItem}`.
  - `crearStore(clave?, storage?) → {cargar() → {raw, ops, ajustes:{url, clave}}, guardar(estado) → bool}`.

- [ ] **Step 1: Escribir las pruebas**

`tests/api-store.test.js`:
```js
import { prueba, igual } from './t.js';
import { crearApi } from '../js/api.js';
import { crearStore, crearMemoria } from '../js/store.js';

const respuesta = json => Promise.resolve({ ok: true, status: 200, json: async () => json });
async function error(fn) { try { await fn(); } catch (e) { return e; } return null; }

prueba('api: leer arma la URL con la clave', async () => {
  let url = null;
  const api = crearApi({ url: 'https://x/exec', clave: 'a b' }, { fetchFn: u => { url = u; return respuesta({ ok: true, tablas: {} }); } });
  igual((await api.leer()).ok, true);
  igual(url, 'https://x/exec?op=leer&clave=a%20b');
});
prueba('api: enviar hace POST text/plain con clave y ops', async () => {
  let pedido = null;
  const api = crearApi({ url: 'https://x/exec', clave: 'k' }, { fetchFn: (u, o) => { pedido = o; return respuesta({ ok: true, resultados: [{ opId: '1', ok: true }] }); } });
  igual(await api.enviar([{ opId: '1' }]), [{ opId: '1', ok: true }]);
  igual([pedido.method, pedido.headers['Content-Type'], JSON.parse(pedido.body)], ['POST', 'text/plain;charset=utf-8', { clave: 'k', ops: [{ opId: '1' }] }]);
});
prueba('api: "no autorizado" se marca como error de autorización', async () => {
  const api = crearApi({ url: 'u', clave: 'mala' }, { fetchFn: () => respuesta({ ok: false, error: 'no autorizado' }) });
  const e = await error(() => api.leer());
  igual([e.message, e.autorizacion], ['no autorizado', true]);
});
prueba('api: una respuesta que no es JSON da un mensaje claro', async () => {
  const api = crearApi({ url: 'u', clave: 'k' }, { fetchFn: () => Promise.resolve({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } }) });
  const e = await error(() => api.leer());
  igual([e.message, e.configuracion], ['El script no devolvió datos válidos: revisa el despliegue (acceso "Cualquier usuario").', true]);
});
prueba('api: tiempo de espera agotado', async () => {
  const colgado = (u, o) => new Promise((_, rechazar) => o.signal.addEventListener('abort', () => rechazar(new DOMException('abortado', 'AbortError'))));
  const e = await error(() => crearApi({ url: 'u', clave: 'k' }, { timeout: 20, fetchFn: colgado }).leer());
  igual(e.message, 'tiempo de espera agotado');
});
prueba('store: guarda y carga solo lo persistente', () => {
  const s = crearStore('k', crearMemoria());
  igual(s.guardar({ raw: { a: 1 }, ops: [{ opId: 'x' }], ajustes: { url: 'u', clave: 'c' }, pestana: 'hoy' }), true);
  igual(s.cargar(), { raw: { a: 1 }, ops: [{ opId: 'x' }], ajustes: { url: 'u', clave: 'c' } });
});
prueba('store: sin almacenamiento disponible no rompe', () => {
  const roto = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } };
  const s = crearStore('k', roto);
  igual(s.cargar(), { raw: null, ops: [], ajustes: { url: '', clave: '' } });
  igual(s.guardar({ raw: null, ops: [], ajustes: {} }), false);
});
```

En `tests/todas.js` agrega `import './api-store.test.js';`.

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1`
Expected: código 2 (módulos inexistentes).

- [ ] **Step 3: Crear `js/api.js` y `js/store.js`**

`js/api.js`:
```js
async function pedir(fetchFn, url, opciones, timeout) {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), timeout);
  try {
    const resp = await fetchFn(url, { ...opciones, signal: control.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    let json;
    try { json = await resp.json(); } catch {
      const e = new Error('El script no devolvió datos válidos: revisa el despliegue (acceso "Cualquier usuario").');
      e.configuracion = true;
      throw e;
    }
    if (!json.ok) {
      const e = new Error(json.error || 'error desconocido');
      e.autorizacion = json.error === 'no autorizado';
      throw e;
    }
    return json;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('tiempo de espera agotado');
    throw e;
  } finally {
    clearTimeout(reloj);
  }
}

export function crearApi({ url, clave }, { timeout = 10000, fetchFn = (...a) => fetch(...a) } = {}) {
  return {
    leer: () => pedir(fetchFn, `${url}?op=leer&clave=${encodeURIComponent(clave)}`, {}, timeout),
    enviar: async ops => (await pedir(fetchFn, url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ clave, ops }),
    }, timeout)).resultados,
  };
}
```

`js/store.js`:
```js
export function crearMemoria() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); } };
}

function almacenLocal() {
  try { return globalThis.localStorage || crearMemoria(); } catch { return crearMemoria(); }
}

export function crearStore(clave = 'dashboard-viaje', storage = almacenLocal()) {
  return {
    cargar() {
      let d = {};
      try { d = JSON.parse(storage.getItem(clave)) || {}; } catch { d = {}; }
      return { raw: d.raw || null, ops: d.ops || [], ajustes: d.ajustes || { url: '', clave: '' } };
    },
    guardar(estado) {
      try { storage.setItem(clave, JSON.stringify({ raw: estado.raw, ops: estado.ops, ajustes: estado.ajustes })); return true; } catch { return false; }
    },
  };
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1`
Expected: `RESUMEN: 58 ok, 0 fallas`.

- [ ] **Step 5: Commit**

```bash
git add js tests
git commit -m "Add Apps Script client with timeout and safe local storage

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: queue.js — cola sin conexión

**Files:**
- Create: `js/queue.js`, `tests/queue.test.js`
- Modify: `tests/todas.js`

**Interfaces:**
- Consumes: `normalizar` (parse.js). En las pruebas usa `servidorEjemplo()`.
- Produces:
  - `crearOp(op, tabla, {id, valores}, uuid?) → Op`, con `Op = {opId, op, tabla, id, valores, estado:'pendiente'|'error', error}`.
  - `idTemporal(raw, ops) → int negativo`.
  - `aplicarPendientes(raw, ops) → raw` (marca `pendiente` y `errorSync` en las filas) y `consolidar(raw, ops) → raw` (sin marcas).
  - `sincronizar(ops, enviar) → Promise<{ops, confirmadas, reemplazos:[{tabla, temp, real}], enviado}>`. Si falla la red, lanza el error de `enviar`.
  - `aplicarReemplazos(ops, reemplazos) → ops`, `reintentar(ops, opId)`, `descartar(ops, opId)`.

- [ ] **Step 1: Escribir las pruebas**

`tests/queue.test.js`:
```js
import { prueba, igual } from './t.js';
import { parsearDatos } from '../js/parse.js';
import { crearOp, idTemporal, aplicarPendientes, consolidar, sincronizar, aplicarReemplazos, reintentar, descartar } from '../js/queue.js';
import { rawEjemplo, servidorEjemplo, conFila } from './fixtures.js';

const fijo = id => () => id;
const cena = { 'Fechas': '2026-10-01', 'Tiempo': 'Noche', 'Ciudad': 'Medellin', 'Actividad': 'Cena' };

prueba('cola: agregar se ve al instante marcado pendiente', () => {
  const raw = rawEjemplo();
  const op = crearOp('agregar', 'Costos', { id: idTemporal(raw, []), valores: { 'Detalle': 'Taxi', 'Real USD': 12 } }, fijo('a'));
  const v = parsearDatos(aplicarPendientes(raw, [op]));
  const c = v.costos.at(-1);
  igual([v.costos.length, c.id, c.detalle, c.pendiente, c.real.usd], [17, -1, 'Taxi', true, 12]);
});
prueba('cola: eliminar una actividad oculta sus lugares y desvincula reservas', () => {
  const raw = conFila(rawEjemplo(), 'Lugares', 1, { 'Actividad ID': 8, 'Lugar': 'X' });
  const v = parsearDatos(aplicarPendientes(raw, [crearOp('eliminar', 'Itinerario', { id: 8 }, fijo('e'))]));
  igual([v.actividades.some(a => a.id === 8), v.lugares.length, v.reservas.find(r => r.id === 1).actividadId], [false, 0, null]);
});
prueba('cola: una operación con error sigue visible con ⚠', () => {
  const op = { ...crearOp('eliminar', 'Costos', { id: 3 }, fijo('e')), estado: 'error', error: 'no existe' };
  const c = parsearDatos(aplicarPendientes(rawEjemplo(), [op])).costos.find(x => x.id === 3);
  igual([c.pendiente, c.errorSync], [false, 'no existe']);
});
prueba('cola: sincronizar envía en orden y consolida', async () => {
  const s = servidorEjemplo();
  const raw = s.leer();
  const ops = [
    crearOp('agregar', 'Costos', { id: -1, valores: { 'Detalle': 'Taxi', 'Real USD': 12 } }, fijo('a')),
    crearOp('modificar', 'Costos', { id: 2, valores: { 'Real CRC': 140000 } }, fijo('b')),
  ];
  const r = await sincronizar(ops, async x => s.enviar(x));
  igual([r.ops, r.reemplazos, r.enviado], [[], [{ tabla: 'Costos', temp: -1, real: 17 }], true]);
  const v = parsearDatos(consolidar(raw, r.confirmadas));
  igual([v.costos.find(c => c.id === 17).detalle, v.costos.find(c => c.id === 2).real.casa, v.costos.some(c => c.pendiente)], ['Taxi', 140000, false]);
  igual(s.libro.Costos.length, 18);
});
prueba('cola: reintentar después de perder la respuesta no duplica', async () => {
  const s = servidorEjemplo();
  const ops = [crearOp('agregar', 'Costos', { id: -1, valores: { 'Detalle': 'Taxi' } }, fijo('a'))];
  s.fallarDespues = true;
  let mensaje = null;
  try { await sincronizar(ops, async x => s.enviar(x)); } catch (e) { mensaje = e.message; }
  igual(mensaje, 'respuesta perdida');
  const r = await sincronizar(ops, async x => s.enviar(x));
  igual([r.ops, s.libro.Costos.filter(f => f[1] === 'Taxi').length], [[], 1]);
});
prueba('cola: ID temporal dentro del mismo lote', async () => {
  const s = servidorEjemplo();
  await sincronizar([
    crearOp('agregar', 'Itinerario', { id: -1, valores: cena }, fijo('a')),
    crearOp('agregar', 'Lugares', { id: -2, valores: { 'Actividad ID': -1, 'Lugar': 'Carmen' } }, fijo('b')),
  ], async x => s.enviar(x));
  igual(s.libro.Lugares[1].slice(0, 3), [1, 14, 'Carmen']);
});
prueba('cola: ID temporal en operaciones creadas durante el envío', async () => {
  const s = servidorEjemplo();
  const r = await sincronizar([crearOp('agregar', 'Itinerario', { id: -1, valores: cena }, fijo('a'))], async x => s.enviar(x));
  const [b] = aplicarReemplazos([crearOp('agregar', 'Lugares', { id: -2, valores: { 'Actividad ID': -1, 'Lugar': 'Carmen' } }, fijo('b'))], r.reemplazos);
  igual(b.valores['Actividad ID'], 14);
});
prueba('cola: "no existe" queda como error; reintentar y descartar', async () => {
  const s = servidorEjemplo();
  const r = await sincronizar([crearOp('modificar', 'Costos', { id: 99, valores: { 'Real USD': 1 } }, fijo('x'))], async x => s.enviar(x));
  igual([r.ops[0].estado, r.ops[0].error], ['error', 'no existe']);
  igual(reintentar(r.ops, 'x')[0].estado, 'pendiente');
  igual(descartar(r.ops, 'x'), []);
});
prueba('cola: sin conexión la cola queda intacta', async () => {
  const s = servidorEjemplo();
  s.caido = true;
  const ops = [crearOp('modificar', 'Costos', { id: 1, valores: { 'Real USD': 1 } }, fijo('x'))];
  let mensaje = null;
  try { await sincronizar(ops, async x => s.enviar(x)); } catch (e) { mensaje = e.message; }
  igual([mensaje, ops[0].estado], ['sin conexión', 'pendiente']);
});
prueba('cola: sin pendientes no envía nada', async () => {
  let llamadas = 0;
  const r = await sincronizar([], async () => { llamadas++; return []; });
  igual([r.enviado, llamadas], [false, 0]);
});
```

En `tests/todas.js` agrega `import './queue.test.js';`.

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1`
Expected: código 2 (`js/queue.js` no existe).

- [ ] **Step 3: Crear `js/queue.js`**

```js
import { normalizar } from './parse.js';

export function crearOp(op, tabla, { id = null, valores = {} } = {}, uuid = () => crypto.randomUUID()) {
  return { opId: uuid(), op, tabla, id, valores: { ...valores }, estado: 'pendiente', error: null };
}

export function idTemporal(raw, ops) {
  let min = 0;
  for (const t of Object.values(raw?.tablas || {})) for (const f of t.filas) if (f.id < min) min = f.id;
  for (const o of ops) if (o.id < min) min = o.id;
  return min - 1;
}

const claveNorm = (valores, nombre) => Object.keys(valores).find(k => normalizar(k) === normalizar(nombre));

function asignar(destino, origen) {
  for (const [k, v] of Object.entries(origen)) destino[claveNorm(destino, k) ?? k] = v;
}

function aplicarOps(raw, ops, { marcar }) {
  if (!raw) return raw;
  const r = structuredClone(raw);
  for (const o of ops) {
    const t = r.tablas[o.tabla];
    if (!t) continue;
    const marca = f => {
      if (!marcar) return;
      f.pendiente = o.estado !== 'error';
      f.errorSync = o.estado === 'error' ? o.error : null;
    };
    if (o.op === 'agregar') {
      const f = { id: o.id, valores: {} };
      for (const h of t.encabezados) if (normalizar(h) !== 'id') f.valores[h] = '';
      asignar(f.valores, o.valores);
      marca(f);
      t.filas.push(f);
      continue;
    }
    const f = t.filas.find(x => x.id === o.id);
    if (!f) continue;
    if (o.op === 'modificar') { asignar(f.valores, o.valores); marca(f); }
    if (o.op === 'eliminar') {
      if (marcar && o.estado === 'error') { marca(f); continue; }
      t.filas = t.filas.filter(x => x !== f);
      if (o.tabla === 'Itinerario') {
        const vinculo = x => { const k = claveNorm(x.valores, 'Actividad ID'); return k && x.valores[k] !== '' && Number(x.valores[k]) === o.id ? k : null; };
        if (r.tablas.Lugares) r.tablas.Lugares.filas = r.tablas.Lugares.filas.filter(x => !vinculo(x));
        for (const x of r.tablas.Reservas?.filas || []) { const k = vinculo(x); if (k) x.valores[k] = ''; }
      }
    }
  }
  return r;
}

export const aplicarPendientes = (raw, ops) => aplicarOps(raw, ops, { marcar: true });
export const consolidar = (raw, ops) => aplicarOps(raw, ops, { marcar: false });

function reemplazarId(o, { tabla, temp, real }) {
  let x = o;
  if (x.tabla === tabla && x.id === temp) x = { ...x, id: real };
  if (tabla === 'Itinerario') {
    const k = claveNorm(x.valores, 'Actividad ID');
    if (k && x.valores[k] !== '' && Number(x.valores[k]) === temp) x = { ...x, valores: { ...x.valores, [k]: real } };
  }
  return x;
}

export const aplicarReemplazos = (ops, reemplazos) => ops.map(o => reemplazos.reduce(reemplazarId, o));

export async function sincronizar(ops, enviar) {
  const lote = ops.filter(o => o.estado === 'pendiente');
  if (!lote.length) return { ops, confirmadas: [], reemplazos: [], enviado: false };
  const resultados = await enviar(lote.map(({ opId, op, tabla, id, valores }) => ({ opId, op, tabla, id, valores })));
  let restantes = ops.slice();
  const confirmadas = [], reemplazos = [];
  for (const r of resultados) {
    const o = restantes.find(x => x.opId === r.opId);
    if (!o) continue;
    if (r.ok) {
      restantes = restantes.filter(x => x !== o);
      if (o.op === 'agregar' && o.id < 0 && r.id != null) {
        const rep = { tabla: o.tabla, temp: o.id, real: r.id };
        reemplazos.push(rep);
        confirmadas.push(reemplazarId(o, rep));
        restantes = restantes.map(x => reemplazarId(x, rep));
      } else {
        confirmadas.push(o);
      }
    } else {
      restantes = restantes.map(x => (x === o ? { ...x, estado: 'error', error: r.error } : x));
    }
  }
  return { ops: restantes, confirmadas, reemplazos, enviado: true };
}

export const reintentar = (ops, opId) => ops.map(o => (o.opId === opId ? { ...o, estado: 'pendiente', error: null } : o));
export const descartar = (ops, opId) => ops.filter(o => o.opId !== opId);
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1`
Expected: `RESUMEN: 68 ok, 0 fallas`.

- [ ] **Step 5: Commit**

```bash
git add js tests
git commit -m "Add offline operation queue with optimistic updates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: formato.js, forms.js y editores.js

**Files:**
- Create: `js/formato.js`, `js/forms.js`, `js/editores.js`, `tests/editores.test.js`
- Modify: `tests/todas.js`

**Interfaces:**
- Consumes: `CATEGORIAS`, `choquesDe` (compute.js), `leerHora` (parse.js).
- Produces:
  - `formato.js`: `esc(s)`, `dinero(n, moneda) → '$1,234.56' | '₡1,298,836' | 'COP 85,000' | '—'`, `hora(min) → 'H:MM'`, `horaInput(min) → 'HH:MM'|''`, `fechaCorta(iso) → 'dom 27/9'`, `fechaLarga(iso) → 'domingo 27 de septiembre'`, `hace(iso, ahora?) → 'hace 5 min'`, `marcas(item) → html`.
  - `forms.js`: `abrirFormulario({titulo, campos, onGuardar(valores), onEliminar?, validar?(valores) → string|null})`. Cada campo es `{nombre, etiqueta, tipo:'texto'|'numero'|'fecha'|'hora'|'lista'|'si-no'|'area'|'monto', valor?, opciones?:[{valor, texto}], monedas?, sugerencias?, requerido?}`. Un campo `monto` devuelve `{cantidad:number|'', moneda}`. Usa el `<dialog id="hoja">`.
  - `editores.js`: `montoAValores(monto, prefijo, casa)`, `costoAValores(f, casa)`, `actividadAValores(f)`, `lugarAValores(f, actividadId)`, `reservaAValores(f)` (todos devuelven `{encabezado: valor}`), y `editarCosto(v, costo|null, cb)`, `editarActividad(v, act|null, cb)`, `editarLugar(v, actividadId, lugar|null, cb)`, `editarReserva(v, reserva|null, cb)`, con `cb = {guardar(valores), eliminar()}`.

- [ ] **Step 1: Escribir las pruebas**

`tests/editores.test.js`:
```js
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
```

En `tests/todas.js` agrega `import './editores.test.js';`.

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1`
Expected: código 2 (módulos inexistentes).

- [ ] **Step 3: Crear `js/formato.js`**

```js
const SIMBOLOS = { USD: '$', CRC: '₡', EUR: '€' };
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const pad = n => String(n).padStart(2, '0');

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function dinero(n, moneda) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const decimales = moneda === 'USD' ? 2 : 0;
  const [entero, dec] = Math.abs(n).toFixed(decimales).split('.');
  const texto = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (dec ? `.${dec}` : '');
  const simbolo = SIMBOLOS[moneda] ?? `${moneda} `;
  return `${n < 0 ? '-' : ''}${simbolo}${texto}`;
}

export const hora = min => (min === null || min === undefined ? '' : `${Math.floor(min / 60)}:${pad(min % 60)}`);
export const horaInput = min => (min === null || min === undefined ? '' : `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`);

const aFecha = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
export const fechaCorta = iso => { const d = aFecha(iso); return `${DIAS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`; };
export const fechaLarga = iso => { const d = aFecha(iso); return `${DIAS_LARGOS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`; };

export function hace(iso, ahora = new Date()) {
  if (!iso) return '';
  const m = Math.round((ahora - new Date(iso)) / 60000);
  if (m < 1) return 'hace un momento';
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

export function marcas(x) {
  return (x.pendiente ? ' <span class="marca" title="Pendiente de enviar">⏳</span>' : '')
    + (x.errorSync ? ` <span class="marca error" title="${esc(x.errorSync)}">⚠</span>` : '')
    + (x.error ? ` <span class="marca error">⚠ ${esc(x.error)}</span>` : '');
}
```

- [ ] **Step 4: Crear `js/forms.js`**

```js
import { esc } from './formato.js';

function campoHtml(c) {
  const id = `f-${c.nombre}`;
  const v = c.valor ?? '';
  let control;
  switch (c.tipo) {
    case 'lista':
      control = `<select id="${id}" name="${c.nombre}">${c.opciones.map(o => `<option value="${esc(o.valor)}"${String(o.valor) === String(v) ? ' selected' : ''}>${esc(o.texto)}</option>`).join('')}</select>`;
      break;
    case 'si-no':
      control = `<input type="checkbox" id="${id}" name="${c.nombre}"${v ? ' checked' : ''}>`;
      break;
    case 'area':
      control = `<textarea id="${id}" name="${c.nombre}" rows="2">${esc(v)}</textarea>`;
      break;
    case 'monto':
      control = `<div class="monto"><input id="${id}" name="${c.nombre}" type="number" step="any" inputmode="decimal" value="${esc(v.cantidad ?? '')}">`
        + `<select name="${c.nombre}__moneda">${c.monedas.map(m => `<option${m === v.moneda ? ' selected' : ''}>${esc(m)}</option>`).join('')}</select></div>`;
      break;
    default: {
      const tipo = { numero: 'number', fecha: 'date', hora: 'time' }[c.tipo] || 'text';
      const extra = (tipo === 'number' ? ' step="any" inputmode="decimal"' : '') + (c.sugerencias ? ` list="${id}-l"` : '');
      control = `<input id="${id}" name="${c.nombre}" type="${tipo}"${extra} value="${esc(v)}">`
        + (c.sugerencias ? `<datalist id="${id}-l">${c.sugerencias.map(s => `<option value="${esc(s)}">`).join('')}</datalist>` : '');
    }
  }
  return `<label class="campo" for="${id}"><span>${esc(c.etiqueta)}</span>${control}</label>`;
}

function leerCampos(form, campos) {
  const out = {};
  for (const c of campos) {
    const el = form.elements[c.nombre];
    if (c.tipo === 'si-no') out[c.nombre] = el.checked;
    else if (c.tipo === 'monto') out[c.nombre] = { cantidad: el.value === '' ? '' : Number(el.value), moneda: form.elements[`${c.nombre}__moneda`].value };
    else if (c.tipo === 'numero') out[c.nombre] = el.value === '' ? '' : Number(el.value);
    else out[c.nombre] = el.value.trim();
  }
  return out;
}

export function abrirFormulario({ titulo, campos, onGuardar, onEliminar = null, validar = null }) {
  const dlg = document.getElementById('hoja');
  dlg.innerHTML = `<form class="formulario" novalidate>
    <h2>${esc(titulo)}</h2>
    ${campos.map(campoHtml).join('')}
    <p class="aviso-form" hidden></p>
    <div class="acciones-form">
      ${onEliminar ? '<button type="button" class="peligro" data-f="eliminar">Eliminar</button>' : ''}
      <span class="espacio"></span>
      <button type="button" data-f="cancelar">Cancelar</button>
      <button type="submit" class="primario" data-f="guardar">Guardar</button>
    </div>
  </form>`;
  const form = dlg.querySelector('form');
  const aviso = dlg.querySelector('.aviso-form');
  const guardar = dlg.querySelector('[data-f=guardar]');
  let confirmado = false;
  const reiniciar = () => { confirmado = false; aviso.hidden = true; guardar.textContent = 'Guardar'; };
  const mostrar = html => { aviso.innerHTML = html; aviso.hidden = false; };
  form.addEventListener('input', reiniciar);
  dlg.querySelector('[data-f=cancelar]').onclick = () => dlg.close();
  if (onEliminar) dlg.querySelector('[data-f=eliminar]').onclick = () => { if (confirm('¿Eliminar este elemento?')) { dlg.close(); onEliminar(); } };
  aviso.addEventListener('click', ev => { if (ev.target.dataset.f === 'corregir') { reiniciar(); form.querySelector('input, select, textarea')?.focus(); } });
  form.onsubmit = ev => {
    ev.preventDefault();
    const valores = leerCampos(form, campos);
    const faltan = campos.filter(c => c.requerido && (c.tipo === 'monto' ? valores[c.nombre].cantidad === '' : valores[c.nombre] === ''));
    if (faltan.length) { mostrar(esc(`Falta: ${faltan.map(c => c.etiqueta).join(', ')}`)); return; }
    const mensaje = !confirmado && validar ? validar(valores) : null;
    if (mensaje) {
      mostrar(`${esc(mensaje)} <button type="button" class="enlace" data-f="corregir">Corregir</button>`);
      guardar.textContent = 'Guardar de todos modos';
      confirmado = true;
      return;
    }
    dlg.close();
    onGuardar(valores);
  };
  dlg.showModal();
}
```

- [ ] **Step 5: Crear `js/editores.js`**

```js
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
```

- [ ] **Step 6: Ejecutar y verificar que pasa**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1`
Expected: `RESUMEN: 74 ok, 0 fallas`.

- [ ] **Step 7: Commit**

```bash
git add js tests
git commit -m "Add formatting helpers, bottom-sheet forms and entity editors

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: timeline.js

**Files:**
- Create: `js/timeline.js`, `tests/timeline.test.js`
- Modify: `tests/todas.js`

**Interfaces:**
- Consumes: `diasDelItinerario` (compute.js), `esc`, `hora`, `fechaCorta` (formato.js).
- Produces: `asignarCarriles(bloquesOrdenadosPorIni:[{ini, fin}]) → int[]` y `renderTimeline(v, idsChoque:Set) → html`. Cada bloque lleva `data-accion="editar-actividad" data-id data-bloque`.

- [ ] **Step 1: Escribir las pruebas**

`tests/timeline.test.js`:
```js
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
```

En `tests/todas.js` agrega `import './timeline.test.js';`.

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1`
Expected: código 2.

- [ ] **Step 3: Crear `js/timeline.js`**

```js
import { diasDelItinerario } from './compute.js';
import { esc, hora, fechaCorta } from './formato.js';

const INICIO = 360, FIN = 1440, ALTO = 2.2;

export function asignarCarriles(bloques) {
  const finCarril = [];
  return bloques.map(b => {
    let c = finCarril.findIndex(f => f <= b.ini);
    if (c < 0) { c = finCarril.length; finCarril.push(0); }
    finCarril[c] = b.fin;
    return c;
  });
}

export function renderTimeline(v, idsChoque) {
  const colores = new Map();
  const color = c => { if (!colores.has(c)) colores.set(c, colores.size % 4); return colores.get(c); };
  const pct = m => ((Math.min(Math.max(m, INICIO), FIN) - INICIO) / (FIN - INICIO)) * 100;
  const horas = [6, 9, 12, 15, 18, 21, 24].map(h => `<span style="left:${pct(h * 60)}%">${h}</span>`).join('');
  const sinHorario = [];
  const filas = diasDelItinerario(v).map(d => {
    sinHorario.push(...d.actividades.filter(a => !a.intervalo));
    const orden = d.actividades.filter(a => a.intervalo).sort((a, b) => a.intervalo.ini - b.intervalo.ini);
    const carriles = asignarCarriles(orden.map(a => a.intervalo));
    const n = Math.max(1, ...carriles.map(c => c + 1));
    const bloques = orden.map((a, i) => {
      const choque = idsChoque.has(a.id);
      const izq = pct(a.intervalo.ini), ancho = pct(a.intervalo.fin) - izq;
      return `<button class="bloque c${color(a.ciudad)}${a.opcional ? ' opcional' : ''}${choque ? ' en-choque' : ''}" data-accion="editar-actividad" data-id="${a.id}" data-bloque="${a.id}"`
        + ` style="left:${izq}%;width:${ancho}%;top:${carriles[i] * ALTO}rem" title="${esc(a.actividad)} ${hora(a.intervalo.ini)}–${hora(a.intervalo.fin)}">${choque ? '⚠ ' : ''}${esc(a.actividad)}</button>`;
    }).join('');
    const reservas = v.reservas
      .filter(r => r.fecha === d.fecha && r.hora !== null && !v.actividades.some(a => a.id === r.actividadId))
      .map(r => `<span class="marca-reserva" style="left:${pct(r.hora)}%" title="${esc(r.tour)} ${hora(r.hora)}">◆</span>`).join('');
    return `<div class="tl-dia"><div class="tl-fecha">${esc(fechaCorta(d.fecha))}<small>${esc(d.ciudad)}</small></div>`
      + `<div class="tl-pista" style="height:${n * ALTO}rem">${bloques}${reservas}</div></div>`;
  }).join('');
  const leyenda = [...colores.entries()].map(([c, i]) => `<span class="ley c${i}">${esc(c)}</span>`).join('');
  const sin = sinHorario.length
    ? `<h3>Sin horario</h3><ul>${sinHorario.map(a => `<li>${esc(fechaCorta(a.fecha))} · ${esc(a.actividad)}</li>`).join('')}</ul>`
    : '';
  return `<div class="timeline"><div class="tl-horas">${horas}</div>${filas}<div class="tl-leyenda">${leyenda}</div>${sin}</div>`;
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1`
Expected: `RESUMEN: 76 ok, 0 fallas`.

- [ ] **Step 5: Commit**

```bash
git add js tests
git commit -m "Add itinerary timeline with lanes and overlap markers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Pantallas (Hoy, Itinerario, Reservas, Costos)

**Files:**
- Create: `js/render-hoy.js`, `js/render-itinerario.js`, `js/render-reservas.js`, `js/render-costos.js`, `tests/render.test.js`
- Modify: `tests/todas.js`

**Interfaces:**
- Consumes: compute.js, formato.js, timeline.js.
- Produces:
  - `renderHoy(v, {hoy}) → html` (incluye `#conv-monto` y `#conv-resultado`).
  - `tarjetaActividad(a, {choque}?)` (necesita `a.intervalo` y `a.lugares`) y `renderItinerario(v, {vista:'lista'|'timeline', choques, hoy}) → html`.
  - `tarjetaReserva(r, {editable}?)` y `renderReservas(v) → html`.
  - `renderCostos(v, {filtro}) → html` (incluye `#filtro-categoria`).
  - Acciones de los botones (`data-accion`): `editar-actividad`, `agregar-actividad`, `agregar-lugar` (con `data-actividad`), `editar-lugar`, `hecho`, `vista-itinerario` (con `data-vista`), `ir-choque`, `editar-reserva`, `agregar-reserva`, `editar-costo`, `agregar-costo`.

- [ ] **Step 1: Escribir las pruebas**

`tests/render.test.js`:
```js
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
```

En `tests/todas.js` agrega `import './render.test.js';`.

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1`
Expected: código 2.

- [ ] **Step 3: Crear `js/render-reservas.js`**

```js
import { esc, hora, fechaLarga, marcas } from './formato.js';

export function tarjetaReserva(r, { editable = false } = {}) {
  return `<article class="reserva${r.pendiente ? ' pendiente' : ''}">
    <header><span class="franja">${r.fecha ? esc(fechaLarga(r.fecha)) : 'Sin fecha'}${r.hora !== null ? ` · ${hora(r.hora)}` : ''}</span>${marcas(r)}
      ${editable ? `<button class="icono" data-accion="editar-reserva" data-id="${r.id}" aria-label="Editar">✎</button>` : ''}</header>
    <h3>🎟 ${esc(r.tour)}</h3>
    ${r.recogida ? `<p>Recogida: ${esc(r.recogida)}</p>` : ''}
    ${r.enlace ? `<a class="boton" href="${esc(r.enlace)}" target="_blank" rel="noopener">Abrir reserva</a>` : ''}
  </article>`;
}

export function renderReservas(v) {
  const lista = v.reservas.slice().sort((a, b) => (a.fecha || '9999').localeCompare(b.fecha || '9999') || (a.hora ?? 1e4) - (b.hora ?? 1e4));
  return `<div class="barra"><h2>Reservas</h2><button class="primario" data-accion="agregar-reserva">＋ reserva</button></div>`
    + (lista.length ? lista.map(r => tarjetaReserva(r, { editable: true })).join('') : '<p class="vacio">Sin reservas.</p>');
}
```

- [ ] **Step 4: Crear `js/render-itinerario.js`**

```js
import { diasDelItinerario, idsEnChoque } from './compute.js';
import { esc, hora, fechaLarga, marcas } from './formato.js';
import { renderTimeline } from './timeline.js';

const urlMapa = m => (/^https?:\/\//.test(m) ? m : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(m)}`);

function lugarHtml(l) {
  return `<li class="${l.hecho ? 'hecho' : ''}${l.pendiente ? ' pendiente' : ''}">
    <button class="check" data-accion="hecho" data-id="${l.id}" aria-label="Marcar como hecho">${l.hecho ? '✓' : '○'}</button>
    <span class="nombre" data-accion="editar-lugar" data-id="${l.id}">${esc(l.lugar)}${l.notas ? ` — <small>${esc(l.notas)}</small>` : ''}</span>
    ${l.mapa ? `<a href="${esc(urlMapa(l.mapa))}" target="_blank" rel="noopener">mapa</a>` : ''}${marcas(l)}
  </li>`;
}

export function tarjetaActividad(a, { choque = false } = {}) {
  const horario = a.intervalo ? `${hora(a.intervalo.ini)}–${hora(a.intervalo.fin)}` : '';
  return `<article class="actividad${a.opcional ? ' opcional' : ''}${choque ? ' en-choque' : ''}${a.pendiente ? ' pendiente' : ''}" id="act-${a.id}">
    <header><span class="franja">${esc(a.franja)}${horario ? ` · ${horario}` : ''}</span>${marcas(a)}${choque ? '<span class="alerta">⚠ choque</span>' : ''}
      <button class="icono" data-accion="editar-actividad" data-id="${a.id}" aria-label="Editar">✎</button></header>
    <h3>${esc(a.actividad)}${a.opcional ? ' <small>opcional</small>' : ''}</h3>
    ${a.lugares.length ? `<ul class="lugares">${a.lugares.map(lugarHtml).join('')}</ul>` : ''}
    <button class="enlace" data-accion="agregar-lugar" data-actividad="${a.id}">＋ lugar</button>
  </article>`;
}

export function renderItinerario(v, { vista, choques, hoy }) {
  const ids = idsEnChoque(choques);
  const boton = (valor, texto) => `<button data-accion="vista-itinerario" data-vista="${valor}" class="${vista === valor ? 'activo' : ''}">${texto}</button>`;
  const estado = choques.length
    ? `<button class="alerta" data-accion="ir-choque">⚠ ${choques.length} ${choques.length === 1 ? 'choque' : 'choques'}</button>`
    : '<span class="ok">Sin choques</span>';
  const cabecera = `<div class="barra"><div class="interruptor">${boton('lista', 'Lista')}${boton('timeline', 'Timeline')}</div>${estado}
    <span class="espacio"></span><button class="primario" data-accion="agregar-actividad">＋ actividad</button></div>`;
  if (vista === 'timeline') return cabecera + renderTimeline(v, ids);
  let ciudad = null;
  const dias = diasDelItinerario(v).map(d => {
    const separador = d.ciudad !== ciudad ? `<h2 class="ciudad">${esc(d.ciudad)}</h2>` : '';
    ciudad = d.ciudad;
    return `${separador}<section class="dia${d.fecha === hoy ? ' hoy' : ''}"><h3 class="fecha">${esc(fechaLarga(d.fecha))}</h3>`
      + `${d.actividades.map(a => tarjetaActividad(a, { choque: ids.has(a.id) })).join('')}</section>`;
  }).join('');
  const sinFecha = v.actividades.filter(a => !a.fecha)
    .map(a => tarjetaActividad({ ...a, intervalo: null, lugares: v.lugares.filter(l => l.actividadId === a.id) })).join('');
  return cabecera + dias + (sinFecha ? `<h2>Sin fecha</h2>${sinFecha}` : '');
}
```

- [ ] **Step 5: Crear `js/render-hoy.js`**

```js
import { estadoViaje, efectivoRestante, totales, actividadesDelDia, reservasDelDia } from './compute.js';
import { esc, dinero, fechaLarga } from './formato.js';
import { tarjetaActividad } from './render-itinerario.js';
import { tarjetaReserva } from './render-reservas.js';

export function renderHoy(v, { hoy }) {
  const est = estadoViaje(v, hoy);
  const ef = efectivoRestante(v);
  const partes = [];
  if (est.fase === 'antes') {
    partes.push(`<section class="tarjeta destacada"><p class="grande">Faltan ${est.faltan} ${est.faltan === 1 ? 'día' : 'días'}</p><p>El viaje empieza el ${esc(fechaLarga(est.inicio))}.</p></section>`);
  }
  if (est.fase === 'despues') {
    const t = totales(v);
    partes.push(`<section class="tarjeta destacada"><p class="grande">Viaje terminado</p><p>Gasto real: ${dinero(t.real.usd, 'USD')} · ${dinero(t.real.casa, v.monedaCasa)}</p></section>`);
  }
  if (est.dia) {
    const titulo = est.fase === 'antes' ? `Primer día · ${fechaLarga(est.dia)}` : `Hoy · ${fechaLarga(est.dia)}`;
    const acts = actividadesDelDia(v, est.dia);
    partes.push(`<h2>${esc(titulo)}</h2>`
      + reservasDelDia(v, est.dia).map(r => tarjetaReserva(r)).join('')
      + (acts.length ? acts.map(a => tarjetaActividad(a)).join('') : '<p class="vacio">Nada planeado para este día.</p>'));
  }
  partes.push(`<section class="tarjeta"><h2>Efectivo</h2><p class="grande${ef.usd < 0 ? ' negativo' : ''}">${dinero(ef.usd, 'USD')}</p>`
    + `<p>${dinero(ef.casa, v.monedaCasa)} · gastado ${dinero(ef.gastadoUsd, 'USD')} de ${dinero(v.efectivoInicialUsd, 'USD')}</p></section>`);
  partes.push(`<section class="tarjeta"><h2>Conversor</h2><label class="campo" for="conv-monto"><span>Monto en ${esc(v.monedaLocal)}</span>`
    + `<input id="conv-monto" type="number" inputmode="decimal" step="any" placeholder="85000"></label><p id="conv-resultado" class="grande">—</p></section>`);
  return partes.join('');
}
```

- [ ] **Step 6: Crear `js/render-costos.js`**

```js
import { totales } from './compute.js';
import { esc, dinero, fechaCorta, marcas } from './formato.js';

export function renderCostos(v, { filtro }) {
  const t = totales(v);
  const casa = v.monedaCasa;
  const kpi = (titulo, m, extra = '') => `<div class="kpi"><span>${titulo}</span><strong>${dinero(m.usd, 'USD')}</strong><small>${dinero(m.casa, casa)}${extra}</small></div>`;
  const kpis = `<section class="kpis">
    ${kpi('Presupuesto', t.presupuesto)}
    ${kpi('Real', t.real, ` · ${t.conReal} con monto real`)}
    ${kpi('Diferencia', t.diferencia, t.conReal ? ' · solo gastos con real' : ' · aún sin reales')}
    ${kpi('Por persona', t.porPersona.presupuesto, ' · presupuesto')}
  </section>`;
  const categorias = [...new Set(v.costos.map(c => c.categoria))];
  const lista = v.costos.filter(c => !filtro || c.categoria === filtro).map(c => `
    <li class="gasto${c.pendiente ? ' pendiente' : ''}" data-accion="editar-costo" data-id="${c.id}">
      <div><strong>${esc(c.detalle)}</strong>${marcas(c)}<small>${esc(c.categoria)}${c.fecha ? ` · ${esc(fechaCorta(c.fecha))}` : ''}${c.efectivo ? ' · efectivo' : ''}</small></div>
      <div class="montos"><span>${c.real ? dinero(c.real.usd, 'USD') : '<em>sin real</em>'}</span><small>plan ${c.presupuesto ? dinero(c.presupuesto.usd, 'USD') : '—'}</small></div>
    </li>`).join('');
  return kpis + `<section class="tarjeta"><div class="barra"><h2>Gastos</h2>
      <select id="filtro-categoria"><option value="">Todas</option>${categorias.map(c => `<option${c === filtro ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <button class="primario" data-accion="agregar-costo">＋ gasto</button></div>
    <ul class="lista-gastos">${lista}</ul></section>`;
}
```

- [ ] **Step 7: Ejecutar y verificar que pasa**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1`
Expected: `RESUMEN: 81 ok, 0 fallas`.

- [ ] **Step 8: Commit**

```bash
git add js tests
git commit -m "Add Today, Itinerary, Reservations and Costs screens

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: La app — index.html, styles.css y main.js (con modo demo)

**Files:**
- Create: `index.html`, `styles.css`, `js/main.js`

**Interfaces:**
- Consumes: todos los módulos anteriores y `js/servidor-falso.js` en modo demo.
- Produces: la app. Parámetros de URL para verificar: `?demo` (usa Logica.gs en memoria), `&hoy=yyyy-mm-dd`, `&pestana=hoy|itinerario|costos|reservas`, `&vista=lista|timeline`.

- [ ] **Step 1: Crear `index.html`**

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Dashboard de Viaje</title>
  <meta name="theme-color" content="#0f766e">
  <link rel="manifest" href="manifest.json">
  <link rel="icon" href="icono.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="icono-192.png">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header id="cabecera"></header>
  <div id="aviso" hidden></div>
  <main id="contenido"></main>
  <nav id="navegacion">
    <button data-pestana="hoy">Hoy</button>
    <button data-pestana="itinerario">Itinerario</button>
    <button data-pestana="costos">Costos</button>
    <button data-pestana="reservas">Reservas</button>
  </nav>
  <dialog id="hoja"></dialog>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js" defer></script>
  <script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Crear `styles.css`**

```css
:root {
  --fondo: #f6f7f9; --superficie: #ffffff; --texto: #1d2330; --suave: #667085; --borde: #e3e6eb;
  --primario: #0f766e; --primario-texto: #ffffff; --peligro: #c2410c; --alerta: #dc2626; --ok: #15803d;
  --c0: #2563eb; --c1: #d97706; --c2: #7c3aed; --c3: #0891b2; --radio: 14px; color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root {
    --fondo: #0f1218; --superficie: #181c24; --texto: #e7eaf0; --suave: #98a2b3; --borde: #2a303b;
    --primario: #2dd4bf; --primario-texto: #062421; --peligro: #fb923c; --alerta: #f87171; --ok: #4ade80;
    --c0: #3b82f6; --c1: #d97706; --c2: #8b5cf6; --c3: #0891b2; color-scheme: dark;
  }
}
* { box-sizing: border-box; }
body { margin: 0; font: 16px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: var(--fondo); color: var(--texto); padding-bottom: calc(4.5rem + env(safe-area-inset-bottom)); }
button { font: inherit; color: inherit; cursor: pointer; }
h2 { font-size: 1.05rem; margin: 1.25rem 0 .5rem; }
#cabecera { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: .5rem; padding: .75rem 1rem; background: var(--superficie); border-bottom: 1px solid var(--borde); }
#cabecera h1 { font-size: 1.1rem; margin: 0; flex: 1; }
#cabecera .estado { font-size: .78rem; color: var(--suave); text-align: right; }
#aviso { margin: .75rem 1rem 0; padding: .4rem .8rem; border-radius: var(--radio); background: color-mix(in srgb, var(--alerta) 12%, var(--superficie)); font-size: .9rem; }
#aviso p { margin: .3rem 0; }
main { padding: 0 1rem 1rem; max-width: 720px; margin: 0 auto; }
#navegacion { position: fixed; bottom: 0; left: 0; right: 0; z-index: 5; display: grid; grid-template-columns: repeat(4, 1fr); background: var(--superficie); border-top: 1px solid var(--borde); padding-bottom: env(safe-area-inset-bottom); }
#navegacion button { padding: .9rem 0; background: none; border: 0; color: var(--suave); font-size: .85rem; }
#navegacion button.activo { color: var(--primario); font-weight: 600; }
.tarjeta, .actividad, .reserva { background: var(--superficie); border: 1px solid var(--borde); border-radius: var(--radio); padding: .8rem 1rem; margin: .6rem 0; }
.destacada { border-color: var(--primario); }
.grande { font-size: 1.6rem; font-weight: 700; margin: .2rem 0; }
.negativo { color: var(--alerta); }
.vacio, .nota { color: var(--suave); font-size: .9rem; }
.actividad header, .reserva header { display: flex; align-items: center; gap: .4rem; font-size: .85rem; color: var(--suave); }
.actividad header .franja, .reserva header .franja { flex: 1; }
.actividad h3, .reserva h3 { margin: .25rem 0; font-size: 1.05rem; overflow-wrap: anywhere; }
.actividad.opcional { border-style: dashed; }
.actividad.en-choque { border-color: var(--alerta); box-shadow: 0 0 0 1px var(--alerta); }
.pendiente { opacity: .75; }
.alerta { color: var(--alerta); font-weight: 600; background: none; border: 0; }
.ok { color: var(--ok); font-size: .9rem; }
.marca.error { color: var(--alerta); }
.lugares { list-style: none; padding: 0; margin: .4rem 0; }
.lugares li { display: flex; align-items: center; gap: .5rem; padding: .3rem 0; border-top: 1px solid var(--borde); }
.lugares li.hecho .nombre { text-decoration: line-through; color: var(--suave); }
.lugares .nombre { flex: 1; cursor: pointer; overflow-wrap: anywhere; }
.check { width: 2rem; height: 2rem; flex: none; border-radius: 50%; border: 1px solid var(--borde); background: var(--fondo); color: var(--ok); }
.primario, .boton { background: var(--primario); color: var(--primario-texto); border: 0; border-radius: 999px; padding: .5rem 1rem; text-decoration: none; display: inline-block; }
.peligro { background: none; border: 1px solid var(--peligro); color: var(--peligro); border-radius: 999px; padding: .5rem 1rem; }
.icono { background: none; border: 0; font-size: 1.1rem; padding: .25rem .5rem; }
.enlace { background: none; border: 0; color: var(--primario); padding: .25rem 0; }
.barra { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; margin-top: 1rem; }
.barra h2 { flex: 1; margin: 0; }
.espacio { flex: 1; }
.interruptor { display: inline-flex; border: 1px solid var(--borde); border-radius: 999px; overflow: hidden; }
.interruptor button { background: none; border: 0; padding: .4rem .9rem; }
.interruptor button.activo { background: var(--primario); color: var(--primario-texto); }
.ciudad { color: var(--primario); }
.fecha { font-size: .95rem; color: var(--suave); margin: .8rem 0 .2rem; }
.dia.hoy .fecha::after { content: " · hoy"; color: var(--primario); }
.kpis { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .6rem; margin-top: 1rem; }
.kpi { background: var(--superficie); border: 1px solid var(--borde); border-radius: var(--radio); padding: .7rem .8rem; display: flex; flex-direction: column; }
.kpi span, .kpi small { color: var(--suave); font-size: .78rem; }
.kpi strong { font-size: 1.15rem; }
.grafico { position: relative; height: 240px; }
.grafico.pequeno { height: 180px; }
.lista-gastos { list-style: none; padding: 0; margin: 0; }
.gasto { display: flex; justify-content: space-between; gap: .5rem; padding: .55rem 0; border-top: 1px solid var(--borde); cursor: pointer; }
.gasto strong { overflow-wrap: anywhere; }
.gasto small { display: block; color: var(--suave); font-size: .8rem; }
.gasto .montos { text-align: right; white-space: nowrap; }
select, input, textarea { font: inherit; color: var(--texto); background: var(--fondo); border: 1px solid var(--borde); border-radius: 10px; padding: .5rem .6rem; width: 100%; }
input[type=checkbox] { width: auto; align-self: flex-start; }
.barra select { width: auto; }
.campo { display: flex; flex-direction: column; gap: .25rem; margin: .6rem 0; font-size: .9rem; }
.campo span { color: var(--suave); }
.monto { display: grid; grid-template-columns: 1fr 5.5rem; gap: .4rem; }
dialog#hoja { border: 0; padding: 0; margin: auto auto 0; width: 100%; max-width: 720px; max-height: 90vh; border-radius: var(--radio) var(--radio) 0 0; background: var(--superficie); color: var(--texto); }
dialog#hoja::backdrop { background: rgb(0 0 0 / .45); }
.formulario { padding: 1rem 1rem calc(1rem + env(safe-area-inset-bottom)); }
.formulario h2 { margin-top: 0; }
.aviso-form { background: color-mix(in srgb, var(--alerta) 12%, var(--superficie)); padding: .6rem .8rem; border-radius: 10px; }
.acciones-form { display: flex; gap: .5rem; align-items: center; margin-top: 1rem; }
.timeline { margin-top: 1rem; overflow-x: auto; }
.tl-horas { position: relative; height: 1.2rem; margin-left: 4.5rem; min-width: 520px; font-size: .7rem; color: var(--suave); }
.tl-horas span { position: absolute; transform: translateX(-50%); }
.tl-dia { display: grid; grid-template-columns: 4.5rem minmax(520px, 1fr); align-items: start; border-top: 1px solid var(--borde); padding: .3rem 0; }
.tl-fecha { font-size: .8rem; display: flex; flex-direction: column; }
.tl-fecha small { color: var(--suave); }
.tl-pista { position: relative; background: repeating-linear-gradient(to right, transparent 0 calc(100% / 6 - 1px), var(--borde) calc(100% / 6 - 1px) calc(100% / 6)); }
.bloque { position: absolute; height: 2rem; border-radius: 8px; border: 0; padding: 0 .4rem; font-size: .75rem; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left; }
.bloque.c0, .ley.c0::before { background: var(--c0); }
.bloque.c1, .ley.c1::before { background: var(--c1); }
.bloque.c2, .ley.c2::before { background: var(--c2); }
.bloque.c3, .ley.c3::before { background: var(--c3); }
.bloque.opcional { opacity: .75; outline: 2px dashed var(--superficie); outline-offset: -4px; }
.bloque.en-choque { box-shadow: 0 0 0 3px var(--alerta); }
.marca-reserva { position: absolute; top: 0; transform: translateX(-50%); color: var(--alerta); }
.tl-leyenda { display: flex; gap: .75rem; font-size: .8rem; margin-top: .5rem; }
.ley::before { content: ""; display: inline-block; width: .8rem; height: .8rem; border-radius: 3px; margin-right: .3rem; vertical-align: middle; }
```

- [ ] **Step 3: Crear `js/main.js`**

```js
import { parsearDatos } from './parse.js';
import { choques, convertir, hoyISO } from './compute.js';
import { crearOp, idTemporal, aplicarPendientes, consolidar, sincronizar, aplicarReemplazos, reintentar, descartar } from './queue.js';
import { crearApi } from './api.js';
import { crearStore, crearMemoria } from './store.js';
import { esc, dinero, hace } from './formato.js';
import { abrirFormulario } from './forms.js';
import { editarCosto, editarActividad, editarLugar, editarReserva } from './editores.js';
import { renderHoy } from './render-hoy.js';
import { renderItinerario } from './render-itinerario.js';
import { renderCostos } from './render-costos.js';
import { renderReservas } from './render-reservas.js';

const params = new URLSearchParams(location.search);
const demo = params.has('demo');
const hoy = () => params.get('hoy') || hoyISO();
const store = crearStore(demo ? 'dashboard-viaje-demo' : 'dashboard-viaje', demo ? crearMemoria() : undefined);
const estado = {
  ...store.cargar(),
  pestana: params.get('pestana') || 'hoy',
  vistaItinerario: params.get('vista') || 'lista',
  filtroCategoria: '', conversor: '', sinConexion: false, error: null,
};
let api = null;
let sincronizando = false;
let vista = null;

const guardar = () => store.guardar(estado);
const VERBO = { agregar: 'agregar', modificar: 'modificar', eliminar: 'eliminar' };

function cabeceraHtml() {
  const pendientes = estado.ops.filter(o => o.estado === 'pendiente').length;
  const partes = [];
  if (estado.raw?.leidoEn) partes.push(`Actualizado ${hace(estado.raw.leidoEn)}`);
  if (pendientes) partes.push(`⏳ ${pendientes} ${pendientes === 1 ? 'pendiente' : 'pendientes'}`);
  if (demo) partes.push('modo demo');
  return `<h1>${esc(vista?.nombre || 'Dashboard de Viaje')}</h1><div class="estado">${partes.map(esc).join('<br>')}</div>`
    + '<button class="icono" data-accion="recargar" aria-label="Recargar">⟳</button><button class="icono" data-accion="ajustes" aria-label="Ajustes">⚙</button>';
}

function avisoHtml() {
  const p = [];
  if (estado.sinConexion && estado.raw) p.push(`Sin conexión · datos de ${esc(hace(estado.raw.leidoEn))}`);
  if (estado.error && estado.raw) p.push(esc(estado.error));
  for (const a of vista?.advertencias || []) p.push(esc(a));
  for (const o of estado.ops.filter(x => x.estado === 'error')) {
    p.push(`⚠ No se pudo ${VERBO[o.op]} en ${esc(o.tabla)}: ${esc(o.error)} `
      + `<button class="enlace" data-accion="reintentar-op" data-op="${esc(o.opId)}">Reintentar</button> `
      + `<button class="enlace" data-accion="descartar-op" data-op="${esc(o.opId)}">Descartar</button>`);
  }
  return p.map(x => `<p>${x}</p>`).join('');
}

function pintar() {
  vista = estado.raw ? parsearDatos(aplicarPendientes(estado.raw, estado.ops)) : null;
  document.getElementById('cabecera').innerHTML = cabeceraHtml();
  const aviso = document.getElementById('aviso');
  aviso.innerHTML = avisoHtml();
  aviso.hidden = !aviso.innerHTML;
  const c = document.getElementById('contenido');
  if (!vista) {
    c.innerHTML = estado.error
      ? `<section class="tarjeta"><p>${esc(estado.error)}</p><button class="primario" data-accion="recargar">Reintentar</button></section>`
      : '<p class="vacio">Cargando…</p>';
  } else if (estado.pestana === 'hoy') {
    c.innerHTML = renderHoy(vista, { hoy: hoy() });
  } else if (estado.pestana === 'itinerario') {
    c.innerHTML = renderItinerario(vista, { vista: estado.vistaItinerario, choques: choques(vista), hoy: hoy() });
  } else if (estado.pestana === 'costos') {
    c.innerHTML = renderCostos(vista, { filtro: estado.filtroCategoria });
  } else {
    c.innerHTML = renderReservas(vista);
  }
  document.querySelectorAll('#navegacion button').forEach(b => b.classList.toggle('activo', b.dataset.pestana === estado.pestana));
  const conv = document.getElementById('conv-monto');
  if (conv) { conv.value = estado.conversor; actualizarConversor(); }
}

function actualizarConversor() {
  const out = document.getElementById('conv-resultado');
  if (!out || !vista) return;
  const n = Number(estado.conversor);
  if (estado.conversor === '' || !Number.isFinite(n)) { out.textContent = '—'; return; }
  const r = convertir(n, vista);
  out.textContent = `${dinero(r.usd, 'USD')} · ${dinero(r.casa, vista.monedaCasa)}`;
}

function manejarError(e) {
  if (e.autorizacion) { estado.error = 'La clave no es correcta. Revísala en Ajustes.'; abrirAjustes(); }
  else if (e.configuracion) estado.error = e.message;
  else { estado.sinConexion = true; if (!estado.raw) estado.error = `No se pudieron cargar los datos (${e.message}).`; }
}

async function leerHoja() {
  if (!api) return;
  try {
    estado.raw = await api.leer();
    estado.sinConexion = false;
    estado.error = null;
  } catch (e) { manejarError(e); }
  guardar();
  pintar();
}

async function sincronizarCola() {
  if (!api || sincronizando) return;
  sincronizando = true;
  const enviadas = estado.ops;
  try {
    const r = await sincronizar(enviadas, api.enviar);
    const nuevas = estado.ops.filter(o => !enviadas.includes(o));
    estado.ops = r.ops.concat(aplicarReemplazos(nuevas, r.reemplazos));
    if (r.confirmadas.length) estado.raw = consolidar(estado.raw, r.confirmadas);
    if (r.enviado) estado.sinConexion = false;
  } catch (e) {
    manejarError(e);
  } finally {
    sincronizando = false;
    guardar();
  }
}

async function sincronizarYLeer() {
  await sincronizarCola();
  if (!estado.ops.some(o => o.estado === 'pendiente')) await leerHoja();
  else pintar();
}

async function encolar(op, tabla, id, valores) {
  const idOp = op === 'agregar' ? idTemporal(estado.raw, estado.ops) : id;
  estado.ops.push(crearOp(op, tabla, { id: idOp, valores }));
  guardar();
  pintar();
  await sincronizarYLeer();
}

const acciones = (tabla, id) => ({
  guardar: valores => encolar(id === null ? 'agregar' : 'modificar', tabla, id, valores),
  eliminar: () => encolar('eliminar', tabla, id, {}),
});

function abrirAjustes() {
  if (demo) return;
  abrirFormulario({
    titulo: 'Ajustes',
    campos: [
      { nombre: 'url', etiqueta: 'URL del Apps Script (termina en /exec)', tipo: 'texto', requerido: true, valor: estado.ajustes.url },
      { nombre: 'clave', etiqueta: 'Clave', tipo: 'texto', requerido: true, valor: estado.ajustes.clave },
    ],
    onGuardar: f => {
      estado.ajustes = { url: f.url, clave: f.clave };
      estado.error = null;
      api = crearApi(estado.ajustes);
      guardar();
      sincronizarYLeer();
    },
  });
}

function irAlPrimerChoque() {
  const c = choques(vista)[0];
  if (!c) return;
  const el = document.querySelector(`[data-bloque="${c.ids[0]}"]`) || document.getElementById(`act-${c.ids[0]}`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

document.addEventListener('click', ev => {
  const nav = ev.target.closest('#navegacion button');
  if (nav) { estado.pestana = nav.dataset.pestana; pintar(); window.scrollTo(0, 0); return; }
  const el = ev.target.closest('[data-accion]');
  if (!el) return;
  const id = Number(el.dataset.id);
  const buscar = lista => lista.find(x => x.id === id);
  switch (el.dataset.accion) {
    case 'recargar': sincronizarYLeer(); break;
    case 'ajustes': abrirAjustes(); break;
    case 'vista-itinerario': estado.vistaItinerario = el.dataset.vista; pintar(); break;
    case 'ir-choque': irAlPrimerChoque(); break;
    case 'agregar-actividad': editarActividad(vista, null, acciones('Itinerario', null)); break;
    case 'editar-actividad': editarActividad(vista, buscar(vista.actividades), acciones('Itinerario', id)); break;
    case 'agregar-lugar': editarLugar(vista, Number(el.dataset.actividad), null, acciones('Lugares', null)); break;
    case 'editar-lugar': { const l = buscar(vista.lugares); editarLugar(vista, l.actividadId, l, acciones('Lugares', id)); break; }
    case 'hecho': { const l = buscar(vista.lugares); encolar('modificar', 'Lugares', id, { 'Hecho': l.hecho ? '' : 'Si' }); break; }
    case 'agregar-costo': editarCosto(vista, null, acciones('Costos', null)); break;
    case 'editar-costo': editarCosto(vista, buscar(vista.costos), acciones('Costos', id)); break;
    case 'agregar-reserva': editarReserva(vista, null, acciones('Reservas', null)); break;
    case 'editar-reserva': editarReserva(vista, buscar(vista.reservas), acciones('Reservas', id)); break;
    case 'reintentar-op': if (!sincronizando) { estado.ops = reintentar(estado.ops, el.dataset.op); guardar(); sincronizarYLeer(); } break;
    case 'descartar-op': if (!sincronizando) { estado.ops = descartar(estado.ops, el.dataset.op); guardar(); pintar(); } break;
  }
});
document.addEventListener('change', ev => { if (ev.target.id === 'filtro-categoria') { estado.filtroCategoria = ev.target.value; pintar(); } });
document.addEventListener('input', ev => { if (ev.target.id === 'conv-monto') { estado.conversor = ev.target.value; actualizarConversor(); } });

function cargarScript(src) {
  return new Promise((ok, mal) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = ok;
    s.onerror = () => mal(new Error(`no se pudo cargar ${src}`));
    document.head.appendChild(s);
  });
}

async function crearApiDemo() {
  await cargarScript('apps-script/Logica.gs');
  await cargarScript('apps-script/PruebasLogica.gs');
  const { crearServidorFalso } = await import('./servidor-falso.js');
  const g = globalThis;
  const servidor = crearServidorFalso(g.migrarLibro(g.LIBRO_ORIGINAL, g.ENLACES_ORIGINALES, g.DATOS_EJEMPLO));
  return { leer: async () => servidor.leer(), enviar: async ops => servidor.enviar(ops) };
}

async function iniciar() {
  pintar();
  if (demo) api = await crearApiDemo();
  else if (estado.ajustes.url && estado.ajustes.clave) api = crearApi(estado.ajustes);
  if (!api) { abrirAjustes(); return; }
  window.addEventListener('online', sincronizarYLeer);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sincronizarYLeer(); });
  await sincronizarYLeer();
}

iniciar();
```

- [ ] **Step 4: Verificar que las pruebas siguen pasando**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1`
Expected: `RESUMEN: 81 ok, 0 fallas`.

- [ ] **Step 5: Verificar la app en modo demo (DOM)**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1 -Modo dom -Pagina "index.html?demo&hoy=2026-09-29" | grep -o "Recogida: Hotel\|Colombia 2026\|modo demo\|\$50.38"`
Expected: aparecen las cuatro cadenas (`Colombia 2026`, `modo demo`, `Recogida: Hotel`, `$50.38`).

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1 -Modo dom -Pagina "index.html?demo&pestana=itinerario&vista=timeline" | grep -o 'class="bloque ' | wc -l`
Expected: `13`.

- [ ] **Step 6: Revisar las capturas a ancho de celular**

Run (una por pantalla):
```
powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1 -Modo captura -Pagina "index.html?demo&hoy=2026-09-29" -Salida "$TMP/hoy.png"
powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1 -Modo captura -Pagina "index.html?demo&pestana=itinerario" -Salida "$TMP/itinerario.png"
powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1 -Modo captura -Pagina "index.html?demo&pestana=itinerario&vista=timeline" -Salida "$TMP/timeline.png"
powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1 -Modo captura -Pagina "index.html?demo&pestana=costos" -Salida "$TMP/costos.png"
powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1 -Modo captura -Pagina "index.html?demo&pestana=reservas" -Salida "$TMP/reservas.png"
```
`$TMP` es el directorio scratchpad de la sesión. Abre cada PNG con la herramienta Read y comprueba:
- no hay scroll horizontal de la página (el timeline hace scroll dentro de su recuadro);
- no se cortan textos largos como "Parque del Poblado, frente a la iglesia";
- la barra inferior tiene 4 pestañas y la activa está resaltada;
- en el timeline, Bogotá y Medellín tienen colores distintos y las opcionales tienen borde punteado.

Corrige `styles.css` si algo falla y repite la captura.

- [ ] **Step 7: Commit**

```bash
git add index.html styles.css js/main.js
git commit -m "Add app shell, state, sync loop and demo mode

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Gráficos

**Files:**
- Create: `js/charts.js`
- Modify: `js/render-costos.js`, `js/main.js`, `tests/render.test.js`

**Interfaces:**
- Consumes: `porCategoria`, `acumuladoPorDia`, `efectivoRestante` (compute.js), `fechaCorta` (formato.js) y `globalThis.Chart`.
- Produces: `graficosHtml() → html` con `#g-categorias`, `#g-acumulado`, `#g-acumulado-nota` y `#g-efectivo`, y `pintarGraficos(v)`, que destruye los gráficos anteriores y dibuja los nuevos (si Chart no cargó, muestra una nota).

- [ ] **Step 1: Escribir la prueba**

Agregar al final de `tests/render.test.js`:
```js
prueba('render: Costos incluye los tres gráficos', () => {
  const c = renderCostos(v(), { filtro: '' });
  for (const id of ['g-categorias', 'g-acumulado', 'g-efectivo']) verdadero(c.includes(`id="${id}"`), `falta ${id}`);
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1`
Expected: 1 falla, `render: Costos incluye los tres gráficos: falta g-categorias`.

- [ ] **Step 3: Crear `js/charts.js`**

```js
import { porCategoria, acumuladoPorDia, efectivoRestante } from './compute.js';
import { fechaCorta } from './formato.js';

const activos = [];
const r2 = n => Math.round(n * 100) / 100;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

export function graficosHtml() {
  return `<section class="tarjeta"><h2>Presupuesto vs real por categoría (USD)</h2><div class="grafico"><canvas id="g-categorias"></canvas></div></section>
    <section class="tarjeta"><h2>Gasto acumulado por día (USD)</h2><div class="grafico"><canvas id="g-acumulado"></canvas></div><p class="nota" id="g-acumulado-nota"></p></section>
    <section class="tarjeta"><h2>Efectivo (USD)</h2><div class="grafico pequeno"><canvas id="g-efectivo"></canvas></div></section>`;
}

export function pintarGraficos(v) {
  activos.splice(0).forEach(g => g.destroy());
  if (!document.getElementById('g-categorias')) return;
  const Chart = globalThis.Chart;
  if (!Chart) {
    document.querySelectorAll('.grafico').forEach(d => { d.innerHTML = '<p class="nota">Los gráficos no están disponibles sin conexión.</p>'; });
    return;
  }
  Chart.defaults.color = css('--suave');
  Chart.defaults.borderColor = css('--borde');
  const opciones = { maintainAspectRatio: false, animation: false };

  const cats = porCategoria(v);
  activos.push(new Chart(document.getElementById('g-categorias'), {
    type: 'bar',
    data: {
      labels: cats.map(c => c.categoria),
      datasets: [
        { label: 'Presupuesto', data: cats.map(c => r2(c.presupuestoUsd)), backgroundColor: css('--c0') },
        { label: 'Real', data: cats.map(c => r2(c.realUsd)), backgroundColor: css('--c1') },
      ],
    },
    options: opciones,
  }));

  const ac = acumuladoPorDia(v);
  document.getElementById('g-acumulado-nota').textContent = ac.sinFecha ? `${ac.sinFecha} gastos sin fecha no aparecen en este gráfico.` : '';
  if (ac.dias.length) {
    activos.push(new Chart(document.getElementById('g-acumulado'), {
      type: 'line',
      data: {
        labels: ac.dias.map(fechaCorta),
        datasets: [
          { label: 'Planeado', data: ac.planeado.map(r2), borderColor: css('--c0'), backgroundColor: css('--c0'), tension: 0.2 },
          { label: 'Real', data: ac.real.map(r2), borderColor: css('--c1'), backgroundColor: css('--c1'), tension: 0.2 },
        ],
      },
      options: opciones,
    }));
  } else {
    document.getElementById('g-acumulado').closest('.grafico').innerHTML = '<p class="nota">Agrega fechas a los gastos para ver el acumulado por día.</p>';
  }

  const ef = efectivoRestante(v);
  activos.push(new Chart(document.getElementById('g-efectivo'), {
    type: 'doughnut',
    data: {
      labels: ['Gastado', ef.usd < 0 ? 'Excedido' : 'Restante'],
      datasets: [{ data: [r2(Math.min(ef.gastadoUsd, v.efectivoInicialUsd)), r2(Math.abs(ef.usd))], backgroundColor: [css('--c1'), ef.usd < 0 ? css('--alerta') : css('--ok')] }],
    },
    options: opciones,
  }));
}
```

- [ ] **Step 4: Insertar los gráficos en Costos y en el ciclo de pintado**

En `js/render-costos.js`, agrega el import `import { graficosHtml } from './charts.js';` y cambia la línea
```js
  return kpis + `<section class="tarjeta"><div class="barra"><h2>Gastos</h2>
```
por
```js
  return kpis + graficosHtml() + `<section class="tarjeta"><div class="barra"><h2>Gastos</h2>
```

En `js/main.js`, agrega el import `import { pintarGraficos } from './charts.js';` y, en `pintar()`, reemplaza
```js
    c.innerHTML = renderCostos(vista, { filtro: estado.filtroCategoria });
```
por
```js
    c.innerHTML = renderCostos(vista, { filtro: estado.filtroCategoria });
    pintarGraficos(vista);
```

- [ ] **Step 5: Ejecutar las pruebas y revisar la captura**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1`
Expected: `RESUMEN: 82 ok, 0 fallas`.

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1 -Modo captura -Pagina "index.html?demo&pestana=costos" -Alto 2200 -Salida "$TMP/costos-graficos.png"`
Abre la captura con Read y comprueba que se ven las barras por categoría (5 grupos), la nota "16 gastos sin fecha…" y la dona de efectivo.

- [ ] **Step 6: Commit**

```bash
git add js tests
git commit -m "Add budget vs actual, daily cumulative and cash charts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Sin conexión, ícono y publicación en GitHub Pages

**Files:**
- Create: `sw.js`, `manifest.json`, `icono.svg`, `tools/iconos.ps1`, `icono-192.png`, `icono-512.png`
- Modify: `js/main.js`

**Interfaces:**
- Produces: el sitio publicado en `https://gelizondomora.github.io/dashboard-viaje/`, instalable y usable sin conexión.

- [ ] **Step 1: Crear el ícono**

`icono.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0f766e"/><text x="32" y="42" font-family="Segoe UI, Arial, sans-serif" font-size="26" font-weight="700" fill="#fff" text-anchor="middle">DV</text></svg>
```

`tools/iconos.ps1`:
```powershell
Add-Type -AssemblyName System.Drawing
$raiz = Split-Path -Parent $PSScriptRoot
foreach ($t in 192, 512) {
  $bmp = New-Object System.Drawing.Bitmap $t, $t
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.TextRenderingHint = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::FromArgb(15, 118, 110))
  $fuente = New-Object System.Drawing.Font 'Segoe UI', ([float]($t * 0.4)), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $formato = New-Object System.Drawing.StringFormat
  $formato.Alignment = 'Center'
  $formato.LineAlignment = 'Center'
  $g.DrawString('DV', $fuente, [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF 0, 0, $t, $t), $formato)
  $bmp.Save((Join-Path $raiz "icono-$t.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
```

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/iconos.ps1`
Expected: se crean `icono-192.png` e `icono-512.png` en la raíz. Ábrelos con Read para confirmar que se ve "DV" blanco sobre verde azulado.

- [ ] **Step 2: Crear `manifest.json`**

```json
{
  "name": "Dashboard de Viaje",
  "short_name": "Viaje",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#f6f7f9",
  "theme_color": "#0f766e",
  "icons": [
    { "src": "icono-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icono-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icono.svg", "sizes": "any", "type": "image/svg+xml" }
  ]
}
```

- [ ] **Step 3: Crear `sw.js`**

Sube `VERSION` cada vez que publiques un cambio importante, para que el caché antiguo se borre.

```js
const VERSION = 'dv-v1';
const ARCHIVOS = [
  './', 'index.html', 'styles.css', 'manifest.json', 'icono.svg', 'icono-192.png', 'icono-512.png',
  'js/main.js', 'js/parse.js', 'js/compute.js', 'js/queue.js', 'js/api.js', 'js/store.js', 'js/formato.js',
  'js/forms.js', 'js/editores.js', 'js/render-hoy.js', 'js/render-itinerario.js', 'js/render-reservas.js',
  'js/render-costos.js', 'js/timeline.js', 'js/charts.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(claves => Promise.all(claves.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Stale-while-revalidate para la página y sus módulos. Las llamadas al Apps Script nunca pasan por el caché.
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.hostname.endsWith('google.com') || url.hostname.endsWith('googleusercontent.com')) return;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const guardada = await cache.match(req, { ignoreSearch: url.origin === location.origin });
    const red = fetch(req).then(r => { if (r.ok) cache.put(req, r.clone()); return r; }).catch(() => null);
    if (guardada) { e.waitUntil(red); return guardada; }
    return (await red) || new Response('Sin conexión', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }));
});
```

- [ ] **Step 4: Registrar el service worker**

En `js/main.js`, justo antes de la última línea `iniciar();`, agrega:
```js
if ('serviceWorker' in navigator && !demo && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
```

- [ ] **Step 5: Verificar que nada se rompió**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/navegador.ps1`
Expected: `RESUMEN: 82 ok, 0 fallas`.

- [ ] **Step 6: Commit**

```bash
git add sw.js manifest.json icono.svg icono-192.png icono-512.png tools/iconos.ps1 js/main.js
git commit -m "Add service worker, manifest and app icons

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: CONFIRMAR CON EL USUARIO antes de publicar**

Publicar crea un repositorio **público**. Antes de ejecutar el paso 8, recuérdale al usuario que el repo incluirá:
- el spec, con los montos, el itinerario y la URL publicada de la hoja (que dejará de funcionar cuando se despublique en Task 17);
- `apps-script/PruebasLogica.gs`, con montos e itinerario reales y enlaces de reserva ficticios.

Pregunta si prefiere publicarlo así o quitar esos datos antes (por ejemplo, anonimizando los datos de ejemplo). Espera un "sí" explícito.

- [ ] **Step 8: Crear el repo y activar GitHub Pages**

```bash
gh repo create gelizondomora/dashboard-viaje --public --source . --remote origin --push
gh api -X POST repos/gelizondomora/dashboard-viaje/pages -f "source[branch]=main" -f "source[path]=/"
```

Espera 1–2 minutos y verifica:

Run: `curl -s -o /dev/null -w "%{http_code}\n" https://gelizondomora.github.io/dashboard-viaje/` y `curl -s -o /dev/null -w "%{http_code}\n" https://gelizondomora.github.io/dashboard-viaje/js/main.js`
Expected: `200` en ambas. Si da `404`, espera un minuto más y repite (Pages tarda en el primer despliegue).

Run: `curl -s "https://gelizondomora.github.io/dashboard-viaje/?demo" | grep -o "<title>[^<]*"`
Expected: `<title>Dashboard de Viaje`.

---

### Task 17: Instalar el Apps Script y verificar en el celular (CHECKPOINT CON EL USUARIO)

**Files:** ninguno en el repo. Esta tarea configura la hoja real de Google y el teléfono, así que necesita al usuario en cada paso. Guíalo paso a paso y espera su confirmación antes de seguir.

- [ ] **Step 1: Probar la migración en una copia**

Pídele al usuario que:
1. Abra la hoja "Colombia Trip" → **Archivo → Crear una copia**.
2. En la copia: **Extensiones → Apps Script**. Que borre el contenido de `Código.gs` y cree tres archivos, `Logica`, `PruebasLogica` y `Codigo`, pegando en cada uno el contenido de `apps-script/Logica.gs`, `apps-script/PruebasLogica.gs` y `apps-script/Codigo.gs`. Muéstrale los archivos para que los copie.
3. Elija la función `probarTodo` → **Ejecutar**. Debe mostrar `N ok, 0 fallas` en el registro, con N igual al número de pruebas `gs/` de `tests.html`.
4. Elija `prepararHoja` → **Ejecutar** y acepte los permisos (Drive y Sheets).
5. Revise la copia. Debe tener las pestañas Config, Costos (16 gastos, sin "Efectivo" ni "Sobrante"), Itinerario (con ID, Hora inicio y Hora fin), Lugares vacía y Reservas con Enlace y Actividad ID 8 y 4. Pídele una captura o que te confirme estos puntos.

Si algo no coincide, corrige `Logica.gs` o `Codigo.gs` con una prueba nueva, haz commit y repite en una copia nueva.

- [ ] **Step 2: Migrar la hoja real**

Repetir los pasos 2 a 4 del Step 1 en la hoja **original**. `prepararHoja()` deja un respaldo en Drive y escribe su URL en el registro.

- [ ] **Step 3: Crear la clave y desplegar**

Genera una clave aleatoria:

Run: `powershell -NoProfile -Command "[Convert]::ToBase64String((1..24 | ForEach-Object { [byte](Get-Random -Maximum 256) })) -replace '[+/=]', ''"`

Dásela al usuario y pídele que:
1. En el editor de Apps Script: **Configuración del proyecto (⚙) → Propiedades del script → Agregar**, con propiedad `CLAVE` y como valor la clave generada.
2. **Implementar → Nueva implementación → Tipo: Aplicación web**, con "Ejecutar como: **Yo**" y "Quién tiene acceso: **Cualquier usuario**". Luego **Implementar** y copiar la URL que termina en `/exec`.
3. Pegarte la URL. Es seguro compartirla aquí: sin la clave no da acceso a nada.

- [ ] **Step 4: Verificar el script con curl**

Run: `curl -sL "<URL>?op=leer&clave=<CLAVE>" | head -c 600`
Expected: JSON que empieza con `{"ok":true,"leidoEn":...` y contiene `"Nombre del viaje":"Colombia 2026"`. Revisa que en `Itinerario` las fechas vengan como `"2026-09-27"`, no como fechas largas ni con horas desplazadas.

Run: `curl -sL "<URL>?op=leer&clave=mala"`
Expected: `{"ok":false,"error":"no autorizado"}`.

Prueba de escritura (agrega y borra un lugar en la hoja real):
```bash
curl -sL -H "Content-Type: text/plain;charset=utf-8" -d '{"clave":"<CLAVE>","ops":[{"opId":"prueba-1","op":"agregar","tabla":"Lugares","id":-1,"valores":{"Actividad ID":5,"Lugar":"Prueba"}}]}' "<URL>"
```
Expected: `{"ok":true,"resultados":[{"opId":"prueba-1","ok":true,"id":1}]}`. Repite el mismo comando: debe devolver el mismo resultado y la hoja debe seguir con **una sola** fila "Prueba", lo que confirma la idempotencia. Luego bórrala:
```bash
curl -sL -H "Content-Type: text/plain;charset=utf-8" -d '{"clave":"<CLAVE>","ops":[{"opId":"prueba-2","op":"eliminar","tabla":"Lugares","id":1}]}' "<URL>"
```
Expected: `{"ok":true,"resultados":[{"opId":"prueba-2","ok":true,"id":1}]}` y la pestaña Lugares vuelve a tener solo los encabezados.

- [ ] **Step 5: Despublicar la hoja**

Pídele al usuario: **Archivo → Compartir → Publicar en la web → Detener publicación**. Verifica:

Run: `curl -s -o /dev/null -w "%{http_code}\n" "https://docs.google.com/spreadsheets/d/e/2PACX-1vR50soHTnO5ifgnNDhgDdYDfmG_97L3PV7A2lmIJyc4KWCQjS43sovSeF_TnjbPu2e_ck64qXNXztKK/pub?gid=0&single=true&output=csv"`
Expected: un código distinto de `200` (normalmente `404` o `400`).

- [ ] **Step 6: Configurar el celular**

Pídele al usuario que abra `https://gelizondomora.github.io/dashboard-viaje/` en el celular. Se abrirá Ajustes: debe pegar la URL `/exec` y la clave, y luego **Agregar a pantalla de inicio** (Safari: Compartir → Agregar a inicio; Chrome: ⋮ → Agregar a pantalla principal).

- [ ] **Step 7: Verificación final con el usuario**

Pídele que haga estas pruebas y te confirme cada una:
1. **Con conexión:** en Costos, "＋ gasto" → "Prueba", Real 1 USD → Guardar. Debe aparecer ⏳ y a los pocos segundos desaparecer. Luego abrir el gasto, cambiar Real a 2 y guardar. Revisar en la hoja que la fila existe una vez y con 2.
2. **En modo avión:** agregar otro gasto "Prueba 2". Debe quedar con ⏳ y la cabecera mostrar "⏳ 1 pendiente". Cerrar y volver a abrir la app desde el ícono: debe abrir igual, sin señal. Quitar el modo avión y volver a la app: el ⏳ desaparece y en la hoja hay **una** fila "Prueba 2".
3. **Choque:** en Itinerario, "＋ actividad" el 29/9 en la franja Tarde. Debe aparecer "Choca con Zipaquirá y Lago Guatavita (8:00–18:00)" con Corregir y "Guardar de todos modos". Cancelar.
4. Borrar los dos gastos de prueba desde la app (Editar → Eliminar).

Si todo pasa, la fase 1 está entregada. Si algo falla, usa superpowers:systematic-debugging antes de cambiar código.
