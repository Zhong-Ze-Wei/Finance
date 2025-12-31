import { defineConfig } from 'vite'
import { HttpsProxyAgent } from 'https-proxy-agent'

// 本地代理配置
const proxyAgent = new HttpsProxyAgent('http://127.0.0.1:7890')

export default defineConfig({
    server: {
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
            // 小米 LLM API
            '/api/llm': {
                target: 'https://api.xiaomimimo.com',
                changeOrigin: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/api\/llm/, '/v1'),
                agent: proxyAgent
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
