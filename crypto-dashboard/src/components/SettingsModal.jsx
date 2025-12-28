// SettingsModal.jsx - OpenAI 兼容 API 配置
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getLLMConfig, setLLMConfig } from '../services/api';

const SettingsModal = ({ isOpen, onClose }) => {
    const [baseUrl, setBaseUrl] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [saved, setSaved] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);

    useEffect(() => {
        if (isOpen) {
            const config = getLLMConfig();
            setBaseUrl(config.baseUrl || '/api/openai');
            setApiKey(config.apiKey || '');
            setModel(config.model || 'gpt-4o-mini');
            setSaved(false);
            setTestResult(null);
        }
    }, [isOpen]);

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const response = await fetch('/api/llm-proxy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'X-Target-URL': baseUrl
                },
                body: JSON.stringify({
                    model: model,
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
        setLLMConfig({ baseUrl, apiKey, model });
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
        }} onClick={onClose}>
            <div style={{
                width: '100%',
                maxWidth: '480px',
                backgroundColor: '#0d1117',
                borderRadius: '1rem',
                border: '1px solid #30363d',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                overflow: 'hidden'
            }} onClick={e => e.stopPropagation()}>

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
                            ⚙️ AI 服务配置
                        </h2>
                        <p style={{ fontSize: '0.75rem', color: '#6e7681', margin: 0 }}>
                            支持所有 OpenAI 兼容 API
                        </p>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'transparent', border: 'none',
                        color: '#8b949e', fontSize: '1.5rem', cursor: 'pointer'
                    }}>×</button>
                </div>

                {/* 表单 */}
                <div style={{ padding: '1.5rem' }}>
                    {/* Base URL */}
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ color: '#9ca3af', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>
                            API Base URL
                        </label>
                        <input
                            type="text"
                            value={baseUrl}
                            onChange={e => { setBaseUrl(e.target.value); setTestResult(null); }}
                            placeholder="/api/openai"
                            style={{
                                width: '100%',
                                padding: '0.75rem 1rem',
                                background: '#21262d',
                                border: '1px solid #30363d',
                                borderRadius: '0.5rem',
                                color: '#fff',
                                fontSize: '0.9rem',
                                outline: 'none',
                                boxSizing: 'border-box'
                            }}
                        />
                        <span style={{ color: '#6e7681', fontSize: '0.7rem', marginTop: '0.25rem', display: 'block' }}>
                            本地代理: /api/openai | 直连: https://api.openai.com/v1
                        </span>
                    </div>

                    {/* API Key */}
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ color: '#9ca3af', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>
                            API Key
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showKey ? 'text' : 'password'}
                                value={apiKey}
                                onChange={e => { setApiKey(e.target.value); setTestResult(null); }}
                                placeholder="sk-xxxxxxxxxxxxxxxx"
                                style={{
                                    width: '100%',
                                    padding: '0.75rem 3rem 0.75rem 1rem',
                                    background: '#21262d',
                                    border: '1px solid #30363d',
                                    borderRadius: '0.5rem',
                                    color: '#fff',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey(!showKey)}
                                style={{
                                    position: 'absolute',
                                    right: '0.75rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#6e7681',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem',
                                    padding: '0.25rem'
                                }}
                            >
                                {showKey ? '🙈' : '👁️'}
                            </button>
                        </div>
                    </div>

                    {/* Model */}
                    <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ color: '#9ca3af', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>
                            模型名称
                        </label>
                        <input
                            type="text"
                            value={model}
                            onChange={e => { setModel(e.target.value); setTestResult(null); }}
                            placeholder="gpt-4o-mini"
                            style={{
                                width: '100%',
                                padding: '0.75rem 1rem',
                                background: '#21262d',
                                border: '1px solid #30363d',
                                borderRadius: '0.5rem',
                                color: '#fff',
                                fontSize: '0.9rem',
                                outline: 'none',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

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
                            {testResult === 'success' ? '✅ 连接成功' : '❌ 连接失败，请检查配置'}
                        </div>
                    )}

                    {/* 按钮 */}
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            onClick={handleTest}
                            disabled={testing || !apiKey}
                            style={{
                                flex: 1,
                                padding: '0.75rem',
                                background: '#21262d',
                                border: '1px solid #30363d',
                                borderRadius: '0.5rem',
                                color: testing ? '#6e7681' : '#fff',
                                fontWeight: '500',
                                cursor: testing || !apiKey ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {testing ? '⏳ 测试中...' : '🔗 测试连接'}
                        </button>
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
                            {saved ? '✓ 已保存' : '💾 保存'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default SettingsModal;
