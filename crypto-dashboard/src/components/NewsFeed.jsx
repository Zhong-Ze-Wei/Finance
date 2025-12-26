import React, { useState, useEffect } from 'react';
import { fetchCryptoNews, analyzeNews } from '../services/api';

const NewsFeed = ({ coin }) => {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(null);
    const [analysis, setAnalysis] = useState({});

    useEffect(() => {
        loadNews();
    }, [coin]);

    const loadNews = async () => {
        setLoading(true);
        try {
            const data = await fetchCryptoNews(coin);
            setNews(data);
        } catch (error) {
            console.error('Failed to fetch news:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAnalyze = async (newsItem) => {
        setAnalyzing(newsItem.id);
        try {
            const result = await analyzeNews(newsItem.title + ' ' + newsItem.summary);
            setAnalysis(prev => ({
                ...prev,
                [newsItem.id]: result
            }));
        } catch (error) {
            console.error('Analysis failed:', error);
        } finally {
            setAnalyzing(null);
        }
    };

    const getSentimentColor = (sentiment) => {
        switch (sentiment) {
            case 'positive': return '#10b981';
            case 'negative': return '#ef4444';
            default: return '#9ca3af';
        }
    };

    const getSentimentIcon = (sentiment) => {
        switch (sentiment) {
            case 'positive': return '📈';
            case 'negative': return '📉';
            default: return '📊';
        }
    };

    if (loading) {
        return (
            <div>
                <h2 className="text-xl font-bold mb-md">📰 新闻动态</h2>
                <div className="shimmer" style={{ height: '400px', borderRadius: '0.5rem' }} />
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-md">
                <h2 className="text-xl font-bold">📰 新闻动态</h2>
                <button
                    onClick={loadNews}
                    className="btn btn-primary"
                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                >
                    🔄 刷新
                </button>
            </div>

            <div className="flex flex-col gap-md">
                {news.map((item) => (
                    <div
                        key={item.id}
                        className="card"
                        style={{
                            borderLeft: `3px solid ${getSentimentColor(item.sentiment)}`,
                            padding: '1rem'
                        }}
                    >
                        <div className="flex items-center gap-sm mb-sm">
                            <span>{getSentimentIcon(item.sentiment)}</span>
                            <span className="text-sm" style={{ color: '#9ca3af' }}>
                                {item.source}
                            </span>
                            <span className="text-sm" style={{ color: '#6b7280' }}>·</span>
                            <span className="text-sm" style={{ color: '#9ca3af' }}>
                                {new Date(item.publishedAt).toLocaleString('zh-CN', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </span>
                        </div>

                        <h3 className="font-bold mb-sm" style={{ fontSize: '0.95rem' }}>
                            {item.title}
                        </h3>

                        <p className="text-sm" style={{ color: '#d1d5db', lineHeight: '1.5' }}>
                            {item.summary}
                        </p>

                        <div className="flex gap-sm mt-md">
                            <button
                                onClick={() => handleAnalyze(item)}
                                disabled={analyzing === item.id}
                                className="btn btn-success"
                                style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}
                            >
                                {analyzing === item.id ? '⏳ 分析中...' : '🤖 LLM分析'}
                            </button>
                            <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn"
                                style={{
                                    fontSize: '0.75rem',
                                    padding: '0.4rem 0.8rem',
                                    background: 'var(--bg-tertiary)',
                                    color: 'var(--text-secondary)'
                                }}
                            >
                                🔗 查看原文
                            </a>
                        </div>

                        {analysis[item.id] && (
                            <div
                                className="mt-md"
                                style={{
                                    background: 'var(--bg-tertiary)',
                                    padding: '0.75rem',
                                    borderRadius: '0.5rem',
                                    borderLeft: `3px solid var(--accent-primary)`
                                }}
                            >
                                <div className="text-sm font-bold mb-sm" style={{ color: 'var(--accent-primary)' }}>
                                    🤖 AI 分析结果
                                </div>
                                <div className="text-sm" style={{ color: '#d1d5db', marginBottom: '0.5rem' }}>
                                    <strong>摘要:</strong> {analysis[item.id].summary}
                                </div>
                                <div className="flex items-center gap-md text-sm">
                                    <span>
                                        <strong>情绪:</strong>{' '}
                                        <span style={{ color: getSentimentColor(analysis[item.id].sentiment) }}>
                                            {analysis[item.id].sentiment}
                                        </span>
                                    </span>
                                    <span>
                                        <strong>影响力:</strong>{' '}
                                        <span style={{ color: 'var(--color-bitcoin)' }}>
                                            {analysis[item.id].impact_score}/10
                                        </span>
                                    </span>
                                </div>
                                {analysis[item.id].key_points && (
                                    <div className="mt-sm">
                                        <div className="text-sm font-bold" style={{ color: '#9ca3af' }}>
                                            关键点:
                                        </div>
                                        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.25rem' }}>
                                            {analysis[item.id].key_points.map((point, idx) => (
                                                <li key={idx} className="text-sm" style={{ color: '#d1d5db' }}>
                                                    {point}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default NewsFeed;
