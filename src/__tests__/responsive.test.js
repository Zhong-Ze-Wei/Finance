import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('响应式 CSS 断点', () => {
    const cssPath = path.resolve(__dirname, '../index.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    it('应包含移动端 (max-width: 768px) media query', () => {
        expect(css).toContain('@media');
        expect(css).toContain('768px');
    });

    it('应包含平板端 (max-width: 1024px) media query', () => {
        expect(css).toContain('1024px');
    });
});
