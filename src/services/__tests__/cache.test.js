import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock localStorage
const store = {};
const localStorageMock = {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, val) => { store[key] = val; }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: () => Object.keys(store).forEach(k => delete store[k]),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i) => Object.keys(store)[i] || null)
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock, configurable: true });

describe('cache', () => {
    let getCache, setCache, clearAssetCache;

    beforeEach(async () => {
        localStorageMock.clear();
        vi.clearAllMocks();
        const mod = await import('../cache.js');
        getCache = mod.getCache;
        setCache = mod.setCache;
        clearAssetCache = mod.clearAssetCache;
    });

    describe('getCache', () => {
        it('应返回 null 当 key 不存在', () => {
            expect(getCache('nonexistent')).toBeNull();
        });

        it('应返回缓存数据当未过期', () => {
            const data = { price: 100 };
            store['test_key'] = JSON.stringify({ timestamp: Date.now(), data });
            expect(getCache('test_key')).toEqual(data);
        });

        it('应返回 null 并删除过期缓存', () => {
            const sevenDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
            store['test_key'] = JSON.stringify({ timestamp: sevenDaysAgo, data: 'old' });
            expect(getCache('test_key')).toBeNull();
        });

        it('应处理损坏的 JSON 数据', () => {
            store['bad_key'] = 'not json';
            expect(getCache('bad_key')).toBeNull();
        });
    });

    describe('setCache', () => {
        it('应存储带时间戳的数据', () => {
            setCache('my_key', { value: 42 });
            const stored = JSON.parse(store['my_key']);
            expect(stored.data).toEqual({ value: 42 });
            expect(stored.timestamp).toBeDefined();
        });
    });

    describe('clearAssetCache', () => {
        it('应清理指定资产名的相关缓存', () => {
            store['news_btc'] = JSON.stringify({ timestamp: Date.now(), data: {} });
            store['ohlc_btc_usdt'] = JSON.stringify({ timestamp: Date.now(), data: {} });
            store['price_btc'] = JSON.stringify({ timestamp: Date.now(), data: {} });
            store['news_eth'] = JSON.stringify({ timestamp: Date.now(), data: {} });

            const removed = clearAssetCache('BTC');
            expect(removed).toBeGreaterThanOrEqual(1);
        });

        it('不应清理无关缓存', () => {
            store['other_data'] = JSON.stringify({ timestamp: Date.now(), data: 'keep' });
            const removed = clearAssetCache('BTC');
            expect(removed).toBe(0);
            expect(store['other_data']).toBeDefined();
        });
    });
});
