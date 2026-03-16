import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        watch: false,
        env: {
            AUTH_SECRET: 'test-secret',
            AUTH_URL: 'http://localhost:3000',
            DATA_CACHE_DIR: '/tmp/test-data',
            SOURCEBOT_PUBLIC_KEY_PATH: '/tmp/test-key',
            NODE_ENV: 'test',
            CONFIG_PATH: '/tmp/test-config.json',
            SOURCEBOT_ENCRYPTION_KEY: 'test-encryption-key-32-characters!',
        }
    }
});
