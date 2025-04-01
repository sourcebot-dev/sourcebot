import dotenv from 'dotenv';

export const getEnv = (env: string | undefined, defaultValue?: string) => {
	return env ?? defaultValue;
}

dotenv.config({
    path: './.env.local',
    override: true
});

// @note: You can use https://generate-random.org/encryption-key-generator to create a new 32 byte key
export const SOURCEBOT_ENCRYPTION_KEY = getEnv(process.env.SOURCEBOT_ENCRYPTION_KEY);