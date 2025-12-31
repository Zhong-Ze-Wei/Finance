// TradingViewWidget.jsx
import React, { useEffect, useRef, memo, useState } from 'react';

// 全局脚本加载状态（避免重复加载）
let tvScriptLoaded = false;
let tvScriptLoading = false;
const tvScriptCallbacks = [];

// 预加载 TradingView 脚本
const preloadTvScript = () => {
    if (tvScriptLoaded || tvScriptLoading) return Promise.resolve();

    tvScriptLoading = true;
    return new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
        script.type = "text/javascript";
        script.async = true;
        script.onload = () => {
            tvScriptLoaded = true;
            tvScriptLoading = false;
            tvScriptCallbacks.forEach(cb => cb());
            tvScriptCallbacks.length = 0;
            resolve();
        };
        document.head.appendChild(script);
    });
};

// 页面加载时预加载脚本
if (typeof window !== 'undefined') {
    preloadTvScript();
}

function TradingViewWidget({ coin, symbol: symbolProp, interval = 'D' }) {
    const container = useRef();
    const [loading, setLoading] = useState(true);
    const widgetInitialized = useRef(false);

    // 优先使用传入的 symbol，否则回退到默认加密货币逻辑
    const symbol = symbolProp || (coin === 'BTC' ? "BINANCE:BTCUSDT" : coin === 'ETH' ? "BINANCE:ETHUSDT" : `BINANCE:${coin}USDT`);

    useEffect(() => {
        if (!container.current) return;

        setLoading(true);
        widgetInitialized.current = false;

        // 清理旧内容
        container.current.innerHTML = '';

        // 创建 widget 容器 div
        const widgetDiv = document.createElement("div");
        widgetDiv.className = "tradingview-widget-container__widget";
        widgetDiv.style.height = "100%";
        widgetDiv.style.width = "100%";
        container.current.appendChild(widgetDiv);

        const initWidget = () => {
            if (widgetInitialized.current || !container.current) return;

            // 创建配置 script
            const configScript = document.createElement("script");
            configScript.type = "text/javascript";
            configScript.innerHTML = JSON.stringify({
                "autosize": true,
                "symbol": symbol,
                "interval": interval,
                "timezone": "Asia/Shanghai",
                "theme": "dark",
                "style": "1",
                "locale": "zh_CN",
                "enable_publishing": false,
                "allow_symbol_change": true,
                "calendar": false,
                "hide_volume": false,
                "support_host": "https://www.tradingview.com",
                "studies": [
                    "MAExp@tv-basicstudies",
                    "RSI@tv-basicstudies"
                ]
            });

            // 重新添加脚本引用来触发 widget
            const widgetScript = document.createElement("script");
            widgetScript.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
            widgetScript.type = "text/javascript";
            widgetScript.async = true;
            widgetScript.innerHTML = configScript.innerHTML;

            container.current.appendChild(widgetScript);
            widgetInitialized.current = true;

            // 缩短等待时间：脚本已预加载，只需等 iframe 渲染
            setTimeout(() => setLoading(false), 500);
        };

        if (tvScriptLoaded) {
            initWidget();
        } else {
            tvScriptCallbacks.push(initWidget);
            preloadTvScript();
        }

        return () => {
            if (container.current) {
                container.current.innerHTML = '';
            }
        };
    }, [coin, symbol, interval]);

    return (
        <div style={{ position: 'relative', height: '100%', width: '100%' }}>
            {loading && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    background: '#0d1117', zIndex: 10
                }}>
                    <div style={{
                        width: '40px', height: '40px',
                        border: '3px solid #374151', borderTopColor: '#f0b90b',
                        borderRadius: '50%', animation: 'spin 1s linear infinite'
                    }} />
                    <span style={{ color: '#9ca3af', marginTop: '1rem', fontSize: '0.9rem' }}>
                        正在加载 TradingView 图表...
                    </span>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
            )}
            <div
                className="tradingview-widget-container"
                ref={container}
                style={{ height: "100%", width: "100%" }}
            />
        </div>
    );
}

export default memo(TradingViewWidget);
