// ========== КОНФИГУРАЦИЯ ==========
const CONFIG = {
    BACKEND_URL: 'http://localhost:3000',
    PACK_COST: 50,
    MIN_SELL_PRICE: 10,
    MAX_SELL_PRICE: 10000
};

// ========== ИНИЦИАЛИЗАЦИЯ ==========
console.log('=== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ===');

let tg, userId, username;

// Инициализация Telegram WebApp
try {
    tg = window.Telegram?.WebApp;
    if (tg) {
        tg.expand();
        tg.ready();
        console.log('✅ Telegram WebApp инициализирован');
        
        userId = tg.initDataUnsafe?.user?.id;
        username = tg.initDataUnsafe?.user?.username || 'user_' + userId;
        
        if (!userId) {
            console.warn('❌ ID пользователя не найден, использую временный');
            userId = 'temp_' + Date.now();
            username = 'guest_' + Math.floor(Math.random() * 1000);
        }
    } else {
        console.warn('⚠️ Telegram WebApp не найден, режим браузера');
        userId = 'browser_' + Date.now();
        username = 'browser_user';
    }
} catch (error) {
    console.error('❌ Ошибка инициализации Telegram:', error);
    userId = 'error_' + Date.now();
    username = 'error_user';
}

console.log('👤 Пользователь:', { userId, username });

// Глобальные переменные
let userData = {
    balance: 100,
    cards: [],
    farmStats: { totalClicks: 0 }
};

let marketListings = [];
let isOpeningPack = false;

// ========== API ВЗАИМОДЕЙСТВИЕ С БЭКЕНДОМ ==========
const API = {
    // Загрузка данных пользователя
    async loadUserData() {
        try {
            console.log(`📥 Загрузка данных пользователя ${userId}...`);
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/user/${userId}`);
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Данные пользователя загружены:', data);
                
                // Если на сервере есть данные, используем их
                if (data && Object.keys(data).length > 0) {
                    return data;
                }
            } else {
                console.warn(`⚠️ Сервер вернул ошибку ${response.status}`);
            }
        } catch (error) {
            console.warn('⚠️ Не удалось загрузить данные с сервера:', error);
        }
        
        // Возвращаем начальные данные для нового пользователя
        console.log('🆕 Созданы начальные данные для нового пользователя');
        return {
            balance: 100,
            cards: [],
            farmStats: { totalClicks: 0 }
        };
    },
    
    // Сохранение данных пользователя
    async saveUserData() {
        try {
            console.log(`💾 Сохранение данных пользователя ${userId}...`);
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/user/${userId}`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(userData)
            });
            
            if (response.ok) {
                console.log('✅ Данные пользователя сохранены');
                return true;
            } else {
                console.warn(`⚠️ Сервер вернул ошибку ${response.status} при сохранении`);
            }
        } catch (error) {
            console.warn('⚠️ Не удалось сохранить данные:', error);
        }
        return false;
    },
    
    // Загрузка маркета
    async loadMarket() {
        try {
            console.log('🛒 Загрузка маркета...');
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/market`);
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Маркет загружен, лотов:', data.length);
                return data;
            }
        } catch (error) {
            console.warn('⚠️ Не удалось загрузить маркет:', error);
        }
        return [];
    },
    
    // Создание лота на маркете
    async createListing(card, price) {
        try {
            console.log(`🏷️ Создание лота для карты ${card.
cardId} за ${price}...`);
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/market/list`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    sellerId: userId,
                    sellerName: username,
                    cardId: card.cardId,
                    rarity: card.rarity,
                    price: price
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Лот создан:', data);
                return data;
            } else {
                console.warn(`⚠️ Ошибка создания лота ${response.status}`);
            }
        } catch (error) {
            console.warn('⚠️ Не удалось создать лот:', error);
        }
        return null;
    },
    
    // Покупка карты с маркета
    async buyListing(listingId) {
        try {
            console.log(`🛒 Покупка лота ${listingId}...`);
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/market/buy`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    buyerId: userId,
                    listingId: listingId
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Карта куплена:', data);
                return data;
            } else {
                console.warn(`⚠️ Ошибка покупки ${response.status}`);
            }
        } catch (error) {
            console.warn('⚠️ Не удалось купить карту:', error);
        }
        return null;
    },
    
    // Открытие пака
    async openPack() {
        try {
            console.log('🎁 Открытие пака...');
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/open-pack`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ 
                    userId: userId,
                    cost: CONFIG.PACK_COST 
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Пак открыт:', data);
                return data;
            }
        } catch (error) {
            console.warn('⚠️ Не удалось открыть пак через API:', error);
        }
        
        // Локальная логика если бэкенд недоступен
        console.log('🔄 Использую локальную генерацию карты');
        return this.generateRandomCard();
    },
    
    // Генерация случайной карты (локально)
    generateRandomCard() {
        const cardId = Math.floor(Math.random() * 10) + 1;
        const rarities = ['common', 'common', 'common', 'rare', 'rare', 'epic', 'legendary'];
        const rarity = rarities[Math.floor(Math.random() * rarities.length)];
        
        return {
            success: true,
            card: {
                id: 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                cardId: cardId,
                rarity: rarity,
                name: `Карта #${cardId}`,
                ownerId: userId
            }
        };
    }
};

// ========== УТИЛИТЫ ==========
const Utils = {
    // Получение цвета редкости
    getRarityColor(rarity) {
        const colors = {
            common: '#94a3b8',
            rare: '#3b82f6',
            epic: '#a855f7',
            legendary: '#f59e0b'
        };
        return colors[rarity?.toLowerCase()] || colors.common;
    },
    
    // Форматирование числа
    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    },
    // Генерация URL картинки
    getCardImageUrl(cardId) {
        return `images/card${cardId}.png`;
    },
    
    // Создание элемента картинки с fallback
    createCardImage(cardId, className = '', width = '100%', height = '140px') {
        const img = document.createElement('img');
        img.className = className;
        img.alt = `Card ${cardId}`;
        img.style.width = width;
        img.style.height = height;
        img.style.objectFit = 'cover';
        img.style.borderRadius = '8px';
        img.style.border = '1px solid #334155';
        
        const imageUrl = this.getCardImageUrl(cardId);
        console.log(`🖼️ Загружаю картинку: ${imageUrl} для карты ${cardId}`);
        img.src = imageUrl;
        
        // Fallback если картинка не загрузилась
        img.onerror = () => {
            console.warn(`❌ Картинка card${cardId}.png не найдена`);
            img.src = `https://via.placeholder.com/150x200/1e293b/ffffff?text=Card+${cardId}`;
        };
        
        return img;
    },
    
    // Показать уведомление
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            border-radius: 8px;
            z-index: 10000;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 20px;">
                    ${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}
                </span>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Автоудаление через 3 секунды
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
        
        // Добавляем стили для анимации если их нет
        if (!document.querySelector('#notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }
};

// ========== ОБНОВЛЕНИЕ ИНТЕРФЕЙСА ==========
const UI = {
    // Обновление профиля
    updateProfile() {
        document.getElementById('username').textContent = `@${username}`;
        document.getElementById('balance').textContent = `${Utils.formatNumber(userData.balance)} хериков`;
        
        const farmCounter = document.getElementById('farmCounter');
        if (farmCounter) {
            farmCounter.innerHTML = `
                <div>Всего кликов: <b>${userData.farmStats.totalClicks || 0}</b></div>
                <div>Хериков за клик: <b>1</b></div>
            `;
        }
    },
    
    // Отображение карт пользователя
    displayUserCards() {
        const container = document.getElementById('myCards');
        
        if (!userData.cards || userData.cards.length === 0) {
            container.innerHTML = `
                <div style="
                    text-align: center;
                    padding: 40px;
                    background: #1e293b;
                    border-radius: 15px;
                    color: #94a3b8;
                    border: 2px dashed #475569;
                ">
<div style="font-size: 48px; margin-bottom: 15px;">🃏</div>
                    <h3 style="color: #cbd5e1; margin-bottom: 10px;">У вас пока нет карт</h3>
                    <p style="margin-bottom: 20px;">Откройте свой первый пак, чтобы получить карты!</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div style="
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
                gap: 15px;
            ">
                ${userData.cards.map(card => `
                    <div class="card-item ${card.rarity}" 
                         style="
                            background: #1e293b;
                            border-radius: 10px;
                            padding: 12px;
                            text-align: center;
                            border: 2px solid ${Utils.getRarityColor(card.rarity)};
                            transition: transform 0.3s;
                         ">
                        ${Utils.createCardImage(card.cardId, 'card-image').outerHTML}
                        <div style="margin: 10px 0;">
                            <div style="font-weight: bold; font-size: 14px; margin-bottom: 5px;">
                                Карта #${card.cardId}
                            </div>
                            <div style="
                                color: ${Utils.getRarityColor(card.rarity)};
                                font-size: 12px;
                                font-weight: bold;
                                background: rgba(0,0,0,0.3);
                                padding: 3px 8px;
                                border-radius: 20px;
                                display: inline-block;
                            ">
                                ${card.rarity?.toUpperCase() || 'COMMON'}
                            </div>
                        </div>
                        <button onclick="sellCard('${card.id}')" 
                                style="
                                    width: 100%;
                                    background: #22c55e;
                                    color: white;
                                    border: none;
                                    padding: 8px;
                                    border-radius: 6px;
                                    cursor: pointer;
                                    font-size: 12px;
                                ">
                            💰 Продать
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    },
    
    // Отображение маркета
    displayMarket() {
        const container = document.getElementById('market');
        
        // Фильтруем свои лоты
        const otherListings = marketListings.filter(listing => listing.sellerId !== userId);
        
        if (otherListings.length === 0) {
            container.innerHTML = `
                <div style="
                    text-align: center;
                    padding: 40px;
                    background: #1e293b;
                    border-radius: 15px;
                    color: #94a3b8;
                    border: 2px dashed #475569;
                ">
                    <div style="font-size: 48px; margin-bottom: 15px;">🏪</div>
                    <h3 style="color: #cbd5e1; margin-bottom: 10px;">Маркет пуст</h3>
                    <p>Другие игроки еще не выставили карты на продажу</p>
                    <p style="margin-top: 20px; font-size: 14px; color: #64748b;">
                        Будьте первым - выставьте свою карту!
                    </p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div style="
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                gap: 15px;
            ">
                ${otherListings.map(listing => {
const canBuy = userData.balance >= listing.price;
                    return `
                    <div class="card-item ${listing.rarity}" 
                         style="
                            background: #1e293b;
                            border-radius: 10px;
                            padding: 12px;
                            text-align: center;
                            border: 2px solid ${Utils.getRarityColor(listing.rarity)};
                            transition: transform 0.3s;
                         ">
                        ${Utils.createCardImage(listing.cardId, 'card-image').outerHTML}
                        <div style="margin: 10px 0;">
                            <div style="font-weight: bold; font-size: 14px; margin-bottom: 5px;">
                                Карта #${listing.cardId}
                            </div>
                            <div style="
                                color: ${Utils.getRarityColor(listing.rarity)};
                                font-size: 12px;
                                font-weight: bold;
                                background: rgba(0,0,0,0.3);
                                padding: 3px 8px;
                                border-radius: 20px;
                                display: inline-block;
                                margin-bottom: 5px;
                            ">
                                ${listing.rarity?.toUpperCase() || 'COMMON'}
                            </div>
                            <div style="font-size: 12px; color: #94a3b8;">
                                Продавец: ${listing.sellerName || 'Игрок'}
                            </div>
                        </div>
                        <div style="
                            background: rgba(34, 197, 94, 0.1);
                            border-radius: 8px;
                            padding: 10px;
                            margin: 10px 0;
                        ">
                            <div style="font-size: 12px; color: #94a3b8;">Цена:</div>
                            <div style="
                                color: #22c55e;
                                font-weight: bold;
                                font-size: 20px;
                            ">
                                ${Utils.formatNumber(listing.price)} хериков
                            </div>
                        </div>
                        <button onclick="buyMarketCard('${listing.id}')" 
                                style="
                                    width: 100%;
                                    background: ${canBuy ? '#6366f1' : '#94a3b8'};
                                    color: white;
                                    border: none;
                                    padding: 10px;
                                    border-radius: 6px;
                                    cursor: ${canBuy ? 'pointer' : 'not-allowed'};
                                "
                                ${!canBuy ? 'disabled' : ''}>
                            ${canBuy ? '🛒 Купить' : '❌ Недостаточно'}
                        </button>
                    </div>
                `}).join('')}
            </div>
        `;
    }
};

// ========== РУЛЕТКА ==========
const Roulette = {
    async show() {
        const container = document.getElementById('rouletteContainer');
        const rouletteDiv = document.getElementById('roulette');
        const resultText = document.getElementById('resultText');
        const title = document.getElementById('rouletteTitle');
        const closeBtn = document.getElementById('closeRoulette');
        
        // Показываем рулетку
        container.style.display = 'block';
        title.textContent = '🎰 Открываем пак...';
        resultText.textContent = 'Подготовка рулетки...';
        closeBtn.style.display = 'none';
        
        // Очищаем
        rouletteDiv.innerHTML = '';
        
        // Создаем трек для карточек
        const track = document.createElement('div');
track.style.cssText = `
            display: flex;
            position: absolute;
            height: 100%;
            align-items: center;
            padding-left: 20px;
            transition: transform 3s cubic-bezier(0.1, 0.7, 0.1, 1);
        `;
        
        // Добавляем карточки
        for (let i = 0; i < 20; i++) {
            const cardId = (i % 10) + 1;
            const img = Utils.createCardImage(cardId, 'roulette-card', '150px', '180px');
            img.style.margin = '0 10px';
            track.appendChild(img);
        }
        
        rouletteDiv.appendChild(track);
        
        return new Promise((resolve) => {
            // Выбираем победителя
            const winnerIndex = Math.floor(Math.random() * 15) + 3;
            const winnerCardId = (winnerIndex % 10) + 1;
            const rarities = ['common', 'common', 'common', 'rare', 'rare', 'epic', 'legendary'];
            const winnerRarity = rarities[Math.floor(Math.random() * rarities.length)];
            
            // Анимация
            setTimeout(() => {
                resultText.textContent = 'Рулетка запущена!';
                
                setTimeout(() => {
                    const cardWidth = 150 + 20;
                    const targetPosition = -(winnerIndex * cardWidth) + (rouletteDiv.offsetWidth / 2) - (cardWidth / 2);
                    track.style.transform = `translateX(${targetPosition}px)`;
                    
                    setTimeout(() => {
                        const cards = track.querySelectorAll('.roulette-card');
                        if (cards[winnerIndex]) {
                            cards[winnerIndex].classList.add('highlight');
                        }
                        
                        // Создаем карту-победителя
                        const wonCard = {
                            id: 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                            cardId: winnerCardId,
                            rarity: winnerRarity,
                            name: `Карта #${winnerCardId}`,
                            ownerId: userId
                        };
                        
                        resultText.innerHTML = `
                            🎉 <strong>ВЫ ВЫИГРАЛИ!</strong><br>
                            <span style="color:${Utils.getRarityColor(winnerRarity)}">
                            ${winnerRarity.toUpperCase()} карту #${winnerCardId}</span>
                        `;
                        title.textContent = '🎊 Поздравляем!';
                        
                        closeBtn.style.display = 'inline-block';
                        resolve(wonCard);
                        
                    }, 2000);
                }, 1000);
            }, 1000);
        });
    }
};

// ========== ГЛОБАЛЬНЫЕ ФУНКЦИИ ==========

// Продажа карты
async function sellCard(cardId) {
    const card = userData.cards.find(c => c.id === cardId);
    if (!card) {
        Utils.showNotification('❌ Карта не найдена!', 'error');
        return;
    }
    
    // Запрашиваем цену
    const suggestedPrice = card.rarity === 'legendary' ? 1000 :
                          card.rarity === 'epic' ? 500 :
                          card.rarity === 'rare' ? 200 : 50;
    
    const priceInput = prompt(
       `Введите цену продажи для ${card.rarity} карты #${card.cardId}:\n\n` +
        `Минимум: ${CONFIG.MIN_SELL_PRICE} хериков\n` +
        `Максимум: ${CONFIG.MAX_SELL_PRICE} хериков\n\n` +
        `Рекомендуемая цена: ${suggestedPrice} хериков`,
        suggestedPrice.toString()
    );
    
    if (!priceInput) return;
    
    const price = parseInt(priceInput);
    if (isNaN(price) || price < CONFIG.MIN_SELL_PRICE || price > CONFIG.MAX_SELL_PRICE) {
        Utils.showNotification(
            `❌ Цена должна быть от ${CONFIG.MIN_SELL_PRICE} до ${CONFIG.MAX_SELL_PRICE} хериков!`, 
            'error'
        );
        return;
    }
    
    if (!confirm(`Выставить карту #${card.cardId} на продажу за ${Utils.formatNumber(price)} хериков?`)) {
return;
    }
    
    // Создаем лот на маркете через API
    const listing = await API.createListing(card, price);
    if (listing) {
        // Удаляем карту у пользователя
        userData.cards = userData.cards.filter(c => c.id !== cardId);
        
        // Обновляем интерфейс
        UI.displayUserCards();
        
        // Добавляем лот в локальный список маркета
        marketListings.push(listing);
        UI.displayMarket();
        
        // Сохраняем данные пользователя
        await API.saveUserData();
        
        Utils.showNotification(
            `✅ Карта выставлена на маркет за ${Utils.formatNumber(price)} хериков!`, 
            'success'
        );
    } else {
        Utils.showNotification('❌ Не удалось создать лот на маркете', 'error');
    }
}

// Покупка карты с маркета
async function buyMarketCard(listingId) {
    const listing = marketListings.find(l => l.id === listingId);
    if (!listing) {
        Utils.showNotification('❌ Лот не найден!', 'error');
        return;
    }
    
    if (userData.balance < listing.price) {
        Utils.showNotification(
            `❌ Недостаточно хериков! Нужно ${listing.price}, у вас ${userData.balance}`, 
            'error'
        );
        return;
    }
    
    if (!confirm(`Купить карту #${listing.cardId} за ${Utils.formatNumber(listing.price)} хериков?`)) {
        return;
    }
    
    // Совершаем покупку через API
    const result = await API.buyListing(listingId);
    if (result && result.success) {
        // Обновляем баланс
        userData.balance -= listing.price;
        
        // Добавляем карту
        userData.cards.push({
            id: 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            cardId: listing.cardId,
            rarity: listing.rarity,
            name: `Карта #${listing.cardId}`,
            ownerId: userId
        });
        
        // Удаляем лот с маркета
        marketListings = marketListings.filter(l => l.id !== listingId);
        
        // Обновляем интерфейс
        UI.updateProfile();
        UI.displayUserCards();
        UI.displayMarket();
        
        // Сохраняем данные
        await API.saveUserData();
        
        Utils.showNotification(
            `🎉 Вы купили карту #${listing.cardId} за ${Utils.formatNumber(listing.price)} хериков!`, 
            'success'
        );
    } else {
        Utils.showNotification('❌ Не удалось купить карту. Возможно, её уже купили.', 'error');
    }
}

// ========== ОСНОВНАЯ ЛОГИКА ==========

// Инициализация кнопки фарма
function initFarmButton() {
    const farmBtn = document.getElementById('farmHeriks');
    if (farmBtn) {
        farmBtn.addEventListener('click', async (e) => {
            // Анимация
            farmBtn.style.animation = 'bounce 0.3s';
            setTimeout(() => farmBtn.style.animation = '', 300);
            
            // Эффект монетки
            const coin = document.createElement('div');
            coin.className = 'coin-popup';
            coin.textContent = '+1 💰';
            coin.style.left = (e.clientX - 20) + 'px';
            coin.style.top = (e.clientY - 20) + 'px';
            document.body.appendChild(coin);
            setTimeout(() => coin.remove(), 1000);
            
            // Обновляем баланс
            userData.balance += 1;
            userData.farmStats.totalClicks = (userData.farmStats.totalClicks || 0) + 1;
            
            UI.updateProfile();
            
            // Сохраняем
            await API.saveUserData();
        });
    }
}

// Инициализация кнопки открытия пака
function initOpenPackButton() {
    const openPackBtn = document.getElementById('openPack');
    if (openPackBtn) {
        openPackBtn.addEventListener('click', async () => {
            if (isOpeningPack) return;
            
            if (userData.balance < CONFIG.PACK_COST) {
                Utils.showNotification(`❌ Недостаточно хериков! Нужно ${CONFIG.PACK_COST}`, 'error');
                return;
            }
            
            isOpeningPack = true;
openPackBtn.disabled = true;
            const originalText = openPackBtn.textContent;
            openPackBtn.textContent = '⌛ Обработка...';
            
            try {
                // Списываем стоимость
                userData.balance -= CONFIG.PACK_COST;
                UI.updateProfile();
                
                // Показываем рулетку
                const wonCard = await Roulette.show();
                
                // Добавляем карту
                userData.cards.push(wonCard);
                UI.displayUserCards();
                
                // Сохраняем данные
                const saved = await API.saveUserData();
                if (saved) {
                    Utils.showNotification(`🎉 Получена ${wonCard.rarity} карта #${wonCard.cardId}!`, 'success');
                }
                
            } catch (error) {
                console.error('Ошибка открытия пака:', error);
                Utils.showNotification('❌ Ошибка при открытии пака', 'error');
            } finally {
                isOpeningPack = false;
                openPackBtn.disabled = false;
                openPackBtn.textContent = originalText;
            }
        });
    }
}

// Инициализация кнопки закрытия рулетки
function initCloseRouletteButton() {
    const closeRouletteBtn = document.getElementById('closeRoulette');
    if (closeRouletteBtn) {
        closeRouletteBtn.addEventListener('click', () => {
            document.getElementById('rouletteContainer').style.display = 'none';
        });
    }
}

// Основная функция инициализации
async function initApp() {
    console.log('=== ЗАГРУЗКА ДАННЫХ ===');
    
    // Загружаем данные пользователя
    const savedData = await API.loadUserData();
    if (savedData) {
        userData = savedData;
        console.log('📊 Данные пользователя:', userData);
    } else {
        console.warn('⚠️ Данные пользователя не загружены, использую начальные');
    }
    
    // Загружаем маркет
    marketListings = await API.loadMarket();
    console.log('🛒 Загружено лотов на маркете:', marketListings.length);
    
    // Обновляем интерфейс
    UI.updateProfile();
    UI.displayUserCards();
    UI.displayMarket();
    
    // Инициализируем кнопки
    initFarmButton();
    initOpenPackButton();
    initCloseRouletteButton();
    
    // Сохраняем данные каждые 10 секунд
    setInterval(async () => {
        const saved = await API.saveUserData();
        if (saved) {
            console.log('💾 Автосохранение выполнено');
        }
    }, 10000);
    
    // Сохраняем при закрытии страницы
    window.addEventListener('beforeunload', async () => {
        await API.saveUserData();
    });
    
    console.log('=== ПРИЛОЖЕНИЕ ЗАПУЩЕНО ===');
}

// ========== ЗАПУСК ПРИЛОЖЕНИЯ ==========
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== DOM ЗАГРУЖЕН ===');
    initApp();
});

// Делаем функции глобальными для вызова из HTML
window.sellCard = sellCard;
window.buyMarketCard = buyMarketCard;
