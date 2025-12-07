import sqlite3
import csv
import os

DB_NAME = 'database.db'

# --- FUNKCJE POMOCNICZE ---
def clean_coord(coord):
    """Zamienia polski przecinek na kropkę i konwertuje na float."""
    if not coord: return 0.0
    try:
        return float(coord.replace(',', '.').strip())
    except ValueError:
        return 0.0

def clean_text(text):
    """Usuwa białe znaki."""
    return text.strip() if text else ""

# --- TWORZENIE TABEL ---
def make_database():
    if os.path.exists(DB_NAME):
        os.remove(DB_NAME)
        print("Usunięto starą wersję bazy.")

    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()

    execution = '''
    PRAGMA foreign_keys = ON;

    CREATE TABLE Statue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE, 
        location_name TEXT,
        image_path TEXT,
        location_lat REAL,
        location_lon REAL,
        description TEXT DEFAULT 'Szukaj w pobliżu...'
    );

    CREATE TABLE Quiz (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        quiz_question TEXT,
        option_a TEXT,
        option_b TEXT,
        option_c TEXT,
        correct_answer TEXT,
        FOREIGN KEY(name) REFERENCES Statue(name)
    );

    CREATE TABLE Activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        lat REAL,
        lon REAL,
        target_age_group TEXT
    );
    '''
    try:
        c.executescript(execution)
        print("Tabele utworzone pomyślnie.")
    except sqlite3.Error as e:
        print(f"Błąd SQL: {e}")
    finally:
        conn.commit()
        conn.close()

# --- ŁADOWANIE DANYCH ---

def load_statues(filename):
    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()
    print(f"--> Przetwarzanie {filename}...")

    try:
        with open(filename, encoding='utf-8') as csvfile:
            reader = csv.reader(csvfile, delimiter=';')
            next(reader, None) # Pomiń nagłówek

            for row in reader:
                if len(row) < 7: continue 
                
                # CSV: id;name;location;link;image;lat;lon
                name = clean_text(row[1])
                loc_name = clean_text(row[2])
                image = clean_text(row[4])
                lat = clean_coord(row[5])
                lon = clean_coord(row[6])

                cur.execute("""
                    INSERT OR IGNORE INTO Statue (name, location_name, image_path, location_lat, location_lon)
                    VALUES (?, ?, ?, ?, ?)
                """, (name, loc_name, image, lat, lon))
                
    except Exception as e:
        print(f"Błąd w load_statues: {e}")
    
    conn.commit()
    conn.close()

def load_lat_lon_fix(filename):
    """Nadpisuje współrzędne z pliku lat_lon.csv (są dokładniejsze)"""
    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()
    print(f"--> Aktualizacja współrzędnych z {filename}...")

    try:
        with open(filename, encoding='utf-8') as csvfile:
            reader = csv.reader(csvfile, delimiter=';')
            next(reader, None)

            for row in reader:
                if len(row) < 3: continue
                # CSV: name;lat;lon
                name = clean_text(row[0])
                lat = clean_coord(row[1])
                lon = clean_coord(row[2])

                cur.execute("""
                    UPDATE Statue 
                    SET location_lat = ?, location_lon = ? 
                    WHERE name = ?
                """, (lat, lon, name))
                
    except Exception as e:
        print(f"Błąd w load_lat_lon_fix: {e}")

    conn.commit()
    conn.close()

def load_descriptions(filename):
    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()
    print(f"--> Dodawanie opisów z {filename}...")

    try:
        with open(filename, encoding='utf-8') as csvfile:
            reader = csv.reader(csvfile, delimiter=';')
            next(reader, None)

            for row in reader:
                if len(row) < 2: continue
                # CSV: name;description
                name = clean_text(row[0])
                desc = clean_text(row[1])

                cur.execute("UPDATE Statue SET description = ? WHERE name = ?", (desc, name))
                
    except Exception as e:
        print(f"Błąd w load_descriptions: {e}")

    conn.commit()
    conn.close()

def load_quiz(filename):
    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()
    print(f"--> Dodawanie pytań z {filename}...")

    try:
        with open(filename, encoding='utf-8') as csvfile:
            reader = csv.reader(csvfile, delimiter=';')
            next(reader, None)

            for row in reader:
                if len(row) < 6: continue
                # CSV: name;question;ansA;ansB;ansC;correct
                name = clean_text(row[0])
                quest = clean_text(row[1])
                a = clean_text(row[2])
                b = clean_text(row[3])
                c = clean_text(row[4])
                correct = clean_text(row[5]).lower() 

                cur.execute("""
                    INSERT INTO Quiz (name, quiz_question, option_a, option_b, option_c, correct_answer)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (name, quest, a, b, c, correct))
                
    except Exception as e:
        print(f"Błąd w load_quiz: {e}")

    conn.commit()
    conn.close()

# ladowanie aktywnosci
def load_activities(filename):
    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()
    print(f"--> Dodawanie aktywności z {filename}...")

    try:
        with open(filename, encoding='utf-8') as csvfile:
            reader = csv.reader(csvfile, delimiter=';')
            next(reader, None)  # pomiń nagłówek

            for row in reader:
                if len(row) < 5: 
                    continue
                
                name = clean_text(row[0])
                desc = clean_text(row[1])
                lat = clean_coord(row[2])
                lon = clean_coord(row[3])
                age_group = clean_text(row[4])

                cur.execute("""
                    INSERT INTO Activity (name, description, lat, lon, target_age_group)
                    VALUES (?, ?, ?, ?, ?)
                """, (name, desc, lat, lon, age_group))
                
    except Exception as e:
        print(f"Błąd w load_activities: {e}")

    conn.commit()
    conn.close()

# --- START ---
if __name__ == '__main__':
    make_database()
    
    # Kolejność ładowania
    load_statues('datas/pomniki.csv')
    load_lat_lon_fix('datas/lat_lon.csv')
    load_descriptions('datas/opisy.csv')
    load_quiz('datas/pytania.csv')
    load_activities('datas/activities.csv')
    
    print("\n--- GOTOWE! Baza danych utworzona. ---")
    print("Teraz uruchom: python app.py")