// SettingsModal.jsx - API 配置（高级设置）
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Settings, CheckCircle, XCircle, Loader2, Link2, Mail, Save } from 'lucide-react';
import { getLLMConfig, setLLMConfig, LLM_PRESETS } from '../services/api';
import { sendTestEmail } from '../services/alertService';
import './SettingsModal.css';

const SettingsModal = ({ isOpen, onClose }) => {
    const [preset, setPreset] = useState('deepseek');
    const [showDetails, setShowDetails] = useState(false);
    const [saved, setSaved] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [emailTesting, setEmailTesting] = useState(false);
    const [emailResult, setEmailResult] = useState(null);

    const config = LLM_PRESETS[preset] || {};

    useEffect(() => {
        if (isOpen) {
            const savedConfig = getLLMConfig();
            setPreset(savedConfig.preset || 'deepseek');
            setSaved(false);
            setTestResult(null);
            setEmailResult(null);
        }
    }, [isOpen]);

    const handleTestEmail = async () => {
        setEmailTesting(true);
        setEmailResult(null);
        const result = await sendTestEmail();
        setEmailResult(result);
        setEmailTesting(false);
    };

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const response = await fetch('/api/llm/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: config.model,
                    messages: [{ role: 'user', content: 'Hi' }],
                    max_tokens: 5
                })
            });
            if (response.ok) {
                setTestResult('success');
            } else {
                const errText = await response.text().catch(() => '');
                console.error('❌ LLM 测试失败:', response.status, errText);
                setTestResult('error');
            }
        } catch (e) {
            console.error('❌ LLM 测试连接失败:', e.message);
            setTestResult('error');
        }
        setTesting(false);
    };

    const handleSave = () => {
        setLLMConfig({
            preset,
            model: config.model
        });
        setSaved(true);
        setTimeout(() => onClose(), 800);
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="sm-overlay">
            <div className="sm-modal">

                {/* 头部 */}
                <div className="sm-header">
                    <div>
                        <h2 className="sm-header__title">
                            <Settings size={18} /> AI 模型设置
                        </h2>
                        <p className="sm-header__subtitle">
                            当前: {config.name || '未选择'}
                        </p>
                    </div>
                    <button onClick={onClose} className="sm-header__close">×</button>
                </div>

                {/* 内容 */}
                <div className="sm-content">
                    {/* 模型选择 */}
                    <div className="sm-field-group">
                        <label className="sm-label">
                            选择 AI 模型
                        </label>
                        <div className="sm-preset-list">
                            {Object.entries(LLM_PRESETS).map(([key, value]) => (
                                <button
                                    key={key}
                                    onClick={() => { setPreset(key); setTestResult(null); }}
                                    className={`sm-preset-btn${preset === key ? ' sm-preset-btn--active' : ''}`}
                                >
                                    <span>{value.name}</span>
                                    <span className="sm-preset-btn__model">{value.model}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 详情展开 */}
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="sm-details-toggle"
                    >
                        {showDetails ? '▼' : '▶'} 查看配置详情
                    </button>

                    {showDetails && (
                        <div className="sm-details-panel">
                            <div><strong>模型:</strong> {config.model}</div>
                            <div><strong>代理:</strong> /api/llm/chat/completions (后端)</div>
                        </div>
                    )}

                    {/* 测试结果 */}
                    {testResult && (
                        <div className={`sm-result sm-result--${testResult}`}>
                            {testResult === 'success' ? <><CheckCircle size={14} /> AI 连接成功</> : <><XCircle size={14} /> AI 连接失败</>}
                        </div>
                    )}

                    {/* 邮件测试结果 */}
                    {emailResult && (
                        <div className={`sm-result sm-result--${emailResult.success ? 'success' : 'error'}`}>
                            {emailResult.success ? (
                                <><CheckCircle size={14} /> 测试邮件已发送到 <strong>{emailResult.to}</strong></>
                            ) : (
                                <><XCircle size={14} /> 发送失败: {emailResult.error || '未知错误'}<br/>
                                <span className="sm-result__detail">
                                    发件人: {emailResult.from}<br/>收件人: {emailResult.to}
                                </span></>
                            )}
                        </div>
                    )}

                    {/* 按钮 */}
                    <div className="sm-btn-row">
                        <button
                            onClick={handleTest}
                            disabled={testing}
                            className="sm-action-btn"
                        >
                            {testing ? <><Loader2 size={14} className="spin" /> 测试中...</> : <><Link2 size={14} /> 测试 AI</>}
                        </button>
                        <button
                            onClick={handleTestEmail}
                            disabled={emailTesting}
                            className="sm-action-btn"
                        >
                            {emailTesting ? <><Loader2 size={14} className="spin" /> 发送中...</> : <><Mail size={14} /> 测试邮件</>}
                        </button>
                    </div>
                    <div className="sm-btn-row">
                        <button
                            onClick={handleSave}
                            className={`sm-save-btn${saved ? ' sm-save-btn--saved' : ''}`}
                        >
                            {saved ? <><CheckCircle size={14} /> 已保存</> : <><Save size={14} /> 保存设置</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default SettingsModal;
