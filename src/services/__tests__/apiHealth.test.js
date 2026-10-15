import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock import.meta.env
vi.stubGlobal('import.meta', {
    env: {
        VITE_EMAILJS_SERVICE_ID: 'test_service',
        VITE_EMAILJS_TEMPLATE_ID: 'test_template',
        VITE_EMAILJS_PUBLIC_KEY: 'test_key',
    }
});

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: vi.fn((key) => store[key] || null),
        setItem: vi.fn((key, val) => { store[key] = val; }),
        removeItem: vi.fn((key) => { delete store[key]; }),
        clear: () => { store = {}; }
    };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock performance.now
let fakeNow = 0;
vi.stubGlobal('performance', { now: () => { fakeNow += 100; return fakeNow; } });

describe('apiHealth', () => {
    let checkApiHealth, checkAllApiHealth;

    beforeEach(async () => {
        mockFetch.mockReset();
        localStorageMock.clear();
        fakeNow = 0;
        // 动态 import 确保每次用最新的 mock
        const mod = await import('../apiHealth.js');
        checkApiHealth = mod.checkApiHealth;
        checkAllApiHealth = mod.checkAllApiHealth;
    });

    // ===== 单个 API 检测 =====

    describe('checkApiHealth', () => {
        it('CoinGecko - 成功时返回 ok', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true });
            const result = await checkApiHealth('coingecko');
            expect(result.status).toBe('ok');
            expect(result.latency).toBeGreaterThanOrEqual(0);
            expect(result.error).toBeUndefined();
        });

        it('CoinGecko - 应调用 /api/coingecko/ping', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true });
            await checkApiHealth('coingecko');
            expect(mockFetch).toHaveBeenCalledWith('/api/coingecko/ping', expect.objectContaining({ signal: expect.any(AbortSignal) }));
        });

        it('OKX - code=0 时返回 ok', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ code: '0', data: [{ last: '100000' }] })
            });
            const result = await checkApiHealth('okx');
            expect(result.status).toBe('ok');
        });

        it('OKX - code!=0 时返回 error', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ code: '50001', msg: 'Invalid instId' })
            });
            const result = await checkApiHealth('okx');
            expect(result.status).toBe('error');
            expect(result.error).toContain('Invalid');
        });

        it('Yahoo Finance - 成功时返回 ok', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ chart: { result: [{ meta: {} }] } })
            });
            const result = await checkApiHealth('yahooFinance');
            expect(result.status).toBe('ok');
        });

        it('Yahoo Finance - 响应格式错误时返回 error', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ chart: { result: null } })
            });
            const result = await checkApiHealth('yahooFinance');
            expect(result.status).toBe('error');
        });

        it('新浪财经 - 响应含 hq_str_ 时返回 ok', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: async () => 'var hq_str_sh600519="贵州茅台,1850.00,..."'
            });
            const result = await checkApiHealth('sinaFinance');
            expect(result.status).toBe('ok');
        });

        it('新浪财经 - 响应格式错误时返回 error', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: async () => 'invalid response'
            });
            const result = await checkApiHealth('sinaFinance');
            expect(result.status).toBe('error');
        });

        it('Google News - 成功时返回 ok', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true });
            const result = await checkApiHealth('googleNews');
            expect(result.status).toBe('ok');
        });

        it('未知 API key 返回 error', async () => {
            const result = await checkApiHealth('unknownApi');
            expect(result.status).toBe('error');
            expect(result.error).toContain('Unknown');
        });

        it('网络错误时返回 error 和错误信息', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));
            const result = await checkApiHealth('coingecko');
            expect(result.status).toBe('error');
            expect(result.error).toBe('Network error');
            expect(result.latency).toBeGreaterThanOrEqual(0);
        });

        it('HTTP 非 200 时返回 error', async () => {
            mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });
            const result = await checkApiHealth('coingecko');
            expect(result.status).toBe('error');
            expect(result.error).toContain('429');
        });
    });

    // ===== 批量检测 =====

    describe('checkAllApiHealth', () => {
        it('应返回 9 个 API 的检测结果', async () => {
            // 为所有 fetch 请求返回通用成功响应
            mockFetch.mockImplementation(() => Promise.resolve({
                ok: true,
                json: async () => ({ chart: { result: [{}] } }),
                text: async () => 'var hq_str_=ok'
            }));

            const results = await checkAllApiHealth();
            expect(Object.keys(results)).toHaveLength(8);
        });

        it('应通过 onProgress 回调逐个报告结果', async () => {
            mockFetch.mockImplementation(() => Promise.resolve({
                ok: true,
                json: async () => ({ code: '0' }),
                text: async () => 'var hq_str_=ok'
            }));

            const progressCalls = [];
            const onProgress = (key, result) => {
                progressCalls.push({ key, result });
            };

            await checkAllApiHealth(onProgress);

            expect(progressCalls).toHaveLength(8);
            progressCalls.forEach(call => {
                expect(call.result).toHaveProperty('status');
                expect(call.result).toHaveProperty('latency');
            });
        });
    });
});
