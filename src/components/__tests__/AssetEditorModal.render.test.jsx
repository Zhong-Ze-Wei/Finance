import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import AssetEditorModal from '../AssetEditorModal';

describe('AssetEditorModal render', () => {
    it('renders without crashing for a basic card', async () => {
        const el = document.createElement('div');
        document.body.appendChild(el);

        const root = createRoot(el);
        const card = {
            id: 'test-card',
            name: 'BTC',
            symbol: 'BINANCE:BTCUSDT',
            category: '加密货币',
            newsKeywords: ['BTC'],
            position: {
                enabled: false,
                direction: 'long',
                amount: 0,
                entryPrice: 0,
                currency: 'USD'
            },
            alert: {
                enabled: false,
                conditions: [],
                cooldownMinutes: 240,
                lastTriggered: {},
                dailyLimit: 5,
                dailyCount: 0,
                dailyResetDate: null
            }
        };

        expect(() => {
            root.render(
                <AssetEditorModal
                    isOpen={true}
                    onClose={vi.fn()}
                    card={card}
                    currentPrice={100}
                    onUpdate={vi.fn()}
                />
            );
        }).not.toThrow();
    });

    it('renders without crashing when alert conditions exist', async () => {
        const el = document.createElement('div');
        document.body.appendChild(el);

        const root = createRoot(el);
        const card = {
            id: 'test-alert-card',
            name: 'ETH',
            symbol: 'BINANCE:ETHUSDT',
            category: '加密货币',
            newsKeywords: ['ETH'],
            position: {
                enabled: false,
                direction: 'long',
                amount: 0,
                entryPrice: 0,
                currency: 'USD'
            },
            alert: {
                enabled: true,
                conditions: [
                    { type: 'price_above', value: 3000, triggerMode: 'cross' }
                ],
                cooldownMinutes: 240,
                lastTriggered: {},
                dailyLimit: 5,
                dailyCount: 0,
                dailyResetDate: null
            }
        };

        expect(() => {
            root.render(
                <AssetEditorModal
                    isOpen={true}
                    onClose={vi.fn()}
                    card={card}
                    currentPrice={2800}
                    onUpdate={vi.fn()}
                />
            );
        }).not.toThrow();
    });
});
