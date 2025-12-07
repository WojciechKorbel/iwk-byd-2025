from flask import Flask, jsonify, send_from_directory
import sqlite3
import os

# Zakładamy, że pliki HTML/CSS/JS są w folderze 'style'
app = Flask(__name__, static_folder='style')

def get_db_connection():
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

# --- SERWOWANIE PLIKÓW ---

@app.route('/')
def index():
    return send_from_directory('style', 'index.html')

# Obsługa plików statycznych w folderze 'style' (np. css, js)
@app.route('/<path:filename>')
def serve_static(filename):
    # Najpierw szukamy w folderze style
    if os.path.exists(os.path.join('style', filename)):
        return send_from_directory('style', filename)
    # Potem w głównym folderze (np. jeśli script.js tam jest)
    return send_from_directory('.', filename)

# Obsługa obrazków z folderu 'datas'
@app.route('/datas/<path:filename>')
def serve_datas(filename):
    return send_from_directory('datas', filename)

# --- API (Backend dla gry) ---

@app.route('/api/game-data')
def game_data():
    conn = get_db_connection()
    
    # Pobieramy wszystkie pomniki i quizy
    statues = conn.execute('SELECT * FROM Statue').fetchall()
    quizzes = conn.execute('SELECT * FROM Quiz').fetchall()
    
    conn.close()
    
    combined_data = []
    
    for statue in statues:
        # Znajdujemy quiz pasujący do nazwy pomnika
        quiz = next((q for q in quizzes if q['name'] == statue['name']), None)
        
        # Budujemy obiekt IDEALNIE pasujący do Twojego script.js
        item = {
            'id': statue['id'],
            'name': statue['name'],
            'lat': statue['location_lat'],
            'lng': statue['location_lon'], # JS chce 'lng'
            
            # W CSV opis jest jeden, w JS używasz go jako hint i info
            'hint': statue['description'],
            'info': statue['description'],
            
            'image': statue['image_path'],
            
            'quiz': {
                'question': quiz['quiz_question'] if quiz else "Brak pytania w bazie.",
                'answers': {
                    'a': quiz['option_a'] if quiz else "",
                    'b': quiz['option_b'] if quiz else "",
                    'c': quiz['option_c'] if quiz else ""
                },
                'correct': quiz['correct_answer'] if quiz else 'a'
            },
            
            # Dodajemy domyślne rekomendacje, bo JS tego wymaga, a nie ma ich w CSV
            'recommendations': [
                { 'icon': '⭐', 'name': 'Ciekawe miejsce', 'desc': 'Rozejrzyj się wokoło!' }
            ]
        }
        combined_data.append(item)

    return jsonify(combined_data)

def fetch_activities(age_group):
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT name, description, lat, lon FROM Activity WHERE target_age_group = ?", (age_group,))
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.route("/api/activities/<age_group>")
def activities(age_group):
    return jsonify(fetch_activities(age_group))

if __name__ == '__main__':
    print("Serwer działa! Wejdź na: http://127.0.0.1:5000")
    app.run(debug=True)