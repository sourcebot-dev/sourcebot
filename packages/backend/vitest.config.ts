import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        watch: false,
        env: {
            DATA_CACHE_DIR: 'test-data'
        }
    }
});