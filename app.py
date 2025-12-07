from flask import Flask, jsonify, send_from_directory, request
import sqlite3
import os

# Zakładamy, że pliki HTML/CSS/JS są w folderze 'style'
app = Flask(__name__, static_folder='style')

def get_db_connection():
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

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

        item = {
            'id': statue['id'],
            'name': statue['name'],
            'lat': statue['location_lat'],
            'lng': statue['location_lon'],
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

            # Dodajemy domyślne rekomendacje
            'recommendations': [
                { 'icon': '⭐', 'name': 'Ciekawe miejsce', 'desc': 'Rozejrzyj się wokoło!' }
            ]
        }
        combined_data.append(item)

    return jsonify(combined_data)


def fetch_activities(age_group):
    conn = get_db_connection()
    cur = conn.cursor()

    search_group = age_group
    if age_group == '26-50':
        search_group = '25-50'

    print(f"DEBUG: Szukam aktywności dla grupy: {search_group}")  # Pomoże w konsoli

    # Pobieramy aktywności
    cur.execute(
        "SELECT name, description, lat, lon, 'activity' as category FROM Activity WHERE target_age_group = ? ORDER BY RANDOM()",
        (search_group,))
    rows = cur.fetchall()
    conn.close()

    results = [dict(r) for r in rows]
    print(f"DEBUG: Znaleziono aktywności: {len(results)}")
    return results


def fetch_gastronomy(age_group):
    conn = get_db_connection()
    cur = conn.cursor()

    # Logika doboru typu lokalu do wieku
    allowed_types = []

    # Obsługa 18-25
    if age_group == '18-25':
        allowed_types = ['BISTRO', 'LODZIARNIA', 'KAWIARNIA', 'RESTAURACJA']

        # Obsługa środkowego przedziału (zarówno 25-50 jak i 26-50)
    elif age_group in ['25-50', '26-50']:
        allowed_types = ['RESTAURACJA', 'BISTRO', 'KAWIARNIA']

    # Obsługa seniorów
    elif age_group == '50+':
        allowed_types = ['KAWIARNIA', 'RESTAURACJA', 'LODZIARNIA']

    # Domyślnie (fallback)
    else:
        allowed_types = ['RESTAURACJA', 'BISTRO', 'KAWIARNIA', 'LODZIARNIA']

    # Budowanie zapytania SQL
    placeholders = ','.join('?' for _ in allowed_types)
    query = f"SELECT name, description, type, lat, lon, discount_description, 'gastronomy' as category FROM Gastronomy WHERE type IN ({placeholders}) ORDER BY RANDOM()"

    cur.execute(query, allowed_types)
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.route("/api/activities/<age_group>")
def activities(age_group):
    return jsonify(fetch_activities(age_group))


@app.route("/api/recommendations/<age_group>")
def get_recommendations(age_group):
    acts = fetch_activities(age_group)
    gastro = fetch_gastronomy(age_group)

    return jsonify({
        'activities': acts,
        'gastronomy': gastro
    })


@app.route('/api/save-score', methods=['POST'])
def save_score():
    data = request.json
    username = data.get('username')
    score_delta = data.get('score')  # Ile punktów dodać
    visited_delta = data.get('visited')  # Ile miejsc dodać (zazwyczaj 1)

    if not username:
        return jsonify({'status': 'error', 'message': 'Brak nicku'}), 400

    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("SELECT total_score, total_visited FROM Leaderboard WHERE username = ?", (username,))
    row = cur.fetchone()

    if row:
        # ISTNIEJE: Dodajemy do starych wartości
        new_total_score = row['total_score'] + (score_delta or 0)
        new_total_visited = row['total_visited'] + (visited_delta or 0)

        cur.execute("UPDATE Leaderboard SET total_score = ?, total_visited = ? WHERE username = ?",
                    (new_total_score, new_total_visited, username))
    else:
        # NIE ISTNIEJE: Tworzymy (z uwzględnieniem pierwszych punktów)
        cur.execute("INSERT INTO Leaderboard (username, total_score, total_visited) VALUES (?, ?, ?)",
                    (username, score_delta or 0, visited_delta or 0))

    conn.commit()
    conn.close()

    return jsonify({'status': 'success'})


@app.route('/api/leaderboard')
def get_leaderboard():
    conn = get_db_connection()
    # Pobieramy TOP 10 graczy posortowanych malejąco
    top_players = conn.execute(
        "SELECT username, total_score FROM Leaderboard ORDER BY total_score DESC LIMIT 10").fetchall()
    conn.close()

    # Zamieniamy na listę słowników
    leaderboard_data = [{'username': row['username'], 'score': row['total_score']} for row in top_players]

    return jsonify(leaderboard_data)


@app.route('/api/user-stats/<username>')
def get_user_stats(username):
    conn = get_db_connection()
    cur = conn.cursor()
    # Pobieramy ile user ma punktów i ile odwiedził miejsc łącznie
    row = cur.execute("SELECT total_score, total_visited FROM Leaderboard WHERE username = ?", (username,)).fetchone()
    conn.close()

    if row:
        return jsonify({'total_score': row['total_score'], 'total_visited': row['total_visited']})
    else:
        # Nowy gracz ma 0
        return jsonify({'total_score': 0, 'total_visited': 0})

if __name__ == '__main__':
    print("Serwer działa! Wejdź na: http://127.0.0.1:5000")
    app.run(debug=True)