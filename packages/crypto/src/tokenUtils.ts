import { Token } from "@sourcebot/schemas/v3/shared.type";

export const getTokenFromConfig = async (token: Token) => {
    if ('env' in token) {
        const envToken = process.env[token.env];
        if (!envToken) {
            throw new Error(`Environment variable ${token.env} not found.`);
        }

        return envToken;
    } else {
        throw new Error('Invalid token configuration');
    }
}; 