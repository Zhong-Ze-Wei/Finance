// AddAssetModal.jsx - AI 智能识别添加标的弹窗
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { addAssetCard } from '../services/assetCards';
import { LLM_CONFIG } from '../services/api';
import { PROMPTS } from '../services/prompts';
import { Plus, X, Loader2, Bot, RefreshCw, Save, CheckCircle, XCircle } from 'lucide-react';
import './AddAssetModal.css';

// AI 识别标的函数
const identifyAsset = async (query) => {
    const prompt = PROMPTS.assetIdentify.replace('{{QUERY}}', query);

    try {
        const response = await fetch('/api/llm/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: LLM_CONFIG.model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error(`LLM 代理返回 ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        // 优先找 ```json 代码块，再 fallback 到裸 JSON
        const codeBlockMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (codeBlockMatch) {
            return JSON.parse(codeBlockMatch[1]);
        }

        // 找最外层平衡的花括号对（非贪婪，避免匹配多余内容）
        let depth = 0, start = -1;
        for (let i = 0; i < content.length; i++) {
            if (content[i] === '{') {
                if (depth === 0) start = i;
                depth++;
            } else if (content[i] === '}') {
                depth--;
                if (depth === 0 && start >= 0) {
                    return JSON.parse(content.slice(start, i + 1));
                }
            }
        }
        throw new Error('AI 未返回有效 JSON');
    } catch (e) {
        console.error('❌ AI 识别失败:', e.message);
        throw e;
    }
};

const AddAssetModal = ({ isOpen, onClose, onAdd }) => {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const handleIdentify = async () => {
        if (!query.trim()) return;

        setLoading(true);
        setError('');
        setResult(null);

        try {
            const identified = await identifyAsset(query.trim());
            setResult(identified);
        } catch (e) {
            setError('识别失败，请检查 API 配置或重试');
        }
        setLoading(false);
    };

    const handleSave = () => {
        if (!result) return;

        const newCard = addAssetCard(result);
        onAdd?.(newCard);
        handleClose();
    };

    const handleClose = () => {
        setQuery('');
        setResult(null);
        setError('');
        setLoading(false);
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="aam-overlay">
            <div className="aam-modal">

                {/* 头部 */}
                <div className="aam-header">
                    <h2 className="aam-header__title">
                        <Plus size={18} /> 添加新标的
                    </h2>
                    <button onClick={handleClose} className="aam-header__close">
                        <X size={20} />
                    </button>
                </div>

                {/* 内容 */}
                <div className="aam-content">

                    {/* 输入框 */}
                    <div className="aam-input-group">
                        <label className="aam-input-group__label">
                            请输入标的名称
                        </label>
                        <div className="aam-input-row">
                            <input
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleIdentify()}
                                placeholder="如：苹果公司、贵州茅台、比特币..."
                                className="input"
                            />
                            <button
                                onClick={handleIdentify}
                                disabled={loading || !query.trim()}
                                className="aam-identify-btn"
                            >
                                {loading ? <Loader2 size={16} className="spin" /> : <><Bot size={16} /> 识别</>}
                            </button>
                        </div>
                    </div>

                    {/* 错误提示 */}
                    {error && (
                        <div className="aam-error">
                            <XCircle size={14} /> {error}
                        </div>
                    )}

                    {/* 识别结果 */}
                    {result && (
                        <div className="aam-result">
                            <div className="aam-result__success-label">
                                <CheckCircle size={14} /> 识别成功
                            </div>

                            <div className="aam-result__grid">
                                <div className="aam-result__row">
                                    <span className="aam-result__label">名称:</span>
                                    <span className="aam-result__value">{result.name}</span>
                                </div>
                                <div className="aam-result__row">
                                    <span className="aam-result__label">Symbol:</span>
                                    <span className="aam-result__value--symbol">{result.symbol}</span>
                                </div>
                                <div className="aam-result__row">
                                    <span className="aam-result__label">类型:</span>
                                    <span className="aam-result__value">{result.type}</span>
                                </div>
                                <div className="aam-result__row">
                                    <span className="aam-result__label">数据源:</span>
                                    <span className="aam-result__value">{result.priceSource}</span>
                                </div>
                            </div>

                            <div className="aam-keywords">
                                <span className="aam-keywords__label">新闻关键词: </span>
                                <div className="aam-keywords__list">
                                    {result.newsKeywords?.map((kw, i) => (
                                        <span key={i} className="tag">{kw}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 操作按钮 */}
                    {result && (
                        <div className="aam-actions">
                            <button
                                onClick={() => { setResult(null); setQuery(''); }}
                                className="btn-ghost aam-actions__btn aam-actions__btn--ghost"
                            >
                                <RefreshCw size={14} /> 重新识别
                            </button>
                            <button
                                onClick={handleSave}
                                className="btn btn-success aam-actions__btn"
                            >
                                <Save size={14} /> 保存卡片
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AddAssetModal;
