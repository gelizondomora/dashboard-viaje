import { porCategoria, acumuladoPorDia, efectivoRestante, porPersona, CATEGORIAS } from './compute.js';
import { fechaCorta } from './formato.js';

const activos = [];
const r2 = n => Math.round(n * 100) / 100;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

export function graficosHtml() {
  return `<section class="tarjeta"><h2>Presupuesto vs real por categoría (USD)</h2><div class="grafico"><canvas id="g-categorias"></canvas></div></section>
    <section class="tarjeta"><h2>Gasto real acumulado vs presupuesto total (USD)</h2><div class="grafico"><canvas id="g-acumulado"></canvas></div><p class="nota" id="g-acumulado-nota"></p></section>
    <section class="tarjeta"><h2>Efectivo (USD)</h2><div class="grafico pequeno"><canvas id="g-efectivo"></canvas></div></section>
    <section class="tarjeta"><h2>Presupuesto vs real por persona (USD)</h2><div class="grafico pequeno"><canvas id="g-personas"></canvas></div></section>
    <section class="tarjeta"><h2 id="g-personas-cat-titulo">Por persona y categoría (USD)</h2><div class="grafico"><canvas id="g-personas-cat"></canvas></div></section>`;
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
  document.getElementById('g-acumulado-nota').textContent = ac.sinFecha ? `${ac.sinFecha} gastos pagados sin fecha no aparecen en este gráfico.` : '';
  if (ac.dias.length) {
    activos.push(new Chart(document.getElementById('g-acumulado'), {
      type: 'line',
      data: {
        labels: ac.dias.map(fechaCorta),
        datasets: [
          { label: 'Presupuesto total', data: ac.presupuesto.map(r2), borderColor: css('--c0'), backgroundColor: css('--c0'), borderDash: [6, 4], pointRadius: 0 },
          { label: 'Real acumulado', data: ac.real.map(r2), borderColor: css('--c1'), backgroundColor: css('--c1'), tension: 0.2 },
        ],
      },
      options: { ...opciones(), scales: { y: { beginAtZero: true } } },
    }));
  } else {
    document.getElementById('g-acumulado').closest('.grafico').outerHTML = '<p class="nota">Agrega actividades o gastos con fecha para ver el acumulado por día.</p>';
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

  // Por persona: presupuesto contra real, y el desglose por categoría (real si ya hay gastos; si no, presupuesto).
  const personas = porPersona(v);
  activos.push(new Chart(document.getElementById('g-personas'), {
    type: 'bar',
    data: {
      labels: personas.map(p => p.nombre),
      datasets: [
        { label: 'Presupuesto', data: personas.map(p => r2(p.presupuestoUsd)), backgroundColor: css('--c0') },
        { label: 'Real', data: personas.map(p => r2(p.realUsd)), backgroundColor: css('--c1') },
      ],
    },
    options: opciones(),
  }));
  const hayReal = personas.some(p => p.realUsd > 0);
  const campo = hayReal ? 'realUsd' : 'presupuestoUsd';
  document.getElementById('g-personas-cat-titulo').textContent = `${hayReal ? 'Gasto real' : 'Presupuesto'} por persona y categoría (USD)`;
  const orden = k => { const i = CATEGORIAS.indexOf(k); return i < 0 ? CATEGORIAS.length : i; };
  const categorias = [...new Set(personas.flatMap(p => Object.keys(p.categorias)))].sort((a, b) => orden(a) - orden(b) || a.localeCompare(b));
  const paleta = ['--c0', '--c1', '--c2', '--c3', '--ok', '--suave'];
  activos.push(new Chart(document.getElementById('g-personas-cat'), {
    type: 'bar',
    data: {
      labels: personas.map(p => p.nombre),
      datasets: categorias.map((cat, i) => ({
        label: cat, data: personas.map(p => r2(p.categorias[cat]?.[campo] || 0)), backgroundColor: css(paleta[i % paleta.length]),
      })),
    },
    options: { ...opciones(), scales: { x: { stacked: true }, y: { stacked: true } } },
  }));
}
