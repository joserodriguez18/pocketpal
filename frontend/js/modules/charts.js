/**
 * @file frontend/js/modules/charts.js
 * @description Módulo de gráficas del dashboard (Chart.js).
 *
 * Renderiza tres visualizaciones a partir del objeto `summaryData`
 * que devuelve el endpoint GET /api/summary:
 *
 *   1. renderMonthlyChart()    — Barras: Ingresos vs. Gastos por mes.
 *   2. renderCategoryDoughnut() — Dona: distribución de gastos por categoría.
 *   3. renderBalanceLine()     — Línea: balance acumulado mes a mes.
 *
 * Patrón: siempre destruir la instancia anterior antes de crear una nueva
 * para evitar memory leaks de Chart.js al re-renderizar.
 *
 * Expone: renderCharts(summaryData).
 * Depende de: Chart.js (CDN en dashboard.html), fmt (de api.js).
 */

/** Registro de instancias activas para destruirlas al actualizar. */
const _charts = {};

/**
 * Renderiza (o actualiza) las tres gráficas del dashboard.
 * Destruye las instancias previas para evitar duplicados.
 *
 * @param {object} summaryData - Respuesta de GET /api/summary.
 * @param {object} summaryData.totals          - Totales de ingresos/gastos.
 * @param {Array}  summaryData.categoryBreakdown - Desglose por categoría.
 * @param {Array}  summaryData.monthlyTrend    - Tendencia mensual [{month, income, expenses}].
 */
function renderCharts(summaryData) {
  renderMonthlyChart(summaryData.monthlyTrend  || []);
  renderCategoryDoughnut(summaryData.categoryBreakdown || []);
  renderBalanceLine(summaryData.monthlyTrend   || []);
}

/**
 * Gráfica de barras agrupadas: Ingresos vs. Gastos por mes.
 * Útil para ver de un vistazo si el usuario está gastando más de lo que gana.
 *
 * @param {Array} monthlyTrend - [{month: 'YYYY-MM', income: number, expenses: number}].
 */
function renderMonthlyChart(monthlyTrend) {
  const ctx = document.getElementById('chart-monthly');
  if (!ctx) return;

  // Destruir gráfica anterior para evitar overlay de instancias
  if (_charts.monthly) { _charts.monthly.destroy(); }

  const labels  = monthlyTrend.map((d) => d.month);
  const income  = monthlyTrend.map((d) => parseFloat(d.income  || 0));
  const expense = monthlyTrend.map((d) => parseFloat(d.expenses || 0));

  _charts.monthly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label:           'Ingresos',
          data:            income,
          backgroundColor: 'rgba(0,229,160,0.7)',
          borderColor:     'rgba(0,229,160,1)',
          borderWidth:     1,
          borderRadius:    6,
        },
        {
          label:           'Gastos',
          data:            expense,
          backgroundColor: 'rgba(255,77,109,0.7)',
          borderColor:     'rgba(255,77,109,1)',
          borderWidth:     1,
          borderRadius:    6,
        },
      ],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#8b92a8', font: { family: 'Sora' } } },
        tooltip: {
          callbacks: {
            // Mostrar montos como COP en el tooltip
            label: (ctx) => ` ${ctx.dataset.label}: ${fmt.currency(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: { ticks: { color: '#555e78' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: {
          ticks: { color: '#555e78', callback: (v) => fmt.currency(v) },
          grid:  { color: 'rgba(255,255,255,0.04)' },
        },
      },
    },
  });
}

/**
 * Gráfica de dona: distribución de gastos por categoría.
 * Solo incluye categorías con type === 'expense'.
 * Si no hay datos de gastos, no renderiza nada (evita gráfica vacía).
 *
 * @param {Array} categoryBreakdown - [{category_name, type, total}].
 */
function renderCategoryDoughnut(categoryBreakdown) {
  const ctx = document.getElementById('chart-categories');
  if (!ctx) return;

  if (_charts.categories) { _charts.categories.destroy(); }

  // Solo gastos (no ingresos ni ahorros)
  const expenses = categoryBreakdown.filter((c) => c.type === 'expense');
  if (expenses.length === 0) return;

  // Paleta de colores — se repite si hay más categorías que colores
  const COLORS = [
    '#ff4d6d','#ff8c42','#f5c542','#a78bfa',
    '#4d9fff','#00e5a0','#ff6b9d','#c77dff',
  ];

  _charts.categories = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: expenses.map((c) => c.category_name),
      datasets: [{
        data:            expenses.map((c) => parseFloat(c.total)),
        backgroundColor: expenses.map((_, i) => COLORS[i % COLORS.length]),
        borderColor:     '#1e2230',
        borderWidth:     3,
        hoverOffset:     8,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      cutout:              '68%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color:    '#8b92a8',
            font:     { family: 'Sora' },
            padding:  12,
            boxWidth: 12,
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${fmt.currency(ctx.parsed)}`,
          },
        },
      },
    },
  });
}

/**
 * Gráfica de línea: balance acumulado mes a mes.
 * Calcula el acumulado corriendo (running total) del balance neto de cada mes.
 * Útil para ver si el patrimonio neto del usuario está creciendo.
 *
 * @param {Array} monthlyTrend - [{month, income, expenses}].
 */
function renderBalanceLine(monthlyTrend) {
  const ctx = document.getElementById('chart-balance');
  if (!ctx) return;

  if (_charts.balance) { _charts.balance.destroy(); }

  // Calcular balance acumulado: suma del neto de cada mes hasta ese punto
  let running = 0;
  const balances = monthlyTrend.map((d) => {
    running += parseFloat(d.income || 0) - parseFloat(d.expenses || 0);
    return running;
  });

  _charts.balance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: monthlyTrend.map((d) => d.month),
      datasets: [{
        label:               'Balance acumulado',
        data:                balances,
        borderColor:         '#4d9fff',
        backgroundColor:     'rgba(77,159,255,0.08)',
        fill:                true,
        tension:             0.4,
        pointBackgroundColor: '#4d9fff',
        pointRadius:         4,
        pointHoverRadius:    6,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` Balance: ${fmt.currency(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: { ticks: { color: '#555e78' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: {
          ticks: { color: '#555e78', callback: (v) => fmt.currency(v) },
          grid:  { color: 'rgba(255,255,255,0.04)' },
        },
      },
    },
  });
}
