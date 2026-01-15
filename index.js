const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// ========== ГЛОБАЛЬНОЕ ХРАНИЛИЩЕ (ДЛЯ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ) ==========

// ВСЕ КАРТЫ НА МАРКЕТЕ - ВИДНЫ ВСЕМ ПОЛЬЗОВАТЕЛЯМ!
let globalMarketListings = [
    {
        id: 'listing_1',
        sellerId: 'user_123',
        sellerName: 'Игрок_1',
        cardId: 3,
        cardInstanceId: 'card_123',
        rarity: 'common',
        price: 50,
        createdAt: new Date().toISOString(),
        sold: false,
        status: 'active'
    },
    {
        id: 'listing_2',
        sellerId: 'user_456',
        sellerName: 'Игрок_2',
        cardId: 8,
        cardInstanceId: 'card_456',
        rarity: 'rare',
        price: 200,
        createdAt: new Date().toISOString(),
        sold: false,
        status: 'active'
    }
];

// Пользователи
let users = {};

// ========== API МАРКЕТА (ОБЩИЙ ДЛЯ ВСЕХ) ==========

// GET /api/market - ПОЛУЧИТЬ ВСЕ КАРТЫ С МАРКЕТА (ВИДНЫ ВСЕМ)
app.get('/api/market', (req, res) => {
    console.log('📊 [MARKET] Запрос маркета. Всего карт:', globalMarketListings.length);
    
    // Фильтруем только активные лоты
    const activeListings = globalMarketListings.filter(listing => !listing.sold && listing.status === 'active');
    
    // Сортируем по дате (новые сверху)
    const sortedListings = activeListings.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
    );
    
    res.json(sortedListings);
});

// POST /api/market/list - ВЫСТАВИТЬ КАРТУ НА ОБЩИЙ МАРКЕТ
app.post('/api/market/list', (req, res) => {
    console.log('🛒 [MARKET] Выставление карты на общий маркет:', req.body);
    
    const { sellerId, sellerName, cardId, rarity, price, cardInstanceId } = req.body;
    
    if (!sellerId || !sellerName || !cardId || !rarity || !price) {
        return res.status(400).json({ 
            error: 'Все поля обязательны',
            received: req.body 
        });
    }
    
    // Создаем новый лот
    const newListing = {
        id: `listing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sellerId,
        sellerName,
        cardId: parseInt(cardId),
        cardInstanceId: cardInstanceId || `card_${Date.now()}`,
        rarity,
        price: parseInt(price),
        createdAt: new Date().toISOString(),
        sold: false,
        status: 'active',
        soldTo: null,
        soldAt: null
    };
    
    // ВАЖНО: Добавляем в ГЛОБАЛЬНЫЙ маркет (видят все пользователи)
    globalMarketListings.unshift(newListing);
    
    console.log('✅ [MARKET] Карта добавлена в общий маркет:', newListing);
    console.log('📈 [MARKET] Всего карт на маркете:', globalMarketListings.length);
    
    // Возвращаем успешный ответ
    res.json({ 
        success: true, 
        message: 'Карта успешно выставлена на общий маркет!',
        id: newListing.id,
        listing: newListing
    });
});

// POST /api/market/buy - КУПИТЬ КАРТУ С ОБЩЕГО МАРКЕТА
app.post('/api/market/buy', (req, res) => {
    console.log('💰 [MARKET] Покупка карты с общего маркета:', req.body);
    
    const { listingId, buyerId, buyerName } = req.body;
    
    if (!listingId || !buyerId || !buyerName) {
        return res.status(400).json({ 
            error: 'Недостаточно данных для покупки' 
        });
    }
    
    // Ищем лот в общем маркете
    const listingIndex = globalMarketListings.findIndex(l => l.id === listingId);
    
    if (listingIndex === -1) {
        console.log('❌ [MARKET] Лот не найден:', listingId);
        return res.status(404).json({ 
            error: 'Лот не найден' 
        });
    }
    
    const listing = globalMarketListings[listingIndex];
    
    // Проверяем, не продан ли уже лот
    if (listing.sold || listing.status === 'sold') {
        console.log('❌ [MARKET] Лот уже продан:', listingId);
        return res.status(400).json({ 
            error: 'Карта уже продана' 
        });
    }
    
    // Проверяем, не покупает ли пользователь свою карту
    if (listing.sellerId === buyerId) {
        console.log('❌ [MARKET] Попытка купить свою карту');
        return res.status(400).json({ 
            error: 'Нельзя купить свою карту' 
        });
    }
    
    console.log(`✅ [MARKET] ${buyerName} покупает карту #${listing.cardId} у ${listing.sellerName}`);
    
    // Помечаем карту как проданную
    globalMarketListings[listingIndex].sold = true;
    globalMarketListings[listingIndex].status = 'sold';
    globalMarketListings[listingIndex].soldTo = buyerId;
    globalMarketListings[listingIndex].soldAt = new Date().toISOString();
    
    // Создаем объект купленной карты
    const purchasedCard = {
        id: listing.cardInstanceId,
        cardId: listing.cardId,
        rarity: listing.rarity,
        name: `Карта #${listing.cardId}`,
        purchasedAt: new Date().toISOString(),
        purchasedFrom: listing.sellerId,
        purchasePrice: listing.price,
        previousOwner: listing.sellerName
    };
    
    // Создаем запись о продаже
    const saleRecord = {
        saleId: `sale_${Date.now()}`,
        listingId: listing.id,
        cardId: listing.cardId,
        buyerId: buyerId,
        buyerName: buyerName,
        price: listing.price,
        soldAt: new Date().toISOString()
    };
    
    console.log('✅ [MARKET] Покупка завершена:', saleRecord);
    console.log('📉 [MARKET] Активных лотов осталось:', 
        globalMarketListings.filter(l => !l.sold && l.status === 'active').length);
    
    res.json({ 
        success: true,
        message: 'Покупка успешно завершена! Карта добавлена в вашу коллекцию.',
        purchase: {
            card: purchasedCard,
            price: listing.price,
            seller: {
                id: listing.sellerId,
                name: listing.sellerName
            },
            buyer: {
                id: buyerId,
                name: buyerName
            }
        },
        saleRecord: saleRecord
    });
});

// ========== API ПОЛЬЗОВАТЕЛЯ ==========

// GET /api/user/:id - ПОЛУЧИТЬ ДАННЫЕ ПОЛЬЗОВАТЕЛЯ
app.get('/api/user/:id', (req, res) => {
    const userId = req.params.id;
    console.log('👤 [USER] Запрос пользователя:', userId);
    
    if (users[userId]) {
        res.json(users[userId]);
    } else {
        // Создаем нового пользователя
        const newUser = {
            balance: 100,
            cards: [
                {
                    id: `card_${Date.now()}_1`,
                    cardId: 1,
                    rarity: 'common',
                    name: 'Карта #1',
                    obtainedAt: new Date().toISOString()
                },
                {
                    id: `card_${Date.now()}_2`,
                    cardId: 5,
                    rarity: 'rare',
                    name: 'Карта #5',
                    obtainedAt: new Date().toISOString()
                }
            ],
            farmStats: { totalClicks: 0 },
            username: `user_${userId}`,
            createdAt: new Date().toISOString(),
            lastSeen: new Date().toISOString()
        };
        
        users[userId] = newUser;
        console.log('🆕 [USER] Создан новый пользователь:', userId);
        
        res.json(newUser);
    }
});

// POST /api/user/:id - СОХРАНИТЬ ДАННЫЕ ПОЛЬЗОВАТЕЛЯ
app.post('/api/user/:id', (req, res) => {
    const userId = req.params.id;
    const userData = req.body;
    
    console.log('💾 [USER] Сохранение пользователя:', userId);
    console.log('   Баланс:', userData.balance, 'Карт:', userData.cards ? userData.cards.length : 0);
    
    users[userId] = userData;
    users[userId].lastSeen = new Date().toISOString();
    
    res.json({ 
        success: true, 
        message: 'Данные сохранены',
        timestamp: new Date().toISOString()
    });
});

// ========== СТАТИСТИКА И ТЕСТЫ ==========

// GET /api/stats - СТАТИСТИКА СЕРВЕРА
app.get('/api/stats', (req, res) => {
    const activeListings = globalMarketListings.filter(l => !l.sold && l.status === 'active');
    const soldListings = globalMarketListings.filter(l => l.sold || l.status === 'sold');
    
    res.json({
        market: {
            totalListings: globalMarketListings.length,
            activeListings: activeListings.length,
            soldListings: soldListings.length
        },
        users: {
            totalUsers: Object.keys(users).length
        },
        server: {
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        }
    });
});

// GET /api/test - ТЕСТ СЕРВЕРА
app.get('/api/test', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Сервер маркета работает!',
        time: new Date().toISOString(),
        version: '2.0',
        features: [
            'Общий маркет для всех пользователей',
            'Покупка/продажа карт между пользователями',
            'Автообновление маркета',
            'Глобальное хранилище данных'
        ]
    });
});

// GET /api/market/live - ЖИВОЙ МАРКЕТ (ВСЕ АКТИВНЫЕ КАРТЫ)
app.get('/api/market/live', (req, res) => {
    const activeListings = globalMarketListings
        .filter(l => !l.sold && l.status === 'active')
        .slice(0, 50);
    
    res.json({
        success: true,
        timestamp: new Date().toISOString(),
        count: activeListings.length,
        listings: activeListings
    });
});

// POST /api/market/add-demo - ДОБАВИТЬ ДЕМО-КАРТУ (ТЕСТ)
app.post('/api/market/add-demo', (req, res) => {
    const demoCard = {
        id: `demo_${Date.now()}`,
        sellerId: 'demo_seller',
        sellerName: 'Демо_Продавец',
        cardId: Math.floor(Math.random() * 20) + 1,
        cardInstanceId: `card_demo_${Date.now()}`,
        rarity: ['common', 'rare', 'epic'][Math.floor(Math.random() * 3)],
        price: Math.floor(Math.random() * 500) + 50,
        createdAt: new Date().toISOString(),
        sold: false,
        status: 'active'
    };
    
    globalMarketListings.unshift(demoCard);
    
    res.json({
        success: true,
        message: 'Демо-карта добавлена на общий маркет',
        card: demoCard,
        totalActive: globalMarketListings.filter(l => !l.sold && l.status === 'active').length
    });
});

// ========== ЗАПУСК СЕРВЕРА ==========

app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('🚀 СЕРВЕР ОБЩЕГО МАРКЕТА ЗАПУЩЕН');
    console.log('='.repeat(60));
    console.log(`📡 Порт: ${PORT}`);
    console.log(`🌐 Адрес: http://localhost:${PORT}`);
    console.log('');
    console.log('✅ ОСНОВНЫЕ ЭНДПОИНТЫ:');
    console.log('');
    console.log(`   • http://localhost:${PORT}/api/test      - Тест сервера`);
    console.log(`   • http://localhost:${PORT}/api/market    - Общий маркет карт`);
    console.log(`   • http://localhost:${PORT}/api/stats     - Статистика`);
    console.log(`   • http://localhost:${PORT}/api/user/123  - Тест пользователя`);
    console.log('');
    console.log('🎮 КАК ПРОВЕРИТЬ РАБОТУ МАРКЕТА:');
    console.log('');
    console.log('   1. Откройте два окна браузера (два разных пользователя)');
    console.log('   2. В первом окне продайте карту');
    console.log('   3. Во втором окне обновите маркет (/api/market)');
    console.log('   4. Карта появится у всех пользователей!');
    console.log('');
    console.log('💡 КАК ЭТО РАБОТАЕТ:');
    console.log('   • Все карты хранятся в globalMarketListings');
    console.log('   • Все пользователи видят одни и те же карты');
    console.log('   • При продаже карта удаляется у продавца');
    console.log('   • При покупке карта переходит покупателю');
    console.log('');
    console.log('='.repeat(60));
    console.log('✅ СЕРВЕР ГОТОВ!');
    console.log('='.repeat(60));
});