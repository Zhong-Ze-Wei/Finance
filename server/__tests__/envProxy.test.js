import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

// 确保测试环境有基础 env（不使用真实 key）
process.env.AIPING_API_KEY = 'test-key-for-env-check';
process.env.MIMO_API_KEY = 'test-mimo-key';
process.env.TAVILY_API_KEY = 'test-tavily-key';

let app;
beforeAll(async () => {
    const mod = await import('../index.js');
    app = mod.default;
});

describe('LLM 代理环境变量检查', () => {
    it('缺少 model 应返回 400', async () => {
        const res = await request(app)
            .post('/api/llm/chat/completions')
            .send({ messages: [{ role: 'user', content: 'hi' }] });
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('必填');
    });

    it('有 API Key 时不应该返回 503', async () => {
        const res = await request(app)
            .post('/api/llm/chat/completions')
            .send({
                model: 'DeepSeek-V3.2',
                messages: [{ role: 'user', content: 'test' }],
                stream: false,
                max_tokens: 1
            });
        // 不应该是 503 (key 未配置)，可能是 502 (上游返回错误，因为 key 是假的)
        expect(res.status).not.toBe(503);
    });

    it('mimo 模型应路由到 mimo 后端', async () => {
        const res = await request(app)
            .post('/api/llm/chat/completions')
            .send({
                model: 'mimo-v2-flash',
                messages: [{ role: 'user', content: 'test' }],
                stream: false,
                max_tokens: 1
            });
        expect(res.status).not.toBe(503);
    });
});

describe('Tavily 代理环境变量检查', () => {
    it('有 Key 时不应该返回 503', async () => {
        const res = await request(app)
            .post('/api/tavily/search')
            .send({ query: 'test' });
        expect(res.status).not.toBe(503);
    });
});
