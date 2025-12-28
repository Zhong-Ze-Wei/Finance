import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    getAssetCards,
    toggleCardVisibility,
    deleteAssetCard,
    reorderCards,
    getPositionSummary
} from '../services/assetCards';
import AssetEditorModal from './AssetEditorModal';

const CardManager = ({ isOpen, onClose, onCardsChange, onAddNew, cardPrices }) => {
    const [cards, setCards] = useState(getAssetCards());
    const [animateOut, setAnimateOut] = useState(false);
    const [editingCard, setEditingCard] = useState(null);
    const [activeTab, setActiveTab] = useState('all'); // 'all', 'crypto', 'stock', 'etf', 'other'
    const [draggedCardId, setDraggedCardId] = useState(null);

    // 每次打开管理器时刷新卡片列表
    useEffect(() => {
        if (isOpen) {
            setCards(getAssetCards());
        }
    }, [isOpen]);

    const refreshCards = () => {
        setCards(getAssetCards());
        onCardsChange?.();
    };

    const handleToggleVisibility = (cardId) => {
        toggleCardVisibility(cardId);
        refreshCards();
    };

    const handleDelete = (cardId) => {
        if (window.confirm('确定删除此资产卡片？')) {
            deleteAssetCard(cardId);
            refreshCards();
        }
    };

    const handleEdit = (card) => {
        setEditingCard(card);
    };

    // 拖拽排序逻辑
    const handleDragStart = (e, card) => {
        setDraggedCardId(card.id);
        e.dataTransfer.effectAllowed = 'move';
        // 只有可见卡片可以拖拽排序
    };

    const handleDragOver = (e, targetCardId) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e, targetCardId) => {
        e.preventDefault();
        if (!draggedCardId || draggedCardId === targetCardId) return;

        // 重新排序
        const currentCards = [...cards];
        const visibleCards = currentCards.filter(c => c.visible).sort((a, b) => a.order - b.order);

        const draggedIndex = visibleCards.findIndex(c => c.id === draggedCardId);
        const targetIndex = visibleCards.findIndex(c => c.id === targetCardId);

        if (draggedIndex === -1 || targetIndex === -1) return;

        // 移动元素
        const [movedCard] = visibleCards.splice(draggedIndex, 1);
        visibleCards.splice(targetIndex, 0, movedCard);

        // 更新所有卡片的 order 并保存
        // 保持隐藏卡片的 order 不变，只更新可见卡片的相对顺序
        // 这里的逻辑稍微复杂，实际上 reorderCards 需要接收完整的排序后列表
        // 为了简单，我们只更新 visible cards 的 order，然后合并 hidden cards
        const reorderedIds = visibleCards.map(c => c.id);

        // 调用 service 更新
        reorderCards(reorderedIds);
        refreshCards();
        setDraggedCardId(null);
    };

    const handleClose = () => {
        setAnimateOut(true);
        setTimeout(() => {
            setAnimateOut(false);
            onClose();
            setActiveTab('all');
        }, 300);
    };

    if (!isOpen) return null;

    const visibleCards = cards.filter(c => c.visible).sort((a, b) => a.order - b.order);
    const hiddenCards = cards.filter(c => !c.visible);

    // 筛选 hidden cards
    const filteredHiddenCards = hiddenCards.filter(c => {
        if (activeTab === 'all') return true;

        // 映射 Tabs 到 category/type
        if (activeTab === 'crypto') return c.category === '加密货币' || c.type === 'crypto';
        if (activeTab === 'stock') return ['美股', 'A股', '港股'].includes(c.category) || c.type === 'stock';
        if (activeTab === 'etf') return c.category === 'ETF' || c.type === 'etf';
        return true;
    });

    const categories = [
        { id: 'all', label: '全部' },
        { id: 'crypto', label: '加密货币' },
        { id: 'stock', label: '股票' },
        { id: 'etf', label: 'ETF' },
    ];

    return createPortal(
        <div
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(20px)',
                zIndex: 3500,
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                opacity: animateOut ? 0 : 1,
                transition: 'opacity 0.3s ease',
                padding: '2rem'
            }}
            onClick={handleClose}
        >
            <div
                style={{
                    width: '95%',
                    maxWidth: '1100px', // 更加宽大的弹窗
                    height: '85vh',
                    background: 'linear-gradient(145deg, #0d1117 0%, #161b22 100%)',
                    borderRadius: '1.5rem',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 50px 100px -20px rgba(0, 0, 0, 0.8)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    transform: animateOut ? 'scale(0.95)' : 'scale(1)',
                    transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    padding: '1.5rem 2.5rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(22, 27, 34, 0.5)'
                }}>
                    <div>
                        <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#fff', letterSpacing: '-0.5px', margin: 0 }}>
                            资产看板管理
                        </h2>
                        <p style={{ color: '#8b949e', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                            拖拽调整显示顺序，点击开关管理展示状态
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <button
                            onClick={() => {
                                onAddNew();
                                handleClose();
                            }}
                            style={{
                                padding: '0.6rem 1.2rem',
                                background: '#238636',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '0.5rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '6px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                            }}
                        >
                            <span>+</span> 添加资产
                        </button>
                        <button
                            onClick={handleClose}
                            style={{
                                width: '36px', height: '36px',
                                borderRadius: '50%',
                                background: 'rgba(255,255,255,0.1)',
                                border: 'none',
                                color: '#fff',
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '2rem 2.5rem', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>

                    {/* Section 1: Displayed Cards (Draggable) */}
                    <div>
                        <h3 style={{ fontSize: '1.1rem', color: '#e6edf3', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ background: '#3fb950', width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block' }}></span>
                            已展示资产 ({visibleCards.length})
                            <span style={{ fontSize: '0.8rem', color: '#8b949e', fontWeight: 'normal', marginLeft: 'auto' }}>拖拽卡片调整顺序</span>
                        </h3>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', // 更宽的网格
                            gap: '1.25rem'
                        }}>
                            {visibleCards.map((card, index) => (
                                <ElegantCard
                                    key={card.id}
                                    card={card}
                                    priceData={cardPrices?.[card.id]}
                                    isDraggable={true}
                                    onDragStart={(e) => handleDragStart(e, card)}
                                    onDragOver={(e) => handleDragOver(e, card.id)}
                                    onDrop={(e) => handleDrop(e, card.id)}
                                    onToggle={() => handleToggleVisibility(card.id)}
                                    onDelete={() => handleDelete(card.id)}
                                    onEdit={() => handleEdit(card)}
                                    isDragging={draggedCardId === card.id}
                                />
                            ))}
                        </div>
                    </div>

                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }}></div>

                    {/* Section 2: Hidden Cards (Filterable) */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h3 style={{ fontSize: '1.1rem', color: '#e6edf3', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ background: '#8b949e', width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block' }}></span>
                                更多资产库
                            </h3>

                            {/* Filters */}
                            <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '8px' }}>
                                {categories.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setActiveTab(cat.id)}
                                        style={{
                                            padding: '4px 12px',
                                            borderRadius: '6px',
                                            border: 'none',
                                            fontSize: '0.85rem',
                                            cursor: 'pointer',
                                            background: activeTab === cat.id ? '#58a6ff' : 'transparent',
                                            color: activeTab === cat.id ? '#fff' : '#8b949e',
                                            fontWeight: activeTab === cat.id ? '600' : '500',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {cat.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {filteredHiddenCards.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: '#8b949e', background: 'rgba(255,255,255,0.01)', borderRadius: '1rem', border: '1px dashed rgba(255,255,255,0.1)' }}>
                                没有更多{activeTab !== 'all' ? '此类' : ''}资产了。点击右上角添加新资产。
                            </div>
                        ) : (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                                gap: '1.25rem'
                            }}>
                                {filteredHiddenCards.map(card => (
                                    <ElegantCard
                                        key={card.id}
                                        card={card}
                                        priceData={cardPrices?.[card.id]}
                                        onToggle={() => handleToggleVisibility(card.id)}
                                        onDelete={() => handleDelete(card.id)}
                                        onEdit={() => handleEdit(card)}
                                        isDraggable={false} // 隐藏列表不可拖拽
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                </div>
            </div>

            {/* Asset Editor */}
            {editingCard && (
                <AssetEditorModal
                    isOpen={true}
                    card={editingCard}
                    currentPrice={cardPrices?.[editingCard.id]?.price}
                    onClose={() => setEditingCard(null)}
                    onUpdate={() => {
                        setEditingCard(null);
                        refreshCards();
                    }}
                />
            )}
        </div>,
        document.body
    );
};

const ElegantCard = ({
    card, priceData, onToggle, onDelete, onEdit,
    isDraggable, onDragStart, onDragOver, onDrop, isDragging
}) => {
    const { name, symbol, type, visible, category, position } = card;

    // 生成类型图标/颜色
    const getIcon = () => {
        if (category === '加密货币') return '₿';
        if (category === '美股') return '🇺🇸';
        if (category === 'A股') return '🇨🇳';
        if (category === '港股') return '🇭🇰';
        return '📈';
    };

    const positionSummary = priceData?.price && position?.enabled
        ? getPositionSummary(card, priceData.price)
        : null;

    return (
        <div
            draggable={isDraggable}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            style={{
                background: visible ? 'rgba(22, 27, 34, 0.8)' : 'rgba(13, 17, 23, 0.5)',
                border: isDragging ? '2px dashed #58a6ff' : '1px solid rgba(48, 54, 61, 0.6)',
                borderRadius: '12px',
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.2s',
                opacity: isDragging ? 0.5 : 1,
                cursor: isDraggable ? 'grab' : 'default',
                position: 'relative',
                overflow: 'hidden'
            }}
            onMouseEnter={e => !isDragging && (e.currentTarget.style.borderColor = '#58a6ff')}
            onMouseLeave={e => !isDragging && (e.currentTarget.style.borderColor = 'rgba(48, 54, 61, 0.6)')}
        >
            {/* Left: Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                    width: '40px', height: '40px',
                    background: visible ? 'rgba(56, 139, 253, 0.15)' : 'rgba(48, 54, 61, 0.3)',
                    borderRadius: '10px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.25rem',
                    color: visible ? '#58a6ff' : '#8b949e'
                }}>
                    {getIcon()}
                </div>
                <div>
                    <div style={{ fontWeight: '700', color: visible ? '#e6edf3' : '#8b949e', fontSize: '1rem' }}>
                        {name}
                        {category && <span style={{
                            fontSize: '0.7rem', marginLeft: '8px',
                            padding: '1px 6px', borderRadius: '4px',
                            background: 'rgba(255,255,255,0.05)', color: '#8b949e', fontWeight: 'normal'
                        }}>{category}</span>}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#6e7681', fontFamily: 'monospace' }}>
                        {symbol}
                        {priceData?.price && (
                            <span style={{ marginLeft: '8px', color: '#e6edf3' }}>
                                ${priceData.price >= 1000 ? Math.round(priceData.price).toLocaleString() : priceData.price.toFixed(2)}
                            </span>
                        )}
                    </div>
                    {positionSummary && (
                        <div style={{
                            fontSize: '0.7rem',
                            marginTop: '4px',
                            color: positionSummary.isProfit ? '#3fb950' : '#f85149',
                            fontWeight: '500'
                        }}>
                            {positionSummary.direction === 'long' ? '📈' : '📉'} {positionSummary.amount} @ {positionSummary.entryPrice} ·
                            {positionSummary.isProfit ? '+' : ''}{positionSummary.pnl.toFixed(2)} ({positionSummary.isProfit ? '+' : ''}{positionSummary.pnlPercent.toFixed(1)}%)
                        </div>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                    onClick={onEdit}
                    title="编辑"
                    style={{
                        padding: '8px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'rgba(96, 165, 250, 0.1)',
                        color: '#60a5fa',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(96, 165, 250, 0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(96, 165, 250, 0.1)'}
                >
                    ✏️
                </button>

                <button
                    onClick={onToggle}
                    title={visible ? "隐藏" : "显示"}
                    style={{
                        padding: '8px',
                        borderRadius: '8px',
                        border: 'none',
                        background: visible ? 'rgba(46, 160, 67, 0.2)' : '#21262d',
                        color: visible ? '#3fb950' : '#8b949e',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                >
                    {visible ? '👁️' : '🙈'}
                </button>

                {!card.isDefault && (
                    <button
                        onClick={onDelete}
                        title="删除"
                        style={{
                            padding: '8px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'rgba(218, 54, 51, 0.1)',
                            color: '#da3633',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(218, 54, 51, 0.2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(218, 54, 51, 0.1)'}
                    >
                        🗑️
                    </button>
                )}
            </div>
        </div>
    );
};

export default CardManager;
