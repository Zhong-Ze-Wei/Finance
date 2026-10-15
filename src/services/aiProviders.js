// aiProviders.js - AI 供应商配置服务
// 自定义供应商的 CRUD / 连接测试 / 模型拉取，API Key 只提交到后端、永不落在本地

import { getToken } from './authService';

const authHeaders = () => {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
};

const request = async (path, options = {}) => {
    const res = await fetch(path, { ...options, headers: authHeaders() });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status, data });
    }
    return res.json();
};

export const listProviders = () => request('/api/ai/providers');

export const createProvider = (provider) =>
    request('/api/ai/providers', { method: 'POST', body: JSON.stringify(provider) });

export const updateProvider = (id, patch) =>
    request(`/api/ai/providers/${id}`, { method: 'PUT', body: JSON.stringify(patch) });

export const deleteProvider = (id) =>
    request(`/api/ai/providers/${id}`, { method: 'DELETE' });

// 连接测试：返回 { ok, errorType: 'auth'|'network'|'protocol'|'model', message, models?, detectedProtocol? }
export const testProvider = (body) =>
    request('/api/ai/providers/test', { method: 'POST', body: JSON.stringify(body) });

// 拉取模型列表：返回 { protocol, models }
export const fetchModels = (body) =>
    request('/api/ai/providers/models', { method: 'POST', body: JSON.stringify(body) });
