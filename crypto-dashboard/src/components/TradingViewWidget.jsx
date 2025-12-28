// TradingViewWidget.jsx
import React, { useEffect, useRef, memo } from 'react';

function TradingViewWidget({ coin, interval = 'D' }) {
    const container = useRef();
    const symbol = coin === 'BTC' ? "BINANCE:BTCUSDT" : "BINANCE:ETHUSDT";

    useEffect(() => {
        if (!container.current) return;

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
            "interval": interval, // 使用传入的时间周期
            "timezone": "Asia/Shanghai",
            "theme": "dark",
            "style": "1",
            "locale": "zh_CN",
            "enable_publishing": false,
            "allow_symbol_change": true,
            "calendar": false,
            "hide_volume": false, // 显示成交量
            "support_host": "https://www.tradingview.com",
            // 预加载指标 (TradingView 免费版支持有限)
            "studies": [
                "MAExp@tv-basicstudies", // EMA
                "RSI@tv-basicstudies"    // RSI
            ]
        });

        container.current.appendChild(script);

        return () => {
            if (container.current) {
                container.current.innerHTML = '';
            }
        };
    }, [coin, symbol, interval]);

    return (
        <div
            className="tradingview-widget-container"
            ref={container}
            style={{ height: "100%", width: "100%" }}
        />
    );
}

export default memo(TradingViewWidget);
