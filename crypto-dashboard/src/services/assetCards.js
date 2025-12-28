// assetCards.js - 统一卡片数据管理
// 管理所有资产卡片的增删改查和持久化

const STORAGE_KEY = 'asset_cards';

// 默认卡片配置
const DEFAULT_CARDS = [
    {
        id: 'btc_default',
        name: 'BTC',
        symbol: 'BINANCE:BTCUSDT',
        priceSource: 'coingecko',     // 价格数据源
        priceId: 'bitcoin',
        ohlcSource: 'okx',             // K线数据源
        ohlcId: 'BTC-USDT',            // K线 API 用的 ID
        newsKeywords: ['Bitcoin', 'BTC', '比特币'],
        type: 'crypto',
        visible: true,
        order: 0,
        isDefault: true
    },
    {
        id: 'eth_default',
        name: 'ETH',
        symbol: 'BINANCE:ETHUSDT',
        priceSource: 'coingecko',
        priceId: 'ethereum',
        ohlcSource: 'okx',
        ohlcId: 'ETH-USDT',
        newsKeywords: ['Ethereum', 'ETH', '以太坊'],
        type: 'crypto',
        visible: true,
        order: 1,
        isDefault: true
    }
];

// 获取所有卡片
export const getAssetCards = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const data = JSON.parse(stored);
            return data.cards || DEFAULT_CARDS;
        }
    } catch (e) {
        console.warn('Failed to load asset cards');
    }
    return [...DEFAULT_CARDS];
};

// 获取可见卡片（按 order 排序）
export const getVisibleCards = () => {
    return getAssetCards()
        .filter(card => card.visible)
        .sort((a, b) => a.order - b.order);
};

// 获取隐藏卡片
export const getHiddenCards = () => {
    return getAssetCards().filter(card => !card.visible);
};

// 保存所有卡片
export const saveAssetCards = (cards) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            version: 1,
            cards: cards
        }));
    } catch (e) {
        console.warn('Failed to save asset cards');
    }
};

// 添加新卡片
export const addAssetCard = (cardData) => {
    const cards = getAssetCards();
    const newCard = {
        id: `${cardData.priceId || cardData.name}_${Date.now()}`,
        name: cardData.name,
        symbol: cardData.symbol,
        priceSource: cardData.priceSource || 'none',
        priceId: cardData.priceId || '',
        ohlcSource: cardData.ohlcSource || cardData.priceSource || 'none',  // K线数据源
        ohlcId: cardData.ohlcId || cardData.priceId || '',                   // K线 API ID
        newsKeywords: cardData.newsKeywords || [],
        type: cardData.type || 'stock',
        visible: true,
        order: cards.length,
        isDefault: false
    };
    cards.push(newCard);
    saveAssetCards(cards);
    return newCard;
};

// 更新卡片
export const updateAssetCard = (cardId, updates) => {
    const cards = getAssetCards();
    const index = cards.findIndex(c => c.id === cardId);
    if (index !== -1) {
        cards[index] = { ...cards[index], ...updates };
        saveAssetCards(cards);
        return cards[index];
    }
    return null;
};

// 删除卡片（默认卡片不可删除，只能隐藏）
export const deleteAssetCard = (cardId) => {
    const cards = getAssetCards();
    const card = cards.find(c => c.id === cardId);
    if (card && card.isDefault) {
        // 默认卡片只隐藏不删除
        return updateAssetCard(cardId, { visible: false });
    }
    const filtered = cards.filter(c => c.id !== cardId);
    saveAssetCards(filtered);
    return true;
};

// 切换卡片可见性
export const toggleCardVisibility = (cardId) => {
    const cards = getAssetCards();
    const card = cards.find(c => c.id === cardId);
    if (card) {
        return updateAssetCard(cardId, { visible: !card.visible });
    }
    return null;
};

// 重新排序卡片
export const reorderCards = (cardIds) => {
    const cards = getAssetCards();
    cardIds.forEach((id, index) => {
        const card = cards.find(c => c.id === id);
        if (card) card.order = index;
    });
    saveAssetCards(cards);
};

// 根据 ID 获取单个卡片
export const getCardById = (cardId) => {
    return getAssetCards().find(c => c.id === cardId);
};

// 重置为默认配置
export const resetToDefault = () => {
    saveAssetCards([...DEFAULT_CARDS]);
};
