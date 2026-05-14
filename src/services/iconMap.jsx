// iconMap.js - lucide-react 图标映射
// 数据层存储图标名称为字符串，通过此映射渲染为 lucide 组件
import React from 'react';
import {
    TrendingUp, TrendingDown, Rocket, Zap, Activity, Flame, Snowflake, BarChart3,
    Target, ArrowUpDown, MapPin, RefreshCw, Bell, BellOff, Briefcase,
    Settings, X, CheckCircle, XCircle, Loader2, Bot, Save, Plus,
    Search, Pencil, Eye, EyeOff, Trash2, Mail, AlertTriangle,
    Globe, DollarSign, Percent, Wifi, WifiOff, ChevronDown, ChevronUp,
    Info, Sun, Moon, BellRing, MessageSquare, Shield, Cpu, Sparkles,
    Lightbulb, ExternalLink, Copy, Volume2, VolumeX, Send,
    ArrowUpRight, ArrowDownRight, Minus, Hash, Newspaper
} from 'lucide-react';

const ICON_MAP = {
    // ALERT_TYPES icons
    TrendingUp,
    TrendingDown,
    Rocket,
    Zap,
    Activity,
    Flame,
    Snowflake,
    BarChart3,

    // TRIGGER_MODES icons
    Target,
    ArrowUpDown,

    // ALERT_PRESETS icons
    MapPin,
    RefreshCw,

    // Status icons
    Bell,
    BellOff,
    BellRing,
    Briefcase,

    // Action icons
    Settings,
    X,
    CheckCircle,
    XCircle,
    Loader2,
    Bot,
    Save,
    Plus,
    Search,
    Pencil,
    Eye,
    EyeOff,
    Trash2,
    Mail,
    AlertTriangle,

    // Navigation / info
    Globe,
    DollarSign,
    Percent,
    Wifi,
    WifiOff,
    ChevronDown,
    ChevronUp,
    Info,
    Sun,
    Moon,
    MessageSquare,
    Shield,
    Cpu,
    Sparkles,
    Lightbulb,
    ExternalLink,
    Copy,
    Volume2,
    VolumeX,
    Send,

    // Direction / metric icons
    ArrowUpRight,
    ArrowDownRight,
    Minus,
    Hash,
    Newspaper,
};

/**
 * 获取 lucide 图标组件
 * @param {string} name - 图标名称（与 lucide-react 导出名一致）
 * @param {object} props - 传递给图标组件的 props (size, className 等)
 * @returns {JSX.Element|null}
 */
export const getIcon = (name, props = {}) => {
    const IconComponent = ICON_MAP[name];
    if (!IconComponent) return null;
    return <IconComponent {...props} />;
};

export default ICON_MAP;
