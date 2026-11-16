# 🏋️ TRAINING - Micro App para Instructores de Gimnasio

Micro aplicación web desarrollada en **Python + Flask**, diseñada para instructores y entrenadores de gimnasio que necesitan crear rutinas de ejercicios personalizadas arrastrando ejercicios desde una biblioteca organizada por grupos musculares y llevar un control estricto de sus alumnos.

---

## 🎨 Paleta de Diseño Fitness

- **Fondo:** Claro casi blanco (`#f8fafc` / `#ffffff`), estética fitness moderna, limpia y de alto contraste.
- **Color Secundario / Estructura:** Azul Índigo (`#1e1b4b`, `#312e81`, `#4f46e5`).
- **Detalles / Acentos:** Verde Manzana Fitness (`#22c55e`, `#16a34a`, `#4ade80`), con efectos luminosos para feedback de arrastre y acciones clave.
- **Tipografía:** *Outfit* (títulos y métricas atléticas) y *Plus Jakarta Sans* (lectura nítida).

---

## 🚀 Funcionalidades Principales

1. **Biblioteca de Ejercicios por Grupos Musculares:**
   - Categorizada en: **Pecho, Espalda, Piernas, Hombros, Bíceps, Tríceps, Core / Abdomen y Cardio / Funcional**.
   - Más de 40 ejercicios pre-cargados con pesos, repeticiones y descansos recomendados.
   - Búsqueda en tiempo real por nombre, máquina o equipamiento.
   - Posibilidad de crear y registrar ejercicios personalizados.

2. **Creador de Rutinas Personalizadas con Drag & Drop:**
   - **Arrastrar y soltar:** Toma cualquier ejercicio de la biblioteca y suéltalo en el tablero de rutina del alumno seleccionado.
   - Botón **"+"** rápido para uso ágil en tablets y teléfonos móviles.
   - Control individual por ejercicio de:
     - **Series:** Steppers rápidos `+` / `-` y edición directa.
     - **Repeticiones:** Textos configurables (ej: `10-12`, `Fallo`, `8, 8, 6`).
     - **Peso sugerido:** Steppers `+2.5 kg` / `-2.5 kg` o valor exacto.
     - **Descanso:** Intervalos en segundos (`60s`, `90s`, `120s`).
     - **Notas técnicas:** Recomendaciones específicas (ej: *tempo lento 3s, drop set al fallo*).
   - Reordenamiento arrastrable entre ejercicios de la misma rutina.
   - Cálculo en tiempo real de: **Series totales**, **Volumen estimado de carga (kg)** y **Músculos involucrados**.

3. **Lista y Ficha de Alumnos:**
   - Registro de alumnos con objetivo principal (Hipertrofia, Pérdida de grasa, Fuerza, Rendimiento), peso, estatura, nivel y notas de salud/lesiones.
   - Acceso inmediato con un clic a las rutinas de cada alumno.
   - Edición y eliminación de alumnos.

4. **Control y Registro de Sesiones Realizadas:**
   - Historial de entrenamientos completados por alumno.
   - Registro de fecha, duración, nivel de esfuerzo subjetivo (**RPE 1-10**), notas del instructor y desglose de ejercicios con pesos reales logrados.

5. **Planificación y Periodización de Rutinas (Planes de 3, 6 y 12 Meses):**
   - **Planes a Medida por Alumno:** Creación de macrociclos de 1, 3, 6 o 12 meses con objetivo personalizado, fecha de inicio y notas del instructor.
   - **Plantilla Semanal Automatizada:** Configura el esquema de Lunes a Domingo (asignando rutinas o días de descanso activo/total) y el sistema proyecta y genera automáticamente todos los días del calendario completo de 3 a 12 meses.
   - **Calendario Interactivo Mensual:** Visualiza los días entrenados, pendientes o de descanso. Haz clic en cualquier día para cambiar la rutina, marcar como completado ✅, descanso 💤 o falta ❌.
   - **Tarjetas de Alto Contraste:** Estilizadas en **Azul Índigo profundo** (`#1e1b4b` a `#282462`) con tipografía en **Blanco puro** y acentos en **Verde Manzana fitness**, logrando legibilidad y estética atlética de primer nivel.

6. **Exportación Ágil y Comunicación:**
   - **Copiar a WhatsApp (Rutina y Plan):** Genera mensajes formateados con emojis estructurados para el chat del alumno tanto de la rutina del día como del plan macrociclo.
   - **Imprimir / Guardar en PDF:** Estilos de impresión limpios optimizados para hojas físicas de gimnasio o PDF sin elementos innecesarios.

---

## 🛠️ Instalación y Puesta en Marcha

1. Asegúrate de tener Python instalado (versión 3.9 o superior).
2. Abre la carpeta del proyecto en la terminal:
   ```bash
   cd d:\weblocal\training
   ```
3. Instala Flask si aún no lo tienes:
   ```bash
   pip install -r requirements.txt
   ```
4. Inicia la aplicación:
   ```bash
   python app.py
   ```
   *O simplemente haz doble clic en `iniciar.bat`.*
5. Abre en tu navegador favorito:
   👉 **http://localhost:5000**
