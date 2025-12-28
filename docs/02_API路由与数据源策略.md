# 📡 OmniTrade AI - API路由与数据源策略

本文档深入解析 `src/services/api.js` 中的核心数据路由逻辑。这是系统稳定性的基石。

## 1. 资产ID与符号映射

系统内部使用两套标识符：
1.  **CoinGecko ID**: 用于获取价格 (e.g., `bitcoin`, `solana`)
2.  **Trading Symbol**: 用于获取 K 线 (e.g., `BTC-USDT`, `SOL-USDT`)

### 1.1 关键映射表

为了解决不同 API 对同一资产命名不一致的问题，我们在 `api.js` 中维护了两个关键映射表：

#### OKX 现货白名单 (`OKX_SPOT_SYMBOLS`)
仅包含 OKX **确信支持** 的现货交易对。
```javascript
const OKX_SPOT_SYMBOLS = {
    'BTC': 'BTC-USDT',
    'ETH': 'ETH-USDT',
    'LTC': 'LTC-USDT', 
    // ...仅列出主流币
};
```

#### Binance 符号转换表 (`BINANCE_SYMBOLS`)
用于将 CoinGecko 的全名ID转换为 Binance 认可的交易对符号。这是解决 DOGE/SOL 问题的关键。
```javascript
const BINANCE_SYMBOLS = {
    'SOLANA': 'SOL',   // 输入 Solana -> 使用 SOL
    'DOGECOIN': 'DOGE', // 输入 Dogecoin -> 使用 DOGE
    'SHIBA INU': 'SHIB',
    // ...
};
```

---

## 2. K线获取的核心算法 (`fetchOHLCData`)

这是本系统的"核弹级"代码，位于 `src/services/api.js`。它实现了三级自动降级。

### 算法流程代码化描述

```javascript
async function fetchOHLCData(coin) {
    // 1. 优先尝试 OKX (国内直连，速度快)
    if (inWhitelist(coin)) {
        try {
            return await callOKX(coin);
        } catch (e) {
            console.warn("OKX failed, downgrading...");
        }
    }

    // 2. 降级尝试 Binance (数据全)
    // 关键修正: 这里即使 OKX 失败也会走到这里
    try {
        const symbol = mapToBinanceSymbol(coin); // 如 Solana -> SOL
        return await callBinance(symbol);
    } catch (e) {
        console.warn("Binance failed (likely 451), downgrading...");
    }

    // 3. 最终兜底 Yahoo Finance (永不被封)
    try {
        const yahooSymbol = `${symbol}-USD`; // 如 DOGE-USD
        return await callYahoo(yahooSymbol);
    } catch (e) {
        throw new Error("All sources failed");
    }
}
```

### 为什么这样设计？
*   **针对中国大陆用户优化**: 优先 OKX，无需代理即可快速加载图表。
*   **针对冷门币种优化**: OKX 上没有的币（或 API 不支持的），Binance 通常都有。
*   **针对合规封锁优化**: 当 Binance 返回 HTTP 451 (地区限制) 时，无缝切换到 Yahoo，用户毫无感知。

---

## 3. 价格轮询机制 (`connectBinanceWebSocket`)

虽然函数名叫 WebSocket，但为了规避 CoinGecko 免费版不支持 WS 的限制，我们实作了一个**智能轮询器**。

### 机制细节
1.  **动态订阅**: 接收 `assets` 数组，动态提取所有可见卡片的 `priceId`。
2.  **合并请求**: 将所有 ID 合并为一个请求 `?ids=bitcoin,ethereum,solana&vs_currencies=usd`，极大节省 API 配额。
3.  **本地缓存**: `cacheKey = price_cache_${ids}`。
    *   请求前检查缓存：如果 1 分钟内有数据，**直接返回缓存**，不发网络请求。
    *   这保证了即使多个组件频繁重绘，也不会触发 API 频率限制 (429 Too Many Requests)。
4.  **自动重试**: `setInterval` 每 60 秒执行一次，确保价格实时性。

---

## 4. 新闻源的 URI 编码修复

在 `parseRSS` 中，我们修复了一个导致页面崩溃的严重 Bug。

*   **问题**: `btoa(encodeURIComponent(title))` 在处理包含特殊字符（如 Emoji 或生僻汉字）的标题时，URI 编码后的字符串长度可能超出 `btoa` 处理能力或导致格式错误。
*   **修复**: 弃用 Base64，改用正则清洗：
    ```javascript
    const safeId = title.slice(0, 20).replace(/[^a-zA-Z0-9一-龥]/g, '');
    ```
    这确保了生成的 ID 永远是 URL 安全的，且具备唯一性。
