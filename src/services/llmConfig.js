// ============================================
// LLM 配置管理 - 支持多模型动态切换
// ============================================
// 注意：API Key 已移至后端代理，前端不再需要也不持有 API Key
// 前端通过 /api/llm/chat/completions 代理调用 LLM 服务

// 预设模型配置 (baseUrl 用于模型切换 UI 展示，实际请求走后端代理)
// 渠道由后端按模型名路由（含 mimo 走小米，其余走 AIPing），预设仅是快捷入口
export const LLM_PRESETS = {
    'glm-flash': {
        name: 'GLM-5.3-Flash',
        model: 'GLM-5.3-Flash'
    },
    'deepseek-v41': {
        name: 'DeepSeek-V4.1-Flash',
        model: 'DeepSeek-V4.1-Flash'
    },
    'deepseek': {
        name: 'DeepSeek-V4-Flash',
        model: 'DeepSeek-V4-Flash'
    },
    'deepseek-pro': {
        name: 'DeepSeek-V4-Pro',
        model: 'DeepSeek-V4-Pro'
    },
    'minimax': {
        name: 'MiniMax-M2.7',
        model: 'MiniMax-M2.7'
    }
};

// Tavily 配置已移至后端代理，前端通过 /api/tavily/search 调用
export const TAVILY_CONFIG = {
    available: true // 标记 Tavily 功能可用（实际由后端决定）
};

// 默认配置
// providerId 指向后端内置/自定义供应商；reasoning 为思考等级（off/low/medium/high）
// temperature/maxTokens 为全局请求参数覆盖（空值时使用各业务自带的默认值）
const DEFAULT_LLM_CONFIG = {
    providerId: 'builtin-aiping',
    model: 'GLM-5.3-Flash',
    reasoning: 'off',
    temperature: null,
    maxTokens: null,
};

// 旧版本地配置（{preset, model}）迁移：保留模型名，供应商指向内置 AIPing
const migrateLegacyConfig = (saved) => {
    if (saved && !saved.providerId && saved.model) {
        return { ...DEFAULT_LLM_CONFIG, model: saved.model };
    }
    return saved;
};

// 获取当前 LLM 配置
export const getLLMConfig = () => {
    try {
        const raw = localStorage.getItem('llm_config');
        if (raw) {
            const saved = migrateLegacyConfig(JSON.parse(raw));
            if (saved) {
                return { ...DEFAULT_LLM_CONFIG, ...saved };
            }
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
