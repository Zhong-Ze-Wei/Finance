// ============================================
// LLM 配置管理 - 支持多模型动态切换
// ============================================
// 注意：API Key 已移至后端代理，前端不再需要也不持有 API Key
// 前端通过 /api/llm/chat/completions 代理调用 LLM 服务

// 预设模型配置 (baseUrl 用于模型切换 UI 展示，实际请求走后端代理)
export const LLM_PRESETS = {
    'mimo': {
        name: '小米 Mimo',
        model: import.meta.env.VITE_MIMO_MODEL || 'mimo-v2-flash'
    },
    'deepseek': {
        name: 'DeepSeek-V3.2',
        model: 'DeepSeek-V3.2'
    },
    'glm': {
        name: 'GLM-4.7',
        model: 'GLM-4.7'
    },
    'minimax': {
        name: 'MiniMax-M2.1',
        model: 'MiniMax-M2.1'
    },
    'qwen': {
        name: 'Qwen3-235B',
        model: 'Qwen3-235B-A22B'
    }
};

// Tavily 配置已移至后端代理，前端通过 /api/tavily/search 调用
export const TAVILY_CONFIG = {
    available: true // 标记 Tavily 功能可用（实际由后端决定）
};

// 默认配置
const DEFAULT_LLM_CONFIG = {
    preset: 'deepseek',
    model: 'DeepSeek-V3.2'
};

// 获取当前 LLM 配置
export const getLLMConfig = () => {
    try {
        const saved = localStorage.getItem('llm_config');
        if (saved) {
            return { ...DEFAULT_LLM_CONFIG, ...JSON.parse(saved) };
        }
    } catch (e) {
        console.warn('Failed to load LLM config:', e);
    }
    return DEFAULT_LLM_CONFIG;
};

// 保存 LLM 配置
export const setLLMConfig = (config) => {
    try {
        localStorage.setItem('llm_config', JSON.stringify(config));
    } catch (e) {
        console.warn('Failed to save LLM config:', e);
    }
};

// 动态获取当前配置 (兼容旧代码)
export const LLM_CONFIG = new Proxy({}, {
    get(target, prop) {
        const config = getLLMConfig();
        return config[prop];
    }
});
