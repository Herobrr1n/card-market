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
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/user/${userId}`);
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Данные пользователя загружены:', data);
                return data;
            }
        } catch (error) {
            console.warn('⚠️ Не удалось загрузить данные, использую локальные:', error);
        }
        return null;
    },
    
    // Сохранение данных пользователя
    async saveUserData() {
        try {
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/user/${userId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
            if (response.ok) {
                console.log('✅ Данные пользователя сохранены');
                return true;
            }
        } catch (error) {
            console.warn('⚠️ Не удалось сохранить данные:', error);
        }
        return false;
    },
    
    // Загрузка маркета
    async loadMarket() {
        try {
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/market`);
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Маркет загружен:', data);
                return data;
            }
        } catch (error) {
            console.warn('⚠️ Не удалось загрузить маркет:', error);
        }
        return [];
    },
    
    // Создание лота на маркете
    async createListing(cardId, price) {
        try {
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/market/list`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sellerId: userId,
                    sellerName: username,
                    cardId,
                    price
                })
            });
            if (response.ok) {
                console.log('✅ Лот создан');
                return await response.json();
            }
        } catch (error) {
            console.warn('⚠️ Не удалось создать лот:', error);
        }
        return null;
    },
    
    // Покупка карты с маркета
    async buyListing(listingId) {
        try {
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/market/buy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    buyerId: userId,
listingId
                })
            });
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Карта куплена:', data);
                return data;
            }
        } catch (error) {
            console.warn('⚠️ Не удалось купить карту:', error);
        }
        return null;
    },
    
    // Открытие пака
    async openPack() {
        try {
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/open-pack`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Пак открыт:', data);
                return data;
            }
        } catch (error) {
            console.warn('⚠️ Не удалось открыть пак, использую локальную логику:', error);
        }
        
        // Локальная логика если бэкенд недоступен
        return this.generateRandomCard();
    },
    
    // Генерация случайной карты (локально)
    generateRandomCard() {
        const cardId = Math.floor(Math.random() * 10) + 1;
        const rarities = ['common', 'common', 'common', 'rare', 'rare', 'epic', 'legendary'];
        const rarity = rarities[Math.floor(Math.random() * rarities.length)];
        
        return {
            card: {
                id: 'card_' + Date.now() + '_' + Math.random(),
                cardId,
                rarity,
                name: `Карта #${cardId}`,
                ownerId: userId
            },
            success: true
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
        // Пробуем разные пути
        const paths = [
            `images/card${cardId}.png`,
            `./images/card${cardId}.png`,
            `/images/card${cardId}.png`,
            `frontend/images/card${cardId}.png`
        ];
        
        // Возвращаем первый валидный путь
        return paths[0];
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
        
        const imageUrl = this.getCardImageUrl(cardId);
        img.src = imageUrl;
        
        // Fallback если картинка не загрузилась
        img.onerror = () => {
            console.warn(`Картинка card${cardId}.png не найдена, использую placeholder`);
            img.src = `https://via.placeholder.com/150x200/1e293b/ffffff?text=Card+${cardId}`;
            img.onerror = null; // Предотвращаем бесконечный цикл
        };
        
        return img;
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
                    <div style="
                        display: flex;
                        justify-content: center;
                        gap: 10px;
                        color: #64748b;
                        font-size: 12px;
                    ">
                        <div>🎲 Случайная карта</div>
                        <div>⚡ Разные редкости</div>
                        <div>💰 Продавайте на маркете</div>
                    </div>
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
                         style="border-color: ${Utils.getRarityColor(card.rarity)}">
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
                        <div style="display: flex; gap: 8px; margin-top: 10px;">
                            <button onclick="sellCard('${card.id}')" 
                                    style="
                                        flex: 1;
                                        background: #22c55e;
                                        padding: 8px;
                                        font-size: 12px;
                                    ">
                                💰 Продать
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },
    
    // Отображение маркета
    displayMarket() {
        const container = document.getElementById('market');
        
        if (!marketListings || marketListings.length === 0) {
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
                    <p>Здесь будут появляться карты, которые выставляют на продажу другие игроки</p>
            <p style="margin-top: 20px; font-size: 14px; color: #64748b;">
                        Выставьте свою первую карту на продажу!
                    </p>
                </div>
            `;
            return;
        }
        
        // Фильтруем свои лоты (не показываем свои карты на маркете для покупки)
        const otherListings = marketListings.filter(listing => listing.sellerId !== userId);
        
        if (otherListings.length === 0) {
            container.innerHTML = `
                <div style="
                    text-align: center;
                    padding: 30px;
                    background: #1e293b;
                    border-radius: 10px;
                    color: #94a3b8;
                ">
                    <div style="font-size: 36px; margin-bottom: 10px;">👥</div>
                    <p>Другие игроки еще не выставили карты на продажу</p>
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
                ${otherListings.map(listing => `
                    <div class="card-item ${listing.rarity}" 
                         style="border-color: ${Utils.getRarityColor(listing.rarity)}">
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
                                margin-bottom: 8px;
                            ">
                                ${listing.rarity?.toUpperCase() || 'COMMON'}
                            </div>
                            <div style="font-size: 12px; color: #94a3b8; margin-bottom: 5px;">
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
                                    background: #6366f1;
                                    padding: 10px;
                                "
                                ${userData.balance < listing.price ? 'disabled' : ''}>
                            🛒 Купить
                        </button>
                    </div>
                `).join('')}
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
                            id: 'card_' + Date.now() + '_' + Math.random(),
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

// ========== ОСНОВНАЯ ЛОГИКА ==========
const App = {
    // Инициализация
    async init() {
        console.log('=== ЗАГРУЗКА ДАННЫХ ===');
        
        // Загружаем данные пользователя
        const savedData = await API.loadUserData();
        if (savedData) {
            userData = { ...userData, ...savedData };
        }
        
        // Загружаем маркет
        marketListings = await API.loadMarket();
        
        // Обновляем интерфейс
        UI.updateProfile();
        UI.displayUserCards();
        UI.displayMarket();
        
        // Инициализируем кнопки
        this.initButtons();
        
        // Сохраняем данные каждые 30 секунд
     setInterval(() => {
            API.saveUserData();
        }, 30000);
        
        console.log('=== ПРИЛОЖЕНИЕ ЗАПУЩЕНО ===');
    },
    
    // Инициализация кнопок
    initButtons() {
        // Кнопка фарма
        const farmBtn = document.getElementById('farmHeriks');
        if (farmBtn) {
            farmBtn.addEventListener('click', (e) => {
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
            });
        }
        
        // Кнопка открытия пака
        const openPackBtn = document.getElementById('openPack');
        if (openPackBtn) {
            openPackBtn.addEventListener('click', async () => {
                if (isOpeningPack) return;
                
                if (userData.balance < CONFIG.PACK_COST) {
                    alert(`❌ Недостаточно хериков! Нужно ${CONFIG.PACK_COST}, у вас ${userData.balance}`);
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
                    await API.saveUserData();
                    
                } catch (error) {
                    console.error('Ошибка открытия пака:', error);
                    alert('Ошибка при открытии пака');
                } finally {
                    isOpeningPack = false;
                    openPackBtn.disabled = false;
                    openPackBtn.textContent = originalText;
                }
            });
        }
        
        // Кнопка закрытия рулетки
        const closeRouletteBtn = document.getElementById('closeRoulette');
        if (closeRouletteBtn) {
            closeRouletteBtn.addEventListener('click', () => {
                document.getElementById('rouletteContainer').style.display = 'none';
            });
        }
    }
};

// ========== ГЛОБАЛЬНЫЕ ФУНКЦИИ ==========

// Продажа карты
async function sellCard(cardId) {
    const card = userData.cards.find(c => c.id === cardId);
    if (!card) {
        alert('Карта не найдена!');
        return;
    }
    
    // Запрашиваем цену
    const priceInput = prompt(
        `Введите цену продажи для ${card.rarity} карты #${card.cardId}:\n(от ${CONFIG.MIN_SELL_PRICE} до ${CONFIG.MAX_SELL_PRICE} хериков)`,
        card.rarity === 'legendary' ? '1000' :
        card.rarity === 'epic' ? '500' :
        card.rarity === 'rare' ? '200' : '50'
    );
    
    if (!priceInput) return;
    
    const price = parseInt(priceInput);
    if (isNaN(price) || price < CONFIG.MIN_SELL_PRICE || price > CONFIG.MAX_SELL_PRICE) {
        alert(`Цена должна быть от ${CONFIG.MIN_SELL_PRICE} до ${CONFIG.MAX_SELL_PRICE} хериков!`);
        return;
    }
 if (!confirm(`Выставить карту #${card.cardId} на продажу за ${Utils.formatNumber(price)} хериков?`)) {
        return;
    }
    
    // Создаем лот на маркете
    const listing = await API.createListing(card.cardId, price);
    if (listing) {
        // Удаляем карту у пользователя
        userData.cards = userData.cards.filter(c => c.id !== cardId);
        
        // Обновляем интерфейс
        UI.displayUserCards();
        UI.updateProfile();
        
        // Обновляем маркет
        marketListings.push({
            id: listing.id,
            cardId: card.cardId,
            rarity: card.rarity,
            price: price,
            sellerId: userId,
            sellerName: username
        });
        
        UI.displayMarket();
        
        alert(`✅ Карта выставлена на маркет за ${Utils.formatNumber(price)} хериков!`);
    } else {
        alert('❌ Не удалось создать лот на маркете');
    }
}

// Покупка карты с маркета
async function buyMarketCard(listingId) {
    const listing = marketListings.find(l => l.id === listingId);
    if (!listing) {
        alert('Лот не найден!');
        return;
    }
    
    if (userData.balance < listing.price) {
        alert(`❌ Недостаточно хериков! Нужно ${listing.price}, у вас ${userData.balance}`);
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
            id: 'card_' + Date.now() + '_' + Math.random(),
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
        
        alert(`🎉 Вы купили карту #${listing.cardId} за ${Utils.formatNumber(listing.price)} хериков!`);
    } else {
        alert('❌ Не удалось купить карту. Возможно, её уже купили.');
    }
}

// ========== ЗАПУСК ПРИЛОЖЕНИЯ ==========
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== DOM ЗАГРУЖЕН ===');
    App.init();
});
