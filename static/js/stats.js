/**
 * TRAINING - Controlador de Estadísticas y Sobrecarga Progresiva
 */
const StatsApp = {
  charts: {
    strength: null,
    volume: null,
    recent: null
  },

  async init() {
    await this.loadOverview();
  },

  async loadOverview() {
    try {
      const res = await fetch('/api/personal/stats/overview');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const ov = data.overview;
      document.getElementById('kpi-total-days').textContent = ov.total_days || 0;
      document.getElementById('kpi-total-sets').textContent = ov.total_sets || 0;
      document.getElementById('kpi-total-volume').textContent = `${(ov.total_volume || 0).toLocaleString('es-ES')} kg`;
      document.getElementById('kpi-max-pr').textContent = `${ov.max_weight_ever || 0} kg`;
      document.getElementById('kpi-pr-ex').textContent = ov.pr_exercise && ov.pr_exercise !== '-' ? `PR: ${ov.pr_exercise}` : 'Récord Máximo';

      const sel = document.getElementById('stats-exercise-select');
      const exercises = ov.exercises_with_history || [];

      if (exercises.length === 0) {
        sel.innerHTML = '<option value="">Sin ejercicios registrados todavía</option>';
        document.getElementById('stats-empty-state').style.display = 'block';
        return;
      }

      sel.innerHTML = exercises.map(e =>
        `<option value="${this.escapeHtml(e.exercise_name)}">${this.escapeHtml(e.exercise_name)} (${e.sessions} ${e.sessions === 1 ? 'sesión' : 'sesiones'})</option>`
      ).join('');

      // Renderizar gráfica de actividad reciente
      if (ov.recent_activity && ov.recent_activity.length > 0) {
        document.getElementById('recent-activity-card').style.display = 'block';
        this.renderRecentActivityChart(ov.recent_activity);
      }

      // Cargar automáticamente el primer ejercicio con historial
      await this.loadExerciseStats(exercises[0].exercise_name);
    } catch (err) {
      console.error('Error cargando resumen de estadísticas:', err);
    }
  },

  async loadExerciseStats(exerciseName) {
    if (!exerciseName) return;
    try {
      const res = await fetch(`/api/personal/stats/exercise/${encodeURIComponent(exerciseName)}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const stats = data.stats;
      const sessions = stats.sessions || [];
      const prs = stats.prs || {};

      document.getElementById('ex-pr-badges').style.display = 'flex';
      document.getElementById('ex-pr-weight').textContent = `${prs.max_weight || 0} kg`;
      document.getElementById('ex-pr-1rm').textContent = `${prs.max_1rm || 0} kg`;
      document.getElementById('ex-pr-volume').textContent = `${prs.max_volume || 0} kg`;

      if (sessions.length === 0) {
        document.getElementById('exercise-charts-section').style.display = 'none';
        document.getElementById('exercise-history-table-card').style.display = 'none';
        return;
      }

      document.getElementById('exercise-charts-section').style.display = 'grid';
      document.getElementById('exercise-history-table-card').style.display = 'block';

      this.renderExerciseCharts(sessions);
      this.renderSessionsTable(sessions);
    } catch (err) {
      console.error('Error cargando estadísticas de ejercicio:', err);
    }
  },

  renderExerciseCharts(sessions) {
    const labels = sessions.map(s => s.date);
    const maxWeights = sessions.map(s => s.max_weight);
    const est1rms = sessions.map(s => s.estimated_1rm);
    const volumes = sessions.map(s => s.total_volume);

    if (this.charts.strength) this.charts.strength.destroy();
    if (this.charts.volume) this.charts.volume.destroy();

    const ctxStr = document.getElementById('chart-strength').getContext('2d');
    this.charts.strength = new Chart(ctxStr, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Peso Máximo (kg)',
            data: maxWeights,
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.14)',
            borderWidth: 3,
            tension: 0.3,
            fill: true,
            pointRadius: 5,
            pointBackgroundColor: '#16a34a'
          },
          {
            label: '1RM Estimado (kg)',
            data: est1rms,
            borderColor: '#4f46e5',
            borderDash: [5, 5],
            borderWidth: 2,
            tension: 0.3,
            fill: false,
            pointRadius: 4,
            pointBackgroundColor: '#4f46e5'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });

    const ctxVol = document.getElementById('chart-volume').getContext('2d');
    this.charts.volume = new Chart(ctxVol, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Volumen Total (Reps × Peso)',
            data: volumes,
            backgroundColor: 'rgba(79, 70, 229, 0.8)',
            borderRadius: 8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  },

  renderRecentActivityChart(activity) {
    if (this.charts.recent) this.charts.recent.destroy();
    const ctx = document.getElementById('chart-recent-activity').getContext('2d');
    this.charts.recent = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: activity.map(a => a.date),
        datasets: [{
          label: 'Volumen Diario Total (kg)',
          data: activity.map(a => Math.round(a.volume || 0)),
          backgroundColor: 'rgba(34, 197, 94, 0.78)',
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true } }
      }
    });
  },

  renderSessionsTable(sessions) {
    const tbody = document.getElementById('stats-sessions-tbody');
    if (!tbody) return;

    // Mostrar de la más reciente a la más antigua, calculando delta vs la sesión inmediatamente anterior
    const rowsHtml = [];
    for (let i = sessions.length - 1; i >= 0; i--) {
      const curr = sessions[i];
      const prev = i > 0 ? sessions[i - 1] : null;
      const unit = curr.weight_unit || 'kg';

      const chips = (curr.sets_detail || []).map(s =>
        `<span class="set-chip">S${s.set_number}: <b>${s.reps}×${s.weight}${unit}</b> <span style="color: var(--text-muted); font-size: 0.68rem;">(${s.load})</span></span>`
      ).join('');

      let deltaHtml = '<span style="color: var(--text-subtle); font-size: 0.78rem;">Base inicial</span>';
      if (prev) {
        const diffVol = Math.round((curr.total_volume - prev.total_volume) * 10) / 10;
        const diffW = Math.round((curr.max_weight - prev.max_weight) * 10) / 10;
        if (diffVol > 0 || diffW > 0) {
          deltaHtml = `<span style="color: var(--apple-700); background: var(--apple-50); padding: 3px 8px; border-radius: 99px; font-weight: 800; font-size: 0.76rem;"><i class="fa-solid fa-arrow-up"></i> +${diffVol} vol${diffW > 0 ? ` / +${diffW} ${unit}` : ''}</span>`;
        } else if (diffVol < 0) {
          deltaHtml = `<span style="color: #b45309; background: #fef3c7; padding: 3px 8px; border-radius: 99px; font-weight: 700; font-size: 0.76rem;">${diffVol} vol</span>`;
        } else {
          deltaHtml = `<span style="color: var(--indigo-600); background: var(--indigo-50); padding: 3px 8px; border-radius: 99px; font-weight: 700; font-size: 0.76rem;">Mantenido</span>`;
        }
      }

      rowsHtml.push(`
        <tr style="border-bottom: 1px solid var(--border-light);">
          <td style="padding: 12px; font-weight: 800; color: var(--indigo-950); white-space: nowrap;">${curr.date}</td>
          <td style="padding: 12px;">
            <div class="sets-chips-inline">${chips}</div>
            ${curr.notes ? `<div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 4px;">"${this.escapeHtml(curr.notes)}"</div>` : ''}
          </td>
          <td style="padding: 12px; text-align: right; font-weight: 800; color: var(--apple-700); white-space: nowrap;">${curr.max_weight} ${this.escapeHtml(unit)}</td>
          <td style="padding: 12px; text-align: right; font-weight: 800; color: var(--indigo-700); white-space: nowrap;">${curr.total_volume} ${this.escapeHtml(unit)}</td>
          <td style="padding: 12px; text-align: center;">${deltaHtml}</td>
        </tr>
      `);
    }

    tbody.innerHTML = rowsHtml.join('');
  },

  escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
};

document.addEventListener('DOMContentLoaded', () => StatsApp.init());
