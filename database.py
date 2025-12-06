import sqlite3
import csv

def make_database():
    conn = sqlite3.connect('database.db')

    c = conn.cursor()

    execution = '''PRAGMA foreign_keys = ON;

-- 1. UŻYTKOWNICY
CREATE TABLE User (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT,
    total_score INTEGER DEFAULT 0, -- Suma punktów do rankingu
    badges_count INTEGER DEFAULT 0, -- Licznik zdobytych odznak
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. POMNIKI (Punkt zwiedzania)
-- Dodano: Pytania quizowe i współrzędne GPS
CREATE TABLE Statue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    image_path TEXT,
    location_lat REAL,   -- Szerokość geograficzna (do obliczania odległości)
    location_lon REAL   -- Długość geograficzna
);


CREATE TABLE Quiz (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    quiz_question TEXT,  -- Np. "Jaki kolor ma czapka?"
    option_a TEXT,       -- Odpowiedź A
    option_b TEXT,       -- Odpowiedź B
    option_c TEXT,       -- Odpowiedź C
    correct_answer TEXT -- Np. 'A'
);

-- 3. GASTRONOMIA (Nagroda po 2 punktach)
CREATE TABLE Gastronomy_Point (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT,           -- 'Kawiarnia', 'Restauracja', 'Lodziarnia'
    location_lat REAL,
    location_lon REAL,
    discount_description TEXT, -- Np. "-20% na hasło BYDGOSZCZ"
    image_path TEXT
);

-- 4. AKTYWNOŚCI (Nagroda końcowa etapu)
CREATE TABLE Activity_Point (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    location_lat REAL,
    location_lon REAL,
    
    -- Grupa docelowa (do filtrowania po wyborze wieku)
    -- Wartości np.: 'kids' (dzieci), 'students' (studenci), 'adults', 'all'
    target_age_group TEXT 
);

-- 5. SESJA GRY (Trwa od startu do "Zakończ Grę")
CREATE TABLE Game_Session (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    
    selected_age_group TEXT, -- Wybór gracza na początku
    selected_mode TEXT,      -- Wybór gracza na początku
    
    session_score INTEGER DEFAULT 0, -- Punkty tylko z tej gry
    is_completed BOOLEAN DEFAULT 0,
    
    FOREIGN KEY (user_id) REFERENCES User(id)
);

-- 6. ZDJĘCIA Z SESJI (Do Photo Dump)
CREATE TABLE Session_Photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    statue_id INTEGER,
    photo_path TEXT, -- Ścieżka do pliku na serwerze
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES Game_Session(id),
    FOREIGN KEY (statue_id) REFERENCES Statue(id)
);

-- 7. HISTORIA ODWIEDZIN (Żeby nie losować 2x tego samego w jednej grze)
CREATE TABLE Visited_Statues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    statue_id INTEGER,
    
    FOREIGN KEY (session_id) REFERENCES Game_Session(id),
    FOREIGN KEY (statue_id) REFERENCES Statue(id)
);

-- 8. ODZNAKI (System nagród)
CREATE TABLE User_Badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    badge_name TEXT, -- Np. "Odkrywca", "Fotograf"
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES User(id)
);'''
    try:
        c.executescript(execution)
        print("Baza danych została pomyślnie utworzona.")
    except sqlite3.Error as e:
        print(f"Wystąpił błąd podczas tworzenia bazy: {e}")
    finally:
        conn.commit()
        conn.close()



def get_db_connection():
    conn = sqlite3.connect('database.db')

    conn.execute("PRAGMA foreign_keys = ON")

    conn.row_factory = sqlite3.Row
    return conn


def load_statues_csv_to_base(filename):
    conn = sqlite3.connect('database.db')

    cur = conn.cursor()


    with open(filename) as csvfile:
        reader = csv.reader(csvfile)
        for row in reader:
            execc = "INSERT INTO STATUE(name, description, img_path) VALUES ()"
            cur.execute(execc)


    conn.commit()
    conn.close()



def load_quiz_csv_to_base(filename):
    conn = sqlite3.connect('database.db')

    cur = conn.cursor()


    with open(filename) as csvfile:
        reader = csv.reader(csvfile)
        for row in reader:
            execc = "INSERT INTO QUIZ(name, quiz_question, option_a, option_b, option_c) VALUES ()"
            cur.execute(execc)


    conn.commit()
    conn.close()






if __name__ == '__main__':
    pass






