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

// Backend URL (измените если нужно)
const BACKEND_URL = 'http://localhost:3000';
console.log('Backend URL:', BACKEND_URL);

// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
let isOpeningPack = false;

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
            document.getElementById('balance').textContent = `${data.heriki || data.balance || 100} хериков`;
        } else {
            console.warn('Profile endpoint failed, using default balance');
            document.getElementById('balance').textContent = '100 хериков';
        }
    } catch (error) {
        console.error('Profile load error:', error);
        document.getElementById('balance').textContent = 'Ошибка загрузки';
    }
}

// ========== ОТКРЫТИЕ ПАКА ==========
function initializeOpenPackButton() {
    console.log('Initializing open pack button...');
    const openPackBtn = document.getElementById('openPack');
    
    if (!openPackBtn) {
        console.error('❌ Кнопка #openPack не найдена!');
        return;
    }
    
    console.log('✅ Кнопка найдена, добавляем обработчик');
    
    openPackBtn.addEventListener('click', async function() {
        console.log('🎯 Кнопка нажата!');
        
        if (isOpeningPack) {
            console.log('Уже открывается пак, игнорируем');
            return;
        }
        
        isOpeningPack = true;
        const originalText = openPackBtn.textContent;
        
        try {
            // 1. Показываем загрузку
            openPackBtn.disabled = true;
            openPackBtn.textContent = '⌛️ Открываем...';
            openPackBtn.style.opacity = '0.7';
            
            const openingDiv = document.getElementById('opening');
            const cardsDiv = document.getElementById('cards');
            
            openingDiv.style.display = 'block';
            cardsDiv.innerHTML = '<p>Подготовка...</p>';
            
            console.log('⏳ Начинаем открытие пака...');
            
            // 2. Имитируем задержку для анимации
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // 3. Пробуем открыть пак через бэкенд
            console.log(`📡 Отправляем запрос на ${BACKEND_URL}/open-pack`);
            
            let cardsData;
            
            try {
                const response = await fetch(`${BACKEND_URL}/open-pack`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        userId,
                        username,
                        timestamp: Date.now()
                    })
                });
                
                console.log('Response status:', response.status);
                
                if (response.ok) {
const data = await response.json();
                    console.log('✅ Пак открыт успешно:', data);
                    cardsData = data.cards || data;
                    
                    if (!cardsData || !Array.isArray(cardsData)) {
                        throw new Error('Некорректный ответ от сервера');
                    }
                } else {
                    console.warn('⚠️ Бэкенд недоступен, используем тестовые данные');
                    // Тестовые данные для демонстрации
                    cardsData = [
                        { id: 1, cardId: 101, rarity: 'common', name: 'Тестовая карта 1' },
                        { id: 2, cardId: 202, rarity: 'rare', name: 'Тестовая карта 2' },
                        { id: 3, cardId: 303, rarity: 'epic', name: 'Тестовая карта 3' }
                    ];
                }
            } catch (fetchError) {
                console.error('Fetch error:', fetchError);
                // Тестовые данные при ошибке
                cardsData = [
                    { id: 1, cardId: 101, rarity: 'common', name: 'Карта огня' },
                    { id: 2, cardId: 102, rarity: 'rare', name: 'Карта воды' },
                    { id: 3, cardId: 103, rarity: 'common', name: 'Карта земли' }
                ];
            }
            
            // 4. Скрываем анимацию загрузки
            openingDiv.style.display = 'none';
            
            // 5. Показываем карты
            console.log(`🃏 Показываем ${cardsData.length} карт`);
            cardsDiv.innerHTML = <h3>🎉 Вы получили ${cardsData.length} карт:</h3>;
            
            cardsData.forEach((card, index) => {
                setTimeout(() => {
                    showCard(card);
                }, index * 400);
            });
            
            // 6. Обновляем профиль и маркет
            await loadProfile();
            await loadMarket();
            
            console.log('✅ Открытие пака завершено успешно');
            
        } catch (error) {
            console.error('❌ Ошибка при открытии пака:', error);
            
            // Показываем ошибку
            document.getElementById('cards').innerHTML = `
                <div style="background: #dc2626; color: white; padding: 20px; border-radius: 10px; text-align: left;">
                    <h3>⚠️ Ошибка</h3>
                    <p>${error.message}</p>
                    <p>Проверьте:</p>
                    <ul>
                        <li>Запущен ли сервер на ${BACKEND_URL}</li>
                        <li>Есть ли эндпоинт POST /open-pack</li>
                        <li>Консоль браузера (F12) для подробностей</li>
                    </ul>
                    <button onclick="testOpenPack()" style="margin-top: 10px; padding: 10px;">
                        Попробовать тестовые данные
                    </button>
                </div>
            `;
        } finally {
            // 7. Восстанавливаем кнопку
            isOpeningPack = false;
            openPackBtn.disabled = false;
            openPackBtn.textContent = originalText;
            openPackBtn.style.opacity = '1';
            console.log('🔄 Кнопка восстановлена');
        }
    });
    
    console.log('✅ Обработчик добавлен на кнопку');
}

// ========== ПОКАЗ КАРТЫ ==========
function showCard(card) {
    console.log('Showing card:', card);
    
    const cardsDiv = document.getElementById('cards');
    const cardId = card.cardId || card.id || '1';
    const rarity = card.rarity || 'common';
    
    const cardElement = document.createElement('div');
    cardElement.className = 'card-wrapper';
    cardElement.style.cssText = `
        display: inline-block;
        margin: 10px;
        width: 150px;
        height: 220px;
        perspective: 1000px;
    `;
    
    cardElement.innerHTML = `
        <div class="card-inner" style="
            position: relative;
            width: 100%;
            height: 100%;
            transform-style: preserve-3d;
            transition: transform 0.8s;
            border-radius: 12px;
 ">
            <!-- Задняя сторона -->
            <div class="card-back" style="
                position: absolute;
                width: 100%;
                height: 100%;
                backface-visibility: hidden;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 12px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                color: white;
                font-size: 14px;
            ">
                <div style="font-size: 48px;">🂠</div>
                <div>Card Pack</div>
            </div>
            
            <!-- Передняя сторона -->
            <div class="card-front ${rarity}" style="
                position: absolute;
                width: 100%;
                height: 100%;
                backface-visibility: hidden;
                transform: rotateY(180deg);
                background: #1e293b;
                border-radius: 12px;
                padding: 10px;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: space-between;
                border: 2px solid ${getRarityColor(rarity)};
            ">
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: ${getRarityColor(rarity)}; margin-bottom: 5px;">
                        ${rarity.toUpperCase()}
                    </div>
                    <img src="images/card${cardId}.png" 
                         alt="Card ${cardId}"
                         style="width: 100px; height: 140px; object-fit: cover; border-radius: 8px; margin-bottom: 10px;"
                         onerror="this.onerror=null; this.src='https://via.placeholder.com/100x140/2d3748/ffffff?text=Card+${cardId}'">
                    <div style="font-weight: bold; font-size: 14px;">Карта #${cardId}</div>
                    <div style="font-size: 12px; color: #94a3b8;">${card.name || ''}</div>
                </div>
                
                <button onclick="sellCard(${card.id || cardId})" 
                        style="
                            background: #22c55e;
                            color: white;
                            border: none;
                            padding: 6px 12px;
                            border-radius: 6px;
                            font-size: 12px;
                            cursor: pointer;
                            margin-top: 10px;
                        ">
                    💰 Продать
                </button>
            </div>
        </div>
    `;
    
    cardsDiv.appendChild(cardElement);
    
    // Анимация переворота
    setTimeout(() => {
        cardElement.querySelector('.card-inner').style.transform = 'rotateY(180deg)';
    }, 100);
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function getRarityColor(rarity) {
    const colors = {
        common: '#94a3b8',
        rare: '#3b82f6',
        epic: '#a855f7',
        legendary: '#f59e0b'
    };
    return colors[rarity?.toLowerCase()] || colors.common;
}

function sellCard(cardId) {
    const price = prompt('Введите цену продажи:', '100');
    if (price && !isNaN(price)) {
        if (confirm(`Продать карту #${cardId} за ${price} хериков?`)) {
            alert(`Карта #${cardId} выставлена на продажу за ${price} хериков!`);
            loadMarket();
        }
    }
}

// ========== МАРКЕТ ==========
async function loadMarket() {
    console.log('Loading market...');
    const marketDiv = document.getElementById('market');
    
    try {
        marketDiv.innerHTML = '<p>Загрузка маркета...</p>';
        
        const response = await fetch(`${BACKEND_URL}/market`);
        
        if (response.ok) {
            const listings = await response.json();
            console.log('Market listings:', listings);
            
            if (listings && listings.length > 0) {
                marketDiv.
 innerHTML = '';
                listings.forEach(listing => {
                    const div = document.createElement('div');
                    div.className = 'card';
                    div.innerHTML = `
                        <div><b>${listing.cardName || 'Карта'}</b></div>
                        <div class="price">${listing.price || 0} хериков</div>
                        <button onclick="buyCard(${listing.id})">Купить</button>
                    `;
                    marketDiv.appendChild(div);
                });
            } else {
                marketDiv.innerHTML = '<p>На маркете пока пусто</p>';
            }
        } else {
            marketDiv.innerHTML = '<p>Маркет временно недоступен</p>';
        }
    } catch (error) {
        console.error('Market load error:', error);
        marketDiv.innerHTML = '<p>Ошибка загрузки маркета</p>';
    }
}

function buyCard(listingId) {
    alert(`Покупка карты #${listingId} - в разработке`);
}

// ========== ТЕСТОВАЯ ФУНКЦИЯ ==========
function testOpenPack() {
    console.log('Test function called');
    const cardsDiv = document.getElementById('cards');
    cardsDiv.innerHTML = '<h3>Тестовые карты:</h3>';
    
    const testCards = [
        { id: 1, cardId: 101, rarity: 'common', name: 'Тест 1' },
        { id: 2, cardId: 102, rarity: 'rare', name: 'Тест 2' },
        { id: 3, cardId: 103, rarity: 'epic', name: 'Тест 3' }
    ];
    
    testCards.forEach((card, index) => {
        setTimeout(() => showCard(card), index * 400);
    });
}

// ========== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== DOM LOADED ===');
    
    // 1. Инициализируем кнопку открытия пака
    initializeOpenPackButton();
    
    // 2. Загружаем начальные данные
    loadProfile();
    loadMarket();
    
    // 3. Добавляем тестовую кнопку (можно убрать)
    const testBtn = document.createElement('button');
    testBtn.textContent = '🔄 Тест';
    testBtn.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        padding: 10px;
        background: #666;
        color: white;
        border-radius: 5px;
        z-index: 1000;
    `;
    testBtn.onclick = testOpenPack;
    document.body.appendChild(testBtn);
    
    console.log('=== APP INITIALIZED ===');
});

// ========== ГЛОБАЛЬНЫЕ ФУНКЦИИ ==========
window.testOpenPack = testOpenPack;
window.sellCard = sellCard;
window.buyCard = buyCard;          