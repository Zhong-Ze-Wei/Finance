// AssetCard.jsx - 统一资产卡片组件
import React from 'react';

import { getPositionSummary } from '../services/assetCards';

const AssetCard = ({
    card,
    isSelected,
    onClick,
    priceData = null,
    showDeleteButton = false,
    onDelete = null
}) => {
    const { name, type, category, position } = card;
    const price = priceData?.price;
    const change24h = priceData?.change24h;
    const isLoading = priceData?.loading;

    // 计算持仓盈亏
    const positionSummary = (price && position?.enabled)
        ? getPositionSummary(card, price)
        : null;

    // 根据类型选择颜色
    const getTypeColor = () => {
        switch (type) {
            case 'crypto': return '#f0b90b';
            case 'stock': return '#00d4aa';
            case 'etf': return '#627eea';
            default: return '#8b949e';
        }
    };

    // 格式化价格
    const formatPrice = (p) => {
        if (!p) return '--';
        return `$${p}`;
    };

    return (
        <div
            onClick={onClick}
            style={{
                background: isSelected
                    ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)'
                    : 'rgba(22, 27, 34, 0.7)',
                backdropFilter: 'blur(12px)',
                border: isSelected
                    ? `1px solid ${getTypeColor()}`
                    : '1px solid rgba(48, 54, 61, 0.6)',
                borderRadius: '16px',
                padding: '1.25rem',
                cursor: 'pointer',
                minWidth: '240px', // 加宽卡片
                maxWidth: '280px',
                flex: 1,
                textAlign: 'left', // 左对齐布局更好看
                transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)', // 弹性动画
                position: 'relative',
                transform: isSelected ? 'translateY(-4px) scale(1.02)' : 'none',
                boxShadow: isSelected
                    ? `0 12px 24px -8px ${getTypeColor()}40, 0 4px 8px -4px ${getTypeColor()}20`
                    : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
            }}
            onMouseEnter={e => {
                if (!isSelected) {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.background = 'rgba(33, 38, 45, 0.9)';
                    e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.2)';
                    e.currentTarget.style.borderColor = 'rgba(120, 120, 120, 0.3)';
                }
            }}
            onMouseLeave={e => {
                if (!isSelected) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.background = 'rgba(22, 27, 34, 0.7)';
                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(48, 54, 61, 0.6)';
                }
            }}
        >
            {/* 删除按钮 */}
            {showDeleteButton && onDelete && (
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(card.id); }}
                    style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '-8px',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: '#da3633',
                        border: 'none',
                        color: '#fff',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    ×
                </button>
            )}

            {/* 顶部: 名称 + 类别 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                    <div style={{
                        fontSize: '1.1rem',
                        fontWeight: '800',
                        color: '#e6edf3',
                        marginBottom: '0.1rem',
                        letterSpacing: '-0.02em',
                        display: 'flex', alignItems: 'center', gap: '6px'
                    }}>
                        {name}
                        {isSelected && <span style={{ fontSize: '10px', verticalAlign: 'middle' }}>✨</span>}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#8b949e', fontWeight: '500', fontFamily: 'Monaco, monospace' }}>
                        {card.symbol}
                    </div>
                </div>
                {category && (
                    <span style={{
                        fontSize: '0.65rem',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: isSelected ? getTypeColor() : 'rgba(56, 139, 253, 0.1)',
                        color: isSelected ? '#fff' : '#58a6ff',
                        border: isSelected ? 'none' : '1px solid rgba(56, 139, 253, 0.2)',
                        fontWeight: '600',
                        boxShadow: isSelected ? '0 2px 4px rgba(0,0,0,0.2)' : 'none'
                    }}>
                        {category}
                    </span>
                )}
            </div>

            {/* 中间: 价格 + 涨跌幅 */}
            <div style={{ marginBottom: '0.75rem' }}>
                <div style={{
                    fontSize: '1.5rem',
                    fontWeight: '800',
                    color: !change24h ? '#e6edf3' : (change24h >= 0 ? '#3fb950' : '#f85149'),
                    marginBottom: '0.1rem',
                    letterSpacing: '-0.03em',
                    textShadow: isSelected ? `0 0 20px ${change24h >= 0 ? 'rgba(63, 185, 80, 0.3)' : 'rgba(248, 81, 73, 0.3)'}` : 'none'
                }}>
                    {isLoading ? (
                        <span style={{ fontSize: '1rem', opacity: 0.5, fontStyle: 'italic' }}>Updating...</span>
                    ) : (
                        formatPrice(price)
                    )}
                </div>
                {!isLoading && change24h !== undefined && (
                    <div style={{
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        color: change24h >= 0 ? '#3fb950' : '#f85149',
                        display: 'flex', alignItems: 'center', gap: '4px'
                    }}>
                        <span>{change24h >= 0 ? '↗' : '↘'}</span>
                        <span>{Math.abs(change24h).toFixed(2)}%</span>
                    </div>
                )}
            </div>

            {/* 底部: 持仓盈亏 (如果有) */}
            {positionSummary && (
                <div style={{
                    marginTop: '0.75rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.75rem'
                }}>
                    <span style={{ color: '#8b949e' }}>PnL</span>
                    <span style={{
                        color: positionSummary.isProfit ? '#3fb950' : '#f85149',
                        fontWeight: '700',
                        display: 'flex', alignItems: 'center', gap: '2px'
                    }}>
                        {positionSummary.isProfit ? '+' : ''}{positionSummary.pnl.toFixed(1)}
                        <span style={{ opacity: 0.7, fontWeight: '400', fontSize: '0.7rem' }}>
                            ({positionSummary.pnlPercent.toFixed(1)}%)
                        </span>
                    </span>
                </div>
            )}
        </div>
    );
};

// 统一的操作卡片（上下分栏，与其他卡片同尺寸）
export const ActionCard = ({ onAdd, onManage }) => (
    <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        minWidth: '200px', // 与资产卡片接近
        maxWidth: '240px',
        height: 'auto',
        minHeight: '140px', // 保持与其他卡片相近高度
        background: 'rgba(22, 27, 34, 0.6)',
        borderRadius: '16px',
        padding: '12px',
        border: '1px solid rgba(48, 54, 61, 0.6)',
        backdropFilter: 'blur(8px)'
    }}>
        {/* 上半部分：添加 */}
        <div
            onClick={onAdd}
            title="添加新资产"
            style={{
                flex: 1,
                background: 'linear-gradient(135deg, rgba(35, 134, 54, 0.2) 0%, rgba(35, 134, 54, 0.1) 100%)',
                border: '1px dashed rgba(63, 185, 80, 0.4)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                transition: 'all 0.3s',
                color: '#3fb950',
                fontSize: '1rem',
                fontWeight: '600'
            }}
            onMouseEnter={e => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(35, 134, 54, 0.3) 0%, rgba(35, 134, 54, 0.2) 100%)';
                e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(35, 134, 54, 0.2) 0%, rgba(35, 134, 54, 0.1) 100%)';
                e.currentTarget.style.transform = 'scale(1)';
            }}
        >
            <span style={{ fontSize: '1.5rem' }}>➕</span>
            <span>添加资产</span>
        </div>

        {/* 下半部分：管理 */}
        <div
            onClick={onManage}
            title="管理全部卡片"
            style={{
                height: '44px',
                background: 'rgba(88, 166, 255, 0.1)',
                border: '1px solid rgba(88, 166, 255, 0.2)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 0.3s',
                color: '#58a6ff',
                fontSize: '0.9rem',
                fontWeight: '600'
            }}
            onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(88, 166, 255, 0.2)';
                e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(88, 166, 255, 0.1)';
                e.currentTarget.style.color = '#58a6ff';
            }}
        >
            <span>⚙️</span>
            <span>管理卡片</span>
        </div>
    </div>
);

export default AssetCard;
