import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mock MySQL pool
vi.mock('../db/index.js', () => ({
    default: { query: vi.fn() }
}));

vi.mock('bcryptjs', () => ({
    default: {
        hash: vi.fn(() => Promise.resolve('hashed')),
        compare: vi.fn(() => Promise.resolve(true))
    }
}));

vi.mock('uuid', () => ({
    v4: vi.fn(() => 'test-uuid')
}));

// Mock node-fetch for proxy calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('LLM Proxy', () => {
    let app;

    beforeEach(async () => {
        vi.clearAllMocks();
        process.env.MIMO_API_KEY = 'test-mimo-key';
        process.env.AIPING_API_KEY = 'test-aiping-key';
        process.env.TAVILY_API_KEY = 'test-tavily-key';
        const mod = await import('../index.js');
        app = mod.default;
    });

    describe('POST /api/llm/chat/completions', () => {
        it('应代理 LLM 非流式请求并返回结果', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    choices: [{ message: { content: 'Hello' } }]
                })
            });

            const res = await request(app)
                .post('/api/llm/chat/completions')
                .send({ model: 'mimo-v2-flash', messages: [{ role: 'user', content: 'test' }], stream: false })
                .set('Content-Type', 'application/json');

            expect(res.status).toBe(200);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Authorization': expect.stringContaining('Bearer')
                    })
                })
            );
        });

        it('LLM 服务不可用时应返回 502', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests'
            });

            const res = await request(app)
                .post('/api/llm/chat/completions')
                .send({ model: 'test', messages: [] });

            expect(res.status).toBe(502);
        });
    });

    describe('POST /api/tavily/search', () => {
        it('应代理 Tavily 搜索请求', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ results: [{ title: 'Test', url: 'http://test.com' }] })
            });

            const res = await request(app)
                .post('/api/tavily/search')
                .send({ query: 'bitcoin news' });

            expect(res.status).toBe(200);
            expect(res.body.results).toBeDefined();
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('tavily'),
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json'
                    }),
                    body: expect.stringContaining('test-tavily-key')
                })
            );
        });

        it('无 TAVILY_API_KEY 时应返回 503', async () => {
            delete process.env.TAVILY_API_KEY;
            const mod = await import('../index.js');
            const freshApp = mod.default;

            const res = await request(freshApp)
                .post('/api/tavily/search')
                .send({ query: 'test' });

            expect(res.status).toBe(503);
        });
    });
});

// Minimal ReadableStream polyfill for Node test env
class ReadableStream {
    constructor(source) {
        this._source = source;
    }
}
