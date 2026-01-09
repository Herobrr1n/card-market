const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();
const userId = tg.initDataUnsafe?.user?.id || Date.now(); // Добавлен оператор 
const username = tg.initDataUnsafe?.user?.username || 'Guest';
const BACKEND_URL = 'http://localhost:3000';
console.log('Telegram User ID:', userId);
console.log('Username:', username);
async function loadProfile() {
    try {
        const res = await fetch(
          '${BACKEND_URL}/profile?userId=${userId}&username=${encodeURIComponent(username)}'
        );
        
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data = await res.json();
        console.log('Profile data:', data);

        document.getElementById('username').innerText = '@${data.username || username}';
        document.getElementById('balance').innerText = '${data.heriki || 0} хериков';
    } catch (error) {
        console.error('Error loading profile:', error);
        document.getElementById('balance').innerText = 'Ошибка загрузки';
    }
}
async function openPackHandler() {
    const openPackBtn = document.getElementById('openPack');
    const opening = document.getElementById('opening');
    const cardsDiv = document.getElementById('cards');

    try {
openPackBtn.disabled = true;
        openPackBtn.innerText = 'Открываем...';
        cardsDiv.innerHTML = '';
        opening.style.display = 'block';
 const res = await fetch(`${BACKEND_URL}/open-pack`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                userId,
                username
            })
        });

        console.log('Response status:', res.status);
        
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Server error: ${res.status} - ${errorText}`);
        }

        const data = await res.json();
        console.log('Pack opened:', data);
 opening.style.display = 'none';
        openPackBtn.innerText = 'Открыть пак';
  if (data.cards && Array.isArray(data.cards)) {
            data.cards.forEach(card => {
                console.log('Card:', card);
                showCard(card);
            });
        } else {
            console.error('No cards in response:', data);
            cardsDiv.innerHTML = '<p>Не удалось получить карты</p>';
        }
 await loadProfile();
        await loadMarket();

    } catch (error) {
        console.error('Error opening pack:', error);
        opening.style.display = 'none';
        openPackBtn.disabled = false;
        openPackBtn.innerText = 'Открыть пак';
 cardsDiv.innerHTML = <p style="color: red;">Ошибка: ${error.message}</p>;
        alert(`Ошибка открытия пака: ${error.message}`);
    } finally {
        // Разблокируем кнопку через секунду для плавности
        setTimeout(() => {
            openPackBtn.disabled = false;
        }, 1000);
    }
}

// Назначаем обработчик
document.getElementById('openPack').addEventListener('click', openPackHandler);
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
    // Убрана лишняя кавычка: было "card-face card-front card ${card.rarity}"
    front.className = 'card-face card-front card ${card.rarity}';

    const imgSrc = 'images/card${card.cardId}.png';

    front.innerHTML = `
        <img src="${imgSrc}" alt="Card ${card.cardId}" onerror="this.src='https://via.placeholder.com/150x200?text=Card+${card.cardId}'">
        <div><b>Карта #${card.cardId}</b></div>
        <div>${card.rarity ? card.rarity.toUpperCase() : 'COMMON'}</div>
        <button onclick="createListing(${card.id}, 100)">Продать за 100</button>
    `;

    inner.appendChild(back);
    inner.appendChild(front);
    wrapper.appendChild(inner);
    cardsDiv.appendChild(wrapper);

    // Анимация через 300мс
    setTimeout(() => {
        wrapper.classList.add('open');
    }, 300);
}

// ---------------- MARKET ----------------
async function loadMarket() {
    try {
        const marketDiv = document.getElementById('market');
        marketDiv.innerHTML = 'Загрузка маркета...';

        const res = await fetch(`${BACKEND_URL}/market`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        
        const listings = await res.json();
        console.log('Market listings:', listings);

        marketDiv.innerHTML = '';
        
        if (!listings || listings.length === 0) {
            marketDiv.innerHTML = '<p>На маркете пока нет товаров</p>';
            return;
        }

        listings.forEach(lot => {
            const div = document.createElement('div');
            div.className = 'market-listing';
            
            div.innerHTML = `
                <div><b>${lot.cardName || 'Карта #' + lot.cardId}</b></div>
                <div>Редкость: ${lot.rarity || 'обычная'}</div>
                <div class="price">${lot.price || 0} хериков</div>
                <button onclick="buy(${lot.id})">Купить</button>
            `;

            marketDiv.appendChild(div);
        });
    } catch (error) {
        console.error('Error loading market:', error);
        document.getElementById('market').innerHTML = '<p>Ошибка загрузки маркета</p>';
    }
}

// ---------------- CREATE LISTING ----------------
async function createListing(userCardId, price) {
    if (!confirm(`Выставить карту на продажу за ${price} хериков?`)) {
        return;
    }
    
    try {
        const res = await fetch(`${BACKEND_URL}/market/create`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                userId,
                userCardId,
                price
            })
        });

        const data = await res.json();
        console.log('Create listing response:', data);
        
        if (data.error) {
            alert('Ошибка: ' + data.error);
        } else {
            alert('Карта выставлена на продажу!');
            await loadMarket();
            await loadProfile(); // Обновляем баланс
        }
    } catch (error) {
        console.error('Error creating listing:', error);
        alert('Ошибка при создании лота');
    }
}

// ---------------- BUY ----------------
async function buy(listingId) {
    if (!confirm('Купить эту карту?')) {
        return;
    }
    
    try {
        const res = await fetch(`${BACKEND_URL}/market/buy`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                buyerId: userId,
                listingId
            })
        });

        const data = await res.json();
        console.log('Buy response:', data);
        
        if (data.error) {
            alert('Ошибка: ' + data.error);
        } else {
            alert('Покупка успешна! Карта добавлена в вашу коллекцию.');
            await loadProfile();
            await loadMarket();
        }
    } catch (error) {
        console.
 error('Error buying:', error);
        alert('Ошибка при покупке');
    }
}

// ---------------- INIT ----------------
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing...');
    
    // Проверяем, что все элементы существуют
    if (!document.getElementById('openPack')) {
        console.error('Button #openPack not found!');
    }
    
    loadProfile();
    loadMarket();
});

// Добавляем функции в глобальную область видимости
window.createListing = createListing;
window.buy = buy;                 