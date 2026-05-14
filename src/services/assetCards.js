// assetCards.js - 统一卡片数据管理
// 管理所有资产卡片的增删改查和持久化

import { clearAssetCache } from './api';
import { isLoggedIn } from './authService';
import { fetchCards, syncCards } from './authService';

const STORAGE_KEY = 'asset_cards';
const SERVER_SYNC_KEY = 'asset_cards_last_sync';

// ========== 提醒条件类型定义 ==========
// 支持的提醒条件类型
export const ALERT_TYPES = {
    PRICE_ABOVE: { id: 'price_above', label: '价格突破上限', icon: 'TrendingUp', emoji: '📈', description: '当价格 ≥ 目标价时触发' },
    PRICE_BELOW: { id: 'price_below', label: '价格跌破下限', icon: 'TrendingDown', emoji: '📉', description: '当价格 ≤ 目标价时触发' },
    CHANGE_UP: { id: 'change_up', label: '24h涨幅超过', icon: 'Rocket', emoji: '🚀', description: '24h涨幅 ≥ 阈值时触发' },
    CHANGE_DOWN: { id: 'change_down', label: '24h跌幅超过', icon: 'Zap', emoji: '⚡', description: '24h跌幅 ≤ 阈值时触发' },
    VOLATILITY: { id: 'volatility', label: '剧烈波动', icon: 'Activity', emoji: '🌊', description: '短期价格波动超过阈值' },
    RSI_OVERBOUGHT: { id: 'rsi_overbought', label: 'RSI超买', icon: 'Flame', emoji: '🔥', description: 'RSI ≥ 70 超买区域' },
    RSI_OVERSOLD: { id: 'rsi_oversold', label: 'RSI超卖', icon: 'Snowflake', emoji: '❄️', description: 'RSI ≤ 30 超卖区域' },
    VEGAS_BREAKOUT: { id: 'vegas_breakout', label: 'Vegas通道突破', icon: 'BarChart3', emoji: '📊', description: '价格突破EMA144/169通道' }
};

// ========== 触发模式定义 ==========
// 控制提醒如何触发和重复
export const TRIGGER_MODES = {
    ONCE: {
        id: 'once',
        label: '单次触发',
        icon: 'Target',
        emoji: '🎯',
        description: '触发一次后自动禁用，适合重要价位监控'
    },
    CROSS: {
        id: 'cross',
        label: '穿越触发',
        icon: 'ArrowUpDown',
        emoji: '↕️',
        description: '仅在价格穿越阈值时触发，可重复'
    },
    STEP: {
        id: 'step',
        label: '步长触发',
        icon: 'BarChart3',
        emoji: '📊',
        description: '每变化N元/N%触发一次，持续跟踪趋势'
    }
};

// ========== 快捷模板定义 ==========
// 一键设置常见场景
export const ALERT_PRESETS = {
    ONE_TIME_BREAKOUT: {
        id: 'one_time_breakout',
        label: '一次性突破提醒',
        icon: 'MapPin',
        emoji: '📍',
        description: '价格突破后提醒一次，自动关闭',
        getCondition: (currentPrice, direction = 'above') => ({
            type: direction === 'above' ? 'price_above' : 'price_below',
            value: direction === 'above' ? Math.round(currentPrice * 1.05) : Math.round(currentPrice * 0.95),
            triggerMode: 'once',
            hasTriggered: false
        })
    },
    RANGE_MONITOR: {
        id: 'range_monitor',
        label: '区间监控',
        icon: 'RefreshCw',
        emoji: '🔄',
        description: '跌破→回升→再跌破都提醒',
        getCondition: (currentPrice, direction = 'below') => ({
            type: direction === 'above' ? 'price_above' : 'price_below',
            value: direction === 'above' ? Math.round(currentPrice * 1.03) : Math.round(currentPrice * 0.97),
            triggerMode: 'cross',
            lastPriceAbove: null  // 将在首次检查时初始化
        })
    },
    TREND_TRACKER: {
        id: 'trend_tracker',
        label: '趋势跟踪',
        icon: 'TrendingDown',
        emoji: '📉',
        description: '每跌/涨指定金额提醒一次',
        getCondition: (currentPrice, direction = 'below') => ({
            type: direction === 'above' ? 'price_above' : 'price_below',
            value: direction === 'above' ? Math.round(currentPrice * 1.02) : Math.round(currentPrice * 0.98),
            triggerMode: 'step',
            stepSize: Math.round(currentPrice * 0.01), // 默认1%步长
            lastStepPrice: null  // 上次触发的价格点
        })
    }
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

// 默认卡片配置（未登录时的默认卡片）
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
        category: '加密货币',
        position: {
            enabled: false,
            direction: 'long',
            amount: 0,
            entryPrice: 0,
            currency: 'USD'
        },
        alert: { ...DEFAULT_ALERT_CONFIG },
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
        alert: { ...DEFAULT_ALERT_CONFIG },
        visible: true,
        order: 1,
        isDefault: true
    },
    {
        id: 'apple_default',
        name: 'Apple',
        symbol: 'NASDAQ:AAPL',
        priceSource: 'none',
        priceId: 'apple',
        ohlcSource: 'tv',
        ohlcId: 'NASDAQ:AAPL',
        newsKeywords: ['Apple', 'AAPL', '苹果'],
        type: 'stock',
        category: '美股',
        position: {
            enabled: false,
            direction: 'long',
            amount: 0,
            entryPrice: 0,
            currency: 'USD'
        },
        alert: { ...DEFAULT_ALERT_CONFIG },
        visible: true,
        order: 2,
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
export const getAssetCards = async () => {
    // 如果已登录，尝试从服务器加载
    if (isLoggedIn()) {
        try {
            const serverCards = await fetchCards();
            // 修复：服务器返回了数据（包括空数组），都应该使用服务器数据
            if (serverCards !== null && serverCards !== undefined) {
                // 使用服务器数据并保存到本地
                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    version: 1,
                    cards: serverCards,
                    lastSync: Date.now()
                }));
                return serverCards;
            }
        } catch (error) {
            console.warn('从服务器加载卡片失败，使用本地数据:', error.message);
        }
    }

    // 未登录或服务器加载失败，使用本地数据
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const data = JSON.parse(stored);

            // 如果已登录但本地数据没有同步标记，清除本地数据使用默认卡片
            if (isLoggedIn() && !data.lastSync) {
                console.log('检测到登录但本地数据未同步，重置为默认卡片');
                localStorage.removeItem(STORAGE_KEY);
                return [...DEFAULT_CARDS];
            }

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
export const getVisibleCards = async () => {
    const cards = await getAssetCards();
    return cards
        .filter(card => card.visible)
        .sort((a, b) => a.order - b.order);
};

// 获取隐藏卡片
export const getHiddenCards = async () => {
    const cards = await getAssetCards();
    return cards.filter(card => !card.visible);
};

// 保存所有卡片（本地 + 服务器）
export const saveAssetCards = async (cards) => {
    try {
        // 保存到本地
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            version: 1,
            cards: cards,
            lastSync: isLoggedIn() ? Date.now() : undefined
        }));

        // 如果已登录，同步到服务器
        if (isLoggedIn()) {
            try {
                await syncCards(cards);
                console.log('✅ 卡片已同步到服务器');
            } catch (error) {
                console.error('❌ 同步卡片到服务器失败:', error);
                // 显示错误提示给用户
                alert(`卡片同步到服务器失败: ${error.message}\n\n数据已保存到本地，但可能无法在其他设备上访问。`);
                throw error; // 重新抛出错误，让调用者知道同步失败
            }
        }
    } catch (e) {
        console.error('保存卡片失败:', e);
        throw e;
    }
};

// 添加新卡片
export const addAssetCard = async (cardData) => {
    const cards = await getAssetCards();
    // 修复：计算当前最大的order值，避免重复
    const maxOrder = cards.reduce((max, card) => Math.max(max, card.order || 0), 0);
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
        category: cardData.category || mapTypeToCategory(cardData.type || 'stock'),
        position: cardData.position || {
            enabled: false,
            direction: 'long',
            amount: 0,
            entryPrice: 0,
            currency: cardData.position?.currency || inferCurrency(cardData)
        },
        alert: cardData.alert || { ...DEFAULT_ALERT_CONFIG },
        visible: true,
        order: maxOrder + 1,  // 修复：使用最大order+1，而不是cards.length
        isDefault: false
    };
    cards.push(newCard);
    await saveAssetCards(cards);
    return newCard;
};

// 更新卡片
export const updateAssetCard = async (cardId, updates) => {
    const cards = await getAssetCards();
    const index = cards.findIndex(c => c.id === cardId);
    if (index !== -1) {
        cards[index] = { ...cards[index], ...updates };
        await saveAssetCards(cards);
        return cards[index];
    }
    return null;
};

// 删除卡片（所有卡片都可删除）
export const deleteAssetCard = async (cardId) => {
    const cards = await getAssetCards();
    const cardToDelete = cards.find(c => c.id === cardId);

    // 删除前清理该标的的所有缓存
    if (cardToDelete) {
        clearAssetCache(cardToDelete.name, cardToDelete.newsKeywords || []);
    }

    const filtered = cards.filter(c => c.id !== cardId);
    await saveAssetCards(filtered);
    return true;
};

// 恢复默认资产（BTC/ETH/Apple）
// 如果已存在则跳过，如果被删除则重新添加
export const restoreDefaultAssets = async () => {
    const cards = await getAssetCards();
    let restored = 0;

    DEFAULT_CARDS.forEach(defaultCard => {
        // 检查是否已存在（按 id 或 name 匹配）
        const exists = cards.some(c => c.id === defaultCard.id || c.name === defaultCard.name);
        if (!exists) {
            // 添加到列表末尾
            cards.push({
                ...defaultCard,
                order: cards.length,
                visible: true
            });
            restored++;
        }
    });

    if (restored > 0) {
        await saveAssetCards(cards);
    }

    return restored;
};

// 切换卡片可见性
export const toggleCardVisibility = async (cardId) => {
    const cards = await getAssetCards();
    const card = cards.find(c => c.id === cardId);
    if (card) {
        return await updateAssetCard(cardId, { visible: !card.visible });
    }
    return null;
};

// 重新排序卡片
export const reorderCards = async (cardIds) => {
    const cards = await getAssetCards();
    cardIds.forEach((id, index) => {
        const card = cards.find(c => c.id === id);
        if (card) card.order = index;
    });
    await saveAssetCards(cards);
};

// 根据 ID 获取单个卡片
export const getCardById = async (cardId) => {
    const cards = await getAssetCards();
    return cards.find(c => c.id === cardId);
};

// 重置为默认配置
export const resetToDefault = async () => {
    await saveAssetCards([...DEFAULT_CARDS]);
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
