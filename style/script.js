let userLevel = null;
let userAge = null;
let userName = "";

// DANE GRY
let allMonuments = [];
let targets = [];
let currentTargetIndex = 0;
let currentScore = 0;
let completedQuests = 0;
let gameStartTime = null;
let initialUserVisited = 0;

// MAPA I POZYCJA
let currentLat = 53.123000;
let currentLng = 18.005000;
let pathHistory = [];
let usedRecommendations = [];

// IKONY I MAPA
const map = L.map('map', { keyboard: false }).setView([currentLat, currentLng], 16);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

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

const pathLine = L.polyline([], {
    color: '#ff0000', weight: 6, opacity: 0.8, lineJoin: 'round', lineCap: 'round', className: 'glowing-path'
}).addTo(map);



function selectLevel(level, btnElement) {
    userLevel = level;
    const buttons = btnElement.parentElement.querySelectorAll('.opt-btn');
    buttons.forEach(b => b.classList.remove('selected'));
    btnElement.classList.add('selected');
}

function selectAge(age, btnElement) {
    userAge = age;
    const buttons = btnElement.parentElement.querySelectorAll('.opt-btn');
    buttons.forEach(b => b.classList.remove('selected'));
    btnElement.classList.add('selected');
}


function parseCoord(coord) {
    if (!coord) return 0;
    if (typeof coord === 'string') {
        return parseFloat(coord.trim().replace(',', '.'));
    }
    return coord;
}

async function loadGameData() {
    try {
        const response = await fetch('/api/game-data');
        const data = await response.json();
        allMonuments = data;

        const input = document.getElementById('quest-limit-input');
        const hint = document.getElementById('limit-hint');
        if (input && hint) {
            input.placeholder = `Wpisz liczbę (1 - ${allMonuments.length})`;
            hint.innerText = `Dostępnych miejsc: ${allMonuments.length}`;
            input.max = allMonuments.length;
        }
        console.log("Załadowano pomników:", allMonuments.length);
    } catch (err) {
        console.error("FETCH ERROR:", err);
    }
}
loadGameData();

async function startGame() {
    const nameInput = document.getElementById('username-input').value.trim();
    const limitInput = document.getElementById('quest-limit-input').value;
    const limit = parseInt(limitInput);
    const maxAvailable = allMonuments.length;

    if (!userLevel || !userAge || nameInput === "") {
        Swal.fire({ icon: 'warning', title: 'Uzupełnij dane!', text: 'Wpisz nick, wybierz poziom i wiek.' });
        return;
    }

    if (isNaN(limit) || limit < 1 || limit > maxAvailable) {
        Swal.fire({
            icon: 'error',
            title: 'Błędna liczba miejsc!',
            text: `Wpisz liczbę pomiędzy 1 a ${maxAvailable}.`
        });
        return;
    }

    userName = nameInput;

    // Pobieramy historię
    try {
        const res = await fetch(`/api/user-stats/${userName}`);
        const stats = await res.json();
        initialUserVisited = stats.total_visited || 0;
    } catch (err) {
        console.error("Błąd pobierania statystyk:", err);
        initialUserVisited = 0;
    }

    gameStartTime = new Date();

    const welcomeScreen = document.getElementById('welcome-screen');
    welcomeScreen.style.opacity = "0";

    setTimeout(() => {
        welcomeScreen.style.display = "none";
        startLevel(userLevel, limit);
        map.getContainer().focus();
    }, 500);
}

function startLevel(difficulty, customLimit) {
    if (typeof allMonuments === 'undefined' || allMonuments.length === 0) return;

    let tempTargets = [...allMonuments];
    tempTargets.sort(() => Math.random() - 0.5);

    // Bierzemy customLimit, a jeśli coś pójdzie nie tak, to 3
    let limit = customLimit || 3;
    targets = tempTargets.slice(0, Math.min(limit, tempTargets.length));

    console.log(`Rozpoczynam poziom: ${difficulty}. Wybrano celów: ${limit}.`);
    initGameAfterLoad();
}

function initGameAfterLoad() {
    if (targets.length === 0) return;

    document.getElementById('goal-board').innerText = `Cel: 0/${targets.length}`;

    loadNextLevelUI();
}



function getSmoothPath(points) {
    if (points.length < 3) return points;
    let smoothPoints = [];
    smoothPoints.push(points[0]);
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i+1];
        const Q = [0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1]];
        const R = [0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1]];
        smoothPoints.push(Q);
        smoothPoints.push(R);
    }
    smoothPoints.push(points[points.length - 1]);
    return smoothPoints;
}

function updatePosition(lat, lng) {
    currentLat = lat;
    currentLng = lng;

    pathHistory.push([currentLat, currentLng]);
    if (pathHistory.length > 500) pathHistory.shift();
    const roundedPath = getSmoothPath(pathHistory);
    pathLine.setLatLngs(roundedPath);

    userMarker.setLatLng([currentLat, currentLng]);
    const iconDiv = userMarker.getElement();
    if (iconDiv) {
        iconDiv.classList.add('walking');
        clearTimeout(userMarker.walkTimeout);
        userMarker.walkTimeout = setTimeout(() => { iconDiv.classList.remove('walking'); }, 300);
    }
    map.panTo([currentLat, currentLng]);

    const activeTarget = targets[currentTargetIndex];
    if (!activeTarget) return;

    const dist = Math.floor(L.latLng(currentLat, currentLng)
        .distanceTo(L.latLng(parseCoord(activeTarget.lat), parseCoord(activeTarget.lng))));

    const txt = document.getElementById('dist-text');
    const btn = document.getElementById('btn-action');

    if (!txt || !btn || btn.classList.contains('done')) return;

    if (dist < 30) {
        txt.innerText = "JESTEŚ NA MIEJSCU!";
        txt.style.color = "green";
        btn.innerText = "ODBIERZ ODZNAKĘ!";
        btn.classList.add('active');
        btn.disabled = false;
    } else {
        txt.innerText = `Dystans: ${dist} metrów`;
        txt.style.color = "#CC3300";
        btn.innerText = "Jeszcze za daleko...";
        btn.classList.remove('active');
        btn.disabled = true;
    }
}

map.on('click', function(e) { updatePosition(e.latlng.lat, e.latlng.lng); });
document.addEventListener('keydown', function(e) {
    const step = 0.0005;
    if(e.key === "ArrowUp") updatePosition(currentLat + step, currentLng);
    if(e.key === "ArrowDown") updatePosition(currentLat - step, currentLng);
    if(e.key === "ArrowLeft") updatePosition(currentLat, currentLng - step);
    if(e.key === "ArrowRight") updatePosition(currentLat, currentLng + step);
});

function checkIn() {
    const btn = document.getElementById('btn-action');
    if (btn.classList.contains('done')) return;
    const activeTarget = targets[currentTargetIndex];

    document.getElementById('mon-title').innerText = activeTarget.name;
    document.getElementById('mon-info').innerText = activeTarget.info || "Brak opisu.";
    const bgDiv = document.getElementById('monument-bg');
    const imgUrl = activeTarget.image || 'https://via.placeholder.com/800x1200?text=Brak+Zdjecia';
    bgDiv.style.backgroundImage = `url('${imgUrl}')`;

    document.getElementById('monument-screen').style.display = 'flex';
}

function closeMonumentScreen() {
    document.getElementById('monument-screen').style.display = 'none';
}

function getDistance(lat1, lng1, lat2, lng2) {
    return L.latLng(lat1, lng1).distanceTo(L.latLng(lat2, lng2));
}

function getFoodIcon(type) {
    if (!type) return "🍴";
    const t = type.toUpperCase();
    if (t.includes('KAWIARNIA')) return "☕";
    if (t.includes('LODZIARNIA')) return "🍦";
    if (t.includes('BISTRO')) return "🍔";
    return "🍽️";
}

async function prepareRecommendations(activeTarget) {
    try {
        const response = await fetch(`/api/recommendations/${userAge}`);
        const data = await response.json();

        const activities = data.activities;
        const gastronomy = data.gastronomy;
        const monLat = parseCoord(activeTarget.lat);
        const monLng = parseCoord(activeTarget.lng);

        const sortByDist = (list) => {
            return list.map(item => ({
                ...item,
                distance: getDistance(monLat, monLng, parseCoord(item.lat), parseCoord(item.lon))
            })).sort((a, b) => a.distance - b.distance);
        };

        const sortedActivities = sortByDist(activities);
        const sortedGastro = sortByDist(gastronomy);

        const getUniqueRecommendation = (allSortedItems) => {
            if (!allSortedItems || allSortedItems.length === 0) return null;
            let candidates = allSortedItems.filter(item => !usedRecommendations.includes(item.name));

            if (candidates.length === 0) {
                console.log("Wyczerpano pulę! Resetuję historię.");
                const currentCategoryNames = allSortedItems.map(i => i.name);
                usedRecommendations = usedRecommendations.filter(usedName => !currentCategoryNames.includes(usedName));
                candidates = allSortedItems;
            }
            const topCandidates = candidates.slice(0, 4);
            const randomIndex = Math.floor(Math.random() * topCandidates.length);
            const selected = topCandidates[randomIndex];
            if (selected) usedRecommendations.push(selected.name);
            return selected;
        };

        const bestRecommendations = [];
        const uniqueAct = getUniqueRecommendation(sortedActivities);
        if (uniqueAct) bestRecommendations.push({ name: uniqueAct.name, desc: uniqueAct.description, type: 'activity', icon: "🎡" });

        const uniqueFood = getUniqueRecommendation(sortedGastro);
        if (uniqueFood) bestRecommendations.push({ name: uniqueFood.name, desc: uniqueFood.description, extra: uniqueFood.discount_description, type: 'gastronomy', icon: getFoodIcon(uniqueFood.type) });

        activeTarget.recommendations = bestRecommendations;

    } catch (err) {
        console.error("Błąd przygotowania rekomendacji:", err);
        activeTarget.recommendations = [];
    }
}

function showRecommendations(activeTarget) {
    let recHtml = '<div style="text-align: left;">';
    if (activeTarget.recommendations && activeTarget.recommendations.length > 0) {
        activeTarget.recommendations.forEach(rec => {
            let borderColor = rec.type === 'gastronomy' ? '#ff9800' : '#007bff';
            let bgColor = rec.type === 'gastronomy' ? '#fff8e1' : '#f8f9fa';
            recHtml += `
                <div style="background: ${bgColor}; padding: 12px; border-radius: 10px; margin-bottom: 12px; border-left: 5px solid ${borderColor}; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong style="font-size: 17px; color: #333;">${rec.icon} ${rec.name}</strong>
                    </div>
                    <div style="color: #666; font-size: 14px; margin-top: 5px;">${rec.desc}</div>
                    ${rec.extra ? `<div style="margin-top: 8px; font-weight:bold; color: #d32f2f; font-size: 13px; border-top: 1px dashed #ccc; padding-top:5px;">🏷️ ${rec.extra}</div>` : ''}
                </div>`;
        });
    } else {
        recHtml += `<div style="background: #fff3cd; padding: 10px; border-radius: 10px;"><strong>🏛️ Rozejrzyj się!</strong><br>Brak danych o atrakcjach.</div>`;
    }
    recHtml += '</div>';

    return Swal.fire({
        title: 'CO ROBIMY DALEJ?',
        html: recHtml,
        confirmButtonText: 'Super, idę dalej ▶',
        confirmButtonColor: '#28a745',
        backdrop: `rgba(0,0,0,0.6)`
    });
}

function startQuiz() {
    const activeTarget = targets[currentTargetIndex];

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
        currentScore += pointsEarned;
        completedQuests++;

        saveScoreToDb(userName, pointsEarned, 1);
        checkBadges();

        document.getElementById('score-board').innerText = `🏆 Pkt: ${currentScore}`;
        document.getElementById('goal-board').innerText = `Cel: ${completedQuests}/${targets.length}`;

        const btn = document.getElementById('btn-action');
        btn.innerText = "ZADANIE UKOŃCZONE!";
        btn.classList.add('done');

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
            const processNextStep = () => {
                if (completedQuests >= targets.length) {
                    showResults();
                } else {
                    loadNextLevel();
                }
            };

            if (scoreResult.isDenied) {
                prepareRecommendations(activeTarget)
                    .then(() => showRecommendations(activeTarget))
                    .then(() => processNextStep());
            } else {
                processNextStep();
            }
        });
    });
}



function loadNextLevel() {
    currentTargetIndex++;
    loadNextLevelUI();
    document.getElementById('dist-text').innerText = "Szukam sygnału...";
    document.getElementById('dist-text').style.color = "#CC3300";
    map.setView([currentLat, currentLng], 15);
}

function loadNextLevelUI() {
    const activeTarget = targets[currentTargetIndex];
    const titleEl = document.querySelector('.quest-title');
    const cardEl = document.querySelector('.quest-card');

    const btn = document.getElementById('btn-action');
    btn.classList.remove('done', 'active');
    btn.disabled = true;
    btn.innerText = "Jeszcze za daleko...";

    // Ustawienie tekstu
    // Zabezpieczenie: jeśli hint nie istnieje, użyj nazwy
    let displayText = activeTarget.name;

    if (userLevel === 'hard' || userLevel === 'trudny') {
        displayText = activeTarget.hint ? activeTarget.hint : activeTarget.name;
        titleEl.style.fontSize = "1.1rem";
        if (cardEl) cardEl.style.backgroundImage = 'none';
    } else {
        displayText = activeTarget.name;
        titleEl.style.fontSize = "";
        if (cardEl && activeTarget.image) {
            cardEl.style.backgroundImage = `linear-gradient(rgba(255,255,255,0.85), rgba(255,255,255,0.85)), url('${activeTarget.image}')`;
            cardEl.style.backgroundSize = 'cover';
        }
    }
    titleEl.innerText = `Cel: ${displayText}`;
    targetMarker.setLatLng([activeTarget.lat, activeTarget.lng]);
}

const BADGES = [
    { threshold: 2, name: "Brązowy Odkrywca", icon: "🥉", desc: "Odwiedziłeś 2 miejsca!", img: "https://cdn-icons-png.flaticon.com/512/2583/2583434.png" },
    { threshold: 4, name: "Srebrny Podróżnik", icon: "🥈", desc: "Już 4 pomniki za Tobą!", img: "https://cdn-icons-png.flaticon.com/512/2583/2583319.png" },
    { threshold: 5, name: "Złoty Mistrz", icon: "🥇", desc: "Znasz miasto jak własną kieszeń.", img: "https://cdn-icons-png.flaticon.com/512/2583/2583344.png" }
];

function checkBadges() {
    const totalLifetimeVisited = initialUserVisited + completedQuests;
    console.log("Łącznie odwiedzone:", totalLifetimeVisited);

    const earnedBadge = BADGES.find(b => b.threshold === totalLifetimeVisited);
    if (earnedBadge) {
        addBadgeToCard(earnedBadge);
        Swal.fire({
            title: `NOWA ODZNAKA!`,
            text: earnedBadge.name,
            imageUrl: earnedBadge.img,
            imageWidth: 100,
            imageHeight: 100,
            html: `<h3 style="color:#d4af37;">${earnedBadge.icon} ${earnedBadge.name}</h3><p>${earnedBadge.desc}</p>`,
            confirmButtonColor: '#d4af37'
        });
        confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 } });
    }
}

function addBadgeToCard(badge) {
    const container = document.getElementById('badges-container');
    if (!container) return;
    const img = document.createElement('img');
    img.src = badge.img;
    img.className = 'mini-badge badge-pop';
    img.title = badge.name;
    img.style.width = "30px";
    container.appendChild(img);
}

function showResults() {
    const endTime = new Date();
    const timeDiff = endTime - gameStartTime;
    const minutes = Math.floor(timeDiff / 60000);
    const seconds = Math.floor((timeDiff % 60000) / 1000);
    const timeString = `${minutes}m ${seconds}s`;

    document.getElementById('final-score').innerText = currentScore;
    document.getElementById('final-time').innerText = timeString;
    document.getElementById('display-username').innerText = userName;

    const resultsScreen = document.getElementById('results-screen');
    resultsScreen.style.display = "flex";

    (function frame() {
        confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 } });
        confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 } });
        if (Date.now() < Date.now() + 3000) requestAnimationFrame(frame);
    }());
}

function saveScoreToDb(user, score, visited = 0) {
    fetch('/api/save-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, score: score, visited: visited })
    }).catch(err => console.error("Błąd zapisu:", err));
}

async function showLeaderboard() {
    try {
        const response = await fetch('/api/leaderboard');
        const leaders = await response.json();

        let tableHtml = `
            <table style="width: 100%; border-collapse: collapse; text-align: left; color: #333;">
                <tr style="background: #f0f0f0; border-bottom: 2px solid #ddd;">
                    <th style="padding: 10px;">#</th><th style="padding: 10px;">Gracz</th><th style="padding: 10px; text-align: right;">PKT</th>
                </tr>`;

        leaders.forEach((player, index) => {
            const isMe = player.username === userName;
            const rowStyle = isMe ? "background: #e3f2fd; font-weight: bold;" : "border-bottom: 1px solid #eee;";
            let rankDisplay = index + 1;
            if (index === 0) rankDisplay = "🥇";
            if (index === 1) rankDisplay = "🥈";
            if (index === 2) rankDisplay = "🥉";

            tableHtml += `<tr style="${rowStyle}"><td style="padding: 10px;">${rankDisplay}</td><td style="padding: 10px;">${player.username} ${isMe ? "(Ty)" : ""}</td><td style="padding: 10px; text-align: right;">${player.score}</td></tr>`;
        });
        tableHtml += '</table>';

        Swal.fire({
            title: '🏆 TOP 10 MISTRZÓW',
            html: tableHtml,
            confirmButtonText: 'Zamknij',
            confirmButtonColor: '#003366',
            width: '600px',
            background: '#fff'
        });
    } catch (err) {
        console.error(err);
        Swal.fire('Ups!', 'Błąd rankingu.', 'error');
    }
}