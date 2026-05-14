// authService.js - 用户认证服务
// 管理登录状态、Token 存储、与后端 API 通信

// 动态获取 API 地址（支持局域网访问）
const getApiBase = () => {
    const hostname = window.location.hostname;
    const port = 3001;
    return `http://${hostname}:${port}/api`;
};

const TOKEN_KEY = 'crypto_dashboard_token';
const USER_KEY = 'crypto_dashboard_user';

// ========== Token 管理 ==========

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const setToken = (token) => {
    localStorage.setItem(TOKEN_KEY, token);
};

export const removeToken = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
};

// ========== 用户状态 ==========

export const getStoredUser = () => {
    const data = localStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
};

export const setStoredUser = (user) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const isLoggedIn = () => !!getToken();

// ========== API 请求封装 ==========

const authFetch = async (url, options = {}) => {
    const API_BASE = getApiBase(); // 每次调用时动态获取
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers
    };

    const response = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers
    });

    if (response.status === 401) {
        removeToken();
        window.dispatchEvent(new CustomEvent('auth:logout'));
    }

    return response;
};

// ========== 认证 API ==========

// 登录
export const login = async (username, password) => {
    const response = await authFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || '登录失败');
    }

    setToken(data.token);
    setStoredUser(data.user);

    return data.user;
};

// 注册
export const register = async (username, password, email, nickname) => {
    const response = await authFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password, email, nickname })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || '注册失败');
    }

    setToken(data.token);
    setStoredUser(data.user);

    return data.user;
};

// 登出
export const logout = async () => {
    await authFetch('/auth/logout', { method: 'POST' });
    removeToken();
    window.dispatchEvent(new CustomEvent('auth:logout'));
};

// 获取当前用户信息
export const fetchCurrentUser = async () => {
    const response = await authFetch('/auth/me');
    if (!response.ok) return null;
    const data = await response.json();
    setStoredUser(data.user);
    return data.user;
};

// ========== 设置同步 API ==========

// 获取云端设置
export const fetchSettings = async () => {
    const response = await authFetch('/settings');
    if (!response.ok) return {};
    const data = await response.json();
    return data.settings;
};

// 保存设置到云端
export const saveSettings = async (settings) => {
    const response = await authFetch('/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
    });
    return response.ok;
};

// ========== 资产卡片同步 API ==========

// 获取云端卡片
export const fetchCards = async () => {
    const response = await authFetch('/cards');
    if (!response.ok) return [];
    const data = await response.json();
    return data.cards;
};

// 同步卡片到云端
export const syncCards = async (cards) => {
    const response = await authFetch('/cards/sync', {
        method: 'POST',
        body: JSON.stringify({ cards })
    });
    return response.ok;
};

// ========== 邮箱 API ==========

// 获取邮箱列表
export const fetchEmails = async () => {
    const response = await authFetch('/emails');
    if (!response.ok) return [];
    const data = await response.json();
    return data.emails;
};

// 添加邮箱
export const addEmail = async (email) => {
    const response = await authFetch('/emails', {
        method: 'POST',
        body: JSON.stringify({ email })
    });
    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '添加失败');
    }
    return true;
};

// 删除邮箱
export const removeEmail = async (email) => {
    const response = await authFetch(`/emails/${encodeURIComponent(email)}`, {
        method: 'DELETE'
    });
    return response.ok;
};
