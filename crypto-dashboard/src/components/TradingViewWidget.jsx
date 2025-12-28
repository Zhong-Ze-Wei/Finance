// TradingViewWidget.jsx
import React, { useEffect, useRef, memo, useState } from 'react';

function TradingViewWidget({ coin, symbol: symbolProp, interval = 'D' }) {
    const container = useRef();
    const [loading, setLoading] = useState(true);

    // 优先使用传入的 symbol，否则回退到默认加密货币逻辑
    const symbol = symbolProp || (coin === 'BTC' ? "BINANCE:BTCUSDT" : coin === 'ETH' ? "BINANCE:ETHUSDT" : `BINANCE:${coin}USDT`);

    useEffect(() => {
        if (!container.current) return;

        setLoading(true);

        // 清理旧内容
        container.current.innerHTML = '';

        // 创建 widget 容器 div
        const widgetDiv = document.createElement("div");
        widgetDiv.className = "tradingview-widget-container__widget";
        widgetDiv.style.height = "100%";
        widgetDiv.style.width = "100%";
        container.current.appendChild(widgetDiv);

        // 创建 script
        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
        script.type = "text/javascript";
        script.async = true;
        script.innerHTML = JSON.stringify({
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

        // 监听脚本加载完成
        script.onload = () => {
            setTimeout(() => setLoading(false), 1500);
        };

        container.current.appendChild(script);

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
