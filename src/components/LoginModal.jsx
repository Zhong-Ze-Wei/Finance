import React, { useState } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import { login, register } from '../services/authService';
import './LoginModal.css';

const LoginModal = ({ isOpen, onClose, onLoginSuccess }) => {
    const [mode, setMode] = useState('login'); // 'login' | 'register'
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [email, setEmail] = useState('');
    const [nickname, setNickname] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (mode === 'register' && password !== confirmPassword) {
            setError('两次密码不一致');
            setLoading(false);
            return;
        }

        try {
            let user;
            if (mode === 'login') {
                user = await login(username, password);
            } else {
                user = await register(username, password, email, nickname);
            }
            onLoginSuccess(user);
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const switchMode = () => {
        setMode(mode === 'login' ? 'register' : 'login');
        setError('');
    };

    return (
        <div className="login-overlay" onClick={onClose}>
            <div className="login-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="login-header">
                    <h2 className="login-header__title">
                        {mode === 'login' ? <><LogIn size={18} /> 登录账户</> : <><UserPlus size={18} /> 注册账户</>}
                    </h2>
                    <p className="login-header__subtitle">
                        {mode === 'login' ? '登录后可同步您的配置和关注' : '创建账户开始使用'}
                    </p>
                </div>

                {/* Error */}
                {error && (
                    <div className="login-error">
                        {error}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        placeholder="用户名"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        className="login-input"
                        required
                        minLength={2}
                        maxLength={20}
                    />

                    <input
                        type="password"
                        placeholder="密码"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="login-input"
                        required
                        minLength={6}
                    />

                    {mode === 'register' && (
                        <>
                            <input
                                type="password"
                                placeholder="确认密码"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                className="login-input"
                                required
                            />

                            <input
                                type="text"
                                placeholder="昵称（可选）"
                                value={nickname}
                                onChange={e => setNickname(e.target.value)}
                                className="login-input"
                            />

                            <input
                                type="email"
                                placeholder="邮箱（可选，用于提醒）"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="login-input"
                            />
                        </>
                    )}

                    <button type="submit" className="login-submit-btn" disabled={loading}>
                        {loading ? '处理中...' : (mode === 'login' ? '登 录' : '注 册')}
                    </button>
                </form>

                {/* Switch Mode */}
                <div className="login-switch">
                    {mode === 'login' ? '还没有账户？' : '已有账户？'}
                    <span
                        onClick={switchMode}
                        className="login-switch__link"
                    >
                        {mode === 'login' ? '立即注册' : '去登录'}
                    </span>
                </div>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="login-close-btn"
                >
                    ×
                </button>
            </div>
        </div>
    );
};

export default LoginModal;
