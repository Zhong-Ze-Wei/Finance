// ============================================
// API Service Layer - Google News RSS + Caching
// ============================================

// 小米 LLM API 配置
const LLM_CONFIG = {
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
// Google News RSS
// ============================================
export const fetchMultiSourceNews = async (coin) => {
    const cacheKey = `news_google_${coin}`;
    const cached = getCache(cacheKey);
    if (cached) {
        console.log(`✅ Using cached news for ${coin}`);
        return cached;
    }

    console.log(`📰 Fetching Google News for ${coin}...`);

    try {
        const query = coin === 'BTC' ? 'bitcoin crypto' : 'ethereum crypto';
        const response = await fetch(`/api/rss/google/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const text = await response.text();
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, 'text/xml');
        const items = xml.querySelectorAll('item');

        const news = Array.from(items).slice(0, 20).map((item, idx) => {
            const description = item.querySelector('description')?.textContent || '';
            const title = item.querySelector('title')?.textContent || '';
            const source = item.querySelector('source')?.textContent || 'Google News';
            const pubDate = new Date(item.querySelector('pubDate')?.textContent).toISOString();

            // 生成稳定 ID
            const id = `gn_${coin}_${btoa(encodeURIComponent(title)).slice(0, 16)}`;

            return {
                id: id,
                title: title,
                source: source,
                publishedAt: pubDate,
                url: item.querySelector('link')?.textContent,
                summary: description.replace(/<[^>]+>/g, '').substring(0, 100) + '...',
                originalLang: 'en'
            };
        });

        console.log(`✅ Fetched ${news.length} news items`);
        setCache(cacheKey, news);
        return news;

    } catch (error) {
        console.error('❌ Google News Fetch Error:', error);
        return [];
    }
};

// ============================================
// K线数据 - CoinGecko API (缓存 5分钟)
// ============================================
export const fetchOHLCData = async (coin) => {
    const cacheKey = `ohlc_${coin}`;
    const cached = getCache(cacheKey);
    // 缓存 5分钟
    if (cached && Date.now() - JSON.parse(localStorage.getItem(cacheKey)).timestamp < 5 * 60 * 1000) {
        console.log(`✅ Using cached OHLC for ${coin}`);
        return cached;
    }

    try {
        const coinId = coin === 'BTC' ? 'bitcoin' : 'ethereum';
        const response = await fetch(`/api/coingecko/coins/${coinId}/ohlc?vs_currency=usd&days=30`);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const rawData = await response.json();
        const data = rawData.map(c => ({
            time: Math.floor(c[0] / 1000),
            open: c[1], high: c[2], low: c[3], close: c[4]
        }));

        setCache(cacheKey, data);
        return data;
    } catch (error) {
        console.error('❌ OHLC Fetch Error:', error);
        throw error;
    }
};

// ============================================
// 小米 API - 初步分析 (列表用)
// ============================================
export const translateAndAnalyzeNews = async (newsItem) => {
    const cacheKey = `analysis_v3_${newsItem.id}`;
    const cached = getCache(cacheKey);
    if (cached) return { ...newsItem, ...cached, analyzed: true };

    try {
        const response = await fetch(`${LLM_CONFIG.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LLM_CONFIG.apiKey}` },
            body: JSON.stringify({
                model: LLM_CONFIG.model,
                messages: [
                    {
                        role: 'system',
                        content: `You are a professional crypto market analyst. Analyze the news title.
Return JSON ONLY:
{
  "title_cn": "Chinese Translation",
  "summary_one_line": "One short sentence summary (<20 chars)",
  "sentiment": "bullish/bearish/neutral",
  "sentiment_cn": "利好/利空/中性",
  "market_signal": "Buy Dip/Hodl/Risk Off/Watch",
  "keywords": ["tag1", "tag2"]
}`
                    },
                    { role: 'user', content: newsItem.title }
                ],
                temperature: 0.2
            })
        });

        const data = await response.json();
        const jsonStr = data.choices?.[0]?.message?.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const result = JSON.parse(jsonStr);

        const analyzedData = {
            title_cn: result.title_cn || newsItem.title,
            summary_one_line: result.summary_one_line || '',
            sentiment: result.sentiment || 'neutral',
            sentiment_cn: result.sentiment_cn || '中性',
            market_signal: result.market_signal || 'Watch',
            keywords: result.keywords || []
        };

        localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: analyzedData }));
        return { ...newsItem, ...analyzedData, analyzed: true };
    } catch (error) {
        return { ...newsItem, analyzed: false };
    }
};

// ============================================
// 小米 API - 深度分析 (流式输出 + 详细版)
// ============================================
export const streamDeepAnalysis = async (newsItem, priceContext, onChunk, signal) => {
    try {
        console.log('🧠 Starting Deep Stream Analysis...');

        const prompt = `
Context:
- Coin: ${priceContext.symbol}
- Current Price: $${priceContext.price}
- 24h Change: ${priceContext.change24h}%

News:
- Title: ${newsItem.title}
- Source: ${newsItem.source}

Task:
Provide a **comprehensive** crypto market analysis in Chinese. Markdown format.
**Requirement**:
1. Output MUST be **detailed** (at least 600 words).
2. Structure:
   - **### 深度背景**: Explain the context and verified facts.
   - **### 盘面推演**: Analyze how this specific news impacts the current price chart ($${priceContext.price}). Is it a false pump, a organic trend, or a panic sell?
   - **### 主力意图**: What are whales/institutions likely doing?
   - **### 实操策略**: Clear entry/exit/stop-loss zones.

Start outputting immediately.
        `;

        const response = await fetch(`${LLM_CONFIG.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LLM_CONFIG.apiKey}` },
            body: JSON.stringify({
                model: LLM_CONFIG.model,
                messages: [
                    { role: 'system', content: "You are a senior institutional crypto strategist. You provide long, deep, and actionable reports." },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.5,
                stream: true // 开启流式
            }),
            signal: signal // 支持取消请求
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
