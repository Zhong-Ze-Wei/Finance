// SmartChartWidget.jsx - 智能图表组件（TradingView 降级到 Lightweight Charts）
import React, { useState, useEffect, useRef } from 'react';
import { Loader2, AlertTriangle, BarChart3 } from 'lucide-react';
import { fetchOHLCByAsset } from '../services/api';
import { getChartSettings } from '../services/userSettings';
import './SmartChartWidget.css';

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

// TradingView 连通性预检（会话级缓存）
// tv.js 主脚本与 iframe embed 域名任一不可达（被墙/代理失效）即视为不可用
let tvAvailabilityCache = null;
const checkTradingViewAvailability = async () => {
    if (tvAvailabilityCache !== null) return tvAvailabilityCache;

    const checkUrl = (url) =>
        fetch(url, { method: 'HEAD', mode: 'no-cors', signal: AbortSignal.timeout(4000) })
            .then(() => true)
            .catch(() => false);

    const [scriptOk, embedOk] = await Promise.all([
        checkUrl('https://s3.tradingview.com/tv.js'),
        checkUrl('https://www.tradingview-widget.com')
    ]);
    tvAvailabilityCache = scriptOk && embedOk;
    if (!tvAvailabilityCache) {
        console.log('⚠️ TradingView 不可达（script:', scriptOk, 'embed:', embedOk, '），本次会话使用 Lightweight Charts');
    }
    return tvAvailabilityCache;
};

const SmartChartWidget = ({ selectedAsset, interval = 'D' }) => {
    const [useLightweight, setUseLightweight] = useState(false);
    const [tvFailed, setTvFailed] = useState(false);
    const [ohlcData, setOhlcData] = useState([]);
    const [loading, setLoading] = useState(true);
    const containerRef = useRef(null);
    const tvContainerRef = useRef(null);
    const chartInstanceRef = useRef(null);
    const requestIdRef = useRef(0); // 竞态保护：追踪最新请求

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

    // 加载 OHLC 数据（用于 Lightweight Charts）— 带竞态保护
    const loadLightweightData = async () => {
        if (!selectedAsset) return;
        const currentRequestId = ++requestIdRef.current;
        setLoading(true);
        try {
            const data = await fetchOHLCByAsset(selectedAsset, interval);
            // 竞态检查：如果用户已经切换到其他资产，丢弃结果
            if (currentRequestId !== requestIdRef.current) return;
            setOhlcData(data || []);
        } catch (err) {
            if (currentRequestId !== requestIdRef.current) return;
            console.error('OHLC data fetch failed:', err);
            setOhlcData([]);
        }
        if (currentRequestId === requestIdRef.current) {
            setLoading(false);
        }
    };

    // 加载 OHLC 数据（用于 Lightweight Charts）
    useEffect(() => {
        if (!selectedAsset) return;

        // 重置状态
        setTvFailed(false);
        const needsLightweight = shouldUseLightweight(selectedAsset);

        if (needsLightweight) {
            setUseLightweight(true);
            loadLightweightData();
            return;
        }

        // TradingView 路径：先做连通性预检，不可达直接降级（不写入永久失败缓存）
        let cancelled = false;
        checkTradingViewAvailability().then(ok => {
            if (cancelled) return;
            if (ok) {
                setUseLightweight(false);
                setLoading(false);
            } else {
                setUseLightweight(true);
                loadLightweightData();
            }
        });
        return () => { cancelled = true; };
    }, [selectedAsset, interval]);

    // 监听 TradingView postMessage 检测加载失败
    useEffect(() => {
        if (useLightweight) return;

        const handleMessage = (event) => {
            // 检查是否来自 TradingView
            if (!event.origin.includes('tradingview')) return;

            try {
                const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

                // 检测 symbol 解析失败（仅信任明确的错误信号；
                // quoteUpdate 不校验——其他资产的报价消息会造成误判并永久污染失败缓存）
                if (data.name === 'symbolError' ||
                    data.name === 'symbolNotFound' ||
                    data.name === 'tv.symbolNotFound') {
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
        // loading 期间容器未挂载（渲染的是 spinner），loading 结束后需重新执行
        if (loading || useLightweight || !selectedAsset?.symbol || !tvContainerRef.current) return;

        // 清空容器
        if (tvContainerRef.current) {
            tvContainerRef.current.innerHTML = '';
        }

        const initWidget = () => {
            if (window.TradingView && tvContainerRef.current) {
                new window.TradingView.widget({
                    width: '100%',
                    height: '100%',
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
                    autosize: true,
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
    }, [useLightweight, selectedAsset, interval, loading]);

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
                autoSize: true,
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

            // 使用用户设置的默认显示范围（而不是 fitContent 显示全部）
            const chartSettings = getChartSettings();
            const visibleBars = chartSettings.defaultVisibleBars || 120;

            if (chartData.length > visibleBars) {
                // 显示最近 N 根 K 线
                const fromIndex = chartData.length - visibleBars;
                chart.timeScale().setVisibleLogicalRange({
                    from: fromIndex,
                    to: chartData.length - 1
                });
            } else {
                // 数据不够时显示全部
                chart.timeScale().fitContent();
            }

            // autoSize 已由 ResizeObserver 内部处理，无需手动 resize

            return () => {
                if (chart) {
                    chart.remove();
                }
            };
        });
    }, [useLightweight, ohlcData]);

    if (loading) {
        return (
            <div className="scw-loading">
                <div className="scw-loading__text">
                    <Loader2 size={16} className="spin" /> 加载图表数据...
                </div>
            </div>
        );
    }

    // 使用条件渲染，确保两个容器不会同时显示
    return (
        <div className="scw-wrapper">
            {/* Lightweight Charts 容器 */}
            {useLightweight && (
                <>
                    <div className={`scw-badge ${tvFailed ? 'scw-badge--fallback' : 'scw-badge--default'}`}>
                        {tvFailed ? <><AlertTriangle size={14} /> TradingView 不支持，已降级</> : <><BarChart3 size={14} /> Lightweight Charts</>}
                    </div>
                    <div ref={containerRef} className="chart-container scw-chart" />
                </>
            )}

            {/* TradingView 容器 - 降级时隐藏 */}
            <div
                id="tradingview-widget-container"
                ref={tvContainerRef}
                className={`chart-container scw-tv-container ${useLightweight ? 'scw-tv-container--hidden' : ''}`}
            />
        </div>
    );
};

export default SmartChartWidget;
