// AssetCard.jsx - 统一资产卡片组件
import React from 'react';
import './AssetCard.css';
import { Plus, Settings, Sparkles } from 'lucide-react';
import { getPositionSummary } from '../services/assetCards';

// 根据类型选择颜色
const getTypeColor = (type) => {
    switch (type) {
        case 'crypto': return '#f0b90b';
        case 'stock': return '#00d4aa';
        case 'etf': return '#627eea';
        default: return '#8b949e';
    }
};

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

    // 格式化价格
    const formatPrice = (p) => {
        if (!p) return '--';
        return `$${p}`;
    };

    const typeColor = getTypeColor(type);

    return (
        <div
            className={`asset-card${isSelected ? ' asset-card--selected' : ''}`}
            style={isSelected ? {
                '--type-color': typeColor,
                '--type-color-alpha-40': `${typeColor}40`,
                '--type-color-alpha-20': `${typeColor}20`,
            } : undefined}
            onClick={onClick}
        >
            {/* 删除按钮 */}
            {showDeleteButton && onDelete && (
                <button
                    className="asset-card__delete-btn"
                    onClick={(e) => { e.stopPropagation(); onDelete(card.id); }}
                >
                    ×
                </button>
            )}

            {/* 顶部: 名称 + 类别 */}
            <div className="asset-card__header">
                <div>
                    <div className="asset-card__name">
                        {name}
                        {isSelected && <span className="asset-card__sparkle"><Sparkles size={12} /></span>}
                    </div>
                    <div className="asset-card__symbol">
                        {card.symbol}
                    </div>
                </div>
                {category && (
                    <span
                        className={`asset-card__category${isSelected ? ' asset-card__category--selected asset-card__category--selected-bg' : ''}`}
                    >
                        {category}
                    </span>
                )}
            </div>

            {/* 中间: 价格 + 涨跌幅 */}
            <div className="asset-card__price-section">
                <div
                    className={[
                        'asset-card__price',
                        !change24h ? '' : (change24h >= 0 ? 'asset-card__price--up' : 'asset-card__price--down'),
                        isSelected && change24h !== undefined ? 'asset-card__price--glow' : ''
                    ].filter(Boolean).join(' ')}
                    style={isSelected && change24h !== undefined ? {
                        '--glow-color': change24h >= 0 ? 'rgba(63, 185, 80, 0.3)' : 'rgba(248, 81, 73, 0.3)',
                    } : undefined}
                >
                    {isLoading ? (
                        <span className="asset-card__price--loading">Updating...</span>
                    ) : (
                        formatPrice(price)
                    )}
                </div>
                {!isLoading && change24h !== undefined && (
                    <div className={`asset-card__change ${change24h >= 0 ? 'asset-card__change--up' : 'asset-card__change--down'}`}>
                        <span>{change24h >= 0 ? '↗' : '↘'}</span>
                        <span>{Math.abs(change24h).toFixed(2)}%</span>
                    </div>
                )}
            </div>

            {/* 底部: 持仓盈亏 (如果有) */}
            {positionSummary && (
                <div className="asset-card__pnl">
                    <span className="asset-card__pnl-label">PnL</span>
                    <span className={`asset-card__pnl-value ${positionSummary.isProfit ? 'asset-card__pnl-value--profit' : 'asset-card__pnl-value--loss'}`}>
                        {positionSummary.isProfit ? '+' : ''}{positionSummary.pnl.toFixed(1)}
                        <span className="asset-card__pnl-percent">
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
    <div className="action-card">
        {/* 上半部分：添加 */}
        <div
            className="action-card__add"
            onClick={onAdd}
            title="添加新资产"
        >
            <span className="action-card__add-icon"><Plus size={16} /></span>
            <span>添加资产</span>
        </div>

        {/* 下半部分：管理 */}
        <div
            className="action-card__manage"
            onClick={onManage}
            title="管理全部卡片"
        >
            <span><Settings size={14} /></span>
            <span>管理卡片</span>
        </div>
    </div>
);

export default AssetCard;
