// ------------------------------------------------------------------------------------------------------------------------
// ZMIENNE POWITALNE
let userLevel = null;
let userAge = null;

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
        
        // (Opcjonalnie) Dostosuj grę do wyboru
        if (userLevel === 'hard') {
            Swal.fire('Tryb Trudny!', 'W tym trybie wskazówki są mniej dokładne. Powodzenia!', 'info');
        }
    }, 500);
}

// ------------------------------------------------------------------------------------------------------------------------
// --- KONFIGURACJA PUNKTÓW Z QUIZEM I ATRAKCJAMI ---
const targets = [
    {
        name: "Łuczniczka",
        lat: 53.125184, 
        lng: 18.012354,
        hint: "Stoję w parku naprzeciwko teatru...",
        image: "./bydgoszcz.webp",
        info: "Łuczniczka to jeden z najstarszych symboli Bydgoszczy. Rzeźba powstała w 1910 roku w Berlinie. Przez lata budziła kontrowersje ze względu na swoją nagość.",
        quiz: {
            question: "Co trzyma Łuczniczka w lewej ręce?",
            answers: { 'a': 'Strzałę', 'b': 'Łuk', 'c': 'Jabłko' },
            correct: 'b'
        },
        // NOWE: Polecane miejsca
        recommendations: [
            { icon: '☕', name: 'Restauracja Weranda', desc: 'Kawa z widokiem na park.' },
            { icon: '🎭', name: 'Teatr Polski', desc: 'Tuż obok! Warto zobaczyć repertuar.' }
        ]
    },
    {
        name: "Spichrze nad Brdą",
        lat: 53.123600, 
        lng: 18.001500,
        hint: "Trzy zabytkowe budynki, symbol miasta nad rzeką.",
        image: "./bydgoszcz.webp",
        info: "Łuczniczka to jeden z najstarszych symboli Bydgoszczy. Rzeźba powstała w 1910 roku w Berlinie. Przez lata budziła kontrowersje ze względu na swoją nagość.",
        quiz: {
            question: "Ile jest obecnie zabytkowych spichrzy?",
            answers: { 'a': 'Pięć', 'b': 'Dwa', 'c': 'Trzy' },
            correct: 'c'
        },
        recommendations: [
            { icon: '🚢', name: 'Barka Lemara', desc: 'Żywe muzeum szypra na wodzie.' },
            { icon: '🍔', name: 'Stary Port', desc: 'Kultowe miejsce na szybki lunch.' }
        ]
    },
    {
        name: "Wyspa Młyńska",
        lat: 53.122500, 
        lng: 17.998500,
        hint: "Zielone serce miasta, otoczone wodą.",
        image: "./bydgoszcz.webp",
        info: "Łuczniczka to jeden z najstarszych symboli Bydgoszczy. Rzeźba powstała w 1910 roku w Berlinie. Przez lata budziła kontrowersje ze względu na swoją nagość.",
        quiz: {
            question: "Jaka rzeka opływa Wyspę Młyńską?",
            answers: { 'a': 'Wisła', 'b': 'Brda', 'c': 'Odra' },
            correct: 'b'
        },
        recommendations: [
            { icon: '🍦', name: 'Młyny Rothera', desc: 'Lody na tarasie widokowym.' },
            { icon: '🧸', name: 'Magiczny Plac Zabaw', desc: 'Idealne miejsce dla dzieci.' }
        ]
    }
];

// losowanie kolejnosci pomnikow
targets.sort(() => Math.random() - 0.5);

// Zmienne gry
let gameStartTime = null; // godzina startu
let currentTargetIndex = 0; 
let currentScore = 0;
let completedQuests = 0;
let prevLng = 18.005;

// Start (Opera Nova)
let currentLat = 53.123000;
let currentLng = 18.005000;

// --- MAPA ---
const map = L.map('map').setView([currentLat, currentLng], 16);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// --- CEL (NIEWIDOCZNY NA MAPIE) ---
let targetMarker = L.marker([targets[0].lat, targets[0].lng]); 

// --- GRACZ (PROFESJONALNY AVATAR) ---
const characterIcon = L.divIcon({
    className: 'custom-div-icon', // Klasa do animacji w CSS
    html: `
        <div id="player-wrapper" style="position: relative; width: 60px;">
            <div class="pro-avatar-container">
                <img src="https://img.freepik.com/free-psd/3d-illustration-person-with-sunglasses_23-2149436188.jpg?w=200" class="pro-avatar-img" alt="Avatar">
            </div>
            <div class="direction-arrow"></div>
        </div>
    `,
    iconSize: [60, 70], // Rozmiar całego kontenera (z strzałką)
    iconAnchor: [30, 70], // Punkt zakotwiczenia: Środek (30), Dół (70) - tam jest czubek strzałki
    popupAnchor: [0, -70] // Dymek nad głową
});

let userMarker = L.marker([currentLat, currentLng], { icon: characterIcon }).addTo(map);

// --- ŚCIEŻKA (CZERWONA KRESKA) ---
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

// --- FUNKCJA WYGŁADZAJĄCA (ALGORYTM CHAIKINA) ---
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
    if (!userLevel || !userAge) {
        Swal.fire({
            icon: 'warning',
            title: 'Wybierz opcje!',
            text: 'Musisz zaznaczyć poziom trudności i wiek.',
            confirmButtonColor: '#003366'
        });
        return;
    }

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
// --- FUNKCJA AKTUALIZUJĄCA POZYCJĘ ---
function updatePosition(lat, lng) {
    // Aktualizacja zmiennych
    currentLat = lat;
    currentLng = lng;

    // --- RYSOWANIE ŚCIEŻKI ---
    pathHistory.push([currentLat, currentLng]);
    if (pathHistory.length > 500) pathHistory.shift();
    const roundedPath = getSmoothPath(pathHistory);
    pathLine.setLatLngs(roundedPath);

    // --- PRZESUWANIE GRACZA ---
    userMarker.setLatLng([currentLat, currentLng]);
    
    // Dodajemy klasę "walking" do ikony, żeby podskakiwała przy ruchu
    // (Usuwamy ją po chwili, żeby przestał skakać jak stanie)
    const iconDiv = userMarker.getElement();
    if (iconDiv) {
        iconDiv.classList.add('walking');
        // Reset animacji po 300ms (zatrzymaj podskakiwanie)
        clearTimeout(userMarker.walkTimeout);
        userMarker.walkTimeout = setTimeout(() => {
            iconDiv.classList.remove('walking');
        }, 300);
    }

    // Kamera podąża za graczem
    map.panTo([currentLat, currentLng]); 
    
    // --- OBLICZANIE DYSTANSU I UI ---
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
// --- STEROWANIE ---
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
// ---------------------------------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------------------------------
// 1. WEJŚCIE NA EKRAN POMNIKA (To się dzieje po kliknięciu "Odbierz Odznakę")
function checkIn() { 
    const btn = document.getElementById('btn-action');
    if (btn.classList.contains('done')) return;

    // Pobierz dane aktualnego celu
    const activeTarget = targets[currentTargetIndex];

    // Wpisz tytuł i opis
    document.getElementById('mon-title').innerText = activeTarget.name;
    document.getElementById('mon-info').innerText = activeTarget.info || "Brak opisu.";
    
    // --- USTAW ZDJĘCIE TŁA ---
    const bgDiv = document.getElementById('monument-bg');
    // Używamy obrazka z danych LUB placeholdera, jeśli brak pliku
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
// 2. START QUIZU (To się dzieje po kliknięciu "Rozwiąż Zagadkę" na ekranie ze zdjęciem)
function startQuiz() {
    const activeTarget = targets[currentTargetIndex];

    // Konfiguracja SweetAlert (musi być nad zdjęciem!)
    Swal.fire({
        title: 'ZAGADKA!',
        text: activeTarget.quiz.question,
        icon: 'question',
        input: 'radio',
        inputOptions: activeTarget.quiz.answers,
        confirmButtonText: 'Sprawdź',
        confirmButtonColor: '#003366',
        inputValidator: (value) => { if (!value) return 'Wybierz odpowiedź!' },
        // Trik na z-index, żeby okno było nad zdjęciem
        didOpen: () => {
            document.querySelector('.swal2-container').style.zIndex = '10000';
        }
    }).then((result) => {
        if (result.isDismissed) return;

        // --- Logika Punktów (taka jak była wcześniej) ---
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
    const timeDiff = endTime - gameStartTime; // Różnica w milisekundach
    
    // Zamiana na minuty i sekundy
    const minutes = Math.floor(timeDiff / 60000);
    const seconds = Math.floor((timeDiff % 60000) / 1000);
    const timeString = `${minutes}m ${seconds}s`;

    // Wpisz dane do HTML
    document.getElementById('final-score').innerText = currentScore;
    document.getElementById('final-time').innerText = timeString;

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