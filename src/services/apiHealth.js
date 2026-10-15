// apiHealth.js - API 连通性检测服务
// 为每个外部 API 提供最小化的健康检测

// 带超时的 fetch 封装
const fetchWithTimeout = (url, options = {}, timeout = 10000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(timeoutId));
};

// 每个 API 的检测函数
const HEALTH_CHECKS = {
    coingecko: async () => {
        const res = await fetchWithTimeout('/api/coingecko/ping');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    },

    okx: async () => {
        const res = await fetchWithTimeout('/api/okx/market/ticker?instId=BTC-USDT');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.code !== '0') throw new Error(data.msg || 'OKX API error');
    },

    yahooFinance: async () => {
        const res = await fetchWithTimeout('/api/yahoo/v8/finance/chart/AAPL?interval=1d&range=1d');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.chart?.result) throw new Error('Invalid Yahoo response');
    },

    sinaFinance: async () => {
        const res = await fetchWithTimeout('/api/sina/list=sh600519');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (!text.includes('hq_str_')) throw new Error('Invalid Sina response format');
    },

    googleNews: async () => {
        const res = await fetchWithTimeout('/api/rss/google/search?q=bitcoin&hl=en-US&gl=US&ceid=US:en');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    },

    aiping: async () => {
        // 检测后端 LLM 代理是否可用
        const res = await fetchWithTimeout('/api/llm/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'test', messages: [], max_tokens: 1 })
        });
        // 只要代理能连通就算 OK（401/400 都说明代理在工作）
        if (res.status === 502 || res.status === 503) throw new Error(`代理不可用: HTTP ${res.status}`);
    },

    emailjs: async () => {
        const hasServiceId = !!import.meta.env.VITE_EMAILJS_SERVICE_ID;
        const hasTemplateId = !!import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
        const hasPublicKey = !!import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
        if (!hasServiceId || !hasTemplateId || !hasPublicKey) {
            throw new Error('EmailJS config incomplete');
        }
        try {
            await fetchWithTimeout('https://api.emailjs.com/api/v1.0/account', { method: 'HEAD' });
        } catch (e) {
            throw new Error('EmailJS unreachable');
        }
    },

    tradingview: async () => {
        // S3 CDN 用 no-cors，不抛异常就算通
        await fetchWithTimeout('https://s3.tradingview.com/tv.js', {
            method: 'HEAD',
            mode: 'no-cors'
        });
    }
};

/**
 * 检测单个 API 连通性
 * @param {string} apiKey - HEALTH_CHECKS 中的 key
 * @returns {Promise<{status: 'ok'|'error', latency: number, error?: string}>}
 */
export const checkApiHealth = async (apiKey) => {
    const checkFn = HEALTH_CHECKS[apiKey];
    if (!checkFn) {
        return { status: 'error', latency: 0, error: `Unknown API: ${apiKey}` };
    }

    const start = performance.now();
    try {
        await checkFn();
        return { status: 'ok', latency: Math.round(performance.now() - start) };
    } catch (err) {
        const latency = Math.round(performance.now() - start);
        if (err.name === 'AbortError') {
            return { status: 'error', latency, error: 'Timeout (10s)' };
        }
        return { status: 'error', latency, error: err.message };
    }
};

/**
 * 批量检测所有 API，并发限制为 3
 * @param {(apiKey: string, result: object) => void} onProgress
 * @returns {Promise<Object>}
 */
export const checkAllApiHealth = async (onProgress) => {
    const results = {};
    const keys = Object.keys(HEALTH_CHECKS);
    const batchSize = 3;

    for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        const batchResults = await Promise.all(
            batch.map(async (key) => {
                const result = await checkApiHealth(key);
                if (onProgress) onProgress(key, result);
                return [key, result];
            })
        );
        batchResults.forEach(([key, result]) => { results[key] = result; });
    }

    return results;
};
