// emailService.js - 账户邮箱群服务（数据库为真源，localStorage 作下游缓存供提醒链路复用）
import { getToken } from './authService';
import { getUserSettings, saveUserSettings } from './userSettings';

const authHeaders = () => {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
};

// 同步邮箱列表到 localStorage（alertService 等现有链路继续从 settings.emails 读取）
const syncToSettings = (emails) => {
    const settings = getUserSettings();
    saveUserSettings({ ...settings, emails: emails.map(e => e.email) });
};

export const listEmails = async () => {
    const res = await fetch('/api/emails', { headers: authHeaders() });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
    const { emails } = await res.json();
    syncToSettings(emails);
    return emails;
};

export const addEmail = async (email) => {
    const res = await fetch('/api/emails', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ email }) });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
    return listEmails();
};

export const removeEmail = async (email) => {
    const res = await fetch(`/api/emails/${encodeURIComponent(email)}`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
    return listEmails();
};

export const setPrimaryEmail = async (email) => {
    const res = await fetch(`/api/emails/${encodeURIComponent(email)}/primary`, { method: 'PUT', headers: authHeaders() });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
    return listEmails();
};

// 旧版 localStorage 邮箱（最多 3 个）自动导入账户（仅当账户尚无邮箱时执行一次）
export const migrateLegacyEmails = async (existingEmails) => {
    if (existingEmails.length > 0) return existingEmails;
    const legacy = (getUserSettings().emails || []).filter(e => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    for (const e of legacy) {
        await addEmail(e).catch(() => {});
    }
    return legacy.length ? listEmails() : existingEmails;
};
