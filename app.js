async function loadProfile() {
    const res = await fetch(
        https://herobrr1n.github.io/card-market/ profile?userId=${userId}&username=${username}
    );
    const data = await res.json();

    document.getElementById('username').innerText = data.username;
    document.getElementById('balance').innerText = ${data.heriki} хериков;
}
const tg = window.Telegram.WebApp;
tg.expand();

document.getElementById('openPack').onclick = async () => {
  const res = await fetch('http://localhost:3000/open-pack', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      initData: tg.initDataUnsafe
    })
  });

  const data = await res.json();
  const div = document.getElementById('cards');
  div.innerHTML = '';

 /* Общий фон */
body {
    margin: 0;
    padding: 16px;
    font-family: Arial, sans-serif;
    background: #0f172a;
    color: #e5e7eb;
}

/* Заголовки */
h1, h2 {
    text-align: center;
    margin-bottom: 12px;
}

/* Кнопки */
button {
    background: #6366f1;
    color: white;
    border: none;
    padding: 10px 14px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
}

button:hover {
    background: #4f46e5;
}

/* Контейнеры */
#cards, #market {
    margin-top: 16px;
}

/* Карточка */
.card {
    background: #1e293b;
    border-radius: 10px;
    padding: 12px;
    margin-bottom: 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

/* Название карты */
.card-name {
    font-weight: bold;
}

/* Цена */
.price {
    color: #22c55e;
    font-weight: bold;
}
// Загрузка активных лотов
async function loadMarket() {
    const res = await fetch('http://localhost:3000/market');
    const listings = await res.json();

    const marketDiv = document.getElementById('market');
    marketDiv.innerHTML = '';

    listings.forEach(lot => {
    const div = document.createElement('div');
    div.className = 'card';

    div.innerHTML = `
        <span class="card-name">${lot.cardName}</span>
        <span class="price">${lot.price} хериков</span>
        <button onclick="buy(${lot.id})">Купить</button>
    `;

    marketDiv.appendChild(div);
});

// Покупка лота
async function buy(listingId) {
    const buyerId = 123; // текущий пользователь (заменить на реальный Telegram userId)
    const res = await fetch('http://localhost:3000/market/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyerId, listingId })
    });
    const data = await res.json();
    alert(data.success ? "Куплено!" : data.error);
    loadMarket(); // обновляем список
}

// Выставление карточки на продажу
async function createListing(userCardId, price) {
    const userId = 123; // текущий пользователь
    await fetch('http://localhost:3000/market/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, userCardId, price })
    });
    loadMarket();
}

// Загружаем маркет при старте
loadMarket();
alert("Куплено!");
loadProfile();
loadMarket();

