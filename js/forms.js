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
