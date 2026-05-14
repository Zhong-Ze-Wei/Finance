
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import './NewsGrid.css';
import { fetchMultiSourceNews, batchAnalyzeNews, streamDeepAnalysis, fetchAssetPrice } from '../services/api';
import { getNewsSettings } from '../services/userSettings';
import CryptoChart from './CryptoChart';
import ReactMarkdown from 'react-markdown';
import {
    Flame, Globe, Calendar, TrendingUp, TrendingDown, Scale,
    Loader2, RefreshCw, Zap, Bot, AlertTriangle, Inbox,
    ExternalLink, ChevronsDown, Rocket, Minus, Newspaper
} from 'lucide-react';

const NewsDetailModal = ({ isOpen, onClose, item, analysis, loading, selectedCoin, selectedAsset }) => {
    if (!isOpen || !item) return null;

    return createPortal(
        <div className="news-modal__overlay" onClick={onClose}>
            <div className="news-modal" onClick={e => e.stopPropagation()}>

                {/* 头部标题区 */}
                <div className="news-modal__header">
                    <div>
                        <h2 className="news-modal__title">
                            {item.title_cn || item.title}
                        </h2>
                        <div className="news-modal__meta">
                            <span className="news-modal__meta-highlight"><Flame size={14} /> 正在深度分析 {selectedAsset?.name || selectedCoin} 盘面</span>
                            <span><Newspaper size={14} /> {item.source}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="news-modal__close-btn">×</button>
                </div>

                {/* 核心内容区 (上下布局) */}
                <div className="news-modal__content">

                    {/* 上半部分：K线图 */}
                    <div className="news-modal__chart">
                        <CryptoChart coin={selectedCoin} asset={selectedAsset} height={350} />
                    </div>

                    {/* 下半部分：AI 深度解读 */}
                    <div className="news-modal__analysis">
                        {loading && !analysis && (
                            <div className="news-modal__loading-indicator">
                                <div className="news-typing-indicator"><span></span><span></span><span></span></div>
                                <span className="news-modal__loading-text">AI 分析师正在撰写报告...</span>
                            </div>
                        )}

                        <div className="news-modal__markdown markdown-body">
                            <ReactMarkdown>
                                {analysis}
                            </ReactMarkdown>
                        </div>

                        {loading && (
                            <span className="news-modal__cursor"></span>
                        )}
                    </div>
                </div>

                {/* 底部按钮 */}
                <div className="news-modal__footer">
                    <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="news-modal__link"
                    >
                        <ExternalLink size={14} /> 阅读原文
                    </a>
                </div>
            </div>

        </div>,
        document.body
    );
};

const NewsGrid = ({ selectedCoin, selectedAsset, prices }) => {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const newsRef = useRef([]);
    const batchAnalysisPromiseRef = useRef(null);

    // 从用户设置读取默认值
    const newsSettings = getNewsSettings();
    const [visibleCount, setVisibleCount] = useState(newsSettings.maxItems || 50);
    const [dateRange, setDateRange] = useState(newsSettings.defaultDays || 7);

    // 分析状态
    const [analyzingRemaining, setAnalyzingRemaining] = useState(false);

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

        if (!item.analyzed && newsRef.current.some(n => !n.analyzed)) {
            setModalOpen(true);
            setSelectedNews(item);
            setDeepAnalysis('正在优先完成首批新闻分析，请稍候...');
            setAnalysisLoading(true);
            await ensureInitialBatchAnalysis();
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

    // 并发分析新闻（每条独立请求，10条并发）
    const processBatchAnalysis = async (newsList, maxCount = null) => {
        const limit = maxCount ?? newsSettings.defaultAnalyzeCount ?? 20;
        const unanalyzed = newsList.filter(n => !n.analyzed).slice(0, limit);
        if (unanalyzed.length === 0) return;

        console.log(`📰 开始并发分析 ${unanalyzed.length} 条新闻 (10条并发，限制${limit}条)`);

        const analyzed = await batchAnalyzeNews(unanalyzed, 10);

        // 更新状态
        setNews(prev => {
            const updatedMap = new Map(analyzed.map(n => [n.id, n]));
            const newNews = prev.map(n => updatedMap.get(n.id) || n);
            newsRef.current = newNews;
            return newNews;
        });

        console.log(`✅ 批量分析完成`);
    };

    // 分析剩余未分析的新闻
    const ensureInitialBatchAnalysis = async (targetNews = null) => {
        const currentNews = targetNews || newsRef.current;
        const limit = newsSettings.defaultAnalyzeCount ?? 20;
        const pending = currentNews.filter(n => !n.analyzed).slice(0, limit);

        if (pending.length === 0) return newsRef.current;

        if (!batchAnalysisPromiseRef.current) {
            batchAnalysisPromiseRef.current = processBatchAnalysis(currentNews, limit)
                .finally(() => {
                    batchAnalysisPromiseRef.current = null;
                });
        }

        await batchAnalysisPromiseRef.current;
        return newsRef.current;
    };

    const handleAnalyzeRemaining = async () => {
        await ensureInitialBatchAnalysis();

        const latestNews = newsRef.current;
        const unanalyzed = latestNews.filter(n => !n.analyzed);
        if (unanalyzed.length === 0) return;

        setAnalyzingRemaining(true);
        console.log(`📰 手动分析剩余 ${unanalyzed.length} 条新闻...`);

        await processBatchAnalysis(latestNews, unanalyzed.length);

        setAnalyzingRemaining(false);
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
            setError(null);
            setLoading(false);
            void ensureInitialBatchAnalysis(data);
        } catch (err) {
            console.error('Failed to fetch news:', err);
            setError(err.message || '新闻加载失败');
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
            return level >= 5 ? 'var(--color-success)' : '#34d399'; // 强利好 vs 利好
        }
        if (sentiment === 'bearish') {
            return level <= 1 ? 'var(--color-danger)' : '#f87171'; // 强利空 vs 利空
        }
        return 'var(--text-muted)'; // 中性
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
                className="news-card--simple"
                data-analyzed={item.analyzed ? "true" : undefined}
                style={{
                    '--sentiment-color': sentimentColor,
                    '--sentiment-color-alpha-44': `${sentimentColor}44`,
                    '--sentiment-color-alpha-11': `${sentimentColor}11`,
                    '--sentiment-color-alpha-33': `${sentimentColor}33`,
                }}
            >
                <div className="news-simple__body">
                    <div className="news-simple__meta-row">
                        <span className="news-simple__source">{item.source}</span>
                        <span>{new Date(item.publishedAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} {new Date(item.publishedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <h3 className="news-simple__title">
                        {item.title_cn || item.title}
                    </h3>

                    {item.summary_one_line && (
                        <p className="news-simple__summary-line">
                            {item.summary_one_line}
                        </p>
                    )}

                    <div className="news-simple__tags">
                        {item.market_signal && item.analyzed && (
                            <span className="news-simple__signal-tag">
                                {item.market_signal.toUpperCase()}
                            </span>
                        )}
                        {item.sentiment_cn && item.analyzed && (
                            <span className="news-simple__sentiment-tag">
                                {item.sentiment === 'bullish' ? <Rocket size={12} /> : item.sentiment === 'bearish' ? <TrendingDown size={12} /> : <Scale size={12} />} {item.sentiment_cn}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    if (loading) {
        return <div className="news-state">
            <div className="shimmer news-state__shimmer"></div>
            <p className="news-state__text">正在从 Google News 获取最新情报...</p>
        </div>;
    }

    if (error) {
        return <div className="news-state news-state--error">
            <p className="news-state__icon"><AlertTriangle size={24} /></p>
            <p className="news-state__error-msg">新闻加载失败: {error}</p>
            <button onClick={() => loadNews(true)} className="news-state__retry-btn">重新加载</button>
        </div>;
    }

    if (news.length === 0) {
        return <div className="news-state">
            <p className="news-state__icon"><Inbox size={24} /></p>
            <p>暂无相关新闻，换个关键词试试？</p>
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

            <div className="news-header">
                <div className="news-header__left">
                    <h2 className={`news-header__title ${selectedCoin === 'BTC' ? 'news-header__title--btc' : 'news-header__title--eth'}`}>
                        {selectedCoin === 'BTC' ? '₿' : 'Ξ'} 市场情报
                    </h2>
                    <button
                        type="button"
                        onClick={handleAnalyzeRemaining}
                        disabled={analyzingRemaining}
                        className="news-header__hint news-header__analyze-btn"
                    >
                        <Zap size={14} /> 点击分析
                    </button>
                </div>

                {/* 控制按钮组 */}
                <div className="news-header__controls">
                    {/* 日期范围选择 */}
                    <select
                        value={dateRange}
                        onChange={e => setDateRange(Number(e.target.value))}
                        className="news-date-select"
                    >
                        <option value={7}>近7天</option>
                        <option value={15}>近15天</option>
                        <option value={30}>近30天</option>
                        <option value={180}>近半年</option>
                        <option value={365}>近一年</option>
                    </select>

                    {/* 手动刷新按钮 */}
                    <button
                        onClick={handleManualRefresh}
                        disabled={loading}
                        className="news-refresh-btn"
                    >
                        {loading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} {loading ? '加载中...' : '刷新'}
                    </button>

                    {/* 分析剩余新闻按钮 */}
                    {(() => {
                        const unanalyzedCount = news.filter(n => !n.analyzed).length;
                        if (unanalyzedCount === 0) return null;
                        return (
                            <button
                                onClick={handleAnalyzeRemaining}
                                disabled={analyzingRemaining}
                                className="news-analyze-btn"
                            >
                                {analyzingRemaining ? <><Loader2 size={14} className="spin" /> 分析中...</> : <><Bot size={14} /> 分析剩余 {unanalyzedCount} 条</>}
                            </button>
                        );
                    })()}
                </div>
            </div>

            {/* 情绪筛选栏 */}
            <div className="news-filter-bar">
                {/* 情绪标签组 */}
                <div className="news-filter-bar__tags">
                    <span className="news-filter-bar__label">情绪:</span>
                    {[
                        { value: 'all', label: '全部', color: '#6b7280' },
                        { value: 'bullish', label: '利好', color: 'var(--color-success)' },
                        { value: 'neutral', label: '中性', color: 'var(--text-muted)' },
                        { value: 'bearish', label: '利空', color: 'var(--color-danger)' }
                    ].map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setSentimentFilter(opt.value)}
                            className={`news-filter-bar__tag ${sentimentFilter === opt.value ? 'news-filter-bar__tag--active news-filter-bar__tag--active-dynamic' : ''}`}
                            style={sentimentFilter === opt.value ? {
                                '--tag-color': opt.color,
                                '--tag-color-alpha-20': `${opt.color}20`,
                            } : undefined}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                {/* 分隔线 */}
                <div className="news-filter-bar__divider"></div>

                {/* 分数滑块 (仅中性时禁用) */}
                <div className={`news-filter-bar__slider-group ${sentimentFilter === 'neutral' ? 'news-filter-bar__slider-group--disabled' : ''}`}>
                    <span className="news-filter-bar__label">
                        {sentimentFilter === 'bullish' ? '利好程度≥' : sentimentFilter === 'bearish' ? '利空程度≥' : '强度≥'}
                    </span>
                    <input
                        type="range"
                        min="1"
                        max="5"
                        value={minScore}
                        onChange={e => setMinScore(Number(e.target.value))}
                        disabled={sentimentFilter === 'neutral'}
                        className="news-filter-bar__slider"
                    />
                    <span
                        className="news-filter-bar__score news-filter-bar__score--dynamic"
                        style={{
                            '--score-color': sentimentFilter === 'bullish' ? 'var(--color-success)' : sentimentFilter === 'bearish' ? 'var(--color-danger)' : '#60a5fa',
                        }}
                    >
                        {minScore}/5
                    </span>
                </div>

                {/* 筛选结果统计 */}
                <span className="news-filter-bar__count">
                    共 {filteredNews.length} / {news.length} 条
                </span>
            </div>

            <div className="news-grid">
                {filteredNews.slice(0, visibleCount).map((item, index) => {
                    // 计算情感颜色 (带等级)
                    const sentimentColor = getSentimentColor(item.sentiment, item.sentiment_level);

                    return (
                        <div
                            key={item.id || index}
                            onClick={() => handleNewsClick(item)}
                            className="news-card"
                        >
                            {/* 顶部元数据行 */}
                            <div className="news-card__meta">
                                <div className="news-card__meta-left">
                                    <span className="news-card__flag">{item.originalLang === 'en' ? <Globe size={12} /> : <Globe size={12} />}</span>
                                    <span className="news-card__date">
                                        <Calendar size={12} /> {new Date(item.publishedAt).toLocaleString(undefined, {
                                            month: '2-digit',
                                            day: '2-digit',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </span>
                                </div>

                                <span className="news-card__sentiment-badge news-card__sentiment-badge--dynamic" style={{
                                    '--sentiment-color': sentimentColor,
                                    '--sentiment-color-alpha-20': `${sentimentColor}20`,
                                    '--sentiment-color-alpha-40': `${sentimentColor}40`,
                                }}>
                                    {item.sentiment_cn || (item.sentiment === 'bullish' ? <><Rocket size={12} /> 利好</> : item.sentiment === 'bearish' ? <><TrendingDown size={12} /> 利空</> : <><Scale size={12} /> 中性</>)}
                                    {item.sentiment_level && ` (${item.sentiment_level}/5)`}
                                </span>
                                {/* AI分析标识 */}
                                {item.aiAnalyzed && (
                                    <span className="news-card__ai-badge">
                                        <Bot size={12} /> AI
                                    </span>
                                )}
                            </div>

                            {/* 标题 */}
                            <h3 className="news-card__title">
                                {item.title_cn || item.title}
                            </h3>

                            {/* 摘要内容 - 展示更多 */}
                            <p className="news-card__summary">
                                {item.summary_cn || item.snippet}
                            </p>

                            {/* 底部来源信息 */}
                            <div className="news-card__footer">
                                <span className="news-card__source-label">
                                    Your source
                                </span>
                                <span className="news-card__source-name">
                                    {item.source}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Pagination Button */}
            {visibleCount < filteredNews.length && (
                <div className="news-load-more">
                    <button
                        onClick={handleLoadMore}
                        className="news-load-more__btn"
                    >
                        <ChevronsDown size={16} /> 加载更多 ({news.length - visibleCount} remaining)
                    </button>
                </div>
            )}
        </div>
    );
};

export default NewsGrid;
