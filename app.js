// ========== ИНИЦИАЛИЗАЦИЯ ==========
console.log('App starting...');

// Telegram WebApp
let tg;
try {
    tg = window.Telegram?.WebApp;
    if (tg) {
        tg.expand();
        tg.ready();
        console.log('Telegram WebApp initialized');
    } else {
        console.warn('Telegram WebApp not found - running in browser mode');
    }
} catch (error) {
    console.warn('Telegram WebApp error:', error);
}

// Данные пользователя
const userId = tg?.initDataUnsafe?.user?.id || Date.now();
const username = tg?.initDataUnsafe?.user?.username || 'Guest_' + Math.floor(Math.random() * 1000);
console.log('User:', { userId, username });

// Backend URL
const BACKEND_URL = 'http://localhost:3000';
console.log('Backend URL:', BACKEND_URL);

// Картинки для рулетки (убедитесь что файлы существуют)
const CARD_IMAGES = [];
for (let i = 1; i <= 10; i++) {
    CARD_IMAGES.push(`card${i}.png`);
}

// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
let isOpeningPack = false;
let myCards = [];
let totalClicks = 0;
let heriksPerClick = 1;
let lastClickTime = 0;
const CLICK_COOLDOWN = 100;

// ========== ПРОФИЛЬ ==========
async function loadProfile() {
    console.log('Loading profile...');
    try {
        document.getElementById('username').textContent = `@${username}`;
        
        // Для демо - устанавливаем начальный баланс
        const initialBalance = 100;
        updateBalanceDisplay(initialBalance);
        
        // Если хотите подключить бэкенд, раскомментируйте:
        /*
        const response = await fetch(`${BACKEND_URL}/profile?userId=${userId}&username=${encodeURIComponent(username)}`);
        if (response.ok) {
            const data = await response.json();
            updateBalanceDisplay(data.balance || 100);
            if (data.cards) myCards = data.cards;
        }
        */
        
    } catch (error) {
        console.error('Profile load error:', error);
        updateBalanceDisplay(100);
    }
}

// ========== ФУНКЦИИ ДЛЯ БАЛАНСА ==========
function updateBalanceDisplay(balance) {
    document.getElementById('balance').textContent = `${balance} хериков`;
}

function getCurrentBalance() {
    const balanceText = document.getElementById('balance').textContent;
    const match = balanceText.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
}

function updateBalance(amount) {
    const currentBalance = getCurrentBalance();
    const newBalance = Math.max(0, currentBalance + amount);
    updateBalanceDisplay(newBalance);
    return newBalance;
}

// ========== ФАРМ ХЕРИКОВ ==========
function initializeFarmButton() {
    console.log('Initializing farm button...');
    const farmBtn = document.getElementById('farmHeriks');
    
    if (!farmBtn) {
        console.error('❌ Кнопка #farmHeriks не найдена!');
        return;
    }
    
    farmBtn.addEventListener('click', function(event) {
        const now = Date.now();
        
        // Проверяем кд
        if (now - lastClickTime < CLICK_COOLDOWN) {
            return;
        }
        
        lastClickTime = now;
        
        // Анимация кнопки
        farmBtn.style.animation = 'bounce 0.3s';
        setTimeout(() => {
            farmBtn.style.animation = '';
        }, 300);
        
        // Создаем эффект монетки
        createCoinEffect(event);
        
        // Добавляем херики
        const earned = heriksPerClick;
        const newBalance = updateBalance(earned);
        
        // Обновляем статистику
        totalClicks++;
        updateFarmCounter();
        
        console.log(`💰 Получено ${earned} хериков. Всего: ${newBalance}`);
    });
    
    console.log('✅ Кнопка фарма инициализирована');
}

function createCoinEffect(event) {
    const coin = document.createElement('div');
    coin.className = 'coin-popup';
    coin.textContent = `+${heriksPerClick} 💰`;
    coin.style.left = (event.clientX - 20) + 'px';
    coin.style.top = (event.clientY - 20) + 'px';
    
    document.body.appendChild(coin);
    
    setTimeout(() => {
        coin.remove();
    }, 1000);
}

function updateFarmCounter() {
const farmCounter = document.getElementById('farmCounter');
    if (farmCounter) {
        farmCounter.innerHTML = `
            <div>Всего кликов: <b>${totalClicks}</b></div>
            <div>Хериков за клик: <b>${heriksPerClick}</b></div>
        `;
    }
}

// ========== РУЛЕТКА ДЛЯ ОТКРЫТИЯ ПАКА ==========
function showRoulette() {
    return new Promise((resolve) => {
        const rouletteContainer = document.getElementById('rouletteContainer');
        const rouletteDiv = document.getElementById('roulette');
        const resultText = document.getElementById('resultText');
        const rouletteTitle = document.getElementById('rouletteTitle');
        const closeBtn = document.getElementById('closeRoulette');
        
        // Показываем рулетку
        rouletteContainer.style.display = 'block';
        rouletteTitle.textContent = '🎰 Открываем пак...';
        resultText.textContent = 'Подготовка рулетки...';
        closeBtn.style.display = 'none';
        
        // Очищаем рулетку
        rouletteDiv.innerHTML = '';
        
        // Создаем контейнер для карточек рулетки
        const track = document.createElement('div');
        track.style.cssText = `
            display: flex;
            position: absolute;
            height: 100%;
            align-items: center;
            padding-left: 20px;
            transition: transform 3s cubic-bezier(0.1, 0.7, 0.1, 1);
        `;
        
        // Добавляем карточки в рулетку
        for (let i = 0; i < 20; i++) {
            const cardIndex = i % CARD_IMAGES.length;
            const img = document.createElement('img');
            img.className = 'roulette-card';
            img.src = `images/card${(cardIndex + 1)}.png`;
            img.alt = `Card ${cardIndex + 1}`;
            img.onerror = function() {
                this.src = `https://via.placeholder.com/150x180/1e293b/ffffff?text=Card+${cardIndex + 1}`;
            };
            track.appendChild(img);
        }
        
        rouletteDiv.appendChild(track);
        
        // Выбираем случайную карту как победителя
        const winnerIndex = Math.floor(Math.random() * 15) + 3;
        const winnerCardId = (winnerIndex % CARD_IMAGES.length) + 1;
        const winnerRarity = getRandomRarity();
        
        console.log(`Winner: card${winnerCardId} (${winnerRarity})`);
        
        // Этап 1: Подготовка
        setTimeout(() => {
            resultText.textContent = 'Рулетка запущена...';
            
            // Этап 2: Запуск анимации
            setTimeout(() => {
                // Вычисляем позицию для остановки на победителе
                const cardWidth = 150 + 20; // ширина + margin
                const targetPosition = -(winnerIndex * cardWidth) + (rouletteDiv.offsetWidth / 2) - (cardWidth / 2);
                track.style.transform = `translateX(${targetPosition}px)`;
                
                // Этап 3: Подсветка победителя
                setTimeout(() => {
                    const cards = track.querySelectorAll('.roulette-card');
                    if (cards[winnerIndex]) {
                        cards[winnerIndex].classList.add('highlight');
                    }
                    
                    // Создаем объект карты-победителя
                    const wonCard = {
                        id: Date.now() + winnerIndex,
                        cardId: winnerCardId,
                        rarity: winnerRarity,
                        name: `Карта #${winnerCardId}`,
                        image: `card${winnerCardId}.png`
                    };
                    
                    resultText.innerHTML = `
                        🎉 <strong>ВЫ ВЫИГРАЛИ!</strong><br>
                        <span style="color:${getRarityColor(winnerRarity)}">
                        ${winnerRarity.toUpperCase()} карту #${winnerCardId}</span>
                    `;
                    rouletteTitle.textContent = '🎊 Поздравляем!';
                    
                    // Добавляем карту в коллекцию
                    myCards.push(wonCard);
displayMyCards();
                    
                    // Показываем кнопку закрытия
                    closeBtn.style.display = 'inline-block';
                    
                    resolve(wonCard);
                    
                }, 2000); // Ждем окончания анимации
                
            }, 1000); // Задержка перед запуском
            
        }, 1000); // Начальная задержка
    });
}

// ========== ОТКРЫТИЕ ПАКА С РУЛЕТКОЙ ==========
function initializeOpenPackButton() {
    console.log('Initializing open pack button...');
    const openPackBtn = document.getElementById('openPack');
    const closeRouletteBtn = document.getElementById('closeRoulette');
    
    if (!openPackBtn) {
        console.error('❌ Кнопка #openPack не найдена!');
        return;
    }
    
    // Кнопка открытия пака
    openPackBtn.addEventListener('click', async function() {
        console.log('🎯 Кнопка открытия пака нажата!');
        
        if (isOpeningPack) {
            console.log('Уже открывается пак, игнорируем');
            return;
        }
        
        isOpeningPack = true;
        const originalText = openPackBtn.textContent;
        
        try {
            // Блокируем кнопку
            openPackBtn.disabled = true;
            openPackBtn.textContent = '⌛️ Проверка...';
            
            // Проверяем баланс
            const currentBalance = getCurrentBalance();
            const packCost = 50;
            
            if (currentBalance < packCost) {
                alert(`❌ Недостаточно хериков! Нужно ${packCost}, у вас ${currentBalance}`);
                return;
            }
            
            openPackBtn.textContent = '🎰 Открываем...';
            
            // Списываем стоимость пака
            updateBalance(-packCost);
            
            // Показываем рулетку и ждем результат
            const wonCard = await showRoulette();
            
            console.log('✅ Пак открыт успешно! Получена карта:', wonCard);
            
        } catch (error) {
            console.error('❌ Ошибка при открытии пака:', error);
            alert(`Ошибка: ${error.message}`);
        } finally {
            // Восстанавливаем кнопку
            isOpeningPack = false;
            openPackBtn.disabled = false;
            openPackBtn.textContent = originalText;
            console.log('🔄 Кнопка восстановлена');
        }
    });
    
    // Кнопка закрытия рулетки
    closeRouletteBtn.addEventListener('click', function() {
        document.getElementById('rouletteContainer').style.display = 'none';
    });
}

// ========== ПОКАЗ КАРТ ПОЛЬЗОВАТЕЛЯ ==========
function displayMyCards() {
    const myCardsDiv = document.getElementById('myCards');
    
    if (!myCards || myCards.length === 0) {
        myCardsDiv.innerHTML = `
            <div style="
                text-align: center;
                padding: 30px;
                background: #1e293b;
                border-radius: 10px;
                color: #94a3b8;
            ">
                <div style="font-size: 48px; margin-bottom: 10px;">🃏</div>
                <p>У вас пока нет карт</p>
                <p style="font-size: 14px;">Откройте пак, чтобы получить первую карту!</p>
            </div>
        `;
        return;
    }
    
    myCardsDiv.innerHTML = `
        <div style="
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
            gap: 15px;
        ">
            ${myCards.map(card => `
                <div class="user-card" style="
                    background: #1e293b;
                    border-radius: 10px;
                    padding: 12px;
                    text-align: center;
                    border: 2px solid ${getRarityColor(card.rarity)};
                    transition: transform 0.3s;
                ">
                    <img src="images/${card.image}" 
                         alt="Card ${card.cardId}"
                         style="
                            width: 100%;
                            height: 140px;
 object-fit: cover;
                            border-radius: 8px;
                            margin-bottom: 10px;
                         "
                         onerror="this.onerror=null; this.src='https://via.placeholder.com/150x140/1e293b/ffffff?text=Card+${card.cardId}'">
                    <div style="font-weight: bold; margin-bottom: 5px; font-size: 14px;">
                        Карта #${card.cardId}
                    </div>
                    <div style="color: ${getRarityColor(card.rarity)}; font-size: 12px; margin-bottom: 10px; font-weight: bold;">
                        ${card.rarity ? card.rarity.toUpperCase() : 'COMMON'}
                    </div>
                    <button onclick="sellCard(${card.id})" 
                            style="
                                background: #22c55e;
                                color: white;
                                border: none;
                                padding: 8px 12px;
                                border-radius: 6px;
                                font-size: 12px;
                                cursor: pointer;
                                width: 100%;
                                transition: background 0.3s;
                            "
                            onmouseover="this.style.background='#16a34a'"
                            onmouseout="this.style.background='#22c55e'">
                        💰 Продать
                    </button>
                </div>
            `).join('')}
        </div>
    `;
}

// ========== МАРКЕТ ==========
function loadMarket() {
    console.log('Loading market...');
    const marketDiv = document.getElementById('market');
    
    // Для демо - создаем тестовые лоты
    const demoListings = [
        { id: 1, cardId: 3, cardName: 'Огненный дракон', rarity: 'epic', price: 300 },
        { id: 2, cardId: 7, cardName: 'Водяной дух', rarity: 'rare', price: 150 },
        { id: 3, cardId: 1, cardName: 'Земляной голем', rarity: 'common', price: 50 },
        { id: 4, cardId: 10, cardName: 'Легендарный феникс', rarity: 'legendary', price: 1000 }
    ];
    
    marketDiv.innerHTML = `
        <div style="
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
        ">
            ${demoListings.map(listing => `
                <div class="market-listing" style="
                    background: #1e293b;
                    border-radius: 10px;
                    padding: 15px;
                    text-align: center;
                    border: 2px solid ${getRarityColor(listing.rarity)};
                ">
                    <div style="font-weight: bold; font-size: 16px; margin-bottom: 10px;">
                        ${listing.cardName}
                    </div>
                    <img src="images/card${listing.cardId}.png" 
                         alt="${listing.cardName}"
                         style="
                            width: 100%;
                            height: 120px;
                            object-fit: cover;
                            border-radius: 8px;
                            margin-bottom: 10px;
                         "
                         onerror="this.onerror=null; this.src='https://via.placeholder.com/200x120/1e293b/ffffff?text=${encodeURIComponent(listing.cardName)}'">
                    <div style="color: ${getRarityColor(listing.rarity)}; font-size: 12px; margin-bottom: 10px; font-weight: bold;">
                        ${listing.rarity.toUpperCase()}
                    </div>
                    <div style="color: #22c55e; font-weight: bold; font-size: 18px; margin: 10px 0;">
                        ${listing.price} хериков
                    </div>
                    <button onclick="buyCard(${listing.id})" 
                            style="
                                background: #6366f1;
                                color: white;
                                border: none;
padding: 8px 15px;
                                border-radius: 6px;
                                cursor: pointer;
                                width: 100%;
                                font-size: 14px;
                                transition: background 0.3s;
                            "
                            onmouseover="this.style.background='#4f46e5'"
                            onmouseout="this.style.background='#6366f1'">
                        🛒 Купить
                    </button>
                </div>
            `).join('')}
        </div>
    `;
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function getRarityColor(rarity) {
    const colors = {
        common: '#94a3b8',
        rare: '#3b82f6',
        epic: '#a855f7',
        legendary: '#f59e0b',
        mythic: '#ef4444'
    };
    return colors[rarity?.toLowerCase()] || colors.common;
}

function getRandomRarity() {
    const rand = Math.random();
    if (rand < 0.5) return 'common';      // 50%
    if (rand < 0.8) return 'rare';        // 30%
    if (rand < 0.95) return 'epic';       // 15%
    return 'legendary';                   // 5%
}

function sellCard(cardId) {
    const card = myCards.find(c => c.id === cardId);
    if (!card) {
        alert('Карта не найдена!');
        return;
    }
    
    const defaultPrice = card.rarity === 'legendary' ? 500 :
                        card.rarity === 'epic' ? 300 :
                        card.rarity === 'rare' ? 150 : 50;
    
    const price = prompt(`Введите цену для карты #${card.cardId} (${card.rarity}):`, defaultPrice.toString());
    if (price && !isNaN(price) && price > 0) {
        if (confirm(`Выставить карту #${card.cardId} на продажу за ${price} хериков?`)) {
            // Удаляем карту из коллекции
            myCards = myCards.filter(c => c.id !== cardId);
            displayMyCards();
            
            // Добавляем херики за продажу
            updateBalance(parseInt(price));
            
            alert(`✅ Карта #${card.cardId} продана за ${price} хериков!`);
        }
    }
}

function buyCard(listingId) {
    const price = 100; // Для демо фиксированная цена
    const currentBalance = getCurrentBalance();
    
    if (currentBalance >= price) {
        if (confirm(`Купить карту за ${price} хериков?`)) {
            updateBalance(-price);
            alert('🎉 Покупка успешна! Карта добавлена в вашу коллекцию.');
            // Здесь можно добавить логику добавления карты
        }
    } else {
        alert('❌ Недостаточно хериков для покупки!');
    }
}

// ========== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== DOM LOADED ===');
    
    // 1. Инициализируем кнопку фарма
    initializeFarmButton();
    
    // 2. Инициализируем кнопку открытия пака
    initializeOpenPackButton();
    
    // 3. Загружаем начальные данные
    loadProfile();
    loadMarket();
    displayMyCards(); // Показываем пустые карты сначала
    
    console.log('=== APP INITIALIZED ===');
});

// ========== ГЛОБАЛЬНЫЕ ФУНКЦИИ ==========
window.sellCard = sellCard;
window.buyCard = buyCard;                                   