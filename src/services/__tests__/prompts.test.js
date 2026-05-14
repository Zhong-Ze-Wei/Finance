import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('prompt 配置', () => {
    let PROMPTS, getSystemPrompt, PERSONALITY_PRESETS, getPersonalityPreset;

    beforeEach(async () => {
        const mod = await import('../prompts.js');
        PROMPTS = mod.PROMPTS;
        getSystemPrompt = mod.getSystemPrompt;
        PERSONALITY_PRESETS = mod.PERSONALITY_PRESETS;
        getPersonalityPreset = mod.getPersonalityPreset;
    });

    describe('PROMPTS', () => {
        it('应包含 newsAnalysis key', () => {
            expect(PROMPTS.newsAnalysis).toBeDefined();
            expect(typeof PROMPTS.newsAnalysis).toBe('string');
            expect(PROMPTS.newsAnalysis.length).toBeGreaterThan(50);
        });

        it('应包含 deepAnalysis key', () => {
            expect(PROMPTS.deepAnalysis).toBeDefined();
            expect(typeof PROMPTS.deepAnalysis).toBe('string');
        });

        it('应包含 chartAnalysis key', () => {
            expect(PROMPTS.chartAnalysis).toBeDefined();
            expect(typeof PROMPTS.chartAnalysis).toBe('string');
        });
    });

    describe('getSystemPrompt', () => {
        it('应返回对应 key 的 prompt', () => {
            const prompt = getSystemPrompt('newsAnalysis');
            expect(prompt).toBe(PROMPTS.newsAnalysis);
        });

        it('未知 key 应返回默认 prompt', () => {
            const prompt = getSystemPrompt('unknown');
            expect(typeof prompt).toBe('string');
            expect(prompt.length).toBeGreaterThan(0);
        });

        it('传入 personality 应注入人格前缀', () => {
            const prompt = getSystemPrompt('deepAnalysis', 'aggressive');
            expect(prompt).toContain('激进');
        });
    });

    describe('PERSONALITY_PRESETS', () => {
        it('应包含 conservative 预设', () => {
            expect(PERSONALITY_PRESETS.conservative).toBeDefined();
            expect(PERSONALITY_PRESETS.conservative.label).toBeDefined();
        });

        it('应包含 aggressive 预设', () => {
            expect(PERSONALITY_PRESETS.aggressive).toBeDefined();
        });

        it('应包含 balanced 预设', () => {
            expect(PERSONALITY_PRESETS.balanced).toBeDefined();
        });

        it('每个预设应有 label 和 promptSuffix', () => {
            Object.values(PERSONALITY_PRESETS).forEach(preset => {
                expect(preset.label).toBeDefined();
                expect(preset.promptSuffix).toBeDefined();
            });
        });
    });

    describe('getPersonalityPreset', () => {
        it('有效 key 应返回对应预设', () => {
            const preset = getPersonalityPreset('aggressive');
            expect(preset.key).toBe('aggressive');
        });

        it('无效 key 应返回 balanced 默认', () => {
            const preset = getPersonalityPreset('nonexistent');
            expect(preset.key).toBe('balanced');
        });
    });
});
