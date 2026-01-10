// ========== КОНФИГУРАЦИЯ ==========
const CONFIG = {
    BACKEND_URL: 'http://localhost:3000',
    PACK_COST: 50,
    MIN_SELL_PRICE: 10,
    MAX_SELL_PRICE: 10000
};

// Версия данных для миграции
const DATA_VERSION = '1.0.1';

// ========== ИНИЦИАЛИЗАЦИЯ ==========
console.log('=== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ===');

let tg, userId, username, isMobile = false;

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
        
        // Проверяем мобильное устройство
        isMobile = tg.isExpanded || window.innerWidth <= 768;
    } else {
        console.warn('⚠️ Telegram WebApp не найден, режим браузера');
        userId = 'browser_' + Date.now();
        username = 'browser_user';
        isMobile = window.innerWidth <= 768;
    }
} catch (error) {
    console.error('❌ Ошибка инициализации Telegram:', error);
    userId = 'error_' + Date.now();
    username = 'error_user';
    isMobile = window.innerWidth <= 768;
}

console.log('👤 Пользователь:', { userId, username, isMobile });

// Глобальные переменные
let userData = {
    balance: 100,
    cards: [],
    farmStats: { totalClicks: 0 }
};

let marketListings = [];
let isOpeningPack = false;

// ========== ХРАНЕНИЕ ДАННЫХ С СИНХРОНИЗАЦИЕЙ ==========
const Storage = {
    // Ключ для хранения данных
    getStorageKey() {
        return `card_game_data_${userId}`;
    },
    
    // Получить ID устройства
    getDeviceId() {
        let deviceId = localStorage.getItem('device_id');
        if (!deviceId) {
            deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('device_id', deviceId);
        }
        return deviceId;
    },
    
    // Миграция данных
    async migrateData(oldData) {
        if (!oldData.version || oldData.version !== DATA_VERSION) {
            console.log(`🔄 Миграция данных с версии ${oldData.version || 'нет'} до ${DATA_VERSION}`);
            
            // Добавляем поле версии
            oldData.version = DATA_VERSION;
            oldData.lastUpdated = Date.now();
            
            // Миграции для разных версий
            if (!oldData.farmStats) {
                oldData.farmStats = { totalClicks: 0 };
            }
            
            if (!oldData.cards) {
                oldData.cards = [];
            }
            
            // Конвертация старых форматов
            if (Array.isArray(oldData.cards)) {
                oldData.cards = oldData.cards.map(card => ({
                    ...card,
                    id: card.id || `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    rarity: card.rarity || 'common'
                }));
            }
            
            // Добавляем deviceId если нет
            if (!oldData.deviceId) {
                oldData.deviceId = this.getDeviceId();
            }
        }
        
        return oldData;
    },
    
    // Начальные данные
    getInitialData() {
        return {
            balance: 100,
            cards: [],
            farmStats: { totalClicks: 0 },
            lastSync: Date.now(),
            deviceId: this.getDeviceId(),
            version: DATA_VERSION,
            username: username
        };
    },
    
    // Сохранение данных в localStorage + синхронизация
    async saveData(data) {
        try {
            SyncUI.showStatus('Сохранение...', 'loading');
            
            // 1. Сохраняем локально
            const dataToSave = {
                ...data,
                lastSync: Date.now(),
                deviceId: this.getDeviceId()
            };
            
            localStorage.setItem(this.getStorageKey(), JSON.stringify(dataToSave));
            console.log('💾 Данные сохранены локально');
            
            // 2. Сохраняем на сервер для синхронизации
            let savedToServer = false;
            try {
                savedToServer = await API.saveUserData(dataToSave);
            } catch (serverError) {
                console.warn('⚠️ Сервер недоступен для сохранения:', serverError);
            }
            
            // 3. Если есть Telegram, сохраняем в Cloud Storage
            if (window.Telegram?.WebApp?.CloudStorage) {
                try {
                    await this.saveToTelegramCloud(dataToSave);
                } catch (cloudError) {
                    console.warn('⚠️ Ошибка сохранения в Telegram Cloud:', cloudError);
                }
            }
            
            SyncUI.showStatus(savedToServer ? 'Прогресс сохранен!' : 'Сохранено локально', 
                            savedToServer ? 'success' : 'info');
            return savedToServer || true;
        } catch (error) {
            console.warn('⚠️ Ошибка сохранения:', error);
            SyncUI.showStatus('Ошибка сохранения', 'error');
            return false;
        }
    },
    
    // Загрузка данных (с приоритетом: сервер > Telegram Cloud > localStorage)
    async loadData() {
        try {
            let data = null;
            
            // 1. Пробуем загрузить с сервера
            try {
                const serverData = await API.loadUserData();
                if (serverData && Object.keys(serverData).length > 0) {
                    console.log('✅ Данные загружены с сервера');
                    data = serverData;
                    // Сохраняем локально для оффлайн-режима
                    localStorage.setItem(this.getStorageKey(), JSON.stringify(data));
                }
            } catch (serverError) {
                console.warn('⚠️ Сервер недоступен для загрузки:', serverError);
            }
            
            // 2. Если с сервера не загрузилось, пробуем Telegram Cloud
            if (!data && window.Telegram?.WebApp?.CloudStorage) {
                const cloudData = await this.loadFromTelegramCloud();
                if (cloudData) {
                    console.log('✅ Данные загружены из Telegram Cloud');
                    data = cloudData;
                }
            }
            
            // 3. Если все еще нет данных, пробуем localStorage
            if (!data) {
                const localData = localStorage.getItem(this.getStorageKey());
                if (localData) {
                    try {
                        data = JSON.parse(localData);
                        console.log('✅ Данные загружены из localStorage');
                    } catch (parseError) {
                        console.warn('⚠️ Ошибка парсинга локальных данных:', parseError);
                    }
                }
            }
            
            // 4. Миграция данных если нужно
            if (data) {
                data = await this.migrateData(data);
                return data;
            }
            
        } catch (error) {
            console.warn('⚠️ Ошибка загрузки данных:', error);
        }
        
        // 5. Возвращаем начальные данные
        console.log('🆕 Созданы начальные данные');
        return this.getInitialData();
    },
    
    // Сохранение в Telegram Cloud Storage
    async saveToTelegramCloud(data) {
        return new Promise((resolve) => {
            if (!tg?.CloudStorage) {
                resolve(false);
                return;
            }
            
            tg.CloudStorage.setItem(this.getStorageKey(), JSON.stringify(data), (err, result) => {
                if (!err) {
                    console.log('✅ Данные сохранены в Telegram Cloud');
                    resolve(true);
                } else {
                    console.warn('⚠️ Ошибка сохранения в Telegram Cloud:', err);
                    resolve(false);
                }
            });
        });
    },
    
    // Загрузка из Telegram Cloud Storage
    async loadFromTelegramCloud() {
        return new Promise((resolve) => {
            if (!tg?.CloudStorage) {
                resolve(null);
                return;
            }
            
            tg.CloudStorage.getItem(this.getStorageKey(), (err, value) => {
                if (!err && value) {
                    try {
                        resolve(JSON.parse(value));
                    } catch {
                        resolve(null);
                    }
                } else {
                    resolve(null);
                }
            });
        });
    },
    
    // Синхронизация данных между устройствами
    async syncData() {
        try {
            SyncUI.showStatus('Синхронизация...', 'loading');
            
            // Загружаем с сервера (самые свежие данные)
            const serverData = await API.loadUserData();
            const localData = JSON.parse(localStorage.getItem(this.getStorageKey()) || '{}');
            
            let mergedData = localData;
            
            // Если есть данные на сервере, объединяем их с локальными
            if (serverData && Object.keys(serverData).length > 0) {
                // Приоритет: серверные данные за баланс и карты, локальные за статистику
                mergedData = {
                    ...serverData,
                    farmStats: {
                        ...serverData.farmStats,
                        totalClicks: Math.max(
                            serverData.farmStats?.totalClicks || 0,
                            localData.farmStats?.totalClicks || 0
                        )
                    },
                    lastSync: Date.now(),
                    deviceId: this.getDeviceId()
                };
                
                // Объединяем карты (убираем дубликаты)
                const allCards = [...(serverData.cards || []), ...(localData.cards || [])];
                const uniqueCards = Array.from(new Map(allCards.map(card => [card.id, card])).values());
                mergedData.cards = uniqueCards;
                
                // Берем больший баланс
                mergedData.balance = Math.max(serverData.balance || 0, localData.balance || 0);
            }
            
            // Сохраняем объединенные данные везде
            await this.saveData(mergedData);
            
            SyncUI.showStatus('Данные синхронизированы!', 'success');
            return mergedData;
            
        } catch (error) {
            console.warn('⚠️ Ошибка синхронизации:', error);
            SyncUI.showStatus('Ошибка синхронизации', 'error');
            return null;
        }
    }
};

// ========== ИНТЕРФЕЙС СИНХРОНИЗАЦИИ ==========
const SyncUI = {
    showStatus(text, type = 'info') {
        // Создаем элемент если нет
        let element = document.getElementById('syncStatus');
        if (!element) {
            element = document.createElement('div');
            element.id = 'syncStatus';
            element.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                z-index: 10000;
                font-size: ${isMobile ? '11px' : '12px'};
                padding: ${isMobile ? '4px 8px' : '5px 10px'};
                border-radius: 10px;
                background: rgba(0,0,0,0.7);
                color: white;
                display: none;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255,255,255,0.1);
            `;
            document.body.appendChild(element);
        }
        
        const colors = {
            info: 'rgba(59, 130, 246, 0.9)',
            success: 'rgba(34, 197, 94, 0.9)',
            error: 'rgba(239, 68, 68, 0.9)',
            loading: 'rgba(139, 92, 246, 0.9)',
            warning: 'rgba(245, 158, 11, 0.9)'
        };
        
        element.style.display = 'block';
        element.style.background = colors[type] || colors.info;
        element.innerHTML = type === 'loading' 
            ? `<span>${text} <span class="loading-dots">...</span></span>`
            : text;
        
        if (type !== 'loading') {
            setTimeout(() => {
                element.style.display = 'none';
            }, 3000);
        }
    },
    
    hideStatus() {
        const element = document.getElementById('syncStatus');
        if (element) {
            element.style.display = 'none';
        }
    }
};

// ========== API ВЗАИМОДЕЙСТВИЕ С БЭКЕНДОМ ==========
const API = {
    // Загрузка данных пользователя
    async loadUserData() {
        try {
            console.log(`📥 Загрузка данных пользователя ${userId}...`);
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/user/${userId}`, {
                method: 'GET',
                headers: { 
                    'Accept': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Данные пользователя загружены с сервера');
                return data;
            } else if (response.status === 404) {
                console.log('🆕 Пользователь не найден на сервере');
                return {};
            } else {
                console.warn(`⚠️ Сервер вернул ошибку ${response.status}`);
                throw new Error(`Server error: ${response.status}`);
            }
        } catch (error) {
            console.warn('⚠️ Не удалось загрузить данные с сервера:', error.message);
            throw error;
        }
    },
    
    // Сохранение данных пользователя
    async saveUserData(data) {
        try {
            console.log(`💾 Сохранение данных пользователя ${userId} на сервер...`);
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/user/${userId}`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    ...data,
                    username: username,
                    userId: userId
                })
            });
            
            if (response.ok) {
                console.log('✅ Данные пользователя сохранены на сервере');
                return true;
            } else {
                console.warn(`⚠️ Сервер вернул ошибку ${response.status} при сохранении`);
                return false;
            }
        } catch (error) {
            console.warn('⚠️ Не удалось сохранить данные на сервере:', error);
            return false;
        }
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
            console.log(`🏷️ Создание лота для карты ${card.cardId} за ${price}...`);
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
    // Проверка мобильного устройства
    isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    },
    
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
        img.style.width = isMobile ? '100%' : width;
        img.style.height = isMobile ? '120px' : height;
        img.style.objectFit = 'cover';
        img.style.borderRadius = '8px';
        img.style.border = '1px solid #334155';
        
        // Для мобильных увеличиваем области клика
        if (isMobile) {
            img.style.minHeight = '120px';
            img.style.cursor = 'pointer';
        }
        
        const imageUrl = this.getCardImageUrl(cardId);
        console.log(`🖼️ Загружаю картинку: ${imageUrl} для карты ${cardId}`);
        img.src = imageUrl;
        
        // Fallback если картинка не загрузилась
        img.onerror = () => {
            console.warn(`❌ Картинка card${cardId}.png не найдена`);
            img.src = `https://via.placeholder.com/${isMobile ? '120x160' : '150x200'}/1e293b/ffffff?text=Card+${cardId}`;
        };
        
        return img;
    },
    
    // Показать уведомление
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        const notificationStyle = isMobile ? `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 16px;
            background: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            border-radius: 8px;
            z-index: 10000;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            animation: slideInMobile 0.3s ease;
            width: 90%;
            max-width: 300px;
            text-align: center;
            font-size: 14px;
        ` : `
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
            max-width: 350px;
        `;
        
        notification.style.cssText = notificationStyle;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; ${isMobile ? 'justify-content: center;' : ''}">
                <span style="font-size: ${isMobile ? '18px' : '20px'};">
                    ${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}
                </span>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Автоудаление
        setTimeout(() => {
            notification.style.animation = isMobile ? 'slideOutMobile 0.3s ease' : 'slideOut 0.3s ease';
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
                @keyframes slideInMobile {
                    from { transform: translate(-50%, -20px); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
                @keyframes slideOutMobile {
                    from { transform: translate(-50%, 0); opacity: 1; }
                    to { transform: translate(-50%, -20px); opacity: 0; }
                }
                @keyframes loadingDots {
                    0%, 20% { content: '.'; }
                    40% { content: '..'; }
                    60%, 100% { content: '...'; }
                }
                .loading-dots::after {
                    content: '...';
                    animation: loadingDots 1.5s infinite;
                }
            `;
            document.head.appendChild(style);
        }
    }
};

// ========== ОБНОВЛЕНИЕ ИНТЕРФЕЙСА ==========
const UI = {
    // Адаптивный CSS
    applyResponsiveStyles() {
        if (!document.querySelector('#responsive-styles')) {
            const style = document.createElement('style');
            style.id = 'responsive-styles';
            style.textContent = `
                /* Адаптивные стили */
                @media (max-width: 768px) {
                    .container {
                        padding: 12px !important;
                    }
                    
                    .cards-grid {
                        grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)) !important;
                        gap: 10px !important;
                    }
                    
                    .card-item {
                        padding: 10px !important;
                        font-size: 12px;
                        min-height: 200px;
                    }
                    
                    button {
                        padding: 12px !important;
                        font-size: 14px;
                        min-height: 44px;
                        margin: 4px 0;
                    }
                    
                    h2 {
                        font-size: 18px !important;
                    }
                    
                    .tab-button {
                        padding: 10px 12px !important;
                        font-size: 13px !important;
                        min-width: 80px;
                    }
                    
                    .profile-info {
                        flex-direction: column;
                        gap: 10px;
                        text-align: center;
                    }
                }
                
                @media (max-width: 480px) {
                    .cards-grid {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                    
                    .card-item {
                        min-width: 130px;
                    }
                }
                
                /* Улучшения для тач-устройств */
                @media (hover: none) and (pointer: coarse) {
                    button, .clickable {
                        min-height: 44px;
                        min-width: 44px;
                    }
                    
                    button:active {
                        transform: scale(0.95);
                        transition: transform 0.1s;
                    }
                    
                    /* Убираем ховер-эффекты */
                    .card-item:hover {
                        transform: none !important;
                    }
                }
                
                /* Стили для безопасных зон */
                @supports (padding: max(0px)) {
                    .container {
                        padding-left: max(12px, env(safe-area-inset-left)) !important;
                        padding-right: max(12px, env(safe-area-inset-right)) !important;
                        padding-bottom: max(12px, env(safe-area-inset-bottom)) !important;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    },
    
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
        
        // Показываем метку устройства если не мобильное
        if (!isMobile) {
            const deviceInfo = document.getElementById('deviceInfo');
            if (deviceInfo) {
                deviceInfo.textContent = `Устройство: ${Storage.getDeviceId().substring(0, 8)}...`;
                deviceInfo.style.fontSize = '11px';
                deviceInfo.style.color = '#64748b';
                deviceInfo.style.marginTop = '5px';
            }
        }
    },
    
    // Отображение карт пользователя
    displayUserCards() {
        const container = document.getElementById('myCards');
        
        if (!userData.cards || userData.cards.length === 0) {
            container.innerHTML = `
                <div style="
                    text-align: center;
                    padding: ${isMobile ? '30px 20px' : '40px'};
                    background: #1e293b;
                    border-radius: 15px;
                    color: #94a3b8;
                    border: 2px dashed #475569;
                    margin: ${isMobile ? '10px 0' : '20px 0'};
                ">
                    <div style="font-size: ${isMobile ? '40px' : '48px'}; margin-bottom: 15px;">🃏</div>
                    <h3 style="color: #cbd5e1; margin-bottom: 10px; font-size: ${isMobile ? '16px' : '18px'};">У вас пока нет карт</h3>
                    <p style="margin-bottom: 20px; font-size: ${isMobile ? '13px' : '14px'};">Откройте свой первый пак, чтобы получить карты!</p>
                    <button onclick="document.getElementById('openPack').click()" 
                            style="
                                background: #8b5cf6;
                                color: white;
                                border: none;
                                padding: ${isMobile ? '10px 20px' : '12px 24px'};
                                border-radius: 8px;
                                cursor: pointer;
                                font-size: ${isMobile ? '14px' : '16px'};
                            ">
                        🎁 Открыть пак
                    </button>
                </div>
            `;
            return;
        }
        
        const cardWidth = isMobile ? '130px' : '160px';
        const gridColumns = isMobile ? 'repeat(auto-fill, minmax(130px, 1fr))' : 'repeat(auto-fill, minmax(160px, 1fr))';
        
        container.innerHTML = `
            <div class="cards-grid" style="
                display: grid;
                grid-template-columns: ${gridColumns};
                gap: ${isMobile ? '10px' : '15px'};
                width: 100%;
            ">
                ${userData.cards.map(card => `
                    <div class="card-item ${card.rarity}" 
                         style="
                            background: #1e293b;
                            border-radius: 10px;
                            padding: ${isMobile ? '10px' : '12px'};
                            text-align: center;
                            border: 2px solid ${Utils.getRarityColor(card.rarity)};
                            transition: transform 0.3s;
                            display: flex;
                            flex-direction: column;
                            justify-content: space-between;
                         ">
                        ${Utils.createCardImage(card.cardId, 'card-image', '100%', isMobile ? '120px' : '140px').outerHTML}
                        <div style="margin: ${isMobile ? '8px 0' : '10px 0'}; flex-grow: 1;">
                            <div style="font-weight: bold; font-size: ${isMobile ? '13px' : '14px'}; margin-bottom: 5px;">
                                Карта #${card.cardId}
                            </div>
                            <div style="
                                color: ${Utils.getRarityColor(card.rarity)};
                                font-size: ${isMobile ? '11px' : '12px'};
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
                                class="sell-button"
                                style="
                                    width: 100%;
                                    background: #22c55e;
                                    color: white;
                                    border: none;
                                    padding: ${isMobile ? '8px' : '10px'};
                                    border-radius: 6px;
                                    cursor: pointer;
                                    font-size: ${isMobile ? '12px' : '14px'};
                                    margin-top: auto;
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
                    padding: ${isMobile ? '30px 20px' : '40px'};
                    background: #1e293b;
                    border-radius: 15px;
                    color: #94a3b8;
                    border: 2px dashed #475569;
                    margin: ${isMobile ? '10px 0' : '20px 0'};
                ">
                    <div style="font-size: ${isMobile ? '40px' : '48px'}; margin-bottom: 15px;">🏪</div>
                    <h3 style="color: #cbd5e1; margin-bottom: 10px; font-size: ${isMobile ? '16px' : '18px'};">Маркет пуст</h3>
                    <p style="font-size: ${isMobile ? '13px' : '14px'};">Другие игроки еще не выставили карты на продажу</p>
                    <p style="margin-top: 20px; font-size: ${isMobile ? '12px' : '14px'}; color: #64748b;">
                        Будьте первым - выставьте свою карту!
                    </p>
                </div>
            `;
            return;
        }
        
        const gridColumns = isMobile ? 'repeat(auto-fill, minmax(140px, 1fr))' : 'repeat(auto-fill, minmax(180px, 1fr))';
        const cardHeight = isMobile ? '120px' : '140px';
        
        container.innerHTML = `
            <div class="cards-grid" style="
                display: grid;
                grid-template-columns: ${gridColumns};
                gap: ${isMobile ? '10px' : '15px'};
                width: 100%;
            ">
                ${otherListings.map(listing => {
                    const canBuy = userData.balance >= listing.price;
                    const cardImage = Utils.createCardImage(listing.cardId, 'card-image', '100%', cardHeight);
                    
                    return `
                    <div class="card-item ${listing.rarity}" 
                         style="
                            background: #1e293b;
                            border-radius: 10px;
                            padding: ${isMobile ? '10px' : '12px'};
                            text-align: center;
                            border: 2px solid ${Utils.getRarityColor(listing.rarity)};
                            transition: transform 0.3s;
                            display: flex;
                            flex-direction: column;
                            justify-content: space-between;
                         ">
                        ${cardImage.outerHTML}
                        <div style="margin: ${isMobile ? '8px 0' : '10px 0'}; flex-grow: 1;">
                            <div style="font-weight: bold; font-size: ${isMobile ? '13px' : '14px'}; margin-bottom: 5px;">
                                Карта #${listing.cardId}
                            </div>
                            <div style="
                                color: ${Utils.getRarityColor(listing.rarity)};
                                font-size: ${isMobile ? '11px' : '12px'};
                                font-weight: bold;
                                background: rgba(0,0,0,0.3);
                                padding: 3px 8px;
                                border-radius: 20px;
                                display: inline-block;
                                margin-bottom: 5px;
                            ">
                                ${listing.rarity?.toUpperCase() || 'COMMON'}
                            </div>
                            <div style="font-size: ${isMobile ? '11px' : '12px'}; color: #94a3b8;">
                                Продавец: ${listing.sellerName || 'Игрок'}
                            </div>
                        </div>
                        <div style="
                            background: rgba(34, 197, 94, 0.1);
                            border-radius: 8px;
                            padding: ${isMobile ? '8px' : '10px'};
                            margin: ${isMobile ? '8px 0' : '10px 0'};
                        ">
                            <div style="font-size: ${isMobile ? '11px' : '12px'}; color: #94a3b8;">Цена:</div>
                            <div style="
                                color: #22c55e;
                                font-weight: bold;
                                font-size: ${isMobile ? '18px' : '20px'};
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
                                    padding: ${isMobile ? '10px' : '12px'};
                                    border-radius: 6px;
                                    cursor: ${canBuy ? 'pointer' : 'not-allowed'};
                                    font-size: ${isMobile ? '13px' : '14px'};
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