
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { fetchMultiSourceNews, translateAndAnalyzeNews, streamDeepAnalysis, fetchAssetPrice } from '../services/api';
import CryptoChart from './CryptoChart'; // Import Chart
import ReactMarkdown from 'react-markdown'; // 恢复使用 ReactMarkdown

const NewsDetailModal = ({ isOpen, onClose, item, analysis, loading, selectedCoin }) => {
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
                height: 'min(47.8125vw, 85vh)', // 16:9 比例
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
                            <span style={{ color: '#f0b90b' }}>🔥 正在深度分析 {selectedCoin} 盘面</span>
                            <span>📰 {item.source}</span>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#8b949e', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                </div>

                {/* 核心内容区 (上下布局) */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

                    {/* 上半部分：K线图 */}
                    <div style={{ padding: '0 1rem', borderBottom: '1px solid #30363d', background: '#0d1117' }}>
                        <CryptoChart coin={selectedCoin} height={350} />
                    </div>

                    {/* 下半部分：AI 深度解读 (流式文本) */}
                    <div style={{ padding: '2rem', flex: 1, background: '#0d1117' }}>
                        {/* 动态 Loading 提示 */}
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

                        {/* 光标效果 */}
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
@keyframes blink { 50 % { opacity: 0; } }
                .typing - indicator span {
    display: inline - block; width: 6px; height: 6px; background: #f0b90b; border - radius: 50 %; animation: type 1s infinite; margin - right: 4px;
}
                .typing - indicator span: nth - child(2) { animation - delay: 0.2s; }
                .typing - indicator span: nth - child(3) { animation - delay: 0.4s; }
@keyframes type { 0 %, 100 % { transform: translateY(0); } 50 % { transform: translateY(-5px); } }
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

    // 模态框状态
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedNews, setSelectedNews] = useState(null);
    const [deepAnalysis, setDeepAnalysis] = useState('');
    const [analysisLoading, setAnalysisLoading] = useState(false);

    // 用于取消上一次的请求
    const abortControllerRef = useRef(null);

    // 打开深度分析 (流式)
    const handleNewsClick = async (item) => {
        // 1. 取消上一次未完成的请求
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // 2. 创建新的 Controller
        const controller = new AbortController();
        abortControllerRef.current = controller;

        // 3. 先立即打开 Modal, 显示 loading
        setModalOpen(true);
        setSelectedNews(item);
        setDeepAnalysis(''); // 清空上次的分析
        setAnalysisLoading(true);

        // 开始流式分析
        try {
            let assetPrice = 0;
            let assetChange = 0;

            // 如果是股票/ETF，动态获取价格
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
                // 加密货币使用已有的 prices 数据
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

    const loadNews = useCallback(async () => {
        setLoading(true);
        console.log('📰 Loading news for:', newsKeywords); // 调试日志
        try {
            const data = await fetchMultiSourceNews(newsKeywords);
            setNews(data);
            newsRef.current = data;
            setLoading(false);
            processAnalysisQueue(data);
        } catch (error) {
            console.error('Failed to fetch news:', error);
            setLoading(false);
        }
    }, [keywordsKey]);

    useEffect(() => {
        loadNews();
    }, [loadNews]);

    const getSentimentColor = (sentiment) => {
        if (sentiment === 'bullish') return '#10b981';
        if (sentiment === 'bearish') return '#ef4444';
        return '#9ca3af';
    };

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
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '1.25rem'
            }}>
                {displayedNews.map(renderNewsCard)}
            </div>

            {/* Pagination Button */}
            {visibleCount < news.length && (
                <div style={{ textAlign: 'center', marginTop: '2rem', paddingBottom: '1rem' }}>
                    <button
                        onClick={handleLoadMore}
                        style={{
                            background: '#1f2937',
                            color: '#e5e7eb',
                            border: '1px solid #374151',
                            padding: '0.75rem 2rem',
                            borderRadius: '2rem',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                        onMouseEnter={e => { e.target.style.background = '#374151'; }}
                        onMouseLeave={e => { e.target.style.background = '#1f2937'; }}
                    >
                        👇 加载更多 ({news.length - visibleCount} remaining)
                    </button>
                </div>
            )}
        </div>
    );
};

export default NewsGrid;
