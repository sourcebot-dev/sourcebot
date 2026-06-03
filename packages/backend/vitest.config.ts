import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        environment: 'node',
        watch: false,
        env: {
            DATA_CACHE_DIR: 'test-data'
        },
        alias: {
            './prisma.js': path.resolve(__dirname, 'src/__mocks__/prisma.ts'),
        },
    }
});