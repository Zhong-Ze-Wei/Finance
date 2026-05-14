// notificationService.js - 浏览器推送通知 + 通知历史

export const NOTIFICATION_HISTORY_KEY = 'notification_history';
const MAX_HISTORY = 50;

/**
 * 请求浏览器通知权限
 * @returns {Promise<boolean>}
 */
export const requestNotificationPermission = async () => {
    if (!global.Notification) return false;
    if (global.Notification.permission === 'granted') return true;
    if (global.Notification.permission === 'denied') return false;

    const permission = await global.Notification.requestPermission();
    return permission === 'granted';
};

/**
 * 发送浏览器推送通知
 * @param {string} title
 * @param {{ body?: string, icon?: string, tag?: string, onClick?: () => void }} options
 * @returns {boolean}
 */
export const sendBrowserNotification = (title, options = {}) => {
    if (!global.Notification || global.Notification.permission !== 'granted') {
        return false;
    }

    try {
        const notification = new global.Notification(title, {
            body: options.body || '',
            icon: options.icon || '/favicon.ico',
            tag: options.tag || '',
            silent: false,
        });

        if (options.onClick) {
            notification.onclick = options.onClick;
        }

        // 自动关闭（8秒）
        setTimeout(() => notification.close(), 8000);

        return true;
    } catch (e) {
        console.error('Browser notification failed:', e);
        return false;
    }
};

/**
 * 获取通知历史
 * @returns {Array<{ id: string, title: string, body: string, type: string, timestamp: number }>}
 */
export const getNotificationHistory = () => {
    try {
        return JSON.parse(localStorage.getItem(NOTIFICATION_HISTORY_KEY)) || [];
    } catch {
        return [];
    }
};

/**
 * 添加通知到历史记录（自动限制 MAX_HISTORY 条）
 * @param {{ title: string, body?: string, type: string }} notification
 */
export const addNotificationToHistory = (notification) => {
    const history = getNotificationHistory();
    const entry = {
        id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title: notification.title,
        body: notification.body || '',
        type: notification.type,
        timestamp: Date.now(),
    };

    history.unshift(entry);

    // 限制最大条数
    if (history.length > MAX_HISTORY) {
        history.length = MAX_HISTORY;
    }

    localStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(history));
    return entry;
};

/**
 * 清空通知历史
 */
export const clearNotificationHistory = () => {
    localStorage.removeItem(NOTIFICATION_HISTORY_KEY);
};
