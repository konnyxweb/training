from flask import Flask, render_template, request, jsonify
from datetime import datetime, date
import database
import os

app = Flask(__name__)

# Asegurar que la base de datos y datos semilla se inicialicen
database.init_db()

@app.route('/')
def index():
    return render_template('index.html')

# ==================== ESTADO INICIAL RÁPIDO ====================
@app.route('/api/initial-state', methods=['GET'])
def get_initial_state():
    try:
        from datetime import date
        today_str = date.today().isoformat()
        now = datetime.now()

        students = database.get_students()
        exercises = database.get_exercises()
        muscle_groups = database.get_muscle_groups()
        recent_logs = database.get_recent_logs(10)
        
        # Datos del sistema personal
        today_exercises = database.get_day_exercises(today_str)
        month_summary = database.get_calendar_month_summary(now.year, now.month)
        personal_logbook = database.get_personal_logbook(limit=20)
        
        # Si hay alumnos, cargar las rutinas y planes del primero por defecto
        first_student_routines = []
        first_student_plans = []
        first_routine_details = None
        if students:
            first_student_id = students[0]['id']
            first_student_routines = database.get_routines_by_student(first_student_id)
            first_student_plans = database.get_student_plans(first_student_id)
            if first_student_routines:
                first_routine_details = database.get_routine_details(first_student_routines[0]['id'])
        
        return jsonify({
            'success': True,
            'today': today_str,
            'today_exercises': today_exercises,
            'month_summary': month_summary,
            'personal_logbook': personal_logbook,
            'students': students,
            'exercises': exercises,
            'muscle_groups': muscle_groups,
            'recent_logs': recent_logs,
            'active_student_routines': first_student_routines,
            'active_student_plans': first_student_plans,
            'active_routine': first_routine_details
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== ALUMNOS ====================
@app.route('/api/students', methods=['GET'])
def get_students():
    try:
        students = database.get_students()
        return jsonify({'success': True, 'students': students})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/students', methods=['POST'])
def create_student():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    goal = data.get('goal', '').strip()
    if not name or not goal:
        return jsonify({'success': False, 'error': 'Nombre y objetivo son obligatorios'}), 400
    
    try:
        student_id = database.create_student(
            name=name,
            email=data.get('email', ''),
            phone=data.get('phone', ''),
            goal=goal,
            weight=float(data.get('weight', 70)),
            height=float(data.get('height', 175)),
            level=data.get('level', 'Intermedio'),
            notes=data.get('notes', '')
        )
        return jsonify({'success': True, 'id': student_id, 'students': database.get_students()})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/students/<int:student_id>', methods=['PUT'])
def update_student(student_id):
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    goal = data.get('goal', '').strip()
    if not name or not goal:
        return jsonify({'success': False, 'error': 'Nombre y objetivo son obligatorios'}), 400
    
    try:
        success = database.update_student(
            student_id=student_id,
            name=name,
            email=data.get('email', ''),
            phone=data.get('phone', ''),
            goal=goal,
            weight=float(data.get('weight', 70)),
            height=float(data.get('height', 175)),
            level=data.get('level', 'Intermedio'),
            notes=data.get('notes', '')
        )
        return jsonify({'success': success, 'students': database.get_students()})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/students/<int:student_id>', methods=['DELETE'])
def delete_student(student_id):
    try:
        success = database.delete_student(student_id)
        return jsonify({'success': success, 'students': database.get_students()})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== BIBLIOTECA DE EJERCICIOS ====================
@app.route('/api/exercises', methods=['GET'])
def get_exercises():
    muscle_group = request.args.get('muscle_group')
    query = request.args.get('q')
    try:
        exercises = database.get_exercises(muscle_group, query)
        return jsonify({'success': True, 'exercises': exercises})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/exercises', methods=['POST'])
def create_exercise():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    muscle_group = data.get('muscle_group', '').strip()
    equipment = data.get('equipment', '').strip()
    if not name or not muscle_group or not equipment:
        return jsonify({'success': False, 'error': 'Nombre, grupo muscular y equipamiento son requeridos'}), 400
    
    try:
        exercise_id = database.create_exercise(
            name=name,
            muscle_group=muscle_group,
            secondary_muscle=data.get('secondary_muscle', ''),
            equipment=equipment,
            difficulty=data.get('difficulty', 'Intermedio'),
            description=data.get('description', ''),
            default_sets=int(data.get('default_sets', 4)),
            default_reps=str(data.get('default_reps', '10-12')),
            default_weight=float(data.get('default_weight', 20.0)),
            default_rest=str(data.get('default_rest', '90 seg')),
            template_sets=data.get('template_sets')
        )
        return jsonify({
            'success': True, 
            'id': exercise_id, 
            'exercises': database.get_exercises(),
            'muscle_groups': database.get_muscle_groups()
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/exercises/<int:exercise_id>', methods=['DELETE'])
def delete_exercise(exercise_id):
    try:
        success = database.delete_exercise(exercise_id)
        return jsonify({
            'success': success, 
            'exercises': database.get_exercises(),
            'muscle_groups': database.get_muscle_groups()
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== RUTINAS ====================
@app.route('/api/students/<int:student_id>/routines', methods=['GET'])
def get_student_routines(student_id):
    try:
        routines = database.get_routines_by_student(student_id)
        return jsonify({'success': True, 'routines': routines})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/routines/<int:routine_id>', methods=['GET'])
def get_routine(routine_id):
    try:
        routine = database.get_routine_details(routine_id)
        if not routine:
            return jsonify({'success': False, 'error': 'Rutina no encontrada'}), 404
        return jsonify({'success': True, 'routine': routine})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/routines', methods=['POST'])
def save_routine():
    data = request.get_json() or {}
    student_id = data.get('student_id')
    name = data.get('name', '').strip()
    if not student_id or not name:
        return jsonify({'success': False, 'error': 'Debe seleccionar un alumno y asignar nombre a la rutina'}), 400
    
    routine_id = data.get('routine_id')
    day_tag = data.get('day_tag', 'General')
    notes = data.get('notes', '')
    items = data.get('items', [])
    
    try:
        saved_id = database.save_routine(
            student_id=student_id,
            name=name,
            day_tag=day_tag,
            notes=notes,
            items=items,
            routine_id=routine_id
        )
        saved_routine = database.get_routine_details(saved_id)
        updated_student_routines = database.get_routines_by_student(student_id)
        return jsonify({
            'success': True,
            'routine': saved_routine,
            'routines': updated_student_routines,
            'message': 'Rutina guardada exitosamente'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/routines/<int:routine_id>', methods=['DELETE'])
def delete_routine(routine_id):
    student_id = request.args.get('student_id')
    try:
        success = database.delete_routine(routine_id)
        routines = []
        if student_id:
            routines = database.get_routines_by_student(student_id)
        return jsonify({'success': success, 'routines': routines})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== CONTROL Y SEGUIMIENTO (LOGS) ====================
@app.route('/api/logs', methods=['GET'])
def get_recent_logs():
    student_id = request.args.get('student_id')
    try:
        if student_id:
            logs = database.get_student_logs(int(student_id))
        else:
            logs = database.get_recent_logs(25)
        return jsonify({'success': True, 'logs': logs})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/logs', methods=['POST'])
def create_log():
    data = request.get_json() or {}
    student_id = data.get('student_id')
    routine_name = data.get('routine_name', '').strip()
    if not student_id or not routine_name:
        return jsonify({'success': False, 'error': 'Alumno y nombre de rutina requeridos'}), 400
    
    try:
        log_id = database.create_workout_log(
            student_id=student_id,
            routine_id=data.get('routine_id'),
            routine_name=routine_name,
            log_date=data.get('date'),
            duration_minutes=int(data.get('duration_minutes', 50)),
            perceived_exertion=int(data.get('perceived_exertion', 8)),
            notes=data.get('notes', ''),
            details_json=data.get('details', [])
        )
        return jsonify({
            'success': True, 
            'id': log_id, 
            'logs': database.get_student_logs(student_id),
            'students': database.get_students()
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/logs/<int:log_id>', methods=['DELETE'])
def delete_log(log_id):
    student_id = request.args.get('student_id')
    try:
        success = database.delete_workout_log(log_id)
        logs = database.get_student_logs(int(student_id)) if student_id else database.get_recent_logs(25)
        return jsonify({'success': success, 'logs': logs})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== PLANIFICACIÓN Y MACROCICLOS (3, 6, 12 MESES) ====================
@app.route('/api/students/<int:student_id>/plans', methods=['GET'])
def get_plans(student_id):
    try:
        plans = database.get_student_plans(student_id)
        return jsonify({'success': True, 'plans': plans})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/plans/<int:plan_id>', methods=['GET'])
def get_plan(plan_id):
    try:
        plan = database.get_plan_details(plan_id)
        if not plan:
            return jsonify({'success': False, 'error': 'Plan no encontrado'}), 404
        return jsonify({'success': True, 'plan': plan})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/plans', methods=['POST'])
def save_plan():
    data = request.get_json() or {}
    student_id = data.get('student_id')
    name = data.get('name', '').strip()
    if not student_id or not name:
        return jsonify({'success': False, 'error': 'Alumno y nombre del plan requeridos'}), 400

    try:
        plan_id = database.save_plan(
            student_id=int(student_id),
            name=name,
            duration_months=int(data.get('duration_months', 3)),
            start_date=data.get('start_date', ''),
            goal=data.get('goal', ''),
            weekly_schedule=data.get('weekly_schedule', {}),
            notes=data.get('notes', ''),
            plan_id=data.get('plan_id')
        )
        return jsonify({
            'success': True,
            'plan_id': plan_id,
            'plans': database.get_student_plans(student_id),
            'message': 'Plan y calendario generados exitosamente'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/plans/<int:plan_id>', methods=['DELETE'])
def delete_plan(plan_id):
    student_id = request.args.get('student_id')
    try:
        success = database.delete_plan(plan_id)
        plans = []
        if student_id:
            plans = database.get_student_plans(int(student_id))
        return jsonify({'success': success, 'plans': plans})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== CALENDARIO ====================
@app.route('/api/students/<int:student_id>/calendar', methods=['GET'])
def get_calendar(student_id):
    from datetime import date
    today = date.today()
    year = int(request.args.get('year', today.year))
    month = int(request.args.get('month', today.month))
    try:
        events = database.get_calendar_events_for_month(student_id, year, month)
        return jsonify({'success': True, 'events': events, 'year': year, 'month': month})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/calendar/event', methods=['POST'])
def save_calendar_event():
    data = request.get_json() or {}
    student_id = data.get('student_id')
    event_date = data.get('date')
    routine_name = data.get('routine_name', '').strip()
    if not student_id or not event_date or not routine_name:
        return jsonify({'success': False, 'error': 'Alumno, fecha y nombre de rutina requeridos'}), 400

    try:
        event_id = database.save_calendar_event(
            student_id=int(student_id),
            event_date=event_date,
            routine_id=data.get('routine_id'),
            routine_name=routine_name,
            status=data.get('status', 'scheduled'),
            notes=data.get('notes', ''),
            plan_id=data.get('plan_id')
        )
        return jsonify({'success': True, 'event_id': event_id})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/calendar/event/<int:event_id>/status', methods=['PUT'])
def update_event_status(event_id):
    data = request.get_json() or {}
    status = data.get('status', 'completed')
    try:
        success = database.update_calendar_event_status(event_id, status)
        return jsonify({'success': success})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/calendar/event/<int:event_id>', methods=['DELETE'])
def delete_calendar_event(event_id):
    try:
        success = database.delete_calendar_event(event_id)
        return jsonify({'success': success})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== CALENDARIO PERSONAL Y BITÁCORA ====================

@app.route('/api/personal/calendar/month', methods=['GET'])
def get_personal_calendar_month():
    try:
        now = datetime.now()
        year = int(request.args.get('year', now.year))
        month = int(request.args.get('month', now.month))
        summary = database.get_calendar_month_summary(year, month)
        return jsonify({'success': True, 'year': year, 'month': month, 'summary': summary})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/personal/day/<date_str>', methods=['GET'])
def get_personal_day(date_str):
    try:
        items = database.get_day_exercises(date_str)
        return jsonify({'success': True, 'date': date_str, 'exercises': items})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/personal/day/<date_str>/exercises', methods=['POST'])
def add_personal_day_exercise(date_str):
    data = request.get_json() or {}
    try:
        item = database.add_exercise_to_day(
            date_str=date_str,
            exercise_id=data.get('exercise_id'),
            custom_name=data.get('name'),
            sets=data.get('sets'),
            reps=data.get('reps'),
            weight=data.get('weight'),
            weight_unit=data.get('weight_unit', 'kg'),
            notes=data.get('notes', ''),
            description=data.get('description', '')
        )
        return jsonify({'success': True, 'item': item})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/personal/day/exercises/<int:item_id>', methods=['PUT'])
def update_personal_day_exercise(item_id):
    data = request.get_json() or {}
    try:
        updated = database.update_day_exercise(
            item_id=item_id,
            sets=data.get('sets'),
            reps=data.get('reps'),
            weight=data.get('weight'),
            weight_unit=data.get('weight_unit'),
            notes=data.get('notes'),
            completed=data.get('completed'),
            description=data.get('description')
        )
        if not updated:
            return jsonify({'success': False, 'error': 'Ejercicio no encontrado'}), 404
        return jsonify({'success': True, 'item': updated})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/personal/day/exercises/<int:item_id>', methods=['DELETE'])
def delete_personal_day_exercise(item_id):
    try:
        success = database.delete_day_exercise(item_id)
        return jsonify({'success': success})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/personal/exercises/<path:exercise_name>/history', methods=['GET'])
def get_personal_exercise_history(exercise_name):
    try:
        history = database.get_exercise_history(exercise_name, limit=30)
        return jsonify({'success': True, 'exercise_name': exercise_name, 'history': history})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/personal/logbook', methods=['GET'])
def get_personal_logbook_api():
    try:
        limit = int(request.args.get('limit', 30))
        logbook = database.get_personal_logbook(limit=limit)
        return jsonify({'success': True, 'logbook': logbook})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/exercises/<int:exercise_id>', methods=['PUT'])
def update_exercise_details_api(exercise_id):
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'success': False, 'error': 'El nombre del ejercicio es obligatorio'}), 400
    try:
        success = database.update_exercise_details(
            exercise_id=exercise_id,
            name=name,
            description=data.get('description', ''),
            equipment=data.get('equipment', 'Mancuerna'),
            muscle_group=data.get('muscle_group', 'General'),
            default_sets=data.get('default_sets', 4),
            default_reps=data.get('default_reps', '10-12'),
            default_weight=data.get('default_weight', 0.0),
            template_sets=data.get('template_sets')
        )
        return jsonify({'success': success, 'exercises': database.get_exercises()})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/personal/day/exercises/<int:item_id>/sets', methods=['PUT'])
def save_personal_day_exercise_sets_api(item_id):
    data = request.get_json() or {}
    sets_list = data.get('sets_detail', [])
    try:
        updated = database.save_day_exercise_sets(item_id, sets_list)
        if not updated:
            return jsonify({'success': False, 'error': 'Ejercicio no encontrado'}), 404
        return jsonify({'success': True, 'item': updated})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/estadisticas')
def estadisticas_page():
    return render_template('estadisticas.html')

@app.route('/api/personal/stats/overview', methods=['GET'])
def get_personal_stats_overview_api():
    try:
        overview = database.get_stats_overview()
        return jsonify({'success': True, 'overview': overview})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/personal/stats/exercise/<path:exercise_name>', methods=['GET'])
def get_personal_stats_exercise_api(exercise_name):
    try:
        stats = database.get_exercise_progression_stats(exercise_name)
        return jsonify({'success': True, 'stats': stats})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500



import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print("===========================================================")
    print("[TRAINING] - Mi Bitacora y Calendario Personal de Entrenamiento")
    print(f"Servidor iniciado en: http://localhost:{port}")
    print("===========================================================")
    app.run(host='0.0.0.0', port=port, debug=True)

