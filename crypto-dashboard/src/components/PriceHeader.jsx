import React, { useState, useEffect } from 'react';
import { connectBinanceWebSocket } from '../services/api';

const PriceHeader = ({ prices, setPrices, selectedCoin, setSelectedCoin }) => {
    useEffect(() => {
        // Connect to Binance WebSocket for real-time prices
        const cleanup = connectBinanceWebSocket((data) => {
            setPrices(prev => ({
                ...prev,
                [data.symbol]: {
                    price: parseFloat(data.price),
                    change24h: parseFloat(data.priceChangePercent)
                }
            }));
        });

        return cleanup;
    }, [setPrices]);

    const renderPriceCard = (coin, symbol, color) => {
        const priceData = prices[coin] || { price: 0, change24h: 0 };
        const isPositive = priceData.change24h >= 0;
        const isSelected = selectedCoin === coin;

        return (
            <div
                onClick={() => setSelectedCoin(coin)}
                className="card"
                style={{
                    cursor: 'pointer',
                    border: isSelected ? `2px solid ${color}` : '1px solid rgba(255, 255, 255, 0.05)',
                    transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                    boxShadow: isSelected ? `0 0 20px ${color}40` : undefined
                }}
            >
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-sm">
                            <span style={{ fontSize: '1.5rem' }}>{symbol}</span>
                            <span className="text-xl font-bold" style={{ color }}>{coin}</span>
                        </div>
                        <div className="text-2xl font-mono font-bold mt-sm">
                            ${priceData.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>
                    <div className="text-lg font-bold" style={{ color: isPositive ? '#10b981' : '#ef4444' }}>
                        {isPositive ? '▲' : '▼'} {Math.abs(priceData.change24h).toFixed(2)}%
                    </div>
                </div>
                {priceData.price > 0 && (
                    <div className="mt-sm text-sm" style={{ color: '#9ca3af' }}>
                        实时更新 · WebSocket
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {renderPriceCard('BTC', '₿', '#f0b90b')}
            {renderPriceCard('ETH', 'Ξ', '#627eea')}
        </div>
    );
};

export default PriceHeader;
