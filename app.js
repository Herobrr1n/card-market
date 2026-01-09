const tg = window.Telegram.WebApp;
tg.expand();

const userId = tg.initDataUnsafe?.user?.id || Date.now();
const username = tg.initDataUnsafe?.user?.username || 'Guest';

// ❗️ ОБЯЗАТЕЛЬНО ПРОВЕРЬ
const BACKEND_URL = 'http://localhost:3000'; 
// для Telegram нужен публичный URL (Render / Railway)

// ---------------- PROFILE ----------------
async function loadProfile() {
    const res = await fetch(
        `${BACKEND_URL}/profile?userId=${userId}&username=${username}`
    );
    const data = await res.json();

    document.getElementById('username').innerText = data.username;
    document.getElementById('balance').innerText = `${data.heriki} хериков`;
}

// ---------------- OPEN PACK ----------------
document.getElementById('openPack').onclick = async () => {
    const opening = document.getElementById('opening');
    const cardsDiv = document.getElementById('cards');

    cardsDiv.innerHTML = '';
    opening.style.display = 'block';

    setTimeout(async () => {
        const res = await fetch(`${BACKEND_URL}/open-pack`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                username
            })
        });

        const data = await res.json();
        opening.style.display = 'none';

        data.cards.forEach(card => showCard(card));

        loadProfile();
        loadMarket();
    }, 1200);
};

// ---------------- SHOW CARD ----------------
function showCard(card) {
    const cardsDiv = document.getElementById('cards');

    const wrapper = document.createElement('div');
    wrapper.className = 'card-wrapper';

    const inner = document.createElement('div');
    inner.className = 'card-inner';

    const back = document.createElement('div');
    back.className = 'card-face card-back';
    back.innerText = '🂠';

    const front = document.createElement('div');
    front.className = `card-face card-front card ${card.rarity}`;

    const imgSrc = `images/card${card.cardId}.png`;

    front.innerHTML = `
        <img src="${imgSrc}">
        <div><b>Карта #${card.cardId}</b></div>
        <div>${card.rarity.toUpperCase()}</div>
        <button onclick="createListing(${card.id}, 100)">Продать</button>
    `;

    inner.appendChild(back);
    inner.appendChild(front);
    wrapper.appendChild(inner);
    cardsDiv.appendChild(wrapper);

    setTimeout(() => {
        wrapper.classList.add('open');
    }, 300);
}

// ---------------- MARKET ----------------
async function loadMarket() {
    const marketDiv = document.getElementById('market');
    marketDiv.innerHTML = '';

    const res = await fetch(`${BACKEND_URL}/market`);
    const listings = await res.json();

    listings.forEach(lot => {
        const div = document.createElement('div');
        div.className = 'card';

        div.innerHTML = `
            <div><b>${lot.cardName}</b></div>
            <div class="price">${lot.price} хериков</div>
            <button onclick="buy(${lot.id})">Купить</button>
        `;

        marketDiv.appendChild(div);
    });
}

// ---------------- CREATE LISTING ----------------
async function createListing(userCardId, price) {
    const res = await fetch(`${BACKEND_URL}/market/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId,
            userCardId,
            price
        })
    });

    const data = await res.json();
    if (data.error) {
        alert(data.error);
    } else {
        alert('Карта выставлена на продажу');
        loadMarket();
    }
}

// ---------------- BUY ----------------
async function buy(listingId) {
    const res = await fetch(`${BACKEND_URL}/market/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            buyerId: userId,
            listingId
        })
    });

    const data = await res.json();
    if (data.error) {
        alert(data.error);
    } else {alert('Покупка успешна!');
        loadProfile();
        loadMarket();
    }
}

// ---------------- INIT ----------------
loadProfile();
loadMarket();