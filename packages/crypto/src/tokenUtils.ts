import { Token } from "@sourcebot/schemas/v3/shared.type";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

export const getTokenFromConfig = async (token: Token): Promise<string> => {
    if ('env' in token) {
        const envToken = process.env[token.env];
        if (!envToken) {
            throw new Error(`Environment variable ${token.env} not found.`);
        }

        return envToken;
    } else if ('googleCloudSecret' in token) {
        const client = new SecretManagerServiceClient();
        const [response] = await client.accessSecretVersion({
            name: token.googleCloudSecret,
        });

        if (!response.payload?.data) {
            throw new Error(`Secret ${token.googleCloudSecret} not found.`);
        }

        return response.payload.data.toString();
    } else {
        throw new Error('Invalid token configuration');
    }
}; 