
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { fetchMultiSourceNews, translateAndAnalyzeNews, streamDeepAnalysis, fetchAssetPrice } from '../services/api';
import CryptoChart from './CryptoChart';
import ReactMarkdown from 'react-markdown';

const NewsDetailModal = ({ isOpen, onClose, item, analysis, loading, selectedCoin, selectedAsset }) => {
    if (!isOpen || !item) return null;

    return createPortal(
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            backdropFilter: 'blur(10px)',
            zIndex: 2000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '1rem'
        }} onClick={onClose}>
            <div style={{
                width: '85vw',
                height: 'min(47.8125vw, 85vh)',
                backgroundColor: '#0d1117',
                borderRadius: '1rem',
                border: '1px solid #30363d',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
            }} onClick={e => e.stopPropagation()}>

                {/* 头部标题区 */}
                <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #30363d', background: '#161b22', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>
                            {item.title_cn || item.title}
                        </h2>
                        <div style={{ display: 'flex', gap: '1rem', color: '#8b949e', fontSize: '0.75rem' }}>
                            <span style={{ color: '#f0b90b' }}>🔥 正在深度分析 {selectedAsset?.name || selectedCoin} 盘面</span>
                            <span>📰 {item.source}</span>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#8b949e', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                </div>

                {/* 核心内容区 (上下布局) */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

                    {/* 上半部分：K线图 */}
                    <div style={{ padding: '0 1rem', borderBottom: '1px solid #30363d', background: '#0d1117' }}>
                        <CryptoChart coin={selectedCoin} asset={selectedAsset} height={350} />
                    </div>

                    {/* 下半部分：AI 深度解读 */}
                    <div style={{ padding: '2rem', flex: 1, background: '#0d1117' }}>
                        {loading && !analysis && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#f0b90b', marginBottom: '1rem' }}>
                                <div className="typing-indicator"><span></span><span></span><span></span></div>
                                <span style={{ fontSize: '0.9rem' }}>AI 分析师正在撰写报告...</span>
                            </div>
                        )}

                        <div className="markdown-body" style={{ maxWidth: '800px', margin: '0 auto', color: '#d1d5db', lineHeight: '1.8' }}>
                            <ReactMarkdown
                                components={{
                                    h3: ({ node, ...props }) => <h3 style={{ color: '#f0b90b', fontSize: '1.2rem', marginTop: '1.5rem', marginBottom: '0.75rem', borderBottom: '1px solid #30363d', paddingBottom: '0.5rem' }} {...props} />,
                                    strong: ({ node, ...props }) => <strong style={{ color: '#fff', fontWeight: 'bold' }} {...props} />,
                                    p: ({ node, ...props }) => <p style={{ marginBottom: '1rem' }} {...props} />,
                                    li: ({ node, ...props }) => <li style={{ marginBottom: '0.5rem' }} {...props} />,
                                }}
                            >
                                {analysis}
                            </ReactMarkdown>
                        </div>

                        {loading && (
                            <span style={{ display: 'inline-block', width: '8px', height: '16px', background: '#f0b90b', verticalAlign: 'middle', marginLeft: '5px', animation: 'blink 1s infinite' }}></span>
                        )}
                    </div>
                </div>

                {/* 底部按钮 */}
                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #30363d', display: 'flex', justifyContent: 'flex-end', gap: '1rem', background: '#161b22' }}>
                    <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ padding: '0.5rem 1.5rem', borderRadius: '0.5rem', background: '#238636', color: '#fff', textDecoration: 'none', fontWeight: 'bold', fontSize: '0.9rem' }}
                    >
                        🔗 阅读原文
                    </a>
                </div>
            </div>

            <style>{`
@keyframes blink { 50% { opacity: 0; } }
.typing-indicator span {
    display: inline-block; width: 6px; height: 6px; background: #f0b90b; border-radius: 50%; animation: type 1s infinite; margin-right: 4px;
}
.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
@keyframes type { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
`}</style>
        </div>,
        document.body
    );
};

const NewsGrid = ({ selectedCoin, selectedAsset, prices }) => {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);
    const newsRef = useRef([]);

    const [visibleCount, setVisibleCount] = useState(20);
    const [dateRange, setDateRange] = useState(30);

    // 情绪筛选状态
    const [sentimentFilter, setSentimentFilter] = useState('all');
    const [minScore, setMinScore] = useState(1);

    // 模态框状态
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedNews, setSelectedNews] = useState(null);
    const [deepAnalysis, setDeepAnalysis] = useState('');
    const [analysisLoading, setAnalysisLoading] = useState(false);

    // 用于取消上一次的请求
    const abortControllerRef = useRef(null);

    // 打开深度分析 (流式)
    const handleNewsClick = async (item) => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        setModalOpen(true);
        setSelectedNews(item);
        setDeepAnalysis('');
        setAnalysisLoading(true);

        try {
            let assetPrice = 0;
            let assetChange = 0;

            if (selectedAsset && selectedAsset.priceSource !== 'coingecko') {
                try {
                    const priceData = await fetchAssetPrice(selectedAsset);
                    if (priceData) {
                        assetPrice = priceData.price || 0;
                        assetChange = priceData.change24h || 0;
                    }
                } catch (e) {
                    console.warn('Failed to fetch asset price for analysis:', e);
                }
            } else {
                assetPrice = prices?.[selectedCoin]?.price || 0;
                assetChange = prices?.[selectedCoin]?.change24h || 0;
            }

            const priceContext = {
                symbol: selectedAsset?.name || selectedCoin,
                price: assetPrice,
                change24h: assetChange
            };
            await streamDeepAnalysis(
                item,
                priceContext,
                (chunk) => { setDeepAnalysis(prev => prev + chunk); },
                controller.signal
            );
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Analysis Error:', error);
                setDeepAnalysis('分析失败: ' + error.message);
            }
        } finally {
            setAnalysisLoading(false);
        }
    };

    // 分析队列处理 - 同时处理多个
    const processAnalysisQueue = async (newsList) => {
        const queue = [...newsList].filter(n => !n.analyzed);
        const MAX_CONCURRENT = 3;
        const processing = new Set();

        while (queue.length > 0 || processing.size > 0) {
            while (processing.size < MAX_CONCURRENT && queue.length > 0) {
                const item = queue.shift();
                if (item.analyzed) continue;

                const promise = (async () => {
                    try {
                        const analyzed = await translateAndAnalyzeNews(item);
                        setNews(prev => {
                            const newNews = prev.map(n => n.id === item.id ? analyzed : n);
                            newsRef.current = newNews;
                            return newNews;
                        });
                    } catch (err) {
                        console.error('Analysis failed:', item.id);
                    } finally {
                        processing.delete(promise);
                    }
                })();

                processing.add(promise);
            }
            if (processing.size > 0) await Promise.race(processing);
            else if (queue.length === 0) break;
        }
    };

    // 获取完整的关键词数组
    const newsKeywords = selectedAsset?.newsKeywords || [selectedCoin];
    // 用于依赖比较的字符串
    const keywordsKey = JSON.stringify(newsKeywords);

    const loadNews = useCallback(async (forceRefresh = false) => {
        setLoading(true);
        console.log('📰 Loading news for:', newsKeywords);
        try {
            // 如果强制刷新，在关键词后添加时间戳来绕过缓存
            const searchKeywords = forceRefresh
                ? [...newsKeywords, `refresh_${Date.now()}`]
                : newsKeywords;

            // 传递 dateRange 参数给 API
            const data = await fetchMultiSourceNews(searchKeywords, dateRange);

            // 如果是强制刷新，移除额外的时间戳关键词（不影响缓存key）
            setNews(data);
            newsRef.current = data;
            setLoading(false);
            processAnalysisQueue(data);
        } catch (error) {
            console.error('Failed to fetch news:', error);
            setLoading(false);
        }
    }, [keywordsKey, dateRange]); // 添加 dateRange 依赖

    useEffect(() => {
        loadNews();
    }, [loadNews]);

    // 新闻自动轮询（每5分钟刷新一次）
    useEffect(() => {
        const NEWS_POLL_INTERVAL = 5 * 60 * 1000; // 5分钟
        let pollCount = 0;

        console.log(`📰 启动新闻轮询服务，关键词: [${newsKeywords.join(', ')}]，间隔: 5分钟`);

        const pollNews = async () => {
            pollCount++;
            const timeStr = new Date().toLocaleTimeString('zh-CN');
            console.log(`⏱️ [${timeStr}] 新闻轮询 #${pollCount}：刷新 ${newsKeywords.join(', ')} 相关新闻...`);
            await loadNews(true); // 强制刷新
            console.log(`✅ [${timeStr}] 新闻刷新完成`);
        };

        const interval = setInterval(pollNews, NEWS_POLL_INTERVAL);

        return () => {
            console.log('📰 停止新闻轮询服务');
            clearInterval(interval);
        };
    }, [keywordsKey]); // 关键词变化时重启轮询

    // 手动刷新（强制绕过缓存）
    const handleManualRefresh = () => {
        const timeStr = new Date().toLocaleTimeString('zh-CN');
        console.log(`🔄 [${timeStr}] 手动刷新新闻...`);
        loadNews(true); // 传入 true 强制刷新
    };

    // 注意：日期筛选已在 API 层完成，这里不需要再次过滤

    // 情绪颜色映射 (5级)
    const getSentimentColor = (sentiment, level) => {
        if (sentiment === 'bullish') {
            return level >= 5 ? '#10b981' : '#34d399'; // 强利好 vs 利好
        }
        if (sentiment === 'bearish') {
            return level <= 1 ? '#ef4444' : '#f87171'; // 强利空 vs 利空
        }
        return '#9ca3af'; // 中性
    };

    // 应用情绪筛选
    const filteredNews = news.filter(item => {
        // 情绪类型筛选
        if (sentimentFilter !== 'all') {
            if (sentimentFilter === 'bullish' && item.sentiment !== 'bullish') return false;
            if (sentimentFilter === 'bearish' && item.sentiment !== 'bearish') return false;
            if (sentimentFilter === 'neutral' && item.sentiment !== 'neutral') return false;
        }
        // 分数筛选 (未评分=0，中性=0)
        if (sentimentFilter !== 'neutral' && minScore > 1) {
            // 未分析的视为0分
            if (!item.analyzed) return false;
            const itemIntensity = item.sentiment === 'neutral' ? 0 : (item.sentiment_level || 0);
            if (itemIntensity < minScore) return false;
        }
        return true;
    });

    const renderNewsCard = (item) => {
        const sentimentColor = getSentimentColor(item.sentiment);

        return (
            <div
                key={item.id}
                onClick={() => handleNewsClick(item)}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#1f2937',
                    borderRadius: '0.75rem',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    border: item.analyzed ? `1px solid ${sentimentColor} 44` : '1px solid #374151',
                    height: '100%',
                    position: 'relative'
                }}
                onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = `0 10px 20px - 5px ${sentimentColor} 22`;
                    e.currentTarget.style.borderColor = sentimentColor;
                }}
                onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = item.analyzed ? `${sentimentColor} 44` : '#374151';
                }}
            >
                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', flex: 1, gap: '0.5rem', height: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#9ca3af' }}>
                        <span style={{ fontWeight: '500', color: '#d1d5db' }}>{item.source}</span>
                        <span>{new Date(item.publishedAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} {new Date(item.publishedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <h3 style={{ fontSize: '1rem', fontWeight: '600', lineHeight: '1.4', color: '#f3f4f6', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: '0.25rem 0' }}>
                        {item.title_cn || item.title}
                    </h3>

                    {item.summary_one_line && (
                        <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: 0, lineHeight: '1.4', borderLeft: `2px solid ${sentimentColor} `, paddingLeft: '0.5rem' }}>
                            {item.summary_one_line}
                        </p>
                    )}

                    <div style={{ marginTop: 'auto', paddingTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {item.market_signal && item.analyzed && (
                            <span style={{ fontSize: '0.7rem', background: '#f59e0b', color: '#000', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                                {item.market_signal.toUpperCase()}
                            </span>
                        )}
                        {item.sentiment_cn && item.analyzed && (
                            <span style={{ fontSize: '0.7rem', color: sentimentColor, background: `${sentimentColor} 11`, padding: '2px 6px', borderRadius: '4px', border: `1px solid ${sentimentColor} 33` }}>
                                {item.sentiment === 'bullish' ? '🚀' : item.sentiment === 'bearish' ? '🩸' : '⚖️'} {item.sentiment_cn}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    if (loading) {
        return <div style={{ textAlign: 'center', padding: '4rem', color: '#6b7280' }}>
            <div className="shimmer" style={{ width: '100%', height: '200px', borderRadius: '0.75rem' }}></div>
            <p style={{ marginTop: '1rem' }}>正在从 Google News 获取最新情报...</p>
        </div>;
    }


    const handleLoadMore = () => {
        setVisibleCount(prev => prev + 20);
    };

    const displayedNews = news.slice(0, visibleCount);

    return (
        <div>
            <NewsDetailModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                item={selectedNews}
                analysis={deepAnalysis}
                loading={analysisLoading}
                selectedCoin={selectedCoin}
                selectedAsset={selectedAsset}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: selectedCoin === 'BTC' ? '#f0b90b' : '#627eea', margin: 0 }}>
                        {selectedCoin === 'BTC' ? '₿' : 'Ξ'} 市场情报
                    </h2>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280', background: '#1f2937', padding: '2px 8px', borderRadius: '12px' }}>
                        ⚡ 点击分析
                    </span>
                </div>

                {/* 控制按钮组 */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {/* 日期范围选择 */}
                    <select
                        value={dateRange}
                        onChange={e => setDateRange(Number(e.target.value))}
                        style={{
                            padding: '0.5rem 0.75rem',
                            background: '#1f2937',
                            border: '1px solid #374151',
                            borderRadius: '0.5rem',
                            color: '#e5e7eb',
                            fontSize: '0.85rem',
                            cursor: 'pointer'
                        }}
                    >
                        <option value={7}>📅 近7天</option>
                        <option value={15}>📅 近15天</option>
                        <option value={30}>📅 近30天</option>
                        <option value={180}>📅 近半年</option>
                        <option value={365}>📅 近一年</option>
                    </select>

                    {/* 手动刷新按钮 */}
                    <button
                        onClick={handleManualRefresh}
                        disabled={loading}
                        style={{
                            padding: '0.5rem 1rem',
                            background: loading ? '#374151' : '#238636',
                            border: 'none',
                            borderRadius: '0.5rem',
                            color: '#fff',
                            fontSize: '0.85rem',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => !loading && (e.currentTarget.style.background = '#2ea043')}
                        onMouseLeave={e => !loading && (e.currentTarget.style.background = '#238636')}
                    >
                        {loading ? '⏳' : '🔄'} {loading ? '加载中...' : '刷新'}
                    </button>
                </div>
            </div>

            {/* 情绪筛选栏 */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1rem',
                alignItems: 'center',
                marginBottom: '1.25rem',
                padding: '0.75rem 1rem',
                background: 'rgba(31, 41, 55, 0.6)',
                borderRadius: '0.75rem',
                border: '1px solid rgba(55, 65, 81, 0.5)'
            }}>
                {/* 情绪标签组 */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>情绪:</span>
                    {[
                        { value: 'all', label: '全部', color: '#6b7280' },
                        { value: 'bullish', label: '📈 利好', color: '#10b981' },
                        { value: 'neutral', label: '➖ 中性', color: '#9ca3af' },
                        { value: 'bearish', label: '📉 利空', color: '#ef4444' }
                    ].map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setSentimentFilter(opt.value)}
                            style={{
                                padding: '0.35rem 0.75rem',
                                borderRadius: '1rem',
                                border: sentimentFilter === opt.value ? `2px solid ${opt.color}` : '1px solid #374151',
                                background: sentimentFilter === opt.value ? `${opt.color}20` : 'transparent',
                                color: sentimentFilter === opt.value ? opt.color : '#9ca3af',
                                fontSize: '0.8rem',
                                fontWeight: sentimentFilter === opt.value ? '600' : '400',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                {/* 分隔线 */}
                <div style={{ width: '1px', height: '24px', background: '#374151' }}></div>

                {/* 分数滑块 (仅中性时禁用) */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    opacity: sentimentFilter === 'neutral' ? 0.4 : 1,
                    pointerEvents: sentimentFilter === 'neutral' ? 'none' : 'auto'
                }}>
                    <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                        {sentimentFilter === 'bullish' ? '利好程度≥' : sentimentFilter === 'bearish' ? '利空程度≥' : '强度≥'}
                    </span>
                    <input
                        type="range"
                        min="1"
                        max="5"
                        value={minScore}
                        onChange={e => setMinScore(Number(e.target.value))}
                        disabled={sentimentFilter === 'neutral'}
                        style={{ width: '80px', cursor: sentimentFilter === 'neutral' ? 'not-allowed' : 'pointer' }}
                    />
                    <span style={{
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        color: sentimentFilter === 'bullish' ? '#10b981' : sentimentFilter === 'bearish' ? '#ef4444' : '#60a5fa',
                        minWidth: '20px'
                    }}>
                        {minScore}/5
                    </span>
                </div>

                {/* 筛选结果统计 */}
                <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: 'auto' }}>
                    共 {filteredNews.length} / {news.length} 条
                </span>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', // 自适应宽度，更宽的卡片
                gap: '1.5rem',
                paddingTop: '4px', // 修复上边框被遮挡的问题
                paddingBottom: '4px'
            }}>
                {filteredNews.slice(0, visibleCount).map((item, index) => {
                    // 计算情感颜色 (带等级)
                    const sentimentColor = getSentimentColor(item.sentiment, item.sentiment_level);

                    return (
                        <div
                            key={item.id || index}
                            onClick={() => handleNewsClick(item)}
                            style={{
                                background: '#21262d', // 使用更深的背景色
                                border: '1px solid #30363d',
                                borderRadius: '12px',
                                padding: '1.25rem',
                                cursor: 'pointer',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                display: 'flex',
                                flexDirection: 'column',
                                height: '100%',
                                position: 'relative',
                                overflow: 'hidden',
                                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.transform = 'translateY(-4px)';
                                e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.2)';
                                e.currentTarget.style.borderColor = '#58a6ff';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                                e.currentTarget.style.borderColor = '#30363d';
                            }}
                        >
                            {/* 顶部元数据行 */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '1.2rem' }}>{item.originalLang === 'en' ? '🇺🇸' : '🇨🇳'}</span>
                                    <span style={{
                                        fontSize: '0.75rem',
                                        color: '#8b949e',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.25rem',
                                        background: 'rgba(110, 118, 129, 0.1)',
                                        padding: '2px 6px',
                                        borderRadius: '4px'
                                    }}>
                                        📅 {new Date(item.publishedAt).toLocaleString(undefined, {
                                            month: '2-digit',
                                            day: '2-digit',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </span>
                                </div>

                                <span style={{
                                    fontSize: '0.7rem',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontWeight: '600',
                                    background: `${sentimentColor}20`, // 20% opacity
                                    color: sentimentColor,
                                    border: `1px solid ${sentimentColor}40`,
                                    letterSpacing: '0.5px'
                                }}>
                                    {item.sentiment_cn || (item.sentiment === 'bullish' ? '🚀 利好' : item.sentiment === 'bearish' ? '🔻 利空' : '⚖️ 中性')}
                                    {item.sentiment_level && ` (${item.sentiment_level}/5)`}
                                </span>
                                {/* AI分析标识 */}
                                {item.aiAnalyzed && (
                                    <span style={{
                                        fontSize: '0.65rem',
                                        padding: '2px 6px',
                                        borderRadius: '8px',
                                        background: 'rgba(168, 85, 247, 0.15)',
                                        color: '#a855f7',
                                        border: '1px solid rgba(168, 85, 247, 0.3)',
                                        marginLeft: '4px'
                                    }}>
                                        🤖 AI
                                    </span>
                                )}
                            </div>

                            {/* 标题 */}
                            <h3 style={{
                                fontSize: '1.1rem',
                                fontWeight: '600',
                                color: '#e6edf3',
                                marginBottom: '0.75rem',
                                lineHeight: '1.5',
                                display: '-webkit-box',
                                WebkitLineClamp: 3, // 标题最多3行
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                            }}>
                                {item.title_cn || item.title}
                            </h3>

                            {/* 摘要内容 - 展示更多 */}
                            <p style={{
                                fontSize: '0.9rem',
                                color: '#8b949e',
                                lineHeight: '1.6',
                                flex: 1,
                                marginBottom: '1rem',
                                display: '-webkit-box',
                                WebkitLineClamp: 5, // 增加到5行，展示更多内容
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                            }}>
                                {item.summary_cn || item.snippet}
                            </p>

                            {/* 底部来源信息 */}
                            <div style={{
                                paddingTop: '0.75rem',
                                borderTop: '1px solid #30363d',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '0.75rem',
                                color: '#6e7681'
                            }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    Your source
                                </span>
                                <span style={{ fontStyle: 'italic' }}>
                                    {item.source}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Pagination Button */}
            {visibleCount < filteredNews.length && (
                <div style={{ textAlign: 'center', marginTop: '2.5rem', paddingBottom: '1rem' }}>
                    <button
                        onClick={handleLoadMore}
                        style={{
                            background: '#21262d',
                            color: '#e6edf3',
                            border: '1px solid #30363d',
                            padding: '0.75rem 2.5rem',
                            borderRadius: '2rem',
                            cursor: 'pointer',
                            fontSize: '0.95rem',
                            fontWeight: '600',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }}
                        onMouseEnter={e => {
                            e.target.style.background = '#30363d';
                            e.target.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={e => {
                            e.target.style.background = '#21262d';
                            e.target.style.transform = 'translateY(0)';
                        }}
                    >
                        👇 加载更多 ({news.length - visibleCount} remaining)
                    </button>
                </div>
            )}
        </div>
    );
};

export default NewsGrid;
