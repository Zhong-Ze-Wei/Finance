// SmartChartWidget.jsx - 智能图表组件（TradingView 降级到 Lightweight Charts）
import React, { useState, useEffect, useRef } from 'react';
import { fetchOHLCByAsset } from '../services/api';

const SmartChartWidget = ({ selectedAsset, interval = 'D' }) => {
    const [useLightweight, setUseLightweight] = useState(false);
    const [ohlcData, setOhlcData] = useState([]);
    const [loading, setLoading] = useState(true);
    const containerRef = useRef(null);
    const tvContainerRef = useRef(null);
    const chartInstanceRef = useRef(null);

    // 判断是否应该使用 Lightweight Charts（A股/港股部分代码在 TradingView 上不可用）
    const shouldUseLightweight = (asset) => {
        if (!asset) return false;

        // 强制使用 Lightweight 的条件
        const ohlcId = asset.ohlcId || '';

        // A股（部分代码 TradingView 不支持）
        if (ohlcId.includes('.SS') || ohlcId.includes('.SZ')) {
            return true;
        }

        // 港股（部分代码 TradingView 不支持）
        if (ohlcId.includes('.HK')) {
            return true;
        }

        return false;
    };

    // 加载 OHLC 数据（用于 Lightweight Charts）
    useEffect(() => {
        if (!selectedAsset) return;

        const needsLightweight = shouldUseLightweight(selectedAsset);
        setUseLightweight(needsLightweight);

        if (needsLightweight) {
            setLoading(true);
            fetchOHLCByAsset(selectedAsset, interval)
                .then(data => {
                    setOhlcData(data || []);
                    setLoading(false);
                })
                .catch(err => {
                    console.error('OHLC data fetch failed:', err);
                    setOhlcData([]);
                    setLoading(false);
                });
        } else {
            setLoading(false);
        }
    }, [selectedAsset, interval]);

    // 渲染 TradingView
    useEffect(() => {
        if (useLightweight || !selectedAsset?.symbol || !tvContainerRef.current) return;

        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        script.onload = () => {
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
                    container_id: 'tradingview-widget-container'
                });
            }
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

    if (useLightweight) {
        return (
            <div style={{ position: 'relative' }}>
                {/* Lightweight Charts 提示标签 */}
                <div style={{
                    position: 'absolute',
                    top: '0.75rem',
                    right: '0.75rem',
                    zIndex: 10,
                    background: 'rgba(96, 165, 250, 0.1)',
                    border: '1px solid rgba(96, 165, 250, 0.3)',
                    borderRadius: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.75rem',
                    color: '#60a5fa',
                    fontWeight: '600'
                }}>
                    📊 Yahoo Finance 数据源
                </div>
                <div ref={containerRef} style={{ width: '100%', height: '500px', borderRadius: '0.75rem', overflow: 'hidden' }} />
            </div>
        );
    }

    return (
        <div
            id="tradingview-widget-container"
            ref={tvContainerRef}
            style={{ width: '100%', height: '500px', borderRadius: '0.75rem', overflow: 'hidden' }}
        />
    );
};

export default SmartChartWidget;
