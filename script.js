// ------------------------------------------------------------------------------------------------------------------------
// ZMIENNE POWITALNE
let userLevel = null;
let userAge = null;

// Ta funkcja uruchamia się DOPIERO jak CSV zostaną pobrane
function initGameAfterLoad() {
    if (targets.length === 0) return;

    const firstTarget = targets[0];

    // Aktualizujemy UI
    document.querySelector('.quest-title').innerText = `Cel: ${firstTarget.name}`;
    if(document.querySelector('.quest-riddle')) {
        document.querySelector('.quest-riddle').innerText = `"${firstTarget.hint}"`;
    }
    
    // Ustawiamy marker celu
    targetMarker.setLatLng([firstTarget.lat, firstTarget.lng]);
    
    // Aktualizujemy licznik
    document.getElementById('goal-board').innerText = `Cel: 0/${targets.length}`;
}

// Funkcja wyboru poziomu
function selectLevel(level, btnElement) {
    userLevel = level;
    const buttons = btnElement.parentElement.querySelectorAll('.opt-btn');
    buttons.forEach(b => b.classList.remove('selected'));
    btnElement.classList.add('selected');
}

// Funkcja wyboru wieku (działa tak samo)
function selectAge(age, btnElement) {
    userAge = age;
    const buttons = btnElement.parentElement.querySelectorAll('.opt-btn');
    buttons.forEach(b => b.classList.remove('selected'));
    btnElement.classList.add('selected');
}

// -------------------------------
// Funkcja START GRY
function startGame() {
    // Walidacja
    if (!userLevel || !userAge) {
        Swal.fire({
            icon: 'warning',
            title: 'Wybierz opcje!',
            text: 'Musisz zaznaczyć poziom trudności i wiek, aby ruszyć w drogę.',
            confirmButtonColor: '#003366'
        });
        return;
    }

    // czas startu
    gameStartTime = new Date();

    // Ukryj ekran powitalny
    const welcomeScreen = document.getElementById('welcome-screen');
    welcomeScreen.style.transition = "opacity 0.5s";
    welcomeScreen.style.opacity = "0";
    
    setTimeout(() => {
        welcomeScreen.style.display = "none";
        
        // Pokaż interfejs gry
        document.getElementById('game-ui-top').style.display = "flex";
        document.getElementById('game-ui-bottom').style.display = "block";
        
        if (userLevel === 'hard') {
            Swal.fire('Tryb Trudny!', 'W tym trybie wskazówki są mniej dokładne. Powodzenia!', 'info');
        }
    }, 500);
}

// -------------------------------------------------------------------------------------
// KONFIGURACJA DANYCH (ŁADOWANIE Z CSV)

// Zmienna na cele
let targets = [];

// Funkcja pomocnicza do konwersji współrzędnych
function parseCoord(coord) {
    if (typeof coord === 'string') {
        return parseFloat(coord.replace(',', '.'));
    }
    return coord;
}

// 3. Główna funkcja ładująca i łącząca 3 pliki CSV
async function loadGameData() {
    try {
        console.log("Ładowanie danych...");

        const [pomnikiRes, opisyRes, pytaniaRes] = await Promise.all([
            fetch('./pomniki.csv'),
            fetch('./opisy.csv'),
            fetch('./pytania.csv')
        ]);

        const pomnikiText = await pomnikiRes.text();
        const opisyText = await opisyRes.text();
        const pytaniaText = await pytaniaRes.text();

        // Parsowanie CSV
        const pomnikiData = Papa.parse(pomnikiText, { header: true, delimiter: ";", skipEmptyLines: true }).data;
        const opisyData = Papa.parse(opisyText, { header: true, delimiter: ";", skipEmptyLines: true }).data;
        const pytaniaData = Papa.parse(pytaniaText, { header: true, delimiter: ";", skipEmptyLines: true }).data;

        // ŁĄCZENIE DANYCH (Teraz łączymy po 'name', bo tak masz w plikach!)
        targets = pomnikiData.map(pomnik => {
            // Szukamy po nazwie, bo w plikach nie ma wspólnego ID
            const opisRow = opisyData.find(o => o.name === pomnik.name);
            const pytanieRow = pytaniaData.find(p => p.name === pomnik.name);

            // Zabezpieczenie na brak współrzędnych (żeby gra nie wybuchła, jeśli zapomnisz dodać lat/lon)
            // Domyślnie ustawi środek Bydgoszczy, jeśli w pliku będzie pusto.
            let latitude = parseCoord(pomnik.lat);
            let longitude = parseCoord(pomnik.lon);
            
            if (latitude === 0 || longitude === 0) {
                console.warn(`Brak współrzędnych dla: ${pomnik.name}. Używam domyślnych.`);
                // Możesz tu wpisać współrzędne "startowe" jako awaryjne
                latitude = 53.123; 
                longitude = 18.000;
            }

            return {
                id: pomnik.id,
                name: pomnik.name,
                lat: latitude,
                lng: longitude,
                
                // Opisy: w pliku masz kolumnę 'description'
                hint: opisRow ? opisRow.description : "Znajdź ten punkt na mapie!",
                info: opisRow ? opisRow.description : "Brak dodatkowego opisu.", // Używamy tego samego opisu, bo w pliku jest tylko jeden
                
                // Zdjęcie z Twojego pliku CSV
                image: pomnik.image || "https://via.placeholder.com/800x1200?text=Brak+Zdjecia",
                
                // Quiz: dopasowany do nazw kolumn w Twoim pliku (ansA, ansB, correct)
                quiz: {
                    question: pytanieRow ? pytanieRow.question : "Brak pytania dla tego miejsca.",
                    answers: {
                        'a': pytanieRow ? pytanieRow.ansA : "",
                        'b': pytanieRow ? pytanieRow.ansB : "",
                        'c': pytanieRow ? pytanieRow.ansC : ""
                    },
                    // W pliku masz 'A', 'B' - zamieniamy na małe litery 'a', 'b'
                    correct: pytanieRow ? pytanieRow.correct.toLowerCase().trim() : 'a'
                },
                
                // Rekomendacje (nie ma ich w CSV, więc dodaję domyślne)
                recommendations: [
                    { icon: '⭐', name: 'Atrakcja w pobliżu', desc: 'Warto zobaczyć!' }
                ]
            };
        });

        // Mieszamy kolejność
        targets.sort(() => Math.random() - 0.5);

        console.log("Dane załadowane poprawnie!", targets);
        
        // Inicjalizacja gry nowymi danymi
        initGameAfterLoad();

    } catch (error) {
        console.error("Błąd krytyczny:", error);
        alert("Błąd danych! Sprawdź czy dodałeś kolumny lat/lon do pomniki.csv");
    }
}

// Uruchamiamy ładowanie
loadGameData();

// -------------------------------------------------------------------------------------
// DALSZA CZĘŚĆ GRY (ZMIENNE I LOGIKA)

// Zmienne gry
let gameStartTime = null; 
let currentTargetIndex = 0; 
let currentScore = 0;
let completedQuests = 0;
let prevLng = 18.005;
let userName = "";

// Start (Opera Nova)
let currentLat = 53.123000;
let currentLng = 18.005000;

// --- MAPA ---
const map = L.map('map', { keyboard: false }).setView([currentLat, currentLng], 16);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// --- CEL I GRACZ ---
// Tworzymy markery, ale jeszcze ich nie ustawiamy (czekamy na dane)
let targetMarker = L.marker([0, 0]); 

const characterIcon = L.divIcon({
    className: 'custom-div-icon', 
    html: `
        <div id="player-wrapper" style="position: relative; width: 60px;">
            <div class="pro-avatar-container">
                <img src="https://img.freepik.com/free-psd/3d-illustration-person-with-sunglasses_23-2149436188.jpg?w=200" class="pro-avatar-img" alt="Avatar">
            </div>
            <div class="direction-arrow"></div>
        </div>
    `,
    iconSize: [60, 70], 
    iconAnchor: [30, 70], 
    popupAnchor: [0, -70]
});

let userMarker = L.marker([currentLat, currentLng], { icon: characterIcon }).addTo(map);

// ŚCIEŻKA (CZERWONA KRESKA)
let pathHistory = [];

// Tworzymy linię na mapie
const pathLine = L.polyline([], {
    color: '#ff0000',
    weight: 6,
    opacity: 0.8,
    lineJoin: 'round',
    lineCap: 'round',
    className: 'glowing-path' 
}).addTo(map);

// FUNKCJA WYGŁADZAJĄCA
function getSmoothPath(points) {
    if (points.length < 3) return points;

    let smoothPoints = [];
    smoothPoints.push(points[0]); 

    // Dla każdego punktu
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];   // Punkt A
        const p1 = points[i+1]; // Punkt B
        const Q = [0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1]];
        const R = [0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1]];
        smoothPoints.push(Q);
        smoothPoints.push(R);
    }
    smoothPoints.push(points[points.length - 1]); 
    return smoothPoints;
}

// ---------------------------------------------------------------------------------------------------------------------
// Funkcja START GRY
function startGame() {
    // Pobierz wpisane imię
    const nameInput = document.getElementById('username-input').value.trim();

    // Walidacja
    if (!userLevel || !userAge || nameInput === "") {
        Swal.fire({
            icon: 'warning',
            title: 'Uzupełnij dane!',
            text: 'Musisz wpisać nick oraz wybrać poziom i wiek.',
            confirmButtonColor: '#003366'
        });
        return;
    }

    userName = nameInput;

    gameStartTime = new Date();

    const welcomeScreen = document.getElementById('welcome-screen');
    welcomeScreen.style.transition = "opacity 0.5s";
    welcomeScreen.style.opacity = "0";
    
    setTimeout(() => {
        welcomeScreen.style.display = "none";
        document.getElementById('game-ui-top').style.display = "flex";
        document.getElementById('game-ui-bottom').style.display = "block";
        map.getContainer().focus(); 
    }, 500);
}

// ---------------------------------------------------------------------------------------------------------------------
// FUNKCJA AKTUALIZUJĄCA POZYCJE
function updatePosition(lat, lng) {
    // Aktualizacja zmiennych
    currentLat = lat;
    currentLng = lng;

    // RYSOWANIE ŚCIEŻKI
    pathHistory.push([currentLat, currentLng]);
    if (pathHistory.length > 500) pathHistory.shift();
    const roundedPath = getSmoothPath(pathHistory);
    pathLine.setLatLngs(roundedPath);

    // PRZESUWANIE GRACZA
    userMarker.setLatLng([currentLat, currentLng]);
   
    const iconDiv = userMarker.getElement();
    if (iconDiv) {
        iconDiv.classList.add('walking');
        clearTimeout(userMarker.walkTimeout);
        userMarker.walkTimeout = setTimeout(() => {
            iconDiv.classList.remove('walking');
        }, 300);
    }

    // Kamera podąża za graczem
    map.panTo([currentLat, currentLng]); 
    
    // OBLICZANIE DYSTANSU I UI
    const activeTarget = targets[currentTargetIndex];
    const dist = Math.floor(L.latLng(currentLat, currentLng).distanceTo(L.latLng(activeTarget.lat, activeTarget.lng)));
    
    const txt = document.getElementById('dist-text');
    const btn = document.getElementById('btn-action');

    if (btn.classList.contains('done')) return;

    if (dist < 30) {
        txt.innerText = "JESTEŚ NA MIEJSCU!";
        txt.style.color = "green";
        btn.innerText = "ODBIERZ ODZNAKĘ!";
        btn.style.background = "";
        btn.classList.add('active'); 
        btn.disabled = false;
    } else {
        txt.innerText = `Dystans: ${dist} metrów`;
        txt.style.color = "#CC3300";
        btn.innerText = "Jeszcze za daleko...";
        btn.style.background = "#ccc";
        btn.classList.remove('active');
        btn.disabled = true;
    }
}

// ---------------------------------------------------------------------------------------------------------------------
// STEROWANIE
map.on('click', function(e) { updatePosition(e.latlng.lat, e.latlng.lng); });

document.addEventListener('keydown', function(e) {
    const step = 0.0005;
    switch(e.key) {
        case "ArrowUp": updatePosition(currentLat + step, currentLng); break;
        case "ArrowDown": updatePosition(currentLat - step, currentLng); break;
        case "ArrowLeft": updatePosition(currentLat, currentLng - step); break;
        case "ArrowRight": updatePosition(currentLat, currentLng + step); break;
    }
});

// ---------------------------------------------------------------------------------------------------------------------
// WEJŚCIE NA EKRAN POMNIKA
function checkIn() { 
    const btn = document.getElementById('btn-action');
    if (btn.classList.contains('done')) return;

    // Pobierz dane aktualnego celu
    const activeTarget = targets[currentTargetIndex];

    // Wpisz tytuł i opis
    document.getElementById('mon-title').innerText = activeTarget.name;
    document.getElementById('mon-info').innerText = activeTarget.info || "Brak opisu.";
    
    // Ustaw tło ze zdjęciem
    const bgDiv = document.getElementById('monument-bg');
    const imgUrl = activeTarget.image || 'https://via.placeholder.com/800x1200?text=Brak+Zdjecia';
    
    bgDiv.style.backgroundImage = `url('${imgUrl}')`;

    // Pokaż ekran pomnika
    document.getElementById('monument-screen').style.display = 'flex';
}

// Funkcja zamykania ekranu (X)
function closeMonumentScreen() {
    document.getElementById('monument-screen').style.display = 'none';
}

// ---------------------------------------------------------------------------------------------------------------------
// START QUIZU
function startQuiz() {
    const activeTarget = targets[currentTargetIndex];

    // Konfiguracja SweetAlert
    Swal.fire({
        title: 'ZAGADKA!',
        text: activeTarget.quiz.question,
        icon: 'question',
        input: 'radio',
        inputOptions: activeTarget.quiz.answers,
        confirmButtonText: 'Sprawdź',
        confirmButtonColor: '#003366',
        inputValidator: (value) => { if (!value) return 'Wybierz odpowiedź!' },
        didOpen: () => {
            document.querySelector('.swal2-container').style.zIndex = '10000';
        }
    }).then((result) => {
        if (result.isDismissed) return;

        // --- Logika Punktów ---
        const userAnswer = result.value;
        let pointsEarned = 100;
        let msgTitle = "DOBRE CHĘCI...";
        let msgIcon = "info";
        let message = `Dobra próba! <b>+100 pkt</b> za dotarcie do celu.`;

        if (userAnswer === activeTarget.quiz.correct) {
            pointsEarned += 50;
            msgTitle = "GENIALNIE!";
            msgIcon = "success";
            message = "Dobra odpowiedź! <b>150 punktów</b> (100 + 50 bonus).";
            confetti();
        }

        // Zamknij ekran ze zdjęciem (wracamy do mapy)
        closeMonumentScreen();

        // Zapisz wyniki
        currentScore += pointsEarned;
        completedQuests++;
        document.getElementById('score-board').innerText = `🏆 Pkt: ${currentScore}`;
        document.getElementById('goal-board').innerText = `Cel: ${completedQuests}/${targets.length}`;

        // Zablokuj przycisk mapy
        const btn = document.getElementById('btn-action');
        btn.innerText = "ZADANIE UKOŃCZONE!";
        btn.style.background = "#28a745";
        btn.classList.add('done');

        // Pokaż wynik i rekomendacje
        Swal.fire({
            title: msgTitle,
            html: message,
            icon: msgIcon,
            iconColor: '#28a745',
            showDenyButton: true,
            denyButtonText: '👀 Co warto zobaczyć obok?',
            denyButtonColor: '#007bff',
            confirmButtonText: 'Lecimy dalej ▶',
            confirmButtonColor: '#28a745',
            customClass: { popup: 'epic-popup' }
        }).then((res) => {
            const nextStep = () => {
                if (completedQuests >= targets.length) showResults();
                else loadNextLevel();
            };

            if (res.isDenied) {
                // Rekomendacje
                let recHtml = '<div style="text-align: left;">';
                if(activeTarget.recommendations) {
                    activeTarget.recommendations.forEach(rec => {
                        recHtml += `
                            <div style="background: #f8f9fa; padding: 10px; border-radius: 10px; margin-bottom: 10px; border-left: 5px solid #007bff;">
                                <strong style="font-size: 18px;">${rec.icon} ${rec.name}</strong><br>
                                <span style="color: #666; font-size: 14px;">${rec.desc}</span>
                            </div>`;
                    });
                }
                recHtml += '</div>';
                Swal.fire({
                    title: 'W POBLIŻU:',
                    html: recHtml,
                    confirmButtonText: 'Super, idę dalej ▶',
                    confirmButtonColor: '#28a745'
                }).then(nextStep);
            } else {
                nextStep();
            }
        });
    });
}

function loadNextLevel() {
    currentTargetIndex++;
    const nextTarget = targets[currentTargetIndex];

    // Reset przycisku
    const btn = document.getElementById('btn-action');
    btn.classList.remove('done', 'active');
    btn.disabled = true;
    btn.innerText = "Jeszcze za daleko...";
    btn.style.background = "#ccc";
    btn.style.color = "#fff";

    // Aktualizacja tekstów
    document.querySelector('.quest-title').innerText = `Cel: ${nextTarget.name}`;
    document.querySelector('.quest-riddle').innerText = `"${nextTarget.hint}"`;
    document.getElementById('dist-text').innerText = "Szukam sygnału...";
    document.getElementById('dist-text').style.color = "#CC3300";

    // Przesuwamy niewidzialny cel (w pamięci)
    targetMarker.setLatLng([nextTarget.lat, nextTarget.lng]);

    // Centrujemy mapę na graczu
    map.setView([currentLat, currentLng], 15);
}

// Inicjalizacja
updatePosition(currentLat, currentLng);

// ---------------------------------------------------------------------------------------------------------------------
// EKRAN Z WYNIKAMI KONCOWYMI
function showResults() {
    // Oblicz czas gry
    const endTime = new Date();
    const timeDiff = endTime - gameStartTime;
    
    // Zamiana na minuty i sekundy
    const minutes = Math.floor(timeDiff / 60000);
    const seconds = Math.floor((timeDiff % 60000) / 1000);
    const timeString = `${minutes}m ${seconds}s`;

    // Wpisz wynik i czas
    document.getElementById('final-score').innerText = currentScore;
    document.getElementById('final-time').innerText = timeString;

    // Gracz
    document.getElementById('display-username').innerText = userName;

    // Pokaż ekran
    const resultsScreen = document.getElementById('results-screen');
    resultsScreen.style.display = "flex";
    
    // Konfetti
    const duration = 3000;
    const end = Date.now() + duration;

    (function frame() {
        confetti({
            particleCount: 5,
            angle: 60,
            spread: 55,
            origin: { x: 0 }
        });
        confetti({
            particleCount: 5,
            angle: 120,
            spread: 55,
            origin: { x: 1 }
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
}
