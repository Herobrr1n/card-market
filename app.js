// ========== КОНФИГУРАЦИЯ ==========
const CONFIG = {
    BACKEND_URL: 'http://localhost:3000',
    PACK_COST: 50,
    MIN_SELL_PRICE: 10,
    MAX_SELL_PRICE: 10000
};

// ========== ИНИЦИАЛИЗАЦИЯ ==========
console.log('=== ЗАПУСК APP.JS ===');

let tg, userId, username, isMobile = false;

// Определяем пользователя
try {
    tg = window.Telegram?.WebApp;
    if (tg) {
        console.log('Telegram WebApp найден');
        tg.expand();
        tg.ready();
        
        userId = tg.initDataUnsafe?.user?.id;
        username = tg.initDataUnsafe?.user?.username || 'user_' + userId;
        
        if (!userId) {
            userId = 'temp_' + Date.now();
            username = 'guest_' + Math.floor(Math.random() * 1000);
        }
    } else {
        console.log('Браузерный режим');
        userId = 'browser_' + Date.now();
        username = 'browser_user';
    }
} catch (error) {
    console.error('Ошибка инициализации:', error);
    userId = 'error_' + Date.now();
    username = 'error_user';
}

isMobile = window.innerWidth <= 768;
console.log('Пользователь:', { userId, username, isMobile });

// Глобальные переменные
let userData = {
    balance: 100,
    cards: [],
    farmStats: { totalClicks: 0 }
};

let marketListings = [];
let isOpeningPack = false;

// ========== УТИЛИТЫ ==========
const Utils = {
    getRarityColor(rarity) {
        const colors = {
            common: '#94a3b8',
            rare: '#3b82f6',
            epic: '#a855f7',
            legendary: '#f59e0b'
        };
        return colors[rarity?.toLowerCase()] || colors.common;
    },
    
    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    },
    
    getCardImageUrl(cardId) {
        return `images/card${cardId}.png`;
    },
    
    createCardImage(cardId, width = '100%', height = '140px') {
        const img = document.createElement('img');
        img.alt = `Card ${cardId}`;
        img.style.width = isMobile ? '100%' : width;
        img.style.height = isMobile ? '120px' : height;
        img.style.objectFit = 'cover';
        img.style.borderRadius = '8px';
        img.style.border = '1px solid #334155';
        
        img.src = this.getCardImageUrl(cardId);
        
        img.onerror = () => {
            img.src = `https://via.placeholder.com/${isMobile ? '120x160' : '150x200'}/1e293b/ffffff?text=Card+${cardId}`;
        };
        
        return img;
    },
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            ${isMobile ? 'left: 50%; transform: translateX(-50%);' : 'right: 20px;'}
            padding: 12px 16px;
            background: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            border-radius: 8px;
            z-index: 10000;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease;
            ${isMobile ? 'width: 90%; max-width: 300px; text-align: center;' : 'max-width: 350px;'}
            font-size: 14px;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
};

// Добавляем стили для анимаций
if (!document.querySelector('#app-styles')) {
    const style = document.createElement('style');
    style.id = 'app-styles';
    style.textContent = `
        @keyframes slideIn {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideOut {
            from { opacity: 1; transform: translateY(0); }
            to { opacity: 0; transform: translateY(-20px); }
        }
        @keyframes bounce {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.2); }
        }
        @keyframes coinEffect {
            0% { transform: translateY(0) scale(1); opacity: 1; }
            100% { transform: translateY(-50px) scale(0.5); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

// ========== API ==========
const API = {
    async loadUserData() {
        try {
            console.log('Запрос данных пользователя...');
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/user/${userId}`);
            
            if (response.ok) {
                const data = await response.json();
                console.log('Данные получены с сервера');
                return data;
            } else {
                console.log('Сервер вернул ошибку:', response.status);
                return this.getDefaultUserData();
            }
        } catch (error) {
            console.warn('Ошибка загрузки данных:', error.message);
            return this.getDefaultUserData();
        }
    },
    
    getDefaultUserData() {
        return {
            balance: 100,
            cards: [],
            farmStats: { totalClicks: 0 },
            username: username
        };
    },
    
    async saveUserData(data) {
        try {
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/user/${userId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return response.ok;
        } catch (error) {
            console.warn('Ошибка сохранения:', error.message);
            return false;
        }
    },
    
    async loadMarket() {
        try {
            console.log('Загрузка маркета...');
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/market`);
            
            if (response.ok) {
                const data = await response.json();
                console.log(`Получено ${data.length} лотов с сервера`);
                
                // Если мало лотов, добавляем демо
                if (data.length < 20) {
                    const demo = this.generateDemoListings(20 - data.length);
                    return [...data, ...demo];
                }
                return data;
            }
            
            // Если сервер недоступен, создаем демо-данные
            console.log('Создаю демо-маркет');
            return this.generateDemoListings(20);
            
        } catch (error) {
            console.warn('Ошибка загрузки маркета:', error.message);
            return this.generateDemoListings(20);
        }
    },
    
    generateDemoListings(count) {
        const listings = [];
        const sellers = ['Игрок1', 'Игрок2', 'Игрок3', 'Игрок4', 'Игрок5'];
        
        for (let i = 0; i < count; i++) {
            const cardId = Math.floor(Math.random() * 10) + 1;
            const rarities = ['common', 'common', 'rare', 'epic', 'legendary'];
            const rarity = rarities[Math.floor(Math.random() * rarities.length)];
            const price = this.calculatePrice(rarity, cardId);
            
            listings.push({
                id: `demo_${Date.now()}_${i}`,
                sellerId: `seller_${i}`,
                sellerName: sellers[Math.floor(Math.random() * sellers.length)],
                cardId: cardId,
                rarity: rarity,
                price: price,
                isDemo: true
            });
        }
        
        console.log(`Сгенерировано ${listings.length} демо-лотков`);
        return listings;
    },
    
    calculatePrice(rarity, cardId) {
        const base = {
            common: 50,
            rare: 200,
            epic: 500,
            legendary: 1000
        };
        return Math.floor((base[rarity] || 50) * (1 + cardId / 20));
    },
    
    async createListing(card, price) {
        try {
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/market/list`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sellerId: userId,
                    sellerName: username,
                    cardId: card.cardId,
                    rarity: card.rarity,
                    price: price
                })
            });
            
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.warn('Ошибка создания лота:', error);
        }
        return null;
    },
    
    async buyListing(listingId) {
        try {
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/market/buy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    buyerId: userId,
                    listingId: listingId
                })
            });
            
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.warn('Ошибка покупки:', error);
        }
        return null;
    }
};

// ========== ИНТЕРФЕЙС ==========
const UI = {
    updateProfile() {
        const usernameEl = document.getElementById('username');
        const balanceEl = document.getElementById('balance');
        const farmCounter = document.getElementById('farmCounter');
        
        if (usernameEl) usernameEl.textContent = `@${username}`;
        if (balanceEl) balanceEl.textContent = `${Utils.formatNumber(userData.balance)} хериков`;
        if (farmCounter) {
            farmCounter.innerHTML = `
                <div>Всего кликов: <b>${userData.farmStats.totalClicks || 0}</b></div>
                <div>Хериков за клик: <b>1</b></div>
            `;
        }
    },
    
    displayUserCards() {
        const container = document.getElementById('myCards');
        if (!container) return;
        
        if (!userData.cards || userData.cards.length === 0) {
            container.innerHTML = `
                <div style="
                    text-align: center;
                    padding: 40px 20px;
                    background: #1e293b;
                    border-radius: 15px;
                    color: #94a3b8;
                    border: 2px dashed #475569;
                    grid-column: 1 / -1;
                ">
                    <div style="font-size: 48px; margin-bottom: 15px;">🃏</div>
                    <h3 style="color: #cbd5e1; margin-bottom: 10px;">У вас пока нет карт</h3>
                    <p style="margin-bottom: 20px;">Откройте свой первый пак, чтобы получить карты!</p>
                </div>
            `;
            return;
        }
        
        const gridColumns = isMobile ? 'repeat(auto-fill, minmax(130px, 1fr))' : 'repeat(auto-fill, minmax(160px, 1fr))';
        
        container.innerHTML = `
            <div style="
                display: grid;
                grid-template-columns: ${gridColumns};
                gap: ${isMobile ? '10px' : '15px'};
                width: 100%;
            ">
                ${userData.cards.map(card => `
                    <div style="
                        background: #1e293b;
                        border-radius: 10px;
                        padding: 12px;
                        text-align: center;
                        border: 2px solid ${Utils.getRarityColor(card.rarity)};
                        transition: transform 0.3s;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                    ">
                        ${Utils.createCardImage(card.cardId).outerHTML}
                        <div style="margin: 10px 0; flex-grow: 1;">
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
                                    margin-top: auto;
                                ">
                            💰 Продать
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    },
    
    displayMarket() {
        const container = document.getElementById('market');
        if (!container) return;
        
        // Фильтруем свои лоты
        const otherListings = marketListings.filter(listing => listing.sellerId !== userId);
        
        if (otherListings.length === 0) {
            container.innerHTML = `
                <div style="
                    text-align: center;
                    padding: 40px 20px;
                    background: #1e293b;
                    border-radius: 15px;
                    color: #94a3b8;
                    border: 2px dashed #475569;
                    grid-column: 1 / -1;
                ">
                    <div style="font-size: 48px; margin-bottom: 15px;">🏪</div>
                    <h3 style="color: #cbd5e1; margin-bottom: 10px;">Маркет пуст</h3>
                    <p>Другие игроки еще не выставили карты на продажу</p>
                </div>
            `;
            return;
        }
        
        const gridColumns = isMobile ? 'repeat(auto-fill, minmax(140px, 1fr))' : 'repeat(auto-fill, minmax(180px, 1fr))';
        
        container.innerHTML = `
            <div style="
                display: grid;
                grid-template-columns: ${gridColumns};
                gap: ${isMobile ? '10px' : '15px'};
                width: 100%;
            ">
                ${otherListings.slice(0, 20).map(listing => {
                    const canBuy = userData.balance >= listing.price;
                    const cardImage = Utils.createCardImage(listing.cardId);
                    
                    return `
                    <div style="
                        background: #1e293b;
                        border-radius: 10px;
                        padding: 12px;
                        text-align: center;
                        border: 2px solid ${Utils.getRarityColor(listing.rarity)};
                        transition: transform 0.3s;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                    ">
                        ${cardImage.outerHTML}
                        <div style="margin: 10px 0; flex-grow: 1;">
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
                    `;
                }).join('')}
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
        
        container.style.display = 'block';
        title.textContent = '🎰 Открываем пак...';
        resultText.textContent = 'Подготовка рулетки...';
        closeBtn.style.display = 'none';
        
        rouletteDiv.innerHTML = '';
        
        const track = document.createElement('div');
        track.style.cssText = `
            display: flex;
            position: absolute;
            height: 100%;
            align-items: center;
            padding-left: 20px;
            transition: transform 3s cubic-bezier(0.1, 0.7, 0.1, 1);
        `;
        
        // Добавляем 20 карточек для рулетки
        for (let i = 0; i < 20; i++) {
            const cardId = (i % 10) + 1; // Карты от 1 до 10
            const img = Utils.createCardImage(cardId, '150px', '180px');
            img.style.margin = '0 10px';
            img.className = 'roulette-card';
            track.appendChild(img);
        }
        
        rouletteDiv.appendChild(track);
        
        return new Promise((resolve) => {
            setTimeout(() => {
                resultText.textContent = 'Рулетка запущена!';
                
                setTimeout(() => {
                    const winnerIndex = Math.floor(Math.random() * 15) + 3;
                    const winnerCardId = (winnerIndex % 10) + 1;
                    const rarities = ['common', 'common', 'rare', 'epic', 'legendary'];
                    const rarity = rarities[Math.floor(Math.random() * rarities.length)];
                    
                    const cardWidth = 150 + 20;
                    const targetPosition = -(winnerIndex * cardWidth) + (rouletteDiv.offsetWidth / 2) - (cardWidth / 2);
                    track.style.transform = `translateX(${targetPosition}px)`;
                    
                    setTimeout(() => {
                        const cards = track.querySelectorAll('.roulette-card');
                        if (cards[winnerIndex]) {
                            cards[winnerIndex].classList.add('highlight');
                        }
                        
                        const wonCard = {
                            id: 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                            cardId: winnerCardId,
                            rarity: rarity,
                            name: `Карта #${winnerCardId}`,
                            ownerId: userId
                        };
                        
                        resultText.innerHTML = `
                            🎉 <strong>ВЫ ВЫИГРАЛИ!</strong><br>
                            <span style="color:${Utils.getRarityColor(rarity)}">
                            ${rarity.toUpperCase()} карту #${winnerCardId}</span>
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
async function sellCard(cardId) {
    const card = userData.cards.find(c => c.id === cardId);
    if (!card) {
        Utils.showNotification('❌ Карта не найдена!', 'error');
        return;
    }
    
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
    
    const listing = await API.createListing(card, price);
    if (listing) {
        userData.cards = userData.cards.filter(c => c.id !== cardId);
        marketListings.push(listing);
        
        UI.displayUserCards();
        UI.displayMarket();
        await API.saveUserData(userData);
        
        Utils.showNotification(
            `✅ Карта выставлена на маркет за ${Utils.formatNumber(price)} хериков!`, 
            'success'
        );
    } else {
        Utils.showNotification('❌ Не удалось создать лот на маркете', 'error');
    }
}

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
    
    const result = await API.buyListing(listingId);
    if (result && result.success) {
        userData.balance -= listing.price;
        userData.cards.push({
            id: 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            cardId: listing.cardId,
            rarity: listing.rarity,
            name: `Карта #${listing.cardId}`,
            ownerId: userId
        });
        
        marketListings = marketListings.filter(l => l.id !== listingId);
        
        UI.updateProfile();
        UI.displayUserCards();
        UI.displayMarket();
        await API.saveUserData(userData);
        
        Utils.showNotification(
            `🎉 Вы купили карту #${listing.cardId} за ${Utils.formatNumber(listing.price)} хериков!`, 
            'success'
        );
    } else {
        Utils.showNotification('❌ Не удалось купить карту. Возможно, её уже купили.', 'error');
    }
}

// ========== ИНИЦИАЛИЗАЦИЯ КНОПОК ==========
function initFarmButton() {
    const farmBtn = document.getElementById('farmHeriks');
    if (farmBtn) {
        farmBtn.addEventListener('click', async (e) => {
            farmBtn.style.animation = 'bounce 0.3s';
            setTimeout(() => farmBtn.style.animation = '', 300);
            
            const coin = document.createElement('div');
            coin.className = 'coin-popup';
            coin.textContent = '+1 💰';
            coin.style.left = (e.clientX - 20) + 'px';
            coin.style.top = (e.clientY - 20) + 'px';
            document.body.appendChild(coin);
            setTimeout(() => coin.remove(), 1000);
            
            userData.balance += 1;
            userData.farmStats.totalClicks = (userData.farmStats.totalClicks || 0) + 1;
            
            UI.updateProfile();
            await API.saveUserData(userData);
        });
    }
}

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
                userData.balance -= CONFIG.PACK_COST;
                UI.updateProfile();
                
                const wonCard = await Roulette.show();
                userData.cards.push(wonCard);
                
                UI.displayUserCards();
                await API.saveUserData(userData);
                
                Utils.showNotification(`🎉 Получена ${wonCard.rarity} карта #${wonCard.cardId}!`, 'success');
                
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

function initCloseRouletteButton() {
    const closeRouletteBtn = document.getElementById('closeRoulette');
    if (closeRouletteBtn) {
        closeRouletteBtn.addEventListener('click', () => {
            document.getElementById('rouletteContainer').style.display = 'none';
        });
    }
}

// ========== ЗАГРУЗКА ПРИЛОЖЕНИЯ ==========
async function initApp() {
    console.log('=== НАЧАЛО ЗАГРУЗКИ ===');
    
    try {
        // 1. Загружаем данные пользователя
        const loadedUserData = await API.loadUserData();
        if (loadedUserData) {
            userData = loadedUserData;
        }
        console.log('Данные пользователя загружены');
        
        // 2. Загружаем маркет
        marketListings = await API.loadMarket();
        console.log(`Маркет загружен: ${marketListings.length} лотов`);
        
        // 3. Обновляем интерфейс
        UI.updateProfile();
        UI.displayUserCards();
        UI.displayMarket();
        
        // 4. Инициализируем кнопки
        initFarmButton();
        initOpenPackButton();
        initCloseRouletteButton();
        
        // 5. Автосохранение каждые 30 секунд
        setInterval(async () => {
            await API.saveUserData(userData);
            console.log('💾 Автосохранение выполнено');
        }, 30000);
        
        console.log('=== ПРИЛОЖЕНИЕ УСПЕШНО ЗАГРУЖЕНО ===');
        
    } catch (error) {
        console.error('КРИТИЧЕСКАЯ ОШИБКА:', error);
        Utils.showNotification('Ошибка загрузки приложения', 'error');
    }
}

// Делаем функции глобальными
window.sellCard = sellCard;
window.buyMarketCard = buyMarketCard;

// Запускаем приложение
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}