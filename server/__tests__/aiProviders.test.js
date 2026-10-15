// aiProviders.test.js - 供应商协议层测试（思考等级映射 / Anthropic 转换 / 测试错误分类）
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('undici', () => ({ fetch: vi.fn(), ProxyAgent: vi.fn(() => ({})) }));
import { fetch as mockFetch } from 'undici';
import { thinkingParams as tp, callAnthropic, testProviderConnection, fetchProviderModels } from '../aiProviders.js';

beforeEach(() => { mockFetch.mockReset(); });

describe('AI 供应商协议层', () => {
    describe('thinkingParams 思考等级映射', () => {
        it('off 或空值返回 null（不注入参数）', () => {
            expect(tp('off', 'openai-compatible')).toBeNull();
            expect(tp(undefined, 'anthropic')).toBeNull();
        });

        it('OpenAI Compatible 映射为 reasoning_effort', () => {
            expect(tp('low', 'openai-compatible')).toEqual({ reasoning_effort: 'low' });
            expect(tp('high', 'openai-compatible')).toEqual({ reasoning_effort: 'high' });
        });

        it('Anthropic 映射为 thinking.budget_tokens', () => {
            expect(tp('low', 'anthropic')).toEqual({ thinking: { type: 'enabled', budget_tokens: 1024 } });
            expect(tp('high', 'anthropic')).toEqual({ thinking: { type: 'enabled', budget_tokens: 16384 } });
        });
    });

    describe('callAnthropic 非流式转换', () => {
        it('应把 Anthropic 响应转为 OpenAI 格式', async () => {
            mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
                id: 'msg_1',
                model: 'claude-x',
                content: [
                    { type: 'thinking', thinking: '...' },
                    { type: 'text', text: '你好' },
                ],
                stop_reason: 'end_turn',
                usage: { input_tokens: 1, output_tokens: 2 },
            }), { status: 200 }));

            const res = await callAnthropic({
                baseUrl: 'https://api.test/v1',
                apiKey: 'sk-test',
                body: { model: 'claude-x', messages: [{ role: 'user', content: 'hi' }], stream: false },
            });
            const data = await res.json();

            expect(data.choices[0].message.content).toBe('你好');
            expect(data.choices[0].message.reasoning_content).toBe('...');
            expect(data.choices[0].finish_reason).toBe('end_turn');

            const sent = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(sent.max_tokens).toBeGreaterThan(0);
            expect(sent.messages).toEqual([{ role: 'user', content: 'hi' }]);
        });

        it('system 消息应转为顶层 system 字段', async () => {
            mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
                content: [{ type: 'text', text: 'ok' }],
            }), { status: 200 }));

            await callAnthropic({
                baseUrl: 'https://api.test/v1',
                apiKey: 'sk-test',
                body: {
                    model: 'm', stream: false,
                    messages: [
                        { role: 'system', content: '你是助手' },
                        { role: 'user', content: 'hi' },
                    ],
                },
            });

            const sent = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(sent.system).toBe('你是助手');
            expect(sent.messages).toHaveLength(1);
        });
    });

    describe('testProviderConnection 错误分类', () => {
        it('401 应归类为认证失败', async () => {
            mockFetch.mockResolvedValueOnce(new Response('denied', { status: 401 }));
            const result = await testProviderConnection({ baseUrl: 'https://api.test/v1', apiKey: 'bad', protocol: 'openai-compatible' });
            expect(result.ok).toBe(false);
            expect(result.errorType).toBe('auth');
        });

        it('网络异常应归类为网络错误', async () => {
            mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
            const result = await testProviderConnection({ baseUrl: 'https://api.test/v1', apiKey: 'k', protocol: 'openai-compatible' });
            expect(result.ok).toBe(false);
            expect(result.errorType).toBe('network');
        });

        it('成功时返回模型列表与检测协议', async () => {
            mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
                data: [{ id: 'model-a' }, { id: 'model-b' }],
            }), { status: 200 }));
            const result = await testProviderConnection({ baseUrl: 'https://api.test/v1', apiKey: 'k', protocol: 'openai-compatible' }, 'model-a');
            expect(result.ok).toBe(true);
            expect(result.models).toContain('model-a');
        });

        it('模型不在列表中应归类为模型不可用', async () => {
            mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
                data: [{ id: 'model-a' }],
            }), { status: 200 }));
            const result = await testProviderConnection({ baseUrl: 'https://api.test/v1', apiKey: 'k', protocol: 'openai-compatible' }, 'model-x');
            expect(result.ok).toBe(false);
            expect(result.errorType).toBe('model');
        });
    });
});
