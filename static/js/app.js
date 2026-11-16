/**
 * TRAINING - Coach Gym Web Application
 * Main Application Logic & State Controller
 */

const TrainingApp = {
  state: {
    students: [],
    exercises: [],
    muscleGroups: [],
    recentLogs: [],
    activeStudentId: null,
    activeRoutineId: null,
    activeRoutineName: 'Día 1: Nueva Rutina',
    activeDayTag: 'General',
    activeRoutineNotes: '',
    routineItems: [],
    currentFilter: 'Todos',
    searchQuery: '',
    activeTab: 'rutinas',
    // Planificador y Calendario
    studentPlans: [],
    activePlanId: null,
    calendarEvents: [],
    calendarYear: new Date().getFullYear(),
    calendarMonth: new Date().getMonth() + 1,
    calendarSubtab: 'calendar-month'
  },

  async init() {
    this.bindEvents();
    window.DragDropEngine.init();
    await this.loadInitialState();
  },

  // ==================== CARGA DE DATOS ====================
  async loadInitialState() {
    try {
      const res = await fetch('/api/initial-state');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      this.state.students = data.students || [];
      this.state.exercises = data.exercises || [];
      this.state.muscleGroups = data.muscleGroups || [];
      this.state.recentLogs = data.recent_logs || [];

      // Seleccionar primer alumno por defecto
      if (this.state.students.length > 0) {
        this.state.activeStudentId = this.state.students[0].id;
        this.state.studentPlans = data.active_student_plans || [];
        if (this.state.studentPlans.length > 0) {
          this.state.activePlanId = this.state.studentPlans[0].id;
        }

        if (data.active_routine) {
          this.setLoadedRoutine(data.active_routine);
        } else if (data.active_student_routines && data.active_student_routines.length > 0) {
          await this.loadRoutine(data.active_student_routines[0].id);
        } else {
          this.createNewRoutineDraft();
        }

        await this.loadCalendarEvents();
      }

      this.renderAll();
    } catch (err) {
      console.error("Error al cargar estado inicial:", err);
      this.showToast('Error cargando datos del servidor', 'error');
    }
  },


  // ==================== RENDERS PRINCIPALES ====================
  renderAll() {
    this.renderNavCounts();
    this.renderStudentSelectors();
    this.renderMuscleFilterChips();
    this.renderExerciseLibrary();
    this.renderRoutineBoard();
    this.calculateRoutineStats();
    this.renderPlannerView();
    this.renderStudentsView();
    this.renderCatalogView();
    this.renderLogsView();
  },

  renderNavCounts() {
    const studentCountEl = document.getElementById('count-nav-students');
    const exCountEl = document.getElementById('count-nav-exercises');
    const logsCountEl = document.getElementById('count-nav-logs');
    const plansCountEl = document.getElementById('count-nav-plans');

    if (studentCountEl) studentCountEl.textContent = this.state.students.length;
    if (exCountEl) exCountEl.textContent = this.state.exercises.length;
    if (logsCountEl) logsCountEl.textContent = this.state.recentLogs.length;
    if (plansCountEl) plansCountEl.textContent = this.state.studentPlans.length;
  },

  renderStudentSelectors() {
    const selector = document.getElementById('student-select');
    const plannerSelector = document.getElementById('planner-student-select');
    const modalStudentSelector = document.getElementById('plan-modal-student');

    const optionsHtml = this.state.students.map(s => `
      <option value="${s.id}" ${s.id == this.state.activeStudentId ? 'selected' : ''}>
        ${s.name} (${s.goal})
      </option>
    `).join('');

    if (selector) selector.innerHTML = optionsHtml;
    if (plannerSelector) plannerSelector.innerHTML = optionsHtml;
    if (modalStudentSelector) modalStudentSelector.innerHTML = optionsHtml;

    // Actualizar chip de información del alumno activo
    const activeStudent = this.state.students.find(s => s.id == this.state.activeStudentId);
    const goalChip = document.getElementById('active-student-goal-chip');
    if (goalChip && activeStudent) {
      goalChip.innerHTML = `
        <span>👤 <strong>${activeStudent.name}</strong></span>
        <span>•</span>
        <span>🎯 ${activeStudent.goal}</span>

        <span>•</span>
        <span>⚖️ ${activeStudent.weight} kg</span>
      `;
    }
  },

  async updateRoutinesDropdown() {
    if (!this.state.activeStudentId) return;
    try {
      const res = await fetch(`/api/students/${this.state.activeStudentId}/routines`);
      const data = await res.json();
      if (!data.success) return;

      const routines = data.routines || [];
      const select = document.getElementById('routine-select');
      if (!select) return;

      if (routines.length === 0) {
        select.innerHTML = `<option value="">(Sin rutinas guardadas)</option>`;
      } else {
        select.innerHTML = routines.map(r => `
          <option value="${r.id}" ${r.id == this.state.activeRoutineId ? 'selected' : ''}>
            ${r.name} (${r.day_tag || 'General'}) - ${r.item_count || 0} ej.
          </option>
        `).join('');
      }
    } catch (e) {
      console.error(e);
    }
  },

  renderMuscleFilterChips() {
    const container = document.getElementById('muscle-filter-scroll');
    const catalogFilters = document.getElementById('catalog-muscle-filter');
    if (!container) return;

    const allGroups = ['Todos', 'Pecho', 'Espalda', 'Piernas', 'Hombros', 'Bíceps', 'Tríceps', 'Core / Abdomen', 'Cardio / Funcional'];

    const html = allGroups.map(grp => `
      <button class="filter-chip ${this.state.currentFilter === grp ? 'active' : ''}" data-group="${grp}">
        ${grp}
      </button>
    `).join('');

    container.innerHTML = html;
    if (catalogFilters) catalogFilters.innerHTML = html;

    // Listeners
    container.querySelectorAll('.filter-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.state.currentFilter = e.currentTarget.dataset.group;
        this.renderMuscleFilterChips();
        this.renderExerciseLibrary();
      });
    });

    if (catalogFilters) {
      catalogFilters.querySelectorAll('.filter-chip').forEach(btn => {
        btn.addEventListener('click', (e) => {
          this.state.currentFilter = e.currentTarget.dataset.group;
          this.renderMuscleFilterChips();
          this.renderCatalogView();
        });
      });
    }
  },

  renderExerciseLibrary() {
    const list = document.getElementById('exercise-scroll-list');
    if (!list) return;

    let filtered = this.state.exercises;

    // Filtro por grupo muscular
    if (this.state.currentFilter && this.state.currentFilter !== 'Todos') {
      filtered = filtered.filter(ex => ex.muscle_group.toLowerCase().includes(this.state.currentFilter.toLowerCase()));
    }

    // Filtro por búsqueda
    if (this.state.searchQuery.trim()) {
      const q = this.state.searchQuery.toLowerCase();
      filtered = filtered.filter(ex => 
        ex.name.toLowerCase().includes(q) || 
        ex.equipment.toLowerCase().includes(q) || 
        ex.muscle_group.toLowerCase().includes(q)
      );
    }

    if (filtered.length === 0) {
      list.innerHTML = `
        <div style="padding: 2rem 1rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
          No se encontraron ejercicios con ese criterio.
        </div>
      `;
      return;
    }

    list.innerHTML = filtered.map(ex => {
      const muscleClass = this.getMuscleBadgeClass(ex.muscle_group);
      return `
        <div class="exercise-drag-card" data-id="${ex.id}">
          <div class="drag-card-top">
            <span class="drag-grip">⋮⋮</span>
            <span class="drag-card-name">${ex.name}</span>
            <button type="button" class="btn-add-quick" title="Añadir a rutina" data-id="${ex.id}">+</button>
          </div>
          <div class="drag-card-meta">
            <span class="badge ${muscleClass}">${ex.muscle_group}</span>
            <span class="meta-tag">⚡ ${ex.equipment}</span>
            <span class="meta-tag">${ex.default_sets} x ${ex.default_reps}</span>
          </div>
        </div>
      `;
    }).join('');

    // Conectar eventos drag y click de adición
    list.querySelectorAll('.exercise-drag-card').forEach(card => {
      const id = parseInt(card.dataset.id, 10);
      const exercise = this.state.exercises.find(e => e.id === id);
      if (exercise) {
        window.DragDropEngine.attachLibraryDraggable(card, exercise);
      }
    });

    list.querySelectorAll('.btn-add-quick').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(e.currentTarget.dataset.id, 10);
        const exercise = this.state.exercises.find(e => e.id === id);
        if (exercise) {
          this.addExerciseToRoutine(exercise);
          this.showToast(`+ ${exercise.name}`, 'info');
        }
      });
    });
  },

  getMuscleBadgeClass(muscleGroup) {
    const m = (muscleGroup || '').toLowerCase();
    if (m.includes('pecho')) return 'badge-pecho';
    if (m.includes('espalda')) return 'badge-espalda';
    if (m.includes('pierna') || m.includes('glúteo')) return 'badge-piernas';
    if (m.includes('hombro')) return 'badge-hombros';
    if (m.includes('bícep')) return 'badge-biceps';
    if (m.includes('trícep')) return 'badge-triceps';
    if (m.includes('core') || m.includes('abdomen')) return 'badge-core';
    if (m.includes('cardio') || m.includes('funcional')) return 'badge-cardio';
    return 'badge-indigo';
  },

  // ==================== GESTIÓN DE LA RUTINA EN PANTALLA ====================
  addExerciseToRoutine(exercise) {
    const newItem = {
      id: Date.now() + Math.random(),
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      muscle_group: exercise.muscle_group,
      equipment: exercise.equipment,
      sets: exercise.default_sets || 4,
      reps: exercise.default_reps || '10-12',
      weight: exercise.default_weight || 0,
      rest_seconds: parseInt(exercise.default_rest) || 90,
      notes: ''
    };

    this.state.routineItems.push(newItem);
    this.renderRoutineBoard();
    this.calculateRoutineStats();
  },

  renderRoutineBoard() {
    const dropZone = document.getElementById('routine-drop-zone');
    if (!dropZone) return;

    // Actualizar inputs de título y día
    const titleInput = document.getElementById('routine-title-input');
    const dayInput = document.getElementById('routine-day-input');
    if (titleInput && titleInput.value !== this.state.activeRoutineName) {
      titleInput.value = this.state.activeRoutineName;
    }
    if (dayInput && dayInput.value !== this.state.activeDayTag) {
      dayInput.value = this.state.activeDayTag;
    }

    if (this.state.routineItems.length === 0) {
      dropZone.innerHTML = `
        <div class="drop-empty-prompt">
          <div class="empty-icon-circle">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 5v14M18 5v14M2 9h20M2 15h20"></path>
            </svg>
          </div>
          <h4>Arrastra ejercicios aquí para armar la rutina</h4>
          <p>Toma cualquier ejercicio de la biblioteca de la izquierda y suéltalo en este tablero, o usa el botón <strong>"+"</strong> rápido.</p>
        </div>
      `;
      return;
    }

    dropZone.innerHTML = this.state.routineItems.map((item, idx) => {
      const muscleClass = this.getMuscleBadgeClass(item.muscle_group);
      return `
        <div class="routine-item-card" data-index="${idx}">
          <div class="item-card-header">
            <div class="item-order-box">
              <span class="item-reorder-handle" title="Arrastrar para cambiar orden">⋮⋮</span>
              <span class="item-index-badge">${idx + 1}</span>
            </div>
            <div class="item-name-info">
              <span class="item-title">${item.exercise_name}</span>
              <span class="badge ${muscleClass}">${item.muscle_group}</span>
              <span class="badge badge-neutral">⚙️ ${item.equipment || 'Libre'}</span>
            </div>
            <div class="item-card-actions">
              <button type="button" class="btn-danger-ghost btn-item-delete" data-index="${idx}" title="Eliminar de rutina">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                </svg>
              </button>
            </div>
          </div>

          <div class="item-inputs-grid">
            <!-- Series (Sets) -->
            <div class="input-field-group">
              <label>Series</label>
              <div class="field-stepper-box">
                <button type="button" class="field-stepper-btn btn-step-series" data-index="${idx}" data-delta="-1">-</button>
                <input type="number" class="input-item-sets" data-index="${idx}" value="${item.sets}" min="1" max="20">
                <button type="button" class="field-stepper-btn btn-step-series" data-index="${idx}" data-delta="1">+</button>
              </div>
            </div>

            <!-- Repeticiones (Reps) -->
            <div class="input-field-group">
              <label>Repeticiones</label>
              <div class="field-stepper-box">
                <input type="text" class="input-item-reps" data-index="${idx}" value="${item.reps}" placeholder="Ej: 10-12">
              </div>
            </div>

            <!-- Peso (Weight) -->
            <div class="input-field-group">
              <label>Peso sugerido</label>
              <div class="field-stepper-box">
                <button type="button" class="field-stepper-btn btn-step-weight" data-index="${idx}" data-delta="-2.5">-</button>
                <input type="number" step="0.5" class="input-item-weight" data-index="${idx}" value="${item.weight}">
                <span class="unit">kg</span>
                <button type="button" class="field-stepper-btn btn-step-weight" data-index="${idx}" data-delta="2.5">+</button>
              </div>
            </div>

            <!-- Descanso (Rest) -->
            <div class="input-field-group">
              <label>Descanso</label>
              <div class="field-stepper-box">
                <button type="button" class="field-stepper-btn btn-step-rest" data-index="${idx}" data-delta="-15">-</button>
                <input type="number" step="15" class="input-item-rest" data-index="${idx}" value="${item.rest_seconds || 90}">
                <span class="unit">seg</span>
                <button type="button" class="field-stepper-btn btn-step-rest" data-index="${idx}" data-delta="15">+</button>
              </div>
            </div>
          </div>

          <div class="item-notes-row">
            <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700;">📝 NOTA:</span>
            <input type="text" class="input-item-notes" data-index="${idx}" value="${item.notes || ''}" placeholder="Ej: 2 series pesadas + drop set al fallo, técnica estricta...">
          </div>
        </div>
      `;
    }).join('');

    // Adjuntar interactividad a los ítems del tablero
    dropZone.querySelectorAll('.routine-item-card').forEach((card, idx) => {
      window.DragDropEngine.attachRoutineReorderable(card, idx);
    });

    // Inputs y Steppers
    dropZone.querySelectorAll('.input-item-sets').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const i = parseInt(e.target.dataset.index, 10);
        this.state.routineItems[i].sets = parseInt(e.target.value, 10) || 1;
        this.calculateRoutineStats();
      });
    });

    dropZone.querySelectorAll('.btn-step-series').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const i = parseInt(e.currentTarget.dataset.index, 10);
        const delta = parseInt(e.currentTarget.dataset.delta, 10);
        const current = parseInt(this.state.routineItems[i].sets, 10) || 1;
        this.state.routineItems[i].sets = Math.max(1, current + delta);
        this.renderRoutineBoard();
        this.calculateRoutineStats();
      });
    });

    dropZone.querySelectorAll('.input-item-reps').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const i = parseInt(e.target.dataset.index, 10);
        this.state.routineItems[i].reps = e.target.value.trim();
        this.calculateRoutineStats();
      });
    });

    dropZone.querySelectorAll('.input-item-weight').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const i = parseInt(e.target.dataset.index, 10);
        this.state.routineItems[i].weight = parseFloat(e.target.value) || 0;
        this.calculateRoutineStats();
      });
    });

    dropZone.querySelectorAll('.btn-step-weight').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const i = parseInt(e.currentTarget.dataset.index, 10);
        const delta = parseFloat(e.currentTarget.dataset.delta);
        const current = parseFloat(this.state.routineItems[i].weight) || 0;
        this.state.routineItems[i].weight = Math.max(0, current + delta);
        this.renderRoutineBoard();
        this.calculateRoutineStats();
      });
    });

    dropZone.querySelectorAll('.input-item-rest').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const i = parseInt(e.target.dataset.index, 10);
        this.state.routineItems[i].rest_seconds = parseInt(e.target.value, 10) || 60;
      });
    });

    dropZone.querySelectorAll('.btn-step-rest').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const i = parseInt(e.currentTarget.dataset.index, 10);
        const delta = parseInt(e.currentTarget.dataset.delta, 10);
        const current = parseInt(this.state.routineItems[i].rest_seconds, 10) || 60;
        this.state.routineItems[i].rest_seconds = Math.max(15, current + delta);
        this.renderRoutineBoard();
      });
    });

    dropZone.querySelectorAll('.input-item-notes').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const i = parseInt(e.target.dataset.index, 10);
        this.state.routineItems[i].notes = e.target.value;
      });
    });

    dropZone.querySelectorAll('.btn-item-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const i = parseInt(e.currentTarget.dataset.index, 10);
        const removed = this.state.routineItems.splice(i, 1);
        this.renderRoutineBoard();
        this.calculateRoutineStats();
        if (removed && removed[0]) {
          this.showToast(`Eliminado: ${removed[0].exercise_name}`, 'info');
        }
      });
    });
  },

  // Calcula estadísticas vivas de la rutina (Series, Volumen de carga, Músculos)
  calculateRoutineStats() {
    const items = this.state.routineItems;
    let totalSets = 0;
    let estimatedVolume = 0;
    const muscleSet = new Set();

    items.forEach(item => {
      const sets = parseInt(item.sets, 10) || 0;
      totalSets += sets;
      if (item.muscle_group) muscleSet.add(item.muscle_group);

      // Calcular peso por serie estimada
      const weight = parseFloat(item.weight) || 0;
      // Extraer número de reps si es un rango ej: '10-12' -> 10
      let repsNum = 10;
      if (typeof item.reps === 'string') {
        const match = item.reps.match(/\d+/);
        if (match) repsNum = parseInt(match[0], 10);
      } else if (typeof item.reps === 'number') {
        repsNum = item.reps;
      }
      estimatedVolume += sets * repsNum * weight;
    });

    const statExercises = document.getElementById('stat-total-exercises');
    const statSets = document.getElementById('stat-total-sets');
    const statVolume = document.getElementById('stat-total-volume');
    const statMuscles = document.getElementById('stat-muscles-count');

    if (statExercises) statExercises.textContent = items.length;
    if (statSets) statSets.textContent = totalSets;
    if (statVolume) statVolume.textContent = Math.round(estimatedVolume).toLocaleString('es-ES') + ' kg';
    if (statMuscles) statMuscles.textContent = muscleSet.size + ' grupos';
  },

  setLoadedRoutine(routineData) {
    this.state.activeRoutineId = routineData.id;
    this.state.activeRoutineName = routineData.name;
    this.state.activeDayTag = routineData.day_tag || 'General';
    this.state.activeRoutineNotes = routineData.notes || '';
    this.state.routineItems = (routineData.items || []).map(it => ({
      ...it,
      id: it.id || Date.now() + Math.random()
    }));
    this.updateRoutinesDropdown();
    this.renderRoutineBoard();
    this.calculateRoutineStats();
  },

  async loadRoutine(routineId) {
    if (!routineId) return;
    try {
      const res = await fetch(`/api/routines/${routineId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      this.setLoadedRoutine(data.routine);
      this.showToast(`Rutina cargada: ${data.routine.name}`, 'info');
    } catch (e) {
      console.error(e);
      this.showToast('Error al cargar la rutina', 'error');
    }
  },

  createNewRoutineDraft() {
    this.state.activeRoutineId = null;
    this.state.activeRoutineName = 'Día 1: Nueva Rutina';
    this.state.activeDayTag = 'Lunes';
    this.state.activeRoutineNotes = '';
    this.state.routineItems = [];
    this.renderRoutineBoard();
    this.calculateRoutineStats();
  },

  async saveRoutine() {
    if (!this.state.activeStudentId) {
      this.showToast('Por favor selecciona un alumno', 'error');
      return;
    }

    const titleInput = document.getElementById('routine-title-input');
    const dayInput = document.getElementById('routine-day-input');
    const name = titleInput ? titleInput.value.trim() : this.state.activeRoutineName;
    const dayTag = dayInput ? dayInput.value.trim() : this.state.activeDayTag;

    if (!name) {
      this.showToast('Escribe un nombre para la rutina', 'error');
      return;
    }

    if (this.state.routineItems.length === 0) {
      this.showToast('Agrega al menos un ejercicio a la rutina', 'error');
      return;
    }

    const payload = {
      student_id: this.state.activeStudentId,
      routine_id: this.state.activeRoutineId,
      name: name,
      day_tag: dayTag,
      notes: this.state.activeRoutineNotes,
      items: this.state.routineItems
    };

    try {
      const res = await fetch('/api/routines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      this.state.activeRoutineId = data.routine.id;
      this.state.activeRoutineName = data.routine.name;
      this.state.activeDayTag = data.routine.day_tag;
      await this.updateRoutinesDropdown();
      this.showToast('🔥 ¡Rutina guardada con éxito!', 'success');
      
      // Actualizar vista de alumnos si está en caché
      this.reloadStudents();
    } catch (err) {
      console.error(err);
      this.showToast('Error al guardar rutina: ' + err.message, 'error');
    }
  },

  async deleteCurrentRoutine() {
    if (!this.state.activeRoutineId) {
      this.createNewRoutineDraft();
      this.showToast('Borrador limpiado', 'info');
      return;
    }

    if (!confirm(`¿Eliminar la rutina "${this.state.activeRoutineName}"?`)) return;

    try {
      const res = await fetch(`/api/routines/${this.state.activeRoutineId}?student_id=${this.state.activeStudentId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      this.showToast('Rutina eliminada', 'info');
      this.createNewRoutineDraft();
      await this.updateRoutinesDropdown();
      this.reloadStudents();
    } catch (e) {
      this.showToast('Error al eliminar rutina', 'error');
    }
  },

  // ==================== EXPORTACIÓN WHATSAPP Y PRINT ====================
  generateWhatsAppText() {
    const student = this.state.students.find(s => s.id == this.state.activeStudentId);
    const studentName = student ? student.name : 'Alumno';
    const routineName = this.state.activeRoutineName;
    const dayTag = this.state.activeDayTag;

    let text = `⚡ *TRAINING - TU RUTINA PERSONALIZADA* ⚡\n`;
    text += `👤 *Alumno:* ${studentName}\n`;
    text += `📋 *Rutina:* ${routineName} (${dayTag})\n`;
    text += `🎯 *Objetivo:* ${student ? student.goal : 'Entrenamiento'}\n`;
    text += `--------------------------------------\n\n`;

    this.state.routineItems.forEach((item, idx) => {
      text += `${idx + 1}️⃣ *${item.exercise_name}*\n`;
      text += `   • *Series:* ${item.sets}  |  *Reps:* ${item.reps}\n`;
      if (item.weight > 0) {
        text += `   • *Peso sugerido:* ${item.weight} kg\n`;
      }
      text += `   • *Descanso:* ${item.rest_seconds || 90} seg\n`;
      if (item.notes && item.notes.trim()) {
        text += `   • *Nota:* ${item.notes.trim()}\n`;
      }
      text += `\n`;
    });

    text += `💪 *¡A darlo todo hoy en el entrenamiento!* 🚀\n`;
    return text;
  },

  copyRoutineToWhatsApp() {
    if (this.state.routineItems.length === 0) {
      this.showToast('La rutina está vacía', 'error');
      return;
    }
    const text = this.generateWhatsAppText();
    navigator.clipboard.writeText(text).then(() => {
      this.showToast('📲 ¡Rutina copiada con formato para WhatsApp!', 'success');
    }).catch(() => {
      // Fallback
      prompt('Copia el texto para WhatsApp:', text);
    });
  },

  // ==================== PLANIFICACIÓN Y MACROCICLOS (3, 6, 12 MESES) ====================
  async loadStudentPlans(studentId) {
    if (!studentId) return;
    try {
      const res = await fetch(`/api/students/${studentId}/plans`);
      const data = await res.json();
      if (data.success) {
        this.state.studentPlans = data.plans || [];
        if (this.state.studentPlans.length > 0) {
          if (!this.state.studentPlans.some(p => p.id === this.state.activePlanId)) {
            this.state.activePlanId = this.state.studentPlans[0].id;
          }
        } else {
          this.state.activePlanId = null;
        }
      }
    } catch (e) {
      console.error("Error al cargar planes:", e);
    }
  },

  async loadCalendarEvents() {
    if (!this.state.activeStudentId) return;
    try {
      const res = await fetch(`/api/students/${this.state.activeStudentId}/calendar?year=${this.state.calendarYear}&month=${this.state.calendarMonth}`);
      const data = await res.json();
      if (data.success) {
        this.state.calendarEvents = data.events || [];
      }
    } catch (e) {
      console.error("Error al cargar calendario:", e);
    }
  },

  renderPlannerView() {
    this.renderPlanSelector();
    this.renderPlanBanner();
    this.renderCalendarGrid();
    this.renderWeeklyPeriodizationGrid();
  },

  renderPlanSelector() {
    const selector = document.getElementById('plan-select');
    if (!selector) return;

    if (this.state.studentPlans.length === 0) {
      selector.innerHTML = `<option value="">(Sin plan asignado aún)</option>`;
    } else {
      selector.innerHTML = this.state.studentPlans.map(p => `
        <option value="${p.id}" ${p.id == this.state.activePlanId ? 'selected' : ''}>
          ${p.name} (${p.duration_months}m)
        </option>
      `).join('');
    }
  },

  renderPlanBanner() {
    const banner = document.getElementById('plan-banner');
    if (!banner) return;

    const activePlan = this.state.studentPlans.find(p => p.id == this.state.activePlanId);
    const titleEl = document.getElementById('plan-banner-name');
    const durationEl = document.getElementById('plan-banner-duration');
    const descEl = document.getElementById('plan-banner-desc');
    const percentEl = document.getElementById('plan-progress-percent');
    const barEl = document.getElementById('plan-progress-bar');
    const countEl = document.getElementById('plan-progress-count');

    if (!activePlan) {
      if (titleEl) titleEl.textContent = 'Sin plan de entrenamiento activo';
      if (durationEl) durationEl.textContent = '0 MESES';
      if (descEl) descEl.textContent = 'Crea un plan de 1, 3, 6 o 12 meses para periodizar y proyectar automáticamente las rutinas del alumno.';
      if (percentEl) percentEl.textContent = '0%';
      if (barEl) barEl.style.width = '0%';
      if (countEl) countEl.textContent = '0 sesiones';
      return;
    }

    if (titleEl) titleEl.textContent = `📅 ${activePlan.name}`;
    if (durationEl) durationEl.textContent = `${activePlan.duration_months} MESES`;
    if (descEl) descEl.textContent = `🎯 Objetivo: ${activePlan.goal || 'Entrenamiento general'} • Período: ${activePlan.start_date} al ${activePlan.end_date}`;

    const totalDays = activePlan.total_scheduled_days || 0;
    const completedDays = activePlan.completed_days || 0;
    const percent = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

    if (percentEl) percentEl.textContent = `${percent}%`;
    if (barEl) barEl.style.width = `${percent}%`;
    if (countEl) countEl.textContent = `${completedDays} de ${totalDays} sesiones completadas`;
  },

  renderCalendarGrid() {
    const grid = document.getElementById('calendar-days-grid');
    const monthNameEl = document.getElementById('calendar-current-month-name');
    if (!grid) return;

    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    if (monthNameEl) {
      monthNameEl.textContent = `${monthNames[this.state.calendarMonth - 1]} ${this.state.calendarYear}`;
    }

    const year = this.state.calendarYear;
    const month = this.state.calendarMonth; // 1-12
    const firstDayIndex = (new Date(year, month - 1, 1).getDay() + 6) % 7; // Lunes = 0, Dom = 6
    const totalDaysInMonth = new Date(year, month, 0).getDate();
    const prevMonthDays = new Date(year, month - 1, 0).getDate();

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    let html = '';

    // Celdas de relleno del mes anterior
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      html += `
        <div class="calendar-day-cell other-month">
          <div class="calendar-day-number">${dayNum}</div>
        </div>
      `;
    }

    // Celdas del mes actual
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;

      // Buscar eventos para este día
      const eventsForDay = this.state.calendarEvents.filter(e => e.date === dateStr);

      let eventsHtml = '';
      if (eventsForDay.length > 0) {
        eventsHtml = eventsForDay.map(ev => {
          let statusClass = '';
          let statusDotColor = 'var(--apple-400)';
          let statusText = 'Programada';

          if (ev.status === 'completed') {
            statusClass = 'status-completed';
            statusText = 'Completado ✅';
            statusDotColor = '#4ade80';
          } else if (ev.status === 'rest') {
            statusClass = 'status-rest';
            statusText = 'Descanso 💤';
            statusDotColor = '#94a3b8';
          } else if (ev.status === 'skipped') {
            statusClass = 'status-rest';
            statusText = 'Falta ❌';
            statusDotColor = '#ef4444';
          }

          return `
            <div class="calendar-event-card ${statusClass}" data-event-id="${ev.id}">
              <span class="calendar-event-title">${ev.routine_name}</span>
              <div class="calendar-event-meta">
                <span>${statusText}</span>
                <span class="calendar-event-status-dot" style="background: ${statusDotColor};"></span>
              </div>
            </div>
          `;
        }).join('');
      }

      html += `
        <div class="calendar-day-cell ${isToday ? 'is-today' : ''}" data-date="${dateStr}">
          <div class="calendar-day-number">
            <span>${day}</span>
            ${isToday ? '<span class="badge badge-apple" style="font-size: 0.65rem; padding: 0.1rem 0.4rem;">Hoy</span>' : ''}
          </div>
          ${eventsHtml}
        </div>
      `;
    }

    // Rellenar días finales
    const totalRendered = firstDayIndex + totalDaysInMonth;
    const remaining = (7 - (totalRendered % 7)) % 7;
    for (let j = 1; j <= remaining; j++) {
      html += `
        <div class="calendar-day-cell other-month">
          <div class="calendar-day-number">${j}</div>
        </div>
      `;
    }

    grid.innerHTML = html;

    // Conectar clics en los días del calendario
    grid.querySelectorAll('.calendar-day-cell:not(.other-month)').forEach(cell => {
      cell.addEventListener('click', (e) => {
        const dateStr = cell.dataset.date;
        const eventCard = e.target.closest('.calendar-event-card');
        if (eventCard) {
          const eventId = parseInt(eventCard.dataset.eventId, 10);
          const eventObj = this.state.calendarEvents.find(ev => ev.id === eventId);
          this.openCalendarEventModal(eventObj, dateStr);
        } else {
          const existingEvent = this.state.calendarEvents.find(ev => ev.date === dateStr);
          this.openCalendarEventModal(existingEvent, dateStr);
        }
      });
    });
  },

  async changeCalendarMonth(delta) {
    this.state.calendarMonth += delta;
    if (this.state.calendarMonth > 12) {
      this.state.calendarMonth = 1;
      this.state.calendarYear += 1;
    } else if (this.state.calendarMonth < 1) {
      this.state.calendarMonth = 12;
      this.state.calendarYear -= 1;
    }
    await this.loadCalendarEvents();
    this.renderCalendarGrid();
  },

  async renderWeeklyPeriodizationGrid() {
    const grid = document.getElementById('weekly-schedule-grid');
    if (!grid) return;

    const days = [
      { key: "0", name: "Lunes" },
      { key: "1", name: "Martes" },
      { key: "2", name: "Miércoles" },
      { key: "3", name: "Jueves" },
      { key: "4", name: "Viernes" },
      { key: "5", name: "Sábado" },
      { key: "6", name: "Domingo" }
    ];

    const activePlan = this.state.studentPlans.find(p => p.id == this.state.activePlanId);
    const weeklySched = (activePlan && activePlan.weekly_schedule) ? activePlan.weekly_schedule : {};

    let routines = [];
    if (this.state.activeStudentId) {
      try {
        const res = await fetch(`/api/students/${this.state.activeStudentId}/routines`);
        const data = await res.json();
        if (data.success) routines = data.routines || [];
      } catch (e) {
        console.error(e);
      }
    }

    grid.innerHTML = days.map(d => {
      const currentVal = weeklySched[d.key];
      let selectedRoutineId = "";
      let selectedText = "";
      if (typeof currentVal === 'object' && currentVal !== null) {
        selectedRoutineId = currentVal.routine_id || "";
        selectedText = currentVal.routine_name || "";
      } else if (typeof currentVal === 'string') {
        selectedText = currentVal;
      }

      return `
        <div class="weekday-config-card">
          <div class="weekday-header">
            <span class="weekday-name">🗓️ ${d.name}</span>
            <span class="badge badge-apple" style="font-size: 0.65rem;">Día ${parseInt(d.key) + 1}</span>
          </div>

          <div>
            <label style="font-size: 0.725rem; font-weight: 700; color: #a5b4fc; text-transform: uppercase;">Rutina o Actividad</label>
            <select class="weekday-select weekly-day-input" data-day="${d.key}">
              <option value="Descanso Total" ${selectedText.includes('Descanso Total') ? 'selected' : ''}>💤 Descanso Total</option>
              <option value="Descanso Activo / Movilidad" ${selectedText.includes('Movilidad') ? 'selected' : ''}>🧘 Descanso Activo / Movilidad</option>
              <option value="Cardio HIIT / Abdominales" ${selectedText.includes('Cardio') ? 'selected' : ''}>🏃 Cardio HIIT / Core</option>
              <optgroup label="-- Rutinas del Alumno --">
                ${routines.map(r => `
                  <option value="${r.id}" ${selectedRoutineId == r.id ? 'selected' : ''}>
                    ⚡ ${r.name}
                  </option>
                `).join('')}
              </optgroup>
            </select>
          </div>
        </div>
      `;
    }).join('');
  },

  async saveWeeklyScheduleAndProject() {
    if (!this.state.activePlanId) {
      this.showToast('Primero crea un plan de 3 o 6 meses para este alumno', 'error');
      return;
    }

    const activePlan = this.state.studentPlans.find(p => p.id == this.state.activePlanId);
    if (!activePlan) return;

    const weeklySchedule = {};
    document.querySelectorAll('.weekly-day-input').forEach(sel => {
      const dayKey = sel.dataset.day;
      const val = sel.value;
      const numId = parseInt(val, 10);
      if (!isNaN(numId)) {
        const text = sel.options[sel.selectedIndex].text.replace('⚡ ', '').trim();
        weeklySchedule[dayKey] = { routine_id: numId, routine_name: text };
      } else {
        weeklySchedule[dayKey] = val;
      }
    });

    try {
      const res = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: activePlan.id,
          student_id: activePlan.student_id,
          name: activePlan.name,
          duration_months: activePlan.duration_months,
          start_date: activePlan.start_date,
          goal: activePlan.goal,
          weekly_schedule: weeklySchedule,
          notes: activePlan.notes
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      await this.loadStudentPlans(this.state.activeStudentId);
      await this.loadCalendarEvents();
      this.renderPlannerView();
      this.showToast(`🔥 ¡Periodización proyectada a los ${activePlan.duration_months} meses del calendario!`, 'success');
    } catch (e) {
      this.showToast('Error al guardar periodización: ' + e.message, 'error');
    }
  },

  async openNewPlanModal() {
    const modal = document.getElementById('plan-modal');
    const form = document.getElementById('plan-form');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('plan-modal-id').value = '';
    document.getElementById('plan-modal-student').value = this.state.activeStudentId || '';
    document.getElementById('plan-modal-start-date').value = new Date().toISOString().split('T')[0];

    const student = this.state.students.find(s => s.id == this.state.activeStudentId);
    if (student) {
      document.getElementById('plan-modal-goal').value = student.goal;
      document.getElementById('plan-modal-name').value = `Plan Periodización 3 Meses (${student.name.split(' ')[0]})`;
    }

    let routines = [];
    if (this.state.activeStudentId) {
      try {
        const res = await fetch(`/api/students/${this.state.activeStudentId}/routines`);
        const data = await res.json();
        if (data.success) routines = data.routines || [];
      } catch (e) {
        console.error(e);
      }
    }

    for (let i = 0; i <= 6; i++) {
      const daySel = document.getElementById(`plan-day-${i}`);
      if (daySel) {
        daySel.innerHTML = `
          <option value="Descanso Total">💤 Descanso Total</option>
          <option value="Descanso Activo / Movilidad">🧘 Descanso Activo / Movilidad</option>
          <option value="Cardio HIIT / Abdominales">🏃 Cardio HIIT / Core</option>
          <optgroup label="-- Rutinas del Alumno --">
            ${routines.map(r => `<option value="${r.id}">⚡ ${r.name}</option>`).join('')}
          </optgroup>
        `;
        if (i === 0 && routines[0]) daySel.value = routines[0].id;
        if (i === 1 && routines[1]) daySel.value = routines[1].id;
        if (i === 2) daySel.value = "Descanso Activo / Movilidad";
        if (i === 3 && routines[0]) daySel.value = routines[0].id;
        if (i === 4 && routines[1]) daySel.value = routines[1].id;
      }
    }

    modal.classList.add('active');
  },

  async savePlanFromModal() {
    const studentId = parseInt(document.getElementById('plan-modal-student').value, 10);
    const name = document.getElementById('plan-modal-name').value.trim();
    const duration = parseInt(document.getElementById('plan-modal-duration').value, 10) || 3;
    const startDate = document.getElementById('plan-modal-start-date').value;
    const goal = document.getElementById('plan-modal-goal').value.trim();
    const notes = document.getElementById('plan-modal-notes').value.trim();

    const weeklySchedule = {};
    for (let i = 0; i <= 6; i++) {
      const sel = document.getElementById(`plan-day-${i}`);
      if (sel) {
        const val = sel.value;
        const numId = parseInt(val, 10);
        if (!isNaN(numId)) {
          const text = sel.options[sel.selectedIndex].text.replace('⚡ ', '').trim();
          weeklySchedule[String(i)] = { routine_id: numId, routine_name: text };
        } else {
          weeklySchedule[String(i)] = val;
        }
      }
    }

    try {
      const res = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          name: name,
          duration_months: duration,
          start_date: startDate,
          goal: goal,
          weekly_schedule: weeklySchedule,
          notes: notes
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      document.getElementById('plan-modal').classList.remove('active');
      this.state.activeStudentId = studentId;
      await this.loadStudentPlans(studentId);
      this.state.activePlanId = data.plan_id;
      await this.loadCalendarEvents();
      this.renderPlannerView();
      this.renderNavCounts();
      this.showToast(`🔥 ¡Plan creado y calendario de ${duration} meses generado con éxito!`, 'success');
    } catch (e) {
      this.showToast('Error al crear plan: ' + e.message, 'error');
    }
  },

  async deleteActivePlan() {
    if (!this.state.activePlanId) {
      this.showToast('No hay plan seleccionado para eliminar', 'error');
      return;
    }
    const plan = this.state.studentPlans.find(p => p.id == this.state.activePlanId);
    if (!confirm(`¿Eliminar el plan "${plan ? plan.name : ''}" y todos sus eventos del calendario?`)) return;

    try {
      const res = await fetch(`/api/plans/${this.state.activePlanId}?student_id=${this.state.activeStudentId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      await this.loadStudentPlans(this.state.activeStudentId);
      await this.loadCalendarEvents();
      this.renderPlannerView();
      this.renderNavCounts();
      this.showToast('Plan eliminado', 'info');
    } catch (e) {
      this.showToast('Error al eliminar plan', 'error');
    }
  },

  copyPlanToWhatsApp() {
    const activePlan = this.state.studentPlans.find(p => p.id == this.state.activePlanId);
    if (!activePlan) {
      this.showToast('No hay plan activo seleccionado', 'error');
      return;
    }
    const student = this.state.students.find(s => s.id == this.state.activeStudentId);
    const studentName = student ? student.name : 'Alumno';

    const days = [
      { key: "0", name: "Lunes" },
      { key: "1", name: "Martes" },
      { key: "2", name: "Miércoles" },
      { key: "3", name: "Jueves" },
      { key: "4", name: "Viernes" },
      { key: "5", name: "Sábado" },
      { key: "6", name: "Domingo" }
    ];

    let text = `🗓️ *TRAINING - PLAN DE PERIODIZACIÓN* 🗓️\n`;
    text += `👤 *Alumno:* ${studentName}\n`;
    text += `🎯 *Objetivo:* ${activePlan.goal || (student ? student.goal : 'Entrenamiento')}\n`;
    text += `⏳ *Plan:* ${activePlan.name} (${activePlan.duration_months} Meses)\n`;
    text += `📅 *Fecha de Inicio:* ${activePlan.start_date || 'Inmediato'}\n`;
    text += `--------------------------------------\n\n`;
    text += `📋 *DISTRIBUCIÓN SEMANAL:* \n`;

    const sched = activePlan.weekly_schedule || {};
    days.forEach(d => {
      const item = sched[d.key];
      let valText = 'Descanso Total';
      if (typeof item === 'object' && item !== null) {
        valText = item.routine_name || 'Rutina programada';
      } else if (typeof item === 'string') {
        valText = item;
      }
      text += `• *${d.name}:* ${valText}\n`;
    });

    if (activePlan.notes && activePlan.notes.trim()) {
      text += `\n📝 *Indicaciones del Instructor:* ${activePlan.notes.trim()}\n`;
    }

    text += `\n🔥 *¡La consistencia supera al talento! A entrenar duro.* 🚀\n`;

    navigator.clipboard.writeText(text).then(() => {
      this.showToast('📲 ¡Plan copiado con formato para WhatsApp!', 'success');
    }).catch(() => {
      prompt('Copia el plan para WhatsApp:', text);
    });
  },

  async openCalendarEventModal(event, dateStr) {
    const modal = document.getElementById('calendar-event-modal');
    if (!modal) return;

    document.getElementById('cal-modal-event-id').value = event ? event.id : '';
    document.getElementById('cal-modal-date').value = event ? event.date : dateStr;
    document.getElementById('cal-modal-date-display').textContent = event ? event.date : dateStr;
    document.getElementById('cal-modal-status').value = event ? event.status : 'scheduled';
    document.getElementById('cal-modal-notes').value = event ? (event.notes || '') : '';

    const btnDelete = document.getElementById('btn-delete-cal-event');
    if (btnDelete) btnDelete.style.display = event ? 'inline-block' : 'none';

    const routineSelect = document.getElementById('cal-modal-routine');
    let routines = [];
    if (this.state.activeStudentId) {
      try {
        const res = await fetch(`/api/students/${this.state.activeStudentId}/routines`);
        const data = await res.json();
        if (data.success) routines = data.routines || [];
      } catch (e) {
        console.error(e);
      }
    }

    routineSelect.innerHTML = `
      <option value="Descanso Total" ${event && event.routine_name.includes('Descanso Total') ? 'selected' : ''}>💤 Descanso Total</option>
      <option value="Descanso Activo / Movilidad" ${event && event.routine_name.includes('Movilidad') ? 'selected' : ''}>🧘 Descanso Activo / Movilidad</option>
      <option value="Cardio HIIT / Abdominales" ${event && event.routine_name.includes('Cardio') ? 'selected' : ''}>🏃 Cardio HIIT / Core</option>
      <optgroup label="-- Rutinas del Alumno --">
        ${routines.map(r => `
          <option value="${r.id}" ${event && event.routine_id == r.id ? 'selected' : ''}>
            ⚡ ${r.name}
          </option>
        `).join('')}
      </optgroup>
    `;

    modal.classList.add('active');
  },

  async saveCalendarEventFromModal() {
    const eventId = document.getElementById('cal-modal-event-id').value;
    const dateStr = document.getElementById('cal-modal-date').value;
    const routineSelect = document.getElementById('cal-modal-routine');
    const status = document.getElementById('cal-modal-status').value;
    const notes = document.getElementById('cal-modal-notes').value.trim();

    const val = routineSelect.value;
    const numId = parseInt(val, 10);
    const routineName = routineSelect.options[routineSelect.selectedIndex].text.replace('⚡ ', '').trim();

    try {
      const res = await fetch('/api/calendar/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: this.state.activeStudentId,
          plan_id: this.state.activePlanId,
          date: dateStr,
          routine_id: !isNaN(numId) ? numId : null,
          routine_name: routineName,
          status: status,
          notes: notes
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      document.getElementById('calendar-event-modal').classList.remove('active');
      await this.loadCalendarEvents();
      await this.loadStudentPlans(this.state.activeStudentId);
      this.renderPlannerView();
      this.showToast('✅ Día de calendario actualizado', 'success');
    } catch (e) {
      this.showToast('Error al guardar evento: ' + e.message, 'error');
    }
  },

  async deleteCalendarEventFromModal() {
    const eventId = document.getElementById('cal-modal-event-id').value;
    if (!eventId) return;

    try {
      const res = await fetch(`/api/calendar/event/${eventId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      document.getElementById('calendar-event-modal').classList.remove('active');
      await this.loadCalendarEvents();
      await this.loadStudentPlans(this.state.activeStudentId);
      this.renderPlannerView();
      this.showToast('Evento eliminado del calendario', 'info');
    } catch (e) {
      this.showToast('Error al eliminar evento', 'error');
    }
  },

  // ==================== ALUMNOS VIEW & CRUD ====================

  renderStudentsView() {
    const grid = document.getElementById('students-grid');
    if (!grid) return;

    if (this.state.students.length === 0) {
      grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem;">No tienes alumnos registrados aún.</div>`;
      return;
    }

    grid.innerHTML = this.state.students.map(s => {
      const initials = s.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
      return `
        <div class="student-card" data-id="${s.id}">
          <div class="student-card-header">
            <div class="student-avatar" style="background: ${s.avatar_color || '#4f46e5'};">
              ${initials}
            </div>
            <div class="student-info-main">
              <h3 class="student-name">${s.name}</h3>
              <p class="student-phone">${s.phone || 'Sin teléfono'} • ${s.level || 'Intermedio'}</p>
            </div>
          </div>

          <div class="student-goal-box">
            <span class="student-goal-label">Objetivo Principal</span>
            <span class="student-goal-value">🎯 ${s.goal}</span>
          </div>

          <div class="student-stats-row">
            <div class="student-mini-stat">
              <span class="student-mini-val">${s.weight || 0} kg</span>
              <span class="student-mini-label">Peso</span>
            </div>
            <div class="student-mini-stat">
              <span class="student-mini-val">${s.routine_count || 0}</span>
              <span class="student-mini-label">Rutinas</span>
            </div>
            <div class="student-mini-stat">
              <span class="student-mini-val">${s.log_count || 0}</span>
              <span class="student-mini-label">Sesiones</span>
            </div>
          </div>

          ${s.notes ? `<p style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">📝 "${s.notes}"</p>` : ''}

          <div class="student-card-actions">
            <button type="button" class="btn btn-primary btn-sm btn-select-student-routine" data-id="${s.id}" style="flex: 1;">
              ⚡ Armar Rutina
            </button>
            <button type="button" class="btn btn-secondary btn-sm btn-edit-student" data-id="${s.id}" title="Editar Alumno">
              ✏️
            </button>
            <button type="button" class="btn btn-danger-ghost btn-sm btn-delete-student" data-id="${s.id}" title="Eliminar Alumno">
              🗑️
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Listeners
    grid.querySelectorAll('.btn-select-student-routine').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = parseInt(e.currentTarget.dataset.id, 10);
        this.selectActiveStudent(id);
        this.switchTab('rutinas');
      });
    });

    grid.querySelectorAll('.btn-edit-student').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(e.currentTarget.dataset.id, 10);
        const student = this.state.students.find(s => s.id === id);
        if (student) this.openStudentModal(student);
      });
    });

    grid.querySelectorAll('.btn-delete-student').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = parseInt(e.currentTarget.dataset.id, 10);
        const student = this.state.students.find(s => s.id === id);
        if (confirm(`¿Eliminar al alumno "${student ? student.name : ''}" y todas sus rutinas asociadas?`)) {
          await this.deleteStudent(id);
        }
      });
    });
  },

  async selectActiveStudent(studentId) {
    this.state.activeStudentId = studentId;
    this.renderStudentSelectors();
    await this.updateRoutinesDropdown();
    await this.loadStudentPlans(studentId);
    await this.loadCalendarEvents();
    this.renderPlannerView();
    this.renderNavCounts();

    // Cargar la primera rutina del alumno
    try {
      const res = await fetch(`/api/students/${studentId}/routines`);
      const data = await res.json();
      if (data.success && data.routines.length > 0) {
        await this.loadRoutine(data.routines[0].id);
      } else {
        this.createNewRoutineDraft();
      }
    } catch (e) {
      console.error(e);
    }
  },


  async reloadStudents() {
    try {
      const res = await fetch('/api/students');
      const data = await res.json();
      if (data.success) {
        this.state.students = data.students;
        this.renderStudentSelectors();
        this.renderStudentsView();
        this.renderNavCounts();
      }
    } catch (e) {
      console.error(e);
    }
  },

  async deleteStudent(studentId) {
    try {
      const res = await fetch(`/api/students/${studentId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        this.state.students = data.students;
        if (this.state.activeStudentId == studentId) {
          this.state.activeStudentId = this.state.students.length > 0 ? this.state.students[0].id : null;
        }
        this.renderStudentSelectors();
        this.renderStudentsView();
        this.renderNavCounts();
        this.showToast('Alumno eliminado', 'info');
      }
    } catch (e) {
      this.showToast('Error al eliminar alumno', 'error');
    }
  },

  openStudentModal(student = null) {
    const modal = document.getElementById('student-modal');
    const form = document.getElementById('student-form');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('student-modal-title').textContent = student ? 'Editar Alumno' : 'Nuevo Alumno';
    document.getElementById('student-modal-id').value = student ? student.id : '';

    if (student) {
      document.getElementById('student-name-input').value = student.name || '';
      document.getElementById('student-goal-input').value = student.goal || '';
      document.getElementById('student-phone-input').value = student.phone || '';
      document.getElementById('student-email-input').value = student.email || '';
      document.getElementById('student-weight-input').value = student.weight || 70;
      document.getElementById('student-height-input').value = student.height || 175;
      document.getElementById('student-level-input').value = student.level || 'Intermedio';
      document.getElementById('student-notes-input').value = student.notes || '';
    }

    modal.classList.add('active');
  },

  // ==================== BIBLIOTECA VIEW (CATALOG) ====================
  renderCatalogView() {
    const grid = document.getElementById('catalog-grid');
    if (!grid) return;

    let filtered = this.state.exercises;
    if (this.state.currentFilter && this.state.currentFilter !== 'Todos') {
      filtered = filtered.filter(ex => ex.muscle_group.toLowerCase().includes(this.state.currentFilter.toLowerCase()));
    }

    grid.innerHTML = filtered.map(ex => {
      const muscleClass = this.getMuscleBadgeClass(ex.muscle_group);
      return `
        <div class="exercise-catalog-card">
          <div class="catalog-card-header">
            <div>
              <h4 class="catalog-card-name">${ex.name}</h4>
              <span class="badge ${muscleClass}" style="margin-top: 0.35rem;">${ex.muscle_group}</span>
              ${ex.secondary_muscle ? `<span style="font-size: 0.725rem; color: var(--text-muted); margin-left: 0.3rem;">• ${ex.secondary_muscle}</span>` : ''}
            </div>
            <span class="badge badge-neutral">⚙️ ${ex.equipment}</span>
          </div>

          <p class="catalog-card-desc">${ex.description || 'Sin descripción técnica adicional.'}</p>

          <div class="catalog-defaults-row">
            <span>Dificultad: <strong>${ex.difficulty}</strong></span>
            <span>Sugerido: <strong>${ex.default_sets} x ${ex.default_reps}</strong></span>
          </div>

          <button type="button" class="btn btn-secondary btn-sm btn-catalog-add" data-id="${ex.id}" style="margin-top: 0.25rem;">
            + Añadir a la rutina activa
          </button>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.btn-catalog-add').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(e.currentTarget.dataset.id, 10);
        const ex = this.state.exercises.find(item => item.id === id);
        if (ex) {
          this.addExerciseToRoutine(ex);
          this.showToast(`Añadido a rutina: ${ex.name}`, 'success');
        }
      });
    });
  },

  openExerciseModal() {
    const modal = document.getElementById('exercise-modal');
    if (modal) modal.classList.add('active');
  },

  // ==================== CONTROL Y LOGS (HISTORIAL) ====================
  renderLogsView() {
    const timeline = document.getElementById('logs-timeline');
    if (!timeline) return;

    if (this.state.recentLogs.length === 0) {
      timeline.innerHTML = `
        <div style="padding: 3rem; text-align: center; color: var(--text-muted); background: #ffffff; border-radius: var(--radius-lg); border: 1px solid var(--border-light);">
          <h4>No hay registros de entrenamientos aún</h4>
          <p style="font-size: 0.875rem; margin-top: 0.5rem;">Haz clic en <strong>"Registrar Sesión"</strong> para guardar lo que hizo un alumno hoy.</p>
        </div>
      `;
      return;
    }

    timeline.innerHTML = this.state.recentLogs.map(log => {
      let detailsHtml = '';
      if (log.details && log.details.length > 0) {
        detailsHtml = `
          <table class="log-details-table">
            <thead>
              <tr>
                <th>Ejercicio</th>
                <th>Series</th>
                <th>Reps</th>
                <th>Peso</th>
              </tr>
            </thead>
            <tbody>
              ${log.details.map(d => `
                <tr>
                  <td><strong>${d.exercise || d.name}</strong></td>
                  <td>${d.sets}</td>
                  <td>${d.reps}</td>
                  <td><span class="badge badge-apple">${d.weight}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }

      return `
        <div class="log-item-card">
          <div class="log-item-header">
            <div class="log-student-title">
              <span class="badge badge-indigo">📅 ${log.date}</span>
              <span class="log-student-name">${log.student_name}</span>
            </div>
            <div class="log-meta-pills">
              <span class="badge badge-neutral">⏱️ ${log.duration_minutes} min</span>
              <span class="badge badge-apple">🔥 RPE ${log.perceived_exertion}/10</span>
              <button type="button" class="btn-danger-ghost btn-sm btn-delete-log" data-id="${log.id}" title="Eliminar registro">✕</button>
            </div>
          </div>

          <div style="font-weight: 700; color: var(--indigo-900); font-size: 0.95rem;">
            🏋️ Rutina: ${log.routine_name}
          </div>

          ${log.notes ? `<p style="font-size: 0.85rem; color: var(--text-muted); background: var(--bg-surface-alt); padding: 0.5rem 0.75rem; border-radius: 6px;">📝 "${log.notes}"</p>` : ''}

          ${detailsHtml}
        </div>
      `;
    }).join('');

    timeline.querySelectorAll('.btn-delete-log').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = parseInt(e.currentTarget.dataset.id, 10);
        if (confirm('¿Eliminar este registro de sesión?')) {
          await this.deleteLog(id);
        }
      });
    });
  },

  async deleteLog(logId) {
    try {
      const res = await fetch(`/api/logs/${logId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        this.state.recentLogs = data.logs;
        this.renderLogsView();
        this.renderNavCounts();
        this.showToast('Registro eliminado', 'info');
      }
    } catch (e) {
      this.showToast('Error al eliminar registro', 'error');
    }
  },

  openLogSessionModal() {
    const modal = document.getElementById('log-session-modal');
    if (!modal) return;

    // Poblar alumnos en el modal
    const studentSelect = document.getElementById('log-student-select');
    if (studentSelect) {
      studentSelect.innerHTML = this.state.students.map(s => `
        <option value="${s.id}" ${s.id == this.state.activeStudentId ? 'selected' : ''}>${s.name}</option>
      `).join('');
    }

    // Fecha de hoy por defecto
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('log-date-input');
    if (dateInput) dateInput.value = today;

    // Nombre de rutina por defecto
    const routineInput = document.getElementById('log-routine-name-input');
    if (routineInput) routineInput.value = this.state.activeRoutineName;

    // Generar vista de ejercicios actuales para anotar pesos
    const itemsContainer = document.getElementById('log-items-container');
    if (itemsContainer) {
      if (this.state.routineItems.length > 0) {
        itemsContainer.innerHTML = this.state.routineItems.map((item, idx) => `
          <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; font-size: 0.85rem;">
            <span><strong>${item.exercise_name}</strong></span>
            <input type="number" class="form-control form-control-sm log-set-input" data-name="${item.exercise_name}" value="${item.sets}" placeholder="Sets">
            <input type="text" class="form-control form-control-sm log-rep-input" value="${item.reps}" placeholder="Reps">
            <input type="number" step="0.5" class="form-control form-control-sm log-weight-input" value="${item.weight}" placeholder="kg">
          </div>
        `).join('');
      } else {
        itemsContainer.innerHTML = `<p style="font-size: 0.8rem; color: var(--text-muted);">Sin ejercicios precargados. Puedes registrar el entrenamiento de todas formas.</p>`;
      }
    }

    modal.classList.add('active');
  },

  async saveWorkoutLog() {
    const studentSelect = document.getElementById('log-student-select');
    const routineInput = document.getElementById('log-routine-name-input');
    const dateInput = document.getElementById('log-date-input');
    const durationInput = document.getElementById('log-duration-input');
    const rpeInput = document.getElementById('log-rpe-input');
    const notesInput = document.getElementById('log-notes-input');

    const studentId = parseInt(studentSelect.value, 10);
    const routineName = routineInput.value.trim() || 'Entrenamiento del día';
    const logDate = dateInput.value;
    const duration = parseInt(durationInput.value, 10) || 50;
    const rpe = parseInt(rpeInput.value, 10) || 8;
    const notes = notesInput.value.trim();

    // Recoger ejercicios completados
    const details = [];
    const rows = document.querySelectorAll('#log-items-container > div');
    rows.forEach(row => {
      const name = row.querySelector('.log-set-input')?.dataset.name || 'Ejercicio';
      const sets = parseInt(row.querySelector('.log-set-input')?.value, 10) || 4;
      const reps = row.querySelector('.log-rep-input')?.value || '10';
      const weight = (row.querySelector('.log-weight-input')?.value || '0') + ' kg';
      details.push({ exercise: name, sets, reps, weight });
    });

    try {
      const res = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          routine_name: routineName,
          date: logDate,
          duration_minutes: duration,
          perceived_exertion: rpe,
          notes: notes,
          details: details
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      document.getElementById('log-session-modal').classList.remove('active');
      this.state.recentLogs = await (await fetch('/api/logs')).json().then(d => d.logs || []);
      this.renderLogsView();
      this.renderNavCounts();
      this.showToast('✅ ¡Sesión registrada en el control del alumno!', 'success');
    } catch (e) {
      this.showToast('Error al registrar sesión: ' + e.message, 'error');
    }
  },

  // ==================== CAMBIO DE PESTAÑAS ====================
  switchTab(tabName) {
    this.state.activeTab = tabName;
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.toggle('active', sec.id === `view-${tabName}`);
    });
  },

  // ==================== BINDING DE EVENTOS ====================
  bindEvents() {
    // Nav tabs
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchTab(e.currentTarget.dataset.tab);
      });
    });

    // Selector de Alumno en el creador
    const studentSelect = document.getElementById('student-select');
    if (studentSelect) {
      studentSelect.addEventListener('change', async (e) => {
        const id = parseInt(e.target.value, 10);
        await this.selectActiveStudent(id);
      });
    }

    // Selector de Rutina en el creador
    const routineSelect = document.getElementById('routine-select');
    if (routineSelect) {
      routineSelect.addEventListener('change', async (e) => {
        const id = parseInt(e.target.value, 10);
        if (id) await this.loadRoutine(id);
      });
    }

    // Input de título de rutina
    const titleInput = document.getElementById('routine-title-input');
    if (titleInput) {
      titleInput.addEventListener('input', (e) => {
        this.state.activeRoutineName = e.target.value;
      });
    }

    // Input de tag de día
    const dayInput = document.getElementById('routine-day-input');
    if (dayInput) {
      dayInput.addEventListener('input', (e) => {
        this.state.activeDayTag = e.target.value;
      });
    }

    // Botones de acción de rutina
    const btnSaveRoutine = document.getElementById('btn-save-routine');
    if (btnSaveRoutine) btnSaveRoutine.addEventListener('click', () => this.saveRoutine());

    const btnNewRoutine = document.getElementById('btn-new-routine');
    if (btnNewRoutine) btnNewRoutine.addEventListener('click', () => this.createNewRoutineDraft());

    const btnDeleteRoutine = document.getElementById('btn-delete-routine');
    if (btnDeleteRoutine) btnDeleteRoutine.addEventListener('click', () => this.deleteCurrentRoutine());

    const btnExportWa = document.getElementById('btn-export-whatsapp');
    if (btnExportWa) btnExportWa.addEventListener('click', () => this.copyRoutineToWhatsApp());

    const btnPrint = document.getElementById('btn-print-routine');
    if (btnPrint) btnPrint.addEventListener('click', () => window.print());

    const btnLogRoutine = document.getElementById('btn-log-this-routine');
    if (btnLogRoutine) btnLogRoutine.addEventListener('click', () => this.openLogSessionModal());

    const btnOpenLogModal = document.getElementById('btn-open-log-modal');
    if (btnOpenLogModal) btnOpenLogModal.addEventListener('click', () => this.openLogSessionModal());

    // Búsqueda en la biblioteca
    const searchInput = document.getElementById('library-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.state.searchQuery = e.target.value;
        this.renderExerciseLibrary();
      });
    }

    // Modales: Cerrar
    document.querySelectorAll('.modal-close-btn, .modal-cancel-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.target.closest('.modal-overlay').classList.remove('active');
      });
    });

    // Modal: Nuevo Alumno
    const btnOpenStudentModal = document.getElementById('btn-new-student-modal');
    if (btnOpenStudentModal) btnOpenStudentModal.addEventListener('click', () => this.openStudentModal());

    const studentForm = document.getElementById('student-form');
    if (studentForm) {
      studentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('student-modal-id').value;
        const payload = {
          name: document.getElementById('student-name-input').value,
          goal: document.getElementById('student-goal-input').value,
          phone: document.getElementById('student-phone-input').value,
          email: document.getElementById('student-email-input').value,
          weight: parseFloat(document.getElementById('student-weight-input').value) || 70,
          height: parseFloat(document.getElementById('student-height-input').value) || 175,
          level: document.getElementById('student-level-input').value,
          notes: document.getElementById('student-notes-input').value
        };

        try {
          const url = id ? `/api/students/${id}` : '/api/students';
          const method = id ? 'PUT' : 'POST';
          const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.error);

          document.getElementById('student-modal').classList.remove('active');
          await this.reloadStudents();
          this.showToast(id ? 'Alumno actualizado' : 'Nuevo alumno creado', 'success');
        } catch (err) {
          this.showToast('Error: ' + err.message, 'error');
        }
      });
    }

    // Modal: Nuevo Ejercicio
    const btnOpenExerciseModal = document.getElementById('btn-new-exercise-modal');
    if (btnOpenExerciseModal) btnOpenExerciseModal.addEventListener('click', () => this.openExerciseModal());

    const exerciseForm = document.getElementById('exercise-form');
    if (exerciseForm) {
      exerciseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          name: document.getElementById('ex-name-input').value,
          muscle_group: document.getElementById('ex-muscle-input').value,
          secondary_muscle: document.getElementById('ex-sec-muscle-input').value,
          equipment: document.getElementById('ex-equip-input').value,
          difficulty: document.getElementById('ex-diff-input').value,
          description: document.getElementById('ex-desc-input').value,
          default_sets: parseInt(document.getElementById('ex-sets-input').value, 10) || 4,
          default_reps: document.getElementById('ex-reps-input').value || '10-12',
          default_weight: parseFloat(document.getElementById('ex-weight-input').value) || 20,
          default_rest: document.getElementById('ex-rest-input').value || '90 seg'
        };

        try {
          const res = await fetch('/api/exercises', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.error);

          document.getElementById('exercise-modal').classList.remove('active');
          this.state.exercises = data.exercises;
          this.state.muscleGroups = data.muscle_groups;
          this.renderExerciseLibrary();
          this.renderCatalogView();
          this.renderNavCounts();
          this.showToast('¡Nuevo ejercicio añadido a la biblioteca!', 'success');
        } catch (err) {
          this.showToast('Error: ' + err.message, 'error');
        }
      });
    }

    // Modal: Registrar Sesión Form
    const logForm = document.getElementById('log-session-form');
    if (logForm) {
      logForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveWorkoutLog();
      });
    }

    // ==================== EVENTOS DEL PLANIFICADOR Y CALENDARIO ====================
    // Selector de Alumno en el Planificador
    const plannerStudentSelect = document.getElementById('planner-student-select');
    if (plannerStudentSelect) {
      plannerStudentSelect.addEventListener('change', async (e) => {
        const id = parseInt(e.target.value, 10);
        await this.selectActiveStudent(id);
      });
    }

    // Selector de Plan
    const planSelect = document.getElementById('plan-select');
    if (planSelect) {
      planSelect.addEventListener('change', (e) => {
        const id = parseInt(e.target.value, 10);
        if (id) {
          this.state.activePlanId = id;
          this.renderPlanBanner();
          this.renderWeeklyPeriodizationGrid();
        }
      });
    }

    // Subtabs del Planificador (Calendario Mensual vs Periodización Semanal)
    document.querySelectorAll('.planner-toggle-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const subtab = e.currentTarget.dataset.subtab;
        this.state.calendarSubtab = subtab;

        document.querySelectorAll('.planner-toggle-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.subtab === subtab);
        });

        const subCalendar = document.getElementById('subview-calendar-month');
        const subPeriod = document.getElementById('subview-weekly-periodization');
        if (subCalendar) subCalendar.style.display = subtab === 'calendar-month' ? 'flex' : 'none';
        if (subPeriod) subPeriod.style.display = subtab === 'weekly-periodization' ? 'block' : 'none';
      });
    });

    // Navegación de Meses en el Calendario
    const btnCalPrev = document.getElementById('btn-cal-prev-month');
    if (btnCalPrev) btnCalPrev.addEventListener('click', () => this.changeCalendarMonth(-1));

    const btnCalNext = document.getElementById('btn-cal-next-month');
    if (btnCalNext) btnCalNext.addEventListener('click', () => this.changeCalendarMonth(1));

    const btnCalToday = document.getElementById('btn-cal-today');
    if (btnCalToday) {
      btnCalToday.addEventListener('click', async () => {
        const now = new Date();
        this.state.calendarYear = now.getFullYear();
        this.state.calendarMonth = now.getMonth() + 1;
        await this.loadCalendarEvents();
        this.renderCalendarGrid();
      });
    }

    // Botones de acción del Plan
    const btnOpenPlanModal = document.getElementById('btn-open-new-plan-modal');
    if (btnOpenPlanModal) btnOpenPlanModal.addEventListener('click', () => this.openNewPlanModal());

    const btnExportPlanWa = document.getElementById('btn-export-plan-whatsapp');
    if (btnExportPlanWa) btnExportPlanWa.addEventListener('click', () => this.copyPlanToWhatsApp());

    const btnPrintPlan = document.getElementById('btn-print-plan');
    if (btnPrintPlan) btnPrintPlan.addEventListener('click', () => window.print());

    const btnRegenCal = document.getElementById('btn-regenerate-calendar');
    if (btnRegenCal) btnRegenCal.addEventListener('click', () => this.saveWeeklyScheduleAndProject());

    const btnDeletePlan = document.getElementById('btn-delete-plan');
    if (btnDeletePlan) btnDeletePlan.addEventListener('click', () => this.deleteActivePlan());

    const btnSaveWeekly = document.getElementById('btn-save-weekly-schedule');
    if (btnSaveWeekly) btnSaveWeekly.addEventListener('click', () => this.saveWeeklyScheduleAndProject());

    // Modal: Formulario de Nuevo Plan
    const planForm = document.getElementById('plan-form');
    if (planForm) {
      planForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.savePlanFromModal();
      });
    }

    // Modal: Formulario de Evento de Calendario
    const calEventForm = document.getElementById('calendar-event-form');
    if (calEventForm) {
      calEventForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveCalendarEventFromModal();
      });
    }

    // Botón eliminar evento del calendario
    const btnDeleteCalEvent = document.getElementById('btn-delete-cal-event');
    if (btnDeleteCalEvent) {
      btnDeleteCalEvent.addEventListener('click', async () => {
        await this.deleteCalendarEventFromModal();
      });
    }
  },


  // ==================== TOAST NOTIFICATIONS ====================
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = '⚡';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }
};

window.TrainingApp = TrainingApp;

document.addEventListener('DOMContentLoaded', () => {
  TrainingApp.init();
});
