// ============================================
// API Service Layer - Google News RSS + Caching
// ============================================

// 小米 LLM API 配置 (导出供其他组件复用)
export const LLM_CONFIG = {
    baseUrl: '/api/llm',
    apiKey: 'sk-cxhbevtmhy2tc3de5jth06casv8o8ct3yek5b374owvjnllv',
    model: 'mimo-v2-flash'
};

// ============================================
// 缓存工具
// ============================================
const CACHE_DURATION = 15 * 60 * 1000; // 15分钟缓存

const getCache = (key) => {
    try {
        const item = localStorage.getItem(key);
        if (!item) return null;
        const parsed = JSON.parse(item);
        if (Date.now() - parsed.timestamp > CACHE_DURATION) {
            localStorage.removeItem(key);
            return null;
        }
        return parsed.data;
    } catch (e) {
        return null;
    }
};

const setCache = (key, data) => {
    try {
        localStorage.setItem(key, JSON.stringify({
            timestamp: Date.now(),
            data: data
        }));
    } catch (e) {
        console.warn('Cache access denied');
    }
};

// ============================================
// 实时价格 - CoinGecko API (带缓存)
// ============================================
export const connectBinanceWebSocket = (onMessage) => {
    let isActive = true;

    const fetchPrices = async () => {
        const cacheKey = 'price_cache';
        const cached = getCache(cacheKey);

        // 价格缓存 1 分钟
        if (cached && Date.now() - JSON.parse(localStorage.getItem(cacheKey)).timestamp < 60000) {
            if (cached.bitcoin) onMessage({ symbol: 'BTC', price: cached.bitcoin.usd.toFixed(2), priceChangePercent: cached.bitcoin.usd_24h_change.toFixed(2) });
            if (cached.ethereum) onMessage({ symbol: 'ETH', price: cached.ethereum.usd.toFixed(2), priceChangePercent: cached.ethereum.usd_24h_change.toFixed(2) });
            return;
        }

        try {
            console.log('📊 Fetching Price from CoinGecko...');
            const response = await fetch(
                '/api/coingecko/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true'
            );

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            setCache(cacheKey, data);

            if (data.bitcoin) {
                onMessage({
                    symbol: 'BTC',
                    price: data.bitcoin.usd.toFixed(2),
                    priceChangePercent: (data.bitcoin.usd_24h_change || 0).toFixed(2)
                });
            }

            if (data.ethereum) {
                onMessage({
                    symbol: 'ETH',
                    price: data.ethereum.usd.toFixed(2),
                    priceChangePercent: (data.ethereum.usd_24h_change || 0).toFixed(2)
                });
            }
        } catch (error) {
            console.error('❌ Price Fetch Error:', error);
        }
    };

    fetchPrices();
    const interval = setInterval(() => {
        if (isActive) fetchPrices();
    }, 60000);

    return () => {
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
    const map = { '15m': '15m', '1H': '60m', '4H': '1d', '1D': '1d', '1W': '1wk' };
    return map[interval] || '1d';
};

// Yahoo Finance K 线数据
export const fetchYahooOHLC = async (symbol, interval = '1D', limit = 200) => {
    try {
        const yahooInterval = toYahooInterval(interval);
        const range = yahooInterval === '15m' ? '5d' : yahooInterval === '60m' ? '1mo' : '1y';

        const response = await fetch(`/api/yahoo/v8/finance/chart/${symbol}?interval=${yahooInterval}&range=${range}`);
        const data = await response.json();

        const result = data.chart?.result?.[0];
        if (!result) return [];

        const timestamps = result.timestamp || [];
        const quote = result.indicators?.quote?.[0] || {};

        return timestamps.map((t, i) => ({
            time: t * 1000,
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
export const fetchOHLCByAsset = async (asset, interval = '1H', limit = 200) => {
    if (!asset) {
        console.warn('fetchOHLCByAsset: No asset provided');
        return [];
    }

    const source = asset.ohlcSource || asset.priceSource || 'okx';
    const ohlcId = asset.ohlcId || asset.priceId;

    console.log(`📊 Fetching OHLC from ${source} for ${ohlcId}`);

    switch (source) {
        case 'okx':
            // 使用现有的 OKX API
            return fetchOHLCData(asset.name, interval, limit);
        case 'yahoo':
            return fetchYahooOHLC(ohlcId, interval, limit);
        case 'sina':
            return fetchSinaOHLC(ohlcId, interval, limit);
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

                return {
                    id: `gn_${locale}_${idx}_${btoa(encodeURIComponent(title.slice(0, 30))).slice(0, 15)}`,
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
            console.error(`Failed to fetch ${locale} news for ${query}:`, e);
            return [];
        }
    };

    try {
        // 并行获取所有关键词的中英文新闻
        const fetchPromises = [];

        for (const kw of keywords.slice(0, 3)) { // 最多取前3个关键词
            fetchPromises.push(parseRSS(kw, 'en'));
            fetchPromises.push(parseRSS(kw, 'cn'));
        }

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
// K线数据 - OKX API (中国大陆可用)
// 支持不同时间周期: 1m, 5m, 15m, 1H, 4H, 1D 等
// ============================================
export const fetchOHLCData = async (coin, interval = '1H') => {
    const cacheKey = `ohlc_okx_${coin}_${interval}`;
    const cached = getCache(cacheKey);
    // 缓存 1分钟
    if (cached && Date.now() - JSON.parse(localStorage.getItem(cacheKey)).timestamp < 60 * 1000) {
        console.log(`✅ Using cached OHLC for ${coin} (${interval})`);
        return cached;
    }

    try {
        const instId = coin === 'BTC' ? 'BTC-USDT' : 'ETH-USDT';
        // OKX bar 格式: 1m, 5m, 15m, 30m, 1H, 4H, 1D, 1W
        // 获取 300 根 K 线 (OKX 最大 300)
        const response = await fetch(
            `/api/okx/market/candles?instId=${instId}&bar=${interval}&limit=300`
        );

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = await response.json();

        if (result.code !== '0') {
            throw new Error(result.msg || 'OKX API Error');
        }

        // OKX klines 格式: [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm]
        // 注意: OKX 返回的数据是倒序的 (最新在前)，需要反转
        const data = result.data.reverse().map(candle => ({
            time: Math.floor(parseInt(candle[0]) / 1000), // 时间戳 (毫秒转秒)
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
        console.error('❌ OKX OHLC Fetch Error:', error);
        throw error;
    }
};

// ============================================
// 小米 API - 初步分析 (列表用) - 增强版 v6
// 支持: 英文翻译、分离情绪类型与强度、AI标识
// ============================================
export const translateAndAnalyzeNews = async (newsItem) => {
    const cacheKey = `analysis_v6_${newsItem.id}`;
    const cached = getCache(cacheKey);
    if (cached) return { ...newsItem, ...cached, analyzed: true, aiAnalyzed: true };

    try {
        const response = await fetch(`${LLM_CONFIG.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LLM_CONFIG.apiKey}` },
            body: JSON.stringify({
                model: LLM_CONFIG.model,
                messages: [
                    {
                        role: 'system',
                        content: `你是专业的金融新闻分析师。请分析新闻并返回JSON。

**分析步骤：**
1. 翻译标题和摘要为中文（如果是英文）
2. 判断情绪类型：bullish(利好) / bearish(利空) / neutral(中性)
3. 如果是利好或利空，评估其强度(1-5)；中性则强度为0

**强度评分标准（仅限利好/利空）：**
- 5: 极强 (重大里程碑、监管重大利好/打击、行业颠覆)
- 4: 较强 (重要合作、融资、或重大负面事件)
- 3: 中等 (常规利好/利空消息)
- 2: 较弱 (轻微影响预期)
- 1: 微弱 (边缘相关、影响甚微)

**示例：**
- "比特币ETF获SEC批准" → bullish, intensity=5
- "某交易所小额资金异常" → bearish, intensity=2
- "季度财报符合预期" → neutral, intensity=0
- "公司裁员10%" → bearish, intensity=3

**返回JSON（严格遵守格式）：**
{
  "title_cn": "中文标题",
  "summary_cn": "中文摘要(1-2句)",
  "sentiment": "bullish/neutral/bearish",
  "intensity": 0-5,
  "sentiment_label": "强利好/利好/中性/利空/强利空",
  "is_fud": true/false,
  "is_hype": true/false,
  "market_signal": "Strong Buy/Buy/Hold/Sell/Strong Sell",
  "relevance_score": 1-10,
  "keywords": ["关键词1", "关键词2"]
}`
                    },
                    {
                        role: 'user',
                        content: `Title: ${newsItem.title}\nSummary: ${newsItem.summary || 'N/A'}`
                    }
                ],
                temperature: 0.2
            })
        });

        const data = await response.json();
        const jsonStr = data.choices?.[0]?.message?.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
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
// 小米 API - 深度分析 (机构交易员模式 + CoT)
// ============================================
export const streamDeepAnalysis = async (newsItem, priceContext, onChunk, signal) => {
    try {
        console.log('🧠 Starting Deep Stream Analysis (Institutional Mode)...');

        const prompt = `
# Context Data
- Target: ${priceContext.symbol}/USDT
- Current Price: $${priceContext.price}
- 24h Change: ${priceContext.change24h}%

# Breaking News
- Title: ${newsItem.title}
- Source: ${newsItem.source}
- Content: ${newsItem.summary || 'N/A'}

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

        const response = await fetch(`${LLM_CONFIG.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LLM_CONFIG.apiKey}` },
            body: JSON.stringify({
                model: LLM_CONFIG.model,
                messages: [
                    {
                        role: 'system',
                        content: `你是一位在顶级加密货币对冲基金工作的资深策略师。
你的风格：犀利、直接、不废话。
你的核心价值观：永远站在机构的角度思考，散户思维是你的敌人。
你擅长：识别"利好出尽"和"恐慌错杀"的市场机会。
输出语言：中文。`
                    },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.6,
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

        const response = await fetch(`${LLM_CONFIG.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LLM_CONFIG.apiKey}` },
            body: JSON.stringify({
                model: LLM_CONFIG.model,
                messages: [
                    {
                        role: 'system',
                        content: `你是一位有 10 年经验的加密货币交易导师，精通 Vegas 通道和 RSI 策略。

你的特点：
- 说话接地气，用比喻和举例，不用书面语。
- 分析全面：趋势、动能、K线形态、支撑阻力。
- **所有入场/止损/目标价格必须加粗**，这是硬性要求。
- 永远告诉学生风险在哪里，不要只说利好。
- 输出结构清晰，便于学生快速抓住重点。

输出语言：中文。格式：Markdown。`
                    },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.6,
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

