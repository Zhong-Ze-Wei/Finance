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
        it('无 localStorage 时应返回未初始化默认（供应商由配置页自动选择）', () => {
            const config = getLLMConfig();
            expect(config.providerId).toBeNull();
            expect(config.model).toBe('');
        });

        it('v2 标记的 localStorage 配置应正常合并', () => {
            store['llm_config'] = JSON.stringify({ _v2: true, providerId: 'builtin-aiping', model: 'GLM-5.3-Flash', reasoning: 'high' });
            const config = getLLMConfig();
            expect(config.providerId).toBe('builtin-aiping');
            expect(config.model).toBe('GLM-5.3-Flash');
            expect(config.reasoning).toBe('high');
        });

        it('无 v2 标记的旧配置应重置为默认（重新自动选择供应商）', () => {
            store['llm_config'] = JSON.stringify({ preset: 'minimax', model: 'MiniMax-M2.7' });
            const config = getLLMConfig();
            expect(config.providerId).toBeNull();
            expect(config.model).toBe('');
        });
    });

    describe('setLLMConfig', () => {
        it('应保存配置并附加 v2 标记', () => {
            const config = { providerId: 'builtin-aiping', model: 'GLM-5.3-Flash', reasoning: 'off' };
            setLLMConfig(config);
            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                'llm_config', JSON.stringify({ ...config, _v2: true })
            );
        });
    });

    describe('LLM_CONFIG Proxy', () => {
        it('应动态读取当前配置属性', () => {
            store['llm_config'] = JSON.stringify({ _v2: true, providerId: 'test', model: 'test-model' });
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
