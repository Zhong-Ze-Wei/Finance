// EmailManager.jsx - 账户邮箱群管理（与账户绑定，不限数量，支持主邮箱）
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Star, Mail, Send } from 'lucide-react';
import { listEmails, addEmail, removeEmail, setPrimaryEmail, migrateLegacyEmails } from '../services/emailService';
import { isLoggedIn } from '../services/authService';
import { sendTestEmail } from '../services/alertService';
import './EmailManager.css';

const EmailManager = () => {
    const [emails, setEmails] = useState([]);
    const [loading, setLoading] = useState(true);
    const [input, setInput] = useState('');
    const [error, setError] = useState(null);
    const [sendingTest, setSendingTest] = useState(false);
    const [testResult, setTestResult] = useState(null);

    const reload = useCallback(async () => {
        try {
            let list = await listEmails();
            list = await migrateLegacyEmails(list);
            setEmails(list);
            setError(null);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { if (isLoggedIn()) reload(); else setLoading(false); }, [reload]);

    const handleAdd = async () => {
        const email = input.trim();
        if (!email) return;
        setSendingTest(true);
        try {
            setEmails(await addEmail(email));
            setInput('');
            setError(null);
        } catch (e) {
            setError(e.message);
        } finally {
            setSendingTest(false);
        }
    };

    const handleRemove = async (email) => {
        try {
            setEmails(await removeEmail(email));
        } catch (e) {
            setError(e.message);
        }
    };

    const handlePrimary = async (email) => {
        try {
            setEmails(await setPrimaryEmail(email));
        } catch (e) {
            setError(e.message);
        }
    };

    const handleTest = async () => {
        setSendingTest(true);
        setTestResult(null);
        try {
            const result = await sendTestEmail();
            setTestResult(result);
        } catch (e) {
            setTestResult({ success: false, message: e.message });
        } finally {
            setSendingTest(false);
        }
    };

    if (!isLoggedIn()) {
        return <div className="em-hint">登录后可维护账户绑定的提醒邮箱（数量不限，跨设备同步）</div>;
    }

    return (
        <div className="em">
            {loading ? (
                <div className="em-hint">加载中...</div>
            ) : (
                <>
                    <div className="em-list">
                        {emails.map(e => (
                            <div key={e.email} className={'em-item' + (e.is_primary ? ' em-item--primary' : '')}>
                                <Mail size={14} className="em-item__icon" />
                                <span className="em-item__addr" title={e.email}>{e.email}</span>
                                {e.is_primary && <span className="em-badge">主邮箱</span>}
                                <div className="em-item__actions">
                                    {!e.is_primary && (
                                        <button type="button" className="em-icon-btn" title="设为主邮箱" onClick={() => handlePrimary(e.email)}>
                                            <Star size={13} />
                                        </button>
                                    )}
                                    <button type="button" className="em-icon-btn em-icon-btn--danger" title="删除" onClick={() => handleRemove(e.email)}>
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {emails.length === 0 && <div className="em-hint">还没有邮箱，添加一个开始接收价格提醒</div>}
                    </div>

                    <div className="em-add">
                        <input
                            className="em-input"
                            value={input}
                            onChange={ev => setInput(ev.target.value)}
                            onKeyDown={ev => { if (ev.key === 'Enter') { ev.preventDefault(); handleAdd(); } }}
                            placeholder="输入邮箱地址，回车添加"
                        />
                        <button type="button" className="em-btn" onClick={handleAdd} disabled={sendingTest || !input.trim()}>
                            <Plus size={14} /> 添加
                        </button>
                    </div>

                    <div className="em-footer">
                        <button type="button" className="em-btn" onClick={handleTest} disabled={sendingTest || emails.length === 0}>
                            <Send size={13} /> {sendingTest ? '发送中...' : '发送测试邮件'}
                        </button>
                        {testResult && (
                            <span className={'em-test ' + (testResult.success ? 'em-test--ok' : 'em-test--fail')}>
                                {testResult.message}
                            </span>
                        )}
                    </div>

                    {error && <div className="em-test em-test--fail">{error}</div>}
                </>
            )}
        </div>
    );
};

export default EmailManager;
