// SmartChartWidget.jsx - 智能图表组件（TradingView 降级到 Lightweight Charts）
import React, { useState, useEffect, useRef } from 'react';
import { fetchOHLCByAsset } from '../services/api';

// TradingView 已知支持的交易所前缀
const TV_SUPPORTED_PREFIXES = [
    'BINANCE:', 'BITSTAMP:', 'COINBASE:', 'KRAKEN:', 'BITFINEX:', 'BYBIT:', 'OKX:', 'HUOBI:', 'KUCOIN:',
    'NASDAQ:', 'NYSE:', 'AMEX:', 'ARCA:', 'BATS:',
    'TVC:', 'OANDA:', 'FOREXCOM:', 'FX:', 'FX_IDC:', 'FXCM:',
    'COMEX:', 'NYMEX:', 'CME:', 'CBOT:', 'ICEEUR:',
    'INDEX:', 'DJ:', 'SP:', 'FRED:', 'ECONOMICS:', 'QUANDL:',
    'HKEX:', 'TSE:', 'NSE:', 'BSE:', 'LSE:', 'EURONEXT:',
    'CURRENCYCOM:', 'CAPITALCOM:', 'PEPPERSTONE:', 'EASYMARKETS:',
    'GLOBALPRIME:', 'SKILLING:', 'VANTAGE:', 'SAXO:',
];

// 缓存 TradingView 不支持的 symbol（localStorage）
const TV_FAILED_CACHE_KEY = 'tv_failed_symbols';

const getTvFailedSymbols = () => {
    try {
        return JSON.parse(localStorage.getItem(TV_FAILED_CACHE_KEY)) || [];
    } catch {
        return [];
    }
};

const addTvFailedSymbol = (symbol) => {
    const list = getTvFailedSymbols();
    if (!list.includes(symbol)) {
        list.push(symbol);
        localStorage.setItem(TV_FAILED_CACHE_KEY, JSON.stringify(list));
        console.log(`📝 已缓存 TradingView 不支持的 symbol: ${symbol}`);
    }
};

// 清除失败缓存（用于调试或重置）
export const clearTvFailedCache = () => {
    localStorage.removeItem(TV_FAILED_CACHE_KEY);
    console.log('🧹 已清除 TradingView 失败缓存');
};

const isTvFailedSymbol = (symbol) => {
    return getTvFailedSymbols().includes(symbol);
};

const SmartChartWidget = ({ selectedAsset, interval = 'D' }) => {
    const [useLightweight, setUseLightweight] = useState(false);
    const [tvFailed, setTvFailed] = useState(false);
    const [ohlcData, setOhlcData] = useState([]);
    const [loading, setLoading] = useState(true);
    const containerRef = useRef(null);
    const tvContainerRef = useRef(null);
    const chartInstanceRef = useRef(null);

    // 判断是否应该使用 Lightweight Charts
    const shouldUseLightweight = (asset) => {
        if (!asset) return false;

        const ohlcId = asset.ohlcId || '';
        const symbol = asset.symbol || '';

        console.log(`🔍 SmartChart 检查资产: ${asset.name}, symbol="${symbol}", ohlcId="${ohlcId}"`);

        // A股/港股直接降级
        if (ohlcId.includes('.SS') || ohlcId.includes('.SZ') || ohlcId.includes('.HK')) {
            console.log(`📊 ${asset.name}: A股/港股，使用 Lightweight Charts`);
            return true;
        }

        // 没有 symbol 的资产
        if (!symbol) {
            console.log(`⚠️ ${asset.name}: 没有 symbol，使用 Lightweight Charts`);
            return true;
        }

        // 检查缓存：之前加载失败过的 symbol 直接降级
        if (isTvFailedSymbol(symbol)) {
            console.log(`⚡ ${asset.name}: 从缓存判断 "${symbol}" 需要降级`);
            return true;
        }

        // 检查是否是 TradingView 支持的格式 (必须有交易所前缀)
        const upperSymbol = symbol.toUpperCase();
        const hasSupportedPrefix = TV_SUPPORTED_PREFIXES.some(prefix =>
            upperSymbol.startsWith(prefix)
        );

        if (!hasSupportedPrefix) {
            console.log(`❌ ${asset.name}: Symbol "${symbol}" 没有已知的 TradingView 交易所前缀，将使用 Lightweight Charts`);
            return true;
        }

        console.log(`✅ ${asset.name}: 使用 TradingView (${symbol})`);
        return false;
    };

    // 加载 OHLC 数据（用于 Lightweight Charts）
    const loadLightweightData = async () => {
        if (!selectedAsset) return;
        setLoading(true);
        try {
            const data = await fetchOHLCByAsset(selectedAsset, interval);
            setOhlcData(data || []);
        } catch (err) {
            console.error('OHLC data fetch failed:', err);
            setOhlcData([]);
        }
        setLoading(false);
    };

    // 加载 OHLC 数据（用于 Lightweight Charts）
    useEffect(() => {
        if (!selectedAsset) return;

        // 重置状态
        setTvFailed(false);
        const needsLightweight = shouldUseLightweight(selectedAsset);
        setUseLightweight(needsLightweight);

        if (needsLightweight) {
            loadLightweightData();
        } else {
            setLoading(false);
        }
    }, [selectedAsset, interval]);

    // 监听 TradingView postMessage 检测加载失败
    useEffect(() => {
        if (useLightweight) return;

        const handleMessage = (event) => {
            // 检查是否来自 TradingView
            if (!event.origin.includes('tradingview')) return;

            try {
                const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

                // 检测 symbol 解析失败
                // TradingView 当 symbol 不存在时会发送 pineError 或切换到默认 symbol
                if (data.name === 'symbolError' ||
                    data.name === 'symbolNotFound' ||
                    data.name === 'tv.symbolNotFound' ||
                    (data.name === 'quoteUpdate' && data.data?.s !== selectedAsset?.symbol)) {
                    console.warn('TradingView symbol failed, switching to Lightweight Charts');
                    setTvFailed(true);
                }

                // 检测 "only available on TradingView" 错误
                if (data.type === 'error' || data.name === 'error') {
                    console.warn('TradingView error detected:', data);
                    setTvFailed(true);
                }
            } catch (e) {
                // 非 JSON 消息，忽略
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [useLightweight, selectedAsset]);

    // 当 tvFailed 变为 true 时，清除 TradingView 并加载 Lightweight 数据
    useEffect(() => {
        if (tvFailed && !useLightweight) {
            // 缓存失败的 symbol，下次直接使用降级方案
            if (selectedAsset?.symbol) {
                addTvFailedSymbol(selectedAsset.symbol);
            }

            // 强制清除 TradingView iframe
            if (tvContainerRef.current) {
                tvContainerRef.current.innerHTML = '';
            }
            // 清除可能被 TradingView 添加到 body 的元素
            document.querySelectorAll('iframe[src*="tradingview"]').forEach(el => el.remove());

            setUseLightweight(true);
            loadLightweightData();
        }
    }, [tvFailed]);

    // 渲染 TradingView
    useEffect(() => {
        if (useLightweight || !selectedAsset?.symbol || !tvContainerRef.current) return;

        // 清空容器
        if (tvContainerRef.current) {
            tvContainerRef.current.innerHTML = '';
        }

        const initWidget = () => {
            if (window.TradingView && tvContainerRef.current) {
                new window.TradingView.widget({
                    width: '100%',
                    height: 500,
                    symbol: selectedAsset.symbol,
                    interval: interval,
                    timezone: 'Asia/Shanghai',
                    theme: 'dark',
                    style: '1',
                    locale: 'zh_CN',
                    toolbar_bg: '#0d1117',
                    enable_publishing: false,
                    hide_top_toolbar: false,
                    hide_legend: false,
                    save_image: false,
                    container_id: 'tradingview-widget-container',
                    autosize: false,
                });

                // 延迟检测：通过 MutationObserver 监听是否出现错误提示
                setTimeout(() => {
                    const container = tvContainerRef.current;
                    if (!container) return;

                    // 检查是否存在错误文本（TradingView 会在 iframe 外显示某些错误）
                    const text = container.textContent || '';
                    if (text.includes('only available') ||
                        text.includes('Symbol not found') ||
                        text.includes('仅在 TradingView') ||
                        text.includes('商品代码仅')) {
                        console.warn('TradingView symbol not available, switching to Lightweight');
                        setTvFailed(true);
                    }
                }, 3000);

                // 额外检测：5秒后检查图表是否显示了预期的 symbol
                setTimeout(() => {
                    const container = tvContainerRef.current;
                    if (!container) return;

                    const text = container.textContent || '';
                    // 如果显示了 AAPL 但我们请求的不是 AAPL，说明降级了
                    if (text.includes('AAPL') && !selectedAsset.symbol.includes('AAPL')) {
                        console.warn('TradingView defaulted to AAPL, switching to Lightweight');
                        setTvFailed(true);
                    }
                }, 5000);
            }
        };

        // 如果 TradingView 已加载，直接使用
        if (window.TradingView) {
            initWidget();
            return () => {
                if (tvContainerRef.current) {
                    tvContainerRef.current.innerHTML = '';
                }
            };
        }

        // 否则加载脚本
        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        script.onload = initWidget;

        script.onerror = () => {
            console.error('TradingView script failed to load');
            setTvFailed(true);
        };

        document.head.appendChild(script);

        return () => {
            if (tvContainerRef.current) {
                tvContainerRef.current.innerHTML = '';
            }
        };
    }, [useLightweight, selectedAsset, interval]);

    // 渲染 Lightweight Charts
    useEffect(() => {
        if (!useLightweight || !containerRef.current || ohlcData.length === 0) return;

        import('lightweight-charts').then((module) => {
            const { createChart, ColorType, CrosshairMode, CandlestickSeries } = module;

            if (!containerRef.current) return;

            // 清理旧图表
            if (chartInstanceRef.current) {
                chartInstanceRef.current.remove();
            }

            const chart = createChart(containerRef.current, {
                width: containerRef.current.clientWidth,
                height: 500,
                layout: {
                    background: { type: ColorType.Solid, color: '#0d1117' },
                    textColor: '#8b949e',
                },
                grid: {
                    vertLines: { color: '#30363d' },
                    horzLines: { color: '#30363d' },
                },
                crosshair: { mode: CrosshairMode.Normal },
                timeScale: {
                    borderColor: '#30363d',
                    timeVisible: true,
                    secondsVisible: false,
                    tickMarkFormatter: (time) => {
                        const date = new Date(time * 1000);
                        const year = date.getFullYear();
                        const month = (date.getMonth() + 1).toString().padStart(2, '0');
                        const day = date.getDate().toString().padStart(2, '0');
                        return `${year}-${month}-${day}`;
                    },
                },
                rightPriceScale: {
                    borderColor: '#30363d',
                },
            });

            chartInstanceRef.current = chart;

            // 使用 v4 API：chart.addSeries(CandlestickSeries, options)
            const candleSeries = chart.addSeries(CandlestickSeries, {
                upColor: '#3fb950',
                downColor: '#f85149',
                borderUpColor: '#3fb950',
                borderDownColor: '#f85149',
                wickUpColor: '#3fb950',
                wickDownColor: '#f85149',
            });

            // 转换数据格式
            const chartData = ohlcData.map(item => ({
                time: item.time,
                open: item.open,
                high: item.high,
                low: item.low,
                close: item.close,
            }));

            candleSeries.setData(chartData);
            chart.timeScale().fitContent();

            // 响应式调整
            const handleResize = () => {
                if (containerRef.current && chart) {
                    chart.applyOptions({ width: containerRef.current.clientWidth });
                }
            };

            window.addEventListener('resize', handleResize);

            return () => {
                window.removeEventListener('resize', handleResize);
                if (chart) {
                    chart.remove();
                }
            };
        });
    }, [useLightweight, ohlcData]);

    if (loading) {
        return (
            <div style={{ height: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117', borderRadius: '0.75rem' }}>
                <div style={{ color: '#8b949e', fontSize: '1rem' }}>
                    ⏳ 加载图表数据...
                </div>
            </div>
        );
    }

    // 使用条件渲染，确保两个容器不会同时显示
    return (
        <div style={{ position: 'relative' }}>
            {/* Lightweight Charts 容器 */}
            {useLightweight && (
                <>
                    <div style={{
                        position: 'absolute',
                        top: '0.75rem',
                        right: '0.75rem',
                        zIndex: 10,
                        background: tvFailed ? 'rgba(251, 191, 36, 0.1)' : 'rgba(96, 165, 250, 0.1)',
                        border: `1px solid ${tvFailed ? 'rgba(251, 191, 36, 0.3)' : 'rgba(96, 165, 250, 0.3)'}`,
                        borderRadius: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.75rem',
                        color: tvFailed ? '#fbbf24' : '#60a5fa',
                        fontWeight: '600'
                    }}>
                        {tvFailed ? '⚠️ TradingView 不支持，已降级' : '📊 Lightweight Charts'}
                    </div>
                    <div ref={containerRef} style={{ width: '100%', height: '500px', borderRadius: '0.75rem', overflow: 'hidden', background: '#0d1117' }} />
                </>
            )}

            {/* TradingView 容器 - 降级时隐藏 */}
            <div
                id="tradingview-widget-container"
                ref={tvContainerRef}
                style={{
                    width: '100%',
                    height: '500px',
                    borderRadius: '0.75rem',
                    overflow: 'hidden',
                    display: useLightweight ? 'none' : 'block'
                }}
            />
        </div>
    );
};

export default SmartChartWidget;
