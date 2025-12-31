// PriceHeader.jsx - 重构版：统一卡片系统
import React, { useState, useEffect, useCallback } from 'react';
import { connectBinanceWebSocket, fetchAssetPrice } from '../services/api';
import { getVisibleCards, getHiddenCards } from '../services/assetCards';
import AssetCard, { ActionCard } from './AssetCard';
import CardManager from './CardManager';
import AddAssetModal from './AddAssetModal';

const MAX_VISIBLE_CARDS = 10;

const PriceHeader = ({ prices, setPrices, selectedCoin, setSelectedCoin, onAssetChange, cardPrices, setCardPrices }) => {
    const [visibleCards, setVisibleCards] = useState(getVisibleCards());
    const [hiddenCards, setHiddenCards] = useState(getHiddenCards());
    const [showManager, setShowManager] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);

    // 刷新卡片列表
    const refreshCards = useCallback(() => {
        setVisibleCards(getVisibleCards());
        setHiddenCards(getHiddenCards());
    }, []);

    // WebSocket 连接获取加密货币价格
    useEffect(() => {
        // 过滤出所有使用 coingecko 的加密货币卡片
        const cryptoAssets = visibleCards
            .filter(c => c.priceSource === 'coingecko')
            .map(c => ({ priceId: c.priceId, name: c.name }));

        const cleanup = connectBinanceWebSocket((data) => {
            setPrices(prev => ({
                ...prev,
                [data.symbol]: {
                    price: parseFloat(data.price),
                    change24h: parseFloat(data.priceChangePercent)
                }
            }));
        }, cryptoAssets);

        return cleanup;
    }, [setPrices, visibleCards]);

    // 获取股票价格 (Yahoo Finance)
    useEffect(() => {
        let pollCount = 0;
        const stockCards = visibleCards.filter(c => c.priceSource !== 'coingecko');

        if (stockCards.length > 0) {
            console.log(`🔄 启动股票价格轮询，资产数: ${stockCards.length}，间隔: 60秒`);
        }

        const fetchStockPrices = async () => {
            pollCount++;
            const timeStr = new Date().toLocaleTimeString('zh-CN');

            if (stockCards.length === 0) return;

            console.log(`⏱️ [${timeStr}] 股票价格轮询 #${pollCount}：正在获取 ${stockCards.length} 个资产...`);
            let successCount = 0;

            for (const card of stockCards) {
                try {
                    const priceData = await fetchAssetPrice(card);
                    if (priceData) {
                        successCount++;
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

            console.log(`✅ [${timeStr}] 股票价格更新：${successCount}/${stockCards.length} 个资产`);
        };

        fetchStockPrices();
        // 每分钟刷新一次股票价格
        const interval = setInterval(fetchStockPrices, 60000);
        return () => {
            if (stockCards.length > 0) {
                console.log('🔄 停止股票价格轮询');
            }
            clearInterval(interval);
        };
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

    const MAX_VISIBLE_CARDS = 6;

    // 显示的卡片（最多 MAX_VISIBLE_CARDS 张）
    const displayCards = visibleCards.slice(0, MAX_VISIBLE_CARDS);
    const overflowCount = visibleCards.length - MAX_VISIBLE_CARDS + hiddenCards.length;

    return (
        <div style={{ padding: '0 2rem', marginTop: '2rem', marginBottom: '1.5rem' }}>
            {/* 卡片列表容器 (居中) */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center', // 居中排布
                gap: '1.5rem',
                maxWidth: '1800px', // 稍微放宽一点
                margin: '0 auto'
            }}>
                {visibleCards.slice(0, MAX_VISIBLE_CARDS).map((card) => (
                    <AssetCard
                        key={card.id}
                        card={card}
                        isSelected={selectedCoin === card.name}
                        onClick={() => handleCardSelect(card)}
                        priceData={cardPrices[card.id]}
                    // 移除 showDeleteButton，在主界面不显示删除，保持整洁
                    />
                ))}

                {/* 统一的操作卡片 */}
                <ActionCard
                    onAdd={() => setShowAddModal(true)}
                    onManage={() => setShowManager(true)}
                />
            </div>

            {/* Asset Editor Modal */}
            <AddAssetModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onAdd={handleAddCard}
            />

            {/* Card Manager Modal */}
            <CardManager
                isOpen={showManager}
                onClose={() => {
                    setShowManager(false);
                    refreshCards();
                }}
                onCardsChange={refreshCards}
                onAddNew={() => {
                    setShowManager(false);
                    setShowAddModal(true);
                }}
                cardPrices={cardPrices}
            />
        </div>
    );
};

export default PriceHeader;
