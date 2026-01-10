// ========== КОНФИГУРАЦИЯ ==========
const CONFIG = {
    BACKEND_URL: 'http://localhost:3000',
    PACK_COST: 50,
    MIN_SELL_PRICE: 10,
    MAX_SELL_PRICE: 10000,
    INITIAL_BALANCE: 100
};

// ========== ИНИЦИАЛИЗАЦИЯ ==========
console.log('=== ЗАПУСК APP.JS ===');

let tg, userId, username, isMobile = false;
let isOnline = true;

// Определяем пользователя из Telegram
try {
    tg = window.Telegram?.WebApp;
    if (tg) {
        console.log('Telegram WebApp найден');
        tg.expand();
        tg.ready();
        
        const initData = tg.initDataUnsafe;
        userId = initData?.user?.id?.toString();
        username = initData?.user?.username || 
                   initData?.user?.first_name || 
                   'user_' + userId;
        
        console.log('Telegram данные:', { userId, username });
        
        if (!userId) {
            userId = 'telegram_temp_' + Date.now();
            username = 'telegram_guest';
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
    balance: CONFIG.INITIAL_BALANCE,
    cards: [],
    farmStats: { totalClicks: 0 },
    username: username
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
        if (!num && num !== 0) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    },
    
    getCardImageUrl(cardId) {
        // Увеличиваем количество карт до 20
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
        
        // Fallback на SVG если картинки нет
        img.onerror = function() {
            this.onerror = null;
            const svg = this.generateCardSVG(cardId);
            this.src = 'data:image/svg+xml;base64,' + btoa(svg);
        }.bind(this);
        
        return img;
    },
    
    generateCardSVG(cardId) {
        const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
        const bgColor = colors[(cardId - 1) % colors.length];
        const emojis = ['🃏', '🎴', '👑', '⚔️', '🛡️', '🏹', '🔮', '💎', '🌟', '🔥'];
        const emoji = emojis[(cardId - 1) % emojis.length];
        
        return `
            <svg width="150" height="200" xmlns="http://www.w3.org/2000/svg">
                <rect width="150" height="200" rx="10" ry="10" fill="${bgColor}"/>
                <rect x="5" y="5" width="140" height="190" rx="8" ry="8" fill="#1E293B" stroke="#475569" stroke-width="1"/>
                <text x="75" y="50" text-anchor="middle" fill="white" font-family="Arial" font-size="16" font-weight="bold">
                    CARD #${cardId}
                </text>
                <text x="75" y="100" text-anchor="middle" font-size="40">
                    ${emoji}
                </text>
                <text x="75" y="160" text-anchor="middle" fill="${this.getRarityColor(this.getRarityByCardId(cardId))}" 
                      font-family="Arial" font-size="14" font-weight="bold">
                    ${this.getRarityByCardId(cardId).toUpperCase()}
                </text>
            </svg>
        `;
    },
    
    getRarityByCardId(cardId) {
        if (cardId <= 5) return 'common';
        if (cardId <= 10) return 'rare';
        if (cardId <= 15) return 'epic';
        if (cardId <= 20) return 'legendary';
        return 'mythic';
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
    
    generateCardId() {
        return 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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
        @keyframes rouletteHighlight {
            0%, 100% { transform: scale(1); box-shadow: 0 0 0px #f59e0b; }
            50% { transform: scale(1.1); box-shadow: 0 0 30px #f59e0b; }
        }
        @keyframes rouletteProgress {
            from { width: 0%; }
            to { width: 100%; }
        }
        .coin-popup {
            position: fixed;
            background: #f59e0b;
            color: white;
            padding: 5px 10px;
            border-radius: 20px;
            font-weight: bold;
            z-index: 9999;
            pointer-events: none;
            animation: coinEffect 1s ease-out forwards;
        }
    `;
    document.head.appendChild(style);
}

// ========== API КЛИЕНТ (ТОЛЬКО СЕРВЕРНЫЕ ВЫЗОВЫ) ==========
const API = {
    async checkOnlineStatus() {
        try {
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/debug/ping`);
            return response.ok;
        } catch (error) {
            console.log('Сервер недоступен:', error.message);
            return false;
        }
    },
    
    async loadUserData() {
        try {
            console.log(`Загружаю данные пользователя ${userId}...`);
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/user/${userId}`);
            
            if (response.ok) {
                const data = await response.json();
                console.log('Данные пользователя загружены:', data);
                return data;
            }
            throw new Error(`Ошибка ${response.status}`);
        } catch (error) {
            console.warn('Не удалось загрузить данные:', error.message);
            return null;
        }
    },
    
    async saveUserData(data) {
        try {
            console.log('Сохранение данных пользователя...');
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/user/${userId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Данные сохранены:', result);
                return result.success;
            }
            throw new Error(`Ошибка ${response.status}`);
        } catch (error) {
            console.warn('Не удалось сохранить данные:', error.message);
            return false;
        }
    },
    
    async loadMarket() {
        try {
            console.log('Загружаю маркет...');
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/market`);
            
            if (response.ok) {
                const data = await response.json();
                console.log(`Загружено ${data.length} лотов`);
                return data;
            }
            throw new Error(`Ошибка ${response.status}`);
        } catch (error) {
            console.warn('Не удалось загрузить маркет:', error.message);
            return [];
        }
    },
    
    async createListing(card, price) {
        try {
            console.log('Создание лота на маркете...', { card, price });
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
                const result = await response.json();
                console.log('Лот создан:', result);
                return result.listing;
            }
            
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Ошибка ${response.status}`);
        } catch (error) {
            console.warn('Не удалось создать лот:', error.message);
            throw error;
        }
    },
    
    async buyListing(listingId) {
        try {
            console.log(`Покупаю лот ${listingId}...`);
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/market/buy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    buyerId: userId,
                    listingId: listingId
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Ошибка ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Покупка успешна:', result);
            return result;
        } catch (error) {
            console.warn('Не удалось купить лот:', error.message);
            throw error;
        }
    }
};

// ========== КЭШ (ТОЛЬКО ДЛЯ ОФЛАЙН-РЕЖИМА) ==========
const Cache = {
    saveUserData(data) {
        try {
            const cacheKey = `user_cache_${userId}`;
            const cacheData = {
                ...data,
                cachedAt: new Date().toISOString()
            };
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
            console.log('Данные сохранены в кэш');
        } catch (error) {
            console.warn('Не удалось сохранить в кэш:', error);
        }
    },
    
    loadUserData() {
        try {
            const cacheKey = `user_cache_${userId}`;
            const data = localStorage.getItem(cacheKey);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.warn('Не удалось загрузить из кэша:', error);
            return null;
        }
    },
    
    clearCache() {
        try {
            localStorage.removeItem(`user_cache_${userId}`);
            console.log('Кэш очищен');
        } catch (error) {
            console.warn('Не удалось очистить кэш:', error);
        }
    }
};

// ========== РУЛЕТКА ==========
const Roulette = {
    show() {
        return new Promise((resolve) => {
            const container = document.getElementById('rouletteContainer');
            const rouletteDiv = document.getElementById('roulette');
            const resultText = document.getElementById('resultText');
            const title = document.getElementById('rouletteTitle');
            const closeBtn = document.getElementById('closeRoulette');
            
            container.style.display = 'block';
            title.textContent = '🎰 ОТКРЫТИЕ ПАКА';
            resultText.innerHTML = '🎮 <b>ГОТОВИМ РУЛЕТКУ...</b>';
            closeBtn.style.display = 'none';
            
            rouletteDiv.innerHTML = '';
            
            const progressBar = document.createElement('div');
            progressBar.style.cssText = `
                width: 100%;
                height: 5px;
                background: #334155;
                border-radius: 3px;
                margin: 10px 0;
                overflow: hidden;
            `;
            
            const progressFill = document.createElement('div');
            progressFill.style.cssText = `
                width: 0%;
                height: 100%;
                background: linear-gradient(90deg, #3b82f6, #8b5cf6);
                border-radius: 3px;
                transition: width 0.1s linear;
            `;
            
            progressBar.appendChild(progressFill);
            rouletteDiv.parentNode.insertBefore(progressBar, rouletteDiv.nextSibling);
            
            const track = document.createElement('div');
            track.style.cssText = `
                display: flex;
                position: absolute;
                height: 100%;
                align-items: center;
                will-change: transform;
            `;
            
            // 40 карточек для анимации (20 уникальных карт)
            const totalCards = 40;
            for (let i = 0; i < totalCards; i++) {
                const cardId = (i % 20) + 1; // 20 карт
                const img = Utils.createCardImage(cardId, '160px', '190px');
                img.style.margin = '0 15px';
                img.style.width = '160px';
                img.style.height = '190px';
                img.style.borderRadius = '12px';
                img.style.boxShadow = '0 5px 15px rgba(0,0,0,0.3)';
                img.classList.add('roulette-card');
                track.appendChild(img);
            }
            
            rouletteDiv.appendChild(track);
            
            setTimeout(() => {
                resultText.innerHTML = '🎡 <b>РУЛЕТКА ЗАПУЩЕНА!</b>';
                
                const winnerIndex = 25 + Math.floor(Math.random() * 10);
                const winnerCardId = (winnerIndex % 20) + 1; // 20 карт
                const rarities = ['common', 'common', 'rare', 'epic', 'legendary'];
                const rarity = rarities[Math.floor(Math.random() * rarities.length)];
                
                const cardWidth = 160 + 30;
                const targetPosition = -(winnerIndex * cardWidth) + (rouletteDiv.offsetWidth / 2) - (cardWidth / 2);
                
                let progress = 0;
                const progressInterval = setInterval(() => {
                    progress += 1.25;
                    progressFill.style.width = `${Math.min(100, progress)}%`;
                }, 100);
                
                track.style.transition = 'transform 8s cubic-bezier(0.2, 0.8, 0.2, 1)';
                track.style.transform = `translateX(${targetPosition}px)`;
                
                let secondsLeft = 8;
                const countdownInterval = setInterval(() => {
                    secondsLeft--;
                    if (secondsLeft > 0) {
                        resultText.innerHTML = `⏳ <b>КРУТИМ... ${secondsLeft}С</b>`;
                    }
                }, 1000);
                
                setTimeout(() => {
                    clearInterval(progressInterval);
                    clearInterval(countdownInterval);
                    
                    const cards = track.querySelectorAll('.roulette-card');
                    if (cards[winnerIndex]) {
                        const winnerCard = cards[winnerIndex];
                        winnerCard.style.border = '4px solid #f59e0b';
                        winnerCard.style.boxShadow = '0 0 40px #f59e0b';
                        winnerCard.style.animation = 'rouletteHighlight 0.8s infinite alternate';
                        winnerCard.style.transform = 'translateY(-20px)';
                        setTimeout(() => {
                            winnerCard.style.transform = 'translateY(0)';
                            winnerCard.style.transition = 'transform 0.3s';
                        }, 300);
                    }
                    
                    const wonCard = {
                        id: Utils.generateCardId(),
                        cardId: winnerCardId,
                        rarity: rarity,
                        name: `Карта #${winnerCardId}`,
                        ownerId: userId,
                        obtainedAt: new Date().toISOString()
                    };
                    
                    const rarityEmoji = {
                        common: '⚪',
                        rare: '🔵',
                        epic: '🟣',
                        legendary: '🟡'
                    };
                    
                    resultText.innerHTML = `
                        <div style="text-align: center;">
                            <div style="font-size: 32px; margin: 10px 0;">🎉 🎊 🎉</div>
                            <div style="font-size: 20px; color: #22c55e; margin: 10px 0;">
                                <b>ВЫ ВЫИГРАЛИ!</b>
                            </div>
                            <div style="color: ${Utils.getRarityColor(rarity)}; 
                                      font-size: 18px; 
                                      font-weight: bold;
                                      margin: 10px 0;
                                      padding: 10px;
                                      background: rgba(0,0,0,0.3);
                                      border-radius: 10px;">
                                ${rarityEmoji[rarity] || '🎴'} ${rarity.toUpperCase()} КАРТУ #${winnerCardId}
                            </div>
                        </div>
                    `;
                    
                    title.textContent = '🏆 ПОБЕДА!';
                    closeBtn.style.display = 'inline-block';
                    closeBtn.textContent = '🎴 ЗАБРАТЬ КАРТУ';
                    
                    resolve(wonCard);
                    
                }, 8000);
                
            }, 1000);
        });
    },
    
    close() {
        document.getElementById('rouletteContainer').style.display = 'none';
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
                                    transition: all 0.2s;
                                "
                                onmouseover="this.style.transform='scale(1.02)'; this.style.backgroundColor='#16a34a'"
                                onmouseout="this.style.transform='scale(1)'; this.style.backgroundColor='#22c55e'">
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
                                💁 Продавец: <b>@${listing.sellerName}</b>
                                ${listing.isDemo ? ' <span style="color:#f59e0b">(демо)</span>' : ''}
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
                                    font-size: 14px;
                                    transition: all 0.2s;
                                    opacity: ${canBuy ? '1' : '0.7'};
                                "
                                ${!canBuy ? 'disabled' : ''}
                                onmouseover="if(!this.disabled) this.style.transform='scale(1.02)'"
                                onmouseout="this.style.transform='scale(1)'">
                            ${canBuy ? '🛒 Купить сейчас' : '❌ Недостаточно хериков'}
                        </button>
                    </div>
                    `;
                }).join('')}
            </div>
        `;
    }
};

// ========== ОСНОВНЫЕ ФУНКЦИИ ==========
async function sellCard(cardId) {
    console.log('🛒 Продажа карты:', cardId);
    
    const card = userData.cards.find(c => c.id === cardId);
    if (!card) {
        Utils.showNotification('❌ Карта не найдена!', 'error');
        return;
    }
    
    const basePrice = {
        'common': 50,
        'rare': 200,
        'epic': 500,
        'legendary': 1000
    };
    
    const suggestedPrice = basePrice[card.rarity] || 50;
    
    const priceInput = prompt(
        `💰 ВЫСТАВЛЕНИЕ НА ПРОДАЖУ\n\nКарта: ${card.rarity.toUpperCase()} #${card.cardId}\n` +
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
    if (isNaN(price) || price < CONFIG.MIN_SELL_PRICE || price > CONFIG.MAX_SELL_PRICE) {
        Utils.showNotification(`❌ Цена должна быть от ${CONFIG.MIN_SELL_PRICE} до ${CONFIG.MAX_SELL_PRICE} хериков!`, 'error');
        return;
    }
    
    if (!confirm(`🎴 Выставить карту #${card.cardId} на продажу за ${Utils.formatNumber(price)} хериков?\n\nПродавец: @${username}`)) {
        return;
    }
    
    Utils.showNotification('🔄 Создаем лот на онлайн-маркете...', 'info');
    
    try {
        // ВАЖНО: ТОЛЬКО СЕРВЕРНЫЙ ВЫЗОВ
        const listing = await API.createListing(card, price);
        
        if (!listing) {
            throw new Error('Сервер не ответил');
        }
        
        // Удаляем карту у себя
        userData.cards = userData.cards.filter(c => c.id !== cardId);
        
        // Обновляем интерфейс
        UI.displayUserCards();
        
        // Загружаем свежий маркет с сервера
        marketListings = await API.loadMarket();
        UI.displayMarket();
        
        // Сохраняем данные на сервер
        const saveSuccess = await API.saveUserData(userData);
        if (saveSuccess) {
            Cache.saveUserData(userData);
        }
        
        Utils.showNotification(
            `✅ Карта выставлена на онлайн-маркет за ${Utils.formatNumber(price)} хериков!\n` +
            `Другие игроки увидят её через несколько секунд.`, 
            'success'
        );
        
    } catch (error) {
        console.error('❌ Ошибка продажи:', error);
        Utils.showNotification(
            `❌ Не удалось выставить карту на маркет.\nПроверьте подключение к серверу.`, 
            'error'
        );
    }
}

async function buyMarketCard(listingId) {
    console.log('🛒 Покупка лота:', listingId);
    
    const listing = marketListings.find(l => l.id === listingId);
    if (!listing) {
        Utils.showNotification('❌ Лот не найден! Возможно, его уже купили.', 'error');
        return;
    }
    
    if (listing.sellerId === userId) {
        Utils.showNotification('❌ Нельзя купить свою же карту!', 'error');
        return;
    }
    
    if (userData.balance < listing.price) {
        Utils.showNotification(
            `❌ Недостаточно хериков!\nНужно: ${listing.price}\nУ вас: ${userData.balance}`, 
            'error'
        );
        return;
    }
    
    if (!confirm(`🛒 Покупка карты #${listing.cardId}\n\n` +
                 `Продавец: @${listing.sellerName}\n` +
                 `Цена: ${Utils.formatNumber(listing.price)} хериков\n\n` +
                 `Подтверждаете покупку?`)) {
        return;
    }
    
    Utils.showNotification('🔄 Обрабатываем покупку...', 'info');
    
    try {
        // ВАЖНО: ТОЛЬКО СЕРВЕРНЫЙ ВЫЗОВ
        const result = await API.buyListing(listingId);
        
        if (!result || !result.success) {
            throw new Error(result?.error || 'Ошибка покупки');
        }
        
        // Обновляем баланс
        userData.balance = result.newBalance;
        
        // Добавляем карту
        userData.cards.push(result.card);
        
        // Обновляем интерфейс
        UI.updateProfile();
        UI.displayUserCards();
        
        // Обновляем маркет с сервера
        marketListings = await API.loadMarket();
        UI.displayMarket();
        
        // Сохраняем данные на сервер
        const saveSuccess = await API.saveUserData(userData);
        if (saveSuccess) {
            Cache.saveUserData(userData);
        }
        
        Utils.showNotification(
            `🎉 Вы купили карту #${listing.cardId} за ${Utils.formatNumber(listing.price)} хериков!\n` +
            `Херики переведены продавцу @${listing.sellerName}`, 
            'success'
        );
        
    } catch (error) {
        console.error('❌ Ошибка покупки:', error);
        Utils.showNotification(
            `❌ Не удалось купить карту: ${error.message}\nПроверьте подключение.`, 
            'error'
        );
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
            
            try {
                const saveSuccess = await API.saveUserData(userData);
                if (saveSuccess) {
                    Cache.saveUserData(userData);
                }
            } catch (saveError) {
                console.warn('Не удалось сохранить на сервер:', saveError);
            }
        });
    }
}

function initOpenPackButton() {
    const openPackBtn = document.getElementById('openPack');
    if (openPackBtn) {
        openPackBtn.addEventListener('click', async () => {
            if (isOpeningPack) return;
            
            if (userData.balance < CONFIG.PACK_COST) {
                Utils.showNotification(`❌ Недостаточно хериков!\nНужно: ${CONFIG.PACK_COST}\nУ вас: ${userData.balance}`, 'error');
                return;
            }
            
            isOpeningPack = true;
            openPackBtn.disabled = true;
            const originalText = openPackBtn.textContent;
            openPackBtn.textContent = '⏳ ПОДГОТОВКА...';
            
            try {
                userData.balance -= CONFIG.PACK_COST;
                UI.updateProfile();
                
                const wonCard = await Roulette.show();
                userData.cards.push(wonCard);
                
                UI.displayUserCards();
                
                const saveSuccess = await API.saveUserData(userData);
                if (saveSuccess) {
                    Cache.saveUserData(userData);
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

function initCloseRouletteButton() {
    const closeRouletteBtn = document.getElementById('closeRoulette');
    if (closeRouletteBtn) {
        closeRouletteBtn.addEventListener('click', () => {
            Roulette.close();
        });
    }
}

// ========== ЗАГРУЗКА ПРИЛОЖЕНИЯ ==========
async function initApp() {
    console.log('=== НАЧАЛО ЗАГРУЗКИ ===');
    
    try {
        isOnline = await API.checkOnlineStatus();
        console.log(`🌐 Статус сервера: ${isOnline ? 'ОНЛАЙН' : 'ОФЛАЙН'}`);
        
        if (isOnline) {
            // Загружаем с сервера
            userData = await API.loadUserData();
            marketListings = await API.loadMarket();
            
            if (!userData) {
                userData = {
                    balance: CONFIG.INITIAL_BALANCE,
                    cards: [],
                    farmStats: { totalClicks: 0 },
                    username: username
                };
            }
            
            Cache.saveUserData(userData);
            
        } else {
            // Офлайн режим
            Utils.showNotification('⚠️ Сервер недоступен. Работаем в офлайн-режиме.', 'warning');
            userData = Cache.loadUserData() || {
                balance: CONFIG.INITIAL_BALANCE,
                cards: [],
                farmStats: { totalClicks: 0 },
                username: username
            };
            marketListings = [];
        }
        
        UI.updateProfile();
        UI.displayUserCards();
        UI.displayMarket();
        
        initFarmButton();
        initOpenPackButton();
        initCloseRouletteButton();
        
        // Автообновление маркета (только онлайн)
        if (isOnline) {
            setInterval(async () => {
                try {
                    const newMarket = await API.loadMarket();
                    if (JSON.stringify(newMarket) !== JSON.stringify(marketListings)) {
                        marketListings = newMarket;
                        UI.displayMarket();
                        console.log('🔄 Маркет обновлен');
                    }
                } catch (error) {
                    console.warn('Ошибка обновления маркета:', error);
                }
            }, 10000); // Каждые 10 секунд
        }
        
        console.log('=== ПРИЛОЖЕНИЕ УСПЕШНО ЗАГРУЖЕНО ===');
        
        setTimeout(() => {
            if (isOnline) {
                Utils.showNotification(`👋 Добро пожаловать, @${username}!\n✅ Онлайн-маркет доступен`, 'success');
            } else {
                Utils.showNotification(`👋 Добро пожаловать, @${username}!`, 'info');
            }
        }, 1000);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки приложения:', error);
        Utils.showNotification('⚠️ Ошибка загрузки приложения', 'error');
        
        userData = Cache.loadUserData() || {
            balance: CONFIG.INITIAL_BALANCE,
            cards: [],
            farmStats: { totalClicks: 0 },
            username: username
        };
        marketListings = [];
        
        UI.updateProfile();
        UI.displayUserCards();
        UI.displayMarket();
        
        initFarmButton();
        initOpenPackButton();
        initCloseRouletteButton();
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