import 'dotenv/config';
import path from 'node:path';
import https from 'node:https';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { callProvider, fetchProviderModels, testProviderConnection } from './aiProviders.js';
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

// ========== AI 供应商配置（自定义模型供应商，Key 存库不外显） ==========

// 内置供应商（凭据来自 .env，接口层与自定义供应商同构，key 永不返回）
const builtinProviders = () => ([
    {
        id: 'builtin-aiping',
        userId: null,
        name: 'AIPing（内置）',
        baseUrl: LLM_PROXY_CONFIGS.aiping.baseUrl,
        apiKey: LLM_PROXY_CONFIGS.aiping.apiKey,
        protocol: 'openai-compatible',
        models: [
            'GLM-5.3-Flash', 'GLM-5.3', 'GLM-5.2', 'GLM-5-Turbo',
            'DeepSeek-V4.1-Flash', 'DeepSeek-V4-Flash', 'DeepSeek-V4-Pro',
            'Kimi-K2.6', 'MiniMax-M2.7', 'MiMo-V2.6-Flash', 'MiMo-V2.6-Pro',
            'Qwen3.5-Plus', 'Qwen3.7-Max', 'Step-3.5-Flash',
        ],
        enabled: true,
        builtin: true,
    },
].filter(p => p.apiKey));

// API 返回视图：key 脱敏
const providerView = (p) => ({
    id: p.id,
    name: p.name,
    baseUrl: p.baseUrl,
    protocol: p.protocol,
    useProxy: !!p.useProxy,
    models: p.models,
    enabled: !!p.enabled,
    builtin: !!p.builtin,
    hasKey: !!p.apiKey,
    keyHint: p.apiKey ? `****${p.apiKey.slice(-4)}` : null,
});

// mysql2 会把 JSON 列自动反序列化，兼容字符串/数组两种形态
const parseModels = (m) => (typeof m === 'string' ? JSON.parse(m || '[]') : (Array.isArray(m) ? m : []));

// 供应商 id → 完整配置（含 key，统一为 camelCase 供协议层使用）
const findProvider = async (userId, providerId) => {
    const builtin = builtinProviders().find(p => p.id === providerId);
    if (builtin) return builtin;
    const [rows] = await pool.query('SELECT * FROM ai_providers WHERE id = ? AND user_id = ?', [providerId, userId]);
    const row = rows[0];
    if (!row || !row.enabled) return null;
    return {
        id: row.id,
        name: row.name,
        baseUrl: row.base_url,
        apiKey: row.api_key,
        protocol: row.protocol,
        useProxy: !!row.use_proxy,
        models: parseModels(row.models),
        enabled: !!row.enabled,
    };
};

app.get('/api/ai/providers', authMiddleware, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM ai_providers WHERE user_id = ? ORDER BY created_at', [req.user.id]);
        const customs = rows.map(r => ({
            id: r.id,
            name: r.name,
            baseUrl: r.base_url,
            apiKey: r.api_key,
            protocol: r.protocol,
            useProxy: !!r.use_proxy,
            models: parseModels(r.models),
            enabled: !!r.enabled,
        }));
        res.json([...builtinProviders().map(providerView), ...customs.map(providerView)]);
    } catch (err) {
        console.error('List providers failed:', err.message);
        res.status(500).json({ error: '获取供应商列表失败' });
    }
});

app.post('/api/ai/providers', authMiddleware, async (req, res) => {
    const { name, baseUrl, apiKey, protocol = 'auto', useProxy = false, models = [], enabled = true } = req.body;
    if (!name || !baseUrl || !apiKey) {
        return res.status(400).json({ error: 'name、baseUrl、apiKey 必填' });
    }
    const id = uuidv4();
    try {
        await pool.query(
            'INSERT INTO ai_providers (id, user_id, name, base_url, api_key, protocol, use_proxy, models, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, req.user.id, name, baseUrl, apiKey, protocol, useProxy, JSON.stringify(models), enabled]
        );
        const created = await findProvider(req.user.id, id);
        res.status(201).json(providerView(created));
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: '同名供应商已存在' });
        console.error('Create provider failed:', err.message);
        res.status(500).json({ error: '创建供应商失败' });
    }
});

app.put('/api/ai/providers/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { name, baseUrl, apiKey, protocol, useProxy, models, enabled } = req.body;
    try {
        const existing = await findProvider(req.user.id, id);
        if (!existing || existing.builtin) return res.status(404).json({ error: '供应商不存在或不可修改' });

        await pool.query(
            'UPDATE ai_providers SET name = ?, base_url = ?, api_key = ?, protocol = ?, use_proxy = ?, models = ?, enabled = ? WHERE id = ? AND user_id = ?',
            [
                name ?? existing.name,
                baseUrl ?? existing.baseUrl,
                apiKey || existing.apiKey,   // key 传空表示不变
                protocol ?? existing.protocol,
                useProxy ?? existing.useProxy,
                JSON.stringify(models ?? existing.models),
                enabled ?? existing.enabled,
                id, req.user.id,
            ]
        );
        const updated = await findProvider(req.user.id, id);
        res.json(providerView(updated));
    } catch (err) {
        console.error('Update provider failed:', err.message);
        res.status(500).json({ error: '更新供应商失败' });
    }
});

app.delete('/api/ai/providers/:id', authMiddleware, async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM ai_providers WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (!result.affectedRows) return res.status(404).json({ error: '供应商不存在' });
        res.json({ ok: true });
    } catch (err) {
        console.error('Delete provider failed:', err.message);
        res.status(500).json({ error: '删除供应商失败' });
    }
});

// 连接测试（区分 认证/网络/协议/模型 错误）
app.post('/api/ai/providers/test', authMiddleware, async (req, res) => {
    // 支持两种用法：已保存的传 id；未保存的直接传表单内容（{baseUrl, apiKey, protocol, name}）
    const body = req.body.id ? await findProvider(req.user.id, req.body.id) : req.body;
    if (!body || !body.baseUrl || !body.apiKey) {
        return res.status(400).json({ error: '缺少 baseUrl 或 apiKey' });
    }
    const result = await testProviderConnection(body, req.body.testModel);
    res.json(result);
});

// 拉取供应商模型列表（GET {base}/models）
app.post('/api/ai/providers/models', authMiddleware, async (req, res) => {
    const body = req.body.id ? await findProvider(req.user.id, req.body.id) : req.body;
    if (!body || !body.baseUrl || !body.apiKey) {
        return res.status(400).json({ error: '缺少 baseUrl 或 apiKey' });
    }
    try {
        const { protocol, models } = await fetchProviderModels(body);
        res.json({ protocol, models });
    } catch (e) {
        const result = await testProviderConnection(body);
        res.status(502).json(result);
    }
});

app.post('/api/llm/chat/completions', async (req, res) => {
    const { model, messages, stream = true, providerId, reasoning, ...rest } = req.body;

    if (!model || !messages) {
        return res.status(400).json({ error: 'model 和 messages 必填' });
    }

    // 统一模型调用入口：providerId 指定自定义/内置供应商；缺省时按模型名路由内置渠道（兼容旧调用）
    let provider = null;
    if (providerId) {
        // 内置供应商无需登录；自定义供应商挂在用户名下，需要登录态
        const builtin = builtinProviders().find(p => p.id === providerId);
        if (builtin) {
            provider = builtin;
        } else {
            const authHeader = req.headers.authorization?.replace('Bearer ', '');
            if (!authHeader) return res.status(401).json({ error: '使用自定义供应商需要登录' });
            const [sessions] = await pool.query(
                'SELECT user_id FROM sessions WHERE token = ? AND expires_at > NOW()', [authHeader]
            );
            if (!sessions.length) return res.status(401).json({ error: '登录已过期' });
            provider = await findProvider(sessions[0].user_id, providerId);
            if (!provider) return res.status(404).json({ error: '供应商不存在或已停用' });
        }
    }

    try {
        let response;
        if (provider) {
            const body = { model, messages, stream, reasoning, ...rest };
            response = await callProvider(provider, body);
            // 思考等级不被模型支持时（400）去掉参数重试一次并提示
            if (response.status === 400 && reasoning && reasoning !== 'off') {
                console.warn(`[ai-provider] ${provider.name} 不支持思考等级 ${reasoning}，已降级重试`);
                res.setHeader('X-Reasoning-Degraded', 'true');
                response = await callProvider(provider, { ...body, reasoning: 'off' });
            }
        } else {
            const backend = resolveLLMBackend(model);
            if (!backend.apiKey) {
                return res.status(503).json({ error: 'LLM API Key 未配置' });
            }
            response = await fetch(`${backend.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${backend.apiKey}`
                },
                body: JSON.stringify({ model, messages, stream, ...rest })
            });
        }

        if (!response.ok) {
            console.error(`LLM proxy error: ${response.status} ${response.statusText}`);
            // 参数/鉴权/资源类 4xx 说明代理链路本身是通的（如健康检查的假模型名），透传原状态码
            if ([400, 401, 404, 422].includes(response.status)) {
                return res.status(response.status).json({ error: `LLM 服务返回 ${response.status}` });
            }
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

// ========== 外部数据源代理（原 Vite dev 代理的服务端化，生产模式下由后端统一转发） ==========
// 境外源经 VPN_PROXY（容器内默认指向宿主 Clash）；中文/国内可直连站点不走代理
const vpnAgent = new HttpsProxyAgent(process.env.VPN_PROXY || 'http://host.docker.internal:7891');

const DATA_SOURCE_RULES = [
    // 境外数据源 —— 走梯子
    { prefix: '/api/coingecko', target: 'https://api.coingecko.com', rewrite: p => p.replace(/^\/api\/coingecko/, '/api/v3'), vpn: true },
    { prefix: '/api/okx', target: 'https://www.okx.com', rewrite: p => p.replace(/^\/api\/okx/, '/api/v5'), vpn: true },
    { prefix: '/api/binance', target: 'https://api.binance.com', rewrite: p => p.replace(/^\/api\/binance/, '/api/v3'), vpn: true },
    { prefix: '/api/yahoo', target: 'https://query1.finance.yahoo.com', rewrite: p => p.replace(/^\/api\/yahoo/, ''), vpn: true },
    { prefix: '/api/rss/google', target: 'https://news.google.com', rewrite: p => p.replace(/^\/api\/rss\/google/, '/rss'), vpn: true },
    { prefix: '/api/gnews-redirect', target: 'https://news.google.com', rewrite: p => p.replace(/^\/api\/gnews-redirect/, ''), vpn: true, follow: true },
    { prefix: '/api/resend', target: 'https://api.resend.com', rewrite: p => p.replace(/^\/api\/resend/, ''), vpn: true },
    { prefix: '/api/jina', target: 'https://r.jina.ai', rewrite: p => p.replace(/^\/api\/jina/, ''), vpn: true },
    // 中文站点/国内可直连 —— 不走代理
    { prefix: '/api/sina/roll', target: 'https://feed.mix.sina.com.cn', rewrite: p => p.replace(/^\/api\/sina\/roll/, '') },
    { prefix: '/api/sina', target: 'https://hq.sinajs.cn', rewrite: p => p.replace(/^\/api\/sina/, ''), headers: { Referer: 'https://finance.sina.com.cn' } },
    { prefix: '/api/rss/ct', target: 'https://cointelegraph.com', rewrite: p => p.replace(/^\/api\/rss\/ct/, '/rss') },
];

const forwardDataSource = (req, res, rule) => {
    const doRequest = (url, depth) => {
        if (depth > 5) return res.status(502).json({ error: '重定向次数过多' });
        const upstream = https.get(url, {
            agent: rule.vpn ? vpnAgent : undefined,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', ...(rule.headers || {}) },
            timeout: 15000,
        }, (up) => {
            if ([301, 302, 303, 307, 308].includes(up.statusCode) && up.headers.location && rule.follow) {
                up.resume();
                return doRequest(new URL(up.headers.location, url).href, depth + 1);
            }
            res.status(up.statusCode);
            res.setHeader('Content-Type', up.headers['content-type'] || 'application/octet-stream');
            up.pipe(res);
        });
        upstream.on('timeout', () => upstream.destroy(new Error('上游超时')));
        upstream.on('error', (e) => {
            console.error(`数据源代理失败 [${rule.prefix}]:`, e.message);
            if (!res.headersSent) res.status(502).json({ error: `数据源请求失败: ${e.message}` });
            else res.end();
        });
    };
    doRequest(rule.target + rule.rewrite(req.originalUrl), 0);
};

for (const rule of DATA_SOURCE_RULES) {
    app.use(rule.prefix, (req, res) => forwardDataSource(req, res, rule));
}

// ========== 前端静态托管（Docker 生产模式：后端直接服务前端构建产物） ==========
// 本地开发时该目录不存在，前端由 Vite dev server 独立提供，此块不生效
const frontendDist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'dist');
if (existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    // SPA 路由回退：非 /api 请求统一返回 index.html
    app.get('*', (req, res) => {
        res.sendFile(path.join(frontendDist, 'index.html'));
    });
}

export default app;

// 启动服务（测试环境跳过）
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
}
