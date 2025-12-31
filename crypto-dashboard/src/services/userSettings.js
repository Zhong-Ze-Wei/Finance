// userSettings.js - 全局用户设置服务
// 存储用户偏好设置（无需登录，使用 localStorage）

const USER_SETTINGS_KEY = 'crypto_dashboard_user_settings';

// ========== 系统配置（只读，不可修改） ==========
export const SYSTEM_CONFIG = {
    // 版本信息
    version: '0.1.1',
    buildDate: '2025-12-31',

    // 数据源 API
    apis: {
        yahooFinance: {
            name: 'Yahoo Finance',
            description: '美股/港股/ETF/期货行情',
            endpoint: 'https://query1.finance.yahoo.com',
            status: 'active'
        },
        sinaFinance: {
            name: '新浪财经',
            description: 'A股实时行情数据',
            endpoint: 'https://hq.sinajs.cn',
            status: 'active'
        },
        coingecko: {
            name: 'CoinGecko',
            description: '加密货币价格数据',
            endpoint: 'https://api.coingecko.com',
            status: 'active'
        },
        binance: {
            name: 'Binance',
            description: '加密货币行情（备用）',
            endpoint: 'https://api.binance.com',
            status: 'active'
        },
        okx: {
            name: 'OKX',
            description: '加密货币行情（备用）',
            endpoint: 'https://www.okx.com',
            status: 'active'
        },
        googleNews: {
            name: 'Google News',
            description: '全球新闻 RSS 源',
            endpoint: 'https://news.google.com/rss',
            status: 'active'
        },
        aiping: {
            name: 'AIPing',
            description: 'AI 分析服务（DeepSeek/GLM/MiniMax/Qwen）',
            endpoint: 'https://www.aiping.cn/api/v1',
            status: 'active'
        },
        xiaomiMimo: {
            name: '小米 Mimo',
            description: 'AI 分析服务（备用）',
            endpoint: 'https://api.xiaomimimo.com',
            status: 'active'
        },
        emailjs: {
            name: 'EmailJS',
            description: '邮件发送服务',
            endpoint: 'https://api.emailjs.com',
            status: 'active'
        },
        tradingview: {
            name: 'TradingView',
            description: '专业 K 线图表',
            endpoint: 'https://s3.tradingview.com',
            status: 'active'
        }
    },

    // 轮询配置
    polling: {
        price: 60,       // 价格轮询（秒）
        news: 300,       // 新闻轮询（秒）
        alerts: 60,      // 提醒检查（秒）
    }
};

// 默认设置
const DEFAULT_SETTINGS = {
    // 用户信息
    nickname: '',

    // 邮箱配置（最多3个）
    emails: [],

    // 系统轮询设置（用户可调整）
    polling: {
        priceInterval: 60,      // 价格刷新间隔（秒）
        newsInterval: 300,      // 新闻刷新间隔（秒）
        alertCheckInterval: 60, // 提醒检查间隔（秒）
    },

    // 新闻设置
    news: {
        refreshInterval: 5,        // 刷新间隔（分钟）
        maxItems: 20,              // 最大显示数量
        showSource: true,          // 显示来源
        showTime: true,            // 显示时间
        autoRefresh: true,         // 自动刷新
    },

    // 价格提醒设置
    alerts: {
        defaultCooldown: 240,      // 默认冷却时间（分钟）
        defaultDailyLimit: 5,      // 默认每日上限
        soundEnabled: false,       // 声音提醒
        browserNotification: false, // 浏览器通知
    },

    // 显示设置
    display: {
        theme: 'dark',             // 主题
        priceDecimals: 2,          // 价格小数位
        percentDecimals: 2,        // 百分比小数位
        compactNumbers: true,      // 紧凑数字格式（1K, 1M）
        timezone: 'Asia/Shanghai', // 时区
        language: 'zh-CN',         // 语言
    },

    // 图表设置
    chart: {
        defaultInterval: 'D',      // 默认时间周期
        showVolume: true,          // 显示成交量
        showIndicators: true,      // 显示指标
    },

    // 上次更新时间
    updatedAt: null,
};

// 获取用户设置
export const getUserSettings = () => {
    try {
        const saved = localStorage.getItem(USER_SETTINGS_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            // 合并默认值（确保新增字段有默认值）
            return deepMerge(DEFAULT_SETTINGS, parsed);
        }
    } catch (e) {
        console.error('Failed to load user settings:', e);
    }
    return { ...DEFAULT_SETTINGS };
};

// 保存用户设置
export const saveUserSettings = (settings) => {
    try {
        const toSave = {
            ...settings,
            updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(toSave));
        console.log('✅ 用户设置已保存');
        return true;
    } catch (e) {
        console.error('Failed to save user settings:', e);
        return false;
    }
};

// 更新部分设置
export const updateUserSettings = (partial) => {
    const current = getUserSettings();
    const updated = deepMerge(current, partial);
    return saveUserSettings(updated);
};

// 获取提醒邮箱列表
export const getAlertEmails = () => {
    const settings = getUserSettings();
    const emails = settings.emails || [];
    // 过滤有效邮箱
    return emails.filter(e => e && e.trim()).slice(0, 3);
};

// 设置提醒邮箱
export const setAlertEmails = (emails) => {
    const validEmails = (Array.isArray(emails) ? emails : [emails])
        .map(e => e.trim())
        .filter(e => e && isValidEmail(e))
        .slice(0, 3);

    return updateUserSettings({ emails: validEmails });
};

// 获取新闻设置
export const getNewsSettings = () => {
    const settings = getUserSettings();
    return settings.news || DEFAULT_SETTINGS.news;
};

// 获取显示设置
export const getDisplaySettings = () => {
    const settings = getUserSettings();
    return settings.display || DEFAULT_SETTINGS.display;
};

// 获取图表设置
export const getChartSettings = () => {
    const settings = getUserSettings();
    return settings.chart || DEFAULT_SETTINGS.chart;
};

// 获取提醒默认设置
export const getAlertDefaults = () => {
    const settings = getUserSettings();
    return settings.alerts || DEFAULT_SETTINGS.alerts;
};

// 获取轮询设置
export const getPollingSettings = () => {
    const settings = getUserSettings();
    return settings.polling || DEFAULT_SETTINGS.polling;
};

// 重置为默认设置
export const resetUserSettings = () => {
    localStorage.removeItem(USER_SETTINGS_KEY);
    return DEFAULT_SETTINGS;
};

// ========== 工具函数 ==========

// 深度合并对象
function deepMerge(target, source) {
    const result = { ...target };
    for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(target[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    }
    return result;
}

// 验证邮箱格式
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export { isValidEmail };
