import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const mockPoolQuery = vi.fn();
vi.mock('../db/index.js', () => ({
    default: { query: (...args) => mockPoolQuery(...args) }
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

describe('Session 清理', () => {
    let app;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockPoolQuery.mockResolvedValue([[]]);
        const mod = await import('../index.js');
        app = mod.default;
    });

    it('登录时应清理该用户的过期 session', async () => {
        mockPoolQuery
            .mockResolvedValueOnce([[{ id: 1, username: 'test', password_hash: 'h', nickname: 'T', is_active: true }]]) // 用户查询
            .mockResolvedValueOnce([{ affectedRows: 3 }]) // 清理过期 session
            .mockResolvedValueOnce([{ insertId: 100 }])    // 创建新 session
            .mockResolvedValueOnce([[]]);                   // 更新登录时间

        await request(app)
            .post('/api/auth/login')
            .send({ username: 'test', password: 'pass123' });

        // 第二次 query 应该是清理过期 session
        const cleanupCall = mockPoolQuery.mock.calls[1];
        expect(cleanupCall[0]).toContain('DELETE FROM sessions');
        expect(cleanupCall[0]).toContain('expires_at < NOW()');
    });

    it('健康检查应触发全量过期 session 清理', async () => {
        mockPoolQuery.mockResolvedValue([{ affectedRows: 5 }]);

        const res = await request(app).get('/api/health');

        expect(res.status).toBe(200);
        // 应该有一次清理全部过期 session 的调用
        const cleanupCall = mockPoolQuery.mock.calls.find(
            c => c[0].includes('DELETE FROM sessions') && c[0].includes('expires_at < NOW()')
        );
        expect(cleanupCall).toBeDefined();
    });
});
