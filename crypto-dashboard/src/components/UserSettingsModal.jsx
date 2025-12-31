// UserSettingsModal.jsx - 用户全局设置弹窗
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    getUserSettings,
    saveUserSettings,
    isValidEmail,
    resetUserSettings,
    SYSTEM_CONFIG
} from '../services/userSettings';
import { sendTestEmail } from '../services/alertService';

const UserSettingsModal = ({ isOpen, onClose }) => {
    const [settings, setSettings] = useState(null);
    const [activeTab, setActiveTab] = useState('profile');
    const [saved, setSaved] = useState(false);
    const [testingEmail, setTestingEmail] = useState(false);
    const [testResult, setTestResult] = useState(null);

    useEffect(() => {
        if (isOpen) {
            setSettings(getUserSettings());
            setSaved(false);
            setTestResult(null);
            setActiveTab('profile');
        }
    }, [isOpen]);

    if (!isOpen || !settings) return null;

    const handleSave = () => {
        saveUserSettings(settings);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleReset = () => {
        if (window.confirm('确定要重置所有设置为默认值吗？')) {
            const defaults = resetUserSettings();
            setSettings(defaults);
        }
    };

    // 邮箱管理
    const handleEmailChange = (index, value) => {
        const emails = [...(settings.emails || ['', '', ''])];
        emails[index] = value;
        setSettings({ ...settings, emails: emails.filter((e, i) => e || i < 3) });
    };

    const handleTestEmails = async () => {
        const validEmails = (settings.emails || []).filter(e => e && isValidEmail(e));
        if (validEmails.length === 0) {
            setTestResult({ error: '请先填写有效的邮箱地址' });
            return;
        }

        setTestingEmail(true);
        setTestResult(null);
        const result = await sendTestEmail(validEmails.join(','));
        setTestResult(result);
        setTestingEmail(false);
    };

    const tabs = [
        { id: 'profile', label: '👤 个人', icon: '👤' },
        { id: 'notifications', label: '📧 通知', icon: '📧' },
        { id: 'system', label: '🔧 系统', icon: '🔧' },
    ];

    return createPortal(
        <div
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(20px)',
                zIndex: 5000,
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                padding: '2rem'
            }}
        >
            <div
                style={{
                    width: '600px',
                    height: '80vh',
                    background: 'linear-gradient(145deg, #0d1117 0%, #161b22 100%)',
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
                    background: 'rgba(255,255,255,0.02)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#fff', margin: 0 }}>
                            ⚙️ 用户设置
                        </h2>
                        <p style={{ color: '#8b949e', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                            自定义你的看板体验
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: '36px', height: '36px',
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.1)',
                            border: 'none',
                            color: '#fff',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1rem'
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Tabs */}
                <div style={{
                    display: 'flex',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                    background: 'rgba(0,0,0,0.2)',
                    padding: '0 1rem'
                }}>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                padding: '1rem 1.25rem',
                                background: 'transparent',
                                border: 'none',
                                borderBottom: activeTab === tab.id ? '2px solid #f0b90b' : '2px solid transparent',
                                color: activeTab === tab.id ? '#f0b90b' : '#8b949e',
                                fontSize: '0.9rem',
                                fontWeight: activeTab === tab.id ? '600' : '500',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }}>

                    {/* Profile Tab */}
                    {activeTab === 'profile' && (
                        <div>
                            <SettingGroup title="基本信息">
                                <SettingRow label="昵称" description="显示在看板上的名称（可选）">
                                    <input
                                        type="text"
                                        value={settings.nickname || ''}
                                        onChange={e => setSettings({ ...settings, nickname: e.target.value })}
                                        placeholder="输入昵称..."
                                        maxLength={20}
                                        style={inputStyle}
                                    />
                                </SettingRow>
                            </SettingGroup>

                            <SettingGroup title="数据管理">
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <button
                                        onClick={handleReset}
                                        style={{
                                            padding: '0.75rem 1.5rem',
                                            background: 'rgba(248, 81, 73, 0.1)',
                                            border: '1px solid rgba(248, 81, 73, 0.3)',
                                            borderRadius: '0.5rem',
                                            color: '#f85149',
                                            fontSize: '0.85rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        🔄 重置所有设置
                                    </button>
                                </div>
                            </SettingGroup>
                        </div>
                    )}

                    {/* Notifications Tab */}
                    {activeTab === 'notifications' && (
                        <div>
                            <SettingGroup title="提醒邮箱" description="价格提醒将发送到以下邮箱（最多3个）">
                                {[0, 1, 2].map(index => (
                                    <div key={index} style={{ marginBottom: '0.75rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ color: '#6e7681', fontSize: '0.85rem', width: '60px' }}>
                                                邮箱 {index + 1}
                                            </span>
                                            <input
                                                type="email"
                                                value={(settings.emails || [])[index] || ''}
                                                onChange={e => handleEmailChange(index, e.target.value)}
                                                placeholder={index === 0 ? '主邮箱（必填）' : '备用邮箱（可选）'}
                                                style={{
                                                    ...inputStyle,
                                                    flex: 1,
                                                    borderColor: (settings.emails || [])[index] && !isValidEmail((settings.emails || [])[index])
                                                        ? 'rgba(248, 81, 73, 0.5)'
                                                        : 'rgba(48, 54, 61, 0.8)'
                                                }}
                                            />
                                            {(settings.emails || [])[index] && isValidEmail((settings.emails || [])[index]) && (
                                                <span style={{ color: '#3fb950', fontSize: '1rem' }}>✓</span>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                <div style={{ marginTop: '1rem' }}>
                                    <button
                                        onClick={handleTestEmails}
                                        disabled={testingEmail || !(settings.emails || []).some(e => e && isValidEmail(e))}
                                        style={{
                                            padding: '0.75rem 1.5rem',
                                            background: testResult?.success ? 'rgba(34, 197, 94, 0.15)' :
                                                       testResult?.error ? 'rgba(248, 81, 73, 0.15)' :
                                                       'rgba(96, 165, 250, 0.15)',
                                            border: `1px solid ${testResult?.success ? 'rgba(34, 197, 94, 0.4)' :
                                                                 testResult?.error ? 'rgba(248, 81, 73, 0.4)' :
                                                                 'rgba(96, 165, 250, 0.3)'}`,
                                            borderRadius: '0.5rem',
                                            color: testResult?.success ? '#22c55e' :
                                                   testResult?.error ? '#f85149' : '#60a5fa',
                                            fontSize: '0.85rem',
                                            cursor: testingEmail ? 'not-allowed' : 'pointer',
                                            opacity: !(settings.emails || []).some(e => e && isValidEmail(e)) ? 0.5 : 1
                                        }}
                                    >
                                        {testingEmail ? '⏳ 发送中...' :
                                         testResult?.success ? `✅ 成功 ${testResult.count}/${testResult.total}` :
                                         testResult?.error ? '❌ 失败' :
                                         '📧 发送测试邮件'}
                                    </button>
                                    {testResult?.success && (
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#22c55e' }}>
                                            已发送到: {testResult.to}
                                        </div>
                                    )}
                                    {testResult?.error && (
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#f85149' }}>
                                            {testResult.error}
                                        </div>
                                    )}
                                </div>
                            </SettingGroup>

                            <SettingGroup title="提醒默认值">
                                <SettingRow label="检查间隔" description="价格提醒条件检查频率">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        {[30, 60, 120, 300].map(sec => (
                                            <button
                                                key={sec}
                                                onClick={() => setSettings({
                                                    ...settings,
                                                    polling: { ...settings.polling, alertCheckInterval: sec }
                                                })}
                                                style={{
                                                    padding: '0.5rem 0.75rem',
                                                    borderRadius: '0.5rem',
                                                    border: '1px solid',
                                                    borderColor: settings.polling?.alertCheckInterval === sec ? '#f0b90b' : 'rgba(48, 54, 61, 0.8)',
                                                    background: settings.polling?.alertCheckInterval === sec ? 'rgba(240, 185, 11, 0.15)' : '#21262d',
                                                    color: settings.polling?.alertCheckInterval === sec ? '#f0b90b' : '#e6edf3',
                                                    fontSize: '0.85rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {sec < 60 ? `${sec}秒` : `${sec / 60}分钟`}
                                            </button>
                                        ))}
                                    </div>
                                </SettingRow>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <SettingRow label="默认冷却时间" inline>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <input
                                                type="number"
                                                value={settings.alerts?.defaultCooldown || 240}
                                                onChange={e => setSettings({
                                                    ...settings,
                                                    alerts: { ...settings.alerts, defaultCooldown: parseInt(e.target.value) || 240 }
                                                })}
                                                min={1}
                                                max={1440}
                                                style={{ ...inputStyle, width: '80px' }}
                                            />
                                            <span style={{ color: '#6e7681', fontSize: '0.85rem' }}>分钟</span>
                                        </div>
                                    </SettingRow>
                                    <SettingRow label="默认每日上限" inline>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <input
                                                type="number"
                                                value={settings.alerts?.defaultDailyLimit || 5}
                                                onChange={e => setSettings({
                                                    ...settings,
                                                    alerts: { ...settings.alerts, defaultDailyLimit: parseInt(e.target.value) || 5 }
                                                })}
                                                min={1}
                                                max={50}
                                                style={{ ...inputStyle, width: '80px' }}
                                            />
                                            <span style={{ color: '#6e7681', fontSize: '0.85rem' }}>封/天</span>
                                        </div>
                                    </SettingRow>
                                </div>
                            </SettingGroup>
                        </div>
                    )}


                    {/* System Tab */}
                    {activeTab === 'system' && (
                        <div>
                            <SettingGroup title="系统信息">
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '1rem',
                                    padding: '1rem',
                                    background: 'rgba(255,255,255,0.02)',
                                    borderRadius: '0.5rem',
                                    border: '1px solid rgba(48, 54, 61, 0.5)'
                                }}>
                                    <div>
                                        <span style={{ color: '#6e7681', fontSize: '0.8rem' }}>版本号</span>
                                        <div style={{ color: '#e6edf3', fontWeight: '600', marginTop: '0.25rem' }}>
                                            v{SYSTEM_CONFIG.version}
                                        </div>
                                    </div>
                                    <div>
                                        <span style={{ color: '#6e7681', fontSize: '0.8rem' }}>构建日期</span>
                                        <div style={{ color: '#e6edf3', fontWeight: '600', marginTop: '0.25rem' }}>
                                            {SYSTEM_CONFIG.buildDate}
                                        </div>
                                    </div>
                                </div>
                            </SettingGroup>

                            <SettingGroup title="数据源接口（只读）" description="系统当前使用的 API 服务">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {Object.entries(SYSTEM_CONFIG.apis).map(([key, api]) => (
                                        <div
                                            key={key}
                                            style={{
                                                padding: '1rem',
                                                background: 'rgba(255,255,255,0.02)',
                                                borderRadius: '0.5rem',
                                                border: '1px solid rgba(48, 54, 61, 0.5)'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ color: '#e6edf3', fontWeight: '600', fontSize: '0.9rem' }}>
                                                        {api.name}
                                                    </div>
                                                    <div style={{ color: '#6e7681', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                                                        {api.description}
                                                    </div>
                                                </div>
                                                <div style={{
                                                    padding: '0.25rem 0.5rem',
                                                    background: api.status === 'active' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(248, 81, 73, 0.15)',
                                                    border: `1px solid ${api.status === 'active' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(248, 81, 73, 0.3)'}`,
                                                    borderRadius: '0.25rem',
                                                    color: api.status === 'active' ? '#22c55e' : '#f85149',
                                                    fontSize: '0.75rem',
                                                    fontWeight: '500'
                                                }}>
                                                    {api.status === 'active' ? '运行中' : '离线'}
                                                </div>
                                            </div>
                                            <div style={{
                                                marginTop: '0.5rem',
                                                padding: '0.5rem',
                                                background: 'rgba(0,0,0,0.2)',
                                                borderRadius: '0.25rem',
                                                fontFamily: 'monospace',
                                                fontSize: '0.75rem',
                                                color: '#8b949e',
                                                wordBreak: 'break-all'
                                            }}>
                                                {api.endpoint}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </SettingGroup>

                            <SettingGroup title="系统默认轮询配置（只读）">
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr 1fr',
                                    gap: '1rem',
                                    padding: '1rem',
                                    background: 'rgba(255,255,255,0.02)',
                                    borderRadius: '0.5rem',
                                    border: '1px solid rgba(48, 54, 61, 0.5)'
                                }}>
                                    <div>
                                        <span style={{ color: '#6e7681', fontSize: '0.8rem' }}>价格轮询</span>
                                        <div style={{ color: '#e6edf3', fontWeight: '600', marginTop: '0.25rem' }}>
                                            {SYSTEM_CONFIG.polling.price}秒
                                        </div>
                                    </div>
                                    <div>
                                        <span style={{ color: '#6e7681', fontSize: '0.8rem' }}>新闻轮询</span>
                                        <div style={{ color: '#e6edf3', fontWeight: '600', marginTop: '0.25rem' }}>
                                            {SYSTEM_CONFIG.polling.news / 60}分钟
                                        </div>
                                    </div>
                                    <div>
                                        <span style={{ color: '#6e7681', fontSize: '0.8rem' }}>提醒检查</span>
                                        <div style={{ color: '#e6edf3', fontWeight: '600', marginTop: '0.25rem' }}>
                                            {SYSTEM_CONFIG.polling.alerts}秒
                                        </div>
                                    </div>
                                </div>
                            </SettingGroup>

                            <div style={{
                                padding: '1rem',
                                background: 'rgba(96, 165, 250, 0.08)',
                                border: '1px solid rgba(96, 165, 250, 0.2)',
                                borderRadius: '0.5rem',
                                fontSize: '0.8rem',
                                color: '#60a5fa'
                            }}>
                                🔒 系统配置为只读，如需调整轮询频率请前往「轮询」标签页进行个性化设置。
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '1.25rem 2rem',
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
                            background: saved ? '#22c55e' : 'linear-gradient(135deg, #f0b90b 0%, #e85d04 100%)',
                            border: 'none',
                            borderRadius: '0.75rem',
                            color: saved ? '#fff' : '#000',
                            fontWeight: 'bold',
                            fontSize: '0.95rem',
                            cursor: 'pointer',
                            boxShadow: saved ? 'none' : '0 4px 12px rgba(240, 185, 11, 0.3)',
                            transition: 'all 0.3s'
                        }}
                    >
                        {saved ? '✓ 已保存' : '💾 保存设置'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

// ========== 子组件 ==========

const SettingGroup = ({ title, description, children }) => (
    <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#e6edf3', marginBottom: '0.25rem' }}>
            {title}
        </h3>
        {description && (
            <p style={{ fontSize: '0.8rem', color: '#6e7681', marginBottom: '1rem' }}>{description}</p>
        )}
        <div>{children}</div>
    </div>
);

const SettingRow = ({ label, description, inline, children }) => (
    <div style={{ marginBottom: '1rem' }}>
        <div style={{
            display: inline ? 'flex' : 'block',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
        }}>
            <div>
                <label style={{ display: 'block', fontSize: '0.9rem', color: '#c9d1d9', fontWeight: '500' }}>
                    {label}
                </label>
                {description && (
                    <span style={{ fontSize: '0.75rem', color: '#6e7681' }}>{description}</span>
                )}
            </div>
            <div style={{ marginTop: inline ? 0 : '0.5rem' }}>{children}</div>
        </div>
    </div>
);

const ToggleSwitch = ({ label, checked, onChange }) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
        <div
            onClick={() => onChange(!checked)}
            style={{
                width: '36px',
                height: '20px',
                background: checked ? 'rgba(240, 185, 11, 0.3)' : 'rgba(48, 54, 61, 0.8)',
                borderRadius: '10px',
                position: 'relative',
                transition: 'all 0.2s',
                border: `1px solid ${checked ? 'rgba(240, 185, 11, 0.5)' : 'rgba(48, 54, 61, 0.8)'}`
            }}
        >
            <div style={{
                position: 'absolute',
                top: '2px',
                left: checked ? '18px' : '2px',
                width: '14px',
                height: '14px',
                background: checked ? '#f0b90b' : '#6e7681',
                borderRadius: '50%',
                transition: 'all 0.2s'
            }} />
        </div>
        {label && <span style={{ color: '#c9d1d9', fontSize: '0.85rem' }}>{label}</span>}
    </label>
);

const inputStyle = {
    padding: '0.75rem 1rem',
    background: '#21262d',
    border: '1px solid rgba(48, 54, 61, 0.8)',
    borderRadius: '0.5rem',
    color: '#e6edf3',
    fontSize: '0.9rem',
    width: '100%',
    outline: 'none',
};

export default UserSettingsModal;
