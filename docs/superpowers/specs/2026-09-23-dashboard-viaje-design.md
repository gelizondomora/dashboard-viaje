# Dashboard de Viaje — Diseño (Fase 1)

Fecha: 2026-09-23
Estado: diseño aprobado en conversación, pendiente de revisión escrita

## Propósito

Un dashboard personal, pensado para **usar en el celular durante el viaje**, que muestra y
permite **editar** los costos, el itinerario (con sus lugares) y las reservas de un viaje,
con gráficos para comparar presupuesto contra gasto real. Es de uso exclusivo del dueño del
viaje. El primer viaje es Colombia (domingo 27 de septiembre al martes 6 de octubre de 2026,
dos personas, Bogotá y Medellín), pero la estructura sirve para viajes futuros.

**Criterios de éxito**

- Abre en el celular desde un ícono en la pantalla de inicio en pocos segundos, con o sin señal.
- Desde el celular se pueden agregar, modificar y eliminar filas de todas las pestañas,
  y los cambios llegan a la hoja de Google Sheets exactamente una vez.
- Los cambios hechos sin señal quedan pendientes y se envían solos cuando vuelve la conexión.
- Otro viaje se usa copiando la hoja y cambiando la pestaña Config; el código no cambia.
- Está publicado y probado en el celular antes del 27 de septiembre de 2026.

## Fases

- **Fase 1 (este documento):** estructura de hoja reutilizable, lectura y escritura vía
  Apps Script, cola sin conexión, conversor de moneda, pestaña Lugares, 4 pantallas,
  3 gráficos y timeline del itinerario con detección de choques de horario.
- **Fase 2 (futuro, otro spec):** selector de viajes y creación de un viaje desde plantilla,
  comparación entre viajes, gasto por ciudad, notificaciones.

## Estructura de la hoja

La hoja de Google Sheets es la única fuente de datos. **Cada viaje es una hoja con esta
estructura.** La función `prepararHoja()` convierte la hoja actual "Colombia Trip" a esta
estructura sin perder datos (ver "Migración").

Todas las pestañas de datos llevan una columna **ID** (entero asignado por el script, único
por pestaña y que nunca cambia). El dashboard identifica las columnas **por encabezado**, no
por posición, y los compara sin distinguir mayúsculas ni tildes.

### Config (nueva)

Dos columnas, **Clave** y **Valor**:

| Clave                   | Valor (Colombia)  |
|-------------------------|-------------------|
| Nombre del viaje        | Colombia 2026     |
| Personas                | 2                 |
| Moneda local            | COP               |
| Moneda de casa          | CRC               |
| Efectivo inicial (USD)  | 200               |
| USD-CRC                 | 455               |
| COP-CRC                 | 0.14              |
| COP-USD                 | 0.00031           |

Los tipos de cambio usan las claves `USD-<casa>`, `<local>-<casa>` y `<local>-USD`, según las
monedas definidas arriba. Así, en un viaje a México basta con poner `MXN` y sus tipos.

### Costos

| Columna            | Contenido                                                            |
|--------------------|----------------------------------------------------------------------|
| ID                 | entero                                                               |
| Detalle            | texto                                                                |
| Categoría          | Transporte, Hospedaje, Comida, Tours, Compras u Otros               |
| Fecha              | fecha del gasto (opcional)                                           |
| Efectivo?          | `Si` o vacío                                                         |
| Presupuesto USD    | monto planeado para todas las personas, en USD (antes "Monto Dos Personas") |
| Presupuesto CRC    | monto planeado en moneda de casa (antes "Colones")                   |
| Real USD           | monto pagado, en USD                                                 |
| Real CRC           | monto pagado, en moneda de casa                                      |
| Por Persona        | se conserva para leer la hoja; el dashboard no lo usa                |

"CRC" en los encabezados es la moneda de casa definida en Config.

### Itinerario

ID, Fechas (`d/m/yyyy`), Tiempo (Mañana, Mañana-Tarde, Tarde, Noche), **Hora inicio**
(`H:MM`, opcional), **Hora fin** (`H:MM`, opcional), Ciudad, Actividad, Obligatorio/Opcional.

### Lugares (nueva)

Subzonas de una actividad, por ejemplo tiendas dentro de "Zona T / Compras".

| Columna           | Contenido                                  |
|-------------------|--------------------------------------------|
| ID                | entero                                     |
| Actividad ID      | ID de la fila de Itinerario a la que pertenece |
| Lugar             | nombre                                     |
| Dirección / Mapa  | texto o enlace de Google Maps              |
| Notas             | texto                                      |
| Hecho             | `Si` o vacío                               |

### Reservas

ID, Tour, Fecha y hora (`"<Día>, <d> de <mes> de <yyyy>, <H:MM>"`), Recogida, Enlace,
**Actividad ID** (opcional: la actividad del Itinerario a la que corresponde la reserva).

### Migración (`prepararHoja()`)

Se ejecuta a mano desde el editor de Apps Script. Es idempotente: ejecutarla dos veces no
cambia nada la segunda vez.

1. Crea una copia de respaldo de la hoja en Drive ("<nombre> — respaldo <fecha>").
2. Crea la pestaña **Config** con los valores de la tabla de arriba: el efectivo inicial sale de
   la fila `Efectivo / Inicio` de Costos y los tipos de cambio salen de G:H de Costos.
3. En **Costos**:
   - agrega ID, Categoría, Fecha, Real USD y Real CRC;
   - renombra "Monto Dos Personas" → "Presupuesto USD" y "Colones" → "Presupuesto CRC";
   - elimina las filas `Efectivo / Inicio` y `Sobrante / Total` y el bloque de tipos de cambio G:H;
   - asigna la categoría propuesta a las filas actuales:
     Transporte = Vuelos, Vuelo interno, Transporte Aeropuerto, Metro Cable Arvi,
     Metro Medellin Comuna 13, Metro Medellin Arvi; Hospedaje = Bogota Hospedaje,
     Medellin Hospedaje; Comida = Comida; Tours = Zipaquirá y lago Guatavita,
     Guatapé desde Medellín, Tiquete Catedral de Sal, Entrada Parque Nacional;
     Compras = Compras, Compras Varias.
4. En **Itinerario** agrega las columnas ID, Hora inicio y Hora fin (vacías).
5. Crea la pestaña **Lugares** vacía, con sus encabezados.
6. En **Reservas** agrega ID, Enlace y Actividad ID:
   - Enlace se rellena con el hipervínculo actual de la celda Tour (las URLs de GetYourGuide).
   - Actividad ID se rellena con la actividad del mismo día cuyo nombre coincide con el Tour
     (sin distinguir mayúsculas ni tildes): Zipaquirá → 29/9, Guatapé → 2/10. Si no hay
     coincidencia única, queda vacío.
7. Crea la pestaña oculta **_Registro** (ver "Idempotencia").

## Reglas de cálculo

- **Montos.** Se aceptan números o textos con `$`, `₡`, comas de miles y signo `-`.
  Vacío equivale a "sin valor", no a 0.
- **Monto efectivo de una fila** (presupuesto o real): si hay USD, se usa USD y la moneda de casa
  se calcula como USD × `USD-<casa>`. Si solo hay moneda de casa, USD = casa ÷ `USD-<casa>`.
  Los valores de moneda de casa escritos en filas que ya tienen USD se ignoran en los cálculos.
- **Por persona** = monto ÷ `Personas`.
- **Presupuesto total** = suma de los presupuestos de todas las filas de Costos.
- **Real total** = suma de los reales registrados. Las filas sin real cuentan como "pendientes".
- **Diferencia** = real − presupuesto, **solo sobre las filas que tienen real**.
- **Efectivo restante (USD)** = `Efectivo inicial (USD)` − suma de las filas con `Efectivo? = Si`,
  usando el real si existe y el presupuesto si no. Con los datos del 2026-09-23 el resultado es
  200 − 149,62 = **$50,38**.
- **Conversor:** de moneda local a USD (`<local>-USD`) y a moneda de casa (`<local>-<casa>`).
  Ejemplo: 85.000 COP → $26,35 · ₡11.900.
- **"Hoy"** es la fecha local del teléfono, comparada solo por día.
- **Orden de franjas:** Mañana, Mañana-Tarde, Tarde, Noche; cualquier otro valor va al final.

### Horarios y choques

- **Rango de cada franja:** Mañana 6:00–12:00, Tarde 12:00–18:00, Noche 18:00–24:00,
  Mañana-Tarde 6:00–18:00.
- **Intervalo de una actividad** (en su día):
  - con Hora inicio y Hora fin → ese intervalo;
  - solo con Hora inicio → desde esa hora hasta el fin de su franja (o +1 h si no tiene franja);
  - solo con Hora fin → desde el inicio de su franja hasta esa hora;
  - sin horas → el rango de su franja;
  - si una **reserva vinculada** (Actividad ID) tiene hora y la actividad no tiene Hora inicio,
    la hora de la reserva se usa como Hora inicio;
  - sin horas ni franja reconocible → no se ubica en el timeline y aparece en "Sin horario".
- **Choque:** dos actividades del mismo día cuyos intervalos `[a,b)` y `[c,d)` cumplen
  `a < d` y `c < b`. Las que solo se tocan (una termina 12:00 y la otra empieza 12:00) no chocan.
  Las opcionales también cuentan.
- **Reservas sin actividad vinculada:** se tratan como un instante. Chocan si ese instante cae
  dentro del intervalo de una actividad de ese día.
- Una Hora fin menor o igual que Hora inicio se marca ⚠ y la actividad se excluye de la
  detección de choques.
- Con los datos del 2026-09-23 **no hay choques**.
- Una fila con un monto o una fecha ilegible se muestra con ⚠ y se excluye de los cálculos.

## Arquitectura

```
Celular (GitHub Pages)                          Google
┌──────────────────────────────┐  GET ?op=leer&clave=…   ┌───────────────────────┐
│ index.html + módulos JS       │ ──────────────────────▶ │ Apps Script (web app)  │
│ caché local + cola pendiente  │ ◀── JSON ────────────── │  doGet / doPost         │
│ service worker (sin conexión) │  POST {clave, ops[]}    │  prepararHoja()         │
└──────────────────────────────┘ ──────────────────────▶ └───────────┬───────────┘
                                                                      ▼
                                                             Hoja del viaje
```

La hoja **deja de estar publicada en la web**; solo se accede a través del script con la clave.

### Apps Script (`apps-script/Codigo.gs`)

Se instala en la hoja (Extensiones → Apps Script) y se despliega como aplicación web
("Ejecutar como: yo", "Quién tiene acceso: cualquier usuario"). La **clave secreta** vive en
las Propiedades del script; cualquier petición sin la clave correcta recibe
`{ok:false, error:"no autorizado"}`.

- **`doGet(e)`** con `op=leer` devuelve:
  `{ok, leidoEn, config:{clave:valor}, tablas:{Costos|Itinerario|Lugares|Reservas:{encabezados:[…], filas:[{id, valores:{encabezado:valor}}]}}}`.
  Las fechas se devuelven como texto `yyyy-mm-dd`.
- **`doPost(e)`**: el cuerpo es JSON (enviado como `text/plain` para evitar el preflight CORS):
  `{clave, ops:[{opId, op:"agregar"|"modificar"|"eliminar", tabla, id?, valores?}]}`.
  - `agregar`: añade una fila al final con un ID nuevo (máximo + 1) y devuelve el ID.
  - `modificar`: busca por ID y cambia solo las columnas incluidas en `valores`.
  - `eliminar`: busca por ID y borra la fila. Si la fila es de Itinerario, también borra sus Lugares
    y deja vacío el Actividad ID de las Reservas vinculadas (la reserva no se borra).
  - Respuesta: `{ok, resultados:[{opId, ok, id?, error?}]}`. Si el ID no existe, el error es `"no existe"`.
- **Concurrencia:** cada `doPost` se ejecuta dentro de `LockService.getScriptLock()`.
- **Idempotencia:** cada `opId` aplicado se guarda en la pestaña oculta `_Registro`
  (opId, fecha, resultado). Si un `opId` llega otra vez, se devuelve el resultado guardado
  sin volver a aplicarlo.
- **Lógica pura separada:** el mapeo por encabezado, la asignación de ID, la aplicación de
  operaciones sobre arreglos y la migración se escriben como funciones que reciben y devuelven
  arreglos, sin llamar a `SpreadsheetApp`. `probarTodo()` las prueba desde el editor.

### Página (GitHub Pages)

Sitio estático sin frameworks ni build, con ES modules nativos. Repositorio público
`gelizondomora/dashboard-viaje`, URL `https://gelizondomora.github.io/dashboard-viaje/`.
El repositorio **no contiene** datos del viaje, la URL del script ni la clave.

| Archivo            | Responsabilidad                                                      |
|--------------------|----------------------------------------------------------------------|
| `index.html`       | Estructura, barra inferior de 4 pestañas y pantalla de Ajustes        |
| `styles.css`       | Estilos para móvil y modo oscuro automático                          |
| `js/parse.js`      | Puro: JSON del script → objetos tipados (montos, fechas, tipos de cambio) |
| `js/compute.js`    | Puro: totales, diferencias, efectivo, acumulado por día, "hoy", conversor, intervalos y choques |
| `js/timeline.js`   | Dibuja el timeline del itinerario (DOM/CSS, sin librería)            |
| `js/api.js`        | Llamadas al script (`leer`, `enviar`) con timeout de 10 s             |
| `js/queue.js`      | Cola de operaciones pendientes; aplicación optimista sobre los datos locales |
| `js/store.js`      | Estado: últimos datos leídos + cola, guardados en `localStorage`      |
| `js/charts.js`     | Los 3 gráficos (Chart.js desde cdn.jsdelivr.net)                     |
| `js/forms.js`      | Formularios de agregar y editar (bottom sheet) y confirmación de eliminar |
| `js/render.js`     | Construye las 4 pantallas a partir de los datos calculados            |
| `js/main.js`       | Arranque, navegación, Recargar y disparo de la sincronización        |
| `sw.js`            | Service worker: guarda en caché la página, los módulos y Chart.js    |
| `manifest.json`    | Permite "Agregar a pantalla de inicio" con nombre e ícono             |
| `tests.html` + `tests/*.js` | Pruebas en el navegador                                     |

`parse`, `compute` y `queue` no tocan la red ni el DOM.

**Ajustes:** la URL del script y la clave se pegan una vez en la pantalla de Ajustes y se
guardan en `localStorage` del teléfono. Toda lectura y escritura de `localStorage` va dentro
de `try/catch`.

## Cola y sincronización

- Cada acción del usuario crea una operación con `opId` único (`crypto.randomUUID()`), la
  guarda en la cola persistente y la **aplica al instante** sobre la copia local, marcada ⏳.
  Las filas nuevas usan un ID temporal negativo hasta que el script devuelve el definitivo;
  las operaciones posteriores en la cola que apuntan a ese ID temporal se reescriben con el
  definitivo.
- La sincronización envía la cola **en orden**, en un solo `POST`, al abrir la app, al pulsar
  Recargar, después de cada acción y cuando el navegador dispara el evento `online`.
- Si el envío falla por red o por timeout, la cola queda intacta y se reintenta más tarde.
  El `opId` garantiza que un reintento no duplica cambios.
- Por cada resultado:
  - `ok` → se quita de la cola;
  - `"no existe"` u otro error → la operación queda marcada ⚠ con las opciones
    **Descartar** o **Reintentar**. Nunca se descarta en silencio.
- Cuando la cola se vacía, se vuelve a leer la hoja para reemplazar la copia local.
- La vista siempre es: último JSON leído + operaciones pendientes aplicadas encima.

## Pantallas

Barra inferior con 4 pestañas. Cabecera con el nombre del viaje (de Config),
"Actualizado hace X min", "⏳ N pendientes" (si hay alguno) y botón Recargar.
Sin conexión aparece una franja "Sin conexión · datos de hace X".

1. **Hoy**
   - Actividades del día por franja, cada una con sus Lugares; tocar ○/✓ cambia "Hecho".
   - La reserva del día destacada (hora, recogida, botón "Abrir reserva").
   - Efectivo restante en USD y moneda de casa.
   - Conversor: moneda local → USD y moneda de casa.
   - Antes del viaje: "Faltan N días" y la vista previa del primer día. Después: "Viaje terminado".
2. **Itinerario**, con dos vistas que se alternan con un interruptor:
   - **Timeline:** una fila por día con un eje horario de 6:00 a 24:00. Cada actividad es un
     bloque proporcional a su intervalo, coloreado por ciudad; las opcionales van con borde
     punteado y las reservas sin actividad se muestran como marcas. Los choques se marcan en
     rojo con ⚠. Al tocar un bloque se abre la actividad.
   - **Lista:** días agrupados por ciudad, con las opcionales diferenciadas y el día actual
     resaltado.
   - Cabecera con el contador **"⚠ N choques"**; al tocarlo se salta al primero.
   - Botones ＋ actividad, ＋ lugar, editar y eliminar.
   - **Aviso al guardar:** si una actividad nueva o editada choca con otra, el formulario lo
     indica ("Choca con Guatapé desde Medellín, 7:00–18:00") y ofrece **Corregir** o
     **Guardar de todos modos**. No bloquea el guardado.
3. **Costos**
   - Tarjetas: presupuesto total, real total, diferencia y por persona (USD y moneda de casa).
   - **Gráfico 1:** presupuesto contra real por categoría (barras agrupadas).
   - **Gráfico 2:** gasto acumulado por día, real contra planeado (líneas); indica cuántos
     gastos sin fecha quedaron fuera.
   - **Gráfico 3:** efectivo gastado contra restante.
   - Lista filtrable por categoría, con ＋ gasto; tocar una fila la edita, con el campo Real primero.
4. **Reservas:** tarjetas con fecha, hora, recogida y enlace; agregar, editar y eliminar.

**Formularios:** bottom sheet con los campos de la pestaña. Las fechas usan el selector
nativo, la categoría y la franja son listas, y los montos llevan un selector USD/moneda de casa.
Eliminar pide confirmación.

## Errores y funcionamiento sin conexión

- El service worker sirve la página, los módulos y Chart.js desde caché si no hay red, y los
  actualiza cuando la hay. No guarda en caché las respuestas del script (de eso se encarga `store.js`).
- Si no hay datos guardados y la lectura falla, se muestra un mensaje con "Reintentar".
- Sin URL del script o sin clave, se abre directamente la pantalla de Ajustes.
- Si la clave es incorrecta ("no autorizado"), el mensaje lo dice y lleva a Ajustes.

## Pruebas

- **`tests.html`** (en el navegador, sin instalar nada), con datos reales del 2026-09-23:
  - `parse`: montos (`$696.92`, `-$50.38`, `₡317,098.60`, números, vacío), fechas
    `d/m/yyyy` y fechas largas en español, columnas por encabezado aunque cambie el orden.
  - `compute`: efectivo restante = $50,38; totales y diferencia solo con reales;
    presupuesto contra real por categoría; acumulado por día; "hoy" antes, durante
    (29/9 con reserva) y después del viaje; conversor.
  - `compute` (horarios): intervalo por franja, por horas y por reserva vinculada; choque
    Mañana-Tarde contra Tarde; bordes que se tocan no chocan; reserva sin vincular dentro de
    una actividad; Hora fin ≤ Hora inicio → ⚠; datos actuales → 0 choques.
  - `queue`: aplicación optimista; envío en orden; reintento con el mismo `opId` sin duplicar;
    reescritura de ID temporal → definitivo; "no existe" → ⚠. Se prueba contra un
    **script simulado en memoria**.
- **`probarTodo()`** en Apps Script: mapeo por encabezado, asignación de ID, las 3 operaciones,
  idempotencia por `opId` y migración sobre arreglos con los datos actuales.
- **`prepararHoja()`** se ejecuta primero sobre una **copia** de la hoja y se revisa antes
  de aplicarla a la original.
- **Verificación final en el celular:** agregar, editar y borrar un gasto con conexión; en
  modo avión, agregar un gasto (aparece ⏳), volver a tener señal y confirmar que llegó a la
  hoja exactamente una vez.

## Instalación (guiada, una sola vez)

1. Copiar la hoja → pegar `Codigo.gs` en la copia → ejecutar `prepararHoja()` → revisar juntos.
2. Pegar `Codigo.gs` en la hoja real → ejecutar `prepararHoja()` (crea su respaldo).
3. Definir la clave en las Propiedades del script → desplegar como aplicación web → copiar la URL.
4. Despublicar la hoja (Archivo → Compartir → Publicar en la web → Detener publicación).
5. En el celular: abrir el dashboard → Ajustes → pegar la URL y la clave → Agregar a pantalla de inicio.

## Orden de entrega

Si el tiempo no alcanza antes del 27 de septiembre, se entrega en este orden, para que cada
paso deje algo útil funcionando:

1. Migración + `doGet` + lectura, pantalla Hoy y conversor.
2. Edición de Costos (`doPost` + formularios).
3. Cola sin conexión.
4. Edición de Itinerario, Lugares y Reservas, con aviso de choques al guardar.
5. Timeline del itinerario.
6. Gráficos.

## Fuera de alcance (Fase 1)

Selector de viajes y creación desde plantilla, comparación entre viajes,
gasto por ciudad, notificaciones, login con Google y varios usuarios editando a la vez.
