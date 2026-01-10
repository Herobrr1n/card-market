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

// Определяем пользователя из Telegram
try {
    tg = window.Telegram?.WebApp;
    if (tg) {
        console.log('Telegram WebApp найден');
        tg.expand();
        tg.ready();
        
        // Получаем данные из Telegram
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
    balance: 100,
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
        img.style.background = '#334155';
        img.style.display = 'block';
        
        const imageUrl = this.getCardImageUrl(cardId);
        img.src = imageUrl;
        
        // Fallback на placeholder
        img.onerror = function() {
            this.onerror = null;
            this.src = `https://via.placeholder.com/${isMobile ? '120x160' : '150x200'}/1e293b/ffffff?text=Card+${cardId}`;
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
        @keyframes rouletteHighlight {
            0%, 100% { transform: scale(1); box-shadow: 0 0 0px #f59e0b; }
            50% { transform: scale(1.1); box-shadow: 0 0 30px #f59e0b; }
        }
        @keyframes rouletteProgress {
            from { width: 0%; }
            to { width: 100%; }
        }
    `;
    document.head.appendChild(style);
}

// ========== ХРАНЕНИЕ И СИНХРОНИЗАЦИЯ ==========
const Storage = {
    getStorageKey() {
        return `card_game_${userId}`;
    },
    
    getDeviceId() {
        let deviceId = localStorage.getItem('device_id');
        if (!deviceId) {
            deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('device_id', deviceId);
        }
        return deviceId;
    },
    
    async saveData() {
        try {
            const dataToSave = {
                ...userData,
                lastSync: new Date().toISOString(),
                deviceId: this.getDeviceId(),
                username: username
            };
            
            // Сохраняем локально
            localStorage.setItem(this.getStorageKey(), JSON.stringify(dataToSave));
            console.log('💾 Данные сохранены локально');
            
            // Сохраняем на сервер
            try {
                await API.saveUserDataToServer(dataToSave);
            } catch (serverError) {
                console.warn('⚠️ Не удалось сохранить на сервер:', serverError.message);
            }
            
            return true;
        } catch (error) {
            console.error('❌ Ошибка сохранения:', error);
            return false;
        }
    },
    
    async loadData() {
        try {
            console.log('📥 Загрузка данных...');
            
            // 1. Пытаемся загрузить с сервера
            let serverData = null;
            try {
                serverData = await API.loadUserDataFromServer();
                if (serverData) {
                    console.log('✅ Данные загружены с сервера');
                }
            } catch (serverError) {
                console.warn('⚠️ Сервер недоступен:', serverError.message);
            }
            
            // 2. Загружаем локальные данные
            const localData = this.loadLocalData();
            
            // 3. Синхронизируем
            let finalData;
            if (serverData && localData) {
                // Синхронизация: берем лучшие значения
                finalData = this.syncData(serverData, localData);
            } else if (serverData) {
                finalData = serverData;
            } else if (localData) {
                finalData = localData;
            } else {
                // Создаем новые данные
                finalData = this.getInitialData();
            }
            
            // 4. Сохраняем синхронизированные данные
            this.saveLocalData(finalData);
            
            return finalData;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки:', error);
            return this.getInitialData();
        }
    },
    
    syncData(serverData, localData) {
        console.log('🔄 Синхронизация данных...');
        
        return {
            // Берем максимальный баланс
            balance: Math.max(
                serverData.balance || 0,
                localData.balance || 0,
                100
            ),
            
            // Объединяем карты
            cards: this.mergeCards(serverData.cards || [], localData.cards || []),
            
            // Берем максимальное количество кликов
            farmStats: {
                totalClicks: Math.max(
                    serverData.farmStats?.totalClicks || 0,
                    localData.farmStats?.totalClicks || 0,
                    0
                )
            },
            
            // Метаданные
            username: username,
            lastSync: new Date().toISOString(),
            deviceId: this.getDeviceId()
        };
    },
    
    mergeCards(serverCards, localCards) {
        const cardMap = new Map();
        
        // Добавляем все карты в Map (по ID)
        [...serverCards, ...localCards].forEach(card => {
            if (card.id) {
                cardMap.set(card.id, card);
            }
        });
        
        return Array.from(cardMap.values());
    },
    
    loadLocalData() {
        try {
            const data = localStorage.getItem(this.getStorageKey());
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('❌ Ошибка загрузки локальных данных:', error);
            return null;
        }
    },
    
    saveLocalData(data) {
        try {
            localStorage.setItem(this.getStorageKey(), JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('❌ Ошибка сохранения локальных данных:', error);
            return false;
        }
    },
    
    getInitialData() {
        return {
            balance: 100,
            cards: [],
            farmStats: { totalClicks: 0 },
            username: username,
            lastSync: new Date().toISOString(),
            deviceId: this.getDeviceId()
        };
    }
};


// ========== РУЛЕТКА (8 СЕКУНД АНИМАЦИЯ) ==========
const Roulette = {
    show() {
        return new Promise((resolve) => {
            const container = document.getElementById('rouletteContainer');
            const rouletteDiv = document.getElementById('roulette');
            const resultText = document.getElementById('resultText');
            const title = document.getElementById('rouletteTitle');
            const closeBtn = document.getElementById('closeRoulette');
            
            // Показываем контейнер
            container.style.display = 'block';
            title.textContent = '🎰 ОТКРЫТИЕ ПАКА';
            resultText.innerHTML = '🎮 <b>ГОТОВИМ РУЛЕТКУ...</b>';
            closeBtn.style.display = 'none';
            
            // Очищаем предыдущую рулетку
            rouletteDiv.innerHTML = '';
            
            // Создаем прогресс-бар
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
            
            // Создаем трек для карточек
            const track = document.createElement('div');
            track.style.cssText = `
                display: flex;
                position: absolute;
                height: 100%;
                align-items: center;
                will-change: transform;
            `;
            
            // Добавляем 40 карточек для плавной анимации
            const totalCards = 40;
            for (let i = 0; i < totalCards; i++) {
                const cardId = (i % 10) + 1;
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
            
            // Запускаем анимацию через 1 секунду
            setTimeout(() => {
                resultText.innerHTML = '🎡 <b>РУЛЕТКА ЗАПУЩЕНА!</b>';
                
                // Выбираем победителя
                const winnerIndex = 25 + Math.floor(Math.random() * 10);
                const winnerCardId = (winnerIndex % 10) + 1;
                const rarities = ['common', 'common', 'rare', 'epic', 'legendary'];
                const rarity = rarities[Math.floor(Math.random() * rarities.length)];
                
                // Рассчитываем позицию для остановки
                const cardWidth = 160 + 30; // ширина карты + margin
                const targetPosition = -(winnerIndex * cardWidth) + (rouletteDiv.offsetWidth / 2) - (cardWidth / 2);
                
                // Запускаем анимацию прогресс-бара
                let progress = 0;
                const progressInterval = setInterval(() => {
                    progress += 1.25; // 100% за 8 секунд (8000ms / 100 = 80ms за 1%)
                    progressFill.style.width = `${Math.min(100, progress)}%`;
                }, 100); // Обновляем каждые 100ms
                
                // Запускаем анимацию рулетки
                track.style.transition = 'transform 8s cubic-bezier(0.2, 0.8, 0.2, 1)';
                track.style.transform = `translateX(${targetPosition}px)`;
                
                // Таймер обратного отсчета
                let secondsLeft = 8;
                const countdownInterval = setInterval(() => {
                    secondsLeft--;
                    if (secondsLeft > 0) {
                        resultText.innerHTML = `⏳ <b>КРУТИМ... ${secondsLeft}С</b>`;
                    }
                }, 1000);
                
                // После 8 секунд показываем результат
                setTimeout(() => {
                    clearInterval(progressInterval);
                    clearInterval(countdownInterval);
                    
                    // Подсвечиваем победившую карту
                    const cards = track.querySelectorAll('.roulette-card');
                    if (cards[winnerIndex]) {
                        const winnerCard = cards[winnerIndex];
                        winnerCard.style.border = '4px solid #f59e0b';
                        winnerCard.style.boxShadow = '0 0 40px #f59e0b';
                        winnerCard.style.animation = 'rouletteHighlight 0.8s infinite alternate';
                        
                        // Анимация прыжка
                        winnerCard.style.transform = 'translateY(-20px)';
                        setTimeout(() => {
                            winnerCard.style.transform = 'translateY(0)';
                            winnerCard.style.transition = 'transform 0.3s';
                        }, 300);
                    }
                    
                    // Создаем выигранную карту
                    const wonCard = {
                        id: 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                        cardId: winnerCardId,
                        rarity: rarity,
                        name: `Карта #${winnerCardId}`,
                        ownerId: userId,
                        obtainedAt: new Date().toISOString()
                    };
                    
                    // Показываем результат с эмодзи
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
                    
                    // Показываем кнопку закрытия
                    closeBtn.style.display = 'inline-block';
                    closeBtn.textContent = '🎴 ЗАБРАТЬ КАРТУ';
                    
                    // Воспроизводим звук победы
                    this.playWinSound();
                    
                    resolve(wonCard);
                    
                }, 8000); // 8 секунд анимации
                
            }, 1000); // Задержка перед стартом
        });
    },
    
    playWinSound() {
        try {
            // Создаем звуковой контекст
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Настройки звука
            oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
            oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
            oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
            
        } catch (e) {
            console.log('Звук не доступен');
        }
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
                    const isDemo = listing.isDemo;
                    
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
                                ${isDemo ? ' <span style="color:#f59e0b">(демо)</span>' : ''}
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

// ========== ОСНОВНЫЕ ФУНКЦИИ (ИСПРАВЛЕННЫЕ) ==========
async function sellCard(cardId) {
    console.log('🛒 Попытка продажи карты:', cardId);
    
    const card = userData.cards.find(c => c.id === cardId);
    if (!card) {
        Utils.showNotification('❌ Карта не найдена!', 'error');
        return;
    }
    
    // Определяем цену в зависимости от редкости
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
        console.log('❌ Продажа отменена пользователем');
        return;
    }
    
    const price = parseInt(priceInput);
    if (isNaN(price) || price < CONFIG.MIN_SELL_PRICE || price > CONFIG.MAX_SELL_PRICE) {
        Utils.showNotification(
            `❌ Цена должна быть от ${CONFIG.MIN_SELL_PRICE} до ${CONFIG.MAX_SELL_PRICE} хериков!`, 
            'error'
        );
        return;
    }
    
    if (!confirm(`🎴 Выставить карту #${card.cardId} на продажу за ${Utils.formatNumber(price)} хериков?\n\nПродавец: @${username}`)) {
        return;
    }
    
    Utils.showNotification('🔄 Создаем лот на маркете...', 'info');
    
    try {
        const listingData = {
            sellerId: userId,
            sellerName: username,
            cardId: card.cardId || card.cardId, // Используем правильное поле
            rarity: card.rarity,
            price: price,
            cardData: card // Отправляем полные данные карты
        };
        
        console.log('📤 Отправляем данные лота:', listingData);
        
        // Создаем лот через API
        const listing = await API.createListing(listingData);
        
        if (listing) {
            // Удаляем карту у пользователя
            const initialCardCount = userData.cards.length;
            userData.cards = userData.cards.filter(c => c.id !== cardId);
            
            console.log(`🗑️ Карта удалена. Было: ${initialCardCount}, стало: ${userData.cards.length}`);
            
            // Добавляем лот в маркет
            listing.isDemo = false; // Помечаем как реальный лот
            marketListings.push(listing);
            
            // Обновляем интерфейс
            UI.displayUserCards();
            UI.displayMarket();
            
            // Сохраняем данные
            await Storage.saveData();
            
            Utils.showNotification(
                `✅ Карта выставлена на маркет за ${Utils.formatNumber(price)} хериков!`, 
                'success'
            );
        } else {
            // Если API не работает, создаем локальный лот
            console.log('⚠️ API недоступен, создаем локальный лот');
            
            const localListing = {
                id: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                sellerId: userId,
                sellerName: username,
                cardId: card.cardId,
                rarity: card.rarity,
                price: price,
                isDemo: false,
                cardData: card
            };
            
            // Удаляем карту у пользователя
            userData.cards = userData.cards.filter(c => c.id !== cardId);
            
            // Добавляем в маркет
            marketListings.push(localListing);
            
            // Обновляем интерфейс
            UI.displayUserCards();
            UI.displayMarket();
            
            // Сохраняем
            await Storage.saveData();
            
            Utils.showNotification(
                `✅ Карта выставлена (офлайн-режим) за ${Utils.formatNumber(price)} хериков!`, 
                'success'
            );
        }
        
    } catch (error) {
        console.error('❌ Ошибка при создании лота:', error);
        Utils.showNotification('❌ Ошибка при выставлении на продажу. Попробуйте позже.', 'error');
    }
}

async function buyMarketCard(listingId) {
    console.log('🛒 Попытка покупки лота:', listingId);
    
    try {
        const listing = marketListings.find(l => l.id === listingId);
        if (!listing) {
            Utils.showNotification('❌ Лот не найден! Возможно, его уже купили.', 'error');
            return;
        }
        
        // Проверяем, не покупаем ли свою же карту
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
        
        // Для демо-лотов - упрощенная покупка
        if (listing.isDemo) {
            if (!confirm(`🛒 Покупка демо-карты #${listing.cardId}\n\nЦена: ${Utils.formatNumber(listing.price)} хериков\n\nЭто демо-лот. Продолжить?`)) {
                return;
            }
            
            Utils.showNotification('🔄 Покупаем демо-карту...', 'info');
            
            // Простая логика для демо
            userData.balance -= listing.price;
            
            // Создаем новую карту
            const newCard = {
                id: 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                cardId: listing.cardId,
                rarity: listing.rarity,
                name: `Карта #${listing.cardId}`,
                ownerId: userId,
                purchasedAt: new Date().toISOString(),
                purchasedFrom: listing.sellerId,
                purchasePrice: listing.price,
                isDemo: true
            };
            
            userData.cards.push(newCard);
            
            // Удаляем лот из маркета
            marketListings = marketListings.filter(l => l.id !== listingId);
            
            // Обновляем интерфейс
            UI.updateProfile();
            UI.displayUserCards();
            UI.displayMarket();
            
            // Сохраняем данные
            await Storage.saveData();
            
            Utils.showNotification(
                `🎉 Вы купили демо-карту #${listing.cardId} за ${Utils.formatNumber(listing.price)} хериков!`, 
                'success'
            );
            
            return;
        }
        
        // Для реальных лотов
        if (!confirm(`🛒 Покупка карты #${listing.cardId}\n\nПродавец: @${listing.sellerName}\nЦена: ${Utils.formatNumber(listing.price)} хериков\n\nПодтверждаете покупку?`)) {
            return;
        }
        
        Utils.showNotification('🔄 Обрабатываем покупку...', 'info');
        
        try {
            const result = await API.buyListing(listingId);
            console.log('Результат покупки с сервера:', result);
            
            if (result && result.success) {
                // Обновляем баланс из ответа сервера
                userData.balance = result.newBalance;
                
                // Добавляем карту из ответа сервера или создаем новую
                const purchasedCard = result.card || {
                    id: 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                    cardId: listing.cardId,
                    rarity: listing.rarity,
                    name: `Карта #${listing.cardId}`,
                    ownerId: userId,
                    purchasedAt: new Date().toISOString(),
                    purchasedFrom: listing.sellerId,
                    purchasePrice: listing.price
                };
                
                userData.cards.push(purchasedCard);
                
                // Удаляем лот из маркета
                marketListings = marketListings.filter(l => l.id !== listingId);
                
            } else if (result && result.error === 'insufficient_funds') {
                Utils.showNotification('❌ Недостаточно средств для покупки!', 'error');
                return;
            } else {
                // Если сервер вернул ошибку, но не связанную с балансом
                throw new Error(result?.error || 'Неизвестная ошибка сервера');
            }
            
        } catch (apiError) {
            console.warn('⚠️ Ошибка API покупки:', apiError);
            
            // Локальная обработка при ошибке API
            Utils.showNotification('⚠️ Сервер недоступен, покупаем локально...', 'warning');
            
            userData.balance -= listing.price;
            
            const localCard = {
                id: 'local_buy_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                cardId: listing.cardId,
                rarity: listing.rarity,
                name: `Карта #${listing.cardId}`,
                ownerId: userId,
                purchasedAt: new Date().toISOString(),
                purchasedFrom: listing.sellerId,
                purchasePrice: listing.price,
                isLocal: true
            };
            
            userData.cards.push(localCard);
            marketListings = marketListings.filter(l => l.id !== listingId);
        }
        
        // Обновляем интерфейс
        UI.updateProfile();
        UI.displayUserCards();
        UI.displayMarket();
        
        // Сохраняем данные
        await Storage.saveData();
        
        Utils.showNotification(
            `🎉 Поздравляем! Вы купили ${listing.rarity} карту #${listing.cardId}!`, 
            'success'
        );
        
    } catch (error) {
        console.error('❌ Критическая ошибка покупки:', error);
        Utils.showNotification(`❌ Ошибка покупки: ${error.message}`, 'error');
    }
}

// ========== API (ИСПРАВЛЕННЫЙ МЕТОД createListing) ==========
const API = {
    // ... остальные методы ...
    
    async createListing(listingData) {
        try {
            console.log('📤 Создание лота на сервере:', listingData);
            
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/market/list`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(listingData)
            });
            
            console.log('📥 Ответ сервера:', response.status, response.statusText);
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ Лот создан:', result);
                return result.listing;
            } else {
                const errorText = await response.text();
                console.error('❌ Ошибка сервера:', errorText);
                return null;
            }
        } catch (error) {
            console.warn('⚠️ Ошибка создания лота (сеть):', error);
            return null;
        }
    },
    
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
                    buyerName: username,
                    listingId: listingId,
                    timestamp: new Date().toISOString()
                })
            });
            
            console.log('📥 Ответ сервера на покупку:', response.status);
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ Результат покупки:', result);
                return result;
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error('❌ Ошибка покупки:', errorData);
                return errorData;
            }
            
        } catch (error) {
            console.error('❌ Ошибка сети при покупке:', error);
            throw error;
        }
    }
};

// ========== ИНИЦИАЛИЗАЦИЯ КНОПОК (ДОБАВЛЕНО) ==========
function initSellButtons() {
    // Динамическое обновление кнопок продажи
    document.addEventListener('click', function(e) {
        if (e.target && e.target.onclick && e.target.onclick.toString().includes('sellCard')) {
            // Кнопка уже имеет обработчик
            return;
        }
    });
}

// Добавляем в initApp
async function initApp() {
    console.log('=== НАЧАЛО ЗАГРУЗКИ ===');
    
    try {
        // 1. Загружаем данные пользователя
        userData = await Storage.loadData();
        
        // 2. Загружаем маркет
        marketListings = await API.loadMarket();
        
        // 3. Обновляем интерфейс
        UI.updateProfile();
        UI.displayUserCards();
        UI.displayMarket();
        
        // 4. Инициализируем кнопки
        initFarmButton();
        initOpenPackButton();
        initCloseRouletteButton();
        initSellButtons(); // Новая функция
        
        // 5. Автосохранение
        setInterval(async () => {
            try {
                await Storage.saveData();
            } catch (error) {
                console.warn('⚠️ Ошибка фоновой синхронизации:', error);
            }
        }, 30000);
        
        window.addEventListener('beforeunload', async () => {
            await Storage.saveData();
        });
        
        console.log('=== ПРИЛОЖЕНИЕ УСПЕШНО ЗАГРУЖЕНО ===');
        
        setTimeout(() => {
            Utils.showNotification(`👋 Добро пожаловать, @${username}!`, 'success');
        }, 1000);
        
    } catch (error) {
        console.error('❌ КРИТИЧЕСКАЯ ОШИБКА:', error);
        Utils.showNotification('⚠️ Приложение загружено в автономном режиме', 'warning');
    }
}

// ========== ЗАГРУЗКА ПРИЛОЖЕНИЯ ==========
async function initApp() {
    console.log('=== НАЧАЛО ЗАГРУЗКИ ===');
    
    try {
        // 1. Загружаем данные пользователя с синхронизацией
        userData = await Storage.loadData();
        console.log('✅ Данные пользователя загружены и синхронизированы');
        
        // 2. Загружаем маркет
        marketListings = await API.loadMarket();
        console.log(`✅ Маркет загружен: ${marketListings.length} лотов`);
        
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
            try {
                await Storage.saveData();
                console.log('💾 Фоновая синхронизация выполнена');
            } catch (error) {
                console.warn('⚠️ Ошибка фоновой синхронизации:', error);
            }
        }, 30000);
        
        // 6. Сохраняем при закрытии вкладки
        window.addEventListener('beforeunload', async () => {
            await Storage.saveData();
        });
        
        console.log('=== ПРИЛОЖЕНИЕ УСПЕШНО ЗАГРУЖЕНО ===');
        
        // Показываем приветствие
        setTimeout(() => {
            Utils.showNotification(`👋 Добро пожаловать, @${username}!\nВаш прогресс синхронизирован.`, 'success');
        }, 1000);
        
    } catch (error) {
        console.error('❌ КРИТИЧЕСКАЯ ОШИБКА:', error);
        Utils.showNotification('⚠️ Приложение загружено в автономном режиме', 'warning');
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