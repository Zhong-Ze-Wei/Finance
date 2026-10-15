// aiProviders.js - AI 供应商协议层
// OpenAI Compatible 直转 + Anthropic 协议转换（含流式 SSE 转 OpenAI 格式）
// 思考等级（off/low/medium/high）按协议映射，不支持时由调用方降级重试
import { fetch as undiciFetch, ProxyAgent } from 'undici';

// 容器内运行时，本机地址（localhost/127.0.0.1）指宿主机服务，需改写为 host.docker.internal
const normalizeBaseUrl = (url) => {
    if (process.env.RUNNING_IN_DOCKER === '1') {
        return url.replace(/^(https?:\/\/)(localhost|127\.0\.0\.1)(?=:)/, '$1host.docker.internal');
    }
    return url;
};

// 出站请求选项：供应商声明 useProxy 时经 VPN_PROXY 代理（境外源）
const outboundOptions = (provider) => {
    if (!provider?.useProxy) return {};
    const proxyUrl = process.env.VPN_PROXY || 'http://host.docker.internal:7891';
    return { dispatcher: new ProxyAgent(proxyUrl) };
};

// 思考等级 → 协议参数
export const thinkingParams = (level, protocol) => {
    if (!level || level === 'off') return null;
    if (protocol === 'anthropic') {
        const budget = { low: 1024, medium: 4096, high: 16384 }[level];
        return { thinking: { type: 'enabled', budget_tokens: budget } };
    }
    // OpenAI Compatible：reasoning_effort（模型不支持时上游通常忽略）
    return { reasoning_effort: level };
};

// Anthropic 要求 max_tokens 大于 thinking 预算
const resolveMaxTokens = (maxTokens, thinking) => {
    const base = maxTokens || 8192;
    return thinking ? Math.max(base, thinking.thinking.budget_tokens + 1024) : base;
};

const buildHeaders = (protocol, apiKey) => protocol === 'anthropic'
    ? { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
    : { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };

// ========== OpenAI Compatible：请求体直转，SSE 原样透传 ==========
export const callOpenAI = async ({ baseUrl, apiKey, body, signal, useProxy }) => {
    const url = `${normalizeBaseUrl(baseUrl).replace(/\/$/, '')}/chat/completions`;
    return undiciFetch(url, {
        method: 'POST',
        headers: buildHeaders('openai', apiKey),
        body: JSON.stringify(body),
        signal,
        ...outboundOptions({ useProxy }),
    });
};

// ========== Anthropic：请求/响应双向转换 ==========
export const callAnthropic = async ({ baseUrl, apiKey, body, signal, useProxy }) => {
    const { model, messages, stream, thinking, max_tokens, temperature } = body;
    const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
    const chat = messages.filter(m => m.role !== 'system');

    const payload = {
        model,
        messages: chat,
        stream: !!stream,
        max_tokens: resolveMaxTokens(max_tokens, thinking),
    };
    if (system) payload.system = system;
    if (thinking) Object.assign(payload, thinking);
    if (temperature != null) payload.temperature = temperature;

    const url = `${normalizeBaseUrl(baseUrl).replace(/\/$/, '')}/messages`;
    const res = await undiciFetch(url, {
        method: 'POST',
        headers: buildHeaders('anthropic', apiKey),
        body: JSON.stringify(payload),
        signal,
        ...outboundOptions({ useProxy }),
    });

    if (!res.ok) return res;

    if (!stream) {
        const data = await res.json();
        const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
        const reasoning = (data.content || []).filter(b => b.type === 'thinking').map(b => b.thinking).join('');
        return new Response(JSON.stringify({
            id: data.id,
            model: data.model,
            choices: [{
                index: 0,
                message: { role: 'assistant', content: text, reasoning_content: reasoning || undefined },
                finish_reason: data.stop_reason,
            }],
            usage: data.usage,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // 流式：Anthropic 事件流 → OpenAI delta 流
    const {Readable, Transform} = await import('node:stream');
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const transform = new Transform({
        transform(chunk, _, cb) {
            this._buf = (this._buf || '') + decoder.decode(chunk, { stream: true });
            const lines = this._buf.split('\n');
            this._buf = lines.pop();
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data: ')) continue;
                const payload = trimmed.slice(6);
                if (payload === '[DONE]') continue;
                try {
                    const ev = JSON.parse(payload);
                    const delta = {};
                    if (ev.type === 'content_block_delta') {
                        if (ev.delta?.type === 'text_delta') delta.content = ev.delta.text;
                        else if (ev.delta?.type === 'thinking_delta') delta.reasoning_content = ev.delta.thinking;
                    } else if (ev.type === 'message_start') {
                        delta.role = 'assistant';
                    }
                    if (Object.keys(delta).length) {
                        this.push(encoder.encode(`data: ${JSON.stringify({ id: ev.message?.id, model: ev.message?.model, choices: [{ index: 0, delta }] })}\n\n`));
                    }
                    if (ev.type === 'message_stop') {
                        this.push(encoder.encode('data: [DONE]\n\n'));
                    }
                } catch { /* 跳过不完整分片 */ }
            }
            cb();
        },
    });

    const nodeStream = Readable.fromWeb(res.body).pipe(transform);
    return new Response(Readable.toWeb(nodeStream), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });
};

// 统一调用入口（协议分发 + 思考等级注入）
export const callProvider = async (provider, body, signal) => {
    const thinking = thinkingParams(body.reasoning, provider.protocol);
    const fullBody = { ...body };
    delete fullBody.reasoning;
    delete fullBody.providerId;
    if (thinking) Object.assign(fullBody, thinking);

    return provider.protocol === 'anthropic'
        ? callAnthropic({ baseUrl: provider.baseUrl, apiKey: provider.apiKey, body: fullBody, signal, useProxy: provider.useProxy })
        : callOpenAI({ baseUrl: provider.baseUrl, apiKey: provider.apiKey, body: fullBody, signal, useProxy: provider.useProxy });
};

// ========== 模型列表拉取（GET {base}/models，两种协议头都试） ==========
export const fetchProviderModels = async (provider) => {
    const url = `${normalizeBaseUrl(provider.baseUrl).replace(/\/$/, '')}/models`;
    const attempts = provider.protocol === 'auto'
        ? ['openai-compatible', 'anthropic']
        : [provider.protocol];

    let lastError = null;
    for (const proto of attempts) {
        try {
            const res = await undiciFetch(url, { headers: buildHeaders(proto === 'anthropic' ? 'anthropic' : 'openai', provider.apiKey), ...outboundOptions(provider) });
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    throw Object.assign(new Error('认证失败'), { errorType: 'auth' });
                }
                continue; // 其他状态码换下一种协议尝试
            }
            const data = await res.json().catch(() => null);
            const models = data?.data?.map(m => m.id).filter(Boolean) || [];
            if (models.length) return { protocol: proto, models };
            lastError = Object.assign(new Error('响应中没有模型列表'), { errorType: 'protocol' });
        } catch (e) {
            if (e.errorType === 'auth') throw e;
            lastError = e; // 网络/解析异常：记录后继续尝试，最终以最后的错误分类
        }
    }
    throw lastError || Object.assign(new Error('无法获取模型列表（协议不兼容或网络不可达）'), { errorType: 'protocol' });
};

// ========== 连接测试：区分 网络/认证/协议/模型 四类错误 ==========
export const testProviderConnection = async (provider, testModel) => {
    try {
        const { protocol, models } = await fetchProviderModels(provider);
        const result = { ok: true, detectedProtocol: protocol, models };
        if (testModel && !models.includes(testModel)) {
            return { ...result, ok: false, errorType: 'model', message: `模型 ${testModel} 不在可用列表中` };
        }
        return result;
    } catch (e) {
        if (e.errorType === 'auth') return { ok: false, errorType: 'auth', message: '认证失败：API Key 无效或无权限' };
        if (e.errorType === 'protocol') return { ok: false, errorType: 'protocol', message: e.message };
        return { ok: false, errorType: 'network', message: `网络错误：${e.message}` };
    }
};
