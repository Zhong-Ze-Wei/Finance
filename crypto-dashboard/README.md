# 🚀 Crypto Dashboard

一个功能丰富的加密货币实时监控与 AI 智能分析平台，集成多源新闻聚合、专业 K 线图表和 AI 导师式交易分析。

![React](https://img.shields.io/badge/React-19.2.3-61DAFB?logo=react)
![Vite](https://img.shields.io/badge/Vite-7.2.4-646CFF?logo=vite)
![TradingView](https://img.shields.io/badge/TradingView-Widgets-131722?logo=tradingview)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ 核心功能

### 📊 实时价格监控
- **双币种支持**：BTC/USDT 和 ETH/USDT 一键切换
- **实时价格更新**：通过 CoinGecko API 获取最新价格
- **24 小时涨跌幅**：直观的红绿色涨跌指示
- **智能缓存**：15 分钟缓存策略，减少 API 调用

### 📈 专业 K 线图表

#### TradingView 高级图表
- 嵌入式 TradingView 专业图表
- 支持多时间周期切换：**15分钟 / 1小时 / 4小时 / 日线**
- 内置 EMA 和 RSI 技术指标
- 深色主题，与整体 UI 风格统一

#### Lightweight Charts (自研)
- 基于 `lightweight-charts` 的轻量级 K 线图
- **Vegas 通道指标**：EMA 12（蓝）+ EMA 144（橙）+ EMA 169（红）
- MA20 / MA60 均线叠加
- 支持 OKX API 实时数据（中国大陆可用）

### 🤖 AI 一键诊断

#### 智能盘面分析
- **Vegas 通道趋势判断**：自动识别多头/空头/震荡趋势
- **RSI 动能分析**：超买超卖区域检测 + 背离信号识别
- **ATR 波动率评估**：判断高/低波动行情
- **K 线形态总结**：近 5 根 K 线涨跌分析

#### 导师式 AI 解读
- **四段式分析框架**：
  1. 📌 导师总结 - 一句话核心观点
  2. 📊 盘面诊断 - 多维度技术分析
  3. 📋 交易计划 - 具体入场/止损/目标价
  4. 💪 心态按摩 - 情绪管理建议
- **流式输出**：打字机效果，实时呈现分析过程
- **关键信息高亮**：价格、百分比等数值自动加粗

### 📰 多源新闻聚合

#### 新闻来源
- Google News RSS 实时抓取
- 支持 BTC/ETH 关键词过滤
- **5×4 网格布局**：一屏展示 20 条新闻

#### AI 新闻解读
- 自动翻译英文标题为中文
- **情绪分析**：看涨（绿）/ 看跌（红）/ 中性（灰）
- 点击新闻卡片触发**深度 AI 分析**
- 结合当前币价给出交易建议

---

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| **前端框架** | React 19 + Vite 7 |
| **图表库** | TradingView Widgets + Lightweight Charts 5 |
| **技术指标** | technicalindicators（EMA / RSI / ATR） |
| **Markdown** | react-markdown 10 |
| **样式** | CSS Variables + Glassmorphism |
| **数据 API** | CoinGecko + OKX + Google News RSS |

---

## 🚀 快速开始

### 环境要求
- Node.js 18+
- npm 或 yarn
- 本地代理（用于 API 请求）

### 安装步骤

```bash
# 1. 克隆仓库
git clone <repo-url>
cd crypto-dashboard

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev

# 4. 访问
# 本地：http://localhost:5173
```

### 代理配置

项目使用 Vite 代理转发 API 请求，默认配置本地代理 `127.0.0.1:7890`。

如需修改，编辑 `vite.config.js`：

```javascript
const proxyAgent = new HttpsProxyAgent('http://127.0.0.1:7890')
```

---

## 📁 项目结构

```
crypto-dashboard/
├── src/
│   ├── components/
│   │   ├── App.jsx              # 主应用组件
│   │   ├── PriceHeader.jsx      # 价格展示 + 币种切换
│   │   ├── TradingViewWidget.jsx # TradingView 嵌入图表
│   │   ├── CryptoChart.jsx      # Lightweight Charts 图表
│   │   ├── ChartAnalysisModal.jsx # AI 分析弹窗
│   │   └── NewsGrid.jsx         # 新闻网格 + 详情弹窗
│   ├── services/
│   │   └── api.js               # API 服务层（缓存、请求）
│   ├── utils/
│   │   └── indicators.js        # 技术指标计算工具
│   └── index.css                # 全局样式 + CSS 变量
├── vite.config.js               # Vite 配置（代理设置）
└── package.json
```

---

## 🔌 API 说明

| API | 用途 | 缓存 |
|-----|------|------|
| CoinGecko `/simple/price` | 实时币价 | 15 分钟 |
| OKX `/market/candles` | OHLC K 线数据 | 1 分钟 |
| Google News RSS | 新闻聚合 | 15 分钟 |

> ⚠️ **注意**：CoinGecko 免费 API 有限流（10-50 次/分钟），频繁刷新可能触发 429 错误。

---

## 🎨 UI 特性

- **Glassmorphism 设计**：半透明卡片 + 模糊背景
- **深色主题**：护眼暗色调，专为交易场景优化
- **响应式布局**：适配不同屏幕尺寸
- **流畅动画**：加载旋转器、悬停效果、流式文本
- **中文本土化**：界面文案全中文

---

## 📄 License

MIT License

---

## 🙏 致谢

- [TradingView](https://www.tradingview.com/) - 专业图表组件
- [Lightweight Charts](https://github.com/nicholasrice/lightweight-charts) - 轻量级图表库
- [CoinGecko](https://www.coingecko.com/) - 加密货币数据 API
- [OKX](https://www.okx.com/) - K 线数据 API
