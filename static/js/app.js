/**
 * TRAINING - Mi Bitácora & Calendario Personal de Entrenamiento
 * Controlador principal y gestor de estado para un solo usuario.
 */

const TrainingApp = {
  state: {
    today: new Date().toISOString().split('T')[0],
    selectedDate: new Date().toISOString().split('T')[0],
    calendarYear: new Date().getFullYear(),
    calendarMonth: new Date().getMonth() + 1,
    monthSummary: {},
    dayExercises: [],
    exercises: [],
    muscleGroups: [],
    personalLogbook: [],
    activeTab: 'calendario',
    currentFilter: 'Todos',
    searchQuery: '',
    pickerSearchQuery: '',
    debounceTimers: {}
  },

  MONTH_NAMES: [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ],

  DAY_NAMES: [
    'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'
  ],

  async init() {
    console.log("Inicializando Training Personal...");
    await this.loadInitialState();
    this.bindGlobalEvents();
  },

  // =========================================================================
  // 1. CARGA INICIAL DE DATOS
  // =========================================================================
  async loadInitialState() {
    try {
      const res = await fetch('/api/initial-state');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      if (data.today) {
        this.state.today = data.today;
        this.state.selectedDate = data.today;
      }

      this.state.exercises = data.exercises || [];
      this.state.muscleGroups = data.muscle_groups || [];
      this.state.monthSummary = data.month_summary || {};
      this.state.dayExercises = data.today_exercises || [];
      this.state.personalLogbook = data.personal_logbook || [];

      // Ajustar mes y año actual
      const parts = this.state.selectedDate.split('-');
      this.state.calendarYear = parseInt(parts[0], 10);
      this.state.calendarMonth = parseInt(parts[1], 10);

      this.updateHeaderBadge();
      this.renderCalendar();
      this.renderDayWorkout();
      this.renderLibraryFilters();
      this.renderLibrary();
      this.populateHistorySelector();
      this.renderLogbook();
    } catch (err) {
      console.error("Error al cargar estado inicial:", err);
      this.showToast('Error conectando con la base de datos', 'error');
    }
  },

  bindGlobalEvents() {
    // Cerrar modales con Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-backdrop.active').forEach(m => m.classList.remove('active'));
      }
    });

    // Cerrar al hacer clic fuera del diálogo
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) backdrop.classList.remove('active');
      });
    });
  },

  // =========================================================================
  // 2. NAVEGACIÓN ENTRE PESTAÑAS
  // =========================================================================
  switchTab(tabName) {
    this.state.activeTab = tabName;

    // Actualizar botones de navegación
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    // Alternar vistas
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.remove('active');
    });

    const activeSec = document.getElementById(`view-${tabName}`);
    if (activeSec) activeSec.classList.add('active');

    if (tabName === 'calendario') {
      this.renderCalendar();
      this.renderDayWorkout();
    } else if (tabName === 'biblioteca') {
      this.renderLibrary();
    } else if (tabName === 'bitacora') {
      this.fetchLogbook();
    }
  },

  updateHeaderBadge() {
    const todayBadge = document.getElementById('badge-today-count');
    const exBadge = document.getElementById('badge-exercises-count');
    const logBadge = document.getElementById('badge-logbook-count');
    const headerToday = document.getElementById('label-today-header');

    if (todayBadge) todayBadge.textContent = this.state.dayExercises.length;
    if (exBadge) exBadge.textContent = this.state.exercises.length;
    if (logBadge) logBadge.textContent = this.state.personalLogbook.length;

    if (headerToday) {
      const d = new Date(this.state.today + 'T00:00:00');
      headerToday.textContent = `Hoy (${d.getDate()} ${this.MONTH_NAMES[d.getMonth()].slice(0, 3)})`;
    }
  },

  // =========================================================================
  // 3. CALENDARIO PERSONAL INTERACTIVO
  // =========================================================================
  async changeMonth(delta) {
    let m = this.state.calendarMonth + delta;
    let y = this.state.calendarYear;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }

    this.state.calendarMonth = m;
    this.state.calendarYear = y;

    try {
      const res = await fetch(`/api/personal/calendar/month?year=${y}&month=${m}`);
      const data = await res.json();
      if (data.success) {
        this.state.monthSummary = data.summary || {};
      }
    } catch (e) {
      console.error("Error al cambiar mes:", e);
    }

    this.renderCalendar();
  },

  async goToToday() {
    this.state.selectedDate = this.state.today;
    const parts = this.state.today.split('-');
    this.state.calendarYear = parseInt(parts[0], 10);
    this.state.calendarMonth = parseInt(parts[1], 10);

    await this.selectDate(this.state.today);
    await this.refreshMonthSummary();
    this.switchTab('calendario');
  },

  async selectDate(dateStr) {
    this.state.selectedDate = dateStr;
    try {
      const res = await fetch(`/api/personal/day/${dateStr}`);
      const data = await res.json();
      if (data.success) {
        this.state.dayExercises = data.exercises || [];
      }
    } catch (e) {
      console.error("Error cargando día:", e);
    }
    this.renderCalendar();
    this.renderDayWorkout();
    this.updateHeaderBadge();
  },

  async refreshMonthSummary() {
    try {
      const res = await fetch(`/api/personal/calendar/month?year=${this.state.calendarYear}&month=${this.state.calendarMonth}`);
      const data = await res.json();
      if (data.success) {
        this.state.monthSummary = data.summary || {};
        this.renderCalendar();
      }
    } catch (e) {
      console.error("Error actualizando resumen del mes:", e);
    }
  },

  renderCalendar() {
    const y = this.state.calendarYear;
    const m = this.state.calendarMonth;

    // Título del mes
    const titleEl = document.getElementById('calendar-month-title');
    if (titleEl) {
      titleEl.textContent = `${this.MONTH_NAMES[m - 1]} ${y}`;
    }

    const container = document.getElementById('calendar-days-container');
    if (!container) return;
    container.innerHTML = '';

    // Primer día del mes y total de días
    const firstDay = new Date(y, m - 1, 1);
    const lastDay = new Date(y, m, 0);
    const totalDays = lastDay.getDate();

    // En JS 0 = Domingo. Convertir a Lunes = 0
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    // Días del mes anterior para rellenar
    const prevMonthLastDay = new Date(y, m - 1, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const cell = document.createElement('div');
      cell.className = 'cal-day-cell is-other-month';
      cell.innerHTML = `<span class="cal-num">${dayNum}</span>`;
      container.appendChild(cell);
    }

    // Días del mes actual
    let workoutsCount = 0;
    let totalExercisesCount = 0;
    let totalVolumeCount = 0;

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayData = this.state.monthSummary[dateStr];
      const isToday = (dateStr === this.state.today);
      const isSelected = (dateStr === this.state.selectedDate);

      const cell = document.createElement('div');
      cell.className = 'cal-day-cell';
      if (isToday) cell.classList.add('is-today');
      if (isSelected) cell.classList.add('is-selected');

      let indicatorHtml = '';
      if (dayData && dayData.total > 0) {
        workoutsCount++;
        totalExercisesCount += dayData.total;
        totalVolumeCount += (dayData.volume || 0);

        const isDone = (dayData.status === 'completed');
        indicatorHtml = `
          <div class="cal-indicator-box">
            <span class="cal-dot ${isDone ? 'done' : ''}"></span>
            <span class="cal-tag">${dayData.total} ej.</span>
          </div>
        `;
      }

      cell.innerHTML = `
        <span class="cal-num">${d}</span>
        ${indicatorHtml}
      `;

      cell.onclick = () => this.selectDate(dateStr);
      container.appendChild(cell);
    }

    // Estadísticas del mes
    const statW = document.getElementById('stat-month-workouts');
    const statE = document.getElementById('stat-month-exercises');
    const statV = document.getElementById('stat-month-volume');
    if (statW) statW.textContent = workoutsCount;
    if (statE) statE.textContent = totalExercisesCount;
    if (statV) statV.textContent = `${Math.round(totalVolumeCount)} kg`;
  },

  // =========================================================================
  // 4. PANEL DEL DÍA DE ENTRENAMIENTO (SERIES, REPS, PESO, NOTAS)
  // =========================================================================
  renderDayWorkout() {
    const dateStr = this.state.selectedDate;
    const dateObj = new Date(dateStr + 'T00:00:00');

    // Título y etiqueta relativa
    const titleEl = document.getElementById('day-date-title');
    const tagEl = document.getElementById('day-relative-tag');
    const summaryEl = document.getElementById('day-date-summary');

    const dayName = this.DAY_NAMES[dateObj.getDay()];
    const monthName = this.MONTH_NAMES[dateObj.getMonth()];
    const formattedTitle = `${dayName}, ${dateObj.getDate()} de ${monthName} de ${dateObj.getFullYear()}`;

    if (titleEl) titleEl.textContent = formattedTitle;

    if (tagEl) {
      if (dateStr === this.state.today) {
        tagEl.textContent = 'HOY';
        tagEl.className = 'day-date-tag today';
      } else {
        const diffDays = Math.round((new Date(dateStr) - new Date(this.state.today)) / (1000 * 60 * 60 * 24));
        if (diffDays === -1) {
          tagEl.textContent = 'AYER';
          tagEl.className = 'day-date-tag';
        } else if (diffDays === 1) {
          tagEl.textContent = 'MAÑANA';
          tagEl.className = 'day-date-tag';
        } else if (diffDays < 0) {
          tagEl.textContent = `HACE ${Math.abs(diffDays)} DÍAS`;
          tagEl.className = 'day-date-tag';
        } else {
          tagEl.textContent = `EN ${diffDays} DÍAS`;
          tagEl.className = 'day-date-tag';
        }
      }
    }

    const items = this.state.dayExercises;
    const completedCount = items.filter(i => i.completed).length;

    if (summaryEl) {
      if (items.length === 0) {
        summaryEl.textContent = 'Sin ejercicios asignados a este día.';
      } else {
        summaryEl.textContent = `${items.length} ejercicios planificados · ${completedCount} completados`;
      }
    }

    const listContainer = document.getElementById('day-exercises-list');
    const emptyState = document.getElementById('empty-day-state');

    if (items.length === 0) {
      if (listContainer) listContainer.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (!listContainer) return;

    listContainer.innerHTML = items.map((item, index) => this.renderExerciseCardHtml(item, index)).join('');
  },

  renderExerciseCardHtml(item, index) {
    const isCompleted = (item.completed === 1 || item.completed === true);

    // Alerta de memoria histórica
    let historyAlertHtml = '';
    if (item.last_session) {
      const ls = item.last_session;
      const daysText = ls.days_ago !== null ? `hace ${ls.days_ago} días` : ls.date;
      const notesSnippet = ls.notes ? ` · "${this.escapeHtml(ls.notes)}"` : '';
      historyAlertHtml = `
        <div class="day-ex-history-alert">
          <i class="fa-solid fa-clock-rotate-left"></i>
          <div>
            <strong>Último registro previo (${daysText}):</strong> ${ls.sets} series x ${ls.reps} reps con <strong>${ls.weight} ${ls.weight_unit}</strong>${notesSnippet}
          </div>
        </div>
      `;
    } else {
      historyAlertHtml = `
        <div class="day-ex-history-alert is-new">
          <i class="fa-solid fa-sparkles" style="color: var(--apple-500);"></i>
          <div>
            <strong>Primera vez:</strong> No hay registros anteriores de este ejercicio en tu bitácora.
          </div>
        </div>
      `;
    }

    // Descripción del ejercicio
    let descHtml = '';
    if (item.description) {
      descHtml = `
        <div class="day-ex-desc-box">
          <i class="fa-solid fa-circle-info" style="color: var(--indigo-600); margin-right: 4px;"></i>
          ${this.escapeHtml(item.description)}
        </div>
      `;
    }

    return `
      <article class="day-exercise-card ${isCompleted ? 'completed' : ''}" id="card-item-${item.id}">
        
        <!-- Header del Ejercicio -->
        <div class="day-ex-header">
          <div class="day-ex-title-group">
            <h3 class="day-ex-title">${this.escapeHtml(item.exercise_name)}</h3>
            <span class="badge-tag">${this.escapeHtml(item.category || 'General')}</span>
            <span class="badge-tag ${item.equipment && item.equipment.toLowerCase().includes('bolso') ? 'bolso' : ''}">
              ${this.escapeHtml(item.equipment || 'Libre')}
            </span>
          </div>

          <div class="day-ex-actions">
            <button type="button" class="btn-icon" onclick="TrainingApp.showExerciseHistoryModal('${this.escapeHtml(item.exercise_name)}')" title="Ver bitácora de progresión de este ejercicio">
              <i class="fa-solid fa-chart-line"></i>
            </button>
            <button type="button" class="btn-icon" onclick="TrainingApp.deleteDayExercise(${item.id})" title="Quitar de este día" style="color: var(--danger);">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>

        <!-- Descripción Técnica -->
        ${descHtml}

        <!-- Memoria Histórica -->
        ${historyAlertHtml}

        <!-- Inputs de Carga en Vivo -->
        <div class="day-ex-inputs-grid">
          
          <!-- Series -->
          <div class="input-field-group">
            <label>Series</label>
            <input type="number" min="1" max="20" class="input-control" value="${item.sets || 4}"
                   onchange="TrainingApp.updateDayExerciseField(${item.id}, 'sets', this.value)">
          </div>

          <!-- Repeticiones -->
          <div class="input-field-group">
            <label>Repeticiones</label>
            <input type="text" class="input-control" value="${this.escapeHtml(item.reps || '10-12')}"
                   placeholder="ej. 10-12"
                   onchange="TrainingApp.updateDayExerciseField(${item.id}, 'reps', this.value)">
          </div>

          <!-- Peso y Unidad (Soporte Bolso / Mancuerna / Lastre) -->
          <div class="input-field-group">
            <label>Peso / Carga</label>
            <div class="weight-input-container">
              <input type="number" step="0.5" min="0" class="input-control" value="${item.weight || 0}"
                     onchange="TrainingApp.updateDayExerciseField(${item.id}, 'weight', this.value)">
              <select class="input-control" onchange="TrainingApp.updateDayExerciseField(${item.id}, 'weight_unit', this.value)">
                <option value="kg" ${item.weight_unit === 'kg' ? 'selected' : ''}>kg</option>
                <option value="bolso kg" ${item.weight_unit === 'bolso kg' ? 'selected' : ''}>bolso kg</option>
                <option value="lastre kg" ${item.weight_unit === 'lastre kg' ? 'selected' : ''}>lastre</option>
                <option value="peso corporal" ${item.weight_unit === 'peso corporal' ? 'selected' : ''}>corporal</option>
                <option value="lbs" ${item.weight_unit === 'lbs' ? 'selected' : ''}>lbs</option>
              </select>
            </div>
          </div>

          <!-- Notas de la Sesión -->
          <div class="input-field-group">
            <label>Notas de la sesión</label>
            <input type="text" class="input-control" value="${this.escapeHtml(item.notes || '')}"
                   placeholder="ej. Sentí fácil, subir peso la próxima..."
                   onchange="TrainingApp.updateDayExerciseField(${item.id}, 'notes', this.value)">
          </div>

          <!-- Botón de Completado -->
          <div>
            <button type="button" class="btn-complete-toggle ${isCompleted ? 'is-done' : ''}"
                    onclick="TrainingApp.toggleComplete(${item.id}, ${isCompleted ? 1 : 0})">
              <i class="fa-solid ${isCompleted ? 'fa-circle-check' : 'fa-circle'}"></i>
              <span>${isCompleted ? 'Completado' : 'Marcar Hecho'}</span>
            </button>
          </div>

        </div>

      </article>
    `;
  },

  // =========================================================================
  // 5. ACCIONES SOBRE EJERCICIOS DEL DÍA
  // =========================================================================
  async addExerciseToDay(exerciseId, customName = null) {
    try {
      const res = await fetch(`/api/personal/day/${this.state.selectedDate}/exercises`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exercise_id: exerciseId,
          name: customName
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      this.closeModal('modal-add-to-day');
      await this.selectDate(this.state.selectedDate);
      await this.refreshMonthSummary();
      this.showToast(`'${data.item.exercise_name}' agregado a tu sesión`);
    } catch (e) {
      console.error("Error agregando ejercicio al día:", e);
      this.showToast('No se pudo agregar el ejercicio', 'error');
    }
  },

  async updateDayExerciseField(itemId, field, value) {
    try {
      const payload = {};
      payload[field] = value;

      const res = await fetch(`/api/personal/day/exercises/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success && data.item) {
        // Actualizar en el estado local
        const idx = this.state.dayExercises.findIndex(i => i.id === itemId);
        if (idx !== -1) this.state.dayExercises[idx] = data.item;
        this.showToast('Registro actualizado', 'success', 1500);
      }
    } catch (e) {
      console.error("Error actualizando campo:", e);
    }
  },

  async toggleComplete(itemId, currentVal) {
    const newVal = currentVal ? 0 : 1;
    try {
      const res = await fetch(`/api/personal/day/exercises/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: newVal })
      });
      const data = await res.json();
      if (data.success && data.item) {
        await this.selectDate(this.state.selectedDate);
        await this.refreshMonthSummary();
        this.showToast(newVal ? '¡Ejercicio completado! 🔥' : 'Marcado como pendiente');
      }
    } catch (e) {
      console.error("Error toggling completed:", e);
    }
  },

  async deleteDayExercise(itemId) {
    if (!confirm('¿Deseas quitar este ejercicio de la sesión de este día?')) return;
    try {
      const res = await fetch(`/api/personal/day/exercises/${itemId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await this.selectDate(this.state.selectedDate);
        await this.refreshMonthSummary();
        this.showToast('Ejercicio quitado del día');
      }
    } catch (e) {
      console.error("Error eliminando ejercicio del día:", e);
    }
  },

  // =========================================================================
  // 6. MODAL SELECTOR DE EJERCICIOS PARA EL DÍA
  // =========================================================================
  openAddExerciseModal() {
    this.state.pickerSearchQuery = '';
    const input = document.getElementById('modal-picker-search');
    if (input) input.value = '';

    const subtitle = document.getElementById('modal-add-subtitle');
    const d = new Date(this.state.selectedDate + 'T00:00:00');
    if (subtitle) {
      subtitle.textContent = `Agregar a la sesión del ${d.getDate()} de ${this.MONTH_NAMES[d.getMonth()]}`;
    }

    this.renderPickerList();
    this.openModal('modal-add-to-day');
    setTimeout(() => { if (input) input.focus(); }, 150);
  },

  filterPickerExercises() {
    const input = document.getElementById('modal-picker-search');
    this.state.pickerSearchQuery = (input ? input.value : '').toLowerCase().trim();
    this.renderPickerList();
  },

  renderPickerList() {
    const container = document.getElementById('modal-picker-list');
    if (!container) return;

    const q = this.state.pickerSearchQuery;
    const filtered = this.state.exercises.filter(ex => {
      if (!q) return true;
      return ex.name.toLowerCase().includes(q) ||
             (ex.muscle_group && ex.muscle_group.toLowerCase().includes(q)) ||
             (ex.equipment && ex.equipment.toLowerCase().includes(q)) ||
             (ex.description && ex.description.toLowerCase().includes(q));
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
          <p>No se encontraron ejercicios con "${this.escapeHtml(q)}".</p>
          <button type="button" class="btn btn-apple btn-sm" style="margin-top: 0.75rem;" onclick="TrainingApp.closeModal('modal-add-to-day'); TrainingApp.openNewExerciseModal('${this.escapeHtml(q)}')">
            + Crear nuevo ejercicio "${this.escapeHtml(q)}"
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(ex => `
      <div class="picker-exercise-row" onclick="TrainingApp.addExerciseToDay(${ex.id})">
        <div class="picker-exercise-info">
          <h4>${this.escapeHtml(ex.name)}</h4>
          <p>${this.escapeHtml(ex.muscle_group || 'General')} · ${this.escapeHtml(ex.equipment || 'Libre')} ${ex.description ? '· ' + this.escapeHtml(ex.description.slice(0, 70)) + '...' : ''}</p>
        </div>
        <div>
          <button type="button" class="btn btn-secondary btn-xs">
            + Agregar
          </button>
        </div>
      </div>
    `).join('');
  },

  // =========================================================================
  // 7. VISTA BIBLIOTECA DE EJERCICIOS
  // =========================================================================
  renderLibraryFilters() {
    const container = document.getElementById('library-muscle-chips');
    if (!container) return;

    const groups = ['Todos', 'Calistenia / Bolso', 'Pecho', 'Espalda', 'Piernas', 'Hombros', 'Bíceps', 'Tríceps', 'Core / Abdomen'];
    container.innerHTML = groups.map(g => `
      <button type="button" class="filter-chip ${this.state.currentFilter === g ? 'active' : ''}"
              onclick="TrainingApp.setLibraryFilter('${g}')">
        ${g}
      </button>
    `).join('');
  },

  setLibraryFilter(filter) {
    this.state.currentFilter = filter;
    this.renderLibraryFilters();
    this.renderLibrary();
  },

  filterLibrary() {
    const input = document.getElementById('library-search-input');
    this.state.searchQuery = (input ? input.value : '').toLowerCase().trim();
    this.renderLibrary();
  },

  renderLibrary() {
    const container = document.getElementById('library-cards-container');
    if (!container) return;

    const q = this.state.searchQuery;
    const f = this.state.currentFilter;

    const filtered = this.state.exercises.filter(ex => {
      // Filtro de texto
      if (q) {
        const match = ex.name.toLowerCase().includes(q) ||
                      (ex.muscle_group && ex.muscle_group.toLowerCase().includes(q)) ||
                      (ex.equipment && ex.equipment.toLowerCase().includes(q)) ||
                      (ex.description && ex.description.toLowerCase().includes(q));
        if (!match) return false;
      }
      // Filtro de categoría
      if (f !== 'Todos') {
        if (f === 'Calistenia / Bolso') {
          return (ex.equipment && ex.equipment.toLowerCase().includes('bolso')) ||
                 (ex.equipment && ex.equipment.toLowerCase().includes('corporal')) ||
                 (ex.muscle_group && ex.muscle_group.toLowerCase().includes('calistenia'));
        }
        return (ex.muscle_group && ex.muscle_group.toLowerCase().includes(f.toLowerCase()));
      }
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
          <p>No se encontraron ejercicios en la biblioteca.</p>
          <button type="button" class="btn btn-apple" style="margin-top: 1rem;" onclick="TrainingApp.openNewExerciseModal()">
            + Crear nuevo ejercicio
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(ex => `
      <div class="library-card-item">
        <div>
          <div class="lib-card-top">
            <h4 class="lib-card-title">${this.escapeHtml(ex.name)}</h4>
            <span class="badge-tag">${this.escapeHtml(ex.muscle_group || 'General')}</span>
          </div>

          <div class="lib-card-meta">
            <span><b>Equipo:</b> ${this.escapeHtml(ex.equipment || 'Libre')}</span>
            <span><b>Sugerido:</b> ${ex.default_sets || 4}x${ex.default_reps || '10-12'}</span>
          </div>

          <div class="lib-card-desc">
            ${ex.description ? this.escapeHtml(ex.description) : '<i style="color: var(--text-subtle);">Sin descripción técnica añadida. Haz clic en "Editar" para escribir notas sobre cómo ejecutarlo.</i>'}
          </div>
        </div>

        <div class="lib-card-actions">
          <button type="button" class="btn btn-apple btn-sm" style="flex: 1;" onclick="TrainingApp.addExerciseToDay(${ex.id})">
            + Agregar a mi día
          </button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="TrainingApp.openEditExerciseModal(${ex.id})" title="Editar técnica y descripción">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="TrainingApp.showExerciseHistoryModal('${this.escapeHtml(ex.name)}')" title="Ver historial">
            <i class="fa-solid fa-chart-line"></i>
          </button>
        </div>
      </div>
    `).join('');
  },

  openNewExerciseModal(prefillName = '') {
    document.getElementById('modal-exercise-title').innerHTML = '<i class="fa-solid fa-plus" style="color: var(--apple-500); margin-right: 8px;"></i> Nuevo Ejercicio';
    document.getElementById('form-ex-id').value = '';
    document.getElementById('form-ex-name').value = prefillName;
    document.getElementById('form-ex-muscle').value = 'General';
    document.getElementById('form-ex-equip').value = 'Bolso con peso / Calistenia';
    document.getElementById('form-ex-desc').value = '';
    document.getElementById('form-ex-sets').value = 4;
    document.getElementById('form-ex-reps').value = '10-12';
    document.getElementById('form-ex-weight').value = 0;

    this.openModal('modal-exercise-edit');
  },

  openEditExerciseModal(exerciseId) {
    const ex = this.state.exercises.find(e => e.id === exerciseId);
    if (!ex) return;

    document.getElementById('modal-exercise-title').innerHTML = '<i class="fa-solid fa-pen-to-square" style="color: var(--apple-500); margin-right: 8px;"></i> Editar Ejercicio';
    document.getElementById('form-ex-id').value = ex.id;
    document.getElementById('form-ex-name').value = ex.name;
    document.getElementById('form-ex-muscle').value = ex.muscle_group || '';
    document.getElementById('form-ex-equip').value = ex.equipment || '';
    document.getElementById('form-ex-desc').value = ex.description || '';
    document.getElementById('form-ex-sets').value = ex.default_sets || 4;
    document.getElementById('form-ex-reps').value = ex.default_reps || '10-12';
    document.getElementById('form-ex-weight').value = ex.default_weight || 0;

    this.openModal('modal-exercise-edit');
  },

  async saveExerciseForm(e) {
    e.preventDefault();
    const id = document.getElementById('form-ex-id').value;
    const name = document.getElementById('form-ex-name').value.trim();
    const muscle = document.getElementById('form-ex-muscle').value.trim();
    const equip = document.getElementById('form-ex-equip').value.trim();
    const desc = document.getElementById('form-ex-desc').value.trim();
    const sets = parseInt(document.getElementById('form-ex-sets').value, 10) || 4;
    const reps = document.getElementById('form-ex-reps').value.trim() || '10-12';
    const weight = parseFloat(document.getElementById('form-ex-weight').value) || 0;

    try {
      if (id) {
        // Actualizar existente
        const res = await fetch(`/api/exercises/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name,
            muscle_group: muscle,
            equipment: equip,
            description: desc,
            default_sets: sets,
            default_reps: reps,
            default_weight: weight
          })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        this.state.exercises = data.exercises || [];
        this.showToast('Ejercicio actualizado');
      } else {
        // Crear nuevo
        const res = await fetch('/api/exercises', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name,
            muscle_group: muscle,
            secondary_muscle: '',
            equipment: equip,
            difficulty: 'Intermedio',
            description: desc,
            default_sets: sets,
            default_reps: reps,
            default_weight: weight,
            default_rest: '90 seg'
          })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        if (data.exercises) this.state.exercises = data.exercises;
        this.showToast('Nuevo ejercicio registrado en la biblioteca');
      }

      this.closeModal('modal-exercise-edit');
      this.renderLibrary();
      this.populateHistorySelector();
    } catch (err) {
      console.error("Error guardando ejercicio:", err);
      this.showToast('Error al guardar el ejercicio', 'error');
    }
  },

  // =========================================================================
  // 8. VISTA BITÁCORA & PROGRESO HISTÓRICO
  // =========================================================================
  populateHistorySelector() {
    const sel = document.getElementById('select-history-exercise');
    if (!sel) return;

    const currentVal = sel.value;
    sel.innerHTML = '<option value="">Selecciona un ejercicio para ver su progreso...</option>';
    
    // Ordenar ejercicios alfabéticamente
    const sorted = [...this.state.exercises].sort((a, b) => a.name.localeCompare(b.name));
    sorted.forEach(ex => {
      const opt = document.createElement('option');
      opt.value = ex.name;
      opt.textContent = `${ex.name} (${ex.muscle_group || 'General'})`;
      sel.appendChild(opt);
    });

    if (currentVal) sel.value = currentVal;
  },

  async loadExerciseHistory(exerciseName) {
    if (!exerciseName) {
      document.getElementById('history-summary-box').style.display = 'none';
      document.getElementById('exercise-history-timeline').style.display = 'none';
      return;
    }

    try {
      const res = await fetch(`/api/personal/exercises/${encodeURIComponent(exerciseName)}/history`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const history = data.history || [];
      const summaryBox = document.getElementById('history-summary-box');
      const timelineBox = document.getElementById('exercise-history-timeline');
      const totalSessEl = document.getElementById('history-total-sessions');
      const maxWeightEl = document.getElementById('history-max-weight');

      if (summaryBox) summaryBox.style.display = 'flex';
      if (timelineBox) timelineBox.style.display = 'flex';

      if (totalSessEl) totalSessEl.textContent = `${history.length} sesiones registradas`;

      // Calcular peso máximo
      let maxW = 0;
      let maxUnit = 'kg';
      history.forEach(h => {
        if (h.weight > maxW) {
          maxW = h.weight;
          maxUnit = h.weight_unit || 'kg';
        }
      });
      if (maxWeightEl) maxWeightEl.textContent = `Carga máx: ${maxW} ${maxUnit}`;

      if (history.length === 0) {
        timelineBox.innerHTML = `
          <div style="text-align: center; padding: 1.5rem; color: var(--text-muted);">
            No hay registros previos de <strong>${this.escapeHtml(exerciseName)}</strong>. Cuando lo agregues a un día y lo entrenes, aparecerá aquí.
          </div>
        `;
        return;
      }

      timelineBox.innerHTML = history.map(h => {
        const d = new Date(h.date + 'T00:00:00');
        const formattedDate = `${this.DAY_NAMES[d.getDay()]} ${d.getDate()} ${this.MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
        return `
          <div class="history-entry-item">
            <div>
              <div class="history-entry-date">${formattedDate}</div>
              <div style="font-size: 0.85rem; color: var(--text-main); margin-top: 2px;">
                <strong>${h.sets} series</strong> × <strong>${this.escapeHtml(h.reps)} reps</strong>
                ${h.notes ? `<span class="history-entry-notes">· "${this.escapeHtml(h.notes)}"</span>` : ''}
              </div>
            </div>
            <div>
              <span class="history-entry-load">${h.weight} ${this.escapeHtml(h.weight_unit || 'kg')}</span>
            </div>
          </div>
        `;
      }).join('');

    } catch (e) {
      console.error("Error cargando historial de ejercicio:", e);
    }
  },

  async showExerciseHistoryModal(exerciseName) {
    try {
      const res = await fetch(`/api/personal/exercises/${encodeURIComponent(exerciseName)}/history`);
      const data = await res.json();
      const history = data.history || [];

      document.getElementById('modal-history-name').textContent = exerciseName;
      const content = document.getElementById('modal-history-content');

      if (history.length === 0) {
        content.innerHTML = `
          <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
            <p>Aún no tienes registros de este ejercicio en tu bitácora.</p>
          </div>
        `;
      } else {
        content.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            ${history.map(h => {
              const d = new Date(h.date + 'T00:00:00');
              const fDate = `${d.getDate()} de ${this.MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
              return `
                <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface-alt); padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border-light);">
                  <div>
                    <strong style="color: var(--indigo-950);">${fDate}</strong>
                    <div style="font-size: 0.82rem; color: var(--text-muted);">${h.sets} series x ${this.escapeHtml(h.reps)} reps ${h.notes ? `· "${this.escapeHtml(h.notes)}"` : ''}</div>
                  </div>
                  <div>
                    <span style="font-weight: 800; color: var(--apple-700); background: var(--apple-100); padding: 3px 8px; border-radius: 999px; font-size: 0.85rem;">
                      ${h.weight} ${this.escapeHtml(h.weight_unit || 'kg')}
                    </span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }

      this.openModal('modal-exercise-history');
    } catch (e) {
      console.error("Error abriendo modal de historial:", e);
    }
  },

  async fetchLogbook() {
    try {
      const res = await fetch('/api/personal/logbook?limit=30');
      const data = await res.json();
      if (data.success) {
        this.state.personalLogbook = data.logbook || [];
        this.renderLogbook();
      }
    } catch (e) {
      console.error("Error fetching logbook:", e);
    }
  },

  renderLogbook() {
    const container = document.getElementById('logbook-entries-container');
    if (!container) return;

    const logbook = this.state.personalLogbook;
    if (logbook.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: var(--text-muted); background: var(--bg-surface); border-radius: var(--radius-lg); border: 1px solid var(--border-light);">
          <i class="fa-solid fa-clipboard-list" style="font-size: 2rem; color: var(--apple-500); margin-bottom: 0.75rem;"></i>
          <h3>Bitácora sin registros</h3>
          <p>Tus entrenamientos completados en el calendario se irán organizando aquí automáticamente.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = logbook.map(entry => {
      const d = new Date(entry.date + 'T00:00:00');
      const formattedDate = `${this.DAY_NAMES[d.getDay()]}, ${d.getDate()} de ${this.MONTH_NAMES[d.getMonth()]} de ${d.getFullYear()}`;
      
      const rowsHtml = (entry.exercises || []).map(ex => `
        <tr>
          <td><strong>${this.escapeHtml(ex.exercise_name)}</strong></td>
          <td>${this.escapeHtml(ex.category || 'General')}</td>
          <td>${ex.sets} series × ${this.escapeHtml(ex.reps)} reps</td>
          <td><strong>${ex.weight} ${this.escapeHtml(ex.weight_unit || 'kg')}</strong></td>
          <td style="color: var(--text-muted); font-style: italic;">${ex.notes ? this.escapeHtml(ex.notes) : '—'}</td>
        </tr>
      `).join('');

      return `
        <div class="logbook-day-card">
          <div class="logbook-day-header">
            <div>
              <span class="day-date-tag">${entry.date === this.state.today ? 'HOY' : entry.date}</span>
              <h4 class="logbook-day-title">${formattedDate}</h4>
            </div>
            <div class="logbook-day-stats">
              <span><i class="fa-solid fa-dumbbell"></i> ${entry.total_exercises} ejercicios</span>
              <span><i class="fa-solid fa-layer-group"></i> ${entry.total_sets || 0} series</span>
              <span><i class="fa-solid fa-weight-hanging"></i> ${Math.round(entry.total_volume || 0)} kg total</span>
            </div>
          </div>

          <table class="logbook-day-table">
            <thead>
              <tr>
                <th>Ejercicio</th>
                <th>Categoría</th>
                <th>Series & Reps</th>
                <th>Peso / Carga</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      `;
    }).join('');
  },

  // =========================================================================
  // 9. UTILIDADES Y MODALES
  // =========================================================================
  openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  },

  closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  },

  showToast(msg, type = 'success', duration = 3000) {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('toast-msg');
    const iconEl = document.getElementById('toast-icon');
    if (!toast || !msgEl) return;

    msgEl.textContent = msg;
    if (iconEl) {
      if (type === 'error') {
        iconEl.innerHTML = '<i class="fa-solid fa-circle-exclamation" style="color: var(--danger);"></i>';
      } else {
        iconEl.innerHTML = '<i class="fa-solid fa-circle-check" style="color: var(--apple-400);"></i>';
      }
    }

    toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

// Iniciar aplicación cuando cargue el DOM
document.addEventListener('DOMContentLoaded', () => {
  TrainingApp.init();
});
