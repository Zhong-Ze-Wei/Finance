// ChartAnalysisModal.jsx - 左右布局 + 图表类型切换
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, AlertTriangle } from 'lucide-react';
import { fetchOHLCData, fetchOHLCByAsset, streamChartAnalysis } from '../services/api';
import { generateAnalysisContext } from '../utils/indicators';
import './ChartAnalysisModal.css';

// ============================================
// TradingView 图表组件 (支持动态 symbol)
// ============================================
const TradingViewChart = ({ symbol, interval }) => {
    const container = useRef();

    // TradingView Symbol 格式转换
    let tvSymbol = symbol;
    if (symbol.endsWith('.SZ')) {
        tvSymbol = `SZSE:${symbol.replace('.SZ', '')}`;
    } else if (symbol.endsWith('.SS')) {
        tvSymbol = `SSE:${symbol.replace('.SS', '')}`;
    } else if (symbol.endsWith('.HK')) {
        tvSymbol = `HKEX:${symbol.replace('.HK', '')}`;
    } else if (!symbol.includes(':') && /^[A-Z]+$/.test(symbol)) {
        // 美股直接用 ticker，TradingView 会自动识别，或者加上 NASDAQ/NYSE 前缀
        // 这里保持原样让 TradingView 自动匹配
        tvSymbol = symbol;
    }

    const widgetId = useRef(`tv_modal_${tvSymbol.replace(/[^a-zA-Z0-9]/g, '')}_${Date.now()}`);

    useEffect(() => {
        if (!container.current) return;
        container.current.innerHTML = '';

        const widgetContainer = document.createElement("div");
        widgetContainer.className = "tradingview-widget-container";
        widgetContainer.style.height = "100%";
        widgetContainer.style.width = "100%";

        const widgetDiv = document.createElement("div");
        widgetDiv.className = "tradingview-widget-container__widget";
        widgetDiv.id = widgetId.current;
        widgetDiv.style.height = "100%";
        widgetDiv.style.width = "100%";
        widgetContainer.appendChild(widgetDiv);

        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
        script.type = "text/javascript";
        script.async = true;
        script.innerHTML = JSON.stringify({
            "autosize": true,
            "symbol": tvSymbol,
            "interval": interval,
            "timezone": "Asia/Shanghai",
            "theme": "dark",
            "style": "1",
            "locale": "zh_CN",
            "enable_publishing": false,
            "hide_top_toolbar": false,
            "hide_legend": false,
            "allow_symbol_change": false,
            "save_image": false,
            "calendar": false,
            "hide_volume": false,
            "support_host": "https://www.tradingview.com",
            "container_id": widgetId.current,
            "studies": [
                "MAExp@tv-basicstudies",
                "RSI@tv-basicstudies"
            ]
        });
        widgetContainer.appendChild(script);
        container.current.appendChild(widgetContainer);

        return () => {
            if (container.current) container.current.innerHTML = '';
        };
    }, [tvSymbol, interval]);

    return <div ref={container} className="cam-chart-container" />;
};

// ============================================
// Lightweight Charts 组件 (自定义指标)
// ============================================
const LightweightChart = ({ coin, ohlcData }) => {
    const containerRef = useRef();
    const chartRef = useRef(null);

    useEffect(() => {
        if (!containerRef.current || !ohlcData || ohlcData.length === 0) return;

        // 动态加载 lightweight-charts (v4 API)
        import('lightweight-charts').then((LightweightCharts) => {
            // 清理旧图表
            if (chartRef.current) {
                chartRef.current.remove();
            }

            const chart = LightweightCharts.createChart(containerRef.current, {
                width: containerRef.current.clientWidth,
                height: containerRef.current.clientHeight,
                layout: {
                    background: { type: LightweightCharts.ColorType.Solid, color: '#0d1117' },
                    textColor: '#d1d5db',
                },
                grid: {
                    vertLines: { color: '#1f2937' },
                    horzLines: { color: '#1f2937' },
                },
                crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
                rightPriceScale: { borderColor: '#374151' },
                timeScale: { borderColor: '#374151', timeVisible: true },
            });
            chartRef.current = chart;

            // 确保数据按时间升序排列
            const sortedOhlc = [...ohlcData].sort((a, b) => (a.time || a[0]) - (b.time || b[0]));

            // 蜡烛图 (v4 API)
            const candleSeries = chart.addSeries(LightweightCharts.CandlestickSeries, {
                upColor: '#10b981',
                downColor: '#ef4444',
                borderUpColor: '#10b981',
                borderDownColor: '#ef4444',
                wickUpColor: '#10b981',
                wickDownColor: '#ef4444',
            });

            const formattedData = sortedOhlc.map(d => ({
                time: Math.floor((d.time || d[0]) / (d.time > 1e10 ? 1000 : 1)), // 处理毫秒或秒时间戳
                open: d.open || d[1],
                high: d.high || d[2],
                low: d.low || d[3],
                close: d.close || d[4],
            }));

            console.log(`📊 [Chart] OHLC Data: ${formattedData.length} candles`);
            candleSeries.setData(formattedData);

            const closePrices = formattedData.map(d => d.close);

            // EMA 144 (橙色)
            const ema144Data = calculateEMA(closePrices, 144);
            console.log(`📊 [Chart] EMA144 data points: ${ema144Data.length}`);
            if (ema144Data.length > 0) {
                const ema144Series = chart.addSeries(LightweightCharts.LineSeries, { color: '#f59e0b', lineWidth: 2 });
                const startIdx = formattedData.length - ema144Data.length;
                const ema144Formatted = ema144Data.map((v, i) => ({
                    time: formattedData[startIdx + i]?.time,
                    value: v
                })).filter(d => d.time);
                ema144Series.setData(ema144Formatted);
            }

            // EMA 169 (红色)
            const ema169Data = calculateEMA(closePrices, 169);
            console.log(`📊 [Chart] EMA169 data points: ${ema169Data.length}`);
            if (ema169Data.length > 0) {
                const ema169Series = chart.addSeries(LightweightCharts.LineSeries, { color: '#dc2626', lineWidth: 2 });
                const startIdx = formattedData.length - ema169Data.length;
                const ema169Formatted = ema169Data.map((v, i) => ({
                    time: formattedData[startIdx + i]?.time,
                    value: v
                })).filter(d => d.time);
                ema169Series.setData(ema169Formatted);
            }

            // EMA 12 (蓝色过滤线)
            const ema12Data = calculateEMA(closePrices, 12);
            if (ema12Data.length > 0) {
                const ema12Series = chart.addSeries(LightweightCharts.LineSeries, { color: '#3b82f6', lineWidth: 1 });
                const startIdx = formattedData.length - ema12Data.length;
                const ema12Formatted = ema12Data.map((v, i) => ({
                    time: formattedData[startIdx + i]?.time,
                    value: v
                })).filter(d => d.time);
                ema12Series.setData(ema12Formatted);
            }

            chart.timeScale().fitContent();

            // Resize handler
            const resizeObserver = new ResizeObserver(() => {
                if (containerRef.current) {
                    chart.applyOptions({ width: containerRef.current.clientWidth });
                }
            });
            resizeObserver.observe(containerRef.current);

            return () => resizeObserver.disconnect();
        });

        return () => {
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
            }
        };
    }, [coin, ohlcData]);

    return <div ref={containerRef} className="cam-chart-container" />;
};

// 简易 EMA 计算
function calculateEMA(data, period) {
    const k = 2 / (period + 1);
    const ema = [];
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            sum += data[i];
        } else if (i === period - 1) {
            sum += data[i];
            ema.push(sum / period);
        } else {
            ema.push(data[i] * k + ema[ema.length - 1] * (1 - k));
        }
    }
    return ema;
}

// 将 TradingView interval 转换为 OKX interval
// OKX 格式: 1m, 5m, 15m, 30m, 1H, 4H, 1D, 1W
function convertToOkxInterval(tvInterval) {
    const map = {
        '1': '1m', '5': '5m', '15': '15m', '30': '30m',
        '60': '1H', '240': '4H', 'D': '1D', 'W': '1W'
    };
    return map[tvInterval] || '1H';
}

// ============================================
// 主组件 (支持 selectedAsset)
// ============================================
const ChartAnalysisModal = ({ isOpen, onClose, selectedAsset, selectedCoin, selectedInterval = '60' }) => {
    const [analysis, setAnalysis] = useState('');
    const [loading, setLoading] = useState(false);
    const [chartType, setChartType] = useState('tradingview'); // 'tradingview' | 'lightweight'
    const [ohlcData, setOhlcData] = useState([]);
    const abortControllerRef = useRef(null);

    // 转换为 OKX 格式 (如果是 OKX 数据源)
    const okxInterval = convertToOkxInterval(selectedInterval);

    // 获取动态 symbol
    const symbol = selectedAsset?.symbol || (selectedCoin === 'BTC' ? 'BINANCE:BTCUSDT' : 'BINANCE:ETHUSDT');
    const assetType = selectedAsset?.type || 'crypto';
    const assetName = selectedAsset?.name || selectedCoin;

    useEffect(() => {
        if (!isOpen) return;

        const runAnalysis = async () => {
            if (abortControllerRef.current) abortControllerRef.current.abort();
            const controller = new AbortController();
            abortControllerRef.current = controller;

            setAnalysis('');
            setLoading(true);

            try {
                // 使用统一接口获取 OHLC 数据 (根据资产类型路由)
                let data;
                if (selectedAsset) {
                    data = await fetchOHLCByAsset(selectedAsset, okxInterval);
                } else {
                    // 后备方案：使用旧 OKX API
                    data = await fetchOHLCData(selectedCoin, okxInterval);
                }

                setOhlcData(data);

                if (data && data.length > 0) {
                    const context = generateAnalysisContext(data, assetName);
                    // 将资产类型传递给 AI 分析
                    context.assetType = assetType;
                    context.assetName = assetName;

                    await streamChartAnalysis(context, (chunk) => {
                        setAnalysis(prev => prev + chunk);
                    }, controller.signal);
                } else {
                    setAnalysis(`⚠ 暂无 ${assetName} 的 K 线数据。\n\n可能原因：\n- 非交易时段\n- 数据源不支持该标的\n- API 限流`);
                }
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Analysis error:', error);
                    setAnalysis('⚠ 分析失败，请稍后重试。可能是 API 限流，等待 1 分钟后再试。');
                }
            } finally {
                setLoading(false);
                abortControllerRef.current = null;
            }
        };

        runAnalysis();
        return () => { if (abortControllerRef.current) abortControllerRef.current.abort(); };
    }, [isOpen, selectedAsset, selectedCoin]);

    if (!isOpen) return null;

    const intervalLabel = { '15': '15分钟', '60': '1小时', '240': '4小时', 'D': '日线' }[selectedInterval] || selectedInterval;

    return (
        <div className="cam-overlay" onClick={onClose}>
            <div className="cam-modal" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="cam-header">
                    <div className="cam-header__left">
                        <h2 className="cam-header__title">
                            <><Bot size={18} /> AI 交易导师</>
                            <span className="cam-header__badge">
                                {assetName} · {intervalLabel}
                            </span>
                        </h2>
                        {/* 图表类型切换 */}
                        <div className="cam-chart-toggle">
                            <button onClick={() => setChartType('tradingview')} className={`cam-chart-toggle__btn${chartType === 'tradingview' ? ' cam-chart-toggle__btn--active' : ''}`}>TradingView</button>
                            <button onClick={() => setChartType('lightweight')} className={`cam-chart-toggle__btn${chartType === 'lightweight' ? ' cam-chart-toggle__btn--active' : ''}`}>Lightweight (EMA可见)</button>
                        </div>
                    </div>
                    <button onClick={onClose} className="cam-close-btn">×</button>
                </div>

                {/* Main Content - 左右布局 */}
                <div className="cam-content">
                    {/* 左侧：K线图 */}
                    <div className="cam-chart-panel">
                        {chartType === 'tradingview' ? (
                            <TradingViewChart symbol={symbol} interval={selectedInterval} />
                        ) : (
                            <LightweightChart coin={assetName} ohlcData={ohlcData} />
                        )}
                    </div>

                    {/* 右侧：AI 分析内容 */}
                    <div className="cam-analysis-panel">
                        {loading && !analysis && (
                            <div className="cam-loading">
                                <div className="typing-indicator"><span></span><span></span><span></span></div>
                                <span className="cam-loading__text">AI 导师正在分析 K 线形态...</span>
                            </div>
                        )}

                        <div className="markdown-body cam-markdown">
                            <ReactMarkdown
                                components={{
                                    h2: ({ node, ...props }) => <h2 {...props} />,
                                    h3: ({ node, ...props }) => <h3 {...props} />,
                                    strong: ({ node, ...props }) => <strong {...props} />,
                                    p: ({ node, ...props }) => <p {...props} />,
                                    li: ({ node, ...props }) => <li {...props} />,
                                    ul: ({ node, ...props }) => <ul {...props} />,
                                }}
                            >
                                {analysis}
                            </ReactMarkdown>
                        </div>

                        {loading && analysis && (
                            <span className="cam-cursor"></span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChartAnalysisModal;
