// alertService.js - 价格提醒服务
// 监控价格变化，触发条件时发送邮件提醒

import { getAssetCards, updateAssetCard, ALERT_TYPES, getVisibleCards } from './assetCards';
import { getLLMConfig, fetchOHLCByAsset, fetchMultiSourceNews, searchTavilyContent, getCache } from './api';
import { getAlertEmails } from './userSettings';
import { generateAnalysisContext } from '../utils/indicators';
import { sendBrowserNotification, addNotificationToHistory } from './notificationService';

// EmailJS 配置
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

// 获取提醒邮箱（优先使用用户设置，回退到环境变量）
const getTargetEmails = () => {
    const userEmails = getAlertEmails();
    if (userEmails.length > 0) {
        return userEmails.join(',');
    }
    return import.meta.env.VITE_ALERT_EMAIL || '';
};

// ========== 条件检测函数 ==========

// 检查基础条件是否满足（不考虑触发模式）
const checkBaseCondition = (condition, priceData, indicators) => {
    const { type, value } = condition;
    const { price, change24h } = priceData;

    switch (type) {
        case 'price_above':
            return price >= value;
        case 'price_below':
            return price <= value;
        case 'change_up':
            return change24h >= value;
        case 'change_down':
            return change24h <= -Math.abs(value);
        case 'volatility':
            return Math.abs(change24h) >= value;
        case 'rsi_overbought':
            return indicators?.rsi >= (value || 70);
        case 'rsi_oversold':
            return indicators?.rsi <= (value || 30);
        case 'vegas_breakout':
            if (!indicators?.ema144) return false;
            return price > indicators.ema144 * 1.02 || price < indicators.ema144 * 0.98;
        default:
            return false;
    }
};

// 检查单个条件是否满足（考虑触发模式）
// 返回: { shouldTrigger: boolean, stateUpdates: object }
const checkCondition = (condition, priceData, indicators) => {
    const { triggerMode = 'cross', type, value } = condition;
    const { price } = priceData;
    const baseResult = checkBaseCondition(condition, priceData, indicators);
    const stateUpdates = {};

    // 根据触发模式判断是否真正触发
    switch (triggerMode) {
        case 'once': {
            // 单次触发：已触发过则不再触发
            if (condition.hasTriggered) {
                return { shouldTrigger: false, stateUpdates: {} };
            }
            if (baseResult) {
                stateUpdates.hasTriggered = true;
                return { shouldTrigger: true, stateUpdates };
            }
            return { shouldTrigger: false, stateUpdates: {} };
        }

        case 'cross': {
            // 穿越触发：仅在价格穿越阈值时触发
            const isPriceAbove = price > value;
            const wasPriceAbove = condition.lastPriceAbove;

            // 首次检查，初始化状态
            if (wasPriceAbove === null || wasPriceAbove === undefined) {
                stateUpdates.lastPriceAbove = isPriceAbove;
                return { shouldTrigger: false, stateUpdates };
            }

            // 检测穿越
            const crossed = (type === 'price_above' && !wasPriceAbove && isPriceAbove) ||
                           (type === 'price_below' && wasPriceAbove && !isPriceAbove);

            stateUpdates.lastPriceAbove = isPriceAbove;

            if (crossed) {
                return { shouldTrigger: true, stateUpdates };
            }
            return { shouldTrigger: false, stateUpdates };
        }

        case 'step': {
            // 步长触发：每变化 stepSize 触发一次
            const stepSize = condition.stepSize || Math.round(value * 0.01); // 默认1%步长
            const lastStepPrice = condition.lastStepPrice;

            // 首次检查，初始化基准价格
            if (lastStepPrice === null || lastStepPrice === undefined) {
                if (baseResult) {
                    // 首次满足条件，记录基准价格并触发
                    stateUpdates.lastStepPrice = price;
                    return { shouldTrigger: true, stateUpdates };
                }
                return { shouldTrigger: false, stateUpdates: {} };
            }

            // 检查是否超过步长
            const priceChange = Math.abs(price - lastStepPrice);
            if (priceChange >= stepSize && baseResult) {
                stateUpdates.lastStepPrice = price;
                return { shouldTrigger: true, stateUpdates };
            }
            return { shouldTrigger: false, stateUpdates: {} };
        }

        default:
            // 默认使用穿越模式的逻辑（向后兼容旧数据）
            return { shouldTrigger: baseResult, stateUpdates: {} };
    }
};

// 检查冷却时间
const isInCooldown = (alert, conditionId) => {
    const lastTriggered = alert.lastTriggered?.[conditionId];
    if (!lastTriggered) return false;

    const cooldownMs = (alert.cooldownMinutes || 240) * 60 * 1000;
    return Date.now() - lastTriggered < cooldownMs;
};

// 检查每日限制
const checkDailyLimit = (alert) => {
    const today = new Date().toDateString();
    if (alert.dailyResetDate !== today) {
        return { canSend: true, needReset: true };
    }
    return { canSend: (alert.dailyCount || 0) < (alert.dailyLimit || 5), needReset: false };
};

// ========== AI 分析生成 ==========

const generateAIAnalysis = async (card, priceData, triggeredCondition) => {
    const config = getLLMConfig();

    const prompt = `
你是一位专业的交易分析师。现在有一个价格提醒被触发：

资产: ${card.name}
当前价格: $${priceData.price}
24h涨跌: ${priceData.change24h?.toFixed(2)}%
触发条件: ${ALERT_TYPES[triggeredCondition.type.toUpperCase()]?.label || triggeredCondition.type} ${triggeredCondition.value}

请提供简洁的分析（200字以内）：
1. 当前市场状态判断
2. 关键支撑/压力位
3. 短期操作建议

用中文回答，语气专业但易懂。
`;

    try {
        const response = await fetch('/api/llm/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: config.model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 500
            })
        });

        if (!response.ok) {
            throw new Error(`LLM 代理返回 ${response.status}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '分析生成失败';
    } catch (e) {
        console.error('❌ 提醒 AI 分析失败:', e.message);
        return '暂无AI分析';
    }
};

// ========== EmailJS 邮件发送 ==========

// 发送单封邮件
const sendSingleEmail = async (toEmail, subject, htmlMessage) => {
    const url = 'https://api.emailjs.com/api/v1.0/email/send';

    const payload = {
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: {
            to_email: toEmail.trim(),
            subject: subject,
            message: htmlMessage
        }
    };

    console.log('📧 EmailJS 发送:', { to: toEmail.trim(), subject });

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
    }

    return true;
};

// 支持多邮箱发送（逗号分隔）
const sendEmailViaEmailJS = async (toEmails, subject, htmlMessage) => {
    const emailList = toEmails.split(',').map(e => e.trim()).filter(e => e);

    if (emailList.length === 0) {
        throw new Error('没有有效的收件邮箱');
    }

    console.log(`📧 准备发送到 ${emailList.length} 个邮箱:`, emailList);

    const results = await Promise.allSettled(
        emailList.map(email => sendSingleEmail(email, subject, htmlMessage))
    );

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected');

    if (failed.length > 0) {
        console.warn(`📧 ${failed.length} 封邮件发送失败:`, failed.map(f => f.reason?.message));
    }

    if (succeeded === 0) {
        throw new Error(failed[0]?.reason?.message || '所有邮件发送失败');
    }

    console.log(`📧 成功发送 ${succeeded}/${emailList.length} 封邮件`);
    return { succeeded, total: emailList.length };
};

const sendAlertEmail = async (card, priceData, triggeredCondition, aiAnalysis) => {
    const alertType = ALERT_TYPES[triggeredCondition.type.toUpperCase()] || { label: triggeredCondition.type, emoji: '🔔' };
    const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    // 获取高情绪指数新闻，并使用 Tavily 获取全文
    console.log(`📰 正在获取 ${card.name} 相关新闻...`);
    const sentimentNews = await getHighSentimentNews(card, 5, 3, true); // 启用 Tavily 全文获取

    // 构建新闻 HTML - 增强版卡片样式
    let newsHtml = '';
    if (sentimentNews.length > 0) {
        newsHtml = `
            <div style="background: #21262d; border-radius: 8px; padding: 16px; margin-top: 16px;">
                <h3 style="color: #f0b90b; margin: 0 0 12px; font-size: 16px;">📰 市场情报 (${sentimentNews.length})</h3>
                ${sentimentNews.map((news, idx) => {
                    const sentimentColor = news.sentiment === 'bullish' ? '#3fb950' :
                                           news.sentiment === 'bearish' ? '#f85149' : '#8b949e';
                    const sentimentIcon = news.sentiment === 'bullish' ? '📈' :
                                          news.sentiment === 'bearish' ? '📉' : '➖';
                    const signalBadge = news.market_signal ? `<span style="background: ${sentimentColor}22; color: ${sentimentColor}; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-left: 6px;">${news.market_signal}</span>` : '';

                    // 核心洞察和摘要
                    const insightHtml = news.key_insight ? `<div style="color: ${sentimentColor}; font-size: 12px; margin-top: 4px; font-weight: 500;">💡 ${news.key_insight}</div>` : '';
                    const summaryHtml = news.summary_cn ? `<div style="color: #8b949e; font-size: 11px; margin-top: 4px;">${news.summary_cn.slice(0, 100)}${news.summary_cn.length > 100 ? '...' : ''}</div>` : '';

                    return `
                    <div style="padding: 10px 0; border-bottom: 1px solid #30363d;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <span style="color: #e6edf3; font-size: 13px; font-weight: 500; flex: 1;">${idx + 1}. ${news.title_cn || news.title}</span>
                            <span style="color: ${sentimentColor}; font-size: 11px; white-space: nowrap;">${sentimentIcon} ${news.intensity || ''}${signalBadge}</span>
                        </div>
                        ${insightHtml}
                        ${summaryHtml}
                    </div>`;
                }).join('')}
            </div>`;
    }

    const htmlContent = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #e6edf3; padding: 20px;">
    <div style="max-width: 600px; margin: 0 auto; background: #161b22; border-radius: 12px; overflow: hidden; border: 1px solid #30363d;">
        <div style="background: linear-gradient(135deg, #f0b90b 0%, #e85d04 100%); padding: 20px; text-align: center;">
            <h1 style="color: #000; margin: 0; font-size: 24px;">${alertType.emoji} ${card.name} 价格提醒</h1>
            <p style="color: #333; margin: 5px 0 0; font-size: 14px;">${alertType.label}</p>
        </div>
        <div style="padding: 24px;">
            <div style="background: #21262d; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                <div style="text-align: center; margin-bottom: 16px;">
                    <div style="font-size: 28px; color: #f0b90b; font-weight: bold;">$${priceData.price?.toLocaleString()}</div>
                    <div style="font-size: 16px; color: ${priceData.change24h >= 0 ? '#3fb950' : '#f85149'};">${priceData.change24h >= 0 ? '+' : ''}${priceData.change24h?.toFixed(2)}% (24h)</div>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="color: #8b949e;">触发条件</span>
                    <span style="color: #e6edf3; font-weight: 600;">${alertType.label} ${triggeredCondition.value}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #8b949e;">触发时间</span>
                    <span style="color: #e6edf3; font-weight: 600;">${timestamp}</span>
                </div>
            </div>
            <div style="background: #21262d; border-radius: 8px; padding: 16px; border-left: 3px solid #f0b90b;">
                <h3 style="color: #f0b90b; margin: 0 0 12px; font-size: 16px;">🤖 AI 智能分析</h3>
                <div style="color: #c9d1d9; line-height: 1.6; white-space: pre-wrap;">${aiAnalysis}</div>
            </div>
            ${newsHtml}
        </div>
        <div style="text-align: center; padding: 16px; color: #6e7681; font-size: 12px; border-top: 1px solid #30363d;">
            Crypto Dashboard · 价格提醒服务<br>冷却时间内同一条件不会重复触发
        </div>
    </div>
</div>`;

    try {
        const targetEmails = getTargetEmails();
        if (!targetEmails) {
            console.warn('📧 没有配置收件邮箱，跳过发送');
            return false;
        }
        await sendEmailViaEmailJS(
            targetEmails,
            `${alertType.emoji} ${card.name} ${alertType.label} - $${priceData.price?.toLocaleString()}`,
            htmlContent
        );
        console.log('📧 Alert email sent successfully');
        return true;
    } catch (e) {
        console.error('Failed to send alert email:', e);
        return false;
    }
};

// ========== 主监控函数 ==========

export const checkAssetAlerts = async (card, priceData, indicators = {}) => {
    if (!card.alert?.enabled || !card.alert?.conditions?.length) {
        return null;
    }

    const { canSend, needReset } = checkDailyLimit(card.alert);
    if (!canSend) {
        console.log(`⏸️ ${card.name}: Daily limit reached`);
        return null;
    }

    // 用于收集需要更新的条件状态
    let conditionsNeedUpdate = false;
    const updatedConditions = [...card.alert.conditions];

    for (let i = 0; i < card.alert.conditions.length; i++) {
        const condition = card.alert.conditions[i];
        const conditionId = `${condition.type}_${condition.value}_${condition.triggerMode || 'cross'}`;

        if (isInCooldown(card.alert, conditionId)) {
            continue;
        }

        const { shouldTrigger, stateUpdates } = checkCondition(condition, priceData, indicators);

        // 如果有状态更新，合并到条件中
        if (Object.keys(stateUpdates).length > 0) {
            updatedConditions[i] = { ...condition, ...stateUpdates };
            conditionsNeedUpdate = true;
        }

        if (shouldTrigger) {
            const triggerModeLabel = condition.triggerMode === 'once' ? '🎯单次' :
                                     condition.triggerMode === 'step' ? '📊步长' : '↕️穿越';
            console.log(`🚨 Alert triggered [${triggerModeLabel}]: ${card.name} - ${condition.type} ${condition.value}`);

            // 浏览器推送通知（不阻塞邮件发送）
            const alertLabel = ALERT_TYPES[condition.type.toUpperCase()]?.label || condition.type;
            sendBrowserNotification(`${card.name} ${alertLabel}`, {
                body: `当前价格 $${priceData.price?.toLocaleString()} | 24h ${priceData.change24h >= 0 ? '+' : ''}${priceData.change24h?.toFixed(2)}%`,
                tag: `alert_${card.id}_${conditionId}`,
            });
            addNotificationToHistory({
                title: `${card.name} ${alertLabel}`,
                body: `价格 $${priceData.price?.toLocaleString()}`,
                type: 'price_alert',
            });

            const aiAnalysis = await generateAIAnalysis(card, priceData, condition);
            const sent = await sendAlertEmail(card, priceData, condition, aiAnalysis);

            if (sent) {
                const updatedAlert = {
                    ...card.alert,
                    conditions: updatedConditions,
                    lastTriggered: {
                        ...card.alert.lastTriggered,
                        [conditionId]: Date.now()
                    },
                    dailyCount: needReset ? 1 : (card.alert.dailyCount || 0) + 1,
                    dailyResetDate: new Date().toDateString()
                };

                await updateAssetCard(card.id, { alert: updatedAlert });

                return {
                    cardId: card.id,
                    cardName: card.name,
                    condition: updatedConditions[i],
                    priceData,
                    timestamp: Date.now()
                };
            }
        }
    }

    // 即使没有触发，也需要保存状态更新（如 lastPriceAbove 的初始化）
    if (conditionsNeedUpdate) {
        const updatedAlert = {
            ...card.alert,
            conditions: updatedConditions
        };
        await updateAssetCard(card.id, { alert: updatedAlert });
    }

    return null;
};

export const checkAllAlerts = async (pricesMap, indicatorsMap = {}) => {
    const cards = (await getAssetCards()).filter(c => c.alert?.enabled && c.alert?.conditions?.length > 0);
    const results = [];

    for (const card of cards) {
        const priceData = pricesMap[card.id] || pricesMap[card.name];
        if (!priceData?.price) continue;

        const indicators = indicatorsMap[card.id] || {};
        const result = await checkAssetAlerts(card, priceData, indicators);
        if (result) {
            results.push(result);
        }
    }

    return results;
};

export const getAlertEnabledAssets = async () => {
    return (await getAssetCards()).filter(c => c.alert?.enabled && c.alert?.conditions?.length > 0);
};

// 获取默认收件邮箱（优先用户设置）
export const getDefaultAlertEmail = () => getTargetEmails();

// ========== 生成测试邮件的 AI K线分析（15分钟级别） ==========
const generateTestChartAnalysis = async (asset, analysisContext) => {
    const config = getLLMConfig();
    const { currentPrice, vegas, rsi, atr, recentCandles, timestamp } = analysisContext;

    const prompt = `
你是专业的技术分析师，请对以下资产进行简洁的**15分钟级别**技术分析：

资产: ${asset.name}
时间: ${timestamp}
当前价格: $${currentPrice}
周期: 15分钟线

技术指标:
- Vegas 通道: EMA144=${vegas?.ema144?.toFixed(2)}, EMA169=${vegas?.ema169?.toFixed(2)}, 趋势=${vegas?.trend}
- RSI(14): ${rsi?.current} (${rsi?.status || 'N/A'})
- ATR 波动率: ${atr?.description || 'N/A'}
- 近5根K线: ${recentCandles}

请用中文提供简洁分析（300字以内），包含：
1. 短期趋势判断（多/空/震荡）
2. 关键支撑位和压力位（15分钟级别）
3. 短线操作建议（1-4小时内）
4. 风险提示
`;

    try {
        const response = await fetch('/api/llm/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: config.model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 800
            })
        });

        if (!response.ok) {
            throw new Error(`LLM 代理返回 ${response.status}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '分析生成失败';
    } catch (e) {
        console.error('❌ 测试邮件 K线分析失败:', e.message);
        return '暂无技术分析';
    }
};

// ========== 获取高情绪指数新闻（支持 Tavily 全文获取） ==========
// 获取已分析过的新闻，并为高强度新闻尝试获取全文
const getHighSentimentNews = async (asset, maxCount = 10, minIntensity = 2, fetchFullContent = false) => {
    try {
        const keywords = asset.newsKeywords || [asset.name];
        const rawNews = await fetchMultiSourceNews(keywords, 7);

        if (!rawNews || rawNews.length === 0) {
            return [];
        }

        // 使用 api.js 的 getCache（7天有效期），而不是自己读取 localStorage
        const analyzedNews = [];

        for (const news of rawNews) {
            const cacheKey = `analysis_v6_${news.id}`;
            const cachedData = getCache(cacheKey); // 使用统一的缓存读取函数

            if (cachedData && cachedData.intensity >= minIntensity) {
                analyzedNews.push({ ...news, ...cachedData, analyzed: true, aiAnalyzed: true });
            }

            if (analyzedNews.length >= maxCount) break;
        }

        console.log(`📰 使用缓存新闻: ${analyzedNews.length} 篇 (跳过 LLM 分析)`);

        // 按强度排序
        const sortedNews = analyzedNews.sort((a, b) => b.intensity - a.intensity);

        // 如果需要获取全文，为高强度新闻 (4+) 使用 Tavily 搜索（并行获取）
        if (fetchFullContent) {
            const highIntensityNews = sortedNews.filter(n => n.intensity >= 4);
            const newsToFetch = highIntensityNews.slice(0, 5); // 最多5篇
            console.log(`🔍 Tavily: 并行获取 ${newsToFetch.length} 篇高强度新闻全文...`);

            // 并行获取所有新闻全文
            const tavilyResults = await Promise.all(
                newsToFetch.map(async (news) => {
                    try {
                        const searchQuery = news.title_cn || news.title;
                        const tavilyResult = await searchTavilyContent(searchQuery, { maxResults: 1 });
                        return { newsId: news.id, result: tavilyResult, query: searchQuery };
                    } catch (e) {
                        console.warn(`⚠️ Tavily 获取失败: ${news.title?.slice(0, 30)}...`);
                        return { newsId: news.id, result: null };
                    }
                })
            );

            // 将结果合并回新闻对象
            const resultMap = new Map(tavilyResults.map(r => [r.newsId, r]));
            for (const news of newsToFetch) {
                const fetchResult = resultMap.get(news.id);
                if (fetchResult?.result?.content) {
                    news.fullContent = fetchResult.result.content.slice(0, 1000); // 限制长度
                    news.sourceUrl = fetchResult.result.url;
                    console.log(`✅ Tavily: 获取到 "${fetchResult.query?.slice(0, 30)}..." 的全文`);
                }
            }
        }

        return sortedNews;
    } catch (e) {
        console.error('Failed to fetch cached sentiment news:', e);
        return [];
    }
};

// 测试邮件发送（包含真实 AI 分析和新闻解读）
// targetAsset: 可选，指定要分析的资产（用于资产编辑器中的测试）
export const sendTestEmail = async (customEmail, targetAsset = null) => {
    const toEmail = customEmail || getTargetEmails();

    console.log('📧 发送测试邮件（含AI分析）...');
    console.log('收件人:', toEmail);

    if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
        return { success: false, to: toEmail, error: '❌ EmailJS 配置不完整' };
    }

    try {
        const emailList = toEmail.split(',').map(e => e.trim()).filter(e => e);

        // 使用传入的目标资产，或默认第一个可见资产
        const visibleCards = await getVisibleCards();
        const asset = targetAsset || visibleCards[0];

        if (!asset) {
            return { success: false, to: toEmail, error: '没有可用的资产卡片' };
        }

        console.log(`📊 正在分析 ${asset.name}...`);

        // 获取 OHLC 数据和生成分析上下文（使用15分钟线）
        let chartAnalysis = '暂无技术分析';
        let analysisContext = null;
        try {
            const ohlcData = await fetchOHLCByAsset(asset, '15m');
            if (ohlcData && ohlcData.length > 0) {
                analysisContext = generateAnalysisContext(ohlcData, asset.symbol || asset.name);
                chartAnalysis = await generateTestChartAnalysis(asset, analysisContext);
            }
        } catch (e) {
            console.warn('OHLC fetch failed:', e);
        }

        // 获取高情绪指数新闻，并使用 Tavily 获取全文
        console.log(`📰 正在获取 ${asset.name} 相关新闻...`);
        const sentimentNews = await getHighSentimentNews(asset, 10, 4, true); // 启用 Tavily 全文获取

        // 构建新闻 HTML - 增强版卡片样式
        let newsHtml = '';
        if (sentimentNews.length > 0) {
            newsHtml = sentimentNews.map((news, idx) => {
                const sentimentColor = news.sentiment === 'bullish' ? '#3fb950' :
                                       news.sentiment === 'bearish' ? '#f85149' : '#8b949e';
                const sentimentIcon = news.sentiment === 'bullish' ? '📈' :
                                      news.sentiment === 'bearish' ? '📉' : '➖';
                const signalBadge = news.market_signal ? `<span style="background: ${sentimentColor}22; color: ${sentimentColor}; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-left: 6px;">${news.market_signal}</span>` : '';

                // 核心洞察
                const insightHtml = news.key_insight ? `<div style="color: ${sentimentColor}; font-size: 12px; margin-top: 6px; font-weight: 500;">💡 ${news.key_insight}</div>` : '';

                return `
                <div style="background: #21262d; border-radius: 8px; padding: 12px; margin-bottom: 8px; border-left: 3px solid ${sentimentColor};">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                        <span style="font-weight: 600; color: #e6edf3; flex: 1;">${idx + 1}. ${news.title_cn || news.title}</span>
                        <span style="color: ${sentimentColor}; font-size: 12px; white-space: nowrap;">${sentimentIcon} ${news.sentiment_cn || news.sentiment} (${news.intensity})${signalBadge}</span>
                    </div>
                    <div style="color: #8b949e; font-size: 12px;">${news.summary_cn || news.summary || ''}</div>
                    ${insightHtml}
                </div>`;
            }).join('');
        } else {
            newsHtml = '<div style="color: #6e7681; text-align: center; padding: 20px;">暂无高情绪指数新闻</div>';
        }

        // 构建完整邮件 HTML
        const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
        const currentPrice = analysisContext?.currentPrice || 'N/A';

        const htmlContent = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #e6edf3; padding: 20px;">
    <div style="max-width: 700px; margin: 0 auto; background: #161b22; border-radius: 12px; overflow: hidden; border: 1px solid #30363d;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #f0b90b 0%, #e85d04 100%); padding: 24px; text-align: center;">
            <h1 style="color: #000; margin: 0; font-size: 24px;">🧪 测试报告 - ${asset.name}</h1>
            <p style="color: #333; margin: 8px 0 0; font-size: 14px;">15分钟级别 AI 技术分析 + 新闻情绪解读</p>
        </div>

        <!-- 价格摘要 -->
        <div style="padding: 20px; border-bottom: 1px solid #30363d;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="color: #8b949e; font-size: 12px;">当前价格</div>
                    <div style="font-size: 28px; color: #f0b90b; font-weight: bold;">$${typeof currentPrice === 'number' ? currentPrice.toLocaleString() : currentPrice}</div>
                </div>
                <div style="text-align: right;">
                    <div style="color: #8b949e; font-size: 12px;">分析时间</div>
                    <div style="color: #e6edf3; font-size: 14px;">${timestamp}</div>
                </div>
            </div>
        </div>

        <!-- 技术分析 -->
        <div style="padding: 20px; border-bottom: 1px solid #30363d;">
            <h3 style="color: #f0b90b; margin: 0 0 16px; font-size: 16px;">🤖 AI 技术分析 (15分钟线)</h3>
            <div style="background: #21262d; border-radius: 8px; padding: 16px; line-height: 1.7; white-space: pre-wrap; color: #c9d1d9;">
${chartAnalysis}
            </div>
        </div>

        <!-- 新闻解读 -->
        <div style="padding: 20px;">
            <h3 style="color: #f0b90b; margin: 0 0 16px; font-size: 16px;">📰 高情绪指数新闻 (强度≥4)</h3>
            <div style="color: #6e7681; font-size: 12px; margin-bottom: 12px;">共 ${sentimentNews.length} 篇</div>
            ${newsHtml}
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding: 16px; color: #6e7681; font-size: 12px; border-top: 1px solid #30363d; background: rgba(0,0,0,0.2);">
            Crypto Dashboard v0.1.1 · 测试邮件<br>
            收件人: ${emailList.join(', ')}
        </div>
    </div>
</div>`;

        const result = await sendEmailViaEmailJS(
            toEmail,
            `🧪 ${asset.name} 测试报告 - AI分析 + 新闻解读`,
            htmlContent
        );

        console.log('📧 测试邮件发送成功');
        return {
            success: true,
            to: emailList.join(', '),
            count: result.succeeded,
            total: result.total
        };
    } catch (e) {
        console.error('Test email failed:', e);
        return { success: false, to: toEmail, error: e.message };
    }
};
