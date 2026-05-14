// AssetEditorModal.jsx - 资产详情编辑器
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './AssetEditorModal.css';
import { updateAssetCard, getPositionSummary, ALERT_TYPES, TRIGGER_MODES, ALERT_PRESETS } from '../services/assetCards';
import { sendTestEmail, getDefaultAlertEmail } from '../services/alertService';
import { getIcon } from '../services/iconMap';
import {
    BellOff, Bell, Briefcase, TrendingUp, TrendingDown, Settings,
    BarChart3, Search, DollarSign, Lightbulb, Zap, Mail,
    Loader2, CheckCircle, XCircle, AlertTriangle, Save, Pencil
} from 'lucide-react';

const CATEGORY_OPTIONS = [
    '美股', 'A股', '港股', '加密货币', 'ETF', '外汇', '大宗商品', '指数', '其他'
];

// ========== 价格提醒状态卡片组件 ==========
const AlertStatusCard = ({ alert, conditions, onToggle, children }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    // 生成配置摘要
    const getConfigSummary = () => {
        if (!conditions || conditions.length === 0) return '未设置监控条件';
        return conditions.slice(0, 3).map(c => {
            const type = Object.values(ALERT_TYPES).find(t => t.id === c.type);
            const isPrice = ['price_above', 'price_below'].includes(c.type);
            return `${type?.emoji || '?'} ${type?.label || c.type} ${isPrice ? '$' : ''}${c.value}${isPrice ? '' : '%'}`;        }).join('\uFF0C') + (conditions.length > 3 ? ` +${conditions.length - 3}` : '');
    };

    if (!alert?.enabled) {
        return (
            <div className="status-card--disabled">
                <div className="status-card--disabled__body">
                    <div className="editor-row--md">
                        <div className="status-card__icon-wrap">
                            <span className="status-card__icon-text"><BellOff size={16} /></span>
                        </div>
                        <div className="status-card__info">
                            <span className="status-card__info-title">价格监控：已关闭</span>
                            <span className="status-card__info-sub">点击开启以追踪市场异动</span>
                        </div>
                    </div>
                    <button
                        onClick={() => { onToggle(true); setIsExpanded(true); }}
                        className="editor-btn-enable"
                    >
                        开启监控
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="status-card--alert">
            <div className="status-card__glow" />

            <div className="status-card--enabled__body">
                <div className="editor-row--md">
                    <div className="status-card__icon-wrap">
                        <span className="status-card__icon-text"><Bell size={16} /></span>
                        <span className="breathing-dot">
                            <span className="breathing-dot__ping breathing-dot__ping--success" />
                            <span className="breathing-dot__core breathing-dot__core--success" />
                        </span>
                    </div>

                    <div className="status-card__info">
                        <div className="editor-row--gap-xs">
                            <span className="status-badge status-badge--alert">
                                Running
                            </span>
                            <span className="status-card__label">
                                正在监控中
                            </span>
                        </div>
                        <span className="status-card__summary status-card__summary--alert">
                            {getConfigSummary()}
                        </span>
                    </div>
                </div>

                <div className="status-card__actions">
                    <button
                        onClick={() => onToggle(false)}
                        className="toggle-btn"
                        title="停用监控"
                    >
                        <div className="toggle-track toggle-track--alert">
                            <div className="toggle-knob toggle-knob--alert" />
                        </div>
                    </button>

                    <div className="toggle-divider toggle-divider--alert" />

                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={`settings-btn ${isExpanded ? 'settings-btn--expanded' : 'settings-btn--collapsed'}`}
                    >
                        <span className={`settings-btn__text ${isExpanded ? 'settings-btn__text--expanded' : 'settings-btn__text--collapsed'}`}>
                            {isExpanded ? '✕' : <Settings size={14} />}
                        </span>
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="expand-panel expand-panel--alert">
                    {children}
                </div>
            )}
        </div>
    );
};

// ========== 持仓管理状态卡片组件 ==========
const PositionStatusCard = ({ position, positionSummary, onToggle, children }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const getPositionSummaryText = () => {
        if (!position?.amount || !position?.entryPrice) return '未设置持仓信息';
        const direction = position.direction === 'long' ? '做多' : '做空';
        const amount = position.amount >= 1 ? position.amount.toFixed(4) : position.amount.toFixed(8);
        return `${direction} ${amount} @ $${position.entryPrice}`;
    };

    // 主题色：做多绿色，做空红色 — 通过 CSS 自定义属性注入
    const isShort = position?.direction === 'short';
    const themeColor = isShort ? '#f85149' : '#22c55e';
    const themeRgb = isShort ? '248, 81, 73' : '34, 197, 94';
    const themeColorLight = isShort ? 'rgba(248, 177, 173, 0.9)' : 'rgba(134, 239, 172, 0.9)';

    const cssVars = {
        '--theme-color': themeColor,
        '--theme-color-alpha-10': `rgba(${themeRgb}, 0.1)`,
        '--theme-color-alpha-12': `rgba(${themeRgb}, 0.12)`,
        '--theme-color-alpha-15': `rgba(${themeRgb}, 0.15)`,
        '--theme-color-alpha-20': `rgba(${themeRgb}, 0.2)`,
        '--theme-color-alpha-30': `rgba(${themeRgb}, 0.3)`,
        '--theme-color-alpha-50': `rgba(${themeRgb}, 0.5)`,
        '--theme-color-light': themeColorLight,
    };

    if (!position?.enabled) {
        return (
            <div className="status-card--disabled">
                <div className="status-card--disabled__body">
                    <div className="editor-row--md">
                        <div className="status-card__icon-wrap">
                            <span className="status-card__icon-text"><Briefcase size={16} /></span>
                        </div>
                        <div className="status-card__info">
                            <span className="status-card__info-title">持仓追踪：已关闭</span>
                            <span className="status-card__info-sub">点击开启以追踪盈亏</span>
                        </div>
                    </div>
                    <button
                        onClick={() => { onToggle(true); setIsExpanded(true); }}
                        className="editor-btn-enable"
                    >
                        开启追踪
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="status-card--position" style={cssVars}>
            <div className="status-card__glow" />

            <div className="status-card--enabled__body">
                <div className="editor-row--md">
                    <div className="status-card__icon-wrap">
                        <span className="status-card__icon-text">{isShort ? <TrendingDown size={16} /> : <TrendingUp size={16} />}</span>
                        <span className="breathing-dot" style={{ '--dot-color': themeColor }}>
                            <span className="breathing-dot__ping breathing-dot__ping--dynamic" />
                            <span className="breathing-dot__core breathing-dot__core--dynamic" />
                        </span>
                    </div>

                    <div className="status-card__info">
                        <div className="editor-row--gap-xs">
                            <span className="status-badge status-badge--position">
                                {isShort ? 'Short' : 'Long'}
                            </span>
                            <span className="status-card__label">
                                持仓追踪中
                            </span>
                        </div>
                        <div className="editor-summary-row">
                            <span className="status-card__summary status-card__summary--position status-card__summary--narrow">
                                {getPositionSummaryText()}
                            </span>
                            {positionSummary && (
                                <span className={`status-card__pnl-percent ${positionSummary.isProfit ? 'status-card__pnl-percent--profit' : 'status-card__pnl-percent--loss'}`}>
                                    {positionSummary.isProfit ? '+' : ''}{positionSummary.pnlPercent?.toFixed(2)}%
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="status-card__actions">
                    <button
                        onClick={() => onToggle(false)}
                        className="toggle-btn"
                        title="停用追踪"
                    >
                        <div className="toggle-track toggle-track--position">
                            <div className="toggle-knob toggle-knob--position" />
                        </div>
                    </button>

                    <div className="toggle-divider toggle-divider--position" />

                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={`settings-btn ${isExpanded ? 'settings-btn--expanded-pos' : 'settings-btn--collapsed-pos'}`}
                    >
                        <span className={`settings-btn__text ${isExpanded ? 'settings-btn__text--expanded-pos' : 'settings-btn__text--collapsed-pos'}`}>
                            {isExpanded ? '✕' : <Settings size={14} />}
                        </span>
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="expand-panel expand-panel--position">
                    {children}
                </div>
            )}
        </div>
    );
};

// 条件选项小方块（增强版：支持触发模式）
const AlertOptionTile = ({ condition, alertType, isPrice, isPercent, onUpdate, onRemove }) => {
    const triggerMode = TRIGGER_MODES[condition.triggerMode?.toUpperCase()] || TRIGGER_MODES.CROSS;

    return (
        <div className="alert-tile">
            <div className="alert-tile__header">
                <div className="alert-tile__title">
                    <span className="alert-tile__title-icon">{alertType?.icon ? getIcon(alertType.icon, { size: 14 }) : <Bell size={14} />}</span>
                    <span className="alert-tile__title-text">{alertType?.label || condition.type}</span>
                </div>
                <div className="alert-tile__header-actions">
                    <div className="alert-tile__dot" />
                    <button
                        onClick={onRemove}
                        className="alert-tile__remove"
                    >
                        ×
                    </button>
                </div>
            </div>

            <div className="alert-tile__input-row">
                <input
                    type="number"
                    step={isPrice ? '1' : '0.1'}
                    value={condition.value}
                    onChange={e => onUpdate({ value: parseFloat(e.target.value) || 0 })}
                    className="alert-tile__input"
                />
                <span className="alert-tile__unit">
                    {isPrice ? 'USD' : isPercent ? '%' : ''}
                </span>
            </div>

            <div className="alert-tile__trigger-modes">
                {Object.values(TRIGGER_MODES).map(mode => (
                    <button
                        key={mode.id}
                        onClick={() => onUpdate({ triggerMode: mode.id })}
                        title={mode.description}
                        className={`alert-tile__trigger-btn ${condition.triggerMode === mode.id ? 'alert-tile__trigger-btn--active' : 'alert-tile__trigger-btn--inactive'}`}
                    >
                        {getIcon(mode.icon, { size: 10 })} {mode.label}
                    </button>
                ))}
            </div>

            {condition.triggerMode === 'step' && (
                <div className="alert-tile__step-row">
                    <span className="alert-tile__step-label">步长:</span>
                    <input
                        type="number"
                        step="1"
                        value={condition.stepSize || Math.round(condition.value * 0.01)}
                        onChange={e => onUpdate({ stepSize: parseFloat(e.target.value) || 0 })}
                        className="alert-tile__step-input"
                    />
                    <span className="alert-tile__step-unit">
                        {isPrice ? 'USD' : ''}
                    </span>
                </div>
            )}

            {condition.triggerMode === 'once' && condition.hasTriggered && (
                <div className="alert-tile__once-warning">
                    <AlertTriangle size={12} /> 已触发（需重置）
                </div>
            )}
        </div>
    );
};

const AssetEditorModal = ({ isOpen, onClose, card, currentPrice, onUpdate }) => {
    const [editedCard, setEditedCard] = useState(null);
    const [keywordInput, setKeywordInput] = useState('');
    const [inputMode, setInputMode] = useState('quantity');
    const [investmentValue, setInvestmentValue] = useState(0);
    const [testingEmail, setTestingEmail] = useState(false);
    const [testEmailResult, setTestEmailResult] = useState(null);
    const [testEmailAddress, setTestEmailAddress] = useState('');

    useEffect(() => {
        if (card) {
            setEditedCard({
                ...card,
                position: card.position || {
                    enabled: false,
                    direction: 'long',
                    amount: 0,
                    entryPrice: 0,
                    currency: card.position?.currency || 'USD'
                },
                alert: card.alert || {
                    enabled: false,
                    conditions: [],
                    cooldownMinutes: 240,
                    lastTriggered: {},
                    dailyLimit: 5,
                    dailyCount: 0,
                    dailyResetDate: null
                }
            });
            if (card.position?.amount && card.position?.entryPrice) {
                setInvestmentValue(card.position.amount * card.position.entryPrice);
            }
            setTestEmailResult(null);
            setTestEmailAddress(getDefaultAlertEmail() || '');
        }
    }, [card]);

    if (!isOpen || !editedCard) return null;

    const handleSave = async () => {
        await updateAssetCard(editedCard.id, editedCard);
        onUpdate?.();
        onClose();
    };

    const handleAddKeyword = () => {
        if (keywordInput.trim()) {
            setEditedCard({
                ...editedCard,
                newsKeywords: [...(editedCard.newsKeywords || []), keywordInput.trim()]
            });
            setKeywordInput('');
        }
    };

    const handleRemoveKeyword = (index) => {
        setEditedCard({
            ...editedCard,
            newsKeywords: (editedCard.newsKeywords || []).filter((_, i) => i !== index)
        });
    };

    const handleAddCondition = (typeId) => {
        const alertType = Object.values(ALERT_TYPES).find(t => t.id === typeId);
        if (!alertType) return;

        const defaultValues = {
            'price_above': currentPrice ? Math.round(currentPrice * 1.1) : 0,
            'price_below': currentPrice ? Math.round(currentPrice * 0.9) : 0,
            'change_up': 10,
            'change_down': 10,
            'volatility': 5,
            'rsi_overbought': 70,
            'rsi_oversold': 30,
            'vegas_breakout': 2
        };

        const newCondition = {
            type: typeId,
            value: defaultValues[typeId] || 0,
            triggerMode: 'cross',
            lastPriceAbove: null
        };

        setEditedCard({
            ...editedCard,
            alert: {
                ...editedCard.alert,
                conditions: [...(editedCard.alert.conditions || []), newCondition]
            }
        });
    };

    const handleAddPreset = (presetKey, direction = 'below') => {
        const preset = ALERT_PRESETS[presetKey];
        if (!preset || !currentPrice) return;

        const newCondition = preset.getCondition(currentPrice, direction);

        setEditedCard({
            ...editedCard,
            alert: {
                ...editedCard.alert,
                conditions: [...(editedCard.alert.conditions || []), newCondition]
            }
        });
    };

    const handleUpdateCondition = (index, updates) => {
        const conditions = [...editedCard.alert.conditions];
        conditions[index] = { ...conditions[index], ...updates };
        setEditedCard({
            ...editedCard,
            alert: { ...editedCard.alert, conditions }
        });
    };

    const handleRemoveCondition = (index) => {
        const conditions = (editedCard.alert?.conditions || []).filter((_, i) => i !== index);
        setEditedCard({
            ...editedCard,
            alert: { ...editedCard.alert, conditions }
        });
    };

    const handleTestEmail = async () => {
        setTestingEmail(true);
        setTestEmailResult(null);
        const result = await sendTestEmail(testEmailAddress, editedCard);
        setTestEmailResult(result);
        setTestingEmail(false);
    };

    const handleInvestmentChange = (value) => {
        setInvestmentValue(value);
        if (editedCard.position.entryPrice > 0) {
            const calculatedAmount = value / editedCard.position.entryPrice;
            setEditedCard({
                ...editedCard,
                position: { ...editedCard.position, amount: calculatedAmount }
            });
        }
    };

    const handleEntryPriceChange = (price) => {
        setEditedCard({
            ...editedCard,
            position: { ...editedCard.position, entryPrice: price }
        });

        if (inputMode === 'value' && price > 0 && investmentValue > 0) {
            const calculatedAmount = investmentValue / price;
            setEditedCard(prev => ({
                ...prev,
                position: { ...prev.position, amount: calculatedAmount }
            }));
        }
    };

    const positionSummary = currentPrice && editedCard.position?.enabled
        ? getPositionSummary(editedCard, currentPrice)
        : null;

    return createPortal(
        <div className="editor-overlay">
            <div className="editor-modal">
                {/* Header */}
                <div className="editor-header">
                    <h2 className="editor-header__title"><Pencil size={16} /> 编辑资产</h2>
                    <p className="editor-header__subtitle">
                        {editedCard.name} · {editedCard.symbol}
                    </p>
                </div>

                {/* Content */}
                <div className="editor-content">

                    {/* Section 1: Basic Info */}
                    <Section title="基本信息" icon={<BarChart3 size={16} />}>
                        <FormField label="资产分类">
                            <select
                                value={editedCard.category || ''}
                                onChange={e => setEditedCard({ ...editedCard, category: e.target.value })}
                                className="editor-select"
                            >
                                <option value="">请选择分类</option>
                                {CATEGORY_OPTIONS.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </FormField>
                    </Section>

                    {/* Section 2: News Keywords */}
                    <Section title="新闻关键词" icon={<Search size={16} />}>
                        <div className="editor-mb-md">
                            <div className="editor-keyword-input-row">
                                <input
                                    type="text"
                                    value={keywordInput}
                                    onChange={e => setKeywordInput(e.target.value)}
                                    onKeyPress={e => e.key === 'Enter' && handleAddKeyword()}
                                    placeholder="输入关键词，回车添加"
                                    className="editor-input editor-input--flex"
                                />
                                <button
                                    onClick={handleAddKeyword}
                                    className="editor-btn-add"
                                >
                                    添加
                                </button>
                            </div>

                            <div className="editor-row--wrap">
                                {editedCard.newsKeywords?.map((keyword, index) => (
                                    <div key={index} className="editor-keyword-tag">
                                        <span>{keyword}</span>
                                        <button
                                            onClick={() => handleRemoveKeyword(index)}
                                            className="editor-keyword-remove"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Section>

                    {/* Section 3: Portfolio */}
                    <Section title="持仓管理" icon={<Briefcase size={16} />}>
                        <PositionStatusCard
                            position={editedCard.position}
                            positionSummary={positionSummary}
                            onToggle={(enabled) => setEditedCard({
                                ...editedCard,
                                position: { ...editedCard.position, enabled }
                            })}
                        >
                            <FormField label="交易方向">
                                <div className="editor-row editor-row--md">
                                    {['long', 'short'].map(dir => (
                                        <label
                                            key={dir}
                                            className={`radio-card ${editedCard.position.direction === dir ? 'radio-card--long-active' : 'radio-card--long-inactive'}`}
                                        >
                                            <input
                                                type="radio"
                                                name="direction"
                                                checked={editedCard.position.direction === dir}
                                                onChange={() => setEditedCard({
                                                    ...editedCard,
                                                    position: { ...editedCard.position, direction: dir }
                                                })}
                                                className="editor-hidden-input"
                                            />
                                            {dir === 'long' ? <><TrendingUp size={14} /> 做多 (Long)</> : <><TrendingDown size={14} /> 做空 (Short)</>}
                                        </label>
                                    ))}
                                </div>
                            </FormField>

                            <FormField label="输入方式">
                                <div className="editor-row editor-row--md">
                                    {[
                                        { value: 'quantity', label: '按数量', desc: '直接输入持有数量' },
                                        { value: 'value', label: '按金额', desc: '输入投入总额自动计算' }
                                    ].map(mode => (
                                        <label
                                            key={mode.value}
                                            className={`radio-card ${inputMode === mode.value ? 'radio-card--mode-active' : 'radio-card--mode-inactive'}`}
                                        >
                                            <input
                                                type="radio"
                                                name="inputMode"
                                                checked={inputMode === mode.value}
                                                onChange={() => setInputMode(mode.value)}
                                                className="editor-hidden-input"
                                            />
                                            <div className="radio-card__label">
                                                {mode.label}
                                            </div>
                                            <div className="radio-card__desc">
                                                {mode.desc}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </FormField>

                            {inputMode === 'quantity' ? (
                                <div className="editor-grid-2">
                                    <FormField label="持仓数量">
                                        <input
                                            type="number"
                                            step="any"
                                            value={editedCard.position.amount || ''}
                                            onChange={e => {
                                                const amount = parseFloat(e.target.value) || 0;
                                                setEditedCard({
                                                    ...editedCard,
                                                    position: { ...editedCard.position, amount }
                                                });
                                                setInvestmentValue(amount * editedCard.position.entryPrice);
                                            }}
                                            placeholder="0"
                                            className="editor-input"
                                        />
                                    </FormField>

                                    <FormField label={`持仓均价 (${editedCard.position.currency})`}>
                                        <input
                                            type="number"
                                            step="any"
                                            value={editedCard.position.entryPrice || ''}
                                            onChange={e => {
                                                const price = parseFloat(e.target.value) || 0;
                                                setEditedCard({
                                                    ...editedCard,
                                                    position: { ...editedCard.position, entryPrice: price }
                                                });
                                                setInvestmentValue(editedCard.position.amount * price);
                                            }}
                                            placeholder="0"
                                            className="editor-input"
                                        />
                                    </FormField>
                                </div>
                            ) : (
                                <>
                                    <div className="editor-grid-2">
                                        <FormField label={`投入金额 (${editedCard.position.currency})`}>
                                            <input
                                                type="number"
                                                step="any"
                                                value={investmentValue || ''}
                                                onChange={e => handleInvestmentChange(parseFloat(e.target.value) || 0)}
                                                placeholder="0"
                                                className="editor-input"
                                            />
                                        </FormField>

                                        <FormField label={`买入价格 (${editedCard.position.currency})`}>
                                            <input
                                                type="number"
                                                step="any"
                                                value={editedCard.position.entryPrice || ''}
                                                onChange={e => handleEntryPriceChange(parseFloat(e.target.value) || 0)}
                                                placeholder="0"
                                                className="editor-input"
                                            />
                                        </FormField>
                                    </div>

                                    <div className="calc-hint">
                                        <Lightbulb size={14} /> 自动计算持仓数量：<span className="calc-hint__value">
                                            {editedCard.position.amount.toFixed(8)}
                                        </span>
                                    </div>
                                </>
                            )}

                            {positionSummary && (
                                <div
                                    className={`pnl-preview ${positionSummary.isProfit ? 'pnl-preview--profit' : 'pnl-preview--loss'}`}
                                >
                                    <div className="pnl-preview__label">
                                        <Lightbulb size={14} /> 实时盈亏预览
                                    </div>
                                    <div className="pnl-preview__row">
                                        <span className="pnl-preview__direction">
                                            {positionSummary.direction === 'long' ? '做多' : '做空'} × {positionSummary.amount}
                                        </span>
                                        <span className={positionSummary.isProfit ? 'pnl-preview__value--profit' : 'pnl-preview__value--loss'}>
                                            {positionSummary.isProfit ? '+' : ''}{positionSummary.pnl.toFixed(2)} {positionSummary.currency} ({positionSummary.isProfit ? '+' : ''}{positionSummary.pnlPercent.toFixed(2)}%)
                                        </span>
                                    </div>
                                </div>
                            )}
                        </PositionStatusCard>
                    </Section>

                    {/* Section 4: Price Alerts */}
                    <Section title="价格提醒" icon={<Bell size={16} />}>
                        <AlertStatusCard
                            alert={editedCard.alert}
                            conditions={editedCard.alert?.conditions || []}
                            onToggle={(enabled) => setEditedCard({
                                ...editedCard,
                                alert: { ...editedCard.alert, enabled }
                            })}
                        >
                            {editedCard.alert?.conditions?.length > 0 && (
                                <div className="editor-mb-lg">
                                    <div className="panel-section-title">
                                        监控条件
                                    </div>
                                    <div className="editor-grid-fill-160">
                                        {editedCard.alert.conditions.map((condition, index) => {
                                            const alertType = Object.values(ALERT_TYPES).find(t => t.id === condition.type);
                                            const isPrice = ['price_above', 'price_below'].includes(condition.type);
                                            const isPercent = ['change_up', 'change_down', 'volatility', 'vegas_breakout'].includes(condition.type);
                                            return (
                                                <AlertOptionTile
                                                    key={index}
                                                    condition={condition}
                                                    alertType={alertType}
                                                    isPrice={isPrice}
                                                    isPercent={isPercent}
                                                    onUpdate={(updates) => handleUpdateCondition(index, updates)}
                                                    onRemove={() => handleRemoveCondition(index)}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {currentPrice > 0 && (
                                <div className="editor-mb-lg">
                                    <div className="panel-section-title">
                                        <Zap size={14} /> 快捷模板 (当前价: ${currentPrice.toLocaleString()})
                                    </div>
                                    <div className="editor-grid-fill-180">
                                        {Object.entries(ALERT_PRESETS).map(([key, preset]) => (
                                            <div key={key} className="preset-card">
                                                <div className="preset-card__row">
                                                    <span className="preset-card__title">{getIcon(preset.icon, { size: 14 })}</span>
                                                    <span className="preset-card__label">{preset.label}</span>
                                                </div>
                                                <div className="preset-card__desc">
                                                    {preset.description}
                                                </div>
                                                <div className="preset-card__btns">
                                                    <button
                                                        onClick={() => handleAddPreset(key, 'above')}
                                                        className="preset-card__btn--up"
                                                    >
                                                        <TrendingUp size={12} /> 突破
                                                    </button>
                                                    <button
                                                        onClick={() => handleAddPreset(key, 'below')}
                                                        className="preset-card__btn--down"
                                                    >
                                                        <TrendingDown size={12} /> 跌破
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="editor-mb-lg">
                                <div className="panel-section-title">
                                    添加条件
                                </div>
                                <div className="editor-grid-fill-140">
                                    {Object.values(ALERT_TYPES).map(alertType => (
                                        <button
                                            key={alertType.id}
                                            onClick={() => handleAddCondition(alertType.id)}
                                            title={alertType.description}
                                            className="alert-add-btn"
                                        >
                                            <span>{getIcon(alertType.icon, { size: 14 })}</span>
                                            <span>{alertType.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="advanced-panel">
                                <div className="panel-section-title">
                                    <Settings size={14} /> 高级设置
                                </div>
                                <div className="editor-grid-2">
                                    <div>
                                        <label className="editor-advanced-label">
                                            冷却时间 (分钟)
                                        </label>
                                        <input
                                            type="number"
                                            value={editedCard.alert?.cooldownMinutes || 240}
                                            onChange={e => setEditedCard({
                                                ...editedCard,
                                                alert: { ...editedCard.alert, cooldownMinutes: parseInt(e.target.value) || 240 }
                                            })}
                                            className="advanced-panel__input"
                                        />
                                    </div>
                                    <div>
                                        <label className="editor-advanced-label">
                                            每日上限 (封)
                                        </label>
                                        <input
                                            type="number"
                                            value={editedCard.alert?.dailyLimit || 5}
                                            onChange={e => setEditedCard({
                                                ...editedCard,
                                                alert: { ...editedCard.alert, dailyLimit: parseInt(e.target.value) || 5 }
                                            })}
                                            className="advanced-panel__input"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="editor-mt-xs">
                                <div className="panel-section-title">
                                    <Mail size={14} /> 测试邮件
                                </div>
                                <div className="editor-test-email-row">
                                    <input
                                        type="text"
                                        value={testEmailAddress}
                                        onChange={e => setTestEmailAddress(e.target.value)}
                                        placeholder="多个邮箱用逗号分隔，如: a@qq.com, b@163.com"
                                        className="editor-test-email-input"
                                    />
                                    <button
                                        onClick={handleTestEmail}
                                        disabled={testingEmail || !testEmailAddress}
                                        className={`test-email-btn ${testEmailResult?.success ? 'test-email-btn--success' : testEmailResult?.error ? 'test-email-btn--error' : 'test-email-btn--default'} ${!testEmailAddress ? 'test-email-btn--disabled' : ''}`}
                                    >
                                        {testingEmail ? <><Loader2 size={14} className="spin" /> 发送中...</> :
                                         testEmailResult?.success ? <><CheckCircle size={14} /> {testEmailResult.count}/{testEmailResult.total}</> :
                                         testEmailResult?.error ? <><XCircle size={14} /> 失败</> :
                                         '发送'}
                                    </button>
                                </div>
                                {testEmailResult?.success && (
                                    <div className="test-result--success">
                                        <CheckCircle size={14} /> 成功发送 {testEmailResult.count}/{testEmailResult.total} 封到: {testEmailResult.to}
                                    </div>
                                )}
                                {testEmailResult?.error && (
                                    <div className="test-result--error">
                                        {testEmailResult.error}
                                    </div>
                                )}
                            </div>
                        </AlertStatusCard>
                    </Section>
                </div>

                {/* Footer */}
                <div className="editor-footer">
                    <button
                        onClick={onClose}
                        className="editor-btn-cancel"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSave}
                        className="editor-btn-save"
                    >
                        <Save size={14} /> 保存
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

// Section Component
const Section = ({ title, icon, children }) => (
    <div className="editor-section">
        <h3 className="editor-section__title">
            {icon}{title}
        </h3>
        {children}
    </div>
);

// Form Field Component
const FormField = ({ label, children }) => (
    <div className="editor-field">
        <label className="editor-field__label">
            {label}
        </label>
        {children}
    </div>
);

export default AssetEditorModal;
