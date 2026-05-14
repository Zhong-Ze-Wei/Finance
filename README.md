# 🚀 Crypto Dashboard - 全能智投仪表板

一个功能完整的加密货币投资仪表板，集成实时行情、智能分析、价格提醒和多源新闻聚合。

![React](https://img.shields.io/badge/React-19.2.3-61DAFB?logo=react)
![Vite](https://img.shields.io/badge/Vite-7.2.4-646CFF?logo=vite)
![TradingView](https://img.shields.io/badge/TradingView-Widgets-131722?logo=tradingview)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ 核心功能

### 📊 实时价格监控
- **多资产支持**：加密货币、A股、港股、美股
- **自定义资产卡片**：添加任意标的进行追踪
- **实时价格更新**：通过 CoinGecko API 获取最新价格
- **24 小时涨跌幅**：直观的红绿色涨跌指示
- **智能缓存**：15 分钟缓存策略，减少 API 调用

### 🔐 用户认证系统
- **注册/登录**：完整的用户注册与登录流程
- **会话管理**：7天有效期 Token，自动续期
- **个性化配置**：每个用户独立的资产列表和设置
- **数据同步**：登录后自动同步云端配置

### 🚨 智能价格提醒
- **轮询监控**：可配置检查间隔（默认60秒）
- **邮件通知**：价格触发时自动发送邮件
- **双向提醒**：支持向上突破和向下跌破
- **批量管理**：可为多个资产同时设置提醒

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
| **后端框架** | Express 4 (Node.js) |
| **数据库** | MySQL 8.0 |
| **图表库** | TradingView Widgets + Lightweight Charts 5 |
| **技术指标** | technicalindicators（EMA / RSI / ATR） |
| **AI 模型** | 小米 Mimo / DeepSeek / GLM（AI 分析与新闻解读） |
| **Markdown** | react-markdown 10 |
| **样式** | CSS Variables + Glassmorphism |
| **数据 API** | CoinGecko + OKX + 新浪财经 + Yahoo Finance + Google News RSS |
| **部署** | Docker Compose |

---

## 🚀 快速开始

### 环境要求
- Node.js 18+
- npm 或 yarn
- MySQL 8.0（或通过 Docker 启动）
- 本地代理（Clash/V2Ray 等，用于访问 CoinGecko 等境外 API）

### 方式一：Docker 一键启动（推荐）

```bash
# 1. 克隆仓库
git clone <repo-url>
cd crypto-dashboard

# 2. 复制并编辑环境变量
cp .env.example .env
# 编辑 .env，填入你的 API Key（至少填写 AI 模型的 Key）

# 3. 一键启动（MySQL + 后端 + 前端）
docker-compose up -d

# 4. 访问
# 前端：http://localhost:5173
# 后端：http://localhost:3001
```

### 方式二：本地开发

```bash
# 1. 克隆仓库
git clone <repo-url>
cd crypto-dashboard

# 2. 准备 MySQL 数据库
# 方式 A：用 Docker 只启动数据库
docker-compose up -d mysql
# 方式 B：使用本地已有的 MySQL，手动创建数据库 crypto_dashboard

# 3. 安装前端依赖
npm install

# 4. 安装后端依赖
cd server && npm install && cd ..

# 5. 复制并编辑环境变量
cp .env.example .env
# 编辑 .env，填写必要的配置（见下方说明）

# 6. 启动后端（终端 1）
cd server && npm run dev

# 7. 启动前端（终端 2）
npm run dev

# 8. 访问 http://localhost:5173
```

---

## ⚙️ 环境变量配置

复制 `.env.example` 为 `.env`，按需填写：

```bash
cp .env.example .env
```

### 必须配置

| 变量 | 说明 | 获取方式 |
|------|------|----------|
| `VITE_MIMO_API_KEY` | AI 分析功能（K线诊断、新闻解读） | [小米 Mimo API](https://api.xiaomimimo.com) |

### 可选配置

| 变量 | 说明 | 不填的影响 |
|------|------|------------|
| `VITE_AIPING_API_KEY` | 备用 AI（DeepSeek/GLM等） | 使用 Mimo 即可 |
| `VITE_EMAILJS_*` | 价格提醒邮件通知 | 邮件提醒不可用 |
| `VITE_ALERT_EMAIL` | 接收提醒的邮箱 | 邮件提醒不可用 |
| `VITE_TAVILY_API_KEY` | 新闻全文搜索增强 | 新闻功能受限 |
| `MYSQL_*` | 数据库连接信息 | Docker 环境有默认值 |

### 代理配置

项目需要通过代理访问 CoinGecko、Google News 等境外 API。默认使用 `127.0.0.1:7890`。

如需修改，编辑 `vite.config.js` 中的代理地址：

```javascript
const proxyAgent = new HttpsProxyAgent('http://127.0.0.1:7890')  // 改为你的代理地址
```

> OKX 和新浪财经 API 在中国大陆可直接访问，无需代理。

---

## 📁 项目结构

```
crypto-dashboard/
├── src/                        # 前端（React + Vite）
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
├── server/                      # 后端（Express + MySQL）
│   ├── index.js                 # API 服务（用户认证、数据持久化）
│   ├── db/
│   │   ├── schema.sql           # 数据库表结构
│   │   └── init.sql             # 初始化数据
│   └── package.json
├── docker-compose.yml           # Docker 编排（MySQL + 后端 + 前端）
├── Dockerfile                   # 后端生产镜像
├── Dockerfile.dev               # 前端开发镜像
├── vite.config.js               # Vite 配置（代理设置）
├── .env.example                 # 环境变量模板
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
