// ChartAnalysisModal.jsx - 左右布局 + 图表类型切换
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { fetchOHLCData, fetchOHLCByAsset, streamChartAnalysis } from '../services/api';
import { generateAnalysisContext } from '../utils/indicators';

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

    return <div ref={container} style={{ height: "100%", width: "100%" }} />;
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

    return <div ref={containerRef} style={{ height: "100%", width: "100%" }} />;
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
                    setAnalysis(`⚠️ 暂无 ${assetName} 的 K 线数据。\n\n可能原因：\n- 非交易时段\n- 数据源不支持该标的\n- API 限流`);
                }
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Analysis error:', error);
                    setAnalysis('⚠️ 分析失败，请稍后重试。可能是 API 限流，等待 1 分钟后再试。');
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
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            backdropFilter: 'blur(10px)',
            zIndex: 3000,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
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
                display: 'flex', flexDirection: 'column'
            }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{
                    padding: '0.75rem 1.5rem',
                    borderBottom: '1px solid #30363d',
                    background: 'linear-gradient(135deg, #161b22 0%, #1f2937 100%)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            🤖 AI 交易导师
                            <span style={{ fontSize: '0.75rem', background: 'linear-gradient(135deg, #f0b90b 0%, #e85d04 100%)', padding: '2px 8px', borderRadius: '4px', color: '#000' }}>
                                {assetName} · {intervalLabel}
                            </span>
                        </h2>
                        {/* 图表类型切换 */}
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => setChartType('tradingview')} style={{
                                padding: '4px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.75rem',
                                background: chartType === 'tradingview' ? '#f0b90b' : '#374151',
                                color: chartType === 'tradingview' ? '#000' : '#fff'
                            }}>TradingView</button>
                            <button onClick={() => setChartType('lightweight')} style={{
                                padding: '4px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.75rem',
                                background: chartType === 'lightweight' ? '#f0b90b' : '#374151',
                                color: chartType === 'lightweight' ? '#000' : '#fff'
                            }}>Lightweight (EMA可见)</button>
                        </div>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
                        fontSize: '1.25rem', cursor: 'pointer', width: '32px', height: '32px',
                        borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>×</button>
                </div>

                {/* Main Content - 左右布局 */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    {/* 左侧：K线图 */}
                    <div style={{ width: '55%', height: '100%', borderRight: '1px solid #30363d', background: '#0d1117' }}>
                        {chartType === 'tradingview' ? (
                            <TradingViewChart symbol={symbol} interval={selectedInterval} />
                        ) : (
                            <LightweightChart coin={assetName} ohlcData={ohlcData} />
                        )}
                    </div>

                    {/* 右侧：AI 分析内容 */}
                    <div style={{ width: '45%', height: '100%', overflowY: 'auto', padding: '1.5rem', background: '#0d1117' }}>
                        {loading && !analysis && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#f0b90b', marginBottom: '1rem' }}>
                                <div className="typing-indicator"><span></span><span></span><span></span></div>
                                <span style={{ fontSize: '0.9rem' }}>AI 导师正在分析 K 线形态...</span>
                            </div>
                        )}

                        <div className="markdown-body" style={{ color: '#d1d5db', lineHeight: '1.8', fontSize: '0.95rem' }}>
                            <ReactMarkdown
                                components={{
                                    h2: ({ node, ...props }) => <h2 style={{ color: '#f0b90b', fontSize: '1.2rem', marginTop: '1.5rem', marginBottom: '0.75rem', borderBottom: '1px solid #30363d', paddingBottom: '0.5rem' }} {...props} />,
                                    h3: ({ node, ...props }) => <h3 style={{ color: '#58a6ff', fontSize: '1rem', marginTop: '1rem', marginBottom: '0.5rem' }} {...props} />,
                                    strong: ({ node, ...props }) => <strong style={{ color: '#f0b90b', fontWeight: 'bold', textDecoration: 'underline', textDecorationColor: '#f0b90b' }} {...props} />,
                                    p: ({ node, ...props }) => <p style={{ marginBottom: '0.75rem' }} {...props} />,
                                    li: ({ node, ...props }) => <li style={{ marginBottom: '0.25rem' }} {...props} />,
                                    ul: ({ node, ...props }) => <ul style={{ paddingLeft: '1.25rem', marginBottom: '0.75rem' }} {...props} />,
                                }}
                            >
                                {analysis}
                            </ReactMarkdown>
                        </div>

                        {loading && analysis && (
                            <span style={{ display: 'inline-block', width: '8px', height: '16px', background: '#f0b90b', verticalAlign: 'middle', marginLeft: '5px', animation: 'blink 1s infinite' }}></span>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes blink { 50% { opacity: 0; } }
                .typing-indicator span { display: inline-block; width: 6px; height: 6px; background: #f0b90b; border-radius: 50%; animation: type 1s infinite; margin-right: 4px; }
                .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
                .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
                @keyframes type { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
            `}</style>
        </div>
    );
};

export default ChartAnalysisModal;
