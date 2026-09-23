# Dashboard de Viaje — Diseño

Fecha: 2026-09-23
Estado: aprobado en conversación, pendiente de revisión escrita

## Propósito

Un dashboard personal, para usar **en el celular durante el viaje a Colombia**
(domingo 27 de septiembre al martes 6 de octubre de 2026, dos personas), que muestre
de un vistazo qué toca hoy, cuánto efectivo queda, el itinerario, las reservas y los
costos. Es de uso exclusivo del dueño del viaje y para este viaje concreto.

**Criterios de éxito**

- Abre en el celular desde una URL (o un ícono en la pantalla de inicio) en pocos segundos.
- Refleja los cambios hechos en la hoja de Google Sheets sin tocar código.
- Funciona sin señal mostrando la última copia descargada.
- Está publicado y probado antes del 27 de septiembre de 2026.

## Fuente de datos

La hoja de Google Sheets "Colombia Trip", publicada en la web. La hoja sigue siendo el
único lugar donde se editan los datos; el dashboard es **solo lectura**.

- URL base publicada:
  `https://docs.google.com/spreadsheets/d/e/2PACX-1vR50soHTnO5ifgnNDhgDdYDfmG_97L3PV7A2lmIJyc4KWCQjS43sovSeF_TnjbPu2e_ck64qXNXztKK`
- CSV por pestaña: `<base>/pub?gid=<gid>&single=true&output=csv`

| Pestaña    | gid          | Columnas                                                                 |
|------------|--------------|--------------------------------------------------------------------------|
| Costos     | `0`          | Detalle, Efectivo?, Monto Dos Personas, Colones, Por Persona; tipos de cambio en G:H |
| Itinerario | `1417809111` | Fechas, Tiempo, Ciudad, Actividad, Obligatorio/Opcional                  |
| Reservas   | `570437176`  | Tour, Fecha y hora, Recogida, **Enlace** (nueva, la agrega el usuario)   |

Verificado el 2026-09-23: los tres CSV responden `200` con `Access-Control-Allow-Origin: *`,
por lo que se pueden leer con `fetch` desde GitHub Pages.

Los hipervínculos de celda no se exportan en CSV. Por eso la pestaña Reservas debe tener
una columna **Enlace** con la URL como texto plano.

## Pantalla (una sola página, móvil primero)

Orden de arriba hacia abajo:

1. **Hoy.** Las actividades de la fecha actual del teléfono, ordenadas por franja
   (Mañana → Mañana-Tarde → Tarde → Noche). Si ese día hay una reserva, aparece destacada
   con la hora y el lugar de recogida. Antes del viaje muestra "Faltan N días" y la vista
   previa del primer día; después del viaje muestra un resumen ("Viaje terminado").
2. **Efectivo.** El efectivo restante en USD y en colones.
3. **Itinerario.** Agrupado por día, con un separador por ciudad (Bogotá / Medellín).
   Las actividades opcionales se distinguen visualmente y el día actual queda resaltado.
4. **Reservas.** Una tarjeta por tour con fecha, hora, recogida y botón "Abrir reserva"
   (si la columna Enlace tiene valor).
5. **Costos.** El total del viaje y el total por persona (en colones y en USD), una barra
   horizontal por concepto y la tabla completa.

En la cabecera aparece "Actualizado hace X min" y un botón "Recargar".
La página tiene modo oscuro automático según la preferencia del sistema.

## Arquitectura

Página estática sin frameworks ni proceso de build, servida por GitHub Pages desde el
repositorio público `gelizondomora/dashboard-viaje`
(URL: `https://gelizondomora.github.io/dashboard-viaje/`).

| Archivo          | Responsabilidad                                                          | Depende de |
|------------------|--------------------------------------------------------------------------|------------|
| `index.html`     | Estructura de la página y carga de los módulos                           | —          |
| `styles.css`     | Estilos móvil primero y modo oscuro                                      | —          |
| `js/config.js`   | URL base y gids. Es lo único que cambia para otro viaje                  | —          |
| `js/parse.js`    | Funciones puras: CSV → filas → objetos tipados                           | —          |
| `js/compute.js`  | Funciones puras: efectivo, totales, "hoy", días restantes, agrupaciones  | parse      |
| `js/data.js`     | `fetch` de las 3 pestañas, timeout, caché en `localStorage`              | config     |
| `js/render.js`   | Construye el DOM de las 5 secciones a partir de datos ya calculados      | compute    |
| `js/main.js`     | Arranque: carga datos → parsea → calcula → renderiza; botón Recargar      | todos      |
| `sw.js`          | Service worker que guarda la página (HTML/CSS/JS) para abrirla sin conexión | —       |
| `tests.html`     | Pruebas de `parse` y `compute` que se ejecutan en el navegador          | parse, compute |
| `tests/fixtures/*.csv` | Copias fijas de los CSV reales del 2026-09-23                      | —          |

Los módulos usan ES modules nativos (`<script type="module">`). `parse` y `compute` no
tocan la red ni el DOM, de modo que se prueban de forma aislada.

`Colombia Trip.xlsx` queda fuera del repositorio (`.gitignore`), porque el repositorio es público.

## Reglas de interpretación

- **Columnas por nombre de encabezado**, no por posición. Agregar o reordenar columnas
  en la hoja no rompe nada. Los nombres se comparan sin distinguir mayúsculas ni tildes.
- **CSV.** Se usa un parser que respeta los campos entre comillas con comas internas
  (p. ej. `"₡317,098.60"`).
- **Montos.** Se quitan `$`, `₡`, las comas de miles y los espacios; el signo `-` se
  respeta. Una celda vacía equivale a "sin valor" (no a 0).
- **Tipos de cambio.** Se leen de las columnas G:H de Costos buscando las etiquetas
  `USD-CRC`, `COP-CRC` y `COP-USD`. No van fijos en el código.
- **Monto de cada gasto.** Si hay USD ("Monto Dos Personas"), ese es el monto y los
  colones se calculan como USD × USD-CRC. Si solo hay colones, el USD se calcula como
  colones ÷ USD-CRC. Los montos de la hoja son para dos personas; por persona = ÷ 2.
- **Columna "Efectivo?":**
  - `Inicio` → efectivo inicial. **No** es un gasto.
  - `Si` → gasto pagado en efectivo. Cuenta en el total y se resta del efectivo.
  - `Total` (fila "Sobrante") → se ignora; el dashboard hace el cálculo.
  - vacío → gasto normal.
- **Total del viaje** = suma de todas las filas de Costos excepto `Inicio` y `Total`.
- **Efectivo restante** = monto de `Inicio` − suma de los gastos `Si`.
  Con los datos del 2026-09-23: 200 − 149,62 = **$50,38**.
- **Fechas del Itinerario:** `d/m/yyyy` (p. ej. `27/9/2026`).
- **Fechas de Reservas:** texto en español, `"<Día>, <d> de <mes> de <yyyy>, <H:MM>"`.
  Se reconocen los 12 meses en español; el día de la semana se ignora.
- **"Hoy"** es la fecha local del teléfono (hora de Colombia durante el viaje),
  comparada solo por día.
- **Orden de franjas:** Mañana, Mañana-Tarde, Tarde, Noche; cualquier otro valor va al final.

## Errores y funcionamiento sin conexión

- Cada descarga completa y correcta de las 3 pestañas se guarda en `localStorage`
  junto con la hora. `localStorage` se usa siempre dentro de `try/catch`.
- Si la descarga falla o tarda más de 8 segundos, se muestra la última copia con la
  franja "Sin conexión · datos de hace X".
- Si no hay copia guardada y la descarga falla, se muestra un mensaje de error con un
  botón "Reintentar" (nunca una pantalla en blanco).
- El service worker sirve la página desde caché si no hay red, y la actualiza cuando la hay.
  No guarda en caché los CSV: de eso se encarga `data.js`.
- Una fila con un monto o una fecha ilegible se muestra con un aviso ⚠ y se excluye de
  los cálculos; el resto de la página sigue funcionando.

## Pruebas

`tests.html` ejecuta en el navegador pruebas con `tests/fixtures/*.csv` y muestra
pasadas y fallidas. Cubren:

- Parser CSV: comillas, comas internas, filas y columnas vacías.
- Montos: `$696.92`, `-$50.38`, `"₡317,098.60"`, `₡903.18`, vacío.
- Tipos de cambio leídos de G:H.
- Regla del efectivo: resultado $50,38; el total excluye `Inicio` y `Total`.
- Fechas `d/m/yyyy` y fechas largas en español.
- "Hoy": antes del viaje (días restantes), un día con reserva (29/9), un día con dos
  actividades (ordenadas por franja) y después del viaje.
- Columnas identificadas por encabezado aunque cambie el orden.

Verificación final: abrir la URL publicada en tamaño de celular y comprobar las 5 secciones,
el modo sin conexión (red desactivada en DevTools) y el botón Recargar.

## Fuera de alcance

Editar datos desde el dashboard, varios viajes, login, gráficos avanzados, notificaciones
y conversión de COP en los gastos (la hoja no tiene montos en pesos colombianos).
