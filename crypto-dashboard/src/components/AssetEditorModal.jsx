// AssetEditorModal.jsx - 资产详情编辑器
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { updateAssetCard, getPositionSummary, ALERT_TYPES } from '../services/assetCards';
import { sendTestEmail, getDefaultAlertEmail } from '../services/alertService';

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
            return `${type?.icon || '🔔'} ${type?.label || c.type} ${isPrice ? '$' : ''}${c.value}${isPrice ? '' : '%'}`;
        }).join('，') + (conditions.length > 3 ? ` +${conditions.length - 3}` : '');
    };

    if (!alert?.enabled) {
        // 🌑 未启用状态
        return (
            <div style={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '0.75rem',
                border: '1px solid #30363d',
                background: 'rgba(22, 27, 34, 0.5)',
                backdropFilter: 'blur(8px)',
                transition: 'all 0.3s ease'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem 1.25rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            display: 'flex',
                            height: '40px',
                            width: '40px',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '50%',
                            background: '#21262d',
                            color: '#6e7681',
                            transition: 'color 0.2s'
                        }}>
                            <span style={{ fontSize: '1.25rem' }}>🔕</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ color: '#8b949e', fontWeight: '500' }}>价格监控：已关闭</span>
                            <span style={{ fontSize: '0.75rem', color: '#484f58' }}>点击开启以追踪市场异动</span>
                        </div>
                    </div>
                    <button
                        onClick={() => { onToggle(true); setIsExpanded(true); }}
                        style={{
                            padding: '0.5rem 1rem',
                            background: '#21262d',
                            border: '1px solid #30363d',
                            borderRadius: '0.5rem',
                            color: '#e6edf3',
                            fontSize: '0.85rem',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => {
                            e.target.style.background = '#30363d';
                            e.target.style.color = '#fff';
                        }}
                        onMouseLeave={e => {
                            e.target.style.background = '#21262d';
                            e.target.style.color = '#e6edf3';
                        }}
                    >
                        开启监控
                    </button>
                </div>
            </div>
        );
    }

    // 🟢 已启用状态
    return (
        <div style={{
            position: 'relative',
            borderRadius: '0.75rem',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(30, 41, 59, 0.4) 100%)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.15)',
            transition: 'all 0.3s ease',
            overflow: 'hidden'
        }}>
            {/* 装饰性光晕 */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'radial-gradient(ellipse at top left, rgba(99, 102, 241, 0.1) 0%, transparent 50%)',
                pointerEvents: 'none'
            }} />

            <div style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.25rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {/* 图标容器：带发光效果 */}
                    <div style={{
                        position: 'relative',
                        display: 'flex',
                        height: '40px',
                        width: '40px',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                        background: 'rgba(99, 102, 241, 0.2)',
                        border: '1px solid rgba(99, 102, 241, 0.2)',
                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)'
                    }}>
                        <span style={{ fontSize: '1.25rem' }}>🔔</span>
                        {/* 呼吸灯 */}
                        <span style={{
                            position: 'absolute',
                            top: '2px',
                            right: '2px',
                            height: '10px',
                            width: '10px'
                        }}>
                            <span style={{
                                position: 'absolute',
                                display: 'inline-flex',
                                height: '100%',
                                width: '100%',
                                borderRadius: '50%',
                                background: '#22c55e',
                                opacity: 0.75,
                                animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite'
                            }} />
                            <span style={{
                                position: 'relative',
                                display: 'inline-flex',
                                borderRadius: '50%',
                                height: '10px',
                                width: '10px',
                                background: '#22c55e',
                                border: '2px solid #0d1117'
                            }} />
                        </span>
                    </div>

                    {/* 信息摘要 */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{
                                color: '#22c55e',
                                fontSize: '0.65rem',
                                fontWeight: 'bold',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                background: 'rgba(34, 197, 94, 0.15)',
                                padding: '0.15rem 0.4rem',
                                borderRadius: '0.25rem'
                            }}>
                                Running
                            </span>
                            <span style={{ color: '#e0e7ff', fontWeight: '500', fontSize: '0.9rem' }}>
                                正在监控中
                            </span>
                        </div>
                        <span style={{
                            fontSize: '0.75rem',
                            color: 'rgba(165, 180, 252, 0.8)',
                            marginTop: '0.25rem',
                            maxWidth: '280px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}>
                            {getConfigSummary()}
                        </span>
                    </div>
                </div>

                {/* 操作按钮区 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {/* 开关 */}
                    <button
                        onClick={() => onToggle(false)}
                        style={{
                            padding: '0.5rem',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer'
                        }}
                        title="停用监控"
                    >
                        <div style={{
                            width: '36px',
                            height: '18px',
                            background: 'rgba(99, 102, 241, 0.3)',
                            borderRadius: '9px',
                            position: 'relative',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            transition: 'all 0.2s'
                        }}>
                            <div style={{
                                position: 'absolute',
                                right: '2px',
                                top: '2px',
                                height: '12px',
                                width: '12px',
                                background: '#818cf8',
                                borderRadius: '50%',
                                boxShadow: '0 0 4px rgba(129, 140, 248, 0.5)'
                            }} />
                        </div>
                    </button>

                    <div style={{ height: '24px', width: '1px', background: 'rgba(99, 102, 241, 0.2)', margin: '0 0.25rem' }} />

                    {/* 设置按钮 */}
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        style={{
                            padding: '0.5rem',
                            borderRadius: '0.5rem',
                            transition: 'all 0.2s',
                            background: isExpanded ? '#6366f1' : 'rgba(33, 38, 45, 0.5)',
                            border: 'none',
                            cursor: 'pointer',
                            boxShadow: isExpanded ? '0 0 12px rgba(99, 102, 241, 0.4)' : 'none'
                        }}
                    >
                        <span style={{
                            fontSize: '1rem',
                            color: isExpanded ? '#fff' : '#a5b4fc'
                        }}>
                            {isExpanded ? '✕' : '⚙️'}
                        </span>
                    </button>
                </div>
            </div>

            {/* 展开的详细配置面板 */}
            {isExpanded && (
                <div style={{
                    borderTop: '1px solid rgba(99, 102, 241, 0.2)',
                    padding: '1.25rem',
                    background: 'rgba(15, 23, 42, 0.4)',
                    animation: 'fadeSlideIn 0.2s ease-out'
                }}>
                    {children}
                </div>
            )}

            {/* CSS 动画 */}
            <style>{`
                @keyframes ping {
                    75%, 100% {
                        transform: scale(2);
                        opacity: 0;
                    }
                }
                @keyframes fadeSlideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-8px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
        </div>
    );
};

// ========== 持仓管理状态卡片组件 ==========
const PositionStatusCard = ({ position, positionSummary, onToggle, children }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // 生成持仓摘要
    const getPositionSummary = () => {
        if (!position?.amount || !position?.entryPrice) return '未设置持仓信息';
        const direction = position.direction === 'long' ? '📈 做多' : '📉 做空';
        const amount = position.amount >= 1 ? position.amount.toFixed(4) : position.amount.toFixed(8);
        return `${direction} ${amount} @ $${position.entryPrice}`;
    };

    // 主题色：做多绿色，做空红色
    const themeColor = position?.direction === 'short' ? '248, 81, 73' : '34, 197, 94';
    const themeHex = position?.direction === 'short' ? '#f85149' : '#22c55e';

    if (!position?.enabled) {
        // 🌑 未启用状态
        return (
            <div style={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '0.75rem',
                border: '1px solid #30363d',
                background: 'rgba(22, 27, 34, 0.5)',
                backdropFilter: 'blur(8px)',
                transition: 'all 0.3s ease'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem 1.25rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            display: 'flex',
                            height: '40px',
                            width: '40px',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '50%',
                            background: '#21262d',
                            color: '#6e7681',
                            transition: 'color 0.2s'
                        }}>
                            <span style={{ fontSize: '1.25rem' }}>💼</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ color: '#8b949e', fontWeight: '500' }}>持仓追踪：已关闭</span>
                            <span style={{ fontSize: '0.75rem', color: '#484f58' }}>点击开启以追踪盈亏</span>
                        </div>
                    </div>
                    <button
                        onClick={() => { onToggle(true); setIsExpanded(true); }}
                        style={{
                            padding: '0.5rem 1rem',
                            background: '#21262d',
                            border: '1px solid #30363d',
                            borderRadius: '0.5rem',
                            color: '#e6edf3',
                            fontSize: '0.85rem',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => {
                            e.target.style.background = '#30363d';
                            e.target.style.color = '#fff';
                        }}
                        onMouseLeave={e => {
                            e.target.style.background = '#21262d';
                            e.target.style.color = '#e6edf3';
                        }}
                    >
                        开启追踪
                    </button>
                </div>
            </div>
        );
    }

    // 🟢 已启用状态
    return (
        <div style={{
            position: 'relative',
            borderRadius: '0.75rem',
            border: `1px solid rgba(${themeColor}, 0.3)`,
            background: `linear-gradient(135deg, rgba(${themeColor}, 0.12) 0%, rgba(30, 41, 59, 0.4) 100%)`,
            backdropFilter: 'blur(12px)',
            boxShadow: `0 0 20px rgba(${themeColor}, 0.15)`,
            transition: 'all 0.3s ease',
            overflow: 'hidden'
        }}>
            {/* 装饰性光晕 */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: `radial-gradient(ellipse at top left, rgba(${themeColor}, 0.1) 0%, transparent 50%)`,
                pointerEvents: 'none'
            }} />

            <div style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.25rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {/* 图标容器 */}
                    <div style={{
                        position: 'relative',
                        display: 'flex',
                        height: '40px',
                        width: '40px',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                        background: `rgba(${themeColor}, 0.2)`,
                        border: `1px solid rgba(${themeColor}, 0.2)`,
                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)'
                    }}>
                        <span style={{ fontSize: '1.25rem' }}>{position?.direction === 'short' ? '📉' : '📈'}</span>
                        {/* 呼吸灯 */}
                        <span style={{
                            position: 'absolute',
                            top: '2px',
                            right: '2px',
                            height: '10px',
                            width: '10px'
                        }}>
                            <span style={{
                                position: 'absolute',
                                display: 'inline-flex',
                                height: '100%',
                                width: '100%',
                                borderRadius: '50%',
                                background: themeHex,
                                opacity: 0.75,
                                animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite'
                            }} />
                            <span style={{
                                position: 'relative',
                                display: 'inline-flex',
                                borderRadius: '50%',
                                height: '10px',
                                width: '10px',
                                background: themeHex,
                                border: '2px solid #0d1117'
                            }} />
                        </span>
                    </div>

                    {/* 信息摘要 */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{
                                color: themeHex,
                                fontSize: '0.65rem',
                                fontWeight: 'bold',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                background: `rgba(${themeColor}, 0.15)`,
                                padding: '0.15rem 0.4rem',
                                borderRadius: '0.25rem'
                            }}>
                                {position?.direction === 'short' ? 'Short' : 'Long'}
                            </span>
                            <span style={{ color: '#e0e7ff', fontWeight: '500', fontSize: '0.9rem' }}>
                                持仓追踪中
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                            <span style={{
                                fontSize: '0.75rem',
                                color: `rgba(${themeColor === '248, 81, 73' ? '248, 177, 173' : '134, 239, 172'}, 0.9)`,
                                maxWidth: '180px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}>
                                {getPositionSummary()}
                            </span>
                            {positionSummary && (
                                <span style={{
                                    fontSize: '0.8rem',
                                    fontWeight: 'bold',
                                    color: positionSummary.isProfit ? '#3fb950' : '#f85149'
                                }}>
                                    {positionSummary.isProfit ? '+' : ''}{positionSummary.pnlPercent?.toFixed(2)}%
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* 操作按钮区 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {/* 开关 */}
                    <button
                        onClick={() => onToggle(false)}
                        style={{
                            padding: '0.5rem',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer'
                        }}
                        title="停用追踪"
                    >
                        <div style={{
                            width: '36px',
                            height: '18px',
                            background: `rgba(${themeColor}, 0.3)`,
                            borderRadius: '9px',
                            position: 'relative',
                            border: `1px solid rgba(${themeColor}, 0.3)`,
                            transition: 'all 0.2s'
                        }}>
                            <div style={{
                                position: 'absolute',
                                right: '2px',
                                top: '2px',
                                height: '12px',
                                width: '12px',
                                background: themeHex,
                                borderRadius: '50%',
                                boxShadow: `0 0 4px rgba(${themeColor}, 0.5)`
                            }} />
                        </div>
                    </button>

                    <div style={{ height: '24px', width: '1px', background: `rgba(${themeColor}, 0.2)`, margin: '0 0.25rem' }} />

                    {/* 设置按钮 */}
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        style={{
                            padding: '0.5rem',
                            borderRadius: '0.5rem',
                            transition: 'all 0.2s',
                            background: isExpanded ? themeHex : 'rgba(33, 38, 45, 0.5)',
                            border: 'none',
                            cursor: 'pointer',
                            boxShadow: isExpanded ? `0 0 12px rgba(${themeColor}, 0.4)` : 'none'
                        }}
                    >
                        <span style={{
                            fontSize: '1rem',
                            color: isExpanded ? '#fff' : themeHex
                        }}>
                            {isExpanded ? '✕' : '⚙️'}
                        </span>
                    </button>
                </div>
            </div>

            {/* 展开的详细配置面板 */}
            {isExpanded && (
                <div style={{
                    borderTop: `1px solid rgba(${themeColor}, 0.2)`,
                    padding: '1.25rem',
                    background: 'rgba(15, 23, 42, 0.4)',
                    animation: 'fadeSlideIn 0.2s ease-out'
                }}>
                    {children}
                </div>
            )}

            {/* CSS 动画 */}
            <style>{`
                @keyframes ping {
                    75%, 100% {
                        transform: scale(2);
                        opacity: 0;
                    }
                }
                @keyframes fadeSlideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-8px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
        </div>
    );
};

// 条件选项小方块
const AlertOptionTile = ({ condition, alertType, isPrice, isPercent, onUpdate, onRemove }) => (
    <div style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '0.75rem',
        borderRadius: '0.5rem',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        background: 'rgba(99, 102, 241, 0.08)',
        cursor: 'default',
        transition: 'all 0.2s',
        boxShadow: '0 0 8px rgba(99, 102, 241, 0.1)'
    }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1rem' }}>{alertType?.icon || '🔔'}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: '500', color: '#e0e7ff' }}>{alertType?.label || condition.type}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <div style={{
                    height: '6px',
                    width: '6px',
                    borderRadius: '50%',
                    background: '#818cf8',
                    boxShadow: '0 0 4px rgba(129, 140, 248, 0.8)'
                }} />
                <button
                    onClick={onRemove}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#f87171',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        padding: '0 0.25rem',
                        opacity: 0.6,
                        transition: 'opacity 0.2s'
                    }}
                    onMouseEnter={e => e.target.style.opacity = 1}
                    onMouseLeave={e => e.target.style.opacity = 0.6}
                >
                    ×
                </button>
            </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
                type="number"
                step={isPrice ? '1' : '0.1'}
                value={condition.value}
                onChange={e => onUpdate(parseFloat(e.target.value) || 0)}
                style={{
                    flex: '1 1 0',
                    minWidth: 0,
                    maxWidth: '100px',
                    padding: '0.4rem 0.5rem',
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    borderRadius: '0.25rem',
                    color: '#fff',
                    fontFamily: 'monospace',
                    fontSize: '0.9rem',
                    fontWeight: 'bold'
                }}
            />
            <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                {isPrice ? 'USD' : isPercent ? '%' : ''}
            </span>
        </div>
    </div>
);

const AssetEditorModal = ({ isOpen, onClose, card, currentPrice, onUpdate }) => {
    const [editedCard, setEditedCard] = useState(null);
    const [keywordInput, setKeywordInput] = useState('');
    const [inputMode, setInputMode] = useState('quantity'); // 'quantity' 或 'value'
    const [investmentValue, setInvestmentValue] = useState(0); // 投入金额
    const [testingEmail, setTestingEmail] = useState(false);
    const [testEmailResult, setTestEmailResult] = useState(null);
    const [testEmailAddress, setTestEmailAddress] = useState(''); // 测试邮箱地址

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
            // 初始化投入金额
            if (card.position?.amount && card.position?.entryPrice) {
                setInvestmentValue(card.position.amount * card.position.entryPrice);
            }
            setTestEmailResult(null);
            setTestEmailAddress(getDefaultAlertEmail() || ''); // 初始化默认邮箱
        }
    }, [card]);

    if (!isOpen || !editedCard) return null;

    const handleSave = () => {
        updateAssetCard(editedCard.id, editedCard);
        onUpdate?.();
        onClose();
    };

    // 添加关键词
    const handleAddKeyword = () => {
        if (keywordInput.trim()) {
            setEditedCard({
                ...editedCard,
                newsKeywords: [...(editedCard.newsKeywords || []), keywordInput.trim()]
            });
            setKeywordInput('');
        }
    };

    // 删除关键词
    const handleRemoveKeyword = (index) => {
        setEditedCard({
            ...editedCard,
            newsKeywords: editedCard.newsKeywords.filter((_, i) => i !== index)
        });
    };

    // ========== 提醒相关函数 ==========
    // 添加提醒条件
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
            value: defaultValues[typeId] || 0
        };

        setEditedCard({
            ...editedCard,
            alert: {
                ...editedCard.alert,
                conditions: [...(editedCard.alert.conditions || []), newCondition]
            }
        });
    };

    // 更新条件值
    const handleUpdateConditionValue = (index, value) => {
        const conditions = [...editedCard.alert.conditions];
        conditions[index] = { ...conditions[index], value: parseFloat(value) || 0 };
        setEditedCard({
            ...editedCard,
            alert: { ...editedCard.alert, conditions }
        });
    };

    // 删除条件
    const handleRemoveCondition = (index) => {
        setEditedCard({
            ...editedCard,
            alert: {
                ...editedCard.alert,
                conditions: editedCard.alert.conditions.filter((_, i) => i !== index)
            }
        });
    };

    // 测试邮件（使用当前编辑的资产）
    const handleTestEmail = async () => {
        setTestingEmail(true);
        setTestEmailResult(null);
        const result = await sendTestEmail(testEmailAddress, editedCard);
        setTestEmailResult(result);
        setTestingEmail(false);
    };

    // 处理投入金额变化（按金额模式）
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

    // 处理均价变化（在按金额模式下重新计算数量）
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

    // 计算实时盈亏预览
    const positionSummary = currentPrice && editedCard.position?.enabled
        ? getPositionSummary(editedCard, currentPrice)
        : null;

    return createPortal(
        <div
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                backdropFilter: 'blur(16px)',
                zIndex: 4000,
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                padding: '2rem'
            }}
            // 小弹窗不需要点击背景关闭，只有大页面才需要
        >
            <div
                style={{
                    width: '100%',
                    maxWidth: '700px',
                    maxHeight: '90vh',
                    background: 'linear-gradient(145deg, #13171f 0%, #0d1117 100%)',
                    borderRadius: '1.5rem',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 50px 100px -20px rgba(0, 0, 0, 0.8)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '1.5rem 2rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(255,255,255,0.02)'
                }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#fff', margin: 0 }}>
                        ✏️ 编辑资产
                    </h2>
                    <p style={{ color: '#8b949e', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                        {editedCard.name} · {editedCard.symbol}
                    </p>
                </div>

                {/* Content */}
                <div style={{ overflowY: 'auto', padding: '2rem', flex: 1 }}>

                    {/* Section 1: Basic Info */}
                    <Section title="📊 基本信息">
                        <FormField label="资产分类">
                            <select
                                value={editedCard.category || ''}
                                onChange={e => setEditedCard({ ...editedCard, category: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem 1rem',
                                    background: '#21262d',
                                    border: '1px solid #30363d',
                                    borderRadius: '0.5rem',
                                    color: '#e6edf3',
                                    fontSize: '0.95rem'
                                }}
                            >
                                <option value="">请选择分类</option>
                                {CATEGORY_OPTIONS.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </FormField>
                    </Section>

                    {/* Section 2: News Keywords */}
                    <Section title="🔍 新闻关键词">
                        <div style={{ marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                <input
                                    type="text"
                                    value={keywordInput}
                                    onChange={e => setKeywordInput(e.target.value)}
                                    onKeyPress={e => e.key === 'Enter' && handleAddKeyword()}
                                    placeholder="输入关键词，回车添加"
                                    style={{
                                        flex: 1,
                                        padding: '0.75rem 1rem',
                                        background: '#21262d',
                                        border: '1px solid #30363d',
                                        borderRadius: '0.5rem',
                                        color: '#e6edf3',
                                        fontSize: '0.95rem'
                                    }}
                                />
                                <button
                                    onClick={handleAddKeyword}
                                    style={{
                                        padding: '0.75rem 1.5rem',
                                        background: '#238636',
                                        border: 'none',
                                        borderRadius: '0.5rem',
                                        color: '#fff',
                                        fontWeight: 'bold',
                                        cursor: 'pointer'
                                    }}
                                >
                                    添加
                                </button>
                            </div>

                            {/* Keyword Tags */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: ' 0.5rem' }}>
                                {editedCard.newsKeywords?.map((keyword, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            padding: '0.5rem 1rem',
                                            background: 'rgba(96, 165, 250, 0.1)',
                                            border: '1px solid rgba(96, 165, 250, 0.3)',
                                            borderRadius: '1rem',
                                            color: '#60a5fa',
                                            fontSize: '0.85rem'
                                        }}
                                    >
                                        <span>{keyword}</span>
                                        <button
                                            onClick={() => handleRemoveKeyword(index)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: '#f85149',
                                                cursor: 'pointer',
                                                fontSize: '1rem',
                                                padding: 0,
                                                lineHeight: 1
                                            }}
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Section>

                    {/* Section 3: Portfolio - 状态卡片风格 */}
                    <Section title="💼 持仓管理">
                        <PositionStatusCard
                            position={editedCard.position}
                            positionSummary={positionSummary}
                            onToggle={(enabled) => setEditedCard({
                                ...editedCard,
                                position: { ...editedCard.position, enabled }
                            })}
                        >
                            {/* 交易方向 */}
                            <FormField label="交易方向">
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        {['long', 'short'].map(dir => (
                                            <label
                                                key={dir}
                                                style={{
                                                    flex: 1,
                                                    padding: '1rem',
                                                    background: editedCard.position.direction === dir ? '#238636' : '#21262d',
                                                    border: `2px solid ${editedCard.position.direction === dir ? '#2ea043' : '#30363d'}`,
                                                    borderRadius: '0.75rem',
                                                    textAlign: 'center',
                                                    cursor: 'pointer',
                                                    color: '#fff',
                                                    fontWeight: 'bold',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <input
                                                    type="radio"
                                                    name="direction"
                                                    checked={editedCard.position.direction === dir}
                                                    onChange={() => setEditedCard({
                                                        ...editedCard,
                                                        position: { ...editedCard.position, direction: dir }
                                                    })}
                                                    style={{ display: 'none' }}
                                                />
                                                {dir === 'long' ? '📈 做多 (Long)' : '📉 做空 (Short)'}
                                            </label>
                                        ))}
                                    </div>
                                </FormField>

                                {/* 输入模式切换 */}
                                <FormField label="输入方式">
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        {[
                                            { value: 'quantity', label: '📊 按数量', desc: '直接输入持有数量' },
                                            { value: 'value', label: '💰 按金额', desc: '输入投入总额自动计算' }
                                        ].map(mode => (
                                            <label
                                                key={mode.value}
                                                style={{
                                                    flex: 1,
                                                    padding: '0.75rem',
                                                    background: inputMode === mode.value ? 'rgba(96, 165, 250, 0.15)' : '#21262d',
                                                    border: `2px solid ${inputMode === mode.value ? '#60a5fa' : '#30363d'}`,
                                                    borderRadius: '0.75rem',
                                                    textAlign: 'center',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <input
                                                    type="radio"
                                                    name="inputMode"
                                                    checked={inputMode === mode.value}
                                                    onChange={() => setInputMode(mode.value)}
                                                    style={{ display: 'none' }}
                                                />
                                                <div style={{ color: '#e6edf3', fontWeight: '600', fontSize: '0.9rem' }}>
                                                    {mode.label}
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: '#8b949e', marginTop: '0.25rem' }}>
                                                    {mode.desc}
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </FormField>

                                {inputMode === 'quantity' ? (
                                    // 按数量模式
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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
                                                    // 同步更新投入金额
                                                    setInvestmentValue(amount * editedCard.position.entryPrice);
                                                }}
                                                placeholder="0"
                                                style={{
                                                    width: '100%',
                                                    padding: '0.75rem 1rem',
                                                    background: '#21262d',
                                                    border: '1px solid #30363d',
                                                    borderRadius: '0.5rem',
                                                    color: '#e6edf3',
                                                    fontSize: '0.95rem'
                                                }}
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
                                                    // 同步更新投入金额
                                                    setInvestmentValue(editedCard.position.amount * price);
                                                }}
                                                placeholder="0"
                                                style={{
                                                    width: '100%',
                                                    padding: '0.75rem 1rem',
                                                    background: '#21262d',
                                                    border: '1px solid #30363d',
                                                    borderRadius: '0.5rem',
                                                    color: '#e6edf3',
                                                    fontSize: '0.95rem'
                                                }}
                                            />
                                        </FormField>
                                    </div>
                                ) : (
                                    // 按金额模式
                                    <>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <FormField label={`投入金额 (${editedCard.position.currency})`}>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    value={investmentValue || ''}
                                                    onChange={e => handleInvestmentChange(parseFloat(e.target.value) || 0)}
                                                    placeholder="0"
                                                    style={{
                                                        width: '100%',
                                                        padding: '0.75rem 1rem',
                                                        background: '#21262d',
                                                        border: '1px solid #30363d',
                                                        borderRadius: '0.5rem',
                                                        color: '#e6edf3',
                                                        fontSize: '0.95rem'
                                                    }}
                                                />
                                            </FormField>

                                            <FormField label={`买入价格 (${editedCard.position.currency})`}>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    value={editedCard.position.entryPrice || ''}
                                                    onChange={e => handleEntryPriceChange(parseFloat(e.target.value) || 0)}
                                                    placeholder="0"
                                                    style={{
                                                        width: '100%',
                                                        padding: '0.75rem 1rem',
                                                        background: '#21262d',
                                                        border: '1px solid #30363d',
                                                        borderRadius: '0.5rem',
                                                        color: '#e6edf3',
                                                        fontSize: '0.95rem'
                                                    }}
                                                />
                                            </FormField>
                                        </div>

                                        {/* 自动计算的数量显示 */}
                                        <div style={{
                                            padding: '0.75rem 1rem',
                                            background: 'rgba(96, 165, 250, 0.08)',
                                            border: '1px solid rgba(96, 165, 250, 0.2)',
                                            borderRadius: '0.5rem',
                                            fontSize: '0.85rem',
                                            color: '#8b949e'
                                        }}>
                                            💡 自动计算持仓数量：<span style={{ color: '#60a5fa', fontWeight: 'bold', marginLeft: '0.5rem' }}>
                                                {editedCard.position.amount.toFixed(8)}
                                            </span>
                                        </div>
                                    </>
                                )}

                                {/* Live PnL Preview */}
                                {positionSummary && (
                                    <div style={{
                                        marginTop: '1rem',
                                        padding: '1rem',
                                        background: positionSummary.isProfit ? 'rgba(46, 160, 67, 0.1)' : 'rgba(248, 81, 73, 0.1)',
                                        border: `1px solid ${positionSummary.isProfit ? 'rgba(46, 160, 67, 0.3)' : 'rgba(248, 81, 73, 0.3)'}`,
                                        borderRadius: '0.75rem'
                                    }}>
                                        <div style={{ fontSize: '0.85rem', color: '#8b949e', marginBottom: '0.5rem' }}>
                                            💡 实时盈亏预览
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem' }}>
                                            <span style={{ color: '#e6edf3' }}>
                                                {positionSummary.direction === 'long' ? '做多' : '做空'} × {positionSummary.amount}
                                            </span>
                                            <span style={{
                                                color: positionSummary.isProfit ? '#3fb950' : '#f85149',
                                                fontWeight: 'bold'
                                            }}>
                                                {positionSummary.isProfit ? '+' : ''}{positionSummary.pnl.toFixed(2)} {positionSummary.currency} ({positionSummary.isProfit ? '+' : ''}{positionSummary.pnlPercent.toFixed(2)}%)
                                            </span>
                                        </div>
                                    </div>
                                )}
                        </PositionStatusCard>
                    </Section>

                    {/* Section 4: Price Alerts - 状态卡片风格 */}
                    <Section title="🔔 价格提醒">
                        <AlertStatusCard
                            alert={editedCard.alert}
                            conditions={editedCard.alert?.conditions || []}
                            onToggle={(enabled) => setEditedCard({
                                ...editedCard,
                                alert: { ...editedCard.alert, enabled }
                            })}
                        >
                            {/* 已设置的条件 - 使用 Tile 网格 */}
                            {editedCard.alert?.conditions?.length > 0 && (
                                <div style={{ marginBottom: '1.25rem' }}>
                                    <div style={{
                                        fontSize: '0.8rem',
                                        color: 'rgba(165, 180, 252, 0.7)',
                                        marginBottom: '0.75rem',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em'
                                    }}>
                                        监控条件
                                    </div>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                                        gap: '0.75rem'
                                    }}>
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
                                                    onUpdate={(value) => handleUpdateConditionValue(index, value)}
                                                    onRemove={() => handleRemoveCondition(index)}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* 添加新条件 */}
                            <div style={{ marginBottom: '1.25rem' }}>
                                <div style={{
                                    fontSize: '0.8rem',
                                    color: 'rgba(165, 180, 252, 0.7)',
                                    marginBottom: '0.75rem',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    添加条件
                                </div>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                                    gap: '0.5rem'
                                }}>
                                    {Object.values(ALERT_TYPES).map(alertType => (
                                        <button
                                            key={alertType.id}
                                            onClick={() => handleAddCondition(alertType.id)}
                                            title={alertType.description}
                                            style={{
                                                padding: '0.6rem 0.75rem',
                                                background: 'rgba(99, 102, 241, 0.1)',
                                                border: '1px dashed rgba(99, 102, 241, 0.3)',
                                                borderRadius: '0.5rem',
                                                color: '#a5b4fc',
                                                fontSize: '0.8rem',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)';
                                                e.currentTarget.style.borderStyle = 'solid';
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                                                e.currentTarget.style.borderStyle = 'dashed';
                                            }}
                                        >
                                            <span>{alertType.icon}</span>
                                            <span>{alertType.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 高级设置 */}
                            <div style={{
                                padding: '1rem',
                                background: 'rgba(15, 23, 42, 0.5)',
                                borderRadius: '0.5rem',
                                border: '1px solid rgba(99, 102, 241, 0.15)',
                                marginBottom: '1rem'
                            }}>
                                <div style={{
                                    fontSize: '0.8rem',
                                    color: 'rgba(165, 180, 252, 0.7)',
                                    marginBottom: '0.75rem',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    ⚙️ 高级设置
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#6e7681', marginBottom: '0.25rem' }}>
                                            冷却时间 (分钟)
                                        </label>
                                        <input
                                            type="number"
                                            value={editedCard.alert?.cooldownMinutes || 240}
                                            onChange={e => setEditedCard({
                                                ...editedCard,
                                                alert: { ...editedCard.alert, cooldownMinutes: parseInt(e.target.value) || 240 }
                                            })}
                                            style={{
                                                width: '100%',
                                                padding: '0.5rem',
                                                background: 'rgba(15, 23, 42, 0.6)',
                                                border: '1px solid rgba(99, 102, 241, 0.2)',
                                                borderRadius: '0.25rem',
                                                color: '#e6edf3',
                                                fontSize: '0.85rem'
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#6e7681', marginBottom: '0.25rem' }}>
                                            每日上限 (封)
                                        </label>
                                        <input
                                            type="number"
                                            value={editedCard.alert?.dailyLimit || 5}
                                            onChange={e => setEditedCard({
                                                ...editedCard,
                                                alert: { ...editedCard.alert, dailyLimit: parseInt(e.target.value) || 5 }
                                            })}
                                            style={{
                                                width: '100%',
                                                padding: '0.5rem',
                                                background: 'rgba(15, 23, 42, 0.6)',
                                                border: '1px solid rgba(99, 102, 241, 0.2)',
                                                borderRadius: '0.25rem',
                                                color: '#e6edf3',
                                                fontSize: '0.85rem'
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 测试邮件 */}
                            <div style={{ marginTop: '0.5rem' }}>
                                <div style={{
                                    fontSize: '0.8rem',
                                    color: 'rgba(165, 180, 252, 0.7)',
                                    marginBottom: '0.5rem',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    📧 测试邮件
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <input
                                        type="text"
                                        value={testEmailAddress}
                                        onChange={e => setTestEmailAddress(e.target.value)}
                                        placeholder="多个邮箱用逗号分隔，如: a@qq.com, b@163.com"
                                        style={{
                                            flex: 1,
                                            padding: '0.5rem 0.75rem',
                                            background: 'rgba(15, 23, 42, 0.6)',
                                            border: '1px solid rgba(99, 102, 241, 0.2)',
                                            borderRadius: '0.25rem',
                                            color: '#e6edf3',
                                            fontSize: '0.85rem'
                                        }}
                                    />
                                    <button
                                        onClick={handleTestEmail}
                                        disabled={testingEmail || !testEmailAddress}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            background: testEmailResult?.success ? 'rgba(34, 197, 94, 0.2)' :
                                                       testEmailResult?.error ? 'rgba(248, 81, 73, 0.2)' :
                                                       'rgba(99, 102, 241, 0.15)',
                                            border: `1px solid ${testEmailResult?.success ? 'rgba(34, 197, 94, 0.4)' :
                                                                testEmailResult?.error ? 'rgba(248, 81, 73, 0.4)' :
                                                                'rgba(99, 102, 241, 0.3)'}`,
                                            borderRadius: '0.5rem',
                                            color: testEmailResult?.success ? '#22c55e' :
                                                   testEmailResult?.error ? '#f85149' : '#a5b4fc',
                                            fontSize: '0.85rem',
                                            cursor: (testingEmail || !testEmailAddress) ? 'not-allowed' : 'pointer',
                                            opacity: !testEmailAddress ? 0.5 : 1,
                                            whiteSpace: 'nowrap',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {testingEmail ? '⏳ 发送中...' :
                                         testEmailResult?.success ? `✅ ${testEmailResult.count}/${testEmailResult.total}` :
                                         testEmailResult?.error ? '❌ 失败' :
                                         '发送'}
                                    </button>
                                </div>
                                {testEmailResult?.success && (
                                    <div style={{
                                        marginTop: '0.5rem',
                                        padding: '0.5rem',
                                        background: 'rgba(34, 197, 94, 0.1)',
                                        borderRadius: '0.25rem',
                                        fontSize: '0.75rem',
                                        color: '#22c55e'
                                    }}>
                                        ✅ 成功发送 {testEmailResult.count}/{testEmailResult.total} 封到: {testEmailResult.to}
                                    </div>
                                )}
                                {testEmailResult?.error && (
                                    <div style={{
                                        marginTop: '0.5rem',
                                        padding: '0.5rem',
                                        background: 'rgba(248, 81, 73, 0.1)',
                                        borderRadius: '0.25rem',
                                        fontSize: '0.75rem',
                                        color: '#f85149'
                                    }}>
                                        {testEmailResult.error}
                                    </div>
                                )}
                            </div>
                        </AlertStatusCard>
                    </Section>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '1.5rem 2rem',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    gap: '1rem',
                    justifyContent: 'flex-end'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '0.75rem 1.5rem',
                            background: '#21262d',
                            border: '1px solid #30363d',
                            borderRadius: '0.75rem',
                            color: '#e6edf3',
                            fontSize: '0.95rem',
                            cursor: 'pointer'
                        }}
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSave}
                        style={{
                            padding: '0.75rem 2rem',
                            background: 'linear-gradient(135deg, #f0b90b 0%, #e85d04 100%)',
                            border: 'none',
                            borderRadius: '0.75rem',
                            color: '#000',
                            fontWeight: 'bold',
                            fontSize: '0.95rem',
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(240, 185, 11, 0.3)'
                        }}
                    >
                        💾 保存
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

// Section Component
const Section = ({ title, children }) => (
    <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#e6edf3', marginBottom: '1rem' }}>
            {title}
        </h3>
        {children}
    </div>
);

// Form Field Component
const FormField = ({ label, children }) => (
    <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontSize: '0.9rem', color: '#8b949e', marginBottom: '0.5rem', fontWeight: '500' }}>
            {label}
        </label>
        {children}
    </div>
);

export default AssetEditorModal;
