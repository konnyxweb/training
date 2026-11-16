/**
 * Drag and Drop Engine for Training App
 * Handles dragging exercises from library to dropzone and reordering items inside routine
 */

const DragDropEngine = {
  draggedExerciseData: null,
  draggedRoutineIndex: null,

  init() {
    this.setupDropZone();
  },

  // Configura la zona de soltar (Tablero de rutina)
  setupDropZone() {
    const dropZone = document.getElementById('routine-drop-zone');
    if (!dropZone) return;

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      dropZone.classList.add('drag-over');

      // Si estamos reordenando items dentro de la rutina
      if (this.draggedRoutineIndex !== null) {
        const afterElement = this.getDragAfterElement(dropZone, e.clientY);
        const draggingElement = document.querySelector('.routine-item-card.is-dragging');
        if (draggingElement) {
          if (afterElement == null) {
            dropZone.appendChild(draggingElement);
          } else {
            dropZone.insertBefore(draggingElement, afterElement);
          }
        }
      }
    });

    dropZone.addEventListener('dragleave', (e) => {
      // Verificar si realmente salió de la zona o solo pasó sobre un hijo
      if (!dropZone.contains(e.relatedTarget)) {
        dropZone.classList.remove('drag-over');
      }
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');

      // Caso 1: Se soltó un ejercicio nuevo desde la biblioteca
      if (this.draggedExerciseData) {
        window.TrainingApp.addExerciseToRoutine(this.draggedExerciseData);
        this.draggedExerciseData = null;
        window.TrainingApp.showToast('¡Ejercicio añadido a la rutina!', 'success');
        return;
      }

      // Caso 2: Se terminó de reordenar la rutina
      if (this.draggedRoutineIndex !== null) {
        this.syncReorderedItems();
        this.draggedRoutineIndex = null;
      }
    });
  },

  // Vincula los eventos dragstart a una tarjeta de la biblioteca
  attachLibraryDraggable(cardElement, exerciseData) {
    cardElement.setAttribute('draggable', 'true');

    cardElement.addEventListener('dragstart', (e) => {
      this.draggedExerciseData = exerciseData;
      this.draggedRoutineIndex = null;
      cardElement.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', JSON.stringify(exerciseData));
    });

    cardElement.addEventListener('dragend', () => {
      cardElement.classList.remove('is-dragging');
      this.draggedExerciseData = null;
    });
  },

  // Vincula el arrastre para reordenar dentro de la rutina
  attachRoutineReorderable(itemElement, index) {
    const handle = itemElement.querySelector('.item-reorder-handle') || itemElement;
    
    itemElement.setAttribute('draggable', 'true');

    itemElement.addEventListener('dragstart', (e) => {
      this.draggedRoutineIndex = index;
      this.draggedExerciseData = null;
      itemElement.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', index.toString());
    });

    itemElement.addEventListener('dragend', () => {
      itemElement.classList.remove('is-dragging');
      this.draggedRoutineIndex = null;
      this.syncReorderedItems();
    });
  },

  // Encuentra la posición exacta donde insertar el elemento al arrastrar
  getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.routine-item-card:not(.is-dragging)')];

    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  },

  // Sincroniza el nuevo orden de los elementos en el estado de la aplicación
  syncReorderedItems() {
    const container = document.getElementById('routine-drop-zone');
    if (!container) return;

    const cards = container.querySelectorAll('.routine-item-card');
    const newItemsOrder = [];

    cards.forEach((card, newIndex) => {
      const originalIndex = parseInt(card.dataset.index, 10);
      if (!isNaN(originalIndex) && window.TrainingApp.state.routineItems[originalIndex]) {
        newItemsOrder.push(window.TrainingApp.state.routineItems[originalIndex]);
      }
    });

    if (newItemsOrder.length === window.TrainingApp.state.routineItems.length) {
      window.TrainingApp.state.routineItems = newItemsOrder;
      window.TrainingApp.renderRoutineBoard();
      window.TrainingApp.calculateRoutineStats();
    }
  }
};

window.DragDropEngine = DragDropEngine;
