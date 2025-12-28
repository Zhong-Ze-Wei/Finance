// AssetCard.jsx - 统一资产卡片组件
import React from 'react';

const AssetCard = ({
    card,
    isSelected,
    onClick,
    priceData = null,
    showDeleteButton = false,
    onDelete = null
}) => {
    const { name, type } = card;
    const price = priceData?.price;
    const change24h = priceData?.change24h;
    const isLoading = priceData?.loading;

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
        if (p >= 1000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
        if (p >= 1) return `$${p.toFixed(2)}`;
        return `$${p.toFixed(4)}`;
    };

    return (
        <div
            onClick={onClick}
            style={{
                background: isSelected
                    ? 'linear-gradient(135deg, #1a2332 0%, #2d3748 100%)'
                    : '#161b22',
                border: isSelected
                    ? `2px solid ${getTypeColor()}`
                    : '1px solid #30363d',
                borderRadius: '0.75rem',
                padding: '1rem',
                cursor: 'pointer',
                minWidth: '160px',
                textAlign: 'center',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                transform: isSelected ? 'translateY(-2px)' : 'none',
                boxShadow: isSelected ? `0 4px 12px ${getTypeColor()}40` : 'none'
            }}
            onMouseEnter={e => {
                if (!isSelected) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.background = '#21262d';
                }
            }}
            onMouseLeave={e => {
                if (!isSelected) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.background = '#161b22';
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

            {/* 名称 */}
            <div style={{
                fontSize: '1rem',
                fontWeight: 'bold',
                color: isSelected ? getTypeColor() : '#e6edf3',
                marginBottom: '0.25rem'
            }}>
                {name}
            </div>

            {/* 价格 */}
            <div style={{
                fontSize: '0.9rem',
                color: '#e6edf3',
                marginBottom: '0.25rem'
            }}>
                {isLoading ? (
                    <span style={{ color: '#6e7681' }}>加载中...</span>
                ) : (
                    formatPrice(price)
                )}
            </div>

            {/* 涨跌幅 */}
            {change24h !== undefined && change24h !== null && (
                <div style={{
                    fontSize: '0.75rem',
                    color: change24h >= 0 ? '#3fb950' : '#f85149'
                }}>
                    {change24h >= 0 ? '+' : ''}{change24h?.toFixed(2)}%
                </div>
            )}

            {/* 类型标签 */}
            <div style={{
                position: 'absolute',
                top: '4px',
                right: '8px',
                fontSize: '0.6rem',
                color: getTypeColor(),
                opacity: 0.7
            }}>
                {type === 'crypto' ? '₿' : type === 'stock' ? '📈' : '📊'}
            </div>
        </div>
    );
};

// 添加卡片按钮
export const AddCardButton = ({ onClick }) => (
    <div
        onClick={onClick}
        style={{
            background: '#21262d',
            border: '2px dashed #30363d',
            borderRadius: '0.75rem',
            padding: '0.75rem 1rem',
            cursor: 'pointer',
            minWidth: '80px',
            textAlign: 'center',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
        }}
    >
        <div style={{ fontSize: '1.25rem', color: '#8b949e' }}>➕</div>
        <div style={{ fontSize: '0.7rem', color: '#6e7681', marginTop: '0.25rem' }}>添加</div>
    </div>
);

// 更多按钮
export const MoreButton = ({ count, onClick }) => (
    <div
        onClick={onClick}
        style={{
            background: '#21262d',
            border: '1px solid #30363d',
            borderRadius: '0.75rem',
            padding: '0.75rem 1rem',
            cursor: 'pointer',
            minWidth: '80px',
            textAlign: 'center',
            transition: 'all 0.2s ease'
        }}
    >
        <div style={{ fontSize: '0.85rem', color: '#8b949e' }}>更多 ▼</div>
        <div style={{ fontSize: '0.7rem', color: '#6e7681', marginTop: '0.25rem' }}>({count})</div>
    </div>
);

export default AssetCard;
