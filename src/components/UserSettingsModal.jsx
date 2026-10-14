// UserSettingsModal.jsx - 用户全局设置弹窗
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    Settings,
    RefreshCw,
    Lightbulb,
    Loader2,
    CheckCircle,
    XCircle,
    Save,
    User,
    Newspaper,
    Mail,
    Wrench,
    Lock,
    X,
    Check
} from 'lucide-react';
import {
    getUserSettings,
    saveUserSettings,
    isValidEmail,
    resetUserSettings,
    SYSTEM_CONFIG
} from '../services/userSettings';
import { sendTestEmail } from '../services/alertService';
import { LLM_PRESETS, setLLMConfig } from '../services/api';
import { checkAllApiHealth } from '../services/apiHealth';
import './UserSettingsModal.css';

const UserSettingsModal = ({ isOpen, onClose }) => {
    const [settings, setSettings] = useState(null);
    const [activeTab, setActiveTab] = useState('profile');
    const [saved, setSaved] = useState(false);
    const [testingEmail, setTestingEmail] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [apiHealthResults, setApiHealthResults] = useState({});
    const [testingApis, setTestingApis] = useState(false);

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

        // 同步 LLM 配置到 api.js 的 llm_config
        const customModel = settings.ai?.customModel?.trim();
        if (customModel) {
            setLLMConfig({ preset: 'custom', model: customModel });
            console.log(`🤖 已切换 AI 模型: ${customModel} (自定义)`);
        } else if (settings.ai?.preset && LLM_PRESETS[settings.ai.preset]) {
            const presetConfig = LLM_PRESETS[settings.ai.preset];
            setLLMConfig({
                preset: settings.ai.preset,
                model: presetConfig.model
            });
            console.log(`🤖 已切换 AI 模型: ${presetConfig.name}`);
        }

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
        { id: 'profile', label: <><User size={14} /> 个人</>, icon: <User size={14} /> },
        { id: 'news', label: <><Newspaper size={14} /> 新闻/AI</>, icon: <Newspaper size={14} /> },
        { id: 'notifications', label: <><Mail size={14} /> 通知</>, icon: <Mail size={14} /> },
        { id: 'system', label: <><Wrench size={14} /> 系统</>, icon: <Wrench size={14} /> },
    ];

    return createPortal(
        <div className="usm-overlay">
            <div className="usm-dialog">
                {/* Header */}
                <div className="usm-header">
                    <div>
                        <h2 className="usm-header__title">
                            <><Settings size={16} /> 用户设置</>
                        </h2>
                        <p className="usm-header__subtitle">
                            自定义你的看板体验
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="usm-close-btn"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="usm-tabs">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={'usm-tab' + (activeTab === tab.id ? ' usm-tab--active' : '')}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="usm-content">

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
                                        className="usm-input"
                                    />
                                </SettingRow>
                            </SettingGroup>

                            <SettingGroup title="数据管理">
                                <div className="usm-flex-row">
                                    <button
                                        onClick={handleReset}
                                        className="usm-reset-btn"
                                    >
                                        <><RefreshCw size={14} /> 重置所有设置</>
                                    </button>
                                </div>
                            </SettingGroup>
                        </div>
                    )}

                    {/* News & AI Tab */}
                    {activeTab === 'news' && (
                        <div>
                            <SettingGroup title="AI 模型选择" description="用于新闻分析和图表诊断的 AI 模型">
                                <div className="usm-preset-list">
                                    {Object.entries(LLM_PRESETS).map(([key, preset]) => (
                                        <button
                                            key={key}
                                            onClick={() => setSettings({
                                                ...settings,
                                                ai: { ...settings.ai, preset: key }
                                            })}
                                            className={'usm-preset-btn' + (settings.ai?.preset === key && !settings.ai?.customModel ? ' usm-preset-btn--active' : '')}
                                        >
                                            {preset.name}
                                        </button>
                                    ))}
                                </div>
                                <input
                                    list="usm-model-suggestions"
                                    value={settings.ai?.customModel || ''}
                                    onChange={e => setSettings({
                                        ...settings,
                                        ai: { ...settings.ai, customModel: e.target.value }
                                    })}
                                    className="usm-input usm-model-input"
                                    placeholder="自定义模型名（留空则使用上方预设，渠道自动路由）"
                                />
                                <datalist id="usm-model-suggestions">
                                    {Object.values(LLM_PRESETS).map(p => (
                                        <option key={p.model} value={p.model} />
                                    ))}
                                </datalist>
                            </SettingGroup>

                            <SettingGroup title="新闻默认设置">
                                <div className="usm-grid-2">
                                    <SettingRow label="默认查询天数" description="新闻列表默认显示的时间范围">
                                        <div className="usm-flex-center">
                                            <select
                                                value={settings.news?.defaultDays || 7}
                                                onChange={e => setSettings({
                                                    ...settings,
                                                    news: { ...settings.news, defaultDays: parseInt(e.target.value) }
                                                })}
                                                className="usm-input usm-input--select"
                                            >
                                                <option value={3}>3 天</option>
                                                <option value={7}>7 天</option>
                                                <option value={15}>15 天</option>
                                                <option value={30}>30 天</option>
                                            </select>
                                        </div>
                                    </SettingRow>

                                    <SettingRow label="默认自动分析条数" description="页面加载时自动分析的新闻数量">
                                        <div className="usm-flex-center">
                                            <input
                                                type="number"
                                                value={settings.news?.defaultAnalyzeCount || 20}
                                                onChange={e => setSettings({
                                                    ...settings,
                                                    news: { ...settings.news, defaultAnalyzeCount: parseInt(e.target.value) || 20 }
                                                })}
                                                min={5}
                                                max={100}
                                                className="usm-input usm-input--narrow"
                                            />
                                            <span className="usm-unit-text">条</span>
                                        </div>
                                    </SettingRow>
                                </div>

                                <div className="usm-info-box">
                                    <><Lightbulb size={14} /> 超过自动分析条数的新闻，可在「市场情报」区域点击「分析剩余新闻」按钮手动触发</>
                                </div>

                                <SettingRow label="自动分析新闻" description="加载新闻后自动调用 AI 分析（关闭后手动点击分析按钮触发）">
                                    <ToggleSwitch
                                        checked={settings.news?.autoAnalyze !== false}
                                        onChange={(val) => setSettings({
                                            ...settings,
                                            news: { ...settings.news, autoAnalyze: val }
                                        })}
                                    />
                                </SettingRow>
                            </SettingGroup>

                            <SettingGroup title="图表默认设置">
                                <SettingRow label="默认显示K线数量" description="K线图默认显示的时间窗口（较小值显示更近期数据）">
                                    <div className="usm-flex-center--sm">
                                        {[60, 120, 200, 500].map(bars => (
                                            <button
                                                key={bars}
                                                onClick={() => setSettings({
                                                    ...settings,
                                                    chart: { ...settings.chart, defaultVisibleBars: bars }
                                                })}
                                                className={'usm-preset-btn usm-preset-btn--sm' + (settings.chart?.defaultVisibleBars === bars ? ' usm-preset-btn--active' : '')}
                                            >
                                                {bars} 根
                                            </button>
                                        ))}
                                    </div>
                                </SettingRow>
                            </SettingGroup>
                        </div>
                    )}

                    {/* Notifications Tab */}
                    {activeTab === 'notifications' && (
                        <div>
                            <SettingGroup title="提醒邮箱" description="价格提醒将发送到以下邮箱（最多3个）">
                                {[0, 1, 2].map(index => (
                                    <div key={index} className="usm-email-row">
                                        <div className="usm-email-row__inner">
                                            <span className="usm-email-label">
                                                邮箱 {index + 1}
                                            </span>
                                            <input
                                                type="email"
                                                value={(settings.emails || [])[index] || ''}
                                                onChange={e => handleEmailChange(index, e.target.value)}
                                                placeholder={index === 0 ? '主邮箱（必填）' : '备用邮箱（可选）'}
                                                className={'usm-input' + ((settings.emails || [])[index] && !isValidEmail((settings.emails || [])[index]) ? ' usm-input--email-error' : '')}
                                            />
                                            {(settings.emails || [])[index] && isValidEmail((settings.emails || [])[index]) && (
                                                <span className="usm-email-check"><Check size={14} /></span>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                <div className="usm-test-email-section">
                                    <button
                                        onClick={handleTestEmails}
                                        disabled={testingEmail || !(settings.emails || []).some(e => e && isValidEmail(e))}
                                        className={
                                            'usm-test-email-btn' +
                                            (testResult?.success ? ' usm-test-email-btn--success' :
                                             testResult?.error ? ' usm-test-email-btn--error' :
                                             ' usm-test-email-btn--default') +
                                            (testingEmail ? ' usm-test-email-btn--sending' : '') +
                                            (!(settings.emails || []).some(e => e && isValidEmail(e)) ? ' usm-test-email-btn--disabled' : '')
                                        }
                                    >
                                        {testingEmail ? <><Loader2 size={14} className="spin" /> 发送中...</> :
                                         testResult?.success ? <><CheckCircle size={14} /> 成功 {testResult.count}/{testResult.total}</> :
                                         testResult?.error ? <><XCircle size={14} /> 失败</> :
                                         <><Mail size={14} /> 发送测试邮件</>}
                                    </button>
                                    {testResult?.success && (
                                        <div className="usm-test-result--success">
                                            已发送到: {testResult.to}
                                        </div>
                                    )}
                                    {testResult?.error && (
                                        <div className="usm-test-result--error">
                                            {testResult.error}
                                        </div>
                                    )}
                                </div>
                            </SettingGroup>

                            <SettingGroup title="提醒默认值">
                                <SettingRow label="检查间隔" description="价格提醒条件检查频率">
                                    <div className="usm-flex-center--md">
                                        {[30, 60, 120, 300].map(sec => (
                                            <button
                                                key={sec}
                                                onClick={() => setSettings({
                                                    ...settings,
                                                    polling: { ...settings.polling, alertCheckInterval: sec }
                                                })}
                                                className={'usm-preset-btn usm-preset-btn--sm' + (settings.polling?.alertCheckInterval === sec ? ' usm-preset-btn--active' : '')}
                                            >
                                                {sec < 60 ? `${sec}秒` : `${sec / 60}分钟`}
                                            </button>
                                        ))}
                                    </div>
                                </SettingRow>
                                <div className="usm-grid-2--sm-gap">
                                    <SettingRow label="默认冷却时间" inline>
                                        <div className="usm-flex-center">
                                            <input
                                                type="number"
                                                value={settings.alerts?.defaultCooldown || 240}
                                                onChange={e => setSettings({
                                                    ...settings,
                                                    alerts: { ...settings.alerts, defaultCooldown: parseInt(e.target.value) || 240 }
                                                })}
                                                min={1}
                                                max={1440}
                                                className="usm-input usm-input--narrow"
                                            />
                                            <span className="usm-unit-text">分钟</span>
                                        </div>
                                    </SettingRow>
                                    <SettingRow label="默认每日上限" inline>
                                        <div className="usm-flex-center">
                                            <input
                                                type="number"
                                                value={settings.alerts?.defaultDailyLimit || 5}
                                                onChange={e => setSettings({
                                                    ...settings,
                                                    alerts: { ...settings.alerts, defaultDailyLimit: parseInt(e.target.value) || 5 }
                                                })}
                                                min={1}
                                                max={50}
                                                className="usm-input usm-input--narrow"
                                            />
                                            <span className="usm-unit-text">封/天</span>
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
                                <div className="usm-sys-card">
                                    <div>
                                        <span className="usm-sys-label">版本号</span>
                                        <div className="usm-sys-value">
                                            v{SYSTEM_CONFIG.version}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="usm-sys-label">构建日期</span>
                                        <div className="usm-sys-value">
                                            {SYSTEM_CONFIG.buildDate}
                                        </div>
                                    </div>
                                </div>
                            </SettingGroup>

                            <SettingGroup title="数据源接口" description="点击按钮主动检测各 API 连通性">
                                <button
                                    onClick={async () => {
                                        setTestingApis(true);
                                        setApiHealthResults({});
                                        await checkAllApiHealth((key, result) => {
                                            setApiHealthResults(prev => ({ ...prev, [key]: result }));
                                        });
                                        setTestingApis(false);
                                    }}
                                    disabled={testingApis}
                                    className={'usm-api-test-btn' + (testingApis ? ' usm-api-test-btn--loading' : '')}
                                >
                                    {testingApis && (
                                        <span className="usm-spinner usm-spinner--md" />
                                    )}
                                    {testingApis ? '检测中...' : '测试全部连通性'}
                                </button>
                                <div className="usm-api-list">
                                    {Object.entries(SYSTEM_CONFIG.apis).map(([key, api]) => {
                                        const health = apiHealthResults[key];
                                        const isTesting = testingApis && !health;
                                        let badgeClass, badgeText;

                                        if (isTesting) {
                                            badgeClass = 'usm-api-badge usm-api-badge--testing';
                                            badgeText = '检测中';
                                        } else if (!health) {
                                            badgeClass = 'usm-api-badge usm-api-badge--idle';
                                            badgeText = '未测试';
                                        } else if (health.status === 'ok') {
                                            badgeClass = 'usm-api-badge usm-api-badge--ok';
                                            badgeText = `${health.latency}ms`;
                                        } else {
                                            badgeClass = 'usm-api-badge usm-api-badge--error';
                                            badgeText = '失败';
                                        }

                                        return (
                                            <div
                                                key={key}
                                                className="usm-api-item"
                                            >
                                                <div className="usm-api-item__header">
                                                    <div>
                                                        <div className="usm-api-item__name">
                                                            {api.name}
                                                        </div>
                                                        <div className="usm-api-item__desc">
                                                            {api.description}
                                                        </div>
                                                    </div>
                                                    <div className={badgeClass}>
                                                        {isTesting && (
                                                            <span className="usm-spinner usm-spinner--sm" />
                                                        )}
                                                        {badgeText}
                                                    </div>
                                                </div>
                                                <div className="usm-api-endpoint">
                                                    {api.endpoint}
                                                </div>
                                                {health && health.status === 'error' && health.error && (
                                                    <div className="usm-api-error">
                                                        {health.error}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </SettingGroup>

                            <SettingGroup title="系统默认轮询配置（只读）">
                                <div className="usm-sys-card usm-sys-card--3col">
                                    <div>
                                        <span className="usm-sys-label">价格轮询</span>
                                        <div className="usm-sys-value">
                                            {SYSTEM_CONFIG.polling.price}秒
                                        </div>
                                    </div>
                                    <div>
                                        <span className="usm-sys-label">新闻轮询</span>
                                        <div className="usm-sys-value">
                                            {SYSTEM_CONFIG.polling.news / 60}分钟
                                        </div>
                                    </div>
                                    <div>
                                        <span className="usm-sys-label">提醒检查</span>
                                        <div className="usm-sys-value">
                                            {SYSTEM_CONFIG.polling.alerts}秒
                                        </div>
                                    </div>
                                </div>
                            </SettingGroup>

                            <div className="usm-info-box">
                                <><Lock size={14} /> 系统配置为只读，如需调整轮询频率请前往「轮询」标签页进行个性化设置。</>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="usm-footer">
                    <button
                        onClick={onClose}
                        className="usm-cancel-btn"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSave}
                        className={'usm-save-btn' + (saved ? ' usm-save-btn--saved' : '')}
                    >
                        {saved ? <><Check size={14} /> 已保存</> : <><Save size={14} /> 保存设置</>}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

// ========== 子组件 ==========

const SettingGroup = ({ title, description, children }) => (
    <div className="usm-group">
        <h3 className="usm-group__title">
            {title}
        </h3>
        {description && (
            <p className="usm-group__desc">{description}</p>
        )}
        <div>{children}</div>
    </div>
);

const SettingRow = ({ label, description, inline, children }) => (
    <div className="usm-row">
        <div className={'usm-row__inner' + (inline ? ' usm-row__inner--inline' : '')}>
            <div>
                <label className="usm-row__label">
                    {label}
                </label>
                {description && (
                    <span className="usm-row__hint">{description}</span>
                )}
            </div>
            <div className={'usm-row__control' + (inline ? ' usm-row__control--inline' : '')}>{children}</div>
        </div>
    </div>
);

const ToggleSwitch = ({ label, checked, onChange }) => (
    <label className="usm-toggle">
        <div
            onClick={() => onChange(!checked)}
            className={'usm-toggle__track' + (checked ? ' usm-toggle__track--checked' : '')}
        >
            <div className={'usm-toggle__thumb' + (checked ? ' usm-toggle__thumb--checked' : '')} />
        </div>
        {label && <span className="usm-toggle__label">{label}</span>}
    </label>
);

export default UserSettingsModal;
