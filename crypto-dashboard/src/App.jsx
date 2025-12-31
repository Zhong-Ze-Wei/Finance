import React, { useState, useEffect, useRef } from 'react';
import SmartChartWidget, { clearTvFailedCache } from './components/SmartChartWidget';
import NewsGrid from './components/NewsGrid';
import PriceHeader from './components/PriceHeader';
import ChartAnalysisModal from './components/ChartAnalysisModal';
import UserSettingsModal from './components/UserSettingsModal';
import { getVisibleCards } from './services/assetCards';
import { checkAllAlerts, getAlertEnabledAssets } from './services/alertService';
import { getLLMConfig, setLLMConfig, LLM_PRESETS } from './services/api';
import { getPollingSettings } from './services/userSettings';
import './index.css';

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
  const defaultCard = getVisibleCards()[0];

  const [selectedCoin, setSelectedCoin] = useState(defaultCard?.name || 'BTC');
  const [selectedAsset, setSelectedAsset] = useState(defaultCard || null);
  const [selectedInterval, setSelectedInterval] = useState('60'); // 默认1小时
  const [prices, setPrices] = useState({
    BTC: { price: 0, change24h: 0 },
    ETH: { price: 0, change24h: 0 }
  });
  const [cardPrices, setCardPrices] = useState({}); // 统一价格存储（按 card.id）
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [currentModel, setCurrentModel] = useState('deepseek');

  // 初始化模型配置
  useEffect(() => {
    const config = getLLMConfig();
    setCurrentModel(config.preset || 'deepseek');

    // 一次性清理：版本更新后清除 TradingView 失败缓存
    const lastVersion = localStorage.getItem('app_cache_version');
    if (lastVersion !== APP_CACHE_VERSION) {
      clearTvFailedCache();
      localStorage.setItem('app_cache_version', APP_CACHE_VERSION);
      console.log(`🔄 应用版本更新 ${lastVersion || 'none'} → ${APP_CACHE_VERSION}，已清理缓存`);
    }
  }, []);

  // 价格提醒监控服务
  const alertIntervalRef = useRef(null);
  const lastCheckTimeRef = useRef(null);

  useEffect(() => {
    const pollingSettings = getPollingSettings();
    const alertCheckInterval = (pollingSettings.alertCheckInterval || 60) * 1000;

    // 检查价格提醒
    const checkAlerts = async () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('zh-CN');
      lastCheckTimeRef.current = now;

      const alertAssets = getAlertEnabledAssets();
      console.log(`⏱️ [${timeStr}] 轮询检查：${alertAssets.length} 个资产启用了提醒`);

      if (alertAssets.length === 0) {
        console.log(`⏱️ [${timeStr}] 没有启用提醒的资产，跳过检查`);
        return;
      }

      // 合并所有价格数据：cardPrices (按 id) + prices (按 name)
      const allPrices = { ...cardPrices };
      // 将 prices 中的数据也加入（兼容旧的按 name 查找）
      Object.entries(prices).forEach(([name, data]) => {
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
  }, [prices, cardPrices]);

  // 切换模型
  const handleModelChange = (presetKey) => {
    const preset = LLM_PRESETS[presetKey];
    if (preset) {
      setCurrentModel(presetKey);
      setLLMConfig({
        preset: presetKey,
        baseUrl: preset.baseUrl,
        apiKey: preset.apiKey,
        model: preset.model
      });
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

  return (
    <div style={{
      minHeight: '100vh',
      padding: '1.5rem',
      background: 'linear-gradient(135deg, #0b0e11 0%, #161b22 100%)'
    }}>
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

      {/* Header */}
      <div style={{
        marginBottom: '1.5rem',
        textAlign: 'center',
        position: 'relative'
      }}>
        {/* 右上角模型切换 + 设置 */}
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>AI:</span>
          <select
            value={currentModel}
            onChange={(e) => handleModelChange(e.target.value)}
            style={{
              background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
              color: '#f0b90b',
              border: '1px solid #374151',
              borderRadius: '0.5rem',
              padding: '0.4rem 0.75rem',
              fontSize: '0.8rem',
              cursor: 'pointer',
              outline: 'none',
              fontWeight: '500',
              minWidth: '140px'
            }}
          >
            {Object.entries(LLM_PRESETS).map(([key, preset]) => (
              <option key={key} value={key}>{preset.name}</option>
            ))}
          </select>

          {/* 设置按钮 */}
          <button
            onClick={() => setSettingsModalOpen(true)}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid #374151',
              borderRadius: '0.5rem',
              padding: '0.4rem 0.75rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: '#9ca3af',
              fontSize: '0.8rem',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => { e.target.style.background = 'rgba(240, 185, 11, 0.1)'; e.target.style.borderColor = '#f0b90b'; e.target.style.color = '#f0b90b'; }}
            onMouseLeave={e => { e.target.style.background = 'rgba(255, 255, 255, 0.05)'; e.target.style.borderColor = '#374151'; e.target.style.color = '#9ca3af'; }}
            title="用户设置"
          >
            ⚙️ 设置
          </button>
        </div>

        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: '700',
          background: 'linear-gradient(135deg, #f0b90b 0%, #627eea 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '0.5rem'
        }}>
          🚀 Crypto Dashboard
        </h1>
        <p style={{ color: '#9ca3af' }}>实时价格 · 多源新闻 · AI智能分析</p>
      </div>

      {/* Price Header - 统一卡片系统 */}
      <PriceHeader
        prices={prices}
        setPrices={setPrices}
        selectedCoin={selectedCoin}
        setSelectedCoin={setSelectedCoin}
        onAssetChange={handleAssetChange}
        cardPrices={cardPrices}
        setCardPrices={setCardPrices}
      />

      {/* Main Chart Section with Controls */}
      <div className="glass" style={{ padding: '1rem', marginTop: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          {/* 左侧：币种 + 时间周期选择 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>TradingView · {selectedCoin}/USDT</span>
            {(() => {
              const isDailyOnly = selectedAsset?.ohlcId && (selectedAsset.ohlcId.endsWith('.SS') || selectedAsset.ohlcId.endsWith('.SZ') || selectedAsset.ohlcId.endsWith('.HK'));
              return (
                <select
                  value={selectedInterval}
                  onChange={(e) => setSelectedInterval(e.target.value)}
                  disabled={isDailyOnly}
                  style={{
                    background: '#1f2937',
                    color: isDailyOnly ? '#6b7280' : '#fff',
                    border: '1px solid #374151',
                    borderRadius: '0.5rem',
                    padding: '0.25rem 0.75rem',
                    fontSize: '0.85rem',
                    cursor: isDailyOnly ? 'not-allowed' : 'pointer',
                    outline: 'none'
                  }}
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
            style={{
              background: 'linear-gradient(135deg, #f0b90b 0%, #e85d04 100%)',
              color: '#000',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(240, 185, 11, 0.3)',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 6px 16px rgba(240, 185, 11, 0.4)'; }}
            onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 12px rgba(240, 185, 11, 0.3)'; }}
          >
            🤖 AI 一键诊断
          </button>
        </div>
        <div style={{ height: '500px' }}>
          <SmartChartWidget
            selectedAsset={selectedAsset}
            interval={selectedInterval}
          />
        </div>
      </div>

      {/* News Section */}
      <div className="glass" style={{ padding: '1.5rem' }}>
        <NewsGrid
          coin={selectedCoin}
          selectedCoin={selectedCoin}
          selectedAsset={selectedAsset}
          prices={prices}
        />
      </div>
    </div>
  );
}

export default App;
