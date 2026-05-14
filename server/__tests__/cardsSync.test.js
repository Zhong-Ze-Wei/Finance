import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mock MySQL — 追踪事务行为
const mockConnection = {
    query: vi.fn(),
    release: vi.fn(),
    beginTransaction: vi.fn(),
    commit: vi.fn(),
    rollback: vi.fn()
};

const mockPoolQuery = vi.fn();
const mockPool = {
    query: (...args) => mockPoolQuery(...args),
    getConnection: vi.fn(() => Promise.resolve(mockConnection))
};

vi.mock('../db/index.js', () => ({
    get default() { return mockPool; }
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

describe('Cards Sync 事务安全', () => {
    let app;

    beforeEach(async () => {
        vi.clearAllMocks();

        // 默认: 认证通过 (sessions 查询返回有效会话)
        mockPoolQuery.mockImplementation((sql) => {
            if (sql.includes('SELECT s.*')) {
                return [[{ user_id: 1, username: 'test', nickname: 'Test' }]];
            }
            return [[]];
        });

        // 默认: 连接事务全部成功
        mockConnection.beginTransaction.mockResolvedValue(undefined);
        mockConnection.commit.mockResolvedValue(undefined);
        mockConnection.rollback.mockResolvedValue(undefined);
        mockConnection.release.mockReturnValue(undefined);
        mockConnection.query.mockResolvedValue([{ affectedRows: 1 }]);

        const mod = await import('../index.js');
        app = mod.default;
    });

    it('成功同步应使用事务 (beginTransaction + commit)', async () => {
        const cards = [
            { id: 'c1', name: 'BTC', symbol: 'BTC', priceSource: 'coingecko', priceId: 'bitcoin',
              ohlcSource: 'okx', ohlcId: 'BTC-USDT', newsKeywords: ['bitcoin'],
              type: 'crypto', category: 'crypto', position: null, alert: null,
              visible: true, order: 0, isDefault: true }
        ];

        const res = await request(app)
            .post('/api/cards/sync')
            .set('Authorization', 'Bearer valid-token')
            .send({ cards });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(mockConnection.beginTransaction).toHaveBeenCalled();
        expect(mockConnection.commit).toHaveBeenCalled();
        expect(mockConnection.release).toHaveBeenCalled();
    });

    it('INSERT 失败时应 rollback 而非 commit', async () => {
        mockConnection.query
            .mockResolvedValueOnce([{ affectedRows: 1 }])     // DELETE 成功
            .mockRejectedValueOnce(new Error('Duplicate key')); // INSERT 失败

        const cards = [
            { id: 'c1', name: 'BTC', symbol: 'BTC' }
        ];

        const res = await request(app)
            .post('/api/cards/sync')
            .set('Authorization', 'Bearer valid-token')
            .send({ cards });

        expect(res.status).toBe(500);
        expect(mockConnection.rollback).toHaveBeenCalled();
        expect(mockConnection.commit).not.toHaveBeenCalled();
        expect(mockConnection.release).toHaveBeenCalled();
    });

    it('空数组应成功清空卡片', async () => {
        const res = await request(app)
            .post('/api/cards/sync')
            .set('Authorization', 'Bearer valid-token')
            .send({ cards: [] });

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(0);
    });
});
