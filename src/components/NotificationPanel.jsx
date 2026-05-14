// NotificationPanel.jsx - 通知历史面板
import React, { useState, useEffect } from 'react';
import { Bell, BellOff, FlaskConical, Megaphone } from 'lucide-react';
import { getNotificationHistory, clearNotificationHistory, NOTIFICATION_HISTORY_KEY } from '../services/notificationService';
import './NotificationPanel.css';

const NotificationPanel = ({ isOpen, onClose }) => {
    const [history, setHistory] = useState([]);

    useEffect(() => {
        if (isOpen) {
            setHistory(getNotificationHistory());
        }
    }, [isOpen]);

    // 监听新通知
    useEffect(() => {
        if (!isOpen) return;

        const checkUpdate = () => {
            setHistory(getNotificationHistory());
        };

        // 简单轮询检测变化
        const interval = setInterval(checkUpdate, 2000);
        return () => clearInterval(interval);
    }, [isOpen]);

    if (!isOpen) return null;

    const handleClear = () => {
        clearNotificationHistory();
        setHistory([]);
    };

    const formatTime = (ts) => {
        const d = new Date(ts);
        return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    const typeIcon = (type) => {
        switch (type) {
            case 'price_alert': return <Bell size={14} />;
            case 'test': return <FlaskConical size={14} />;
            default: return <Megaphone size={14} />;
        }
    };

    return (
        <div className="np-overlay" onClick={onClose}>
            <div className="np-panel" onClick={e => e.stopPropagation()}>

                {/* 头部 */}
                <div className="np-header">
                    <h3 className="np-header__title"><Bell size={18} /> 通知中心</h3>
                    <div className="np-header__actions">
                        {history.length > 0 && (
                            <button onClick={handleClear} className="btn-ghost">
                                清空
                            </button>
                        )}
                        <button onClick={onClose} className="np-header__close">×</button>
                    </div>
                </div>

                {/* 通知列表 */}
                <div className="np-list">
                    {history.length === 0 ? (
                        <div className="np-empty">
                            <p className="np-empty__icon"><BellOff size={24} /></p>
                            <p>暂无通知</p>
                            <p className="np-empty__hint">价格提醒触发时会在这里显示</p>
                        </div>
                    ) : (
                        history.map(item => (
                            <div key={item.id} className="np-item">
                                <span className="np-item__icon">{typeIcon(item.type)}</span>
                                <div className="np-item__content">
                                    <div className="np-item__title">
                                        {item.title}
                                    </div>
                                    {item.body && (
                                        <div className="np-item__body">
                                            {item.body}
                                        </div>
                                    )}
                                    <div className="np-item__time">
                                        {formatTime(item.timestamp)}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotificationPanel;
