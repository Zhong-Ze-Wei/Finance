import React, { useState, useEffect } from 'react';
import { fetchCryptoNews, analyzeNews } from '../services/api';
import './NewsFeed.css';
import {
    Newspaper, TrendingUp, TrendingDown, BarChart3,
    RefreshCw, Loader2, Bot, ExternalLink
} from 'lucide-react';

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

    const getSentimentClass = (sentiment) => {
        switch (sentiment) {
            case 'positive': return 'nf-card--positive';
            case 'negative': return 'nf-card--negative';
            default: return '';
        }
    };

    const getSentimentIcon = (sentiment) => {
        switch (sentiment) {
            case 'positive': return <TrendingUp size={14} />;
            case 'negative': return <TrendingDown size={14} />;
            default: return <BarChart3 size={14} />;
        }
    };

    if (loading) {
        return (
            <div>
                <h2 className="text-xl font-bold mb-md"><Newspaper size={20} /> 新闻动态</h2>
                <div className="shimmer nf-shimmer" />
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-md">
                <h2 className="text-xl font-bold"><Newspaper size={20} /> 新闻动态</h2>
                <button
                    onClick={loadNews}
                    className="btn btn-primary nf-refresh-btn"
                >
                    <RefreshCw size={14} /> 刷新
                </button>
            </div>

            <div className="flex flex-col gap-md">
                {news.map((item) => (
                    <div
                        key={item.id}
                        className={`card nf-card ${getSentimentClass(item.sentiment)} nf-card--dynamic-border`}
                        style={{ '--sentiment-color': getSentimentColor(item.sentiment) }}
                    >
                        <div className="flex items-center gap-sm mb-sm">
                            <span>{getSentimentIcon(item.sentiment)}</span>
                            <span className="text-sm nf-source">
                                {item.source}
                            </span>
                            <span className="text-sm nf-separator">·</span>
                            <span className="text-sm nf-date">
                                {new Date(item.publishedAt).toLocaleString('zh-CN', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </span>
                        </div>

                        <h3 className="font-bold mb-sm nf-title">
                            {item.title}
                        </h3>

                        <p className="text-sm nf-summary">
                            {item.summary}
                        </p>

                        <div className="flex gap-sm mt-md">
                            <button
                                onClick={() => handleAnalyze(item)}
                                disabled={analyzing === item.id}
                                className="btn btn-success nf-analyze-btn"
                            >
                                {analyzing === item.id ? <><Loader2 size={14} className="spin" /> 分析中...</> : <><Bot size={14} /> LLM分析</>}
                            </button>
                            <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn nf-source-link"
                            >
                                <ExternalLink size={14} /> 查看原文
                            </a>
                        </div>

                        {analysis[item.id] && (
                            <div className="mt-md nf-analysis">
                                <div className="text-sm font-bold mb-sm nf-analysis-title">
                                    <Bot size={14} /> AI 分析结果
                                </div>
                                <div className="text-sm nf-analysis-summary">
                                    <strong>摘要:</strong> {analysis[item.id].summary}
                                </div>
                                <div className="flex items-center gap-md text-sm">
                                    <span>
                                        <strong>情绪:</strong>{' '}
                                        <span className="nf-sentiment nf-sentiment--dynamic" style={{ '--sentiment-color': getSentimentColor(analysis[item.id].sentiment) }}>
                                            {analysis[item.id].sentiment}
                                        </span>
                                    </span>
                                    <span>
                                        <strong>影响力:</strong>{' '}
                                        <span className="nf-impact">
                                            {analysis[item.id].impact_score}/10
                                        </span>
                                    </span>
                                </div>
                                {analysis[item.id].key_points && (
                                    <div className="mt-sm">
                                        <div className="text-sm font-bold nf-keypoints-label">
                                            关键点:
                                        </div>
                                        <ul className="nf-keypoints-list">
                                            {analysis[item.id].key_points.map((point, idx) => (
                                                <li key={idx} className="text-sm nf-keypoints-item">
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
