// PriceHeader.jsx - 重构版：统一卡片系统
import React, { useState, useEffect, useCallback } from 'react';
import { connectBinanceWebSocket, fetchAssetPrice } from '../services/api';
import { getVisibleCards, getHiddenCards } from '../services/assetCards';
import AssetCard, { AddCardButton, MoreButton } from './AssetCard';
import CardManager from './CardManager';
import AddAssetModal from './AddAssetModal';

const MAX_VISIBLE_CARDS = 5;

const PriceHeader = ({ prices, setPrices, selectedCoin, setSelectedCoin, onAssetChange }) => {
    const [visibleCards, setVisibleCards] = useState(getVisibleCards());
    const [hiddenCards, setHiddenCards] = useState(getHiddenCards());
    const [showManager, setShowManager] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [cardPrices, setCardPrices] = useState({});

    // 刷新卡片列表
    const refreshCards = useCallback(() => {
        setVisibleCards(getVisibleCards());
        setHiddenCards(getHiddenCards());
    }, []);

    // WebSocket 连接获取加密货币价格
    useEffect(() => {
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

    // 获取股票价格 (Yahoo Finance)
    useEffect(() => {
        const fetchStockPrices = async () => {
            for (const card of visibleCards) {
                if (card.priceSource !== 'coingecko') {
                    try {
                        const priceData = await fetchAssetPrice(card);
                        if (priceData) {
                            setCardPrices(prev => ({
                                ...prev,
                                [card.id]: {
                                    price: priceData.price,
                                    change24h: priceData.change24h,
                                    currency: priceData.currency,
                                    loading: false
                                }
                            }));
                        }
                    } catch (e) {
                        console.error(`Failed to fetch price for ${card.name}:`, e);
                    }
                }
            }
        };

        fetchStockPrices();
        // 每分钟刷新一次股票价格
        const interval = setInterval(fetchStockPrices, 60000);
        return () => clearInterval(interval);
    }, [visibleCards]);

    // 同步加密货币 prices 到 cardPrices
    useEffect(() => {
        const newCardPrices = { ...cardPrices };

        visibleCards.forEach(card => {
            if (card.priceSource === 'coingecko') {
                // 加密货币使用 CoinGecko 数据
                const priceData = prices[card.name];
                if (priceData) {
                    newCardPrices[card.id] = {
                        price: priceData.price,
                        change24h: priceData.change24h,
                        loading: false
                    };
                }
            }
        });

        setCardPrices(newCardPrices);
    }, [prices, visibleCards]);

    // 处理卡片选择
    const handleCardSelect = (card) => {
        setSelectedCoin(card.name);
        onAssetChange?.(card);
    };

    // 处理新增卡片
    const handleAddCard = (newCard) => {
        refreshCards();
    };

    // 显示的卡片（最多 MAX_VISIBLE_CARDS 张）
    const displayCards = visibleCards.slice(0, MAX_VISIBLE_CARDS);
    const overflowCount = visibleCards.length - MAX_VISIBLE_CARDS + hiddenCards.length;

    return (
        <>
            <div style={{
                display: 'flex',
                gap: '0.75rem',
                flexWrap: 'nowrap',
                overflowX: 'auto',
                paddingBottom: '0.25rem'
            }}>
                {/* 可见卡片 */}
                {displayCards.map(card => (
                    <AssetCard
                        key={card.id}
                        card={card}
                        isSelected={selectedCoin === card.name}
                        onClick={() => handleCardSelect(card)}
                        priceData={cardPrices[card.id] || { loading: true }}
                    />
                ))}

                {/* 卡片管理按钮 (始终显示) */}
                <div
                    onClick={() => setShowManager(true)}
                    style={{
                        background: '#21262d',
                        border: '1px solid #30363d',
                        borderRadius: '0.75rem',
                        padding: '0.75rem 1rem',
                        cursor: 'pointer',
                        minWidth: '60px',
                        textAlign: 'center',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#30363d'}
                    onMouseLeave={e => e.currentTarget.style.background = '#21262d'}
                    title="管理全部卡片"
                >
                    <div style={{ fontSize: '1.1rem', color: '#8b949e' }}>⚙️</div>
                    <div style={{ fontSize: '0.7rem', color: '#6e7681', marginTop: '0.25rem' }}>管理</div>
                </div>

                {/* 添加按钮 */}
                <AddCardButton onClick={() => setShowAddModal(true)} />
            </div>

            {/* 卡片管理弹窗 */}
            <CardManager
                isOpen={showManager}
                onClose={() => setShowManager(false)}
                onCardsChange={refreshCards}
                onAddNew={() => setShowAddModal(true)}
            />

            {/* 添加标的弹窗 */}
            <AddAssetModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onAdd={handleAddCard}
            />
        </>
    );
};

export default PriceHeader;
