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

// Картинки для рулетки
const CARD_IMAGES = [
    'card1.png', 'card2.png', 'card3.png', 'card4.png', 'card5.png',
    'card6.png', 'card7.png', 'card8.png', 'card9.png', 'card10.png'
];

// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
let isOpeningPack = false;
let myCards = [];
let totalClicks = 0;
let heriksPerClick = 1;
let farmBoost = 1;
let lastClickTime = 0;
const CLICK_COOLDOWN = 100; // 100ms между кликами

// ========== ПРОФИЛЬ ==========
async function loadProfile() {
    console.log('Loading profile...');
    try {
        document.getElementById('username').textContent = `@${username}`;
        
        // Пробуем получить баланс с сервера
        const response = await fetch(`${BACKEND_URL}/profile?userId=${userId}&username=${encodeURIComponent(username)}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('Profile data:', data);
            updateBalanceDisplay(data.heriki || data.balance || 100);
            
            // Загружаем карты пользователя
            if (data.cards && Array.isArray(data.cards)) {
                myCards = data.cards;
                displayMyCards();
            }
            
            // Загружаем статистику фарма если есть
            if (data.farmStats) {
                totalClicks = data.farmStats.totalClicks || 0;
                updateFarmCounter();
            }
        } else {
            console.warn('Profile endpoint failed, using defaults');
            updateBalanceDisplay(100);
        }
    } catch (error) {
        console.error('Profile load error:', error);
        updateBalanceDisplay('Ошибка загрузки');
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
    
    // Сохраняем на сервер если нужно
    saveBalanceToServer(newBalance);
    
    return newBalance;
}

async function saveBalanceToServer(balance) {
    try {
        await fetch(`${BACKEND_URL}/update-balance`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                userId,
                balance,
                totalClicks
            })
        });
    } catch (error) {
        console.warn('Не удалось сохранить баланс на сервер:', error);
    }
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
        const earned = heriksPerClick * farmBoost;
        const newBalance = updateBalance(earned);
        
        // Обновляем статистику
        totalClicks++;
        updateFarmCounter();
        
        // Сохраняем статистику
        saveFarmStats();
        
        console.log(`💰 Получено ${earned} хериков. Всего: ${newBalance}`);
    });
    
    console.log('✅ Кнопка фарма инициализирована');
}

function createCoinEffect(event) {
    const coin = document.createElement('div');
    coin.className = 'coin-popup';
    coin.textContent = `+${heriksPerClick * farmBoost} 💰`;
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
            <div>Хериков за клик: <b>${heriksPerClick * farmBoost}</b></div>
            <div style="font-size: 12px; color: #6366f1;">Буст: x${farmBoost}</div>
        `;
    }
}

function saveFarmStats() {
    try {
        localStorage.setItem('farmStats_' + userId, JSON.stringify({
            totalClicks,
            lastUpdate: Date.now()
        }));
    } catch (error) {
        console.warn('Не удалось сохранить статистику:', error);
    }
}

// ========== РУЛЕТКА ДЛЯ ОТКРЫТИЯ ПАКА ==========
function showRoulette() {
    const rouletteContainer = document.getElementById('rouletteContainer');
    const rouletteTrack = document.getElementById('rouletteTrack');
    const rouletteResult = document.getElementById('rouletteResult');
    
    // Показываем контейнер рулетки
    rouletteContainer.style.display = 'block';
    rouletteResult.innerHTML = '🎰 Крутим рулетку...';
    
    // Очищаем трек
    rouletteTrack.innerHTML = '';
    rouletteTrack.style.transform = 'translateX(0)';
    
    // Добавляем много картинок для эффекта бесконечной ленты
    for (let i = 0; i < 30; i++) {
        const randomImage = CARD_IMAGES[Math.floor(Math.random() * CARD_IMAGES.length)];
        const img = document.createElement('img');
        img.src = `images/${randomImage}`;
        img.className = 'card-image';
        img.alt = Card `${i + 1}`;
        img.onerror = function() {
            this.src = 'https://via.placeholder.com/180x180/1e293b/ffffff?text=Card+' + (i + 1);
        };
        rouletteTrack.appendChild(img);
    }
    
    return new Promise((resolve) => {
        // Выбираем случайную картинку как победителя
        const winnerIndex = Math.floor(Math.random() * 20) + 5;
        const winnerImage = CARD_IMAGES[Math.floor(Math.random() * CARD_IMAGES.length)];
        const winnerRarity = getRandomRarity();
        
        // Анимируем движение рулетки
        setTimeout(() => {
            // Вычисляем смещение для остановки на победителе
            const targetPosition = -(winnerIndex * 200);
            rouletteTrack.style.transform = `translateX(${targetPosition}px)`;
            
            // Подсвечиваем победившую картинку
            setTimeout(() => {
                const images = rouletteTrack.querySelectorAll('.card-image');
                if (images[winnerIndex]) {
                    images[winnerIndex].classList.add('highlighted');
                }
                
                // Показываем результат
                setTimeout(() => {
                    const cardId = winnerImage.replace('card', '').replace('.png', '');
                    const card = {        
id: Date.now(),
                        cardId: parseInt(cardId) || 1,
                        rarity: winnerRarity,
                        name: `Карта #${cardId}`,
                        image: winnerImage
                    };
                    
                    rouletteResult.innerHTML = `
                        🎉 Вы получили: <span style="color:${getRarityColor(winnerRarity)}">
                        ${winnerRarity.toUpperCase()} карту #${cardId}</span>!
                    `;
                    
                    // Добавляем карту в коллекцию
                    myCards.push(card);
                    displayMyCards();
                    
                    // Скрываем рулетку через 3 секунды
                    setTimeout(() => {
                        rouletteContainer.style.display = 'none';
                        resolve(card);
                    }, 3000);
                    
                }, 1000);
            }, 2000);
        }, 100);
    });
}

// ========== ОТКРЫТИЕ ПАКА С РУЛЕТКОЙ ==========
function initializeOpenPackButton() {
    console.log('Initializing open pack button...');
    const openPackBtn = document.getElementById('openPack');
    
    if (!openPackBtn) {
        console.error('❌ Кнопка #openPack не найдена!');
        return;
    }
    
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
            openPackBtn.textContent = '⌛️ Обработка...';
            
            // Проверяем баланс
            const currentBalance = getCurrentBalance();
            const packCost = 50;
            
            if (currentBalance < packCost) {
                alert(`❌ Недостаточно хериков! Нужно ${packCost}, у вас ${currentBalance}`);
                return;
            }
            
            // Списываем стоимость пака
            updateBalance(-packCost);
            
            // Показываем рулетку
            const wonCard = await showRoulette();
            
            // Отправляем данные на сервер
            try {
                await fetch(`${BACKEND_URL}/open-pack`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        userId,
                        username,
                        card: wonCard,
                        timestamp: Date.now()
                    })
                });
            } catch (error) {
                console.warn('Не удалось сохранить на сервер:', error);
            }
            
            console.log('✅ Пак открыт успешно!');
            
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
}

// ========== ПОКАЗ КАРТ ПОЛЬЗОВАТЕЛЯ ==========
function displayMyCards() {
    const myCardsDiv = document.getElementById('myCards');
    
    if (!myCards || myCards.length === 0) {
        myCardsDiv.innerHTML = '<p style="text-align: center; color: #94a3b8;">У вас пока нет карт</p>';
        return;
    }
    
    myCardsDiv.innerHTML = `
        <div style="
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 15px;
            margin-top: 15px;
        ">
            ${myCards.map(card => `
<div class="card ${card.rarity}" style="
                    background: #1e293b;
                    border-radius: 10px;
                    padding: 12px;
                    text-align: center;
                    border: 2px solid ${getRarityColor(card.rarity)};
                    animation: newCard 0.5s ease-out;
                ">
                    <img src="images/${card.image || `card${card.cardId}.png`}" 
                         alt="Card ${card.cardId}"
                         style="
                            width: 100%;
                            height: 140px;
                            object-fit: cover;
                            border-radius: 8px;
                            margin-bottom: 10px;
                         "
                         onerror="this.onerror=null; this.src='https://via.placeholder.com/150x140/1e293b/ffffff?text=Card+${card.cardId}'">
                    <div style="font-weight: bold; margin-bottom: 5px;">Карта #${card.cardId}</div>
                    <div style="color: ${getRarityColor(card.rarity)}; font-size: 12px; margin-bottom: 10px;">
                        ${card.rarity ? card.rarity.toUpperCase() : 'COMMON'}
                    </div>
                    <button onclick="sellCard(${card.id})" 
                            style="
                                background: #22c55e;
                                color: white;
                                border: none;
                                padding: 6px 12px;
                                border-radius: 6px;
                                font-size: 12px;
                                cursor: pointer;
                                width: 100%;
                            ">
                        💰 Продать
                    </button>
                </div>
            `).join('')}
        </div>
    `;
}

// ========== МАРКЕТ ==========
async function loadMarket() {
    console.log('Loading market...');
    const marketDiv = document.getElementById('market');
    
    try {
        marketDiv.innerHTML = '<p style="text-align: center;">Загрузка маркета...</p>';
        
        const response = await fetch(`${BACKEND_URL}/market`);
        
        if (response.ok) {
            const listings = await response.json();
            console.log('Market listings:', listings);
            
            if (listings && listings.length > 0) {
                marketDiv.innerHTML = `
                    <div style="
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                        gap: 15px;
                        margin-top: 15px;
                    ">
                        ${listings.map(listing => `
                            <div class="market-card" style="
                                background: #1e293b;
                                border-radius: 10px;
                                padding: 15px;
                                text-align: center;
                            ">
                                <div style="font-weight: bold; font-size: 16px; margin-bottom: 10px;">
                                    ${listing.cardName || 'Карта #' + (listing.cardId || '?')}
                                </div>
                                <div style="color: ${getRarityColor(listing.rarity)}; font-size: 12px; margin-bottom: 10px;">
                                    ${listing.rarity ? listing.rarity.toUpperCase() : 'COMMON'}
                                </div>
                                <div class="price" style="
                                    color: #22c55e;
                                    font-weight: bold;
                                    font-size: 18px;
                                    margin: 15px 0;
                                ">
                                    ${listing.price || 100} хериков
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
                                        ">
                                    🛒 Купить
                                </button>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                marketDiv.innerHTML = '<p style="text-align: center; color: #94a3b8;">На маркете пока пусто</p>';
            }
        } else {
            marketDiv.innerHTML = '<p style="text-align: center; color: #94a3b8;">Маркет временно недоступен</p>';
        }
    } catch (error) {
        console.error('Market load error:', error);
        marketDiv.innerHTML = '<p style="text-align: center; color: #dc2626;">Ошибка загрузки маркета</p>';
    }
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
    const rarities = ['common', 'common', 'common', 'rare', 'rare', 'epic', 'legendary'];
    return rarities[Math.floor(Math.random() * rarities.length)];
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
            
            // Добавляем на маркет
            addToMarket(card, parseInt(price));
            
            alert(`✅ Карта #${card.cardId} выставлена на маркет за ${price} хериков!`);
        }
    }
}

function addToMarket(card, price) {
    console.log('Adding to market:', { card, price });
    // Для демо просто обновляем интерфейс
    loadMarket();
}

function buyCard(listingId) {
    const price = prompt('Подтвердите покупку (введите сумму):', '100');
    if (price && !isNaN(price)) {
        const currentBalance = getCurrentBalance();
        
        if (currentBalance >= parseInt(price)) {
            if (confirm(`Купить карту за ${price} хериков?`)) {
                updateBalance(-parseInt(price));
                alert('🎉 Покупка успешна! Карта добавлена в вашу коллекцию.');
            }
        } else {
            alert('❌ Недостаточно хериков для покупки!');
        }
    }
}

// ========== БУСТЫ И УЛУЧШЕНИЯ ==========
function addBoost(type, multiplier) {
    farmBoost *= multiplier;
    updateFarmCounter();
    
    let message = '';
    switch(type) {
        case 'double':
            message = '⚡️ БУСТ! Теперь вы получаете в 2 раза больше хериков!';
            heriksPerClick *= 2;
            break;
        case 'triple':
            message = '🔥 МЕГА БУСТ! Теперь вы получаете в 3 раза больше хериков!';
            heriksPerClick *= 3;
            break;
        default:
            message = '✨ Получен буст!';
    }
    
    alert(message);
    
    // Сбрасываем буст через 30 секунд
    setTimeout(() => {
        farmBoost /= multiplier;
heriksPerClick = 1;
        updateFarmCounter();
        alert('⏰ Буст закончился');
    }, 30000);
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
    
    // 4. Восстанавливаем статистику из localStorage
    try {
        const savedStats = localStorage.getItem('farmStats_' + userId);
        if (savedStats) {
            const stats = JSON.parse(savedStats);
            totalClicks = stats.totalClicks || 0;
            updateFarmCounter();
        }
    } catch (error) {
        console.warn('Не удалось загрузить статистику:', error);
    }
    
    console.log('=== APP INITIALIZED ===');
});

// ========== ГЛОБАЛЬНЫЕ ФУНКЦИИ ==========
window.sellCard = sellCard;
window.buyCard = buyCard;
window.addBoost = addBoost;                       