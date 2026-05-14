import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

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

vi.stubGlobal('import.meta', { env: {} });

describe('OHLC 数据竞态保护', () => {
    let fetchOHLCData, fetchOHLCByAsset;

    beforeEach(async () => {
        localStorageMock.clear();
        vi.clearAllMocks();
        vi.resetModules();

        // 动态导入确保 mock 生效
        const api = await import('../api.js');
        fetchOHLCData = api.fetchOHLCData;
        fetchOHLCByAsset = api.fetchOHLCByAsset;
    });

    describe('fetchOHLCByAsset', () => {
        it('null asset 应返回空数组', async () => {
            const result = await fetchOHLCByAsset(null);
            expect(result).toEqual([]);
        });

        it('undefined asset 应返回空数组', async () => {
            const result = await fetchOHLCByAsset(undefined);
            expect(result).toEqual([]);
        });
    });

    describe('fetchOHLCData', () => {
        it('OKX 成功时应返回 OHLC 数据', async () => {
            const mockCandles = [
                ['1700000000000', '42000', '42500', '41800', '42300', '100'],
                ['1700003600000', '42300', '42800', '42200', '42600', '150'],
            ];

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ code: '0', data: mockCandles })
            });

            const result = await fetchOHLCData('BTC', '1H');
            expect(result.length).toBeGreaterThanOrEqual(2);
            expect(result[0]).toHaveProperty('time');
            expect(result[0]).toHaveProperty('open');
            expect(result[0]).toHaveProperty('close');
        });

        it('OKX 失败时应 fallback 到 Binance', async () => {
            // OKX 失败
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ code: '50001', msg: 'error' })
            });

            // Binance 成功
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ([ [1700000000000, '42000', '42500', '41800', '42300', '100'] ])
            });

            const result = await fetchOHLCData('BTC', '1H');
            expect(result.length).toBeGreaterThanOrEqual(1);
        });

        it('所有源失败时应抛出异常', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));
            await expect(fetchOHLCData('UNKNOWN', '1H', 10)).rejects.toThrow('Failed to fetch OHLC data');
        });
    });
});
