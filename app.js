const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

app.use(cors());
app.use(bodyParser.json());

// Хранилище данных
let marketListings = [];
let users = new Map();

// REST API
app.get('/api/market', (req, res) => {
    res.json(marketListings);
});

app.post('/api/market/list', (req, res) => {
    const listing = {
        id: `listing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...req.body,
        createdAt: new Date().toISOString()
    };
    
    marketListings.unshift(listing);
    
    // Рассылаем всем через WebSocket
    broadcast({
        type: 'new_listing',
        listing: listing
    });
    
    res.json({ success: true, listing });
});

app.post('/api/market/buy', (req, res) => {
    const { listingId, buyerId, buyerName, sellerId, cardId, price } = req.body;
    
    const listingIndex = marketListings.findIndex(l => l.id === listingId);
    if (listingIndex === -1) {
        return res.status(404).json({ error: 'Лот не найден' });
    }
    
    const listing = marketListings[listingIndex];
    
    // Удаляем лот
    marketListings.splice(listingIndex, 1);
    
    // Рассылаем уведомление о продаже
    broadcast({
        type: 'listing_sold',
        listingId,
        buyerId,
        buyerName,
        sellerId,
        cardId,
        price
    });
    
    res.json({ 
        success: true, 
        card: {
            id: `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            cardId: cardId,
            rarity: listing.rarity,
            purchasedAt: new Date().toISOString(),
            purchasedFrom: sellerId,
            purchasePrice: price
        }
    });
});

app.get('/api/user/:id', (req, res) => {
    const userId = req.params.id;
    const userData = {
        balance: 100,
        cards: [],
        farmStats: { totalClicks: 0 },
        username: `user_${userId}`,
        createdAt: new Date().toISOString()
    };
    res.json(userData);
});

app.post('/api/user/:id', (req, res) => {
    res.json({ success: true, message: 'Данные сохранены' });
});

// WebSocket логика
wss.on('connection', (ws, req) => {
    console.log('Новое WebSocket соединение');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'register') {
                // Регистрируем пользователя
                users.set(data.userId, { ws, username: data.username });
                console.log(`Пользователь зарегистрирован: ${data.username}`);
                
                // Отправляем текущий маркет
                ws.send(JSON.stringify({
                    type: 'market_update',
                    listings: marketListings
                }));
            }
            
            // Рассылка другим клиентам
            if (data.type === 'new_listing') {
                broadcast(data, data.listing.sellerId);
            }
            
            if (data.type === 'buy_listing') {
                broadcast({
                    type: 'listing_sold',
                    ...data
                }, data.buyerId);
            }
            
        } catch (error) {
            console.error('Ошибка обработки WebSocket сообщения:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('WebSocket соединение закрыто');
    });
});

function broadcast(data, excludeUserId = null) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            // Ищем пользователя по WebSocket соединению
            let sendToClient = true;
            
            users.forEach((user, userId) => {
                if (user.ws === client && userId === excludeUserId) {
                    sendToClient = false;
                }
            });
            
            if (sendToClient) {
                client.send(JSON.stringify(data));
            }
        }
    });
}

// Запуск сервера
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📡 WebSocket доступен по адресу ws://localhost:${PORT}/ws`);
});