import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mock MySQL pool before importing app
vi.mock('../db/index.js', () => ({
    default: {
        query: vi.fn()
    }
}));

// Mock bcryptjs (register/login use it)
vi.mock('bcryptjs', () => ({
    default: {
        hash: vi.fn(() => Promise.resolve('hashed_password')),
        compare: vi.fn(() => Promise.resolve(true))
    }
}));

// Mock uuid
vi.mock('uuid', () => ({
    v4: vi.fn(() => 'test-uuid-1234')
}));

describe('Health Check', () => {
    let app;

    beforeEach(async () => {
        vi.clearAllMocks();
        const mod = await import('../index.js');
        app = mod.default;
    });

    it('GET /api/health 应返回 ok', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.time).toBeDefined();
    });

    it('GET /api/health time 应为合法 ISO 格式', async () => {
        const res = await request(app).get('/api/health');
        expect(new Date(res.body.time).toISOString()).toBe(res.body.time);
    });
});
