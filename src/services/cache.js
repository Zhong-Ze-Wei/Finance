// ============================================
// 缓存工具 - localStorage 持久化缓存
// ============================================
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7天缓存

// 清理过期和旧缓存
const cleanupCache = () => {
    try {
        const keysToRemove = [];
        const now = Date.now();

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;

            // 只处理我们的缓存 key
            if (key.startsWith('analysis_') || key.startsWith('content_') || key.startsWith('news_')) {
                try {
                    const item = localStorage.getItem(key);
                    if (item) {
                        const parsed = JSON.parse(item);
                        // 删除过期的缓存
                        if (now - parsed.timestamp > CACHE_DURATION) {
                            keysToRemove.push(key);
                        }
                    }
                } catch {
                    keysToRemove.push(key); // 无法解析的也删除
                }
            }
        }

        keysToRemove.forEach(key => localStorage.removeItem(key));
        if (keysToRemove.length > 0) {
            console.log(`🧹 Cleaned ${keysToRemove.length} expired cache entries`);
        }
    } catch (e) {
        console.warn('Cache cleanup failed:', e);
    }
};

export const getCache = (key) => {
    try {
        const item = localStorage.getItem(key);
        if (!item) return null;
        const parsed = JSON.parse(item);
        if (Date.now() - parsed.timestamp > CACHE_DURATION) {
            localStorage.removeItem(key);
            return null;
        }
        return parsed.data;
    } catch (e) {
        return null;
    }
};

export const setCache = (key, data) => {
    try {
        localStorage.setItem(key, JSON.stringify({
            timestamp: Date.now(),
            data: data
        }));
    } catch (e) {
        // 存储满了，清理后重试
        if (e.name === 'QuotaExceededError') {
            console.warn('💾 Storage full, cleaning up...');
            cleanupCache();
            // 如果还是满，删除最旧的缓存
            try {
                let oldestKey = null;
                let oldestTime = Infinity;
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && (k.startsWith('analysis_') || k.startsWith('content_') || k.startsWith('news_'))) {
                        try {
                            const item = JSON.parse(localStorage.getItem(k));
                            if (item.timestamp < oldestTime) {
                                oldestTime = item.timestamp;
                                oldestKey = k;
                            }
                        } catch {}
                    }
                }
                if (oldestKey) {
                    localStorage.removeItem(oldestKey);
                    localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data: data }));
                }
            } catch {
                console.warn('Cache write failed after cleanup');
            }
        }
    }
};

// 启动时清理一次
cleanupCache();

// 清理指定标的的所有缓存（删除卡片时调用）
export const clearAssetCache = (assetName, newsKeywords = []) => {
    const keysToRemove = [];
    const searchTerms = [assetName, ...newsKeywords].map(t => t.toLowerCase());

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        // 清理新闻缓存 (news_xxxx)
        if (key.startsWith('news_')) {
            const keyLower = key.toLowerCase();
            if (searchTerms.some(term => keyLower.includes(term))) {
                keysToRemove.push(key);
            }
        }

        // 清理 OHLC 缓存 (ohlc_xxxx)
        if (key.startsWith('ohlc_')) {
            const keyLower = key.toLowerCase();
            if (searchTerms.some(term => keyLower.includes(term))) {
                keysToRemove.push(key);
            }
        }

        // 清理价格缓存 (price_xxxx)
        if (key.startsWith('price_')) {
            const keyLower = key.toLowerCase();
            if (searchTerms.some(term => keyLower.includes(term))) {
                keysToRemove.push(key);
            }
        }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));

    if (keysToRemove.length > 0) {
        console.log(`🧹 清理了 ${assetName} 的 ${keysToRemove.length} 条缓存`);
    }

    return keysToRemove.length;
};
