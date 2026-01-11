// ========== КОНФИГУРАЦИЯ ==========
const CONFIG = {
    BACKEND_URL: 'http://localhost:3000',
    PACK_COST: 50,
    MIN_SELL_PRICE: 10,
    MAX_SELL_PRICE: 10000,
    INITIAL_BALANCE: 100,
    MARKET_REFRESH_INTERVAL: 5000, // Увеличиваем до 5 секунд
    SOCKET_URL: 'ws://localhost:3000/ws',
    MAX_RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000
};

// ========== ИНИЦИАЛИЗАЦИЯ ==========
console.log('=== ЗАПУСК APP.JS ===');

let tg, userId, username, isMobile = false;
let isAppInitialized = false; // Флаг инициализации

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
let socket = null;
let isSocketConnected = false;
let marketRefreshInterval = null;
let retryCount = 0;

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
    
    getRarityByCardId(cardId) {
        if (cardId <= 5) return 'common';
        if (cardId <= 10) return 'rare';
        if (cardId <= 15) return 'epic';
        if (cardId <= 20) return 'legendary';
        return 'mythic';
    },
    
    showNotification(message, type = 'info') {
        // Проверяем, не слишком ли много уведомлений
        const notifications = document.querySelectorAll('[data-notification]');
        if (notifications.length > 3) {
            notifications[0].remove();
        }
        
        const notification = document.createElement('div');
        notification.setAttribute('data-notification', 'true');
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
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 3000);
    },
    
    generateCardId() {
        return 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },
    
    generateListingId() {
        return 'listing_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },
    
    // Оптимизированная функция загрузки с таймаутом
    async fetchWithTimeout(url, options = {}, timeout = 5000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    },
    
    // Простая задержка
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
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
        .new-listing {
            animation: fadeIn 0.5s ease;
            border: 2px solid #22c55e !important;
        }
        .socket-status {
            position: fixed;
            bottom: 10px;
            right: 10px;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            z-index: 1000;
        }
        .socket-connected {
            background: #22c55e;
            box-shadow: 0 0 10px #22c55e;
        }
        .socket-disconnected {
            background: #ef4444;
            box-shadow: 0 0 10px #ef4444;
        }
        .loading {
            animation: pulse 1.5s infinite;
        }
        .app-loading {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: #0f172a;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            color: white;
        }
        .app-loaded {
            display: none;
        }
    `;
    document.head.appendChild(style);
}

// ========== WEBSOCKET ДЛЯ ОНЛАЙН-МАРКЕТА ==========
const WebSocketService = {
    connect() {
        if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
            console.log('WebSocket уже подключен или подключается');
            return;
        }
        
        try {
            socket = new WebSocket(CONFIG.SOCKET_URL);
            
            socket.onopen = () => {
                console.log('✅ WebSocket подключен к маркету');
                isSocketConnected = true;
                retryCount = 0; // Сбрасываем счетчик попыток
                
                socket.send(JSON.stringify({
                    type: 'register',
                    userId: userId,
                    username: username,
                    action: 'connect'
                }));
                
                // Только одно уведомление при первом подключении
                if (!isAppInitialized) {
                    Utils.showNotification('📡 Подключено к онлайн-маркету', 'success');
                }
            };
            
            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    switch(data.type) {
                        case 'market_update':
                            marketListings = data.listings || [];
                            UI.displayMarket();
                            break;
                            
                        case 'new_listing':
                            if (data.listing && !marketListings.some(l => l.id === data.listing.id)) {
                                data.listing.isNew = true;
                                marketListings.unshift(data.listing);
                                UI.displayMarket();
                                
                                if (data.listing.sellerId !== userId) {
                                    Utils.showNotification(
                                        `🆕 @${data.listing.sellerName} выставил карту #${data.listing.cardId}`,
                                        'info'
                                    );
                                }
                            }
                            break;
                            
                        case 'listing_sold':
                            marketListings = marketListings.filter(l => l.id !== data.listingId);
                            UI.displayMarket();
                            
                            if (data.buyerId === userId) {
                                Utils.showNotification(`🎉 Вы купили карту #${data.cardId}!`, 'success');
                            } else if (data.sellerId === userId) {
                                Utils.showNotification(
                                    `💰 Ваша карта #${data.cardId} продана!`,
                                    'success'
                                );
                                userData.balance += data.price || 0;
                                UI.updateProfile();
                            }
                            break;
                    }
                } catch (error) {
                    console.error('Ошибка обработки WebSocket сообщения:', error);
                }
            };
            
            socket.onerror = (error) => {
                console.error('❌ WebSocket ошибка:', error);
                isSocketConnected = false;
            };
            
            socket.onclose = () => {
                console.log('WebSocket соединение закрыто');
                isSocketConnected = false;
                
                // Пытаемся переподключиться с экспоненциальной задержкой
                if (retryCount < CONFIG.MAX_RETRY_ATTEMPTS) {
                    retryCount++;
                    const delay = Math.min(1000 * Math.pow(2, retryCount), 30000); // Экспоненциальная задержка
                    
                    console.log(`Попытка переподключения через ${delay}ms (попытка ${retryCount})`);
                    
                    setTimeout(() => {
                        this.connect();
                    }, delay);
                }
            };
            
        } catch (error) {
            console.error('Ошибка создания WebSocket:', error);
            isSocketConnected = false;
        }
    },
    
    sendMarketListing(listing) {
        if (isSocketConnected && socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'new_listing',
                listing: listing
            }));
            return true;
        }
        return false;
    },
    
    sendBuyListing(listingId, buyerId, cardId, price) {
        if (isSocketConnected && socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'buy_listing',
                listingId: listingId,
                buyerId: buyerId,
                buyerName: username,
                cardId: cardId,
                price: price
            }));
            return true;
        }
        return false;
    }
};

// ========== ЗАГРУЗКА ДАННЫХ ==========
async function loadUserData() {
    try {
        // Сначала пробуем локальное хранилище
        const localData = localStorage.getItem(`user_${userId}`);
        if (localData) {
            const data = JSON.parse(localData);
            console.log('✅ Данные загружены локально');
            return data;
        }
        
        // Затем пробуем сервер с таймаутом
        const response = await Utils.fetchWithTimeout(
            `${CONFIG.BACKEND_URL}/api/user/${userId}`,
            {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            },
            3000
        );
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Данные загружены с сервера');
            localStorage.setItem(`user_${userId}`, JSON.stringify(data));
            return data;
        }
        
        console.log('⚠️ Сервер не ответил, используем начальные данные');
        
    } catch (error) {
        console.log('⚠️ Ошибка загрузки данных:', error.message);
    }
    
    // Возвращаем данные по умолчанию
    return {
        balance: CONFIG.INITIAL_BALANCE,
        cards: [],
        farmStats: { totalClicks: 0 },
        username: username,
        createdAt: new Date().toISOString()
    };
}

async function loadMarket() {
    try {
        const response = await Utils.fetchWithTimeout(
            `${CONFIG.BACKEND_URL}/api/market`,
            {
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            },
            3000
        );
        
        if (response.ok) {
            const data = await response.json();
            console.log(`✅ Маркет загружен: ${data.length} лотов`);
            return Array.isArray(data) ? data : [];
        }
    } catch (error) {
        console.log('⚠️ Не удалось загрузить маркет:', error.message);
    }
    
    return [];
}

async function saveUserData() {
    try {
        // Всегда сохраняем локально
        localStorage.setItem(`user_${userId}`, JSON.stringify(userData));
        
        // Пробуем сохранить на сервер, но не ждем долго
        const savePromise = Utils.fetchWithTimeout(
            `${CONFIG.BACKEND_URL}/api/user/${userId}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            },
            2000
        ).then(response => {
            if (response.ok) {
                console.log('✅ Данные сохранены на сервер');
            }
        }).catch(() => {
            // Игнорируем ошибки сохранения на сервер
        });
        
        // Не ждем завершения сохранения на сервер
        return true;
        
    } catch (error) {
        console.log('⚠️ Ошибка сохранения:', error);
        return true; // Всегда возвращаем true для локального сохранения
    }
}

// ========== РУЛЕТКА ==========
const Roulette = {
    show() {
        return new Promise((resolve) => {
            const container = document.getElementById('rouletteContainer');
            if (!container) {
                resolve(this.generateRandomCard());
                return;
            }
            
            container.style.display = 'block';
            const rouletteDiv = document.getElementById('roulette');
            const resultText = document.getElementById('resultText');
            const title = document.getElementById('rouletteTitle');
            const closeBtn = document.getElementById('closeRoulette');
            
            if (rouletteDiv) rouletteDiv.innerHTML = '';
            if (resultText) resultText.innerHTML = '🎮 <b>ГОТОВИМ РУЛЕТКУ...</b>';
            if (title) title.textContent = '🎰 ОТКРЫТИЕ ПАКА';
            if (closeBtn) {
                closeBtn.style.display = 'none';
                closeBtn.textContent = '🎴 ЗАБРАТЬ КАРТУ';
            }
            
            setTimeout(() => {
                const wonCard = this.generateRandomCard();
                
                if (resultText) {
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
                            <div style="color: ${Utils.getRarityColor(wonCard.rarity)}; 
                                      font-size: 18px; 
                                      font-weight: bold;
                                      margin: 10px 0;
                                      padding: 10px;
                                      background: rgba(0,0,0,0.3);
                                      border-radius: 10px;">
                                ${rarityEmoji[wonCard.rarity] || '🎴'} ${wonCard.rarity.toUpperCase()} КАРТУ #${wonCard.cardId}
                            </div>
                        </div>
                    `;
                }
                
                if (title) title.textContent = '🏆 ПОБЕДА!';
                if (closeBtn) closeBtn.style.display = 'inline-block';
                
                resolve(wonCard);
                
            }, 1000);
        });
    },
    
    generateRandomCard() {
        const cardId = Math.floor(Math.random() * 20) + 1;
        const rarities = ['common', 'common', 'common', 'rare', 'rare', 'epic', 'legendary'];
        const rarity = rarities[Math.floor(Math.random() * rarities.length)];
        
        return {
            id: Utils.generateCardId(),
            cardId: cardId,
            rarity: rarity,
            name: `Карта #${cardId}`,
            ownerId: userId,
            obtainedAt: new Date().toISOString(),
            isNew: true
        };
    },
    
    close() {
        const container = document.getElementById('rouletteContainer');
        if (container) {
            container.style.display = 'none';
        }
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
        
        this.updateSocketStatus();
    },
    
    updateSocketStatus() {
        let statusElement = document.querySelector('.socket-status');
        if (!statusElement) {
            statusElement = document.createElement('div');
            statusElement.className = 'socket-status';
            document.body.appendChild(statusElement);
        }
        
        if (isSocketConnected) {
            statusElement.classList.remove('socket-disconnected');
            statusElement.classList.add('socket-connected');
            statusElement.title = 'Онлайн-маркет подключен';
        } else {
            statusElement.classList.remove('socket-connected');
            statusElement.classList.add('socket-disconnected');
            statusElement.title = 'Онлайн-маркет отключен';
        }
    },
    
    displayUserCards() {
        const container = document.getElementById('myCards');
        if (!container) return;
        
        if (!userData.cards || userData.cards.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; background: #1e293b; border-radius: 15px; color: #94a3b8; border: 2px dashed #475569;">
                    <div style="font-size: 48px; margin-bottom: 15px;">🃏</div>
                    <h3 style="color: #cbd5e1; margin-bottom: 10px;">У вас пока нет карт</h3>
                    <p>Откройте свой первый пак!</p>
                </div>
            `;
            return;
        }
        
        const gridColumns = isMobile ? 'repeat(auto-fill, minmax(130px, 1fr))' : 'repeat(auto-fill, minmax(160px, 1fr))';
        
        container.innerHTML = `
            <div style="display: grid; grid-template-columns: ${gridColumns}; gap: ${isMobile ? '10px' : '15px'}; width: 100%;">
                ${userData.cards.slice(0, 50).map((card, index) => `
                    <div class="${card.isNew ? 'new-listing' : ''}" style="background: #1e293b; border-radius: 10px; padding: 12px; text-align: center; border: 2px solid ${Utils.getRarityColor(card.rarity)};">
                        ${Utils.createCardImage(card.cardId).outerHTML}
                        <div style="margin: 10px 0;">
                            <div style="font-weight: bold; font-size: 14px; margin-bottom: 5px;">Карта #${card.cardId}</div>
                            <div style="color: ${Utils.getRarityColor(card.rarity)}; font-size: 12px; font-weight: bold; background: rgba(0,0,0,0.3); padding: 3px 8px; border-radius: 20px; display: inline-block;">
                                ${card.rarity?.toUpperCase() || 'COMMON'}
                            </div>
                        </div>
                        <button onclick="sellCard('${card.id}')" style="width: 100%; background: #22c55e; color: white; border: none; padding: 8px; border-radius: 6px; cursor: pointer; font-size: 12px;">
                            💰 Продать
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
        
        // Убираем метку "новое" через 2 секунды
        setTimeout(() => {
            userData.cards.forEach(card => {
                if (card.isNew) delete card.isNew;
            });
        }, 2000);
    },
    
    displayMarket() {
        const container = document.getElementById('market');
        if (!container) return;
        
        // Фильтруем свои лоты
        const otherListings = marketListings.filter(listing => listing.sellerId !== userId);
        
        if (otherListings.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; background: #1e293b; border-radius: 15px; color: #94a3b8; border: 2px dashed #475569;">
                    <div style="font-size: 48px; margin-bottom: 15px;">🏪</div>
                    <h3 style="color: #cbd5e1; margin-bottom: 10px;">Маркет пуст</h3>
                    <p>Будьте первым, кто выставит карту!</p>
                </div>
            `;
            return;
        }
        
        const gridColumns = isMobile ? 'repeat(auto-fill, minmax(140px, 1fr))' : 'repeat(auto-fill, minmax(180px, 1fr))';
        
        container.innerHTML = `
            <div style="display: grid; grid-template-columns: ${gridColumns}; gap: ${isMobile ? '10px' : '15px'}; width: 100%;">
                ${otherListings.slice(0, 30).map((listing, index) => {
                    const canBuy = userData.balance >= (listing.price || 0);
                    const isNew = listing.isNew;
                    
                    return `
                    <div class="${isNew ? 'new-listing' : ''}" style="background: #1e293b; border-radius: 10px; padding: 12px; text-align: center; border: 2px solid ${Utils.getRarityColor(listing.rarity)};">
                        ${Utils.createCardImage(listing.cardId).outerHTML}
                        <div style="margin: 10px 0;">
                            <div style="font-weight: bold; font-size: 14px; margin-bottom: 5px;">Карта #${listing.cardId}</div>
                            <div style="color: ${Utils.getRarityColor(listing.rarity)}; font-size: 12px; font-weight: bold; background: rgba(0,0,0,0.3); padding: 3px 8px; border-radius: 20px; margin-bottom: 5px;">
                                ${listing.rarity?.toUpperCase() || 'COMMON'}
                            </div>
                            <div style="font-size: 12px; color: #94a3b8;">
                                💁 @${listing.sellerName || 'unknown'}
                            </div>
                        </div>
                        <div style="background: rgba(34, 197, 94, 0.1); border-radius: 8px; padding: 10px; margin: 10px 0;">
                            <div style="font-size: 12px; color: #94a3b8;">Цена:</div>
                            <div style="color: #22c55e; font-weight: bold; font-size: 20px;">
                                ${Utils.formatNumber(listing.price || 0)} хериков
                            </div>
                        </div>
                        <button onclick="buyMarketCard('${listing.id}')" 
                                style="width: 100%; background: ${canBuy ? '#6366f1' : '#94a3b8'}; color: white; border: none; padding: 10px; border-radius: 6px; cursor: ${canBuy ? 'pointer' : 'not-allowed'};"
                                ${!canBuy ? 'disabled' : ''}>
                            ${canBuy ? '🛒 Купить' : '❌ Недостаточно'}
                        </button>
                    </div>
                    `;
                }).join('')}
            </div>
        `;
        
        // Убираем метку "новое" через 2 секунды
        setTimeout(() => {
            marketListings.forEach(listing => {
                if (listing.isNew) delete listing.isNew;
            });
        }, 2000);
    },
    
    // Функция для скрытия экрана загрузки
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        const appContent = document.getElementById('appContent');
        
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
        
        if (appContent) {
            appContent.style.display = 'block';
        }
    },
    
    // Функция для показа экрана загрузки
    showLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        const appContent = document.getElementById('appContent');
        
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
        }
        
        if (appContent) {
            appContent.style.display = 'none';
        }
    }
};

// ========== ОСНОВНЫЕ ФУНКЦИИ ==========
async function sellCard(cardId) {
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
        `💰 ВЫСТАВЛЕНИЕ НА ПРОДАЖУ\n\n` +
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
    if (isNaN(price) || price < CONFIG.MIN_SELL_PRICE || price > CONFIG.MAX_SELL_PRICE) {
        Utils.showNotification(`❌ Цена должна быть от ${CONFIG.MIN_SELL_PRICE} до ${CONFIG.MAX_SELL_PRICE} хериков!`, 'error');
        return;
    }
    
    if (!confirm(`🎴 Выставить карту #${card.cardId} на продажу за ${Utils.formatNumber(price)} хериков?\n\nПродавец: @${username}`)) {
        return;
    }
    
    Utils.showNotification('🔄 Создаем лот...', 'info');
    
    try {
        // Создаем новый лот
        const newListing = {
            id: Utils.generateListingId(),
            sellerId: userId,
            sellerName: username,
            cardId: card.cardId,
            cardInstanceId: card.id,
            rarity: card.rarity,
            price: price,
            isNew: true,
            createdAt: new Date().toISOString()
        };
        
        // Удаляем карту у пользователя
        userData.cards = userData.cards.filter(c => c.id !== cardId);
        
        // Добавляем лот в маркет
        marketListings.unshift(newListing);
        
        // Сохраняем данные пользователя
        await saveUserData();
        
        // Обновляем интерфейс
        UI.displayUserCards();
        UI.displayMarket();
        
        // Пробуем отправить на сервер
        try {
            await Utils.fetchWithTimeout(
                `${CONFIG.BACKEND_URL}/api/market/list`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newListing)
                },
                2000
            );
        } catch (e) {
            // Игнорируем ошибки отправки на сервер
        }
        
        // Отправляем через WebSocket
        WebSocketService.sendMarketListing(newListing);
        
        Utils.showNotification(`✅ Карта выставлена за ${Utils.formatNumber(price)} хериков!`, 'success');
        
    } catch (error) {
        console.error('❌ Ошибка при создании лота:', error);
        Utils.showNotification('❌ Ошибка при создании лота', 'error');
    }
}

async function buyMarketCard(listingId) {
    const listing = marketListings.find(l => l.id === listingId);
    if (!listing) {
        Utils.showNotification('❌ Лот не найден!', 'error');
        return;
    }
    
    if (listing.sellerId === userId) {
        Utils.showNotification('❌ Нельзя купить свою карту!', 'error');
        return;
    }
    
    if (userData.balance < listing.price) {
        Utils.showNotification(`❌ Недостаточно хериков!\nНужно: ${listing.price}`, 'error');
        return;
    }
    
    if (!confirm(`🛒 Покупка карты #${listing.cardId}\n\nПродавец: @${listing.sellerName}\nЦена: ${Utils.formatNumber(listing.price)} хериков\n\nПодтверждаете покупку?`)) {
        return;
    }
    
    Utils.showNotification('🔄 Покупаем карту...', 'info');
    
    try {
        // Обновляем баланс покупателя
        userData.balance -= listing.price;
        
        // Создаем карту для покупателя
        const newCard = {
            id: Utils.generateCardId(),
            cardId: listing.cardId,
            rarity: listing.rarity,
            name: `Карта #${listing.cardId}`,
            purchasedAt: new Date().toISOString(),
            purchasedFrom: listing.sellerId,
            purchasePrice: listing.price,
            isNew: true
        };
        
        userData.cards.push(newCard);
        
        // Удаляем лот из маркета
        marketListings = marketListings.filter(l => l.id !== listingId);
        
        // Сохраняем данные
        await saveUserData();
        
        // Обновляем интерфейс
        UI.updateProfile();
        UI.displayUserCards();
        UI.displayMarket();
        
        // Пробуем отправить на сервер
        try {
            await Utils.fetchWithTimeout(
                `${CONFIG.BACKEND_URL}/api/market/buy`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        listingId: listingId,
                        buyerId: userId,
                        buyerName: username,
                        sellerId: listing.sellerId,
                        cardId: listing.cardId,
                        price: listing.price
                    })
                },
                2000
            );
        } catch (e) {
            // Игнорируем ошибки отправки на сервер
        }
        
        // Отправляем через WebSocket
        WebSocketService.sendBuyListing(listingId, userId, listing.cardId, listing.price);
        
        Utils.showNotification(`🎉 Вы купили карту #${listing.cardId}!`, 'success');
        
    } catch (error) {
        console.error('❌ Ошибка покупки:', error);
        Utils.showNotification(`❌ Ошибка покупки: ${error.message}`, 'error');
    }
}

// ========== КНОПКИ ==========
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
            
            // Откладываем сохранение
            setTimeout(() => {
                saveUserData().catch(() => {});
            }, 100);
        });
    }
}

function initOpenPackButton() {
    const openPackBtn = document.getElementById('openPack');
    if (openPackBtn) {
        openPackBtn.addEventListener('click', async () => {
            if (isOpeningPack) return;
            
            if (userData.balance < CONFIG.PACK_COST) {
                Utils.showNotification(`❌ Недостаточно хериков! Нужно: ${CONFIG.PACK_COST}`, 'error');
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
                wonCard.isNew = true;
                
                userData.cards.push(wonCard);
                
                // Сохраняем асинхронно, не ждем
                saveUserData().catch(() => {});
                
                UI.displayUserCards();
                
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
    if (isAppInitialized) {
        console.log('Приложение уже инициализировано');
        return;
    }
    
    console.log('=== ЗАГРУЗКА ПРИЛОЖЕНИЯ ===');
    
    // Показываем экран загрузки
    UI.showLoadingScreen();
    
    try {
        // Устанавливаем таймаут для всей инициализации
        const initTimeout = setTimeout(() => {
            console.log('Таймаут инициализации, продолжаем с базовыми данными');
            finishInit();
        }, 10000); // 10 секунд максимум
        
        // Параллельно загружаем данные пользователя и маркет
        const [userDataResult, marketDataResult] = await Promise.allSettled([
            loadUserData(),
            loadMarket()
        ]);
        
        clearTimeout(initTimeout);
        
        // Обрабатываем результаты
        if (userDataResult.status === 'fulfilled') {
            userData = userDataResult.value;
            console.log('✅ Данные пользователя загружены');
        }
        
        if (marketDataResult.status === 'fulfilled') {
            marketListings = marketDataResult.value;
            console.log(`✅ Маркет загружен: ${marketListings.length} лотов`);
        }
        
        finishInit();
        
    } catch (error) {
        console.error('❌ Критическая ошибка инициализации:', error);
        finishInit();
    }
    
    function finishInit() {
        // Обновляем интерфейс
        UI.updateProfile();
        UI.displayUserCards();
        UI.displayMarket();
        
        // Инициализируем кнопки
        initFarmButton();
        initOpenPackButton();
        initCloseRouletteButton();
        
        // Подключаем WebSocket (но не блокируем загрузку)
        setTimeout(() => {
            WebSocketService.connect();
        }, 1000);
        
        // Запускаем автообновление маркета (только как резервный канал)
        if (marketRefreshInterval) {
            clearInterval(marketRefreshInterval);
        }
        
        marketRefreshInterval = setInterval(async () => {
            if (!isSocketConnected) {
                try {
                    const newMarket = await loadMarket();
                    marketListings = newMarket;
                    UI.displayMarket();
                } catch (error) {
                    console.log('⚠️ Ошибка обновления маркета:', error);
                }
            }
        }, CONFIG.MARKET_REFRESH_INTERVAL);
        
        // Скрываем экран загрузки
        setTimeout(() => {
            UI.hideLoadingScreen();
            isAppInitialized = true;
            
            console.log('=== ПРИЛОЖЕНИЕ УСПЕШНО ЗАГРУЖЕНО ===');
            
            Utils.showNotification(`👋 Добро пожаловать, @${username}!`, 'success');
        }, 500);
    }
}

// Делаем функции глобальными
window.sellCard = sellCard;
window.buyMarketCard = buyMarketCard;

// Запускаем приложение с защитой от дублирования
let initStarted = false;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!initStarted) {
            initStarted = true;
            initApp();
        }
    });
} else {
    if (!initStarted) {
        initStarted = true;
        initApp();
    }
}

// Обработка ошибок
window.addEventListener('error', (event) => {
    console.error('Глобальная ошибка:', event.error);
    Utils.showNotification('⚠️ Произошла ошибка в приложении', 'error');
});

// Обработка необработанных промисов
window.addEventListener('unhandledrejection', (event) => {
    console.error('Необработанный промис:', event.reason);
});