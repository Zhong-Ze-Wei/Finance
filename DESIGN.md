# 设计系统规则 (Design System)

本文档定义了 crypto-dashboard 的所有设计决策，作为 AI 和人工开发的约束条件。

---

## 1. 颜色规则

### 基础语义色
| 语义 | Token | 用途 |
|------|-------|------|
| 主色 | `--color-bitcoin: #f0b90b` | 品牌、金色强调 |
| 副色 | `--color-ethereum: #627eea` | 以太坊相关 |
| 成功 | `--color-success: #10b981` | 涨、盈利、正向 |
| 危险 | `--color-danger: #ef4444` | 跌、亏损、负向 |
| 警告 | `--color-warning: #f0b90b` | 警告、注意 |
| 蓝色 | `--accent-blue: #58a6ff` | 信息、链接、交互 |
| 靛蓝 | `--color-indigo: #6366f1` | Alert 状态主题 |
| AI紫 | `--color-ai: #a855f7` | AI/分析功能 |

### Alpha 变体规则
- **禁止**在 CSS/JSX 中直接写 `rgba()`
- 必须使用预定义的 alpha token，如 `--color-indigo-alpha-30`
- 需要新的 alpha 级别时，先在 `:root` 新增 token
- 级别粒度：05/08/10/12/15/20/30/40/50

### 颜色一致性
- 绿色：统一用 `--color-success` 系列，禁止 `#3fb950`、`#22c55e`、`#34d399` 混用
- 红色：统一用 `--color-danger` 系列，禁止 `#f85149`、`#ef4444` 混用
- 蓝色：统一用 `--accent-blue` 系列，禁止 `#58a6ff`、`#60a5fa` 混用

---

## 2. 排版规则

### 字号 — 严格 5+ 级
| Token | 值 | 用途 |
|-------|-----|------|
| `--text-2xs` | 0.65rem | 极小标注 |
| `--text-xs` | 0.75rem | 辅助文字、标签 |
| `--text-sm` | 0.85rem | 次要文字 |
| `--text-base` | 0.95rem | 正文 |
| `--text-lg` | 1.1rem | 小标题 |
| `--text-xl` | 1.5rem | 区块标题 |
| `--text-2xl` | 2rem | 页面标题 |

- **禁止** `fontSize: '0.85rem'` 等内联硬编码
- 需要额外字号时先在 `:root` 新增 token

### 字重
- `400` — 正文
- `500` — 次要强调
- `600` — 标题
- `700` — 强调标题

---

## 3. 间距规则

### 间距 — 严格 5 级
| Token | 值 | 用途 |
|-------|-----|------|
| `--spacing-2xs` | 0.25rem | 极小间距 (4px) |
| `--spacing-xs` | 0.5rem | 小间距 |
| `--spacing-sm` | 0.75rem | 标准-小间距 |
| `--spacing-md` | 1rem | 标准间距 |
| `--spacing-lg` | 1.5rem | 大间距 |
| `--spacing-xl` | 2rem | 区块间距 |
| `--spacing-2xl` | 2.5rem | 页面区块间距 |

- **禁止** `padding: '12px'`、`gap: '0.5rem'` 等硬编码
- 使用 `var(--spacing-*)` 引用

---

## 4. 圆角规则

| Token | 值 | 用途 |
|-------|-----|------|
| `--radius-xs` | 0.25rem | 极小圆角 (4px) |
| `--radius-sm` | 0.375rem | 小圆角 |
| `--radius-md` | 0.5rem | 标准圆角 |
| `--radius-lg` | 0.75rem | 卡片圆角 |
| `--radius-xl` | 1rem | 大卡片圆角 |
| `--radius-2xl` | 1.5rem | 模态框圆角 |
| `--radius-full` | 2rem | 胶囊圆角 |

---

## 5. 组件命名规则 — BEM

每个组件一个 CSS 前缀：

| 组件 | 前缀 | 示例 |
|------|------|------|
| AssetCard | `asset-card` | `asset-card__price` |
| CardManager | `cm` | `cm-header__title` |
| NewsGrid | `news` | `news-card__title` |
| AssetEditorModal | `editor` | `editor-modal__header` |
| UserSettingsModal | `usm` | `usm-section__title` |
| CryptoChart | `chart` | `chart-container` |
| LoginModal | `login` | `login-modal__form` |

---

## 6. 内联样式禁令

**所有样式走 CSS class/变量，JSX 中零 `style={{}}`**

### 允许的例外
- 动态计算值：`height: ${height}px`（图表高度）
- CSS 自定义属性注入：`style={{ '--theme-color': color }}`

### 禁止
- `style={{ color: '#fff', fontSize: '14px' }}` → 提取为 CSS class
- `style={{ background: 'rgba(...)' }}` → 用 alpha token
- `style={{ display: 'flex', gap: '8px' }}` → 提取为 CSS class

---

## 7. 图标规则

- **全部使用 lucide-react SVG 图标**
- **零 emoji** 用于 UI 图标
- 国旗用文字标识（US/CN）或 Globe 图标
- 新闻情绪用 TrendingUp/TrendingDown/Scale 图标

---

## 8. 遮罩层与层级

| Token | 值 | 用途 |
|-------|-----|------|
| `--overlay` | `rgba(0,0,0,0.65)` | 标准遮罩 |
| `--overlay-heavy` | `rgba(0,0,0,0.95)` | 重遮罩（模态框） |

z-index 层级约定：
- `1-9`: 卡片、小组件
- `10-99`: 下拉、弹出层
- `100-999`: 模态框
- `1000+`: Toast、通知

---

## Design Token 参考

所有 token 定义在 `src/index.css` 的 `:root` 块中。

## 迁移检查清单

新增组件时确认：
1. 创建了 `Component.css` 并 import
2. 所有颜色引用 `var()`
3. 所有间距/字号引用 token
4. 图标用 lucide-react
5. 无 `style={{}}` 内联样式
6. BEM 命名与组件前缀一致
