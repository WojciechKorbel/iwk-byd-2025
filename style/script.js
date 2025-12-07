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

// -------------------------------------------------------------------------------------
// KONFIGURACJA DANYCH (ŁADOWANIE Z CSV)

// Pomniki
let allMonuments = [];
let targets = [];

// Funkcja pomocnicza do konwersji współrzędnych
function parseCoord(coord) {
    if (!coord) return 0;
    if (typeof coord === 'string') {
        return parseFloat(coord.trim().replace(',', '.'));
    }
    return coord;
}

// Główna funkcja ładująca i łącząca 4 pliki CSV
async function loadGameData() {
    try {
        const response = await fetch('/api/game-data');
        console.log("Response status:", response.status);
        const data = await response.json();
        console.log("DATA W JS:", data); 
        allMonuments = data;
        console.log("allMonuments.length =", allMonuments.length);
        console.log("Pierwszy obiekt:", allMonuments[0]);
    } catch (err) {
        console.error("FETCH ERROR:", err);
    }
}

loadGameData();

// -------------------------------------------------------------------------------------
// POZIOM TRUDNOSCI
function startLevel(difficulty) {
    // Sprawdzamy czy są dane
    if (typeof allMonuments === 'undefined' || allMonuments.length === 0) {
        console.warn("Dane jeszcze się nie załadowały!");
        return;
    }

    // Kopiujemy i mieszamy
    let tempTargets = [...allMonuments];
    tempTargets.sort(() => Math.random() - 0.5);

    let limit = 5; 
    
    if (difficulty === 'hard') {
        limit = 10;
    }

    // Wycinamy
    targets = tempTargets.slice(0, Math.min(limit, tempTargets.length));

    console.log(`Rozpoczynam poziom: ${difficulty}. Limit: ${limit}. Wylosowano: ${targets.length}`);

    // Start gry
    initGameAfterLoad(); 
}

// -------------------------------------------------------------------------------------
// DALSZA CZĘŚĆ GRY (ZMIENNE I LOGIKA)

// Zmienne gry
let gameStartTime = null; 
let currentTargetIndex = 0; 
let currentScore = 0;
let completedQuests = 0;
let prevLng = 18.005;
let userName = "";

// Punkt startowy
let currentLat = 53.123000;
let currentLng = 18.005000;

// MAPA
const map = L.map('map', { keyboard: false }).setView([currentLat, currentLng], 16);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// CEL I GRACZ
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

// -------------------------------------------------------------------------------------
// KONFIGURACJA ODZNAK
const BADGES = [
    { 
        threshold: 2, 
        name: "Brązowy Odkrywca", 
        icon: "🥉", 
        desc: "Odwiedziłeś 2 miejsca! Tak trzymaj!",
        img: "https://cdn-icons-png.flaticon.com/512/2583/2583434.png" 
    },
    { 
        threshold: 4, 
        name: "Srebrny Podróżnik", 
        icon: "🥈", 
        desc: "Już 4 pomniki za Tobą! Tak trzymaj!",
        img: "https://cdn-icons-png.flaticon.com/512/2583/2583319.png" 
    },
    { 
        threshold: 5, 
        name: "Złoty Legendarny Mistrz", 
        icon: "🥇", 
        desc: "Niesamowite! Znasz miasto jak własną kieszeń.",
        img: "https://cdn-icons-png.flaticon.com/512/2583/2583344.png" 
    }
];

function checkBadges() {
    // szukanie odznaki
    const earnedBadge = BADGES.find(b => b.threshold === completedQuests);

    if (earnedBadge) {
        setTimeout(() => {
            Swal.fire({
                title: `NOWA ODZNAKA!`,
                text: earnedBadge.name,
                imageUrl: earnedBadge.img,
                imageWidth: 150,
                imageHeight: 150,
                imageAlt: 'Badge Image',
                html: `
                    <h3 style="color: #d4af37;">${earnedBadge.icon} ${earnedBadge.name}</h3>
                    <p>${earnedBadge.desc}</p>
                `,
                confirmButtonText: 'Dumnie przyjmuję!',
                confirmButtonColor: '#d4af37',
                padding: '2em',
                color: '#716add',
                background: '#fff url(/images/trees.png)',
                customClass: {
                    popup: 'animated tada'
                }
            });
            confetti({
                particleCount: 150,
                spread: 100,
                origin: { y: 0.6 }
            });
        }, 600);
    }
}

function addBadgeToCard(badge) {
    const container = document.getElementById('badges-container');
    if (!container) return; 
    
    const img = document.createElement('img');
    img.src = badge.img;
    img.className = 'mini-badge badge-pop'; 
    img.title = `${badge.name}: ${badge.desc}`;
    container.appendChild(img);
}

// -------------------------------------------------------------------------------------
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
    const nameInput = document.getElementById('username-input').value.trim();

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
    welcomeScreen.style.opacity = "0";

    setTimeout(() => {
        welcomeScreen.style.display = "none";
        startLevel(userLevel);
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

    // --- BEZPIECZEŃSTWO: sprawdzamy czy istnieje cel ---
    const activeTarget = targets[currentTargetIndex];
    if (!activeTarget) return;

    // OBLICZANIE DYSTANSU I UI
    const dist = Math.floor(L.latLng(currentLat, currentLng)
        .distanceTo(L.latLng(parseCoord(activeTarget.lat), parseCoord(activeTarget.lng))));

    const txt = document.getElementById('dist-text');
    const btn = document.getElementById('btn-action');

    if (!txt || !btn) return;
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
        btn.style.background = "";
        btn.style.color = "";
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

// -------------------------------------------------------------------------
async function loadNearbyActivities(ageGroup) {
    try {
        const response = await fetch(`/api/activities/${ageGroup}`);
        const data = await response.json();
        return data.map(act => ({
            name: act.name,
            desc: act.description,
            lat: parseFloat(act.lat),
            lon: parseFloat(act.lon),
            icon: "📍"
        }));

    } catch (err) {
        console.error("Błąd ładowania aktywności:", err);
        return [];
    }
}

// Funkcja licząca odległość w metrach między dwoma współrzędnymi
function getDistance(lat1, lng1, lat2, lng2) {
    return L.latLng(lat1, lng1).distanceTo(L.latLng(lat2, lng2));
}

// Przygotowanie rekomendacji: filtrujemy po wieku i wybieramy najbliższą
async function prepareRecommendations(activeTarget) {
    try {
        // Pobierz wszystkie atrakcje dla grupy wiekowej
        const response = await fetch(`/api/activities/${userAge}`);
        const activities = await response.json();
        console.log("ACTIVITIES:", activities);

        if (!activities || activities.length === 0) {
            activeTarget.recommendations = [];
            return;
        }

        const monLat = parseCoord(activeTarget.lat);
        const monLng = parseCoord(activeTarget.lng);

        // Oblicz dystans dla każdej atrakcji
        const activitiesWithDistance = activities.map(act => ({
            ...act,
            distance: getDistance(monLat, monLng, parseCoord(act.lat), parseCoord(act.lng))
        }));

        // Sortujemy po dystansie
        activitiesWithDistance.sort((a, b) => a.distance - b.distance);

        // Wybieramy np. 3 najbliższe (możesz zmienić na 1 jeśli chcesz tylko jedną)
        const nearest = activitiesWithDistance.slice(0, 3);

        // Przypisujemy do aktywnego celu
        activeTarget.recommendations = nearest.map(act => ({
            name: act.name,
            desc: act.description,
            icon: "📍"
        }));

    } catch (err) {
        console.error("Błąd przygotowania rekomendacji:", err);
        activeTarget.recommendations = [];
    }
}

// FUNKCJA POKAZUJĄCA REKOMENDACJE
function showRecommendations(activeTarget) {
    console.log("Otwieram rekomendacje dla:", activeTarget.name);

    let recHtml = '<div style="text-align: left;">';

    // SPRAWDZAMY CZY SĄ DANE (Zabezpieczenie przed błędem)
    if (activeTarget.recommendations && activeTarget.recommendations.length > 0) {
        activeTarget.recommendations.forEach(rec => {
            recHtml += `
                <div style="background: #f8f9fa; padding: 10px; border-radius: 10px; margin-bottom: 10px; border-left: 5px solid #007bff;">
                    <strong style="font-size: 18px;">${rec.icon} ${rec.name}</strong><br>
                    <span style="color: #666; font-size: 14px;">${rec.desc}</span>
                </div>`;
        });
    } else {
        recHtml += `
            <div style="background: #fff3cd; padding: 10px; border-radius: 10px; border-left: 5px solid #ffc107;">
                <strong>🏛️ Rozejrzyj się!</strong><br>
                W okolicy tego miejsca na pewno znajdziesz ciekawą architekturę lub kawiarnię.
            </div>`;
    }

    recHtml += '</div>';
    
    // Wyświetlamy okno i zwracamy Promise (ważne dla kolejności zdarzeń!)
    return Swal.fire({
        title: 'WARTO ZOBACZYĆ:',
        html: recHtml,
        confirmButtonText: 'Super, idę dalej ▶',
        confirmButtonColor: '#28a745',
        backdrop: `rgba(0,0,0,0.5)`
    });
}

// ---------------------------------------------------------------------------------------------------------------------
// START QUIZU
function startQuiz() {
    const activeTarget = targets[currentTargetIndex];

    // ZADAJEMY PYTANIE
    Swal.fire({
        title: 'ZAGADKA!',
        text: activeTarget.quiz.question,
        icon: 'question',
        input: 'radio',
        inputOptions: activeTarget.quiz.answers,
        confirmButtonText: 'Sprawdź',
        confirmButtonColor: '#003366',
        inputValidator: (value) => { if (!value) return 'Wybierz odpowiedź!' },
        didOpen: () => { document.querySelector('.swal2-container').style.zIndex = '10000'; }
    }).then((result) => {
        if (result.isDismissed) return;

        // --- OBLICZANIE PUNKTÓW ---
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

        closeMonumentScreen();

        // Aktualizacja stanu gry
        currentScore += pointsEarned;
        completedQuests++; 
        
        // UI
        document.getElementById('score-board').innerText = `🏆 Pkt: ${currentScore}`;
        document.getElementById('goal-board').innerText = `Cel: ${completedQuests}/${targets.length}`;

        const btn = document.getElementById('btn-action');
        btn.innerText = "ZADANIE UKOŃCZONE!";
        btn.classList.add('done');

        // POKAZUJEMY WYNIK PUNKTOWY
        Swal.fire({
            title: msgTitle,
            html: message,
            icon: msgIcon,
            showDenyButton: true,
            denyButtonText: '👀 Co warto zobaczyć obok?',
            denyButtonColor: '#007bff',
            confirmButtonText: 'Lecimy dalej ▶',
            confirmButtonColor: '#28a745'
        }).then((scoreResult) => {
            
            // LOGIKA KOLEJNOSCI
            // Funkcja, która sprawdza odznakę i idzie dalej
            const proceedToBadgeAndNextLevel = () => {
                const earnedBadge = BADGES.find(b => b.threshold === completedQuests);

                if (earnedBadge) {
                    console.log("Przyznaję odznakę:", earnedBadge.name);
                    addBadgeToCard(earnedBadge);

                    // Pokazujemy Odznakę
                    Swal.fire({
                        title: `NOWA ODZNAKA!`,
                        text: earnedBadge.name,
                        imageUrl: earnedBadge.img,
                        imageWidth: 150,
                        imageHeight: 150,
                        html: `
                            <h3 style="color: #d4af37;">${earnedBadge.icon} ${earnedBadge.name}</h3>
                            <p>${earnedBadge.desc}</p>
                        `,
                        backdrop: `rgba(0,0,123,0.4)`,
                        confirmButtonText: 'Dumnie przyjmuję!',
                        confirmButtonColor: '#d4af37'
                    }).then(() => {
                        goToNextLevelOrFinish();
                    });
                    
                    confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
                } else {
                    goToNextLevelOrFinish();
                }
            };

            // GŁÓWNA DECYZJA
            if (scoreResult.isDenied) {
                prepareRecommendations(activeTarget)
                    .then(() => showRecommendations(activeTarget))
                    .then(() => proceedToBadgeAndNextLevel())
                    .catch(err => {
                        console.error("Błąd przygotowania rekomendacji:", err);
                        proceedToBadgeAndNextLevel();
                    });
            } else {
                proceedToBadgeAndNextLevel();
            }

        });
    });
}

// Funkcja pomocnicza kończąca poziom
function goToNextLevelOrFinish() {
    if (completedQuests >= targets.length) {
        showResults();
    } else {
        loadNextLevel();
    }
}

// -------------------------------------------------------------------------------------
// ZAKTUALIZOWANA FUNKCJA STARTOWA (INIT)
function initGameAfterLoad() {
    if (targets.length === 0) return;

    const firstTarget = targets[0];
    const titleEl = document.querySelector('.quest-title');
    const riddleEl = document.querySelector('.quest-riddle');
    const cardEl = document.querySelector('.quest-card');

    // --- LOGIKA POZIOMÓW ---
    if (userLevel === 'hard' || userLevel === 'trudny') {
        // Tytuł to zagadka
        titleEl.innerText = `Cel: ${firstTarget.hint}`; 
        titleEl.style.fontSize = "1.1rem"; 
        titleEl.style.lineHeight = "1.4";

        // Ukrywamy dolny tekst zagadki
        if (riddleEl) riddleEl.style.display = 'none';

        // TŁO: Czyścimy tło (brak zdjęcia na trudnym!)
        if (cardEl) {
            cardEl.style.backgroundImage = 'none';
        }
        
    } else {
        // Tytuł to nazwa pomnika
        titleEl.innerText = `Cel: ${firstTarget.name}`;
        titleEl.style.fontSize = ""; 
        
        // Pokazujemy zagadkę pod spodem
        if (riddleEl) {
            riddleEl.style.display = 'block';
            riddleEl.innerText = `"${firstTarget.hint}"`;
        }

        if (cardEl && firstTarget.image) {
            cardEl.style.backgroundImage = `
                linear-gradient(rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.85)), 
                url('${firstTarget.image}')
            `;
            cardEl.style.backgroundSize = 'cover';
            cardEl.style.backgroundPosition = 'center';
        }
    }
    
    targetMarker.setLatLng([firstTarget.lat, firstTarget.lng]);
    document.getElementById('goal-board').innerText = `Cel: 0/${targets.length}`;
}

// -------------------------------------------------------------------------------------
// 2. ZAKTUALIZOWANA FUNKCJA PRZEJŚCIA DO KOLEJNEGO POZIOMU
function loadNextLevel() {
    currentTargetIndex++;
    const nextTarget = targets[currentTargetIndex];
    
    const titleEl = document.querySelector('.quest-title');
    const riddleEl = document.querySelector('.quest-riddle');
    const cardEl = document.querySelector('.quest-card');

    // Reset przycisku
    const btn = document.getElementById('btn-action');
    btn.classList.remove('done', 'active');
    btn.disabled = true;
    btn.innerText = "Jeszcze za daleko...";
    btn.style.background = ""; 
    btn.style.color = "";

    // --- LOGIKA POZIOMÓW ---
    if (userLevel === 'hard' || userLevel === 'trudny') {
        titleEl.innerText = `Cel: ${nextTarget.info}`;
        titleEl.style.fontSize = "1.1rem";
        titleEl.style.lineHeight = "1.4";
        if (riddleEl) riddleEl.style.display = 'none';
        if (cardEl) cardEl.style.backgroundImage = 'none';

    } else {
        titleEl.innerText = `Cel: ${nextTarget.name}`;
        titleEl.style.fontSize = "";
        if (riddleEl) {
            riddleEl.style.display = 'block';
            riddleEl.innerText = `"${nextTarget.info}"`;
        }

        if (cardEl && nextTarget.image) {
            cardEl.style.backgroundImage = `
                linear-gradient(rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.85)), 
                url('${nextTarget.image}')
            `;
            cardEl.style.backgroundSize = 'cover';
            cardEl.style.backgroundPosition = 'center';
        }
    }

    document.getElementById('dist-text').innerText = "Szukam sygnału...";
    document.getElementById('dist-text').style.color = "#CC3300";

    targetMarker.setLatLng([nextTarget.lat, nextTarget.lng]);
    map.setView([currentLat, currentLng], 15);
}

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
