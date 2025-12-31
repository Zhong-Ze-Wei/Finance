// AddAssetModal.jsx - AI 智能识别添加标的弹窗
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { addAssetCard } from '../services/assetCards';
import { LLM_CONFIG } from '../services/api';

// AI 识别标的函数（复用 LLM_CONFIG）
const identifyAsset = async (query) => {
    const prompt = `你是金融标的识别专家。用户输入了一个公司/股票/加密货币名称，请识别并返回 JSON 格式：

{
  "name": "显示名称（简短中文）",
  "symbol": "TradingView 格式 symbol（如 NASDAQ:AAPL 或 SSE:600519 或 BINANCE:BTCUSDT）",
  "priceSource": "coingecko 或 yahoo 或 sina",
  "priceId": "价格 API 用的 ID",
  "ohlcSource": "okx 或 yahoo",
  "ohlcId": "K线 API 用的 ID",
  "newsKeywords": ["关键词1", "关键词2", "关键词3"],
  "type": "crypto 或 stock 或 etf 或 index",
  "category": "资产分类（见下方规则）"
}

数据源规则：
- 加密货币: priceSource=coingecko, ohlcSource=okx, ohlcId=BTC-USDT格式
- 美股: priceSource=yahoo, ohlcSource=yahoo, ohlcId=AAPL格式, priceId=AAPL
- 港股: priceSource=yahoo, ohlcSource=yahoo, ohlcId=0700.HK格式 (注意: ohlcId 必须以 .HK 结尾), symbol=HKEX:700 (注意: TradingView 港股通常去掉了前导零)
- A股(上海): priceSource=yahoo, ohlcSource=yahoo, ohlcId=600519.SS格式, symbol=SSE:600519
- A股(深圳): priceSource=yahoo, ohlcSource=yahoo, ohlcId=000917.SZ格式, symbol=SZSE:000917
- 美股: priceSource=yahoo, ohlcSource=yahoo, ohlcId=AAPL, symbol=NASDAQ:AAPL

格式严格校验：
1. ohlcId 严禁包含冒号 (:)
2. 港股 ohlcId 必须是 "数字.HK"
3. A股 ohlcId 必须是 "数字.SS" 或 "数字.SZ"

category 分类规则（⚠️ 必须严格遵守以下判断逻辑）：

**强制规则（基于 ohlcId 后缀自动判断）：**
- 如果 ohlcId 以 ".SS" 或 ".SZ" 结尾 → 必须选择 "A股"
- 如果 ohlcId 以 ".HK" 结尾 → 必须选择 "港股"
- 如果 priceSource 是 "coingecko" → 必须选择 "加密货币"
- 如果 ohlcId 没有后缀且 symbol 包含 NASDAQ/NYSE/AMEX → 选择 "美股"

**可选分类：**
- "ETF" - 交易所交易基金（如果明确是ETF产品）
- "外汇" - 货币对（如 USD/CNY）
- "大宗商品" - 黄金、原油、农产品等
- "指数" - 如上证指数、标普500等
- "其他" - 无法归类时使用

⚠️ 重要：分类必须基于 ohlcId 格式自动判断，不要根据公司名称猜测！
例如：
- "电广传媒" 的 ohlcId 是 "000917.SZ" → category 必须是 "A股"，不能是 "美股"
- "腾讯" 的 ohlcId 是 "0700.HK" → category 必须是 "港股"

newsKeywords 生成规则（重要！）：
- 必须包含公司全名和股票代码
- 必须精确，避免宽泛词（❌不要只写"汽车"，✅要写"海马汽车"）
- 同时包含中英文名称（如有）
- 对于A股/港股，要包含中文名称和公司简称
- 示例: ["海马汽车", "Haima Automobile", "000572", "000572.SZ"]
- 示例: ["苹果", "Apple", "AAPL", "苹果公司"]
- 示例: ["比特币", "Bitcoin", "BTC"]

用户输入: ${query}

只返回 JSON，不要其他内容。`;

    try {
        const response = await fetch(`${LLM_CONFIG.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${LLM_CONFIG.apiKey}`
            },
            body: JSON.stringify({
                model: LLM_CONFIG.model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1
            })
        });

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        // 提取 JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        throw new Error('无法解析 AI 返回');
    } catch (e) {
        console.error('AI 识别失败:', e);
        throw e;
    }
};

const AddAssetModal = ({ isOpen, onClose, onAdd }) => {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const handleIdentify = async () => {
        if (!query.trim()) return;

        setLoading(true);
        setError('');
        setResult(null);

        try {
            const identified = await identifyAsset(query.trim());
            setResult(identified);
        } catch (e) {
            setError('识别失败，请检查 API 配置或重试');
        }
        setLoading(false);
    };

    const handleSave = () => {
        if (!result) return;

        const newCard = addAssetCard(result);
        onAdd?.(newCard);
        handleClose();
    };

    const handleClose = () => {
        setQuery('');
        setResult(null);
        setError('');
        setLoading(false);
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            backdropFilter: 'blur(10px)',
            zIndex: 4000,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            padding: '1rem'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '480px',
                backgroundColor: '#0d1117',
                borderRadius: '1rem',
                border: '1px solid #30363d',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                overflow: 'hidden'
            }}>

                {/* 头部 */}
                <div style={{
                    padding: '1rem 1.5rem',
                    borderBottom: '1px solid #30363d',
                    background: '#161b22',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>
                        ➕ 添加新标的
                    </h2>
                    <button onClick={handleClose} style={{
                        background: 'transparent', border: 'none',
                        color: '#8b949e', fontSize: '1.5rem', cursor: 'pointer'
                    }}>×</button>
                </div>

                {/* 内容 */}
                <div style={{ padding: '1.5rem' }}>

                    {/* 输入框 */}
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ color: '#9ca3af', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>
                            请输入标的名称
                        </label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleIdentify()}
                                placeholder="如：苹果公司、贵州茅台、比特币..."
                                style={{
                                    flex: 1,
                                    padding: '0.75rem 1rem',
                                    background: '#21262d',
                                    border: '1px solid #30363d',
                                    borderRadius: '0.5rem',
                                    color: '#fff',
                                    fontSize: '0.9rem',
                                    outline: 'none'
                                }}
                            />
                            <button
                                onClick={handleIdentify}
                                disabled={loading || !query.trim()}
                                style={{
                                    padding: '0.75rem 1rem',
                                    background: loading ? '#21262d' : 'linear-gradient(135deg, #f0b90b 0%, #e85d04 100%)',
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    color: loading ? '#6e7681' : '#000',
                                    fontWeight: 'bold',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {loading ? '🔄' : '🤖 识别'}
                            </button>
                        </div>
                    </div>

                    {/* 错误提示 */}
                    {error && (
                        <div style={{
                            padding: '0.75rem',
                            background: '#da3633',
                            borderRadius: '0.5rem',
                            color: '#fff',
                            fontSize: '0.85rem',
                            marginBottom: '1rem'
                        }}>
                            ❌ {error}
                        </div>
                    )}

                    {/* 识别结果 */}
                    {result && (
                        <div style={{
                            background: '#161b22',
                            border: '1px solid #238636',
                            borderRadius: '0.5rem',
                            padding: '1rem',
                            marginBottom: '1rem'
                        }}>
                            <div style={{ color: '#3fb950', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                                ✅ 识别成功
                            </div>

                            <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.85rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#8b949e' }}>名称:</span>
                                    <span style={{ color: '#e6edf3' }}>{result.name}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#8b949e' }}>Symbol:</span>
                                    <span style={{ color: '#f0b90b' }}>{result.symbol}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#8b949e' }}>类型:</span>
                                    <span style={{ color: '#e6edf3' }}>{result.type}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#8b949e' }}>数据源:</span>
                                    <span style={{ color: '#e6edf3' }}>{result.priceSource}</span>
                                </div>
                            </div>

                            <div style={{ marginTop: '0.75rem' }}>
                                <span style={{ color: '#8b949e', fontSize: '0.8rem' }}>新闻关键词: </span>
                                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginTop: '0.375rem' }}>
                                    {result.newsKeywords?.map((kw, i) => (
                                        <span key={i} style={{
                                            padding: '0.25rem 0.5rem',
                                            background: '#21262d',
                                            borderRadius: '0.25rem',
                                            fontSize: '0.75rem',
                                            color: '#8b949e'
                                        }}>
                                            {kw}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 操作按钮 */}
                    {result && (
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                onClick={() => { setResult(null); setQuery(''); }}
                                style={{
                                    flex: 1,
                                    padding: '0.75rem',
                                    background: '#21262d',
                                    border: '1px solid #30363d',
                                    borderRadius: '0.5rem',
                                    color: '#fff',
                                    cursor: 'pointer'
                                }}
                            >
                                🔄 重新识别
                            </button>
                            <button
                                onClick={handleSave}
                                style={{
                                    flex: 1,
                                    padding: '0.75rem',
                                    background: 'linear-gradient(135deg, #238636 0%, #2ea043 100%)',
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    color: '#fff',
                                    fontWeight: 'bold',
                                    cursor: 'pointer'
                                }}
                            >
                                💾 保存卡片
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AddAssetModal;
