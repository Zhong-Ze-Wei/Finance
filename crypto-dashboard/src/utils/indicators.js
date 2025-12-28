// src/utils/indicators.js
// 技术指标计算工具

import { EMA, RSI, ATR } from 'technicalindicators';

/**
 * 计算 Vegas 通道 (EMA 12, 144, 169)
 * @param {Array<number>} closePrices - 收盘价序列
 * @returns {Object} Vegas 通道数据
 */
export function calculateVegasTunnel(closePrices) {
    if (closePrices.length < 169) {
        console.warn('Vegas Tunnel requires at least 169 data points');
        return null;
    }

    const ema12 = EMA.calculate({ period: 12, values: closePrices });
    const ema144 = EMA.calculate({ period: 144, values: closePrices });
    const ema169 = EMA.calculate({ period: 169, values: closePrices });

    const currentPrice = closePrices[closePrices.length - 1];
    const tunnelTop = ema144[ema144.length - 1];
    const tunnelBottom = ema169[ema169.length - 1];
    const filterLine = ema12[ema12.length - 1];

    // 趋势判断
    let trend = 'NEUTRAL';
    if (currentPrice > tunnelTop && filterLine > tunnelTop) {
        trend = 'BULLISH'; // 多头趋势
    } else if (currentPrice < tunnelBottom && filterLine < tunnelBottom) {
        trend = 'BEARISH'; // 空头趋势
    }

    // 距离通道百分比
    const distancePercent = ((currentPrice - tunnelTop) / tunnelTop * 100).toFixed(2);

    return {
        ema12: filterLine.toFixed(2),
        ema144: tunnelTop.toFixed(2),
        ema169: tunnelBottom.toFixed(2),
        trend,
        distancePercent,
        description: trend === 'BULLISH'
            ? `价格 ($${currentPrice.toFixed(0)}) 位于 Vegas 通道 ($${tunnelTop.toFixed(0)}) 之上 ${distancePercent}%，且 EMA 12 保持上穿，属于典型多头排列。`
            : trend === 'BEARISH'
                ? `价格位于 Vegas 通道之下，空头趋势占优。`
                : `价格在 Vegas 通道内部震荡，方向未明。`
    };
}

/**
 * 计算 RSI 及背离检测
 * @param {Array<number>} closePrices - 收盘价序列
 * @param {number} period - RSI 周期 (默认 14)
 * @returns {Object} RSI 数据及背离状态
 */
export function calculateRSIWithDivergence(closePrices, period = 14) {
    if (closePrices.length < period + 10) {
        return null;
    }

    const rsiValues = RSI.calculate({ values: closePrices, period });
    const currentRSI = rsiValues[rsiValues.length - 1];
    const prevRSI = rsiValues[rsiValues.length - 6]; // 5 bars ago for divergence detection

    const currentPrice = closePrices[closePrices.length - 1];
    const prevPrice = closePrices[closePrices.length - 6];

    // 背离检测
    let divergence = 'NONE';
    let divergenceDesc = '';

    // 顶背离: 价格新高，RSI 未新高
    if (currentPrice > prevPrice && currentRSI < prevRSI) {
        divergence = 'BEARISH_DIVERGENCE';
        divergenceDesc = `⚠️ **顶背离信号**：价格创新高 ($${currentPrice.toFixed(0)})，但 RSI 却从 ${prevRSI.toFixed(0)} 跌至 ${currentRSI.toFixed(0)}，动能衰竭，需警惕回调。`;
    }
    // 底背离: 价格新低，RSI 未新低
    else if (currentPrice < prevPrice && currentRSI > prevRSI) {
        divergence = 'BULLISH_DIVERGENCE';
        divergenceDesc = `✅ **底背离信号**：价格创新低，但 RSI 却在走高，说明卖盘力竭，反弹在即。`;
    }

    // RSI 状态描述
    let rsiStatus = '';
    if (currentRSI > 70) {
        rsiStatus = '超买区 (>70)，市场过热，短期回调概率增大';
    } else if (currentRSI < 30) {
        rsiStatus = '超卖区 (<30)，市场恐慌，反弹概率增大';
    } else if (currentRSI >= 50) {
        rsiStatus = `健康区 (${currentRSI.toFixed(0)})，多头占优但未过热`;
    } else {
        rsiStatus = `弱势区 (${currentRSI.toFixed(0)})，空头占优`;
    }

    return {
        current: currentRSI.toFixed(2),
        history: rsiValues.slice(-10).map(v => v.toFixed(0)), // 最近 10 期 RSI
        status: rsiStatus,
        divergence,
        divergenceDesc
    };
}

/**
 * 计算 ATR (波动率)
 * @param {Array} ohlcData - OHLC 数据数组 [{high, low, close}]
 * @param {number} period - ATR 周期 (默认 14)
 * @returns {Object} ATR 数据
 */
export function calculateATR(ohlcData, period = 14) {
    if (ohlcData.length < period) return null;

    const atrValues = ATR.calculate({
        high: ohlcData.map(d => d.high),
        low: ohlcData.map(d => d.low),
        close: ohlcData.map(d => d.close),
        period
    });

    const currentATR = atrValues[atrValues.length - 1];
    const currentPrice = ohlcData[ohlcData.length - 1].close;
    const atrPercent = (currentATR / currentPrice * 100).toFixed(2);

    return {
        value: currentATR.toFixed(2),
        percent: atrPercent,
        description: parseFloat(atrPercent) > 3
            ? `高波动 (ATR ${atrPercent}%)，适合趋势策略，注意放大止损空间`
            : `低波动 (ATR ${atrPercent}%)，行情偏震荡，适合区间交易`
    };
}

/**
 * 生成完整的 K 线分析上下文 (用于 LLM 输入)
 * @param {Array} ohlcData - 完整的 OHLC 数据
 * @returns {Object} 结构化分析数据
 */
export function generateAnalysisContext(ohlcData, symbol = 'BTC') {
    // 确保数据按时间升序排列
    const sortedData = [...ohlcData].sort((a, b) => a.time - b.time);

    const closePrices = sortedData.map(d => d.close);
    const currentPrice = closePrices[closePrices.length - 1];

    console.log(`📊 [DEBUG] ${symbol} OHLC Data: ${sortedData.length} candles`);
    console.log(`📊 [DEBUG] Latest price: $${currentPrice}, First price: $${closePrices[0]}`);

    const vegas = calculateVegasTunnel(closePrices);
    const rsi = calculateRSIWithDivergence(closePrices);
    const atr = calculateATR(sortedData);

    if (vegas) {
        console.log(`📊 [DEBUG] Vegas: EMA12=$${vegas.ema12}, EMA144=$${vegas.ema144}, EMA169=$${vegas.ema169}`);
        console.log(`📊 [DEBUG] Trend: ${vegas.trend}, Price ${currentPrice > parseFloat(vegas.ema144) ? '>' : '<'} EMA144`);
    }

    // 时间序列上下文：最近 5 根 K 线摘要
    const recentCandles = sortedData.slice(-5).map((d, i) => {
        const change = ((d.close - d.open) / d.open * 100).toFixed(2);
        const type = d.close > d.open ? '阳线' : '阴线';
        return `K${i + 1}: ${type} ${change}%`;
    }).join(', ');

    return {
        symbol,
        currentPrice: currentPrice.toFixed(2),
        vegas,
        rsi,
        atr,
        recentCandles,
        timestamp: new Date().toLocaleString('zh-CN')
    };
}
