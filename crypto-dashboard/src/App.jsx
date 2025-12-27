import React, { useState } from 'react';
import CryptoChart from './components/CryptoChart';
import NewsGrid from './components/NewsGrid';
import PriceHeader from './components/PriceHeader';
import './index.css';

function App() {
  const [selectedCoin, setSelectedCoin] = useState('BTC');
  const [prices, setPrices] = useState({
    BTC: { price: 0, change24h: 0 },
    ETH: { price: 0, change24h: 0 }
  });

  return (
    <div style={{
      minHeight: '100vh',
      padding: '1.5rem',
      background: 'linear-gradient(135deg, #0b0e11 0%, #161b22 100%)'
    }}>
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

      {/* Price Header - 点击切换BTC/ETH */}
      <PriceHeader
        prices={prices}
        setPrices={setPrices}
        selectedCoin={selectedCoin}
        setSelectedCoin={setSelectedCoin}
      />

      {/* Chart Section */}
      <div className="glass" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
        <CryptoChart coin={selectedCoin} />
      </div>

      {/* News Section */}
      <div className="glass" style={{ padding: '1.5rem' }}>
        <NewsGrid coin={selectedCoin} selectedCoin={selectedCoin} prices={prices} />
      </div>
    </div>
  );
}

export default App;
