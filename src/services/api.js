// ============================================
// API Service Layer - Google News RSS + Caching
// ============================================

// ============================================
// LLM 配置管理 (从 llmConfig.js 导入)
// ============================================
import { LLM_PRESETS, getLLMConfig, setLLMConfig, LLM_CONFIG, TAVILY_CONFIG } from './llmConfig.js';
export { LLM_PRESETS, getLLMConfig, setLLMConfig, LLM_CONFIG, TAVILY_CONFIG };

// ============================================
// 缓存工具 (从 cache.js 导入)
// ============================================
import { getCache, setCache, clearAssetCache } from './cache.js';
export { getCache, clearAssetCache };

// ============================================
// Prompt 配置 (从 prompts.js 导入)
// ============================================
import { PROMPTS, getSystemPrompt, PERSONALITY_PRESETS, getPersonalityPreset } from './prompts.js';
export { PROMPTS, getSystemPrompt, PERSONALITY_PRESETS, getPersonalityPreset };

// 实时价格获取 (CoinGecko REST API 轮询)
// @param {Array} assets - 资产列表 [{ priceId: 'bitcoin', name: 'BTC' }, ...]
export const connectBinanceWebSocket = (onMessage, assets = []) => {
    let isActive = true;
    let pollCount = 0;

    // 默认获取 BTC 和 ETH，如果没有传入列表
    const defaultAssets = [
        { priceId: 'bitcoin', name: 'BTC' },
        { priceId: 'ethereum', name: 'ETH' }
    ];

    const targetAssets = assets.length > 0 ? assets : defaultAssets;
    const ids = targetAssets.map(a => a.priceId).filter(id => id).join(',');

    console.log(`🔄 启动价格轮询服务，资产数: ${targetAssets.length}，间隔: 60秒`);

    const fetchPrices = async () => {
        if (!ids) return;

        pollCount++;
        const timeStr = new Date().toLocaleTimeString('zh-CN');

        const cacheKey = `price_cache_${ids}`;
        const cached = getCache(cacheKey);

        // 价格缓存 1 分钟 (针对完全相同的 ID 集合)
        if (cached && Date.now() - JSON.parse(localStorage.getItem(cacheKey)).timestamp < 60000) {
            console.log(`⏱️ [${timeStr}] 价格轮询 #${pollCount}：使用缓存`);
            targetAssets.forEach(asset => {
                const data = cached[asset.priceId];
                if (data) {
                    onMessage({
                        symbol: asset.name,
                        price: data.usd,
                        priceChangePercent: data.usd_24h_change || 0
                    });
                }
            });
            return;
        }

        try {
            console.log(`⏱️ [${timeStr}] 价格轮询 #${pollCount}：正在获取 ${targetAssets.length} 个资产价格...`);

            let data = null;

            // 优先尝试 CoinGecko
            try {
                const response = await fetch(
                    `/api/coingecko/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
                );
                if (response.ok) {
                    data = await response.json();
                }
            } catch (e) {
                console.warn(`⚠️ CoinGecko 失败，尝试 OKX...`);
            }

            // 如果 CoinGecko 失败，尝试 OKX (中国大陆可直连)
            if (!data) {
                const okxData = {};
                for (const asset of targetAssets) {
                    const okxSymbol = OKX_SPOT_SYMBOLS[asset.name?.toUpperCase()];
                    if (okxSymbol) {
                        try {
                            const resp = await fetch(`/api/okx/market/ticker?instId=${okxSymbol}`);
                            const result = await resp.json();
                            if (result.code === '0' && result.data?.[0]) {
                                const ticker = result.data[0];
                                const price = parseFloat(ticker.last);
                                const open24h = parseFloat(ticker.open24h);
                                const change24h = open24h > 0 ? ((price - open24h) / open24h * 100) : 0;
                                okxData[asset.priceId] = { usd: price, usd_24h_change: change24h };
                            }
                        } catch (e) {
                            console.warn(`OKX ticker failed for ${asset.name}`);
                        }
                    }
                }
                if (Object.keys(okxData).length > 0) {
                    data = okxData;
                    console.log(`✅ 使用 OKX 备用源获取价格`);
                }
            }

            if (!data) throw new Error('All price sources failed');

            setCache(cacheKey, data);

            const successCount = targetAssets.filter(a => data[a.priceId]).length;
            console.log(`✅ [${timeStr}] 价格更新成功：${successCount}/${targetAssets.length} 个资产`);

            targetAssets.forEach(asset => {
                const priceData = data[asset.priceId];
                if (priceData) {
                    onMessage({
                        symbol: asset.name,
                        price: priceData.usd,
                        priceChangePercent: priceData.usd_24h_change || 0
                    });
                }
            });
        } catch (error) {
            console.error(`❌ [${timeStr}] 价格获取失败:`, error);
        }
    };

    fetchPrices();
    const interval = setInterval(() => {
        if (isActive) fetchPrices();
    }, 60000);

    return () => {
        console.log('🔄 停止价格轮询服务');
        isActive = false;
        clearInterval(interval);
    };
};

// ============================================
// 多源价格获取 - Yahoo Finance / Sina
// ============================================

// Yahoo Finance API (美股/港股)
export const fetchYahooPrice = async (symbol) => {
    try {
        const response = await fetch(`/api/yahoo/v8/finance/chart/${symbol}?interval=1d&range=1d`);
        if (!response.ok) return null;
        const data = await response.json();

        const quote = data.chart?.result?.[0];
        if (!quote) return null;

        const meta = quote.meta;
        const price = meta.regularMarketPrice;
        const prevClose = meta.chartPreviousClose || meta.previousClose;
        const change24h = prevClose ? ((price - prevClose) / prevClose * 100) : 0;

        return {
            price,
            change24h,
            currency: meta.currency || 'USD'
        };
    } catch (e) {
        console.error('Yahoo price fetch failed:', e);
        return null;
    }
};

// 新浪财经 API (A股)
export const fetchSinaPrice = async (symbol) => {
    try {
        // symbol 格式: sh600519 或 sz000001
        const response = await fetch(`/api/sina/list=${symbol}`, {
            headers: { 'Referer': 'https://finance.sina.com.cn' }
        });
        const text = await response.text();

        // 解析: var hq_str_sh600519="贵州茅台,1850.00,..."
        const match = text.match(/="([^"]+)"/);
        if (!match) return null;

        const parts = match[1].split(',');
        if (parts.length < 4) return null;

        const price = parseFloat(parts[3]); // 当前价
        const prevClose = parseFloat(parts[2]); // 昨收
        const change24h = prevClose ? ((price - prevClose) / prevClose * 100) : 0;

        return {
            price,
            change24h,
            currency: 'CNY'
        };
    } catch (e) {
        console.error('Sina price fetch failed:', e);
        return null;
    }
};

// 统一价格获取接口
export const fetchAssetPrice = async (card) => {
    switch (card.priceSource) {
        case 'yahoo':
            return fetchYahooPrice(card.priceId);
        case 'sina':
            return fetchSinaPrice(card.priceId);
        case 'coingecko':
            // 加密货币通过 WebSocket 获取，这里返回 null
            return null;
        default:
            return null;
    }
};

// ============================================
// 多源 K 线数据获取
// ============================================

// 将通用 interval 转换为 Yahoo 格式
const toYahooInterval = (interval) => {
    // 支持多种格式: '15' / '15m', '60' / '1H', '240' / '4H', 'D' / '1D', 'W' / '1W'
    const map = {
        '15': '15m', '15m': '15m',
        '60': '60m', '1H': '60m',
        '240': '1d', '4H': '1d',
        'D': '1d', '1D': '1d',
        'W': '1wk', '1W': '1wk'
    };
    return map[interval] || '1d';
};

// 将通用 interval 转换为 OKX bar 格式 (OKX 只认 15m/1H/4H/1D/1W)
const toOkxBar = (interval) => {
    const map = {
        '15': '15m', '15m': '15m',
        '60': '1H', '1H': '1H',
        '240': '4H', '4H': '4H',
        'D': '1D', '1D': '1D',
        'W': '1W', '1W': '1W'
    };
    return map[interval] || '1H';
};

// 将通用 interval 转换为 Binance 格式 (Binance 只认 15m/1h/4h/1d/1w)
const toBinanceInterval = (interval) => {
    const map = {
        '15': '15m', '15m': '15m',
        '60': '1h', '1H': '1h',
        '240': '4h', '4H': '4h',
        'D': '1d', '1D': '1d',
        'W': '1w', '1W': '1w'
    };
    return map[interval] || '1h';
};

// Yahoo Finance K 线数据
export const fetchYahooOHLC = async (symbol, interval = '1D', limit = 500) => {
    try {
        const yahooInterval = toYahooInterval(interval);
        // 增加数据范围：日线取5年，小时取6个月，15分取1个月
        const range = yahooInterval === '15m' ? '1mo' :
                      yahooInterval === '60m' ? '6mo' :
                      yahooInterval === '1d' ? '5y' : '2y';

        const response = await fetch(`/api/yahoo/v8/finance/chart/${symbol}?interval=${yahooInterval}&range=${range}`);
        const data = await response.json();

        const result = data.chart?.result?.[0];
        if (!result) return [];

        const timestamps = result.timestamp || [];
        const quote = result.indicators?.quote?.[0] || {};

        return timestamps.map((t, i) => ({
            time: t,  // Yahoo 返回的已经是秒级 Unix 时间戳
            open: quote.open?.[i] || 0,
            high: quote.high?.[i] || 0,
            low: quote.low?.[i] || 0,
            close: quote.close?.[i] || 0,
            volume: quote.volume?.[i] || 0
        })).filter(c => c.open > 0).slice(-limit);
    } catch (e) {
        console.error('Yahoo OHLC fetch failed:', e);
        return [];
    }
};

// 新浪财经 K 线数据 (A股)
export const fetchSinaOHLC = async (symbol, interval = '1D', limit = 200) => {
    try {
        // 新浪 K 线接口: 日线数据
        // 注意：新浪的分钟级数据接口较复杂，这里只实现日线
        const response = await fetch(`/api/sina/list=${symbol}`);

        // 新浪 K 线数据需要不同的接口，这里简化处理
        // 实际应用可能需要使用其他数据源如 Tushare
        console.warn('Sina OHLC: Using simplified daily data');

        // 返回空数组，后续可以接入更完整的 API
        return [];
    } catch (e) {
        console.error('Sina OHLC fetch failed:', e);
        return [];
    }
};

// 统一 K 线数据获取接口 (根据资产类型路由)
export const fetchOHLCByAsset = async (asset, interval = '1H', limit = 500) => {
    if (!asset) {
        console.warn('fetchOHLCByAsset: No asset provided');
        return [];
    }

    const source = asset.ohlcSource || asset.priceSource || 'okx';
    const ohlcId = asset.ohlcId || asset.priceId;

    console.log(`📊 Fetching OHLC from ${source} for ${ohlcId}`);

    switch (source) {
        case 'okx':
        case 'coingecko':
            // 从 ohlcId (如 'DOGE-USDT') 提取币种符号 (如 'DOGE')
            const coinSymbol = ohlcId ? ohlcId.split('-')[0] : asset.name;
            return fetchOHLCData(coinSymbol, interval, limit);
        case 'yahoo':
            return fetchYahooOHLC(ohlcId, interval, limit);
        case 'sina':
            return fetchSinaOHLC(ohlcId, interval, limit);
        case 'tv':
            // TradingView 源降级后用 Yahoo（去掉交易所前缀: 'NASDAQ:AAPL' -> 'AAPL'）
            return fetchYahooOHLC(ohlcId.split(':').pop(), interval, limit);
        default:
            console.warn(`Unknown OHLC source: ${source}`);
            return [];
    }
};

// ============================================
// Google News RSS
// ============================================
export const fetchMultiSourceNews = async (keywordOrArray, dateRangeDays = 30) => {
    // 支持传入单个关键词或关键词数组
    const keywords = Array.isArray(keywordOrArray) ? keywordOrArray : [keywordOrArray];
    const primaryKeyword = keywords[0] || 'crypto';

    const cacheKey = `news_multi_${keywords.join('_')}_${dateRangeDays}`;
    const cached = getCache(cacheKey);
    if (cached) {
        console.log(`✅ Using cached news for ${keywords.join(', ')}`);
        return cached;
    }

    console.log(`📰 Fetching news for keywords: ${keywords.join(', ')}`);

    // 解析单个 RSS 源
    const parseRSS = async (rawQuery, locale) => {
        try {
            // 针对加密货币优化搜索词
            let query = rawQuery;
            if (locale === 'en') {
                if (rawQuery.toLowerCase() === 'bitcoin' || rawQuery === 'BTC') query = 'bitcoin crypto';
                else if (rawQuery.toLowerCase() === 'ethereum' || rawQuery === 'ETH') query = 'ethereum crypto';
            }

            const [hl, gl, ceid] = locale === 'cn'
                ? ['zh-CN', 'CN', 'CN:zh-Hans']
                : ['en-US', 'US', 'US:en'];

            const response = await fetch(`/api/rss/google/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${ceid}`);
            if (!response.ok) return [];

            const text = await response.text();
            const parser = new DOMParser();
            const xml = parser.parseFromString(text, 'text/xml');
            const items = xml.querySelectorAll('item');

            return Array.from(items).slice(0, 30).map((item, idx) => {
                const title = item.querySelector('title')?.textContent || '';
                const source = item.querySelector('source')?.textContent || 'Google News';
                const pubDateStr = item.querySelector('pubDate')?.textContent;
                const pubDate = pubDateStr ? new Date(pubDateStr) : new Date();
                const description = item.querySelector('description')?.textContent || '';

                // 安全的 ID 生成 (避免 btoa 编码失败)
                const safeId = title.slice(0, 20).replace(/[^a-zA-Z0-9一-龥]/g, '').slice(0, 10) || idx;

                return {
                    id: `gn_${locale}_${idx}_${safeId}_${pubDate.getTime()}`,
                    title: title,
                    source: source,
                    publishedAt: pubDate.toISOString(),
                    publishedAtTimestamp: pubDate.getTime(),
                    url: item.querySelector('link')?.textContent,
                    summary: description.replace(/<[^>]+>/g, '').trim(),
                    originalLang: locale === 'cn' ? 'zh' : 'en',
                    keyword: query
                };
            });
        } catch (e) {
            console.error(`Failed to fetch ${locale} news for ${rawQuery}:`, e);
            return [];
        }
    };

    // 免梯子补充源 1: Cointelegraph RSS（英文加密新闻，国内直连）
    const fetchCointelegraph = async () => {
        try {
            const response = await fetch('/api/rss/ct');
            if (!response.ok) return [];
            const text = await response.text();
            const xml = new DOMParser().parseFromString(text, 'text/xml');
            return Array.from(xml.querySelectorAll('item')).slice(0, 30).map((item, idx) => {
                const title = item.querySelector('title')?.textContent || '';
                const pubDateStr = item.querySelector('pubDate')?.textContent;
                const description = item.querySelector('description')?.textContent || '';
                return {
                    id: `ct_${idx}_${title.slice(0, 10)}`,
                    title,
                    source: 'Cointelegraph',
                    publishedAt: pubDateStr ? new Date(pubDateStr).toISOString() : new Date().toISOString(),
                    publishedAtTimestamp: pubDateStr ? new Date(pubDateStr).getTime() : Date.now(),
                    url: item.querySelector('link')?.textContent,
                    summary: description.replace(/<[^>]+>/g, '').trim(),
                    originalLang: 'en',
                    keyword: 'cointelegraph'
                };
            });
        } catch (e) {
            console.warn('Cointelegraph RSS fetch failed:', e.message);
            return [];
        }
    };

    // 免梯子补充源 2: 新浪滚动财经（中文，按关键词过滤标题）
    const fetchSinaRoll = async () => {
        try {
            const response = await fetch('/api/sina/roll/api/roll/get?pageid=153&lid=2516&num=50&page=1');
            if (!response.ok) return [];
            const data = await response.json();
            const list = data.result?.data || [];
            return list.map((item, idx) => ({
                id: `sina_${idx}_${(item.title || '').slice(0, 10)}`,
                title: item.title || '',
                source: '新浪财经',
                publishedAt: new Date(parseInt(item.ctime || 0) * 1000).toISOString(),
                publishedAtTimestamp: parseInt(item.ctime || 0) * 1000,
                url: item.url,
                summary: (item.intro || '').replace(/<[^>]+>/g, '').trim(),
                originalLang: 'zh',
                keyword: '新浪财经'
            }));
        } catch (e) {
            console.warn('Sina roll news fetch failed:', e.message);
            return [];
        }
    };

    // 判断新闻是否匹配资产关键词（Cointelegraph/新浪无搜索接口，拉取后本地过滤）
    const matchesKeyword = (item, kws) => {
        const text = `${item.title} ${item.summary}`.toLowerCase();
        return kws.some(kw => {
            const k = kw.toLowerCase();
            // 英文关键词匹配词根（bitcoin 匹配 bitcoins/bitcoin's）
            const stem = k.replace(/(s|'s)$/, '');
            return stem.length >= 3 && (text.includes(k) || text.includes(stem));
        });
    };

    try {
        // 并行获取所有关键词的中英文新闻 + 免梯子补充源
        const fetchPromises = [];

        for (const kw of keywords.slice(0, 3)) { // 最多取前3个关键词
            fetchPromises.push(parseRSS(kw, 'en'));
            fetchPromises.push(parseRSS(kw, 'cn'));
        }
        fetchPromises.push(fetchCointelegraph().then(items => items.filter(n => matchesKeyword(n, keywords))));
        fetchPromises.push(fetchSinaRoll().then(items => items.filter(n => matchesKeyword(n, keywords))));

        const results = await Promise.all(fetchPromises);
        let allNews = results.flat();

        console.log(`📊 Raw results: ${allNews.length} items`);
        // 打印每种语言的新闻数量用于调试
        const enCount = allNews.filter(n => n.originalLang === 'en').length;
        const cnCount = allNews.filter(n => n.originalLang === 'zh').length;
        console.log(`🇺🇸 EN: ${enCount}, 🇨🇳 CN: ${cnCount}`);

        // 去重：根据标题相似度去重
        const seen = new Set();
        allNews = allNews.filter(n => {
            const key = n.title.slice(0, 40).toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // 过滤：根据用户选择的日期范围过滤新闻
        const startDate = Date.now() - dateRangeDays * 24 * 60 * 60 * 1000;
        const recentNews = allNews.filter(n => n.publishedAtTimestamp >= startDate);

        // 排序：按时间降序（最新在前）
        recentNews.sort((a, b) => b.publishedAtTimestamp - a.publishedAtTimestamp);

        console.log(`✅ Final: ${recentNews.length} items (EN:${recentNews.filter(n => n.originalLang === 'en').length}, CN:${recentNews.filter(n => n.originalLang === 'zh').length})`);
        setCache(cacheKey, recentNews);
        return recentNews;

    } catch (error) {
        console.error('❌ Google News Fetch Error:', error);
        return [];
    }
};

// ============================================
// K线数据 - OKX API (中国大陆可用) + Binance 备用
// 支持不同时间周期: 1m, 5m, 15m, 1H, 4H, 1D 等
// ============================================

// OKX 支持的现货交易对映射
const OKX_SPOT_SYMBOLS = {
    'BTC': 'BTC-USDT',
    'ETH': 'ETH-USDT',
    'LTC': 'LTC-USDT',
    'XRP': 'XRP-USDT',
    'EOS': 'EOS-USDT',
    'BCH': 'BCH-USDT',
    'TRX': 'TRX-USDT',
    'LINK': 'LINK-USDT',
    'DOT': 'DOT-USDT',
    'UNI': 'UNI-USDT',
    'FIL': 'FIL-USDT',
    'AAVE': 'AAVE-USDT',
    'ATOM': 'ATOM-USDT',
    'AVAX': 'AVAX-USDT',
    'ADA': 'ADA-USDT'
};

// Binance 备用 API (用于 OKX 不支持的币种如 DOGE, SOL, SHIB)
// 币种名称到交易对符号的映射
const BINANCE_SYMBOLS = {
    'SOLANA': 'SOL',
    'DOGECOIN': 'DOGE',
    'SHIBA INU': 'SHIB',
    'SHIB': 'SHIB',
    'CARDANO': 'ADA',
    'POLKADOT': 'DOT',
    'CHAINLINK': 'LINK',
    'AVALANCHE': 'AVAX',
    'POLYGON': 'MATIC',
    'UNISWAP': 'UNI',
    'LITECOIN': 'LTC',
    'BITCOIN': 'BTC',
    'ETHEREUM': 'ETH'
};

const fetchBinanceOHLC = async (coin, interval = '1h') => {
    // Binance interval 格式: 1m, 5m, 15m, 1h, 4h, 1d
    const binanceInterval = toBinanceInterval(interval);

    // 将全名转换为符号
    const upperCoin = coin.toUpperCase();
    const symbol = BINANCE_SYMBOLS[upperCoin] || upperCoin;
    const tradingPair = `${symbol}USDT`;

    const response = await fetch(
        `/api/binance/klines?symbol=${tradingPair}&interval=${binanceInterval}&limit=300`
    );

    if (!response.ok) throw new Error(`Binance HTTP ${response.status}`);

    const data = await response.json();

    // Binance klines: [openTime, open, high, low, close, volume, ...]
    return data.map(candle => ({
        time: Math.floor(candle[0] / 1000),
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5])
    }));
};

export const fetchOHLCData = async (coin, interval = '1H') => {
    const cacheKey = `ohlc_${coin}_${interval}`;
    const cached = getCache(cacheKey);
    // 缓存 1分钟
    if (cached && Date.now() - JSON.parse(localStorage.getItem(cacheKey)).timestamp < 60 * 1000) {
        console.log(`✅ Using cached OHLC for ${coin} (${interval})`);
        return cached;
    }

    const upperCoin = coin.toUpperCase();
    const okxInstId = OKX_SPOT_SYMBOLS[upperCoin];

    // 优先尝试 OKX
    if (okxInstId) {
        try {
            const response = await fetch(
                `/api/okx/market/candles?instId=${okxInstId}&bar=${toOkxBar(interval)}&limit=300`
            );

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const result = await response.json();

            if (result.code !== '0') {
                throw new Error(result.msg || 'OKX API Error');
            }

            const data = result.data.reverse().map(candle => ({
                time: Math.floor(parseInt(candle[0]) / 1000),
                open: parseFloat(candle[1]),
                high: parseFloat(candle[2]),
                low: parseFloat(candle[3]),
                close: parseFloat(candle[4]),
                volume: parseFloat(candle[5])
            }));

            console.log(`📊 Fetched ${data.length} ${interval} candles for ${coin} from OKX`);
            setCache(cacheKey, data);
            return data;
        } catch (error) {
            console.warn(`⚠️ OKX failed for ${coin}, trying Binance...`, error.message);
        }
    }

    // Fallback to Binance
    try {
        const data = await fetchBinanceOHLC(coin, interval);
        console.log(`📊 Fetched ${data.length} ${interval} candles for ${coin} from Binance`);
        setCache(cacheKey, data);
        return data;
    } catch (error) {
        console.warn(`⚠️ Binance failed for ${coin}, trying Yahoo Finance...`, error.message);
    }

    // Third fallback: Yahoo Finance (supports crypto like 'DOGE-USD')
    try {
        const yahooSymbol = `${upperCoin}-USD`;
        const data = await fetchYahooOHLC(yahooSymbol, interval);
        if (data && data.length > 0) {
            console.log(`📊 Fetched ${data.length} ${interval} candles for ${coin} from Yahoo`);
            setCache(cacheKey, data);
            return data;
        }
    } catch (error) {
        console.error(`❌ All OHLC sources failed for ${coin}:`, error);
    }

    throw new Error(`Failed to fetch OHLC data for ${coin} from all sources`);
};

// ============================================
// 并发单条新闻分析 (一次10条并发)
// 每条新闻独立调用 LLM，失败不影响其他
// ============================================
export const batchAnalyzeNews = async (newsItems, concurrency = 10) => {
    if (!newsItems || newsItems.length === 0) return [];

    // 过滤已缓存的新闻
    const uncachedItems = [];
    const cachedResults = [];

    for (const item of newsItems) {
        const cacheKey = `analysis_v6_${item.id}`;
        const cached = getCache(cacheKey);
        if (cached) {
            cachedResults.push({ ...item, ...cached, analyzed: true, aiAnalyzed: true });
        } else {
            uncachedItems.push(item);
        }
    }

    if (uncachedItems.length === 0) {
        console.log(`📰 并发分析: 全部 ${newsItems.length} 条新闻命中缓存`);
        return cachedResults;
    }

    console.log(`📰 串行分析: ${cachedResults.length} 条命中缓存, ${uncachedItems.length} 条待分析`);

    // 逐条串行分析（避免 API 限流）
    const newResults = [];
    for (let i = 0; i < uncachedItems.length; i++) {
        console.log(`🔄 分析第 ${i + 1}/${uncachedItems.length} 条...`);
        try {
            const result = await translateAndAnalyzeNews(uncachedItems[i]);
            newResults.push(result);
            if (result.analyzed) {
                console.log(`✅ 第 ${i + 1} 条分析成功`);
            } else {
                console.warn(`⚠️ 第 ${i + 1} 条分析失败，跳过`);
            }
        } catch (err) {
            console.error(`❌ 第 ${i + 1} 条分析异常:`, err.message);
            newResults.push({ ...uncachedItems[i], analyzed: false, aiAnalyzed: false });
        }
    }

    // 合并结果并按原顺序返回
    const allResults = [...cachedResults, ...newResults];
    const resultMap = new Map(allResults.map(r => [r.id, r]));
    return newsItems.map(item => resultMap.get(item.id) || { ...item, analyzed: false });
};

// ============================================
// 小米 API - 初步分析 (列表用) - 增强版 v6
// 支持: 英文翻译、分离情绪类型与强度、AI标识
// 保留单条分析函数以兼容现有代码
// ============================================
export const translateAndAnalyzeNews = async (newsItem) => {
    const cacheKey = `analysis_v6_${newsItem.id}`;
    const cached = getCache(cacheKey);
    if (cached) return { ...newsItem, ...cached, analyzed: true, aiAnalyzed: true };

    try {
        const response = await fetch('/api/llm/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: LLM_CONFIG.model,
                providerId: LLM_CONFIG.providerId,
                reasoning: LLM_CONFIG.reasoning,
                ...(LLM_CONFIG.maxTokens != null && { max_tokens: LLM_CONFIG.maxTokens }),
                messages: [
                    {
                        role: 'system',
                        content: getSystemPrompt('newsAnalysis')
                    },
                    {
                        role: 'user',
                        content: `Title: ${newsItem.title}\nSummary: ${newsItem.summary || 'N/A'}`
                    }
                ],
                temperature: LLM_CONFIG.temperature ?? 0.2
            })
        });

        const contentType = response.headers.get('content-type') || '';
        let rawContent;

        if (contentType.includes('text/event-stream') || contentType.includes('text/stream')) {
            // 后端返回了 SSE 流 — 逐块读取拼接完整内容
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullContent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith('data: ')) continue;
                    const payload = trimmed.slice(6);
                    if (payload === '[DONE]') break;
                    try {
                        const json = JSON.parse(payload);
                        const delta = json.choices?.[0]?.delta?.content;
                        if (delta) fullContent += delta;
                    } catch (e) { /* skip malformed chunk */ }
                }
            }
            rawContent = fullContent;
        } else {
            // 标准 JSON 响应
            const data = await response.json();
            rawContent = data.choices?.[0]?.message?.content;
        }

        if (!rawContent) {
            console.warn('AI 返回空内容');
            return { ...newsItem, analyzed: false, aiAnalyzed: false };
        }
        const jsonStr = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const result = JSON.parse(jsonStr);

        // intensity: 利好/利空的强度 (1-5)，中性为0
        const intensity = result.intensity || 0;

        const analyzedData = {
            title_cn: result.title_cn || newsItem.title,
            summary_cn: result.summary_cn || '',
            summary_one_line: result.summary_cn || '', // 兼容旧字段
            sentiment: result.sentiment || 'neutral',
            sentiment_cn: result.sentiment_label || '中性',
            sentiment_level: intensity, // 使用 intensity 作为 sentiment_level (兼容 UI)
            intensity: intensity,
            is_fud: result.is_fud || false,
            is_hype: result.is_hype || false,
            market_signal: result.market_signal || 'Hold',
            relevance_score: result.relevance_score || 5,
            keywords: result.keywords || []
        };

        localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: analyzedData }));
        return { ...newsItem, ...analyzedData, analyzed: true, aiAnalyzed: true };
    } catch (error) {
        console.error('AI analysis failed:', error);
        return { ...newsItem, analyzed: false, aiAnalyzed: false };
    }
};

// ============================================
// 深度分析 (机构交易员模式 + CoT) - 使用 Tavily 获取全文
// ============================================
export const streamDeepAnalysis = async (newsItem, priceContext, onChunk, signal) => {
    try {
        console.log('🧠 Starting Deep Stream Analysis (Institutional Mode)...');

        // 使用 Tavily 搜索获取文章全文
        let fullContent = null;
        const searchQuery = newsItem.title_cn || newsItem.title;
        if (searchQuery) {
            console.log('🔍 Tavily: Fetching article content...');
            const tavilyResult = await searchTavilyContent(searchQuery, { maxResults: 1 });
            if (tavilyResult?.content) {
                fullContent = tavilyResult.content;
                console.log(`✅ Tavily: Got ${fullContent.length} chars from ${tavilyResult.url}`);
            }
        }

        const contentSection = fullContent
            ? `# Full Article Content\n${fullContent}`
            : `# News Summary (无法获取全文)\n${newsItem.summary || 'N/A'}`;

        const prompt = `
# Context Data
- Target: ${priceContext.symbol}/USDT
- Current Price: $${priceContext.price}
- 24h Change: ${priceContext.change24h}%

# Breaking News
- Title: ${newsItem.title}
- Source: ${newsItem.source}

${contentSection}

# Task: Institutional Event-Driven Analysis
As a Senior Crypto Strategist at a hedge fund, analyze this news impact on the *current price action*.

**Required Thinking Process (内部思考，不用输出):**
1. 这是"炒冷饭"的旧闻吗？
2. 当前价格 ($${priceContext.price}) 是否已经 Price-in 了这个消息？
3. 机构流动性提供者 (LP) 正在做什么？借消息出货还是吸筹？

**Output Format (Markdown, 中文):**

## 🎯 核心观点 (一针见血)
[一句话定性：利好落地变利空 / 情绪恐慌错杀 / 真正的基本面反转]

## 🕵️‍♂️ 深度逻辑拆解
- **消息面**: [分析新闻的真实性、来源权重。这是一个短期炒作还是长期叙事？]
- **资金面**: [当前价格 $${priceContext.price} 处于什么位置？机构是在借消息出货还是吸筹？]

## ⚔️ 交易博弈推演
- **剧本 A (概率 70%)**: [最可能的走势，包含目标位]
- **剧本 B (概率 30%)**: [如果发生反转，标志性信号是什么？]

## 💡 实操建议
- **关键点位**: [结合整数关口给出支撑/压力]
- **操作**: [做多/做空/观望，给出仓位建议]
- **止损**: [明确的止损位置和原因]
`;

        const response = await fetch('/api/llm/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: LLM_CONFIG.model,
                providerId: LLM_CONFIG.providerId,
                reasoning: LLM_CONFIG.reasoning,
                ...(LLM_CONFIG.maxTokens != null && { max_tokens: LLM_CONFIG.maxTokens }),
                messages: [
                    {
                        role: 'system',
                        content: getSystemPrompt('deepAnalysis')
                    },
                    { role: 'user', content: prompt }
                ],
                temperature: LLM_CONFIG.temperature ?? 0.6,
                stream: true
            }),
            signal
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // 保留未完成的行

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;

                const data = trimmed.slice(6);
                if (data === '[DONE]') return;

                try {
                    const json = JSON.parse(data);
                    const content = json.choices[0]?.delta?.content;
                    if (content) {
                        onChunk(content);
                    }
                } catch (e) {
                    // console.warn('SSE Parse Error:', e);
                }
            }
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Stream analysis aborted.');
        } else {
            console.error('Stream analysis failed:', error);
            onChunk("\n\n**[系统错误]** 分析服务连接失败，请检查网络或稍后重试。");
        }
    }
};

export const fetchCryptoNews = fetchMultiSourceNews;
export const analyzeNews = translateAndAnalyzeNews;

// ============================================
// 小米 API - K线智能分析 (教学导师模式)
// ============================================
export const streamChartAnalysis = async (analysisContext, onChunk, signal) => {
    try {
        console.log('🧠 Starting Chart Analysis (Mentor Mode)...');

        const { symbol, currentPrice, vegas, rsi, atr, recentCandles, timestamp, assetType, assetName } = analysisContext;

        // 根据资产类型确定货币符号和术语
        const isCrypto = assetType === 'crypto';
        const isAShare = assetType === 'stock' && (symbol?.startsWith('SSE') || symbol?.startsWith('SZSE'));
        const currencySymbol = isAShare ? '¥' : '$';
        const pairSuffix = isCrypto ? '/USDT' : '';
        const displayName = assetName || symbol;

        // 预计算状态
        const trendState = parseFloat(currentPrice) > parseFloat(vegas?.ema144 || 0)
            ? "📈 多头趋势 (价格在通道上方)"
            : "📉 空头趋势 (价格在通道下方)";
        const distanceState = Math.abs(parseFloat(vegas?.distancePercent || 0)) > 5
            ? "⚠️ 乖离过大，回调风险增加"
            : "✅ 接近通道，适合寻找机会";
        const rsiState = parseFloat(rsi?.current || 50) > 70
            ? "🔥 超买区，追高风险大"
            : parseFloat(rsi?.current || 50) < 30
                ? "❄️ 超卖区，关注抄底机会"
                : "⚖️ 健康区间";

        const prompt = `
# 市场快照
- 时间: ${timestamp}
- 标的: ${displayName}${pairSuffix}
- 现价: **${currencySymbol}${currentPrice}**

# 技术指标 (已预计算)
| 指标 | 数值 | 状态 |
|------|------|------|
| Vegas 通道 | EMA144=${currencySymbol}${vegas?.ema144}, EMA169=${currencySymbol}${vegas?.ema169} | ${trendState} |
| EMA 12 过滤线 | ${currencySymbol}${vegas?.ema12 || 'N/A'} | ${distanceState} |
| RSI(14) | ${rsi?.current || 'N/A'} | ${rsiState} |
| ATR 波动率 | ${atr?.description || 'N/A'} |

${rsi?.divergenceDesc ? `⚠️ **背离信号**: ${rsi.divergenceDesc}` : ''}

# 近期 K 线
${recentCandles}

---

# 你的任务：实战派交易导师
你正在教一个新手看盘，他容易冲动。请用**生动易懂**的语言分析，**关键建议必须加粗**！

# 请按以下结构输出 (Markdown):

## 📢 导师的一句话总结
[明确告诉学生：**"大胆冲"** / **"分批买"** / **"剁手观望"**，附上 1-5 星信心指数]

## 🧐 盘面诊断

### 趋势分析 (Vegas 通道)
- 当前状态: ${trendState}
- 结合 EMA 12/144/169，用通俗的话解释价格位置意味着什么
- *(话术示例: "你看，现在价格稳稳站在黄线上方，大方向是涨的...")*

### 动能分析 (RSI)
- 当前 RSI: ${rsi?.current} (${rsiState})
- 解释这意味着什么，是否存在背离

### K 线形态
- 分析最近几根 K 线：是放量突破、缩量震荡还是见顶信号？

## 🛑 交易计划 (If-Then)

### 做多条件
- **入场区间**: [具体价格区间，**加粗**]
- **止损位置**: [具体价格，**加粗**，解释为什么设在这里]
- **目标位**: [TP1 / TP2，**加粗**]

### 做空条件
- 什么信号出现才考虑做空？**加粗**标注关键价格

## 🧘 心态按摩
[针对当前 ${rsiState} 状态，一句话提醒新手避免 FOMO 或恐慌]
`;

        const response = await fetch('/api/llm/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: LLM_CONFIG.model,
                providerId: LLM_CONFIG.providerId,
                reasoning: LLM_CONFIG.reasoning,
                ...(LLM_CONFIG.maxTokens != null && { max_tokens: LLM_CONFIG.maxTokens }),
                messages: [
                    {
                        role: 'system',
                        content: getSystemPrompt('chartAnalysis')
                    },
                    { role: 'user', content: prompt }
                ],
                temperature: LLM_CONFIG.temperature ?? 0.6,
                stream: true
            }),
            signal
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;

                const data = trimmed.slice(6);
                if (data === '[DONE]') return;

                try {
                    const json = JSON.parse(data);
                    const content = json.choices[0]?.delta?.content;
                    if (content) {
                        onChunk(content);
                    }
                } catch (e) {
                    // SSE parse error, skip
                }
            }
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Chart analysis aborted.');
        } else {
            console.error('Chart analysis failed:', error);
            onChunk("\n\n**[系统错误]** 分析服务连接失败，请检查网络或稍后重试。");
        }
    }
};

// ============================================
// Tavily API - 新闻全文搜索与内容提取
// 用于获取新闻原文，提升分析质量
// ============================================

/**
 * 使用 Tavily 搜索新闻原文
 * @param {string} query - 搜索关键词（新闻标题或关键内容）
 * @param {object} options - 搜索选项
 * @returns {Promise<{content: string, url: string}|null>} - 返回文章内容和URL
 */
export const searchTavilyContent = async (query, options = {}) => {
    const cacheKey = `tavily_${btoa(unescape(encodeURIComponent(query))).slice(0, 32)}`;
    const cached = getCache(cacheKey);
    if (cached) {
        console.log('✅ Using cached Tavily content');
        return cached;
    }

    try {
        console.log('🔍 Tavily searching:', query.slice(0, 50) + '...');

        const response = await fetch('/api/tavily/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: query,
                search_depth: options.deep ? 'advanced' : 'basic',
                include_answer: false,
                include_raw_content: true,
                max_results: options.maxResults || 3,
                include_domains: options.domains || [],
                exclude_domains: ['twitter.com', 'x.com', 'reddit.com']
            })
        });

        if (!response.ok) {
            throw new Error(`Tavily HTTP ${response.status}`);
        }

        const data = await response.json();
        const results = data.results || [];

        if (results.length === 0) {
            console.log('⚠️ Tavily: No results found');
            return null;
        }

        // 取第一个最相关的结果
        const bestResult = results[0];
        const content = bestResult.raw_content || bestResult.content || '';

        // 限制内容长度
        const trimmedContent = content.slice(0, 6000);

        const result = {
            content: trimmedContent,
            url: bestResult.url,
            title: bestResult.title,
            score: bestResult.score
        };

        setCache(cacheKey, result);
        console.log(`✅ Tavily: Found ${trimmedContent.length} chars from ${bestResult.url}`);

        return result;
    } catch (error) {
        console.error('❌ Tavily search failed:', error);
        return null;
    }
};

/**
 * 批量获取新闻全文（使用 Tavily）
 * 仅对高强度新闻（intensity >= threshold）获取全文
 * @param {Array} newsItems - 新闻列表
 * @param {number} intensityThreshold - 强度阈值，默认4
 * @returns {Promise<Array>} - 带全文的新闻列表
 */
export const enrichNewsWithFullContent = async (newsItems, intensityThreshold = 4) => {
    const highIntensityNews = newsItems.filter(n => (n.intensity || 0) >= intensityThreshold);

    if (highIntensityNews.length === 0) {
        return newsItems;
    }

    console.log(`📰 Enriching ${highIntensityNews.length} high-intensity news with Tavily...`);

    const enrichedMap = new Map();

    // 并行获取，但限制并发数为3
    const batchSize = 3;
    for (let i = 0; i < highIntensityNews.length; i += batchSize) {
        const batch = highIntensityNews.slice(i, i + batchSize);
        const results = await Promise.all(
            batch.map(async (news) => {
                // 使用标题作为搜索关键词
                const searchQuery = news.title_cn || news.title;
                const tavilyResult = await searchTavilyContent(searchQuery, { maxResults: 1 });

                if (tavilyResult?.content) {
                    return {
                        id: news.id,
                        fullContent: tavilyResult.content,
                        sourceUrl: tavilyResult.url
                    };
                }
                return { id: news.id, fullContent: null };
            })
        );

        results.forEach(r => {
            if (r.fullContent) {
                enrichedMap.set(r.id, r);
            }
        });
    }

    // 合并全文到原始新闻
    return newsItems.map(news => {
        const enriched = enrichedMap.get(news.id);
        if (enriched) {
            return { ...news, fullContent: enriched.fullContent, sourceUrl: enriched.sourceUrl };
        }
        return news;
    });
};

