import React, { useState, useEffect, useRef } from 'react';
import { Rocket, Bell, Settings, Bot, LogIn, User, BarChart3, CreditCard, Newspaper, Cog } from 'lucide-react';
import SmartChartWidget, { clearTvFailedCache } from './components/SmartChartWidget';
import NewsGrid from './components/NewsGrid';
import PriceHeader from './components/PriceHeader';
import ChartAnalysisModal from './components/ChartAnalysisModal';
import UserSettingsModal from './components/UserSettingsModal';
import LoginModal from './components/LoginModal';
import NotificationPanel from './components/NotificationPanel';
import { requestNotificationPermission } from './services/notificationService';
import { getVisibleCards } from './services/assetCards';
import { checkAllAlerts, getAlertEnabledAssets } from './services/alertService';
import { getLLMConfig, setLLMConfig, LLM_PRESETS } from './services/api';
import { getPollingSettings, getAISettings } from './services/userSettings';
import { isLoggedIn, getStoredUser, logout, fetchCurrentUser } from './services/authService';
import './index.css';
import './App.css';

// 版本号 - 用于清理缓存
const APP_CACHE_VERSION = 'v0.1.1';

// 时间周期选项
const INTERVALS = [
  { value: '15', label: '15分钟' },
  { value: '60', label: '1小时' },
  { value: '240', label: '4小时' },
  { value: 'D', label: '日线' },
];

function App() {
  // 获取默认选中的卡片（第一张可见卡片）
  const [selectedCoin, setSelectedCoin] = useState('BTC');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [selectedInterval, setSelectedInterval] = useState('60'); // 默认1小时
  const [prices, setPrices] = useState({
    BTC: { price: 0, change24h: 0 },
    ETH: { price: 0, change24h: 0 }
  });
  const [cardPrices, setCardPrices] = useState({}); // 统一价格存储（按 card.id）
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(getStoredUser());
  const [cardsLoaded, setCardsLoaded] = useState(false);

  // 初始化模型配置（从用户设置读取）
  useEffect(() => {
    const aiSettings = getAISettings();
    const presetKey = aiSettings.preset || 'deepseek';
    const preset = LLM_PRESETS[presetKey];
    if (preset) {
      setLLMConfig({
        preset: presetKey,
        model: preset.model
      });
    }

    // 一次性清理：版本更新后清除 TradingView 失败缓存
    const lastVersion = localStorage.getItem('app_cache_version');
    if (lastVersion !== APP_CACHE_VERSION) {
      clearTvFailedCache();
      localStorage.setItem('app_cache_version', APP_CACHE_VERSION);
      console.log(`🔄 应用版本更新 ${lastVersion || 'none'} → ${APP_CACHE_VERSION}，已清理缓存`);
    }

    // 请求浏览器通知权限
    requestNotificationPermission();
  }, []);

  // 初始化卡片（等待加载完成后再设置默认选中）
  useEffect(() => {
    const initializeCards = async () => {
      try {
        const visibleCards = await getVisibleCards();
        if (visibleCards.length > 0) {
          const defaultCard = visibleCards[0];
          setSelectedAsset(defaultCard);
          setSelectedCoin(defaultCard.name);
        }
        setCardsLoaded(true);
      } catch (error) {
        console.error('初始化卡片失败:', error);
        // 使用默认值
        setSelectedCoin('BTC');
        setCardsLoaded(true);
      }
    };

    initializeCards();
  }, []);

  // 价格提醒监控服务
  const alertIntervalRef = useRef(null);
  const lastCheckTimeRef = useRef(null);

  // 使用 ref 存储最新价格，避免 useEffect 依赖导致轮询服务重启
  const pricesRef = useRef(prices);
  const cardPricesRef = useRef(cardPrices);

  // 同步更新 ref（不触发轮询 useEffect）
  useEffect(() => {
    pricesRef.current = prices;
    cardPricesRef.current = cardPrices;
  }, [prices, cardPrices]);

  useEffect(() => {
    const pollingSettings = getPollingSettings();
    const alertCheckInterval = (pollingSettings.alertCheckInterval || 60) * 1000;

    // 检查价格提醒
    const checkAlerts = async () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('zh-CN');
      lastCheckTimeRef.current = now;

      const alertAssets = await getAlertEnabledAssets();
      console.log(`⏱️ [${timeStr}] 轮询检查：${alertAssets.length} 个资产启用了提醒`);

      if (alertAssets.length === 0) {
        console.log(`⏱️ [${timeStr}] 没有启用提醒的资产，跳过检查`);
        return;
      }

      // 使用 ref 获取最新价格（避免闭包问题）
      const allPrices = { ...cardPricesRef.current };
      Object.entries(pricesRef.current).forEach(([name, data]) => {
        if (data?.price > 0) {
          allPrices[name] = data;
        }
      });

      const priceCount = Object.keys(allPrices).filter(k => allPrices[k]?.price > 0).length;
      console.log(`⏱️ [${timeStr}] 当前价格数据：${priceCount} 个资产`);

      const results = await checkAllAlerts(allPrices);
      if (results.length > 0) {
        console.log(`🚨 [${timeStr}] 触发 ${results.length} 个提醒:`, results);
      }
    };

    // 启动定时检查（使用用户设置的间隔）
    console.log(`🔄 启动提醒轮询服务，间隔: ${alertCheckInterval / 1000}秒`);
    alertIntervalRef.current = setInterval(checkAlerts, alertCheckInterval);

    // 首次延迟10秒后检查（等待价格数据加载）
    const initialCheck = setTimeout(() => {
      console.log('🔄 首次提醒检查（延迟10秒）');
      checkAlerts();
    }, 10000);

    return () => {
      console.log('🔄 停止提醒轮询服务');
      clearInterval(alertIntervalRef.current);
      clearTimeout(initialCheck);
    };
  }, []); // 空依赖 - 只在挂载时创建一次

  // 监听登出事件
  useEffect(() => {
    const handleLogout = () => setCurrentUser(null);
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);

  // 登录成功处理
  const handleLoginSuccess = async (user) => {
    setCurrentUser(user);
    // 重新加载卡片（从服务器）
    try {
      const visibleCards = await getVisibleCards();
      if (visibleCards.length > 0) {
        const defaultCard = visibleCards[0];
        setSelectedAsset(defaultCard);
        setSelectedCoin(defaultCard.name);
      }
      // 不再强制刷新，依赖React状态更新
      console.log('✅ 登录成功，卡片已加载');
    } catch (error) {
      console.error('登录后加载卡片失败:', error);
    }
  };

  // 登出处理
  const handleLogout = async () => {
    await logout();
    setCurrentUser(null);
    // 清除本地卡片数据
    localStorage.removeItem('asset_cards');
    // 重新加载默认卡片
    try {
      const visibleCards = await getVisibleCards();
      if (visibleCards.length > 0) {
        const defaultCard = visibleCards[0];
        setSelectedAsset(defaultCard);
        setSelectedCoin(defaultCard.name);
      }
    } catch (error) {
      console.error('登出后加载卡片失败:', error);
    }
  };

  // 处理资产卡片选择变更
  const handleAssetChange = (asset) => {
    setSelectedAsset(asset);
    setSelectedCoin(asset.name);

    // 如果是中国股票/港股，强制使用日线
    const isChineseStock = asset?.ohlcId && (asset.ohlcId.endsWith('.SS') || asset.ohlcId.endsWith('.SZ') || asset.ohlcId.endsWith('.HK'));
    if (isChineseStock) {
      setSelectedInterval('D');
    }
  };

  if (!cardsLoaded) {
    return <div className="app-loading">
      <div className="app-loading__inner">
        <div className="shimmer app-loading__shimmer-title"></div>
        <div className="shimmer app-loading__shimmer-card"></div>
        <p>正在加载仪表板...</p>
      </div>
    </div>;
  }

  return (
    <div className="app-container">
      {/* AI Analysis Modal */}
      <ChartAnalysisModal
        isOpen={analysisModalOpen}
        onClose={() => setAnalysisModalOpen(false)}
        selectedAsset={selectedAsset}
        selectedCoin={selectedCoin}
        selectedInterval={selectedInterval}
      />

      {/* User Settings Modal */}
      <UserSettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />

      {/* Login Modal */}
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Notification Panel */}
      <NotificationPanel
        isOpen={notificationPanelOpen}
        onClose={() => setNotificationPanelOpen(false)}
      />

      {/* Header */}
      <div className="app-header">
        {/* 右上角操作按钮 */}
        <div className="app-header__actions">
          {currentUser ? (
            <div className="app-header__user">
              <span className="app-header__username">
                <User size={14} /> {currentUser.nickname || currentUser.username}
              </span>
              <button onClick={handleLogout} className="btn-ghost">
                退出
              </button>
            </div>
          ) : (
            <button
              onClick={() => setLoginModalOpen(true)}
              className="btn btn-success app-header__login-btn"
            >
              <LogIn size={14} /> 登录
            </button>
          )}
          <button
            onClick={() => setNotificationPanelOpen(true)}
            className="btn-ghost"
            title="通知中心"
          >
            <Bell size={16} /> 通知
          </button>
          <button
            onClick={() => setSettingsModalOpen(true)}
            className="btn-ghost"
            title="用户设置"
          >
            <Settings size={16} /> 设置
          </button>
        </div>

        <h1 className="app-title">
          <Rocket size={28} style={{verticalAlign: 'middle', marginRight: '0.5rem'}} /> Crypto Dashboard
        </h1>
        <p className="app-subtitle">
          实时价格 · 多源新闻 · AI智能分析
        </p>
      </div>

      {/* Price Header - 统一卡片系统 */}
      <div id="section-cards">
      <PriceHeader
        prices={prices}
        setPrices={setPrices}
        selectedCoin={selectedCoin}
        setSelectedCoin={setSelectedCoin}
        onAssetChange={handleAssetChange}
        cardPrices={cardPrices}
        setCardPrices={setCardPrices}
      />
      </div>

      {/* Main Chart Section with Controls */}
      <div id="section-chart" className="glass app-chart-section">
        <div className="app-chart-controls">
          {/* 左侧：币种 + 时间周期选择 */}
          <div className="app-chart-controls__left">
            <span className="app-chart-controls__label">
              TradingView · {selectedCoin}/USDT
            </span>
            {(() => {
              const isDailyOnly = selectedAsset?.ohlcId && (selectedAsset.ohlcId.endsWith('.SS') || selectedAsset.ohlcId.endsWith('.SZ') || selectedAsset.ohlcId.endsWith('.HK'));
              return (
                <select
                  value={selectedInterval}
                  onChange={(e) => setSelectedInterval(e.target.value)}
                  disabled={isDailyOnly}
                  className={`select ${isDailyOnly ? 'app-chart-controls__select--daily-only' : 'app-chart-controls__select--normal'}`}
                  title={isDailyOnly ? "该标的仅支持日线数据" : "选择时间周期"}
                >
                  {INTERVALS.map(opt => (
                    <option key={opt.value} value={opt.value} disabled={isDailyOnly && opt.value !== 'D'}>
                      {opt.label} {isDailyOnly && opt.value !== 'D' ? '(不支持)' : ''}
                    </option>
                  ))}
                </select>
              );
            })()}
          </div>

          {/* 右侧：AI 诊断按钮 */}
          <button
            onClick={() => setAnalysisModalOpen(true)}
            className="btn-gold app-chart-ai-btn"
          >
            <Bot size={16} /> AI 一键诊断
          </button>
        </div>
        <div className="chart-container">
          <SmartChartWidget
            selectedAsset={selectedAsset}
            interval={selectedInterval}
          />
        </div>
      </div>

      {/* News Section */}
      <div id="section-news" className="glass app-news-section">
        <NewsGrid
          coin={selectedCoin}
          selectedCoin={selectedCoin}
          selectedAsset={selectedAsset}
          prices={prices}
        />
      </div>

      {/* 移动端底部导航栏 */}
      <nav className="bottom-nav">
        <button className="bottom-nav__item" onClick={() => document.getElementById('section-chart')?.scrollIntoView({ behavior: 'smooth' })}>
          <BarChart3 size={20} /> 图表
        </button>
        <button className="bottom-nav__item" onClick={() => document.getElementById('section-cards')?.scrollIntoView({ behavior: 'smooth' })}>
          <CreditCard size={20} /> 卡片
        </button>
        <button className="bottom-nav__item" onClick={() => document.getElementById('section-news')?.scrollIntoView({ behavior: 'smooth' })}>
          <Newspaper size={20} /> 新闻
        </button>
        <button className="bottom-nav__item" onClick={() => setSettingsModalOpen(true)}>
          <Cog size={20} /> 设置
        </button>
      </nav>
    </div>
  );
}

export default App;
