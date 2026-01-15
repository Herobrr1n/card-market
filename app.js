// ========== КОНФИГУРАЦИЯ ==========
const CONFIG = {
    BACKEND_URL: 'http://localhost:3000',
    PACK_COST: 50,
    MIN_SELL_PRICE: 10,
    MAX_SELL_PRICE: 10000,
    INITIAL_BALANCE: 100,
    MARKET_REFRESH_INTERVAL: 3000
};

// ========== ИНИЦИАЛИЗАЦИЯ ==========
console.log('=== ЗАПУСК КАРТОЧНОГО МАРКЕТА ===');

let tg, userId, username, isMobile = false;

// Определяем пользователя
try {
    tg = window.Telegram?.WebApp;
    if (tg) {
        tg.expand();
        tg.ready();
        
        const initData = tg.initDataUnsafe;
        userId = initData?.user?.id?.toString();
        username = initData?.user?.username || 
                   initData?.user?.first_name || 
                   'user_' + userId;
        
        if (!userId) {
            userId = 'telegram_' + Date.now();
            username = 'telegram_user';
        }
    } else {
        userId = 'browser_' + Date.now();
        username = 'browser_user';
    }
} catch (error) {
    console.error('Ошибка инициализации:', error);
    userId = 'local_' + Date.now();
    username = 'local_user';
}

isMobile = window.innerWidth <= 768;
console.log('👤 Пользователь:', { userId, username });

// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
let userData = {
    balance: CONFIG.INITIAL_BALANCE,
    cards: [],
    farmStats: { totalClicks: 0 },
    username: username
};

let marketListings = [];

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
        if (!num && num !== 0) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    },
    
    getCardImageUrl(cardId) {
        const actualCardId = ((cardId - 1) % 20) + 1;
        return `images/card${actualCardId}.png`;
    },
    
    createCardImage(cardId, width = '100%', height = '140px') {
        const img = document.createElement('img');
        img.alt = `Card ${cardId}`;
        img.style.width = isMobile ? '100%' : width;
        img.style.height = isMobile ? '120px' : height;
        img.style.objectFit = 'cover';
        img.style.borderRadius = '8px';
        img.style.border = '1px solid #334155';
        img.style.background = '#334155';
        img.style.display = 'block';
        
        const imageUrl = this.getCardImageUrl(cardId);
        img.src = imageUrl;
        
        img.onerror = function() {
            this.onerror = null;
            const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
            const bgColor = colors[(cardId - 1) % colors.length];
            const emojis = ['🃏', '🎴', '👑', '⚔️', '🛡️', '🏹', '🔮', '💎', '🌟', '🔥'];
            const emoji = emojis[(cardId - 1) % emojis.length];
            
            const svg = `
                <svg width="150" height="200" xmlns="http://www.w3.org/2000/svg">
                    <rect width="150" height="200" rx="10" ry="10" fill="${bgColor}"/>
                    <rect x="5" y="5" width="140" height="190" rx="8" ry="8" fill="#1E293B" stroke="#475569" stroke-width="1"/>
                    <text x="75" y="50" text-anchor="middle" fill="white" font-family="Arial" font-size="16" font-weight="bold">
                        CARD #${cardId}
                    </text>
                    <text x="75" y="100" text-anchor="middle" font-size="40">
                        ${emoji}
                    </text>
                </svg>
            `;
            this.src = 'data:image/svg+xml;base64,' + btoa(svg);
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
    },
    
    async showRouletteAnimation(cardId, rarity) {
        return new Promise((resolve) => {
            // Создаем оверлей для анимации
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.9);
                z-index: 9999;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                color: white;
                font-family: Arial, sans-serif;
            `;
            
            // Заголовок
            const title = document.createElement('div');
            title.style.cssText = `
                font-size: 28px;
                font-weight: bold;
                margin-bottom: 30px;
                text-align: center;
                color: #fbbf24;
                text-shadow: 0 0 10px rgba(251, 191, 36, 0.5);
                animation: pulse 1s infinite alternate;
            `;
            title.textContent = '🎴 ОТКРЫТИЕ ПАКА 🎴';
            
            // Контейнер для рулетки
            const rouletteContainer = document.createElement('div');
            rouletteContainer.style.cssText = `
                width: ${isMobile ? '90%' : '70%'};
                max-width: 800px;
                height: 200px;
                background: #1e293b;
                border-radius: 15px;
                border: 3px solid #475569;
                overflow: hidden;
                position: relative;
                margin-bottom: 30px;
            `;
            
            // Лента карт для рулетки
            const rouletteTrack = document.createElement('div');
            rouletteTrack.style.cssText = `
                display: flex;
                position: absolute;
                left: 0;
                top: 20px;
                height: 160px;
                transition: transform 8s cubic-bezier(0.1, 0.7, 0.1, 1);
            `;
            
            // Создаем много карт для анимации (50 карт)
            for (let i = 0; i < 50; i++) {
                const randomCardId = Math.floor(Math.random() * 20) + 1;
                const randomRarities = ['common', 'common', 'rare', 'rare', 'epic', 'legendary'];
                const randomRarity = randomRarities[Math.floor(Math.random() * randomRarities.length)];
                
                const cardElement = document.createElement('div');
                cardElement.style.cssText = `
                    width: 140px;
                    height: 160px;
                    margin: 0 5px;
                    background: linear-gradient(135deg, #334155, #1e293b);
                    border-radius: 10px;
                    border: 2px solid ${this.getRarityColor(randomRarity)};
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    padding: 10px;
                    box-sizing: border-box;
                `;
                
                const cardImg = this.createCardImage(randomCardId, '100px', '100px');
                const cardLabel = document.createElement('div');
                cardLabel.style.cssText = `
                    margin-top: 5px;
                    font-size: 12px;
                    color: ${this.getRarityColor(randomRarity)};
                    font-weight: bold;
                `;
                cardLabel.textContent = randomRarity.toUpperCase();
                
                cardElement.appendChild(cardImg);
                cardElement.appendChild(cardLabel);
                rouletteTrack.appendChild(cardElement);
            }
            
            // Таймер
            const timer = document.createElement('div');
            timer.style.cssText = `
                font-size: 20px;
                font-weight: bold;
                margin-bottom: 20px;
                color: #60a5fa;
            `;
            
            // Результат
            const result = document.createElement('div');
            result.style.cssText = `
                font-size: 24px;
                font-weight: bold;
                margin-top: 20px;
                text-align: center;
                opacity: 0;
                transition: opacity 1s;
                color: ${this.getRarityColor(rarity)};
            `;
            
            rouletteContainer.appendChild(rouletteTrack);
            overlay.appendChild(title);
            overlay.appendChild(timer);
            overlay.appendChild(rouletteContainer);
            overlay.appendChild(result);
            document.body.appendChild(overlay);
            
            // Добавляем стили для анимации
            const style = document.createElement('style');
            style.textContent = `
                @keyframes pulse {
                    from { transform: scale(1); }
                    to { transform: scale(1.05); }
                }
                @keyframes glow {
                    0% { box-shadow: 0 0 10px ${this.getRarityColor(rarity)}; }
                    50% { box-shadow: 0 0 30px ${this.getRarityColor(rarity)}; }
                    100% { box-shadow: 0 0 10px ${this.getRarityColor(rarity)}; }
                }
                @keyframes cardReveal {
                    0% { transform: scale(0.5); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
            
            // Рассчитываем позицию для остановки (последняя карта должна быть выигрышной)
            const finalPosition = -((50 - 5) * 150); // Останавливаемся на 5-й с конца карте
            
            let timeLeft = 8;
            const interval = setInterval(() => {
                timeLeft--;
                timer.textContent = `⏱️ ${timeLeft}`;
                
                if (timeLeft <= 0) {
                    clearInterval(interval);
                    
                    // Показываем результат
                    result.innerHTML = `
                        🎉 ВЫ ВЫИГРАЛИ! 🎉<br>
                        <div style="font-size: 20px; margin-top: 10px;">
                            ${rarity.toUpperCase()} КАРТА #${cardId}
                        </div>
                    `;
                    result.style.opacity = '1';
                    
                    // Анимация завершена
                    setTimeout(() => {
                        overlay.remove();
                        style.remove();
                        resolve();
                    }, 2000);
                }
            }, 1000);
            
            // Запускаем анимацию рулетки
            setTimeout(() => {
                rouletteTrack.style.transform = `translateX(${finalPosition}px)`;
            }, 100);
            
            // Быстрая анимация в начале
            setTimeout(() => {
                timer.textContent = '⏱️ 7';
                title.textContent = '🎰 КРУТИТСЯ РУЛЕТКА... 🎰';
            }, 1000);
            
            setTimeout(() => {
                timer.textContent = '⏱️ 6';
            }, 2000);
            
            setTimeout(() => {
                timer.textContent = '⏱️ 5';
            }, 3000);
            
            setTimeout(() => {
                timer.textContent = '⏱️ 4';
                title.textContent = '🌀 ЗАМЕДЛЕНИЕ... 🌀';
            }, 4000);
            
            setTimeout(() => {
                timer.textContent = '⏱️ 3';
            }, 5000);
            
            setTimeout(() => {
                timer.textContent = '⏱️ 2';
            }, 6000);
            
            setTimeout(() => {
                timer.textContent = '⏱️ 1';
                title.textContent = '🎯 ОСТАНОВКА... 🎯';
            }, 7000);
        });
    }
};

// ========== РАБОТА С СЕРВЕРОМ ==========

// Загрузка данных пользователя
async function loadUserData() {
    try {
        console.log('🔄 Загрузка данных пользователя...');
        const response = await fetch(`${CONFIG.BACKEND_URL}/api/user/${userId}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Данные пользователя загружены');
            return data;
        } else {
            console.log('❌ Ошибка загрузки пользователя:', response.status);
        }
    } catch (error) {
        console.log('⚠️ Ошибка загрузки пользователя:', error);
    }
    
    return {
        balance: CONFIG.INITIAL_BALANCE,
        cards: [],
        farmStats: { totalClicks: 0 },
        username: username
    };
}

// Загрузка маркета
async function loadMarket() {
    try {
        console.log('🔄 Загрузка маркета...');
        const response = await fetch(`${CONFIG.BACKEND_URL}/api/market`);
        
        if (response.ok) {
            const data = await response.json();
            console.log(`✅ Маркет загружен: ${Array.isArray(data) ? data.length : 'не массив'}`);
            return Array.isArray(data) ? data : [];
        } else {
            console.log('❌ Ошибка загрузки маркета:', response.status);
        }
    } catch (error) {
        console.log('⚠️ Ошибка загрузки маркета:', error);
    }
    
    return [];
}

// Сохранение данных пользователя
async function saveUserData() {
    try {
        const response = await fetch(`${CONFIG.BACKEND_URL}/api/user/${userId}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        
        if (response.ok) {
            return true;
        } else {
            const errorText = await response.text();
            console.log('❌ Ошибка сохранения:', response.status, errorText);
            return false;
        }
    } catch (error) {
        console.log('⚠️ Ошибка сохранения:', error);
        return false;
    }
}

// ========== ОСНОВНЫЕ ФУНКЦИИ ==========

// 1. ВЫСТАВИТЬ КАРТУ НА МАРКЕТ
async function sellCard(cardId) {
    console.log('🎴 Продажа карты:', cardId);
    
    // Находим карту
    const card = userData.cards.find(c => c.id === cardId);
    if (!card) {
        Utils.showNotification('❌ Карта не найдена!', 'error');
        return;
    }
    
    // Рассчитываем рекомендуемую цену
    const basePrice = {
        'common': 50,
        'rare': 200,
        'epic': 500,
        'legendary': 1000
    };
    
    const suggestedPrice = basePrice[card.rarity] || 50;
    
    // Запрашиваем цену у пользователя
    const priceInput = prompt(
        `💰 ВЫСТАВЛЕНИЕ КАРТЫ НА МАРКЕТ\n\n` +
        `Карта: ${card.rarity.toUpperCase()} #${card.cardId}\n` +
        `Минимум: ${CONFIG.MIN_SELL_PRICE} хериков\n` +
        `Максимум: ${CONFIG.MAX_SELL_PRICE} хериков\n\n` +
        `Рекомендуемая цена: ${suggestedPrice} хериков\n` +
        `Введите вашу цену:`,
        suggestedPrice.toString()
    );
    
    if (!priceInput) {
        console.log('❌ Продажа отменена');
        return;
    }
    
    const price = parseInt(priceInput);
    
    // Проверяем цену
    if (isNaN(price) || price < CONFIG.MIN_SELL_PRICE || price > CONFIG.MAX_SELL_PRICE) {
        Utils.showNotification(`❌ Цена должна быть от ${CONFIG.MIN_SELL_PRICE} до ${CONFIG.MAX_SELL_PRICE} хериков!`, 'error');
        return;
    }
    
    // Подтверждение
    if (!confirm(`🎴 Выставить карту #${card.cardId} на маркет?\n\n` +
                 `Цена: ${Utils.formatNumber(price)} хериков\n` +
                 `Продавец: @${username}\n\n` +
                 `После продажи карту увидят все игроки!`)) {
        return;
    }
    
    Utils.showNotification('🔄 Выставляем карту на маркет...', 'info');
    
    try {
        // ВАЖНО: Отправляем карту на сервер в общий маркет
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
                price: price,
                cardInstanceId: card.id
            })
        });
        
        let result;
        try {
            result = await response.json();
        } catch (e) {
            console.log('❌ Ошибка парсинга ответа:', e);
            throw new Error('Неверный ответ от сервера');
        }
        
        if (result.success) {
            // УДАЛЯЕМ КАРТУ У ПОЛЬЗОВАТЕЛЯ (она теперь на маркете)
            userData.cards = userData.cards.filter(c => c.id !== cardId);
            
            // Сохраняем данные пользователя
            await saveUserData();
            
            // Обновляем интерфейс
            UI.displayUserCards();
            
            // НЕМЕДЛЕННО обновляем маркет, чтобы увидеть свою карту
            setTimeout(async () => {
                marketListings = await loadMarket();
                UI.displayMarket();
            }, 500);
            
            Utils.showNotification(`✅ Карта выставлена на маркет за ${Utils.formatNumber(price)} хериков!`, 'success');
            console.log('🎴 Карта добавлена в маркет:', result.listing);
        } else {
            throw new Error(result.error || 'Ошибка сервера');
        }
        
    } catch (error) {
        console.error('❌ Ошибка продажи:', error);
        Utils.showNotification('❌ Ошибка при выставлении карты: ' + error.message, 'error');
    }
}

// 2. КУПИТЬ КАРТУ С МАРКЕТА
async function buyMarketCard(listingId) {
    console.log('🛒 Покупка карты с маркета:', listingId);
    
    // Находим лот
    const listing = marketListings.find(l => l.id === listingId);
    if (!listing) {
        Utils.showNotification('❌ Карта не найдена на маркете!', 'error');
        return;
    }
    
    // Проверяем, не свою ли карту покупаем
    if (listing.sellerId === userId) {
        Utils.showNotification('❌ Нельзя купить свою же карту!', 'error');
        return;
    }
    
    // Проверяем баланс
    if (userData.balance < listing.price) {
        Utils.showNotification(`❌ Недостаточно хериков! Нужно: ${listing.price}`, 'error');
        return;
    }
    
    // Подтверждение покупки
    if (!confirm(`🛒 ПОКУПКА КАРТЫ\n\n` +
                 `Карта: #${listing.cardId} (${listing.rarity.toUpperCase()})\n` +
                 `Продавец: @${listing.sellerName}\n` +
                 `Цена: ${Utils.formatNumber(listing.price)} хериков\n\n` +
                 `Подтвердить покупку?`)) {
        return;
    }
    
    Utils.showNotification('🔄 Покупаем карту...', 'info');
    
    try {
        // Отправляем запрос на покупку
        const response = await fetch(`${CONFIG.BACKEND_URL}/api/market/buy`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                listingId: listingId,
                buyerId: userId,
                buyerName: username
            })
        });
        
        let result;
        try {
            result = await response.json();
        } catch (e) {
            console.log('❌ Ошибка парсинга ответа:', e);
            throw new Error('Неверный ответ от сервера');
        }
        
        if (result.success) {
            // ОБНОВЛЯЕМ БАЛАНС
            userData.balance -= listing.price;
            
            // ДОБАВЛЯЕМ КАРТУ ПОЛЬЗОВАТЕЛЮ
            if (result.purchase && result.purchase.card) {
                userData.cards.push(result.purchase.card);
            }
            
            // Сохраняем данные
            await saveUserData();
            
            // Обновляем интерфейс
            UI.updateProfile();
            UI.displayUserCards();
            
            // НЕМЕДЛЕННО обновляем маркет
            setTimeout(async () => {
                marketListings = await loadMarket();
                UI.displayMarket();
            }, 500);
            
            Utils.showNotification(`🎉 Вы купили карту #${listing.cardId}!`, 'success');
            console.log('💰 Покупка успешна:', result);
        } else {
            throw new Error(result.error || 'Ошибка покупки');
        }
        
    } catch (error) {
        console.error('❌ Ошибка покупки:', error);
        Utils.showNotification('❌ Ошибка при покупке: ' + error.message, 'error');
    }
}

// ========== ИНТЕРФЕЙС ==========
const UI = {
    // Обновить профиль
    updateProfile() {
        const balanceEl = document.getElementById('balance');
        const usernameEl = document.getElementById('username');
        const farmCounter = document.getElementById('farmCounter');
        
        if (balanceEl) balanceEl.textContent = `${Utils.formatNumber(userData.balance)} хериков`;
        if (usernameEl) usernameEl.textContent = `@${username}`;
        if (farmCounter) {
            farmCounter.innerHTML = `
                <div>Всего кликов: <b>${userData.farmStats.totalClicks || 0}</b></div>
                <div>Хериков за клик: <b>1</b></div>
            `;
        }
    },
    
    // Показать карты пользователя
    displayUserCards() {
        const container = document.getElementById('myCards');
        if (!container) return;
        
        if (!userData.cards || userData.cards.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; background: #1e293b; border-radius: 15px; color: #94a3b8; border: 2px dashed #475569;">
                    <div style="font-size: 48px; margin-bottom: 15px;">🃏</div>
                    <h3 style="color: #cbd5e1; margin-bottom: 10px;">У вас пока нет карт</h3>
                    <p>Откройте свой первый пак!</p>
                    <button onclick="openPack()" style="background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; margin-top: 10px;">
                        🎴 Открыть пак (50 хериков)
                    </button>
                </div>
            `;
            return;
        }
        
        const gridColumns = isMobile ? 'repeat(auto-fill, minmax(130px, 1fr))' : 'repeat(auto-fill, minmax(160px, 1fr))';
        
        container.innerHTML = `
            <div style="display: grid; grid-template-columns: ${gridColumns}; gap: ${isMobile ? '10px' : '15px'};">
                ${userData.cards.map(card => `
                    <div style="background: #1e293b; border-radius: 10px; padding: 12px; text-align: center; border: 2px solid ${Utils.getRarityColor(card.rarity)}; transition: transform 0.2s;" 
                         onmouseover="this.style.transform='translateY(-5px)'" 
                         onmouseout="this.style.transform='translateY(0)'">
                        ${Utils.createCardImage(card.cardId).outerHTML}
                        <div style="margin: 10px 0;">
                            <div style="font-weight: bold; font-size: 14px; margin-bottom: 5px;">Карта #${card.cardId}</div>
                            <div style="color: ${Utils.getRarityColor(card.rarity)}; font-size: 12px; font-weight: bold; background: rgba(0,0,0,0.3); padding: 3px 8px; border-radius: 20px; display: inline-block;">
                                ${card.rarity?.toUpperCase() || 'COMMON'}
                            </div>
                        </div>
                        <button onclick="sellCard('${card.id}')" 
                                style="width: 100%; background: #22c55e; color: white; border: none; padding: 8px; border-radius: 6px; cursor: pointer; font-size: 12px; transition: background 0.2s;"
                                onmouseover="this.style.background='#16a34a'"
                                onmouseout="this.style.background='#22c55e'">
                            💰 Выставить на маркет
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    },
    
    // Показать маркет
    displayMarket() {
        const container = document.getElementById('market');
        if (!container) return;
        
        console.log('🔍 Проверяем маркет:', {
            всегоКарт: marketListings.length,
            карты: marketListings.slice(0, 3).map(l => ({ 
                id: l.id, 
                sellerId: l.sellerId, 
                status: l.status,
                sold: l.sold,
                cardId: l.cardId
            }))
        });
        
        // Фильтруем: не показываем свои карты и проданные
        const otherListings = marketListings.filter(listing => {
            const isActive = (listing.status === 'active' && !listing.sold) || 
                            (!listing.status && !listing.sold);
            return listing.sellerId !== userId && isActive;
        });
        
        console.log('✅ После фильтрации:', otherListings.length, 'карт');
        
        if (otherListings.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; background: #1e293b; border-radius: 15px; color: #94a3b8; border: 2px dashed #475569;">
                    <div style="font-size: 48px; margin-bottom: 15px;">🏪</div>
                    <h3 style="color: #cbd5e1; margin-bottom: 10px;">Маркет пуст</h3>
                    <p>Будьте первым, кто выставит карту!</p>
                    <button onclick="location.reload()" style="background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; margin-top: 10px;">
                        🔄 Обновить маркет
                    </button>
                    <div style="margin-top: 20px; font-size: 14px; color: #64748b;">
                        <p>💡 Чтобы проверить маркет:</p>
                        <p>1. Откройте два окна браузера</p>
                        <p>2. В первом продайте карту</p>
                        <p>3. Во втором она появится здесь!</p>
                    </div>
                    <div style="margin-top: 15px; padding: 10px; background: #0f172a; border-radius: 8px;">
                        <div style="color: #cbd5e1; font-weight: bold; margin-bottom: 5px;">Статус сервера:</div>
                        <div style="font-size: 12px; color: #94a3b8;">
                            <button onclick="checkServerStatus()" style="background: #8b5cf6; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; margin-top: 5px;">
                                Проверить соединение
                            </button>
                        </div>
                    </div>
                </div>
            `;
            return;
        }
        
        const gridColumns = isMobile ? 'repeat(auto-fill, minmax(140px, 1fr))' : 'repeat(auto-fill, minmax(180px, 1fr))';
        
        container.innerHTML = `
            <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; background: #1e293b; padding: 10px 15px; border-radius: 10px;">
                <div style="font-size: 14px; color: #94a3b8;">
                    🏪 Карт на маркете: <span style="color: #22c55e; font-weight: bold;">${otherListings.length}</span>
                </div>
                <div>
                    <button onclick="location.reload()" style="background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 5px;">
                        🔄 Обновить
                    </button>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: ${gridColumns}; gap: ${isMobile ? '10px' : '15px'};">
                ${otherListings.slice(0, 20).map(listing => {
                    const canBuy = userData.balance >= listing.price;
                    
                    return `
                    <div style="background: #1e293b; border-radius: 10px; padding: 12px; text-align: center; border: 2px solid ${Utils.getRarityColor(listing.rarity)}; transition: transform 0.2s;"
                         onmouseover="this.style.transform='translateY(-5px)'" 
                         onmouseout="this.style.transform='translateY(0)'">
                        ${Utils.createCardImage(listing.cardId).outerHTML}
                        <div style="margin: 10px 0;">
                            <div style="font-weight: bold; font-size: 14px; margin-bottom: 5px;">Карта #${listing.cardId}</div>
                            <div style="color: ${Utils.getRarityColor(listing.rarity)}; font-size: 12px; font-weight: bold; background: rgba(0,0,0,0.3); padding: 3px 8px; border-radius: 20px; margin-bottom: 5px;">
                                ${listing.rarity?.toUpperCase() || 'COMMON'}
                            </div>
                            <div style="font-size: 12px; color: #94a3b8;">
                                💁 Продавец: @${listing.sellerName}
                            </div>
                        </div>
                        <div style="background: rgba(34, 197, 94, 0.1); border-radius: 8px; padding: 10px; margin: 10px 0;">
                            <div style="font-size: 12px; color: #94a3b8;">Цена:</div>
                            <div style="color: #22c55e; font-weight: bold; font-size: 20px;">
                                ${Utils.formatNumber(listing.price)} хериков
                            </div>
                        </div>
                        <button onclick="buyMarketCard('${listing.id}')" 
                                style="width: 100%; background: ${canBuy ? '#6366f1' : '#94a3b8'}; color: white; border: none; padding: 10px; border-radius: 6px; cursor: ${canBuy ? 'pointer' : 'not-allowed'}; font-size: 14px; transition: background 0.2s;"
                                onmouseover="this.style.background='${canBuy ? '#4f46e5' : '#94a3b8'}'"
                                onmouseout="this.style.background='${canBuy ? '#6366f1' : '#94a3b8'}'"
                                ${!canBuy ? 'disabled' : ''}>
                            ${canBuy ? '🛒 Купить сейчас' : '❌ Недостаточно'}
                        </button>
                    </div>
                    `;
                }).join('')}
            </div>
            
            ${otherListings.length > 20 ? `
                <div style="text-align: center; margin-top: 20px; color: #94a3b8;">
                    Показано ${otherListings.length > 20 ? '20' : otherListings.length} из ${otherListings.length} карт
                </div>
            ` : ''}
        `;
    }
};

// ========== КНОПКИ И ФУНКЦИИ ==========

// Ферма хериков
function initFarmButton() {
    const farmBtn = document.getElementById('farmHeriks');
    if (farmBtn) {
        farmBtn.addEventListener('click', async () => {
            // Анимация
            farmBtn.style.transform = 'scale(0.95)';
            setTimeout(() => farmBtn.style.transform = 'scale(1)', 100);
            
            // Обновляем данные
            userData.balance += 1;
            userData.farmStats.totalClicks = (userData.farmStats.totalClicks || 0) + 1;
            
            // Обновляем интерфейс
            UI.updateProfile();
            
            // Сохраняем
            setTimeout(async () => {
                await saveUserData();
            }, 100);
        });
    }
}

// Открытие пака с анимацией
async function openPack() {
    if (userData.balance < CONFIG.PACK_COST) {
        Utils.showNotification(`❌ Недостаточно хериков! Нужно: ${CONFIG.PACK_COST}`, 'error');
        return;
    }
    
    // Проверяем баланс еще раз
    if (userData.balance < CONFIG.PACK_COST) {
        Utils.showNotification('❌ Недостаточно хериков!', 'error');
        return;
    }
    
    // Сразу списываем стоимость, чтобы предотвратить двойное открытие
    userData.balance -= CONFIG.PACK_COST;
    UI.updateProfile();
    
    // Генерируем случайную карту
    const cardId = Math.floor(Math.random() * 20) + 1;
    const rarities = ['common', 'common', 'rare', 'rare', 'epic', 'legendary'];
    const rarity = rarities[Math.floor(Math.random() * rarities.length)];
    
    // Показываем анимацию рулетки
    await Utils.showRouletteAnimation(cardId, rarity);
    
    // Создаем новую карту
    const newCard = {
        id: `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        cardId: cardId,
        rarity: rarity,
        name: `Карта #${cardId}`,
        obtainedAt: new Date().toISOString(),
        fromPack: true
    };
    
    // Добавляем карту
    userData.cards.push(newCard);
    
    // Сохраняем
    await saveUserData();
    
    // Обновляем интерфейс
    UI.displayUserCards();
    
    Utils.showNotification(`🎉 Вы получили ${rarity} карту #${cardId}!`, 'success');
}

// Проверка статуса сервера
async function checkServerStatus() {
    try {
        Utils.showNotification('🔄 Проверяем соединение с сервером...', 'info');
        
        const response = await fetch(`${CONFIG.BACKEND_URL}/api/test`);
        if (response.ok) {
            const data = await response.json();
            Utils.showNotification(`✅ Сервер работает: ${data.message}`, 'success');
            
            // Перезагружаем маркет
            marketListings = await loadMarket();
            UI.displayMarket();
        } else {
            Utils.showNotification('❌ Сервер не отвечает', 'error');
        }
    } catch (error) {
        Utils.showNotification('❌ Не удалось подключиться к серверу', 'error');
        console.error('Ошибка подключения:', error);
    }
}

// ========== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ==========
async function initApp() {
    console.log('=== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ===');
    console.log('🌐 BACKEND_URL:', CONFIG.BACKEND_URL);
    
    try {
        // Проверьте доступность сервера
        try {
            const test = await fetch(`${CONFIG.BACKEND_URL}/api/test`);
            if (test.ok) {
                const testData = await test.json();
                console.log('✅ Сервер доступен:', testData);
                Utils.showNotification('✅ Подключено к серверу маркета', 'success');
            } else {
                console.error('❌ Сервер недоступен:', test.status);
                Utils.showNotification('⚠️ Сервер недоступен. Работаем в оффлайн-режиме', 'warning');
            }
        } catch (error) {
            console.error('❌ Сервер недоступен:', error);
            Utils.showNotification('⚠️ Сервер недоступен. Проверьте подключение.', 'warning');
        }
        
        // Загружаем данные пользователя
        userData = await loadUserData();
        console.log('✅ Пользователь загружен');
        
        // Загружаем маркет
        marketListings = await loadMarket();
        console.log(`✅ Маркет загружен: ${marketListings.length} карт`);
        
        // Обновляем интерфейс
        UI.updateProfile();
        UI.displayUserCards();
        UI.displayMarket();
        
        // Инициализируем кнопки
        initFarmButton();
        
        // Автообновление маркета каждые 3 секунды
        setInterval(async () => {
            try {
                const newMarket = await loadMarket();
                if (JSON.stringify(newMarket) !== JSON.stringify(marketListings)) {
                    marketListings = newMarket;
                    UI.displayMarket();
                    console.log('🔄 Маркет обновлен');
                }
            } catch (error) {
                console.log('⚠️ Ошибка обновления:', error);
            }
        }, CONFIG.MARKET_REFRESH_INTERVAL);
        
        console.log('=== ПРИЛОЖЕНИЕ ЗАГРУЖЕНО ===');
        
        // Приветствие
        setTimeout(() => {
            Utils.showNotification(`👋 Добро пожаловать, @${username}!`, 'success');
        }, 1000);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки:', error);
        
        // Показываем базовый интерфейс даже при ошибке
        UI.updateProfile();
        UI.displayUserCards();
        UI.displayMarket();
        
        Utils.showNotification('⚠️ Работаем в оффлайн-режиме', 'info');
    }
}

// Делаем функции глобальными
window.sellCard = sellCard;
window.buyMarketCard = buyMarketCard;
window.openPack = openPack;
window.checkServerStatus = checkServerStatus;

// Запускаем приложение
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}