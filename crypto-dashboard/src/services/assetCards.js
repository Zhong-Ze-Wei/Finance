// assetCards.js - 统一卡片数据管理
// 管理所有资产卡片的增删改查和持久化

const STORAGE_KEY = 'asset_cards';

// ========== 提醒条件类型定义 ==========
// 支持的提醒条件类型
export const ALERT_TYPES = {
    PRICE_ABOVE: { id: 'price_above', label: '价格突破上限', icon: '📈', description: '当价格 ≥ 目标价时触发' },
    PRICE_BELOW: { id: 'price_below', label: '价格跌破下限', icon: '📉', description: '当价格 ≤ 目标价时触发' },
    CHANGE_UP: { id: 'change_up', label: '24h涨幅超过', icon: '🚀', description: '24h涨幅 ≥ 阈值时触发' },
    CHANGE_DOWN: { id: 'change_down', label: '24h跌幅超过', icon: '💥', description: '24h跌幅 ≤ 阈值时触发' },
    VOLATILITY: { id: 'volatility', label: '剧烈波动', icon: '⚡', description: '短期价格波动超过阈值' },
    RSI_OVERBOUGHT: { id: 'rsi_overbought', label: 'RSI超买', icon: '🔥', description: 'RSI ≥ 70 超买区域' },
    RSI_OVERSOLD: { id: 'rsi_oversold', label: 'RSI超卖', icon: '❄️', description: 'RSI ≤ 30 超卖区域' },
    VEGAS_BREAKOUT: { id: 'vegas_breakout', label: 'Vegas通道突破', icon: '🎰', description: '价格突破EMA144/169通道' }
};

// 默认提醒配置
const DEFAULT_ALERT_CONFIG = {
    enabled: false,           // 是否开启提醒
    conditions: [],           // 提醒条件列表
    cooldownMinutes: 240,     // 冷却时间(分钟)，同一条件触发后多久才能再次触发
    lastTriggered: {},        // 记录每个条件的最后触发时间
    dailyLimit: 5,            // 每日提醒上限
    dailyCount: 0,            // 今日已发送数量
    dailyResetDate: null      // 上次重置日期
};

// 默认卡片配置
const DEFAULT_CARDS = [
    {
        id: 'btc_default',
        name: 'BTC',
        symbol: 'BINANCE:BTCUSDT',
        priceSource: 'coingecko',
        priceId: 'bitcoin',
        ohlcSource: 'okx',
        ohlcId: 'BTC-USDT',
        newsKeywords: ['Bitcoin', 'BTC', '比特币'],
        type: 'crypto',
        category: '加密货币',  // 新增：资产分类
        position: {           // 新增：持仓信息
            enabled: false,
            direction: 'long',
            amount: 0,
            entryPrice: 0,
            currency: 'USD'
        },
        alert: { ...DEFAULT_ALERT_CONFIG },  // 新增：提醒配置
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
        category: '加密货币',
        position: {
            enabled: false,
            direction: 'long',
            amount: 0,
            entryPrice: 0,
            currency: 'USD'
        },
        alert: { ...DEFAULT_ALERT_CONFIG },  // 新增：提醒配置
        visible: true,
        order: 1,
        isDefault: true
    }
];

// 推断 TradingView symbol（必须在 getAssetCards 之前定义）
const inferTradingViewSymbol = (card) => {
    const name = card.name?.toUpperCase();
    const type = card.type;
    const ohlcId = card.ohlcId || '';

    // 加密货币
    if (type === 'crypto') {
        return `BINANCE:${name}USDT`;
    }

    // 美股
    if (ohlcId.includes('.') === false && type === 'stock') {
        return `NASDAQ:${name}`;
    }

    // 商品
    if (type === 'commodity') {
        if (name.includes('GOLD') || name === 'XAU') return 'TVC:GOLD';
        if (name.includes('SILVER') || name === 'XAG') return 'TVC:SILVER';
        if (name.includes('OIL') || name.includes('WTI')) return 'TVC:USOIL';
    }

    return '';
};

// 获取所有卡片（带数据迁移逻辑）
export const getAssetCards = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const data = JSON.parse(stored);
            const cards = data.cards || DEFAULT_CARDS;
            // 数据迁移：为旧卡片添加新字段
            return cards.map(card => {
                // 查找默认卡片以获取 symbol（如果当前卡片没有）
                const defaultCard = DEFAULT_CARDS.find(dc => dc.id === card.id || dc.name === card.name);
                return {
                    ...card,
                    // 迁移 symbol：优先使用现有值，否则从默认卡片获取，或根据 name 生成
                    symbol: card.symbol || defaultCard?.symbol || inferTradingViewSymbol(card),
                    category: card.category || mapTypeToCategory(card.type),
                    position: card.position || {
                        enabled: false,
                        direction: 'long',
                        amount: 0,
                        entryPrice: 0,
                        currency: inferCurrency(card)
                    },
                    alert: card.alert || { ...DEFAULT_ALERT_CONFIG }
                };
            });
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
        ohlcSource: cardData.ohlcSource || cardData.priceSource || 'none',
        ohlcId: cardData.ohlcId || cardData.priceId || '',
        newsKeywords: cardData.newsKeywords || [],
        type: cardData.type || 'stock',
        category: cardData.category || mapTypeToCategory(cardData.type || 'stock'),  // 新增
        position: cardData.position || {  // 新增
            enabled: false,
            direction: 'long',
            amount: 0,
            entryPrice: 0,
            currency: cardData.position?.currency || inferCurrency(cardData)
        },
        alert: cardData.alert || { ...DEFAULT_ALERT_CONFIG },  // 新增：提醒配置
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

// ========== 辅助函数：分类映射 ==========
// 将旧的 type 映射到新的 category（用于数据迁移）
const mapTypeToCategory = (type) => {
    const typeMap = {
        'crypto': '加密货币',
        'stock': '美股',  // 默认，后续可通过 symbol 细化
        'etf': 'ETF',
        'forex': '外汇',
        'commodity': '大宗商品'
    };
    return typeMap[type] || '其他';
};

// 根据卡片数据推断计价货币
const inferCurrency = (card) => {
    if (card.ohlcId?.includes('.SS') || card.ohlcId?.includes('.SZ')) return 'CNY';
    if (card.ohlcId?.includes('.HK')) return 'HKD';
    return 'USD';  // 默认美元
};

// ========== 盈亏计算工具函数 ==========
// 计算持仓盈亏 (PnL)
export const calculatePnL = (position, currentPrice) => {
    if (!position.enabled || !currentPrice) return 0;

    const { direction, amount, entryPrice } = position;
    if (direction === 'long') {
        // 做多：(当前价 - 均价) * 数量
        return (currentPrice - entryPrice) * amount;
    } else {
        // 做空：(均价 - 当前价) * 数量
        return (entryPrice - currentPrice) * amount;
    }
};

// 计算当前持仓市值
export const calculatePositionValue = (position, currentPrice) => {
    if (!position.enabled || !currentPrice) return 0;
    return currentPrice * position.amount;
};

// 获取持仓摘要（用于 UI 显示）
export const getPositionSummary = (card, currentPrice) => {
    if (!card.position?.enabled) return null;

    const { direction, amount, entryPrice, currency } = card.position;
    const pnl = calculatePnL(card.position, currentPrice);
    const pnlPercent = entryPrice ? (pnl / (entryPrice * amount)) * 100 : 0;
    const value = calculatePositionValue(card.position, currentPrice);

    return {
        direction,
        amount,
        entryPrice,
        currentPrice,
        pnl,
        pnlPercent,
        value,
        currency,
        isProfit: pnl >= 0
    };
};
