import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock localStorage
const store = {};
const localStorageMock = {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, val) => { store[key] = val; }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: () => Object.keys(store).forEach(k => delete store[k]),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i) => Object.keys(store)[i] || null)
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock, configurable: true });

// Mock import.meta.env (API Key 已移至后端，前端不再需要)
vi.stubGlobal('import.meta', {
    env: {
        VITE_MIMO_MODEL: 'mimo-v2-flash'
    }
});

describe('llmConfig', () => {
    let LLM_PRESETS, getLLMConfig, setLLMConfig, LLM_CONFIG;

    beforeEach(async () => {
        localStorageMock.clear();
        vi.clearAllMocks();
        const mod = await import('../llmConfig.js');
        LLM_PRESETS = mod.LLM_PRESETS;
        getLLMConfig = mod.getLLMConfig;
        setLLMConfig = mod.setLLMConfig;
        LLM_CONFIG = mod.LLM_CONFIG;
    });

    describe('LLM_PRESETS', () => {
        it('应包含 glm-flash 预设', () => {
            expect(LLM_PRESETS['glm-flash']).toBeDefined();
            expect(LLM_PRESETS['glm-flash'].model).toBe('GLM-5.3-Flash');
        });

        it('应包含 deepseek 预设', () => {
            expect(LLM_PRESETS.deepseek).toBeDefined();
            expect(LLM_PRESETS.deepseek.model).toBe('DeepSeek-V4-Flash');
        });

        it('应包含 deepseek-pro 预设', () => {
            expect(LLM_PRESETS['deepseek-pro']).toBeDefined();
            expect(LLM_PRESETS['deepseek-pro'].model).toBe('DeepSeek-V4-Pro');
        });

        it('应包含 minimax 预设', () => {
            expect(LLM_PRESETS.minimax).toBeDefined();
            expect(LLM_PRESETS.minimax.model).toBe('MiniMax-M2.7');
        });

        it('预设不应包含 apiKey 字段（已移至后端）', () => {
            Object.values(LLM_PRESETS).forEach(preset => {
                expect(preset.apiKey).toBeUndefined();
            });
        });
    });

    describe('getLLMConfig', () => {
        it('无 localStorage 时应返回默认配置', () => {
            const config = getLLMConfig();
            expect(config.providerId).toBe('builtin-aiping');
            expect(config.model).toBe('GLM-5.3-Flash');
            expect(config.reasoning).toBe('off');
        });

        it('有 localStorage 时应返回合并配置', () => {
            store['llm_config'] = JSON.stringify({ providerId: 'builtin-mimo', model: 'custom-model', reasoning: 'high' });
            const config = getLLMConfig();
            expect(config.providerId).toBe('builtin-mimo');
            expect(config.model).toBe('custom-model');
            expect(config.reasoning).toBe('high');
        });

        it('旧版配置（preset/model）应迁移为供应商结构', () => {
            store['llm_config'] = JSON.stringify({ preset: 'minimax', model: 'MiniMax-M2.7' });
            const config = getLLMConfig();
            expect(config.providerId).toBe('builtin-aiping');
            expect(config.model).toBe('MiniMax-M2.7');
        });
    });

    describe('setLLMConfig', () => {
        it('应保存配置到 localStorage', () => {
            const config = { providerId: 'builtin-mimo', model: 'MiMo-7B', reasoning: 'low' };
            setLLMConfig(config);
            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                'llm_config', JSON.stringify(config)
            );
        });
    });

    describe('LLM_CONFIG Proxy', () => {
        it('应动态读取当前配置属性', () => {
            store['llm_config'] = JSON.stringify({ providerId: 'test', model: 'test-model' });
            expect(LLM_CONFIG.providerId).toBe('test');
            expect(LLM_CONFIG.model).toBe('test-model');
        });
    });

    describe('TAVILY_CONFIG', () => {
        it('应标记为可用', async () => {
            const mod = await import('../llmConfig.js');
            expect(mod.TAVILY_CONFIG.available).toBe(true);
        });
    });
});
