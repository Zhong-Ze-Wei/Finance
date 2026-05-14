import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import pool from './db/index.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// ========== 认证中间件 ==========
const authMiddleware = async (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: '未登录' });
    }

    const [sessions] = await pool.query(
        'SELECT s.*, u.username, u.nickname FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > NOW()',
        [token]
    );

    if (sessions.length === 0) {
        return res.status(401).json({ error: 'Token 已过期' });
    }

    req.user = { id: sessions[0].user_id, username: sessions[0].username, nickname: sessions[0].nickname };
    next();
};

// ========== 用户认证 API ==========

// 注册
app.post('/api/auth/register', async (req, res) => {
    const { username, password, email, nickname } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码必填' });
    }

    if (username.length < 2 || username.length > 20) {
        return res.status(400).json({ error: '用户名长度 2-20 字符' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: '密码至少 6 位' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
        return res.status(400).json({ error: '用户名已存在' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
        'INSERT INTO users (username, password_hash, email, nickname) VALUES (?, ?, ?, ?)',
        [username, passwordHash, email || null, nickname || username]
    );

    // 自动登录
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7天
    await pool.query(
        'INSERT INTO sessions (user_id, token, expires_at, ip_address) VALUES (?, ?, ?, ?)',
        [result.insertId, token, expiresAt, req.ip]
    );

    res.json({
        success: true,
        user: { id: result.insertId, username, nickname: nickname || username },
        token
    });
});

// 登录
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码必填' });
    }

    const [users] = await pool.query('SELECT * FROM users WHERE username = ? AND is_active = TRUE', [username]);
    if (users.length === 0) {
        return res.status(401).json({ error: '用户名或密码错误' });
    }

    const user = users[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
        return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 清理该用户的过期 session
    await pool.query('DELETE FROM sessions WHERE user_id = ? AND expires_at < NOW()', [user.id]);

    // 创建会话
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
        'INSERT INTO sessions (user_id, token, expires_at, ip_address) VALUES (?, ?, ?, ?)',
        [user.id, token, expiresAt, req.ip]
    );

    // 更新最后登录时间
    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

    res.json({
        success: true,
        user: { id: user.id, username: user.username, nickname: user.nickname, email: user.email },
        token
    });
});

// 登出
app.post('/api/auth/logout', authMiddleware, async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    await pool.query('DELETE FROM sessions WHERE token = ?', [token]);
    res.json({ success: true });
});

// 获取当前用户信息
app.get('/api/auth/me', authMiddleware, async (req, res) => {
    const [users] = await pool.query(
        'SELECT id, username, nickname, email, avatar_url, created_at FROM users WHERE id = ?',
        [req.user.id]
    );
    res.json({ user: users[0] });
});

// ========== 用户设置 API ==========

// 获取所有设置
app.get('/api/settings', authMiddleware, async (req, res) => {
    const [rows] = await pool.query(
        'SELECT setting_key, setting_value FROM user_settings WHERE user_id = ?',
        [req.user.id]
    );

    const settings = {};
    rows.forEach(row => {
        settings[row.setting_key] = row.setting_value;
    });

    res.json({ settings });
});

// 更新设置
app.put('/api/settings/:key', authMiddleware, async (req, res) => {
    const { key } = req.params;
    const { value } = req.body;

    await pool.query(
        `INSERT INTO user_settings (user_id, setting_key, setting_value)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE setting_value = ?`,
        [req.user.id, key, JSON.stringify(value), JSON.stringify(value)]
    );

    res.json({ success: true });
});

// 批量更新设置
app.put('/api/settings', authMiddleware, async (req, res) => {
    const settings = req.body;

    for (const [key, value] of Object.entries(settings)) {
        await pool.query(
            `INSERT INTO user_settings (user_id, setting_key, setting_value)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE setting_value = ?`,
            [req.user.id, key, JSON.stringify(value), JSON.stringify(value)]
        );
    }

    res.json({ success: true });
});

// ========== 资产卡片 API ==========

// 获取所有卡片
app.get('/api/cards', authMiddleware, async (req, res) => {
    const [rows] = await pool.query(
        `SELECT * FROM user_asset_cards WHERE user_id = ? ORDER BY sort_order`,
        [req.user.id]
    );

    const cards = rows.map(row => ({
        id: row.card_id,
        name: row.name,
        symbol: row.symbol,
        priceSource: row.price_source,
        priceId: row.price_id,
        ohlcSource: row.ohlc_source,
        ohlcId: row.ohlc_id,
        newsKeywords: row.news_keywords,
        type: row.type,
        category: row.category,
        position: row.position,
        alert: row.alert,
        visible: row.visible,
        order: row.sort_order,
        isDefault: row.is_default
    }));

    res.json({ cards });
});

// 同步卡片（批量覆盖，事务保护）
app.post('/api/cards/sync', authMiddleware, async (req, res) => {
    const { cards } = req.body;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        await conn.query('DELETE FROM user_asset_cards WHERE user_id = ?', [req.user.id]);

        for (const card of cards) {
            await conn.query(
                `INSERT INTO user_asset_cards
                 (user_id, card_id, name, symbol, price_source, price_id, ohlc_source, ohlc_id,
                  news_keywords, type, category, position, alert, visible, sort_order, is_default)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    req.user.id, card.id, card.name, card.symbol,
                    card.priceSource, card.priceId, card.ohlcSource, card.ohlcId,
                    JSON.stringify(card.newsKeywords), card.type, card.category,
                    JSON.stringify(card.position), JSON.stringify(card.alert),
                    card.visible, card.order, card.isDefault
                ]
            );
        }

        await conn.commit();
        res.json({ success: true, count: cards.length });
    } catch (err) {
        await conn.rollback();
        console.error('Cards sync failed:', err.message);
        res.status(500).json({ error: '卡片同步失败' });
    } finally {
        conn.release();
    }
});

// 添加单个卡片
app.post('/api/cards', authMiddleware, async (req, res) => {
    const card = req.body;

    await pool.query(
        `INSERT INTO user_asset_cards
         (user_id, card_id, name, symbol, price_source, price_id, ohlc_source, ohlc_id,
          news_keywords, type, category, position, alert, visible, sort_order, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            req.user.id, card.id, card.name, card.symbol,
            card.priceSource, card.priceId, card.ohlcSource, card.ohlcId,
            JSON.stringify(card.newsKeywords), card.type, card.category,
            JSON.stringify(card.position), JSON.stringify(card.alert),
            card.visible, card.order, card.isDefault
        ]
    );

    res.json({ success: true, card });
});

// 更新卡片
app.put('/api/cards/:cardId', authMiddleware, async (req, res) => {
    const { cardId } = req.params;
    const updates = req.body;

    const setClauses = [];
    const values = [];

    const fieldMap = {
        name: 'name', symbol: 'symbol', priceSource: 'price_source',
        priceId: 'price_id', ohlcSource: 'ohlc_source', ohlcId: 'ohlc_id',
        newsKeywords: 'news_keywords', type: 'type', category: 'category',
        position: 'position', alert: 'alert', visible: 'visible', order: 'sort_order'
    };

    for (const [key, value] of Object.entries(updates)) {
        if (fieldMap[key]) {
            setClauses.push(`${fieldMap[key]} = ?`);
            values.push(['newsKeywords', 'position', 'alert'].includes(key) ? JSON.stringify(value) : value);
        }
    }

    if (setClauses.length > 0) {
        values.push(req.user.id, cardId);
        await pool.query(
            `UPDATE user_asset_cards SET ${setClauses.join(', ')} WHERE user_id = ? AND card_id = ?`,
            values
        );
    }

    res.json({ success: true });
});

// 删除卡片
app.delete('/api/cards/:cardId', authMiddleware, async (req, res) => {
    const { cardId } = req.params;
    await pool.query('DELETE FROM user_asset_cards WHERE user_id = ? AND card_id = ?', [req.user.id, cardId]);
    res.json({ success: true });
});

// ========== 提醒邮箱 API ==========

// 获取邮箱列表
app.get('/api/emails', authMiddleware, async (req, res) => {
    const [rows] = await pool.query(
        'SELECT email, is_primary, verified FROM user_emails WHERE user_id = ?',
        [req.user.id]
    );
    res.json({ emails: rows });
});

// 添加邮箱
app.post('/api/emails', authMiddleware, async (req, res) => {
    const { email } = req.body;

    const [existing] = await pool.query(
        'SELECT COUNT(*) as count FROM user_emails WHERE user_id = ?',
        [req.user.id]
    );

    if (existing[0].count >= 3) {
        return res.status(400).json({ error: '最多只能添加 3 个邮箱' });
    }

    await pool.query(
        'INSERT INTO user_emails (user_id, email) VALUES (?, ?)',
        [req.user.id, email]
    );

    res.json({ success: true });
});

// 删除邮箱
app.delete('/api/emails/:email', authMiddleware, async (req, res) => {
    const { email } = req.params;
    await pool.query(
        'DELETE FROM user_emails WHERE user_id = ? AND email = ?',
        [req.user.id, email]
    );
    res.json({ success: true });
});

// ========== 健康检查 + Session 清理 ==========
app.get('/api/health', async (req, res) => {
    // 顺带清理所有过期 session
    try {
        await pool.query('DELETE FROM sessions WHERE expires_at < NOW()');
    } catch (e) {
        console.warn('Session cleanup failed:', e.message);
    }
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// ========== LLM API 代理 ==========
// 将前端 LLM 请求代理到实际 LLM 服务，API Key 仅存于服务端

const LLM_PROXY_CONFIGS = {
    mimo: {
        baseUrl: process.env.MIMO_BASE_URL || 'https://api.xiaomimimo.com/v1',
        apiKey: process.env.MIMO_API_KEY || ''
    },
    aiping: {
        baseUrl: process.env.AIPING_BASE_URL || 'https://www.aiping.cn/api/v1',
        apiKey: process.env.AIPING_API_KEY || ''
    }
};

// 根据请求中的 model 字段选择对应的 LLM 后端
const resolveLLMBackend = (model) => {
    // mimo 系列走 mimo 配置
    if (model && model.toLowerCase().includes('mimo')) {
        return LLM_PROXY_CONFIGS.mimo;
    }
    // 其他模型默认走 aiping
    return LLM_PROXY_CONFIGS.aiping;
};

app.post('/api/llm/chat/completions', async (req, res) => {
    const { model, messages, stream = true, ...rest } = req.body;

    if (!model || !messages) {
        return res.status(400).json({ error: 'model 和 messages 必填' });
    }

    const backend = resolveLLMBackend(model);
    if (!backend.apiKey) {
        return res.status(503).json({ error: 'LLM API Key 未配置' });
    }

    try {
        const targetUrl = `${backend.baseUrl}/chat/completions`;
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${backend.apiKey}`
            },
            body: JSON.stringify({ model, messages, stream, ...rest })
        });

        if (!response.ok) {
            console.error(`LLM proxy error: ${response.status} ${response.statusText}`);
            return res.status(502).json({
                error: `LLM 服务返回 ${response.status}`,
                upstreamStatus: response.status
            });
        }

        // 流式响应 - 转发 SSE
        if (stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            const pump = async () => {
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        res.write(decoder.decode(value, { stream: true }));
                    }
                } catch (err) {
                    console.error('LLM stream error:', err.message);
                } finally {
                    res.end();
                }
            };
            pump();
        } else {
            const data = await response.json();
            res.json(data);
        }
    } catch (err) {
        console.error('LLM proxy failed:', err.message);
        res.status(500).json({ error: 'LLM 服务请求失败' });
    }
});

// ========== Tavily API 代理 ==========

app.post('/api/tavily/search', async (req, res) => {
    const tavilyApiKey = process.env.TAVILY_API_KEY;
    if (!tavilyApiKey) {
        return res.status(503).json({ error: 'Tavily API Key 未配置' });
    }

    const { query, ...rest } = req.body;
    if (!query) {
        return res.status(400).json({ error: 'query 必填' });
    }

    try {
        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, api_key: tavilyApiKey, ...rest })
        });

        if (!response.ok) {
            console.error(`Tavily proxy error: ${response.status}`);
            return res.status(502).json({ error: `Tavily 服务返回 ${response.status}` });
        }

        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('Tavily proxy failed:', err.message);
        res.status(500).json({ error: 'Tavily 服务请求失败' });
    }
});

export default app;

// 启动服务（测试环境跳过）
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
}
