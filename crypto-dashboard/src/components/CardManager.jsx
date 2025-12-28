// CardManager.jsx - 精美版卡片管理
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
    getAssetCards,
    toggleCardVisibility,
    deleteAssetCard
} from '../services/assetCards';

const CardManager = ({ isOpen, onClose, onCardsChange, onAddNew }) => {
    const [cards, setCards] = useState(getAssetCards());
    const [animateOut, setAnimateOut] = useState(false);

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

    const handleClose = () => {
        setAnimateOut(true);
        setTimeout(() => {
            setAnimateOut(false);
            onClose();
        }, 300);
    };

    if (!isOpen) return null;

    const visibleCards = cards.filter(c => c.visible).sort((a, b) => a.order - b.order);
    const hiddenCards = cards.filter(c => !c.visible).sort((a, b) => a.order - b.order);

    return createPortal(
        <div
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(16px)',
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
                    width: '100%',
                    maxWidth: '800px',
                    maxHeight: '90vh',
                    background: 'linear-gradient(145deg, #13171f 0%, #0d1117 100%)',
                    borderRadius: '1.5rem',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 50px 100px -20px rgba(0, 0, 0, 0.7)',
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
                    padding: '1.5rem 2rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(255,255,255,0.02)'
                }}>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#fff', letterSpacing: '-0.5px' }}>
                            <span style={{ marginRight: '0.5rem' }}>✨</span>
                            资产管理器
                        </h2>
                        <p style={{ color: '#8b949e', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                            自定义您的交易看板 · 拖拽排序功能开发中
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button
                            onClick={() => { handleClose(); onAddNew?.(); }}
                            style={{
                                padding: '0.6rem 1.2rem',
                                background: 'linear-gradient(135deg, #f0b90b 0%, #e85d04 100%)',
                                border: 'none',
                                borderRadius: '0.75rem',
                                color: '#000',
                                fontWeight: 'bold',
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(240, 185, 11, 0.3)',
                                transition: 'transform 0.2s',
                                display: 'flex', alignItems: 'center', gap: '0.5rem'
                            }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            <span>➕</span> 添加资产
                        </button>
                        <button
                            onClick={handleClose}
                            style={{
                                background: 'rgba(255,255,255,0.1)',
                                border: 'none',
                                width: '40px', height: '40px',
                                borderRadius: '50%',
                                color: '#fff', fontSize: '1.5rem',
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'background 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        >
                            ×
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div style={{ overflowY: 'auto', padding: '2rem', flex: 1 }}>

                    {/* Active Cards Section */}
                    <div style={{ marginBottom: '2.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem', gap: '0.5rem' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3fb950' }}></div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#e6edf3' }}>显示中 ({visibleCards.length})</h3>
                        </div>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                            gap: '1rem'
                        }}>
                            {visibleCards.map(card => (
                                <ElegantCard
                                    key={card.id}
                                    card={card}
                                    onToggle={() => handleToggleVisibility(card.id)}
                                    onDelete={() => handleDelete(card.id)}
                                    isVisible={true}
                                />
                            ))}
                            {visibleCards.length === 0 && (
                                <div style={{
                                    gridColumn: '1 / -1',
                                    padding: '2rem',
                                    textAlign: 'center',
                                    border: '2px dashed rgba(255,255,255,0.1)',
                                    borderRadius: '1rem',
                                    color: '#8b949e'
                                }}>
                                    暂无显示的卡片，请从下方恢复或点击添加。
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Hidden Cards Section */}
                    {hiddenCards.length > 0 && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem', gap: '0.5rem' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8b949e' }}></div>
                                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#8b949e' }}>已隐藏 ({hiddenCards.length})</h3>
                            </div>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                gap: '1rem',
                                opacity: 0.8
                            }}>
                                {hiddenCards.map(card => (
                                    <ElegantCard
                                        key={card.id}
                                        card={card}
                                        onToggle={() => handleToggleVisibility(card.id)}
                                        onDelete={() => handleDelete(card.id)}
                                        isVisible={false}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

// Elegant Card Row Component
const ElegantCard = ({ card, onToggle, onDelete, isVisible }) => {
    const isCrypto = card.type === 'crypto';
    const isStock = card.type === 'stock';

    const icon = isCrypto ? '₿' : isStock ? '📈' : '📊';
    const badgeColor = isCrypto ? '#f0b90b' : isStock ? '#00d4aa' : '#627eea';

    return (
        <div style={{
            background: isVisible ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)',
            border: `1px solid ${isVisible ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)'}`,
            borderRadius: '1rem',
            padding: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.2s ease',
            cursor: 'default',
            position: 'relative',
            overflow: 'hidden'
        }}
            onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.background = isVisible ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)';
                e.currentTarget.style.borderColor = isVisible ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)';
            }}
        >
            {/* Status Bar */}
            <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px',
                background: isVisible ? badgeColor : '#30363d'
            }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingLeft: '0.5rem' }}>
                <div style={{
                    width: '36px', height: '36px',
                    borderRadius: '10px',
                    background: `${badgeColor}20`,
                    color: badgeColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.2rem'
                }}>
                    {icon}
                </div>
                <div>
                    <div style={{ fontWeight: 'bold', color: isVisible ? '#fff' : '#8b949e', fontSize: '1rem' }}>
                        {card.name}
                        {card.isDefault && <span style={{
                            fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px',
                            background: '#30363d', color: '#8b949e', marginLeft: '0.5rem', verticalAlign: 'middle'
                        }}>默认</span>}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6e7681', marginTop: '2px' }}>
                        {card.symbol}
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                    onClick={onToggle}
                    title={isVisible ? "隐藏" : "显示"}
                    style={{
                        padding: '8px',
                        borderRadius: '8px',
                        border: 'none',
                        background: isVisible ? 'rgba(46, 160, 67, 0.2)' : '#21262d',
                        color: isVisible ? '#3fb950' : '#8b949e',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                >
                    {isVisible ? '👁️' : '🙈'}
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
