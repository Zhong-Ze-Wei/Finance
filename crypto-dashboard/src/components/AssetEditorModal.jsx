// AssetEditorModal.jsx - 资产详情编辑器
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { updateAssetCard, getPositionSummary } from '../services/assetCards';

const CATEGORY_OPTIONS = [
    '美股', 'A股', '港股', '加密货币', 'ETF', '外汇', '大宗商品', '指数', '其他'
];

const AssetEditorModal = ({ isOpen, onClose, card, currentPrice, onUpdate }) => {
    const [editedCard, setEditedCard] = useState(null);
    const [keywordInput, setKeywordInput] = useState('');
    const [inputMode, setInputMode] = useState('quantity'); // 'quantity' 或 'value'
    const [investmentValue, setInvestmentValue] = useState(0); // 投入金额

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
                }
            });
            // 初始化投入金额
            if (card.position?.amount && card.position?.entryPrice) {
                setInvestmentValue(card.position.amount * card.position.entryPrice);
            }
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
            onClick={onClose}
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
                onClick={e => e.stopPropagation()}
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

                    {/* Section 3: Portfolio */}
                    <Section title="💼 持仓管理">
                        <FormField label="启用持仓追踪">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={editedCard.position?.enabled || false}
                                    onChange={e => setEditedCard({
                                        ...editedCard,
                                        position: { ...editedCard.position, enabled: e.target.checked }
                                    })}
                                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                />
                                <span style={{ color: '#e6edf3', fontSize: '0.95rem' }}>
                                    {editedCard.position?.enabled ? '✅ 已启用' : '⬜ 未启用'}
                                </span>
                            </label>
                        </FormField>

                        {editedCard.position?.enabled && (
                            <>
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
                            </>
                        )}
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
