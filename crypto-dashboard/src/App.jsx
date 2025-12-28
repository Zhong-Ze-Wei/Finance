import React, { useState } from 'react';
import TradingViewWidget from './components/TradingViewWidget';
import NewsGrid from './components/NewsGrid';
import PriceHeader from './components/PriceHeader';
import ChartAnalysisModal from './components/ChartAnalysisModal';
import { getVisibleCards } from './services/assetCards';
import './index.css';

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
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);

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

      {/* Header */}
      <div style={{
        marginBottom: '1.5rem',
        textAlign: 'center'
      }}>
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
          <TradingViewWidget
            coin={selectedCoin}
            symbol={selectedAsset?.symbol}
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
