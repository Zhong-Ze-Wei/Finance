import React, { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries } from 'lightweight-charts';
import { fetchHistoricalData } from '../services/api';

const CryptoChart = ({ coin }) => {
    const chartContainerRef = useRef(null);
    const chartRef = useRef(null);
    const candlestickSeriesRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        // Cleanup previous chart
        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
        }

        try {
            // Create chart with new API (v5+)
            const chart = createChart(chartContainerRef.current, {
                width: chartContainerRef.current.clientWidth,
                height: 500,
                layout: {
                    background: { color: '#161b22' },
                    textColor: '#d1d5db',
                },
                grid: {
                    vertLines: { color: '#1f293744' },
                    horzLines: { color: '#1f293744' },
                },
                crosshair: {
                    mode: 1,
                },
                rightPriceScale: {
                    borderColor: '#2B2B43',
                },
                timeScale: {
                    borderColor: '#2B2B43',
                    timeVisible: true,
                    secondsVisible: false,
                },
            });

            chartRef.current = chart;

            // Use new API: chart.addSeries(CandlestickSeries, options)
            const candlestickSeries = chart.addSeries(CandlestickSeries, {
                upColor: '#10b981',
                downColor: '#ef4444',
                borderUpColor: '#10b981',
                borderDownColor: '#ef4444',
                wickUpColor: '#10b981',
                wickDownColor: '#ef4444',
            });

            candlestickSeriesRef.current = candlestickSeries;

            // Load historical data
            const symbol = coin === 'BTC' ? 'BTCUSDT' : 'ETHUSDT';
            setLoading(true);
            setError(null);

            fetchHistoricalData(symbol)
                .then(data => {
                    candlestickSeries.setData(data);
                    chart.timeScale().fitContent();
                    setLoading(false);
                })
                .catch(err => {
                    console.error('Failed to load chart data:', err);
                    setError('加载数据失败');
                    setLoading(false);
                });

            // Handle resize
            const handleResize = () => {
                if (chartContainerRef.current && chartRef.current) {
                    chartRef.current.applyOptions({
                        width: chartContainerRef.current.clientWidth
                    });
                }
            };

            window.addEventListener('resize', handleResize);

            return () => {
                window.removeEventListener('resize', handleResize);
                if (chartRef.current) {
                    chartRef.current.remove();
                    chartRef.current = null;
                }
            };
        } catch (err) {
            console.error('Chart creation error:', err);
            setError('图表初始化失败: ' + err.message);
            setLoading(false);
        }
    }, [coin]);

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{coin}/USDT K线图</h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                        ● 模拟数据 · Lightweight Charts v5
                    </span>
                </div>
            </div>

            {loading && (
                <div style={{
                    height: '500px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#1f2937',
                    borderRadius: '0.5rem'
                }}>
                    <span style={{ color: '#9ca3af' }}>⏳ 加载中...</span>
                </div>
            )}

            {error && (
                <div style={{
                    height: '500px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#1f2937',
                    borderRadius: '0.5rem',
                    color: '#ef4444'
                }}>
                    ❌ {error}
                </div>
            )}

            <div
                ref={chartContainerRef}
                style={{
                    borderRadius: '0.5rem',
                    overflow: 'hidden',
                    display: loading || error ? 'none' : 'block'
                }}
            />
        </div>
    );
};

export default CryptoChart;
