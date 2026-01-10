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
let saveTimeout = null;

// Инициализация Telegram WebApp
try {
    tg = window.Telegram?.WebApp;
    if (tg) {
        console.log('✅ Telegram WebApp обнаружен');
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
let isInitialized = false;

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
            console.log('💾 Начало сохранения данных...');
            
            // 1. Сохраняем локально
            const dataToSave = {
                ...data,
                lastSync: Date.now(),
                deviceId: this.getDeviceId(),
                username: username
            };
            
            localStorage.setItem(this.getStorageKey(), JSON.stringify(dataToSave));
            console.log('✅ Данные сохранены локально');
            
            // 2. Сохраняем на сервер для синхронизации
            let savedToServer = false;
            try {
                savedToServer = await API.saveUserData(dataToSave);
                console.log(savedToServer ? '✅ Данные сохранены на сервере' : '⚠️ Не удалось сохранить на сервере');
            } catch (serverError) {
                console.warn('⚠️ Сервер недоступен для сохранения:', serverError.message);
            }
            
            // 3. Если есть Telegram, сохраняем в Cloud Storage
            if (window.Telegram?.WebApp?.CloudStorage) {
                try {
                    await this.saveToTelegramCloud(dataToSave);
                    console.log('✅ Данные сохранены в Telegram Cloud');
                } catch (cloudError) {
                    console.warn('⚠️ Ошибка сохранения в Telegram Cloud:', cloudError.message);
                }
            }
            
            return savedToServer || true;
        } catch (error) {
            console.error('❌ Ошибка сохранения:', error);
            return false;
        }
    },
    
    // Загрузка данных (с приоритетом: сервер > Telegram Cloud > localStorage)
    async loadData() {
        try {
            console.log('📥 Начало загрузки данных...');
            let data = null;
            
            // 1. Пробуем загрузить с сервера
            try {
                const serverData = await API.loadUserData();
                if (serverData && Object.keys(serverData).length > 0) {
                    console.log('✅ Данные загружены с сервера');
                    data = serverData;
                    // Сохраняем локально для оффлайн-режима
                    localStorage.setItem(this.getStorageKey(), JSON.stringify(data));
                    return data;
                } else {
                    console.log('🆕 На сервере нет данных пользователя');
                }
            } catch (serverError) {
                console.warn('⚠️ Сервер недоступен для загрузки:', serverError.message);
            }
            
            // 2. Если с сервера не загрузилось, пробуем localStorage
            const localData = localStorage.getItem(this.getStorageKey());
            if (localData) {
                try {
                    data = JSON.parse(localData);
                    console.log('✅ Данные загружены из localStorage');
                } catch (parseError) {
                    console.warn('⚠️ Ошибка парсинга локальных данных:', parseError);
                }
            }
            
            // 3. Если все еще нет данных, создаем начальные
            if (!data) {
                console.log('🆕 Созданы начальные данные');
                data = this.getInitialData();
            }
            
            // 4. Миграция данных если нужно
            data = await this.migrateData(data);
            return data;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки данных:', error);
            return this.getInitialData();
        }
    },
    
    // Сохранение в Telegram Cloud Storage
    async saveToTelegramCloud(data) {
        return new Promise((resolve) => {
            if (!tg?.CloudStorage) {
                resolve(false);
                return;
            }
            
            tg.CloudStorage.setItem(this.getStorageKey(), JSON.stringify(data), (err) => {
                if (!err) {
                    resolve(true);
                } else {
                    console.warn('⚠️ Ошибка сохранения в Telegram Cloud:', err);
                    resolve(false);
                }
            });
        });
    },
    
    // Синхронизация данных между устройствами
    async syncData() {
        try {
            console.log('🔄 Начало синхронизации...');
            
            // Загружаем с сервера (самые свежие данные)
            const serverData = await API.loadUserData();
            const localData = JSON.parse(localStorage.getItem(this.getStorageKey()) || '{}');
            
            let mergedData = localData;
            
            // Если есть данные на сервере, объединяем их с локальными
            if (serverData && Object.keys(serverData).length > 0) {
                console.log('🔄 Объединение данных сервера и локальных');
                
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
                    deviceId: this.getDeviceId(),
                    username: username
                };
                
                // Объединяем карты (убираем дубликаты)
                const allCards = [...(serverData.cards || []), ...(localData.cards || [])];
                const cardMap = new Map();
                allCards.forEach(card => {
                    if (card.id && !cardMap.has(card.id)) {
                        cardMap.set(card.id, card);
                    }
                });
                mergedData.cards = Array.from(cardMap.values());
                console.log(`🃏 Объединено карт: ${mergedData.cards.length}`);
                
                // Берем больший баланс
                mergedData.balance = Math.max(
                    serverData.balance || 0, 
                    localData.balance || 0,
                    mergedData.balance || 0
                );
            }
            
            // Сохраняем объединенные данные везде
            const saved = await this.saveData(mergedData);
            if (saved) {
                console.log('✅ Синхронизация завершена');
            }
            
            return mergedData;
            
        } catch (error) {
            console.error('❌ Ошибка синхронизации:', error);
            return null;
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
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Данные пользователя загружены с сервера');
                return data;
            } else if (response.status === 404) {
                console.log('🆕 Пользователь не найден на сервере');
                return null;
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
                    userId: userId,
                    lastUpdated: new Date().toISOString()
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
            console.warn('⚠️ Не удалось сохранить данные на сервере:', error.message);
            return false;
        }
    },
    
    // Загрузка маркета
    async loadMarket() {
        try {
            console.log('🛒 Загрузка маркета...');
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/market`, {
                headers: { 'Cache-Control': 'no-cache' }
            });
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ Маркет загружен, лотов: ${data.length}`);
                
                // Генерируем 20 карт для демонстрации (если в маркете мало)
                if (data.length < 20) {
                    const generatedListings = this.generateMarketListings(20 - data.length);
                    return [...data, ...generatedListings];
                }
                
                return data;
            } else {
                console.warn(`⚠️ Ошибка загрузки маркета: ${response.status}`);
                // Генерируем демо-данные если сервер недоступен
                return this.generateMarketListings(20);
            }
        } catch (error) {
            console.warn('⚠️ Не удалось загрузить маркет, использую демо-данные:', error.message);
            // Генерируем демо-данные
            return this.generateMarketListings(20);
        }
    },
    
    // Генерация демо-лотков для маркета
    generateMarketListings(count) {
        console.log(`🎲 Генерация ${count} демо-лотков...`);
        const listings = [];
        const sellers = ['Игрок1', 'Игрок2', 'Игрок3', 'Игрок4', 'Игрок5'];
        const rarities = ['common', 'rare', 'epic', 'legendary'];
        const rarityWeights = [40, 30, 20, 10]; // Проценты
        
        for (let i = 0; i < count; i++) {
            // Выбираем редкость с учетом весов
            let rand = Math.random() * 100;
            let rarityIndex = 0;
            for (let j = 0; j < rarityWeights.length; j++) {
                rand -= rarityWeights[j];
                if (rand <= 0) {
                    rarityIndex = j;
                    break;
                }
            }
            
            const cardId = Math.floor(Math.random() * 10) + 1;
            const rarity = rarities[rarityIndex];
            const price = this.calculateCardPrice(rarity, cardId);
            const seller = sellers[Math.floor(Math.random() * sellers.length)];
            
            listings.push({
                id: 'demo_listing_' + Date.now() + '_' + i,
                sellerId: 'demo_seller_' + Math.floor(Math.random() * 1000),
                sellerName: seller,
                cardId: cardId,
                rarity: rarity,
                price: price,
                createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
                isDemo: true
            });
        }
        
        console.log(`✅ Сгенерировано ${listings.length} демо-лотков`);
        return listings;
    },
    
    // Расчет цены карты
    calculateCardPrice(rarity, cardId) {
        const basePrices = {
            common: { min: 10, max: 50 },
            rare: { min: 50, max: 200 },
            epic: { min: 200, max: 800 },
            legendary: { min: 800, max: 2000 }
        };
        
        const priceRange = basePrices[rarity] || basePrices.common;
        let price = priceRange.min + Math.random() * (priceRange.max - priceRange.min);
        
        // Множитель за номер карты (карты с бóльшим номером дороже)
        price *= (1 + (cardId / 20));
        
        // Округляем до кратного 10
        price = Math.round(price / 10) * 10;
        
        return Math.max(10, Math.min(10000, price));
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
            } else {
                console.warn(`⚠️ Ошибка открытия пака: ${response.status}`);
                // Используем локальную генерацию если сервер недоступен
                return this.generateRandomCard();
            }
        } catch (error) {
            console.warn('⚠️ Не удалось открыть пак через API, использую локальную генерацию:', error);
            return this.generateRandomCard();
        }
    },
    
    // Генерация случайной карты (локально)
    generateRandomCard() {
        const cardId = Math.floor(Math.random() * 10) + 1;
        const rarities = ['common', 'common', 'common', 'rare', 'rare', 'epic', 'legendary'];
        const rarity = rarities[Math.floor(Math.random() * rarities.length)];
        
        const card = {
            id: 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            cardId: cardId,
            rarity: rarity,
            name: `Карта #${cardId}`,
            ownerId: userId,
            obtainedAt: new Date().toISOString()
        };
        
        console.log(`🎲 Сгенерирована карта: ${rarity} #${cardId}`);
        return {
            success: true,
            card: card
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
                /* Анимации уведомлений */
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
        const usernameElement = document.getElementById('username');
        const balanceElement = document.getElementById('balance');
        const farmCounter = document.getElementById('farmCounter');
        
        if (usernameElement) {
            usernameElement.textContent = `@${username}`;
        }
        
        if (balanceElement) {
            balanceElement.textContent = `${Utils.formatNumber(userData.balance)} хериков`;
        }
        
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
        if (!container) return;
        
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
                    <button onclick="document.getElementById('openPack')?.click()" 
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
        if (!container) return;
        
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
        
        container.innerHTML = `
            <div class="cards-grid" style="
                display: grid;
                grid-template-columns: ${gridColumns};
                gap: ${isMobile ? '10px' : '15px'};
                width: 100%;
            ">
                ${otherListings.map(listing => {
                    const canBuy = userData.balance >= listing.price;
                    const cardImage = Utils.createCardImage(listing.cardId, 'card-image', '100%', isMobile ? '120px' : '140px');
                    
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
};