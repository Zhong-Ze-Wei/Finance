import { defineConfig } from 'vite'
import { HttpsProxyAgent } from 'https-proxy-agent'

// 本地代理配置（梯子 HTTP 代理端口，可用 VPN_PROXY 环境变量覆盖）
const proxyAgent = new HttpsProxyAgent(process.env.VPN_PROXY || 'http://127.0.0.1:7891')
// 后端地址（容器内通过 VITE_API_TARGET 指向 backend 服务）
const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:3001'

export default defineConfig({
    server: {
        port: 3000,
        allowedHosts: true,
        host: '0.0.0.0',
        proxy: {
            // CoinGecko API 
            '/api/coingecko': {
                target: 'https://api.coingecko.com',
                changeOrigin: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/api\/coingecko/, '/api/v3'),
                agent: proxyAgent
            },
            // OKX API (中国大陆可用)
            '/api/okx': {
                target: 'https://www.okx.com',
                changeOrigin: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/api\/okx/, '/api/v5'),
                agent: proxyAgent
            },
            // Binance API (备用)
            '/api/binance': {
                target: 'https://api.binance.com',
                changeOrigin: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/api\/binance/, '/api/v3'),
                agent: proxyAgent
            },
            // Google News RSS
            '/api/rss/google': {
                target: 'https://news.google.com',
                changeOrigin: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/api\/rss\/google/, '/rss'),
                agent: proxyAgent
            },
            // Cointelegraph RSS (加密新闻，国内可直连，无需梯子)
            '/api/rss/ct': {
                target: 'https://cointelegraph.com',
                changeOrigin: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/api\/rss\/ct/, '/rss'),
            },
            // 新浪滚动财经 (中文财经新闻，国内直连)
            '/api/sina/roll': {
                target: 'https://feed.mix.sina.com.cn',
                changeOrigin: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/api\/sina\/roll/, ''),
            },
            // 小米 LLM API — 已改为后端代理 (开发模式代理到 Express :3001)
            '/api/llm': {
                target: apiTarget,
                changeOrigin: true,
                secure: false
            },
            // Tavily API — 已改为后端代理
            '/api/tavily': {
                target: apiTarget,
                changeOrigin: true,
                secure: false
            },
            // Yahoo Finance API (美股/港股价格)
            '/api/yahoo': {
                target: 'https://query1.finance.yahoo.com',
                changeOrigin: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/api\/yahoo/, ''),
                agent: proxyAgent
            },
            // 新浪财经 API (A股价格)
            '/api/sina': {
                target: 'https://hq.sinajs.cn',
                changeOrigin: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/api\/sina/, ''),
                headers: { Referer: 'https://finance.sina.com.cn' },
                agent: proxyAgent
            },
            // Resend 邮件 API
            '/api/resend': {
                target: 'https://api.resend.com',
                changeOrigin: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/api\/resend/, ''),
                agent: proxyAgent
            },
            // Jina Reader API (网页正文提取)
            '/api/jina': {
                target: 'https://r.jina.ai',
                changeOrigin: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/api\/jina/, ''),
                agent: proxyAgent
            },
            // Google News 重定向解析
            '/api/gnews-redirect': {
                target: 'https://news.google.com',
                changeOrigin: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/api\/gnews-redirect/, ''),
                agent: proxyAgent,
                followRedirects: true
            }
        }
    }
})
