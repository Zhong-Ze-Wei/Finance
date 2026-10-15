// AiProviderSettings.jsx - AI 模型配置（供应商管理 + 当前模型 + 思考等级 + 请求参数）
// 业务无关的通用模型配置模块，业务功能通过统一调用接口消费
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, PlugZap, RefreshCw, X, Check, Globe, Cpu, Power } from 'lucide-react';
import { listProviders, createProvider, updateProvider, deleteProvider, testProvider, fetchModels } from '../services/aiProviders';
import { isLoggedIn } from '../services/authService';
import './AiProviderSettings.css';

const PROTOCOL_LABELS = {
    'auto': '自动检测',
    'openai-compatible': 'OpenAI',
    'anthropic': 'Anthropic',
};

const ERROR_TYPE_LABELS = {
    'auth': '认证失败（检查 API Key）',
    'network': '网络错误（地址不可达）',
    'protocol': '协议不兼容（尝试切换协议类型）',
    'model': '模型不可用（不在该供应商模型列表中）',
};

const REASONING_LEVELS = [
    { value: 'off', label: '关闭' },
    { value: 'low', label: '低' },
    { value: 'medium', label: '中' },
    { value: 'high', label: '高' },
];

const EMPTY_FORM = { name: '', baseUrl: '', apiKey: '', protocol: 'auto', useProxy: false, models: [], enabled: true };

// 供应商图标色块：按名称稳定取色
const AVATAR_COLORS = ['var(--color-indigo)', 'var(--color-success)', 'var(--color-warning)', 'var(--accent-blue, #58a6ff)', 'var(--color-ethereum, #627eea)'];
const avatarColor = (name) => AVATAR_COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

const AiProviderSettings = ({ value, onChange }) => {
    const [providers, setProviders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);          // null | 'new' | provider id
    const [form, setForm] = useState(EMPTY_FORM);
    const [modelInput, setModelInput] = useState('');
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [modelsVersion, setModelsVersion] = useState(0); // 拉取模型后触发选项刷新

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            setProviders(await listProviders());
            setError(null);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { reload(); }, [reload]);

    const current = value || { providerId: 'builtin-aiping', model: 'GLM-5.3-Flash', reasoning: 'off', temperature: null, maxTokens: null };
    const currentProvider = providers.find(p => p.id === current.providerId);

    // 当前供应商可选模型：配置内列表 ∪ 拉取缓存（localStorage，含内置供应商）
    const readCachedModels = (pid) => {
        try { return JSON.parse(localStorage.getItem(`aps_models_${pid}`) || '[]'); } catch { return []; }
    };
    const modelOptions = [...new Set([...(currentProvider?.models || []), ...readCachedModels(current.providerId)])].sort();
    void modelsVersion; // 仅用于拉取模型后触发重渲染

    // 供应商失效（如内置项下线）或模型跨供应商残留时，回落到合法选项
    useEffect(() => {
        if (loading || !providers.length) return;
        if (!currentProvider) {
            const fallback = providers.find(p => p.enabled !== false);
            onChange({ ...current, providerId: fallback?.id || 'builtin-aiping', model: '' });
            return;
        }
        // 模型必须属于当前供应商（自定义 ID 请在供应商编辑中添加到模型列表）
        if (current.model && modelOptions.length && !modelOptions.includes(current.model)) {
            onChange({ ...current, model: modelOptions[0] });
        }
    }, [loading, providers]);

    const handleRefreshModels = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const { models } = await fetchModels({ id: current.providerId });
            localStorage.setItem(`aps_models_${current.providerId}`, JSON.stringify(models));
            setModelsVersion(v => v + 1);
            if (models.length && !models.includes(current.model)) {
                onChange({ ...current, model: models[0] });
            }
        } catch (e) {
            setTestResult(e.data || { ok: false, errorType: 'network', message: e.message });
        } finally {
            setTesting(false);
        }
    };

    const startEdit = (provider) => {
        setEditing(provider === 'new' ? 'new' : provider.id);
        setForm(provider === 'new'
            ? { ...EMPTY_FORM }
            : {
                name: provider.name,
                baseUrl: provider.baseUrl,
                apiKey: '',
                protocol: provider.protocol,
                useProxy: !!provider.useProxy,
                models: provider.models,
                enabled: provider.enabled,
            });
        setTestResult(null);
        setError(null);
    };

    const handleSave = async () => {
        if (!form.name || !form.baseUrl) { setError('名称和 Base URL 必填'); return; }
        setSaving(true);
        setError(null);
        try {
            if (editing === 'new') {
                await createProvider(form);
            } else {
                await updateProvider(editing, form);
            }
            setEditing(null);
            await reload();
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (provider) => {
        if (!window.confirm(`确定删除供应商「${provider.name}」？`)) return;
        try {
            await deleteProvider(provider.id);
            if (current.providerId === provider.id) {
                onChange({ ...current, providerId: 'builtin-aiping', model: 'GLM-5.3-Flash' });
            }
            await reload();
        } catch (e) {
            setError(e.message);
        }
    };

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const body = editing === 'new'
                ? form
                : { id: editing, testModel: current.providerId === editing ? current.model : undefined };
            setTestResult(await testProvider(body));
        } catch (e) {
            setTestResult({ ok: false, errorType: 'network', message: e.message });
        } finally {
            setTesting(false);
        }
    };

    const handleFetchModels = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const { protocol, models } = await fetchModels(editing === 'new' ? form : { id: editing });
            setForm(f => ({
                ...f,
                protocol: f.protocol === 'auto' ? protocol : f.protocol,
                models: [...new Set([...f.models, ...models])],
            }));
            setTestResult({ ok: true, detectedProtocol: protocol });
        } catch (e) {
            setTestResult(e.data || { ok: false, errorType: 'protocol', message: e.message });
        } finally {
            setTesting(false);
        }
    };

    const addManualModel = () => {
        const id = modelInput.trim();
        if (!id) return;
        setForm(f => ({ ...f, models: [...new Set([...f.models, id])] }));
        setModelInput('');
    };

    const toggleEnabled = async (provider) => {
        await updateProvider(provider.id, { enabled: !provider.enabled });
        await reload();
    };

    return (
        <div className="aps">
            {/* ===== 当前配置 ===== */}
            <div className="aps-current">
                <div className="aps-current__head">
                    <Cpu size={15} />
                    <span className="aps-current__title">当前模型</span>
                    {currentProvider && (
                        <span className="aps-current__provider" title={`${currentProvider.name} / ${current.model || '未选择'}`}>
                            {currentProvider.name}
                            {current.model ? ` · ${current.model}` : ''}
                            {currentProvider.useProxy && <Globe size={11} title="经代理出站" />}
                        </span>
                    )}
                </div>
                <div className="aps-grid">
                    <label className="aps-field">
                        <span className="aps-field__label">供应商</span>
                        <select
                            className="aps-input"
                            value={current.providerId}
                            onChange={e => {
                                const p = providers.find(x => x.id === e.target.value);
                                onChange({ ...current, providerId: e.target.value, model: p?.models?.[0] || '' });
                            }}
                        >
                            {providers.filter(p => p.enabled !== false).map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </label>
                    <label className="aps-field">
                        <span className="aps-field__label">模型</span>
                        <div className="aps-models__input">
                            <select
                                className="aps-input"
                                title={current.model || ''}
                                value={modelOptions.includes(current.model) ? current.model : ''}
                                onChange={e => onChange({ ...current, model: e.target.value })}
                            >
                                <option value="" disabled>— 选择模型 —</option>
                                {modelOptions.map(m => (
                                    <option key={m} value={m} title={m}>{m}</option>
                                ))}
                            </select>
                            <button
                                type="button"
                                className="aps-btn aps-btn--icon"
                                onClick={handleRefreshModels}
                                disabled={testing}
                                title="从 /v1/models 拉取模型列表"
                            >
                                <RefreshCw size={14} className={testing ? 'aps-spin' : ''} />
                            </button>
                        </div>
                        {modelOptions.length === 0 && (
                            <span className="aps-field__hint">尚无模型列表，点击右侧按钮从 API 拉取，或在供应商编辑中手动添加</span>
                        )}
                    </label>
                </div>

                <div className="aps-current__row">
                    <div className="aps-field">
                        <span className="aps-field__label">思考等级</span>
                        <div className="aps-levels">
                            {REASONING_LEVELS.map(l => (
                                <button
                                    key={l.value}
                                    type="button"
                                    className={'aps-level' + (current.reasoning === l.value ? ' aps-level--active' : '')}
                                    onClick={() => onChange({ ...current, reasoning: l.value })}
                                >
                                    {l.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <label className="aps-field aps-field--sm">
                        <span className="aps-field__label">Temperature</span>
                        <input
                            className="aps-input"
                            type="number" min="0" max="2" step="0.1"
                            value={current.temperature ?? ''}
                            onChange={e => {
                                const v = e.target.value;
                                onChange({ ...current, temperature: v === '' ? null : parseFloat(v) });
                            }}
                            placeholder="默认"
                        />
                    </label>
                    <label className="aps-field aps-field--sm">
                        <span className="aps-field__label">Max Tokens</span>
                        <input
                            className="aps-input"
                            type="number" min="1" step="256"
                            value={current.maxTokens ?? ''}
                            onChange={e => {
                                const v = e.target.value;
                                onChange({ ...current, maxTokens: v === '' ? null : parseInt(v, 10) });
                            }}
                            placeholder="默认"
                        />
                    </label>
                </div>
                <span className="aps-field__hint">思考等级与参数留空时使用业务默认值；不支持的模型会自动忽略思考参数</span>
            </div>

            {/* ===== 供应商管理 ===== */}
            <div className="aps-section">
                <div className="aps-section__head">
                    <span className="aps-section__title">自定义供应商</span>
                    {isLoggedIn() && editing === null && (
                        <button type="button" className="aps-btn aps-btn--primary" onClick={() => startEdit('new')}>
                            <Plus size={14} /> 添加供应商
                        </button>
                    )}
                </div>
                {!isLoggedIn() && (
                    <div className="aps-hint">登录后可添加自定义供应商（API Key 加密存储在你的账户下）</div>
                )}

                <div className="aps-list">
                    {loading ? (
                        <div className="aps-hint">加载中...</div>
                    ) : providers.map(p => (
                        <div
                            key={p.id}
                            className={'aps-card' + (editing === p.id ? ' aps-card--editing' : '') + (p.enabled === false ? ' aps-card--disabled' : '')}
                        >
                            <div className="aps-card__avatar" style={{ '--aps-avatar': avatarColor(p.name) }}>
                                {p.name.replace(/[（(].*$/, '').trim().charAt(0).toUpperCase()}
                            </div>
                            <div className="aps-card__body">
                                <div className="aps-card__title">
                                    <span className={'aps-dot' + (p.enabled === false ? ' aps-dot--off' : '')} />
                                    {p.name}
                                    <span className={'aps-badge aps-badge--' + (p.builtin ? 'builtin' : p.protocol)}>
                                        {p.builtin ? '内置' : PROTOCOL_LABELS[p.protocol] || p.protocol}
                                    </span>
                                    {p.useProxy && <Globe size={12} className="aps-card__proxy" title="经代理出站" />}
                                </div>
                                <div className="aps-card__meta">
                                    {p.baseUrl} · {p.models?.length || 0} 个模型{p.keyHint ? ` · Key ${p.keyHint}` : ''}
                                </div>
                            </div>
                            {!p.builtin && (
                                <div className="aps-card__actions">
                                    <button type="button" className="aps-icon-btn" title={p.enabled === false ? '启用' : '停用'} onClick={() => toggleEnabled(p)}>
                                        <Power size={14} />
                                    </button>
                                    <button type="button" className="aps-icon-btn" title="编辑" onClick={() => startEdit(p)}><Pencil size={14} /></button>
                                    <button type="button" className="aps-icon-btn aps-icon-btn--danger" title="删除" onClick={() => handleDelete(p)}><Trash2 size={14} /></button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* ===== 编辑表单 ===== */}
                {editing !== null && (
                    <div className="aps-form">
                        <div className="aps-grid">
                            <label className="aps-field">
                                <span className="aps-field__label">名称</span>
                                <input className="aps-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="例如 SiliconFlow" />
                            </label>
                            <label className="aps-field">
                                <span className="aps-field__label">协议类型</span>
                                <select className="aps-input" value={form.protocol} onChange={e => setForm({ ...form, protocol: e.target.value })}>
                                    {Object.entries(PROTOCOL_LABELS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                                </select>
                            </label>
                        </div>
                        <label className="aps-field">
                            <span className="aps-field__label">Base URL（含 /v1）</span>
                            <input className="aps-input" value={form.baseUrl} onChange={e => setForm({ ...form, baseUrl: e.target.value })} placeholder="https://api.example.com/v1" />
                        </label>
                        <label className="aps-field">
                            <span className="aps-field__label">API Key{editing !== 'new' ? '（留空保持不变）' : ''}</span>
                            <input className="aps-input" type="password" value={form.apiKey} onChange={e => setForm({ ...form, apiKey: e.target.value })} placeholder="sk-..." />
                        </label>

                        <label className="aps-check">
                            <input
                                type="checkbox"
                                checked={!!form.useProxy}
                                onChange={e => setForm({ ...form, useProxy: e.target.checked })}
                            />
                            <Globe size={13} />
                            <span>通过代理出站<span className="aps-field__hint">（境外供应商，经 VPN_PROXY 访问）</span></span>
                        </label>

                        <div className="aps-field">
                            <span className="aps-field__label">模型列表</span>
                            {form.models.length > 0 && (
                                <div className="aps-models">
                                    {form.models.map(m => (
                                        <span key={m} className="aps-model">
                                            {m}
                                            <button type="button" className="aps-model__remove" onClick={() => setForm({ ...form, models: form.models.filter(x => x !== m) })}>
                                                <X size={12} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div className="aps-models__input">
                                <input
                                    className="aps-input"
                                    value={modelInput}
                                    onChange={e => setModelInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addManualModel(); } }}
                                    placeholder="手动填写 Model ID，回车添加"
                                />
                                <button type="button" className="aps-btn" onClick={handleFetchModels} disabled={testing}>
                                    <RefreshCw size={14} className={testing ? 'aps-spin' : ''} /> 从 API 拉取
                                </button>
                            </div>
                        </div>

                        {testResult && (
                            <div className={'aps-test ' + (testResult.ok ? 'aps-test--ok' : 'aps-test--fail')}>
                                <PlugZap size={14} />
                                {testResult.ok
                                    ? `连接成功${testResult.detectedProtocol ? `（协议：${PROTOCOL_LABELS[testResult.detectedProtocol] || testResult.detectedProtocol}）` : ''}`
                                    : `${ERROR_TYPE_LABELS[testResult.errorType] || '失败'}${testResult.message ? ` — ${testResult.message}` : ''}`}
                            </div>
                        )}

                        {error && <div className="aps-test aps-test--fail">{error}</div>}

                        <div className="aps-form__actions">
                            <button type="button" className="aps-btn" onClick={handleTest} disabled={testing || (!form.apiKey && editing === 'new')}>
                                <PlugZap size={14} /> 测试连接
                            </button>
                            <button type="button" className="aps-btn aps-btn--primary" onClick={handleSave} disabled={saving}>
                                {saving ? '保存中...' : '保存'}
                            </button>
                            <button type="button" className="aps-btn" onClick={() => { setEditing(null); setTestResult(null); setError(null); }}>
                                取消
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AiProviderSettings;
