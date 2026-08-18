// check-apis.mjs - 启动前 API 可达性预检（npm run dev 前自动执行，只警告不阻塞）
import https from 'node:https';
import http from 'node:http';
import { HttpsProxyAgent } from 'https-proxy-agent';

const VPN_PROXY = process.env.VPN_PROXY || 'http://127.0.0.1:7890';

// 检查项：name / url / needVPN（true = 需要走本地梯子代理）
const CHECKS = [
    // 免梯子（直连）
    { name: 'Cointelegraph (加密新闻)', url: 'https://cointelegraph.com/rss', needVPN: false },
    { name: '新浪财经 (中文新闻)', url: 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2516&num=1&page=1', needVPN: false },
    { name: 'AIPing (AI 分析)', url: 'https://www.aiping.cn/api/v1/models', needVPN: false },
    // 依赖梯子（走 VPN_PROXY；OKX 因本机 DNS 无法直解也走梯子，与应用内代理配置一致）
    { name: 'OKX (行情/K线)', url: 'https://www.okx.com/api/v5/public/time', needVPN: true },
    { name: 'CoinGecko (价格)', url: 'https://api.coingecko.com/api/v3/ping', needVPN: true },
    { name: 'Google News (新闻搜索)', url: 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en', needVPN: true },
    { name: 'Yahoo Finance (美股)', url: 'https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=1d', needVPN: true },
];

const check = (url, agent) => new Promise((resolve) => {
    const started = Date.now();
    const mod = url.startsWith('http://') ? http : https;
    const req = mod.get(url, { agent, timeout: 6000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        res.resume(); // 丢弃 body，只关心状态码
        resolve({ ok: res.statusCode < 500, status: res.statusCode, ms: Date.now() - started });
    });
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 'TIMEOUT', ms: Date.now() - started }); });
    req.on('error', (e) => resolve({ ok: false, status: e.code || e.message.slice(0, 20), ms: Date.now() - started }));
});

console.log('\n🔍 API 可达性预检');
console.log('─'.repeat(58));

const vpnAgent = new HttpsProxyAgent(VPN_PROXY);
let vpnAllOk = true;

for (const c of CHECKS) {
    const r = await check(c.url, c.needVPN ? vpnAgent : undefined);
    const icon = r.ok ? '✅' : '❌';
    const tag = c.needVPN ? '[梯子]' : '[直连]';
    console.log(`${icon} ${tag} ${c.name.padEnd(24)} ${String(r.status).padEnd(7)} ${r.ms}ms`);
    if (c.needVPN && !r.ok) vpnAllOk = false;
}

console.log('─'.repeat(58));
if (!vpnAllOk) {
    console.log(`⚠️  依赖梯子的 API 不可达：请确认 VPN/Clash 已开启且端口为 ${VPN_PROXY}`);
    console.log('   （不开梯子也能用：OKX 行情、Cointelegraph/新浪新闻、AI 分析）\n');
} else {
    console.log('✅ 全部 API 可达，祝使用愉快\n');
}
