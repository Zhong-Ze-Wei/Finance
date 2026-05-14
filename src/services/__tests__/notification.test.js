import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Notification API
const mockNotification = vi.fn();
global.Notification = class {
    constructor(title, opts) { mockNotification(title, opts); }
    static permission = 'default';
    static requestPermission = vi.fn(async () => 'granted');
};

describe('浏览器推送通知服务', () => {
    let requestNotificationPermission, sendBrowserNotification, getNotificationHistory, addNotificationToHistory, NOTIFICATION_HISTORY_KEY;

    beforeEach(async () => {
        vi.clearAllMocks();
        localStorage.clear();
        const mod = await import('../notificationService.js');
        requestNotificationPermission = mod.requestNotificationPermission;
        sendBrowserNotification = mod.sendBrowserNotification;
        getNotificationHistory = mod.getNotificationHistory;
        addNotificationToHistory = mod.addNotificationToHistory;
        NOTIFICATION_HISTORY_KEY = mod.NOTIFICATION_HISTORY_KEY;
    });

    describe('requestNotificationPermission', () => {
        it('应请求通知权限', async () => {
            const result = await requestNotificationPermission();
            expect(global.Notification.requestPermission).toHaveBeenCalled();
        });

        it('已授权时应直接返回 true', async () => {
            global.Notification.permission = 'granted';
            const result = await requestNotificationPermission();
            expect(result).toBe(true);
        });
    });

    describe('sendBrowserNotification', () => {
        it('未授权时应返回 false', () => {
            global.Notification.permission = 'denied';
            const result = sendBrowserNotification('Test', { body: 'body' });
            expect(result).toBe(false);
        });

        it('已授权时应创建 Notification 并返回 true', () => {
            global.Notification.permission = 'granted';
            const result = sendBrowserNotification('BTC 突破 $100000', { body: '价格提醒触发', tag: 'alert_1' });
            expect(result).toBe(true);
            expect(mockNotification).toHaveBeenCalledWith('BTC 突破 $100000', expect.objectContaining({ body: '价格提醒触发' }));
        });
    });

    describe('addNotificationToHistory', () => {
        it('应将通知添加到历史记录', () => {
            addNotificationToHistory({
                title: 'BTC 价格提醒',
                body: '突破 $100000',
                type: 'price_alert'
            });
            const history = getNotificationHistory();
            expect(history.length).toBe(1);
            expect(history[0].title).toBe('BTC 价格提醒');
            expect(history[0].type).toBe('price_alert');
        });

        it('历史记录应限制最大 50 条', () => {
            for (let i = 0; i < 60; i++) {
                addNotificationToHistory({ title: `通知 ${i}`, type: 'test' });
            }
            const history = getNotificationHistory();
            expect(history.length).toBe(50);
        });

        it('每条记录应包含 id 和 timestamp', () => {
            addNotificationToHistory({ title: 'test', body: 'body', type: 'alert' });
            const history = getNotificationHistory();
            expect(history[0].id).toBeDefined();
            expect(history[0].timestamp).toBeDefined();
        });
    });

    describe('getNotificationHistory', () => {
        it('空历史应返回空数组', () => {
            const history = getNotificationHistory();
            expect(Array.isArray(history)).toBe(true);
            expect(history.length).toBe(0);
        });
    });
});
