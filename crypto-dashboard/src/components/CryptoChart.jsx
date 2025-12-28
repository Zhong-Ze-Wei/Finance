import React, { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, LineSeries } from 'lightweight-charts';

// 计算移动平均线 (SMA)
const calculateSMA = (data, period) => {
    const smaData = [];
    for (let i = period - 1; i < data.length; i++) {
        const sum = data.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val.close, 0);
        smaData.push({ time: data[i].time, value: sum / period });
    }
    return smaData;
};

import { fetchOHLCData } from '../services/api';

const CryptoChart = ({ coin, height = 500 }) => {
    const chartContainerRef = useRef(null);
    const chartRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        // 清理旧图表
        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
        }

        setLoading(true);
        setError(null);

        // 创建图表
        const chart = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: height,
            layout: {
                background: { color: 'transparent' }, // 透明背景适配父容器
                textColor: '#d1d5db',
            },
            grid: {
                vertLines: { color: '#1f293744' },
                horzLines: { color: '#1f293744' },
            },
            rightPriceScale: {
                borderColor: '#2B2B43',
            },
            timeScale: {
                borderColor: '#2B2B43',
                timeVisible: true,
                secondsVisible: false,
            },
            crosshair: {
                mode: 1, // CrosshairMode.Normal
            },
        });

        chartRef.current = chart;

        // K线系列
        const candlestickSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#10b981',
            downColor: '#ef4444',
            borderUpColor: '#10b981',
            borderDownColor: '#ef4444',
            wickUpColor: '#10b981',
            wickDownColor: '#ef4444',
        });

        // MA 线条 (MA20, MA60)
        const ma20Series = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1, title: 'MA20' });
        const ma60Series = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 1, title: 'MA60' });

        // 获取数据 (使用缓存 API)
        const loadData = async () => {
            try {
                const data = await fetchOHLCData(coin);

                // 设置数据
                candlestickSeries.setData(data);

                // 计算并设置 MA 数据
                const ma20Data = calculateSMA(data, 20);
                const ma60Data = calculateSMA(data, 60);
                ma20Series.setData(ma20Data);
                ma60Series.setData(ma60Data);

                chart.timeScale().fitContent();
                setLoading(false);
            } catch (err) {
                console.error(err);
                setError('Failed to load chart data');
                setLoading(false);
            }
        };

        loadData();

        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) {
                chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
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
    }, [coin, height]); // 依赖 height

    return (
        <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 'bold' }}>{coin}/USDT Technical Chart</h2>
                <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem' }}>
                    <span style={{ color: '#f59e0b' }}>● MA20</span>
                    <span style={{ color: '#3b82f6' }}>● MA60</span>
                </div>
            </div>

            {loading && (
                <div style={{
                    position: 'absolute', top: '40px', left: 0, right: 0, bottom: 0,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    background: '#0d1117', zIndex: 10
                }}>
                    <div style={{
                        width: '36px', height: '36px',
                        border: '3px solid #374151', borderTopColor: '#f0b90b',
                        borderRadius: '50%', animation: 'spin 1s linear infinite'
                    }} />
                    <span style={{ color: '#9ca3af', marginTop: '0.75rem', fontSize: '0.85rem' }}>
                        正在加载 K 线数据...
                    </span>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
            )}

            <div ref={chartContainerRef} style={{ height: `${height}px`, borderRadius: '0.5rem', overflow: 'hidden' }} />
        </div>
    );
};

export default CryptoChart;
