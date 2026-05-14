# crypto-dashboard — 项目级 AI 开发约束

## 设计系统规则

### 强制约束
- 所有颜色使用 CSS 变量（`var(--xxx)`），禁止在 JSX/CSS 中硬编码 hex/rgba
- 半透明颜色使用预定义的 alpha token（如 `--color-indigo-alpha-30`），禁止直接写 `rgba()`
- 所有间距使用 `--spacing-*` token，字号使用 `--text-*` token，圆角使用 `--radius-*` token
- 所有样式写在对应组件的 `.css` 文件中，JSX 零内联样式（`style={{}}`）
- 全部图标使用 lucide-react，禁止 emoji 作为 UI 图标
- BEM 命名：每个组件一个前缀（见 DESIGN.md）

### 允许的内联样式例外
- 动态计算值：`height: ${height}px`（图表高度）
- CSS 自定义属性注入：`style={{ '--theme-color': color }}`
- 图表库 JS API 配置对象（非 DOM 样式）

### Design Token 参考
参见 `src/index.css` `:root` 块和 `DESIGN.md`

### 迁移检查清单
新增组件时确认：
1. 创建了 `Component.css` 并 import
2. 所有颜色引用 `var()`
3. 所有间距/字号引用 token
4. 图标用 lucide-react
5. 无 `style={{}}` 内联样式
6. BEM 命名与组件前缀一致

### 组件前缀表
| 组件 | 前缀 |
|------|------|
| AssetCard | `asset-card` |
| CardManager | `cm` |
| NewsGrid | `news` |
| AssetEditorModal | `editor` |
| UserSettingsModal | `usm` |
| CryptoChart | `cc` |
| LoginModal | `login` |
| SettingsModal | `sm` |
| AddAssetModal | `aam` |
| ChartAnalysisModal | `cam` |
| NewsFeed | `nf` |
| SmartChartWidget | `scw` |
| TradingViewWidget | `tvw` |
| PriceHeader | `ph` |
| NotificationPanel | `np` |
