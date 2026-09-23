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
  const opciones = () => ({ maintainAspectRatio: false, animation: false });

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
    options: opciones(),
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
      options: opciones(),
    }));
  } else {
    document.getElementById('g-acumulado').closest('.grafico').outerHTML = '<p class="nota">Agrega fechas a los gastos para ver el acumulado por día.</p>';
  }

  const ef = efectivoRestante(v);
  const excedido = ef.pronosticadoUsd < 0;
  activos.push(new Chart(document.getElementById('g-efectivo'), {
    type: 'doughnut',
    data: {
      labels: ['Pagado', 'Por pagar', excedido ? 'Excedido (pronóstico)' : 'Libre (pronóstico)'],
      datasets: [{
        data: [r2(ef.gastadoUsd), r2(ef.comprometidoUsd), r2(Math.abs(ef.pronosticadoUsd))],
        backgroundColor: [css('--c1'), css('--c3'), excedido ? css('--alerta') : css('--ok')],
      }],
    },
    options: opciones(),
  }));
}
