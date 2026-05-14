import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './CardManager.css';
import {
    getAssetCards,
    toggleCardVisibility,
    deleteAssetCard,
    reorderCards,
    getPositionSummary,
    restoreDefaultAssets
} from '../services/assetCards';
import { getIcon } from '../services/iconMap';
import AssetEditorModal from './AssetEditorModal';
import {
    RefreshCw, Pencil, Eye, EyeOff, Trash2,
    TrendingUp, TrendingDown, BarChart3, ArrowLeftRight,
    Factory, Plus
} from 'lucide-react';

const CardManager = ({ isOpen, onClose, onCardsChange, onAddNew, cardPrices }) => {
    const [cards, setCards] = useState([]);
    const [animateOut, setAnimateOut] = useState(false);
    const [editingCard, setEditingCard] = useState(null);
    const [activeTab, setActiveTab] = useState('all'); // 'all', 'crypto', 'stock', 'etf', 'other'
    const [draggedCardId, setDraggedCardId] = useState(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [loading, setLoading] = useState(false);

    // 监听窗口大小变化
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // 每次打开管理器时刷新卡片列表
    useEffect(() => {
        if (isOpen) {
            loadCards();
        }
    }, [isOpen]);

    const loadCards = async () => {
        setLoading(true);
        try {
            const loadedCards = await getAssetCards();
            setCards(loadedCards);
        } catch (error) {
            console.error('加载卡片失败:', error);
        } finally {
            setLoading(false);
        }
    };

    const refreshCards = async () => {
        await loadCards();
        onCardsChange?.();
    };

    const handleToggleVisibility = async (cardId) => {
        await toggleCardVisibility(cardId);
        await refreshCards();
    };

    const handleDelete = async (cardId) => {
        if (window.confirm('确定删除此资产卡片？')) {
            await deleteAssetCard(cardId);
            await refreshCards();
        }
    };

    const handleEdit = (card) => {
        setEditingCard(card);
    };

    const handleRestoreDefaults = async () => {
        const restored = await restoreDefaultAssets();
        if (restored > 0) {
            await refreshCards();
        }
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

    const handleDrop = async (e, targetCardId) => {
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
        await reorderCards(reorderedIds);
        await refreshCards();
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
        if (activeTab === 'forex') return c.category === '外汇' || c.type === 'forex';
        if (activeTab === 'commodity') return c.category === '大宗商品' || c.type === 'commodity';
        if (activeTab === 'index') return c.category === '指数' || c.type === 'index';
        return true;
    });

    const categories = [
        { id: 'all', label: '全部' },
        { id: 'crypto', label: '加密货币' },
        { id: 'stock', label: '股票' },
        { id: 'etf', label: 'ETF' },
        { id: 'forex', label: '外汇' },
        { id: 'commodity', label: '大宗商品' },
        { id: 'index', label: '指数' },
    ];

    // 组合 className 的辅助函数
    const cx = (...classes) => classes.filter(Boolean).join(' ');

    return createPortal(
        <div
            className={cx(
                'cm-overlay',
                animateOut && 'cm-overlay--animate-out',
                !isMobile && 'cm-overlay--desktop'
            )}
        >
            <div
                className={cx(
                    'cm-dialog',
                    animateOut && 'cm-dialog--animate-out',
                    isMobile && 'cm-dialog--mobile'
                )}
            >
                {/* Header */}
                <div className={cx('cm-header', isMobile && 'cm-header--mobile')}>
                    <div className="cm-header__row">
                        <div>
                            <h2 className={cx('cm-header__title', isMobile && 'cm-header__title--mobile')}>
                                资产看板管理
                            </h2>
                            {!isMobile && (
                                <p className="cm-header__subtitle">
                                    拖拽调整显示顺序，点击开关管理展示状态
                                </p>
                            )}
                        </div>
                        {isMobile && (
                            <button onClick={handleClose} className="cm-close-btn">
                                ✕
                            </button>
                        )}
                    </div>

                    <div className={cx('cm-header__actions', isMobile && 'cm-header__actions--mobile')}>
                        <button
                            onClick={() => {
                                onAddNew();
                                handleClose();
                            }}
                            className={cx('cm-btn-add', isMobile && 'cm-btn-add--mobile')}
                        >
                            <Plus size={14} /> 添加资产
                        </button>
                        <button
                            onClick={handleRestoreDefaults}
                            className={cx('cm-btn-restore', isMobile && 'cm-btn-restore--mobile')}
                            title="恢复 BTC/ETH 默认资产"
                        >
                            {isMobile ? '恢复默认' : <><RefreshCw size={14} /> 恢复默认</>}
                        </button>
                        {!isMobile && (
                            <button onClick={handleClose} className="cm-close-btn">
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className={cx('cm-content', isMobile && 'cm-content--mobile')}>

                    {/* Section 1: Displayed Cards (Draggable) */}
                    <div>
                        <h3 className={cx('cm-section-title', isMobile && 'cm-section-title--mobile')}>
                            <span className="cm-section-title__dot cm-section-title__dot--visible"></span>
                            已展示 ({visibleCards.length})
                            {!isMobile && <span className="cm-section-title__hint">拖拽卡片调整顺序</span>}
                        </h3>

                        <div className={cx('cm-grid', isMobile && 'cm-grid--mobile')}>
                            {visibleCards.map((card, index) => (
                                <ElegantCard
                                    key={card.id}
                                    card={card}
                                    priceData={cardPrices?.[card.id]}
                                    isDraggable={!isMobile}
                                    onDragStart={(e) => handleDragStart(e, card)}
                                    onDragOver={(e) => handleDragOver(e, card.id)}
                                    onDrop={(e) => handleDrop(e, card.id)}
                                    onToggle={() => handleToggleVisibility(card.id)}
                                    onDelete={() => handleDelete(card.id)}
                                    onEdit={() => handleEdit(card)}
                                    isDragging={draggedCardId === card.id}
                                    isMobile={isMobile}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="cm-divider"></div>

                    {/* Section 2: Hidden Cards (Filterable) */}
                    <div>
                        <div className={cx('cm-filter-bar', isMobile && 'cm-filter-bar--mobile')}>
                            <h3 className={cx('cm-section-title', 'cm-section-title--filter-bar', isMobile && 'cm-section-title--mobile')}>
                                <span className="cm-section-title__dot cm-section-title__dot--hidden"></span>
                                更多资产库
                            </h3>

                            {/* Filters - 移动端横向滚动 */}
                            <div className={cx('cm-filters', isMobile && 'cm-filters--mobile')}>
                                {categories.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setActiveTab(cat.id)}
                                        className={cx(
                                            'cm-filter-btn',
                                            isMobile && 'cm-filter-btn--mobile',
                                            activeTab === cat.id && 'cm-filter-btn--active'
                                        )}
                                    >
                                        {cat.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {filteredHiddenCards.length === 0 ? (
                            <div className={cx('cm-empty', isMobile && 'cm-empty--mobile')}>
                                没有更多{activeTab !== 'all' ? '此类' : ''}资产了
                            </div>
                        ) : (
                            <div className={cx('cm-grid', isMobile && 'cm-grid--mobile')}>
                                {filteredHiddenCards.map(card => (
                                    <ElegantCard
                                        key={card.id}
                                        card={card}
                                        priceData={cardPrices?.[card.id]}
                                        onToggle={() => handleToggleVisibility(card.id)}
                                        onDelete={() => handleDelete(card.id)}
                                        onEdit={() => handleEdit(card)}
                                        isDraggable={false}
                                        isMobile={isMobile}
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

// 获取资产类别的图标和颜色主题
const getCategoryTheme = (category) => {
    const themes = {
        '加密货币': { icon: '₿', color: '#f7931a', bg: 'rgba(247, 147, 26, 0.12)' },
        '美股': { icon: 'US', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.12)' },
        'A股': { icon: 'CN', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)' },
        '港股': { icon: 'HK', color: '#f472b6', bg: 'rgba(244, 114, 182, 0.12)' },
        'ETF': { icon: 'BarChart3', color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.12)' },
        '外汇': { icon: 'ArrowLeftRight', color: '#34d399', bg: 'rgba(52, 211, 153, 0.12)' },
        '大宗商品': { icon: 'Factory', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.12)' },
        '指数': { icon: 'TrendingUp', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)' },
    };
    return themes[category] || { icon: 'TrendingUp', color: '#8b949e', bg: 'rgba(139, 148, 158, 0.12)' };
};

const cx = (...classes) => classes.filter(Boolean).join(' ');

const ElegantCard = ({
    card, priceData, onToggle, onDelete, onEdit,
    isDraggable, onDragStart, onDragOver, onDrop, isDragging, isMobile
}) => {
    const { name, symbol, visible, category, position } = card;
    const theme = getCategoryTheme(category);

    const positionSummary = priceData?.price && position?.enabled
        ? getPositionSummary(card, priceData.price)
        : null;

    // 格式化价格显示
    const formatPrice = (price) => {
        if (!price) return null;
        if (price >= 10000) return Math.round(price).toLocaleString();
        if (price >= 100) return price.toFixed(1);
        if (price >= 1) return price.toFixed(2);
        return price.toFixed(4);
    };

    const iconFontSize = theme.icon.length <= 2 ? '0.9rem' : '1.1rem';
    const isLucideIcon = theme.icon.length > 2; // lucide icon names are longer than 2 chars

    return (
        <div
            draggable={isDraggable}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            className={cx(
                'cm-elegant-card',
                isDraggable && 'cm-elegant-card--draggable',
                isDragging && 'cm-elegant-card--dragging',
                !visible && 'cm-elegant-card--hidden',
                isMobile && 'cm-elegant-card--mobile'
            )}
            style={{
                '--type-color': theme.color,
                '--type-bg': theme.bg,
            }}
        >
            {/* 顶部行：图标 + 名称 + 类别 + 操作按钮 */}
            <div className="cm-card-row">
                {/* 左侧：图标 + 名称 + 类别标签 */}
                <div className={cx('cm-card-left', isMobile && 'cm-card-left--mobile')}>
                    {/* 图标容器 */}
                    <div
                        className={cx(
                            'cm-card-icon',
                            'cm-card-icon--dynamic',
                            isMobile && 'cm-card-icon--mobile',
                            visible ? 'cm-card-icon--visible' : 'cm-card-icon--hidden'
                        )}
                        style={{ '--icon-font-size': isMobile ? '0.75rem' : iconFontSize }}
                    >
                        {isLucideIcon ? getIcon(theme.icon, { size: isMobile ? 12 : 14 }) : theme.icon}
                    </div>

                    {/* 名称 + 类别 */}
                    <div className="cm-card-name-wrap">
                        <span className={cx(
                            'cm-card-name',
                            visible ? 'cm-card-name--visible' : 'cm-card-name--hidden',
                            isMobile && 'cm-card-name--mobile'
                        )}>
                            {name}
                        </span>
                        {category && !isMobile && (
                            <span className={cx(
                                'cm-card-category',
                                visible ? 'cm-card-category--visible' : 'cm-card-category--hidden'
                            )}>
                                {category}
                            </span>
                        )}
                    </div>
                </div>

                {/* 右侧：操作按钮 */}
                <div className={cx('cm-card-actions', isMobile && 'cm-card-actions--mobile')}>
                    <ActionButton icon={<Pencil size={14} />} color="#60a5fa" onClick={onEdit} title="编辑" isMobile={isMobile} />
                    <ActionButton
                        icon={visible ? <Eye size={14} /> : <EyeOff size={14} />}
                        color={visible ? '#3fb950' : '#8b949e'}
                        onClick={onToggle}
                        title={visible ? "隐藏" : "显示"}
                        active={visible}
                        isMobile={isMobile}
                    />
                    <ActionButton icon={<Trash2 size={14} />} color="#f85149" onClick={onDelete} title="删除" isMobile={isMobile} />
                </div>
            </div>

            {/* 底部行：Symbol + 价格 + 持仓信息 */}
            <div className={cx('cm-card-bottom', isMobile && 'cm-card-bottom--mobile')}>
                {/* Symbol */}
                <div className={cx('cm-card-symbol', isMobile && 'cm-card-symbol--mobile')}>
                    {symbol}
                </div>

                {/* 价格 + 持仓 */}
                <div className={cx('cm-card-price-area', isMobile && 'cm-card-price-area--mobile')}>
                    {priceData?.price && (
                        <span className={cx(
                            'cm-card-price',
                            visible ? 'cm-card-price--visible' : 'cm-card-price--hidden',
                            isMobile && 'cm-card-price--mobile'
                        )}>
                            ${formatPrice(priceData.price)}
                        </span>
                    )}

                    {positionSummary && (
                        <div className={cx(
                            'cm-pnl-badge',
                            isMobile && 'cm-pnl-badge--mobile',
                            positionSummary.isProfit ? 'cm-pnl-badge--profit' : 'cm-pnl-badge--loss'
                        )}>
                            <span className={cx('cm-pnl-badge__icon', isMobile && 'cm-pnl-badge__icon--mobile')}>
                                {positionSummary.direction === 'long' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            </span>
                            <span className={cx(
                                'cm-pnl-badge__value',
                                isMobile && 'cm-pnl-badge__value--mobile',
                                positionSummary.isProfit ? 'cm-pnl-badge__value--profit' : 'cm-pnl-badge__value--loss'
                            )}>
                                {positionSummary.isProfit ? '+' : ''}{positionSummary.pnlPercent.toFixed(1)}%
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// 统一的操作按钮组件 -- hover 通过 CSS :hover 处理，颜色通过 CSS 自定义属性传入
const ActionButton = ({ icon, color, onClick, title, active, isMobile }) => (
    <button
        onClick={onClick}
        title={title}
        className={cx(
            'cm-action-btn',
            isMobile && 'cm-action-btn--mobile',
            active ? 'cm-action-btn--active' : 'cm-action-btn--inactive'
        )}
        style={{ '--btn-color': color }}
    >
        {icon}
    </button>
);

export default CardManager;
