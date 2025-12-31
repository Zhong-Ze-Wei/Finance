// SettingsModal.jsx - API 配置（高级设置）
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getLLMConfig, setLLMConfig, LLM_PRESETS } from '../services/api';
import { sendTestEmail } from '../services/alertService';

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
            const response = await fetch(`${config.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                body: JSON.stringify({
                    model: config.model,
                    messages: [{ role: 'user', content: 'Hi' }],
                    max_tokens: 5
                })
            });
            setTestResult(response.ok ? 'success' : 'error');
        } catch (e) {
            setTestResult('error');
        }
        setTesting(false);
    };

    const handleSave = () => {
        setLLMConfig({
            preset,
            baseUrl: config.baseUrl,
            apiKey: config.apiKey,
            model: config.model
        });
        setSaved(true);
        setTimeout(() => onClose(), 800);
    };

    if (!isOpen) return null;

    return createPortal(
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(10px)',
            zIndex: 4000,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            padding: '1rem'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '420px',
                backgroundColor: '#0d1117',
                borderRadius: '1rem',
                border: '1px solid #30363d',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                overflow: 'hidden'
            }}>

                {/* 头部 */}
                <div style={{
                    padding: '1.25rem 1.5rem',
                    borderBottom: '1px solid #30363d',
                    background: '#161b22',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>
                            ⚙️ AI 模型设置
                        </h2>
                        <p style={{ fontSize: '0.75rem', color: '#6e7681', margin: 0 }}>
                            当前: {config.name || '未选择'}
                        </p>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'transparent', border: 'none',
                        color: '#8b949e', fontSize: '1.5rem', cursor: 'pointer'
                    }}>×</button>
                </div>

                {/* 内容 */}
                <div style={{ padding: '1.5rem' }}>
                    {/* 模型选择 */}
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ color: '#9ca3af', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>
                            选择 AI 模型
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {Object.entries(LLM_PRESETS).map(([key, value]) => (
                                <button
                                    key={key}
                                    onClick={() => { setPreset(key); setTestResult(null); }}
                                    style={{
                                        padding: '0.75rem 1rem',
                                        background: preset === key
                                            ? 'linear-gradient(135deg, #f0b90b 0%, #e85d04 100%)'
                                            : '#21262d',
                                        border: preset === key ? 'none' : '1px solid #30363d',
                                        borderRadius: '0.5rem',
                                        color: preset === key ? '#000' : '#fff',
                                        fontWeight: preset === key ? 'bold' : 'normal',
                                        fontSize: '0.9rem',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}
                                >
                                    <span>{value.name}</span>
                                    <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{value.model}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 详情展开 */}
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#6e7681',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            marginBottom: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                        }}
                    >
                        {showDetails ? '▼' : '▶'} 查看配置详情
                    </button>

                    {showDetails && (
                        <div style={{
                            padding: '0.75rem',
                            background: '#161b22',
                            borderRadius: '0.5rem',
                            marginBottom: '1rem',
                            fontSize: '0.8rem',
                            color: '#8b949e'
                        }}>
                            <div><strong>Base URL:</strong> {config.baseUrl}</div>
                            <div><strong>Model:</strong> {config.model}</div>
                            <div><strong>API Key:</strong> {config.apiKey?.slice(0, 8)}...{config.apiKey?.slice(-4)}</div>
                        </div>
                    )}

                    {/* 测试结果 */}
                    {testResult && (
                        <div style={{
                            padding: '0.75rem 1rem',
                            marginBottom: '1rem',
                            borderRadius: '0.5rem',
                            background: testResult === 'success' ? '#238636' : '#da3633',
                            color: '#fff',
                            fontSize: '0.85rem'
                        }}>
                            {testResult === 'success' ? '✅ AI 连接成功' : '❌ AI 连接失败'}
                        </div>
                    )}

                    {/* 邮件测试结果 */}
                    {emailResult && (
                        <div style={{
                            padding: '0.75rem 1rem',
                            marginBottom: '1rem',
                            borderRadius: '0.5rem',
                            background: emailResult.success ? '#238636' : '#da3633',
                            color: '#fff',
                            fontSize: '0.85rem'
                        }}>
                            {emailResult.success ? (
                                <>✅ 测试邮件已发送到 <strong>{emailResult.to}</strong></>
                            ) : (
                                <>❌ 发送失败: {emailResult.error || '未知错误'}<br/>
                                <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                                    发件人: {emailResult.from}<br/>收件人: {emailResult.to}
                                </span></>
                            )}
                        </div>
                    )}

                    {/* 按钮 */}
                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <button
                            onClick={handleTest}
                            disabled={testing}
                            style={{
                                flex: 1,
                                padding: '0.75rem',
                                background: '#21262d',
                                border: '1px solid #30363d',
                                borderRadius: '0.5rem',
                                color: testing ? '#6e7681' : '#fff',
                                fontWeight: '500',
                                cursor: testing ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {testing ? '⏳ 测试中...' : '🔗 测试 AI'}
                        </button>
                        <button
                            onClick={handleTestEmail}
                            disabled={emailTesting}
                            style={{
                                flex: 1,
                                padding: '0.75rem',
                                background: '#21262d',
                                border: '1px solid #30363d',
                                borderRadius: '0.5rem',
                                color: emailTesting ? '#6e7681' : '#fff',
                                fontWeight: '500',
                                cursor: emailTesting ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {emailTesting ? '⏳ 发送中...' : '📧 测试邮件'}
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            onClick={handleSave}
                            style={{
                                flex: 1,
                                padding: '0.75rem',
                                background: saved ? '#10b981' : 'linear-gradient(135deg, #f0b90b 0%, #e85d04 100%)',
                                border: 'none',
                                borderRadius: '0.5rem',
                                color: saved ? '#fff' : '#000',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            {saved ? '✓ 已保存' : '💾 保存设置'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default SettingsModal;
