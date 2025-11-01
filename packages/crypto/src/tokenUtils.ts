import { Token } from "@sourcebot/schemas/v3/shared.type";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

export const getTokenFromConfig = async (token: Token) => {
    if ('env' in token) {
        const envToken = process.env[token.env];
        if (!envToken) {
            throw new Error(`Environment variable ${token.env} not found.`);
        }

        return envToken;
    } else if ('gcpSecretName' in token) {
        try {

        const client = new SecretManagerServiceClient();
        const [ response ] = await client.accessSecretVersion({
            name: token.gcpSecretName,
        });

        if (!response.payload?.data) {
            throw new Error(`Secret ${token.gcpSecretName} not found.`);
        }

        return response.payload.data.toString();
        } catch (error) {
            console.log("HERE IN THE EXCEPTION HANDLER");
            throw error;
        }
    } else {
        throw new Error('Invalid token configuration');
    }
}; 