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

export const urlSegura = u => (/^https?:\/\//i.test(String(u ?? '').trim()) ? String(u).trim() : '');
