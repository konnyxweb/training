import sqlite3
import json
import os
from datetime import datetime, date, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), 'training.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys = ON')
    return conn

def init_db():
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Tabla de Alumnos
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT,
                phone TEXT,
                goal TEXT NOT NULL,
                weight REAL DEFAULT 70.0,
                height REAL DEFAULT 175.0,
                level TEXT DEFAULT 'Intermedio',
                notes TEXT,
                avatar_color TEXT DEFAULT '#4f46e5',
                created_at TEXT NOT NULL
            )
        ''')

        # Tabla de Ejercicios de la Biblioteca
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS exercises (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                muscle_group TEXT NOT NULL,
                secondary_muscle TEXT,
                equipment TEXT NOT NULL,
                difficulty TEXT DEFAULT 'Intermedio',
                description TEXT,
                default_sets INTEGER DEFAULT 4,
                default_reps TEXT DEFAULT '10-12',
                default_weight REAL DEFAULT 20.0,
                default_rest TEXT DEFAULT '90 seg',
                is_custom INTEGER DEFAULT 0
            )
        ''')

        # Tabla de Rutinas asignadas a alumnos
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS routines (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                day_tag TEXT DEFAULT 'General',
                notes TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
            )
        ''')

        # Tabla de Ítems (Ejercicios individuales configurados dentro de la rutina)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS routine_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                routine_id INTEGER NOT NULL,
                exercise_id INTEGER,
                exercise_name TEXT NOT NULL,
                muscle_group TEXT NOT NULL,
                equipment TEXT,
                order_index INTEGER NOT NULL,
                sets INTEGER DEFAULT 4,
                reps TEXT DEFAULT '10-12',
                weight REAL DEFAULT 0,
                rest_seconds INTEGER DEFAULT 90,
                notes TEXT,
                FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE,
                FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE SET NULL
            )
        ''')

        # Tabla de Registro y Control de Entrenamientos completados
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS workout_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL,
                routine_id INTEGER,
                routine_name TEXT NOT NULL,
                date TEXT NOT NULL,
                duration_minutes INTEGER DEFAULT 50,
                perceived_exertion INTEGER DEFAULT 8,
                notes TEXT,
                details_json TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
            )
        ''')

        # Tabla de Planes a Mediano y Largo Plazo (3, 6, 12 meses)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS training_plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                duration_months INTEGER DEFAULT 3,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                goal TEXT,
                weekly_schedule_json TEXT,
                notes TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
            )
        ''')

        # Tabla de Eventos de Calendario (Días planificados de rutinas)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS plan_calendar_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL,
                plan_id INTEGER,
                date TEXT NOT NULL,
                routine_id INTEGER,
                routine_name TEXT NOT NULL,
                status TEXT DEFAULT 'scheduled',
                notes TEXT,
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
                FOREIGN KEY (plan_id) REFERENCES training_plans(id) ON DELETE CASCADE
            )
        ''')

        # Tabla de Ejercicios del Día (Calendario Personal & Bitácora de Cargas)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS daily_workout_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                exercise_id INTEGER,
                exercise_name TEXT NOT NULL,
                category TEXT DEFAULT 'General',
                equipment TEXT DEFAULT 'Peso corporal / Bolso',
                description TEXT DEFAULT '',
                sets INTEGER DEFAULT 4,
                reps TEXT DEFAULT '10-12',
                weight REAL DEFAULT 0.0,
                weight_unit TEXT DEFAULT 'kg',
                notes TEXT DEFAULT '',
                completed INTEGER DEFAULT 0,
                order_index INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE SET NULL
            )
        ''')

        # Tabla de Series Plantilla por Ejercicio en Biblioteca (Carga Progresiva Base)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS exercise_template_sets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                exercise_id INTEGER NOT NULL,
                set_number INTEGER NOT NULL,
                reps INTEGER DEFAULT 10,
                weight REAL DEFAULT 0.0,
                weight_unit TEXT DEFAULT 'kg',
                FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
            )
        ''')

        # Tabla de Series Detalladas por Día y Ejercicio (Bitácora Exacta Serie x Serie)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS daily_workout_sets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id INTEGER NOT NULL,
                set_number INTEGER NOT NULL,
                reps INTEGER DEFAULT 10,
                weight REAL DEFAULT 0.0,
                weight_unit TEXT DEFAULT 'kg',
                completed INTEGER DEFAULT 0,
                notes TEXT DEFAULT '',
                FOREIGN KEY (item_id) REFERENCES daily_workout_items(id) ON DELETE CASCADE
            )
        ''')

        conn.commit()


    # Sembrar datos iniciales si no existen
    seed_initial_data()

def seed_initial_data():
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Verificar si la biblioteca de ejercicios ya está cargada
        cursor.execute('SELECT COUNT(*) as count FROM exercises')
        if cursor.fetchone()['count'] == 0:
            initial_exercises = [
                # PECHO
                ('Press de Banca Plano con Barra', 'Pecho', 'Tríceps / Hombro anterior', 'Barra', 'Intermedio', 'Empuje horizontal básico para hipertrofia y fuerza pectoral', 4, '8-10', 60.0, '120 seg'),
                ('Press Inclinado con Mancuernas', 'Pecho', 'Hombro anterior', 'Mancuernas', 'Intermedio', 'Foco en la porción clavicular (pectoral superior)', 4, '10-12', 22.0, '90 seg'),
                ('Aperturas en Polea (Cruces)', 'Pecho', 'Pectoral medio', 'Polea', 'Principiante', 'Tensión constante en estiramiento y contracción máxima', 3, '12-15', 12.5, '60 seg'),
                ('Flexiones de Pecho (Push-ups)', 'Pecho', 'Tríceps / Core', 'Peso Corporal', 'Principiante', 'Excelente para activación o calentamiento específico', 3, 'Al fallo', 0.0, '60 seg'),
                ('Fondos en Paralelas para Pecho', 'Pecho', 'Tríceps', 'Peso Corporal', 'Avanzado', 'Inclinando el torso hacia adelante para cargar el pectoral inferior', 3, '8-12', 0.0, '90 seg'),
                ('Press Declinado en Máquina', 'Pecho', 'Tríceps', 'Máquina', 'Principiante', 'Seguro para hombros, enfocado en fibras inferiores del pecho', 4, '10-12', 45.0, '75 seg'),

                # ESPALDA
                ('Dominadas Pronas (Pull-ups)', 'Espalda', 'Bíceps / Antebrazos', 'Peso Corporal', 'Avanzado', 'Ejercicio rey de tracción vertical para amplitud de dorsales', 4, '6-10', 0.0, '120 seg'),
                ('Jalón al Pecho en Polea Alta', 'Espalda', 'Bíceps', 'Polea', 'Principiante', 'Tracción vertical controlada para activación de dorsal ancho', 4, '10-12', 45.0, '90 seg'),
                ('Remo con Barra 45°', 'Espalda', 'Deltoides posterior / Lumbares', 'Barra', 'Intermedio', 'Densidad de espalda media y alta, trabajo de trapecios y dorsales', 4, '8-10', 50.0, '90 seg'),
                ('Remo Unilateral con Mancuerna', 'Espalda', 'Bíceps', 'Mancuernas', 'Intermedio', 'Permite un rango de movimiento profundo protegiendo la zona lumbar', 3, '10-12', 26.0, '75 seg'),
                ('Remo en Polea Baja (Gironda)', 'Espalda', 'Trapecios / Romboides', 'Polea', 'Intermedio', 'Excelente para espesor del torso y salud postural escapular', 3, '12', 40.0, '75 seg'),
                ('Peso Muerto Convencional', 'Espalda', 'Isquiotibiales / Glúteos', 'Barra', 'Avanzado', 'Cadena posterior completa y fuerza neuromuscular global', 3, '5-6', 90.0, '180 seg'),
                ('Hiperextensiones Lumbares', 'Espalda', 'Glúteos / Isquios', 'Máquina', 'Principiante', 'Fortalecimiento de erectores espinales y estabilidad lumbopélvica', 3, '15', 10.0, '60 seg'),

                # PIERNAS
                ('Sentadilla Trasera con Barra (Squat)', 'Piernas', 'Glúteos / Core', 'Barra', 'Avanzado', 'Padrón fundamental de empuje para cuádriceps y tren inferior completo', 4, '6-8', 80.0, '150 seg'),
                ('Prensa Inclinada de Piernas (45°)', 'Piernas', 'Cuádriceps / Glúteos', 'Máquina', 'Intermedio', 'Carga elevada con mínimo impacto en columna lumbar', 4, '10-12', 140.0, '90 seg'),
                ('Sentadilla Búlgara con Mancuernas', 'Piernas', 'Glúteo medio / Estabilidad', 'Mancuernas', 'Intermedio', 'Trabajo unilateral implacable para corregir desbalances', 3, '10 c/u', 16.0, '90 seg'),
                ('Extensión de Cuádriceps en Máquina', 'Piernas', 'Cuádriceps puro', 'Máquina', 'Principiante', 'Aislamiento máximo en contracción pico del recto femoral', 3, '12-15', 35.0, '60 seg'),
                ('Curl Femoral Tumbado', 'Piernas', 'Isquiotibiales', 'Máquina', 'Principiante', 'Flexión de rodilla para aislamiento de femorales', 4, '10-12', 30.0, '75 seg'),
                ('Peso Muerto Rumano con Barra', 'Piernas', 'Isquiotibiales / Glúteos', 'Barra', 'Intermedio', 'Bisagra de cadera con estiramiento pronunciado de isquios', 4, '8-10', 60.0, '90 seg'),
                ('Hip Thrust con Barra (Glúteos)', 'Piernas', 'Glúteos mayores', 'Barra', 'Intermedio', 'Máxima activación del glúteo en extensión completa de cadera', 4, '10-12', 70.0, '90 seg'),
                ('Elevación de Talones de Pie (Gemelos)', 'Piernas', 'Gastrocnemio', 'Máquina', 'Principiante', 'Aislamiento de pantorrillas con pausa de 2s en máxima extensión', 4, '15-20', 45.0, '60 seg'),

                # HOMBROS
                ('Press Militar con Barra de Pie', 'Hombros', 'Tríceps / Core', 'Barra', 'Avanzado', 'Empuje vertical estricto para hombro anterior y fuerza de empuje', 4, '6-8', 40.0, '120 seg'),
                ('Press de Hombros Sentado con Mancuernas', 'Hombros', 'Tríceps', 'Mancuernas', 'Intermedio', 'Rango articular más amigable y simétrico para deltoides', 4, '10-12', 18.0, '90 seg'),
                ('Elevaciones Laterales con Mancuerna', 'Hombros', 'Deltoides lateral', 'Mancuernas', 'Principiante', 'La clave para lograr hombros anchos tipo balón 3D', 4, '12-15', 9.0, '60 seg'),
                ('Pájaros Posteriores en Polea o Mancuernas', 'Hombros', 'Trapecio medio / Romboides', 'Polea', 'Principiante', 'Salud del manguito rotador y deltoides posterior', 3, '15', 7.0, '60 seg'),
                ('Face Pull con Cuerda en Polea', 'Hombros', 'Trapecio superior / Rotadores', 'Polea', 'Principiante', 'Ejercicio postural imprescindible para hombros sanos', 4, '15', 20.0, '60 seg'),

                # BÍCEPS
                ('Curl de Bíceps con Barra Z', 'Bíceps', 'Braquial / Antebrazo', 'Barra', 'Intermedio', 'Menor tensión en muñecas y máximo reclutamiento del bíceps', 3, '10-12', 25.0, '75 seg'),
                ('Curl Martillo con Mancuernas', 'Bíceps', 'Braquiorradial / Braquial', 'Mancuernas', 'Principiante', 'Engrosamiento del brazo y fuerza de agarre', 3, '10-12', 14.0, '60 seg'),
                ('Curl en Banco Scott (Predicador)', 'Bíceps', 'Cabeza corta bíceps', 'Máquina', 'Intermedio', 'Aislamiento estricto sin balanceo del cuerpo', 3, '12', 20.0, '75 seg'),
                ('Curl Inclinado en Banco con Mancuernas', 'Bíceps', 'Cabeza larga bíceps', 'Mancuernas', 'Intermedio', 'Estiramiento profundo en el punto de partida', 3, '10-12', 12.0, '75 seg'),

                # TRÍCEPS
                ('Extensión de Tríceps en Polea Alta (Cuerda)', 'Tríceps', 'Cabeza lateral', 'Polea', 'Principiante', 'Apertura en la parte baja para contracción total', 3, '12-15', 20.0, '60 seg'),
                ('Press Francés con Barra Z en Banco', 'Tríceps', 'Cabeza larga tríceps', 'Barra', 'Intermedio', 'Gran estímulo de estiramiento para volumen de tríceps', 4, '10', 25.0, '75 seg'),
                ('Fondos entre Bancos o Paralelas', 'Tríceps', 'Pectoral inferior', 'Peso Corporal', 'Intermedio', 'Cuerpo erguido para concentrar la carga en tríceps', 3, '12', 0.0, '60 seg'),
                ('Patada de Tríceps en Polea', 'Tríceps', 'Cabeza media', 'Polea', 'Principiante', 'Tensión constante durante toda la extensión del codo', 3, '15', 10.0, '60 seg'),

                # CORE Y ABDOMINALES
                ('Plancha Isométrica (Plank)', 'Core / Abdomen', 'Transverso / Glúteos', 'Peso Corporal', 'Principiante', 'Resistencia isométrica y estabilidad anterior del core', 3, '45-60 seg', 0.0, '60 seg'),
                ('Elevaciones de Piernas Colgado en Barra', 'Core / Abdomen', 'Flexores de cadera', 'Peso Corporal', 'Avanzado', 'Enfocado en recto abdominal inferior con retroversión pélvica', 3, '12-15', 0.0, '60 seg'),
                ('Crunch en Polea Alta (Arrodillado)', 'Core / Abdomen', 'Recto abdominal', 'Polea', 'Intermedio', 'Permite sobrecarga progresiva real para los abdominales', 4, '12-15', 30.0, '60 seg'),
                ('Rueda Abdominal (Ab Wheel Rollout)', 'Core / Abdomen', 'Dorsales / Core profundo', 'Kettlebell', 'Avanzado', 'Excéntrico brutal de la pared abdominal', 3, '10', 0.0, '75 seg'),
                ('Giros Rusos con Disco (Russian Twist)', 'Core / Abdomen', 'Oblicuos', 'Mancuernas', 'Intermedio', 'Rotación torácica controlada con disco o kettlebell', 3, '20 totales', 10.0, '60 seg'),

                # CARDIO Y FUNCIONAL
                ('Intervalos en Cinta (Sprint HIIT)', 'Cardio / Funcional', 'Piernas / Resistencia', 'Máquina', 'Intermedio', '30s sprint / 30s recuperación activa para quema calórica', 8, 'Rounds', 0.0, '30 seg'),
                ('Remo Ergómetro (Rowing Machine)', 'Cardio / Funcional', 'Espalda / Piernas / Cardio', 'Máquina', 'Intermedio', 'Cardio de bajo impacto con 85% de masa muscular activa', 4, '500m', 0.0, '60 seg'),
                ('Swings con Kettlebell', 'Cardio / Funcional', 'Glúteos / Isquios / Potencia', 'Kettlebell', 'Intermedio', 'Potencia explosiva de cadera y resistencia cardiovascular', 4, '20', 16.0, '60 seg'),
                ('Saltos de Comba (Jump Rope)', 'Cardio / Funcional', 'Gemelos / Coordinación', 'Peso Corporal', 'Principiante', 'Quema acelerada y reactividad del tobillo', 5, '2 min', 0.0, '45 seg'),
                ('Battle Ropes (Cuerdas de Batalla)', 'Cardio / Funcional', 'Hombros / Brazos / Core', 'Kettlebell', 'Intermedio', 'Ondas alternas de alta intensidad para acondicionamiento', 4, '30 seg', 0.0, '45 seg')
            ]

            cursor.executemany('''
                INSERT INTO exercises (name, muscle_group, secondary_muscle, equipment, difficulty, description, default_sets, default_reps, default_weight, default_rest, is_custom)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
            ''', initial_exercises)
            conn.commit()

        # Verificar si hay alumnos creados
        cursor.execute('SELECT COUNT(*) as count FROM students')
        if cursor.fetchone()['count'] == 0:
            now_str = datetime.now().strftime('%Y-%m-%d %H:%M')
            students_data = [
                ('Carlos Mendoza', 'carlos.m@ejemplo.com', '+34 611 223 344', 'Hipertrofia y Aumento de Masa Muscular', 78.5, 178, 'Intermedio', 'Trabaja turnos rotativos. Enfocarse en pecho y espalda.', '#4f46e5', now_str),
                ('Valentina Ramos', 'vale.fit@ejemplo.com', '+34 622 334 455', 'Pérdida de Grasa y Tonificación Glúteos', 61.0, 165, 'Principiante', 'Lesión leve previa de rodilla derecha (evitar impacto alto).', '#10b981', now_str),
                ('Mateo Silveira', 'mateo.power@ejemplo.com', '+34 633 445 566', 'Fuerza Máxima y Powerlifting', 86.0, 182, 'Avanzado', 'Preparando test de 1RM para final de mes.', '#0284c7', now_str)
            ]
            cursor.executemany('''
                INSERT INTO students (name, email, phone, goal, weight, height, level, notes, avatar_color, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', students_data)
            conn.commit()

            # Rutina de ejemplo para Carlos Mendoza (ID 1)
            cursor.execute('''
                INSERT INTO routines (student_id, name, day_tag, notes, created_at, updated_at)
                VALUES (1, 'Día 1: Torso Potencia & Pectoral', 'Lunes', 'Priorizar descanso entre series pesadas y buena contracción.', ?, ?)
            ''', (now_str, now_str))
            routine_id_1 = cursor.lastrowid

            routine_1_items = [
                (routine_id_1, 1, 'Press de Banca Plano con Barra', 'Pecho', 'Barra', 0, 4, '8-10', 65.0, 120, '2 series de aproximación previas'),
                (routine_id_1, 2, 'Press Inclinado con Mancuernas', 'Pecho', 'Mancuernas', 1, 4, '10-12', 24.0, 90, 'Subir peso en última serie'),
                (routine_id_1, 9, 'Remo con Barra 45°', 'Espalda', 'Barra', 2, 4, '8-10', 55.0, 90, 'Espalda neutra, tirar al ombligo'),
                (routine_id_1, 8, 'Jalón al Pecho en Polea Alta', 'Espalda', 'Polea', 3, 3, '12', 50.0, 75, 'Apretando escápulas 1 seg abajo'),
                (routine_id_1, 25, 'Elevaciones Laterales con Mancuerna', 'Hombros', 'Mancuernas', 4, 4, '15', 10.0, 60, 'Drop set en la última serie'),
                (routine_id_1, 31, 'Extensión de Tríceps en Polea Alta (Cuerda)', 'Tríceps', 'Polea', 5, 3, '12-15', 22.5, 60, 'Bloqueo completo de codos')
            ]
            cursor.executemany('''
                INSERT INTO routine_items (routine_id, exercise_id, exercise_name, muscle_group, equipment, order_index, sets, reps, weight, rest_seconds, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', routine_1_items)

            # Rutina de ejemplo para Valentina Ramos (ID 2)
            cursor.execute('''
                INSERT INTO routines (student_id, name, day_tag, notes, created_at, updated_at)
                VALUES (2, 'Día A: Pierna & Glúteo Enfoque', 'Martes', 'Movimientos lentos y controlados, sin forzar rodilla.', ?, ?)
            ''', (now_str, now_str))
            routine_id_2 = cursor.lastrowid

            routine_2_items = [
                (routine_id_2, 20, 'Hip Thrust con Barra (Glúteos)', 'Piernas', 'Barra', 0, 4, '12', 55.0, 90, 'Pausa arriba 2 segundos'),
                (routine_id_2, 16, 'Sentadilla Búlgara con Mancuernas', 'Piernas', 'Mancuernas', 1, 3, '10 c/u', 12.0, 90, 'Paso largo para enfocar en glúteo'),
                (routine_id_2, 19, 'Peso Muerto Rumano con Barra', 'Piernas', 'Barra', 2, 4, '10-12', 40.0, 90, 'Sentir estiramiento de femorales'),
                (routine_id_2, 17, 'Extensión de Cuádriceps en Máquina', 'Piernas', 'Máquina', 3, 3, '15', 25.0, 60, 'Control en la bajada (3 seg)'),
                (routine_id_2, 35, 'Plancha Isométrica (Plank)', 'Core / Abdomen', 'Peso Corporal', 4, 3, '45 seg', 0.0, 60, 'Mantener abdomen activo')
            ]
            cursor.executemany('''
                INSERT INTO routine_items (routine_id, exercise_id, exercise_name, muscle_group, equipment, order_index, sets, reps, weight, rest_seconds, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', routine_2_items)

            # Registrar entrenamientos de muestra en el historial (Control de alumnos)
            sample_logs = [
                (1, routine_id_1, 'Día 1: Torso Potencia & Pectoral', '2026-10-24', 55, 8, 'Excelente energía. Pudo subir 2.5kg en Press de banca.', json.dumps([
                    {'exercise': 'Press de Banca Plano con Barra', 'sets': 4, 'reps': '8, 8, 8, 7', 'weight': '65 kg'},
                    {'exercise': 'Press Inclinado con Mancuernas', 'sets': 4, 'reps': '10, 10, 10, 9', 'weight': '24 kg'},
                    {'exercise': 'Remo con Barra 45°', 'sets': 4, 'reps': '10, 10, 9, 8', 'weight': '55 kg'}
                ]), now_str),
                (2, routine_id_2, 'Día A: Pierna & Glúteo Enfoque', '2026-10-25', 48, 7, 'Buena técnica en hip thrust. Rodilla sin molestias.', json.dumps([
                    {'exercise': 'Hip Thrust con Barra (Glúteos)', 'sets': 4, 'reps': '12, 12, 12, 12', 'weight': '55 kg'},
                    {'exercise': 'Sentadilla Búlgara con Mancuernas', 'sets': 3, 'reps': '10, 10, 10', 'weight': '12 kg'}
                ]), now_str)
            ]
            cursor.executemany('''
                INSERT INTO workout_logs (student_id, routine_id, routine_name, date, duration_minutes, perceived_exertion, notes, details_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', sample_logs)

            conn.commit()

        # Verificar si hay planes creados
        cursor.execute('SELECT COUNT(*) as count FROM training_plans')
        if cursor.fetchone()['count'] == 0:
            carlos_sched = {
                "0": {"routine_id": 1, "routine_name": "Día 1: Torso Potencia & Pectoral"},
                "1": {"routine_id": 2, "routine_name": "Día A: Pierna & Glúteo Enfoque"},
                "2": "Descanso Activo / Movilidad",
                "3": {"routine_id": 1, "routine_name": "Día 1: Torso Potencia & Pectoral"},
                "4": {"routine_id": 2, "routine_name": "Día A: Pierna & Glúteo Enfoque"},
                "5": "Cardio HIIT / Abdominales",
                "6": "Descanso Total"
            }
            save_plan(
                student_id=1,
                name="Plan Macrociclo Hipertrofia & Fuerza - 3 Meses",
                duration_months=3,
                start_date="2026-10-01",
                goal="Aumento de masa muscular magra y sobrecarga progresiva en básicos",
                weekly_schedule=carlos_sched,
                notes="Fase 1: Acumulación de volumen. Aumentar 2.5kg cada 2 semanas en los ejercicios principales."
            )

            vale_sched = {
                "0": "Cardio LISS / Activación",
                "1": {"routine_id": 2, "routine_name": "Día A: Pierna & Glúteo Enfoque"},
                "2": "Descanso / Estiramientos",
                "3": {"routine_id": 1, "routine_name": "Día 1: Torso Potencia & Pectoral"},
                "4": {"routine_id": 2, "routine_name": "Día A: Pierna & Glúteo Enfoque"},
                "5": "Descanso Activo",
                "6": "Descanso Total"
            }
            save_plan(
                student_id=2,
                name="Plan Integral Tonificación & Glúteos - 6 Meses",
                duration_months=6,
                start_date="2026-10-01",
                goal="Recomposición corporal, quema de grasa y firmeza de glúteos e isquios",
                weekly_schedule=vale_sched,
                notes="Priorizar rango articular completo y descansos controlados de 60-90 segundos."
            )


# ==================== MÉTODOS DE ALUMNOS ====================
def get_students():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT s.*, 
                   COUNT(DISTINCT r.id) as routine_count,
                   COUNT(DISTINCT w.id) as log_count,
                   MAX(w.date) as last_workout_date
            FROM students s
            LEFT JOIN routines r ON s.id = r.student_id
            LEFT JOIN workout_logs w ON s.id = w.student_id
            GROUP BY s.id
            ORDER BY s.name ASC
        ''')
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def get_student(student_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM students WHERE id = ?', (student_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

def create_student(name, email, phone, goal, weight=70, height=175, level='Intermedio', notes=''):
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M')
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO students (name, email, phone, goal, weight, height, level, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (name.strip(), email.strip(), phone.strip(), goal.strip(), weight, height, level, notes.strip(), now_str))
        conn.commit()
        return cursor.lastrowid

def update_student(student_id, name, email, phone, goal, weight, height, level, notes):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE students 
            SET name = ?, email = ?, phone = ?, goal = ?, weight = ?, height = ?, level = ?, notes = ?
            WHERE id = ?
        ''', (name.strip(), email.strip(), phone.strip(), goal.strip(), weight, height, level, notes.strip(), student_id))
        conn.commit()
        return cursor.rowcount > 0

def delete_student(student_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM students WHERE id = ?', (student_id,))
        conn.commit()
        return cursor.rowcount > 0

# ==================== MÉTODOS DE BIBLIOTECA DE EJERCICIOS ====================
def _parse_reps_int(reps_val, default=10):
    """Convierte valores como '10-12', '10', 'Al fallo' a un entero positivo para cálculo de carga."""
    if reps_val is None:
        return default
    if isinstance(reps_val, (int, float)):
        return max(0, int(reps_val))
    s = str(reps_val).strip()
    if not s:
        return default
    import re
    m = re.search(r'\d+', s)
    return int(m.group()) if m else default

def _save_exercise_template_sets(cursor, exercise_id, template_sets, default_unit='kg'):
    cursor.execute('DELETE FROM exercise_template_sets WHERE exercise_id = ?', (exercise_id,))
    if not template_sets:
        return
    for idx, s in enumerate(template_sets, start=1):
        reps = _parse_reps_int(s.get('reps'), 10)
        weight = float(s.get('weight') or 0.0)
        unit = str(s.get('weight_unit') or default_unit).strip() or 'kg'
        cursor.execute('''
            INSERT INTO exercise_template_sets (exercise_id, set_number, reps, weight, weight_unit)
            VALUES (?, ?, ?, ?, ?)
        ''', (exercise_id, idx, reps, weight, unit))

def get_exercises(muscle_group=None, query=None):
    with get_db() as conn:
        cursor = conn.cursor()
        sql = 'SELECT * FROM exercises WHERE 1=1'
        params = []
        if muscle_group and muscle_group != 'Todos':
            sql += ' AND muscle_group = ?'
            params.append(muscle_group)
        if query and query.strip():
            sql += ' AND (name LIKE ? OR equipment LIKE ? OR secondary_muscle LIKE ?)'
            term = f"%{query.strip()}%"
            params.extend([term, term, term])
        
        sql += ' ORDER BY muscle_group ASC, name ASC'
        cursor.execute(sql, params)
        rows = cursor.fetchall()

        cursor.execute('SELECT * FROM exercise_template_sets ORDER BY exercise_id ASC, set_number ASC')
        all_tsets = cursor.fetchall()
        tsets_map = {}
        for ts in all_tsets:
            tsets_map.setdefault(ts['exercise_id'], []).append(dict(ts))

        result = []
        for row in rows:
            d = dict(row)
            tsets = tsets_map.get(d['id'])
            if not tsets:
                n_sets = max(1, int(d.get('default_sets') or 4))
                r_int = _parse_reps_int(d.get('default_reps'), 10)
                w_val = float(d.get('default_weight') or 0.0)
                tsets = [
                    {
                        'set_number': i,
                        'reps': r_int,
                        'weight': w_val,
                        'weight_unit': 'kg',
                        'load': round(r_int * w_val, 2)
                    }
                    for i in range(1, n_sets + 1)
                ]
            else:
                for s in tsets:
                    s['load'] = round(_parse_reps_int(s.get('reps'), 0) * float(s.get('weight') or 0.0), 2)
            d['template_sets'] = tsets
            result.append(d)
        return result

def get_muscle_groups():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT muscle_group, COUNT(*) as count 
            FROM exercises 
            GROUP BY muscle_group 
            ORDER BY count DESC
        ''')
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def create_exercise(name, muscle_group, secondary_muscle, equipment, difficulty, description, default_sets=4, default_reps='10-12', default_weight=20.0, default_rest='90 seg', template_sets=None):
    with get_db() as conn:
        cursor = conn.cursor()
        if template_sets and isinstance(template_sets, list) and len(template_sets) > 0:
            default_sets = len(template_sets)
            default_weight = max((float(s.get('weight') or 0.0) for s in template_sets), default=0.0)
            reps_list = [str(_parse_reps_int(s.get('reps'), 10)) for s in template_sets]
            default_reps = reps_list[0] if len(set(reps_list)) == 1 else '-'.join(reps_list[:4])

        cursor.execute('''
            INSERT INTO exercises (name, muscle_group, secondary_muscle, equipment, difficulty, description, default_sets, default_reps, default_weight, default_rest, is_custom)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        ''', (name.strip(), muscle_group.strip(), secondary_muscle.strip(), equipment.strip(), difficulty.strip(), description.strip(), int(default_sets), str(default_reps), float(default_weight), default_rest))
        new_id = cursor.lastrowid
        if template_sets and isinstance(template_sets, list):
            _save_exercise_template_sets(cursor, new_id, template_sets)
        conn.commit()
        return new_id

def delete_exercise(exercise_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM exercises WHERE id = ?', (exercise_id,))
        conn.commit()
        return cursor.rowcount > 0

# ==================== MÉTODOS DE RUTINAS ====================
def get_routines_by_student(student_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT r.*, COUNT(ri.id) as item_count 
            FROM routines r
            LEFT JOIN routine_items ri ON r.id = ri.routine_id
            WHERE r.student_id = ?
            GROUP BY r.id
            ORDER BY r.id ASC
        ''', (student_id,))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def get_routine_details(routine_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT r.*, s.name as student_name, s.goal as student_goal
            FROM routines r
            JOIN students s ON r.student_id = s.id
            WHERE r.id = ?
        ''', (routine_id,))
        routine = cursor.fetchone()
        if not routine:
            return None
        
        routine_dict = dict(routine)
        
        cursor.execute('''
            SELECT * FROM routine_items 
            WHERE routine_id = ? 
            ORDER BY order_index ASC, id ASC
        ''', (routine_id,))
        items = cursor.fetchall()
        routine_dict['items'] = [dict(item) for item in items]
        return routine_dict

def save_routine(student_id, name, day_tag, notes, items, routine_id=None):
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M')
    with get_db() as conn:
        cursor = conn.cursor()
        if routine_id:
            cursor.execute('''
                UPDATE routines 
                SET student_id = ?, name = ?, day_tag = ?, notes = ?, updated_at = ?
                WHERE id = ?
            ''', (student_id, name.strip(), day_tag.strip(), notes.strip(), now_str, routine_id))
            r_id = routine_id
            # Eliminar ítems previos para reinsertar la lista actualizada ordenada
            cursor.execute('DELETE FROM routine_items WHERE routine_id = ?', (r_id,))
        else:
            cursor.execute('''
                INSERT INTO routines (student_id, name, day_tag, notes, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (student_id, name.strip(), day_tag.strip(), notes.strip(), now_str, now_str))
            r_id = cursor.lastrowid
        
        # Insertar los ítems
        for idx, item in enumerate(items):
            cursor.execute('''
                INSERT INTO routine_items (
                    routine_id, exercise_id, exercise_name, muscle_group, 
                    equipment, order_index, sets, reps, weight, rest_seconds, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                r_id,
                item.get('exercise_id'),
                item.get('exercise_name', 'Ejercicio').strip(),
                item.get('muscle_group', 'General').strip(),
                item.get('equipment', 'Mancuerna'),
                idx,
                int(item.get('sets', 4)),
                str(item.get('reps', '10-12')).strip(),
                float(item.get('weight', 0)),
                int(item.get('rest_seconds', 90)),
                str(item.get('notes', '')).strip()
            ))
        
        conn.commit()
        return r_id

def delete_routine(routine_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM routines WHERE id = ?', (routine_id,))
        conn.commit()
        return cursor.rowcount > 0

# ==================== MÉTODOS DE HISTORIAL Y CONTROL (LOGS) ====================
def create_workout_log(student_id, routine_id, routine_name, log_date, duration_minutes=50, perceived_exertion=8, notes='', details_json=None):
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M')
    if not log_date:
        log_date = date.today().isoformat()
    if isinstance(details_json, (dict, list)):
        details_json = json.dumps(details_json)
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO workout_logs (student_id, routine_id, routine_name, date, duration_minutes, perceived_exertion, notes, details_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (student_id, routine_id, routine_name.strip(), log_date, duration_minutes, perceived_exertion, notes.strip(), details_json, now_str))
        conn.commit()
        return cursor.lastrowid

def get_student_logs(student_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT w.*, s.name as student_name
            FROM workout_logs w
            JOIN students s ON w.student_id = s.id
            WHERE w.student_id = ?
            ORDER BY w.date DESC, w.id DESC
        ''', (student_id,))
        rows = cursor.fetchall()
        result = []
        for row in rows:
            d = dict(row)
            if d.get('details_json'):
                try:
                    d['details'] = json.loads(d['details_json'])
                except Exception:
                    d['details'] = []
            else:
                d['details'] = []
            result.append(d)
        return result

def get_recent_logs(limit=15):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT w.*, s.name as student_name, s.avatar_color
            FROM workout_logs w
            JOIN students s ON w.student_id = s.id
            ORDER BY w.date DESC, w.id DESC
            LIMIT ?
        ''', (limit,))
        rows = cursor.fetchall()
        result = []
        for row in rows:
            d = dict(row)
            if d.get('details_json'):
                try:
                    d['details'] = json.loads(d['details_json'])
                except Exception:
                    d['details'] = []
            else:
                d['details'] = []
            result.append(d)
        return result

def delete_workout_log(log_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM workout_logs WHERE id = ?', (log_id,))
        conn.commit()
        return cursor.rowcount > 0

# ==================== MÉTODOS DE PLANIFICACIÓN Y CALENDARIO ====================
def get_student_plans(student_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT p.*, s.name as student_name,
                   (SELECT COUNT(*) FROM plan_calendar_events e WHERE e.plan_id = p.id) as total_scheduled_days,
                   (SELECT COUNT(*) FROM plan_calendar_events e WHERE e.plan_id = p.id AND e.status = 'completed') as completed_days
            FROM training_plans p
            JOIN students s ON p.student_id = s.id
            WHERE p.student_id = ?
            ORDER BY p.id DESC
        ''', (student_id,))
        rows = cursor.fetchall()
        result = []
        for row in rows:
            d = dict(row)
            if d.get('weekly_schedule_json'):
                try:
                    d['weekly_schedule'] = json.loads(d['weekly_schedule_json'])
                except Exception:
                    d['weekly_schedule'] = {}
            else:
                d['weekly_schedule'] = {}
            result.append(d)
        return result

def get_plan_details(plan_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT p.*, s.name as student_name, s.goal as student_goal
            FROM training_plans p
            JOIN students s ON p.student_id = s.id
            WHERE p.id = ?
        ''', (plan_id,))
        row = cursor.fetchone()
        if not row:
            return None
        d = dict(row)
        if d.get('weekly_schedule_json'):
            try:
                d['weekly_schedule'] = json.loads(d['weekly_schedule_json'])
            except Exception:
                d['weekly_schedule'] = {}
        else:
            d['weekly_schedule'] = {}
        return d

def save_plan(student_id, name, duration_months, start_date, goal, weekly_schedule, notes='', plan_id=None):
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M')
    try:
        start = datetime.strptime(start_date, '%Y-%m-%d').date()
    except Exception:
        start = date.today()
        start_date = start.isoformat()

    # Calcular fecha fin aproximada (meses * 30 días)
    total_days = int(duration_months) * 30
    end_date = (start + timedelta(days=total_days)).isoformat()
    weekly_json = json.dumps(weekly_schedule) if isinstance(weekly_schedule, (dict, list)) else weekly_schedule

    with get_db() as conn:
        cursor = conn.cursor()
        if plan_id:
            cursor.execute('''
                UPDATE training_plans
                SET student_id = ?, name = ?, duration_months = ?, start_date = ?, end_date = ?, goal = ?, weekly_schedule_json = ?, notes = ?
                WHERE id = ?
            ''', (student_id, name.strip(), duration_months, start_date, end_date, goal.strip(), weekly_json, notes.strip(), plan_id))
            saved_id = plan_id
            cursor.execute('DELETE FROM plan_calendar_events WHERE plan_id = ?', (saved_id,))
        else:
            cursor.execute('''
                INSERT INTO training_plans (student_id, name, duration_months, start_date, end_date, goal, weekly_schedule_json, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (student_id, name.strip(), duration_months, start_date, end_date, goal.strip(), weekly_json, notes.strip(), now_str))
            saved_id = cursor.lastrowid

        # Generar eventos del calendario automáticamente para todo el plan (3, 6, 12 meses)
        if isinstance(weekly_schedule, dict):
            for i in range(total_days):
                cur_date = start + timedelta(days=i)
                weekday_key = str(cur_date.weekday()) # "0" a "6"
                item = weekly_schedule.get(weekday_key)
                if item:
                    if isinstance(item, dict):
                        r_id = item.get('routine_id')
                        r_name = item.get('routine_name', 'Entrenamiento')
                        status = 'scheduled'
                    elif isinstance(item, str) and item.strip():
                        r_id = None
                        r_name = item.strip()
                        status = 'rest' if 'descanso' in item.lower() else 'scheduled'
                    else:
                        continue

                    cursor.execute('''
                        INSERT INTO plan_calendar_events (student_id, plan_id, date, routine_id, routine_name, status, notes)
                        VALUES (?, ?, ?, ?, ?, ?, '')
                    ''', (student_id, saved_id, cur_date.isoformat(), r_id, r_name, status))

        conn.commit()
        return saved_id

def delete_plan(plan_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM training_plans WHERE id = ?', (plan_id,))
        cursor.execute('DELETE FROM plan_calendar_events WHERE plan_id = ?', (plan_id,))
        conn.commit()
        return cursor.rowcount > 0

def get_calendar_events_for_month(student_id, year, month):
    prefix = f"{year:04d}-{month:02d}%"
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT e.*, p.name as plan_name
            FROM plan_calendar_events e
            LEFT JOIN training_plans p ON e.plan_id = p.id
            WHERE e.student_id = ? AND e.date LIKE ?
            ORDER BY e.date ASC, e.id ASC
        ''', (student_id, prefix))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def save_calendar_event(student_id, event_date, routine_id, routine_name, status='scheduled', notes='', plan_id=None):
    with get_db() as conn:
        cursor = conn.cursor()
        # Verificar si ya hay un evento ese día para ese alumno
        cursor.execute('SELECT id FROM plan_calendar_events WHERE student_id = ? AND date = ?', (student_id, event_date))
        existing = cursor.fetchone()
        if existing:
            cursor.execute('''
                UPDATE plan_calendar_events
                SET routine_id = ?, routine_name = ?, status = ?, notes = ?, plan_id = COALESCE(?, plan_id)
                WHERE id = ?
            ''', (routine_id, routine_name.strip(), status, notes.strip(), plan_id, existing['id']))
            conn.commit()
            return existing['id']
        else:
            cursor.execute('''
                INSERT INTO plan_calendar_events (student_id, plan_id, date, routine_id, routine_name, status, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (student_id, plan_id, event_date, routine_id, routine_name.strip(), status, notes.strip()))
            conn.commit()
            return cursor.lastrowid

def update_calendar_event_status(event_id, status):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('UPDATE plan_calendar_events SET status = ? WHERE id = ?', (status, event_id))
        conn.commit()
        return cursor.rowcount > 0

def delete_calendar_event(event_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM plan_calendar_events WHERE id = ?', (event_id,))
        conn.commit()
        return cursor.rowcount > 0

# ==================== MÉTODOS DEL CALENDARIO PERSONAL Y BITÁCORA ====================

def _enrich_item_with_sets(cursor, d):
    """Adjunta las series detalladas (daily_workout_sets) y calcula volumen total y peso máximo."""
    cursor.execute('''
        SELECT * FROM daily_workout_sets
        WHERE item_id = ?
        ORDER BY set_number ASC, id ASC
    ''', (d['id'],))
    sets_rows = [dict(sr) for sr in cursor.fetchall()]

    if not sets_rows:
        n_sets = max(1, int(d.get('sets') or 4))
        r_int = _parse_reps_int(d.get('reps'), 10)
        w_val = float(d.get('weight') or 0.0)
        u_val = str(d.get('weight_unit') or 'kg')
        comp = int(d.get('completed') or 0)
        for i in range(1, n_sets + 1):
            cursor.execute('''
                INSERT INTO daily_workout_sets (item_id, set_number, reps, weight, weight_unit, completed, notes)
                VALUES (?, ?, ?, ?, ?, ?, '')
            ''', (d['id'], i, r_int, w_val, u_val, comp))
        cursor.execute('''
            SELECT * FROM daily_workout_sets
            WHERE item_id = ?
            ORDER BY set_number ASC, id ASC
        ''', (d['id'],))
        sets_rows = [dict(sr) for sr in cursor.fetchall()]

    total_vol = 0.0
    max_w = 0.0
    total_reps = 0
    for s in sets_rows:
        r_i = _parse_reps_int(s.get('reps'), 0)
        w_f = float(s.get('weight') or 0.0)
        load = round(r_i * w_f, 2)
        s['reps'] = r_i
        s['weight'] = w_f
        s['load'] = load
        total_vol += load
        total_reps += r_i
        if w_f > max_w:
            max_w = w_f

    d['sets_detail'] = sets_rows
    d['total_volume'] = round(total_vol, 2)
    d['max_weight'] = round(max_w, 2)
    d['total_reps'] = total_reps
    return d

def get_last_session_for_exercise(exercise_name, before_date=None):
    """
    Obtiene la última sesión previa donde se realizó este ejercicio (para memoria histórica).
    Incluye las series detalladas (reps, peso y carga) de esa última sesión.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        sql = '''
            SELECT * FROM daily_workout_items 
            WHERE LOWER(exercise_name) = LOWER(?) 
        '''
        params = [exercise_name.strip()]
        if before_date:
            sql += ' AND date < ? '
            params.append(before_date)
        sql += ' ORDER BY date DESC, id DESC LIMIT 1 '
        
        cursor.execute(sql, params)
        row = cursor.fetchone()
        if not row:
            return None
        d = dict(row)
        _enrich_item_with_sets(cursor, d)
        conn.commit()
        try:
            today_ref = datetime.strptime(before_date, '%Y-%m-%d').date() if before_date else date.today()
            item_date = datetime.strptime(d['date'], '%Y-%m-%d').date()
            d['days_ago'] = (today_ref - item_date).days
        except Exception:
            d['days_ago'] = None
        return d

def get_day_exercises(date_str):
    """Devuelve todos los ejercicios asignados/realizados en una fecha con sus series progresivas y última sesión."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM daily_workout_items
            WHERE date = ?
            ORDER BY order_index ASC, id ASC
        ''', (date_str,))
        rows = cursor.fetchall()
        items = []
        for r in rows:
            d = dict(r)
            _enrich_item_with_sets(cursor, d)
            d['last_session'] = get_last_session_for_exercise(d['exercise_name'], before_date=date_str)
            items.append(d)
        conn.commit()
        return items

def add_exercise_to_day(date_str, exercise_id=None, custom_name=None, sets=None, reps=None, weight=None, weight_unit='kg', notes='', description=''):
    """Agrega un ejercicio libremente a un día específico, clonando sus series de plantilla o última sesión."""
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M')
    name = custom_name
    category = 'General'
    equipment = 'Peso corporal / Bolso'
    desc = description
    template_sets = []

    with get_db() as conn:
        cursor = conn.cursor()
        if exercise_id:
            cursor.execute('SELECT * FROM exercises WHERE id = ?', (exercise_id,))
            ex = cursor.fetchone()
            if ex:
                ex_dict = dict(ex)
                name = ex_dict['name']
                category = ex_dict['muscle_group']
                equipment = ex_dict['equipment']
                desc = desc or ex_dict.get('description', '')
                if sets is None: sets = ex_dict.get('default_sets', 4)
                if reps is None: reps = ex_dict.get('default_reps', '10-12')
                if weight is None: weight = ex_dict.get('default_weight', 0.0)

            cursor.execute('SELECT * FROM exercise_template_sets WHERE exercise_id = ? ORDER BY set_number ASC', (exercise_id,))
            template_sets = [dict(ts) for ts in cursor.fetchall()]

        if sets is None: sets = 4
        if reps is None: reps = '10-12'
        if weight is None: weight = 0.0
        if not name: name = 'Ejercicio'

        last_s = get_last_session_for_exercise(name, before_date=date_str)

        # Determinar series iniciales: prioridad última sesión si existe, sino plantilla de biblioteca, sino valores default
        initial_sets = []
        if last_s and last_s.get('sets_detail'):
            for s in last_s['sets_detail']:
                initial_sets.append({
                    'reps': _parse_reps_int(s.get('reps'), 10),
                    'weight': float(s.get('weight') or 0.0),
                    'weight_unit': s.get('weight_unit') or weight_unit
                })
            weight = last_s.get('max_weight', last_s.get('weight', 0.0))
            weight_unit = last_s.get('weight_unit', weight_unit)
            sets = len(initial_sets)
        elif template_sets:
            for ts in template_sets:
                initial_sets.append({
                    'reps': _parse_reps_int(ts.get('reps'), 10),
                    'weight': float(ts.get('weight') or 0.0),
                    'weight_unit': ts.get('weight_unit') or weight_unit
                })
            sets = len(initial_sets)
            weight = max((s['weight'] for s in initial_sets), default=float(weight))
            weight_unit = initial_sets[0]['weight_unit']
        else:
            r_int = _parse_reps_int(reps, 10)
            w_val = float(weight)
            for _ in range(max(1, int(sets))):
                initial_sets.append({'reps': r_int, 'weight': w_val, 'weight_unit': weight_unit})

        cursor.execute('SELECT MAX(order_index) as max_idx FROM daily_workout_items WHERE date = ?', (date_str,))
        max_row = cursor.fetchone()
        next_order = (max_row['max_idx'] or 0) + 1 if max_row and max_row['max_idx'] is not None else 0

        cursor.execute('''
            INSERT INTO daily_workout_items (
                date, exercise_id, exercise_name, category, equipment, description,
                sets, reps, weight, weight_unit, notes, completed, order_index, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
        ''', (date_str, exercise_id, name.strip(), category, equipment, desc, int(sets), str(reps).strip(), float(weight), weight_unit.strip(), notes.strip(), next_order, now_str))
        new_id = cursor.lastrowid

        for idx, s in enumerate(initial_sets, start=1):
            cursor.execute('''
                INSERT INTO daily_workout_sets (item_id, set_number, reps, weight, weight_unit, completed, notes)
                VALUES (?, ?, ?, ?, ?, 0, '')
            ''', (new_id, idx, s['reps'], s['weight'], s['weight_unit']))

        conn.commit()
        cursor.execute('SELECT * FROM daily_workout_items WHERE id = ?', (new_id,))
        item = dict(cursor.fetchone())
        _enrich_item_with_sets(cursor, item)
        item['last_session'] = last_s
        return item

def save_day_exercise_sets(item_id, sets_list):
    """Guarda todas las filas de series progresivas (reps, peso, completado) para un ejercicio del día."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM daily_workout_items WHERE id = ?', (item_id,))
        item = cursor.fetchone()
        if not item:
            return None
        d = dict(item)
        default_unit = d.get('weight_unit') or 'kg'

        cursor.execute('DELETE FROM daily_workout_sets WHERE item_id = ?', (item_id,))
        clean_sets = sets_list if sets_list else [{'reps': 10, 'weight': 0.0, 'weight_unit': default_unit, 'completed': 0}]

        max_w = 0.0
        reps_summary = []
        all_done = 1 if len(clean_sets) > 0 else 0

        for idx, s in enumerate(clean_sets, start=1):
            r_int = _parse_reps_int(s.get('reps'), 0)
            w_val = float(s.get('weight') or 0.0)
            u_val = str(s.get('weight_unit') or default_unit).strip() or 'kg'
            comp = 1 if s.get('completed') in (1, True, '1', 'true') else 0
            if not comp:
                all_done = 0
            if w_val > max_w:
                max_w = w_val
            reps_summary.append(str(r_int))
            cursor.execute('''
                INSERT INTO daily_workout_sets (item_id, set_number, reps, weight, weight_unit, completed, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (item_id, idx, r_int, w_val, u_val, comp, str(s.get('notes') or '').strip()))

        reps_str = reps_summary[0] if len(set(reps_summary)) == 1 else '-'.join(reps_summary[:5])
        cursor.execute('''
            UPDATE daily_workout_items
            SET sets = ?, reps = ?, weight = ?, completed = ?
            WHERE id = ?
        ''', (len(clean_sets), reps_str, max_w, all_done, item_id))

        conn.commit()
        cursor.execute('SELECT * FROM daily_workout_items WHERE id = ?', (item_id,))
        updated = dict(cursor.fetchone())
        _enrich_item_with_sets(cursor, updated)
        updated['last_session'] = get_last_session_for_exercise(updated['exercise_name'], before_date=updated['date'])
        return updated

def update_day_exercise(item_id, sets=None, reps=None, weight=None, weight_unit=None, notes=None, completed=None, description=None):
    """Actualiza campos generales de un ejercicio en el día y ajusta la cantidad de filas si cambia el número de series."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM daily_workout_items WHERE id = ?', (item_id,))
        item = cursor.fetchone()
        if not item:
            return None
        d = dict(item)
        
        new_sets = d['sets'] if sets is None else max(1, int(sets))
        new_reps = d['reps'] if reps is None else str(reps).strip()
        new_weight = d['weight'] if weight is None else float(weight)
        new_unit = d['weight_unit'] if weight_unit is None else str(weight_unit).strip()
        new_notes = d['notes'] if notes is None else str(notes).strip()
        new_completed = d['completed'] if completed is None else int(completed)
        new_desc = d['description'] if description is None else str(description).strip()
        
        cursor.execute('''
            UPDATE daily_workout_items
            SET sets = ?, reps = ?, weight = ?, weight_unit = ?, notes = ?, completed = ?, description = ?
            WHERE id = ?
        ''', (new_sets, new_reps, new_weight, new_unit, new_notes, new_completed, new_desc, item_id))

        # Ajustar tabla daily_workout_sets si cambió el número de series
        if sets is not None:
            cursor.execute('SELECT * FROM daily_workout_sets WHERE item_id = ? ORDER BY set_number ASC', (item_id,))
            existing_sets = [dict(sr) for sr in cursor.fetchall()]
            curr_len = len(existing_sets)
            if new_sets > curr_len:
                last_r = existing_sets[-1]['reps'] if existing_sets else _parse_reps_int(new_reps, 10)
                last_w = existing_sets[-1]['weight'] if existing_sets else new_weight
                last_u = existing_sets[-1]['weight_unit'] if existing_sets else new_unit
                for i in range(curr_len + 1, new_sets + 1):
                    cursor.execute('''
                        INSERT INTO daily_workout_sets (item_id, set_number, reps, weight, weight_unit, completed, notes)
                        VALUES (?, ?, ?, ?, ?, 0, '')
                    ''', (item_id, i, last_r, last_w, last_u))
            elif new_sets < curr_len:
                cursor.execute('DELETE FROM daily_workout_sets WHERE item_id = ? AND set_number > ?', (item_id, new_sets))

        if weight_unit is not None:
            cursor.execute('UPDATE daily_workout_sets SET weight_unit = ? WHERE item_id = ?', (new_unit, item_id))

        if completed is not None:
            cursor.execute('UPDATE daily_workout_sets SET completed = ? WHERE item_id = ?', (new_completed, item_id))

        if description is not None and d.get('exercise_id'):
            cursor.execute('UPDATE exercises SET description = ? WHERE id = ?', (new_desc, d['exercise_id']))

        conn.commit()
        cursor.execute('SELECT * FROM daily_workout_items WHERE id = ?', (item_id,))
        updated = dict(cursor.fetchone())
        _enrich_item_with_sets(cursor, updated)
        updated['last_session'] = get_last_session_for_exercise(updated['exercise_name'], before_date=updated['date'])
        return updated

def delete_day_exercise(item_id):
    """Elimina un ejercicio del día."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM daily_workout_items WHERE id = ?', (item_id,))
        conn.commit()
        return cursor.rowcount > 0

def get_calendar_month_summary(year, month):
    """Devuelve el resumen de actividades y volumen real (reps * peso) por cada día del mes."""
    prefix = f"{year:04d}-{month:02d}%"
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT i.date,
                   COUNT(DISTINCT i.id) as total_exercises,
                   COUNT(DISTINCT CASE WHEN i.completed = 1 THEN i.id END) as completed_exercises
            FROM daily_workout_items i
            WHERE i.date LIKE ?
            GROUP BY i.date
            ORDER BY i.date ASC
        ''', (prefix,))
        rows = cursor.fetchall()

        cursor.execute('''
            SELECT i.date,
                   COALESCE(SUM(s.reps * s.weight), 0) as sets_volume,
                   COUNT(s.id) as sets_count
            FROM daily_workout_items i
            LEFT JOIN daily_workout_sets s ON i.id = s.item_id
            WHERE i.date LIKE ?
            GROUP BY i.date
        ''', (prefix,))
        vol_map = {r['date']: r['sets_volume'] for r in cursor.fetchall()}

        result = {}
        for r in rows:
            dt = r['date']
            vol = vol_map.get(dt, 0.0) or 0.0
            result[dt] = {
                'total': r['total_exercises'],
                'completed': r['completed_exercises'],
                'volume': round(vol, 1),
                'status': 'completed' if r['completed_exercises'] == r['total_exercises'] and r['total_exercises'] > 0 else 'in_progress'
            }
        return result

def get_exercise_history(exercise_name, limit=30):
    """Devuelve la bitácora histórica completa de un ejercicio incluyendo el desglose serie por serie."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM daily_workout_items
            WHERE LOWER(exercise_name) = LOWER(?)
            ORDER BY date DESC, id DESC
            LIMIT ?
        ''', (exercise_name.strip(), limit))
        rows = cursor.fetchall()
        result = []
        for r in rows:
            d = dict(r)
            _enrich_item_with_sets(cursor, d)
            result.append(d)
        conn.commit()
        return result

def get_personal_logbook(limit=30):
    """Devuelve la bitácora cronológica con los entrenamientos realizados fecha por fecha y el detalle de series."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT date, 
                   COUNT(*) as total_exercises,
                   SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_exercises,
                   SUM(sets) as total_sets
            FROM daily_workout_items
            GROUP BY date
            ORDER BY date DESC
            LIMIT ?
        ''', (limit,))
        date_rows = cursor.fetchall()
        logbook = []
        for dr in date_rows:
            d_dict = dict(dr)
            cursor.execute('''
                SELECT * FROM daily_workout_items
                WHERE date = ?
                ORDER BY order_index ASC, id ASC
            ''', (dr['date'],))
            items = []
            day_vol = 0.0
            for it in cursor.fetchall():
                it_dict = dict(it)
                _enrich_item_with_sets(cursor, it_dict)
                day_vol += it_dict.get('total_volume', 0.0)
                items.append(it_dict)
            d_dict['total_volume'] = round(day_vol, 1)
            d_dict['exercises'] = items
            logbook.append(d_dict)
        conn.commit()
        return logbook

def update_exercise_details(exercise_id, name, description, equipment, muscle_group, default_sets=4, default_reps='10-12', default_weight=0.0, template_sets=None):
    """Permite editar cualquier ejercicio de la biblioteca, incluyendo sus series progresivas base."""
    with get_db() as conn:
        cursor = conn.cursor()
        if template_sets and isinstance(template_sets, list) and len(template_sets) > 0:
            default_sets = len(template_sets)
            default_weight = max((float(s.get('weight') or 0.0) for s in template_sets), default=0.0)
            reps_list = [str(_parse_reps_int(s.get('reps'), 10)) for s in template_sets]
            default_reps = reps_list[0] if len(set(reps_list)) == 1 else '-'.join(reps_list[:4])

        cursor.execute('''
            UPDATE exercises
            SET name = ?, description = ?, equipment = ?, muscle_group = ?, default_sets = ?, default_reps = ?, default_weight = ?
            WHERE id = ?
        ''', (name.strip(), description.strip(), equipment.strip(), muscle_group.strip(), int(default_sets), str(default_reps).strip(), float(default_weight), exercise_id))
        
        if template_sets and isinstance(template_sets, list):
            _save_exercise_template_sets(cursor, exercise_id, template_sets)

        conn.commit()
        return cursor.rowcount > 0

# ==================== ESTADÍSTICAS Y SOBRECARGA PROGRESIVA ====================

def get_stats_overview():
    """Devuelve KPIs generales de progreso, lista de ejercicios entrenados y actividad reciente."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(DISTINCT date) as total_days, COUNT(*) as total_items FROM daily_workout_items')
        counts = dict(cursor.fetchone())

        cursor.execute('SELECT COUNT(*) as total_sets, COALESCE(SUM(reps * weight), 0) as total_vol, COALESCE(MAX(weight), 0) as max_w FROM daily_workout_sets')
        s_stats = dict(cursor.fetchone())

        cursor.execute('''
            SELECT i.exercise_name, s.weight
            FROM daily_workout_sets s
            JOIN daily_workout_items i ON s.item_id = i.id
            ORDER BY s.weight DESC
            LIMIT 1
        ''')
        pr_row = cursor.fetchone()
        pr_exercise = pr_row['exercise_name'] if pr_row else '-'

        cursor.execute('''
            SELECT exercise_name, COUNT(DISTINCT date) as sessions, MAX(date) as last_date
            FROM daily_workout_items
            GROUP BY LOWER(exercise_name)
            ORDER BY sessions DESC, last_date DESC
        ''')
        exercises_list = [dict(r) for r in cursor.fetchall()]

        cursor.execute('''
            SELECT i.date, COALESCE(SUM(s.reps * s.weight), 0) as volume, COUNT(s.id) as sets_count
            FROM daily_workout_items i
            LEFT JOIN daily_workout_sets s ON i.id = s.item_id
            GROUP BY i.date
            ORDER BY i.date DESC
            LIMIT 14
        ''')
        recent_activity = [dict(r) for r in cursor.fetchall()]
        recent_activity.reverse()

        return {
            'total_days': counts['total_days'] or 0,
            'total_exercises_logged': counts['total_items'] or 0,
            'total_sets': s_stats['total_sets'] or 0,
            'total_volume': round(s_stats['total_vol'] or 0.0, 1),
            'max_weight_ever': round(s_stats['max_w'] or 0.0, 1),
            'pr_exercise': pr_exercise,
            'exercises_with_history': exercises_list,
            'recent_activity': recent_activity
        }

def get_exercise_progression_stats(exercise_name):
    """Devuelve series temporales de fuerza (peso máx, 1RM estimado, volumen) y desglose por serie de cada sesión."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM daily_workout_items
            WHERE LOWER(exercise_name) = LOWER(?)
            ORDER BY date ASC, id ASC
        ''', (exercise_name.strip(),))
        rows = cursor.fetchall()

        sessions = []
        pr_weight = 0.0
        pr_volume = 0.0
        pr_1rm = 0.0

        for r in rows:
            d = dict(r)
            _enrich_item_with_sets(cursor, d)
            
            best_1rm = 0.0
            for s in d['sets_detail']:
                w = float(s.get('weight') or 0.0)
                reps = _parse_reps_int(s.get('reps'), 0)
                epley = w * (1.0 + (reps / 30.0)) if reps > 1 else w
                if epley > best_1rm:
                    best_1rm = epley

            d['estimated_1rm'] = round(best_1rm, 1)
            if d['max_weight'] > pr_weight:
                pr_weight = d['max_weight']
            if d['total_volume'] > pr_volume:
                pr_volume = d['total_volume']
            if d['estimated_1rm'] > pr_1rm:
                pr_1rm = d['estimated_1rm']

            sessions.append(d)

        conn.commit()
        return {
            'exercise_name': exercise_name,
            'prs': {
                'max_weight': round(pr_weight, 1),
                'max_volume': round(pr_volume, 1),
                'max_1rm': round(pr_1rm, 1),
                'total_sessions': len(sessions)
            },
            'sessions': sessions
        }
