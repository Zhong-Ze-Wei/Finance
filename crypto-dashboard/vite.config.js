import { defineConfig } from 'vite'
import { HttpsProxyAgent } from 'https-proxy-agent'

// 本地代理配置
const proxyAgent = new HttpsProxyAgent('http://127.0.0.1:7890')

export default defineConfig({
    server: {
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
            }
        }
    }
})
