import { SourcebotConfig } from "@sourcebot/schemas/v3/index.type";
import { indexSchema } from "@sourcebot/schemas/v3/index.schema";
import { readFile } from 'fs/promises';
import stripJsonComments from 'strip-json-comments';
import { Ajv } from "ajv";

const ajv = new Ajv({
    validateFormats: false,
});

// From https://developer.mozilla.org/en-US/docs/Glossary/Base64#the_unicode_problem
export const base64Decode = (base64: string): string => {
    const binString = atob(base64);
    return Buffer.from(Uint8Array.from(binString, (m) => m.codePointAt(0)!).buffer).toString();
}

export const isRemotePath = (path: string) => {
    return path.startsWith('https://') || path.startsWith('http://');
}

export const loadConfig = async (configPath: string): Promise<SourcebotConfig> => {
    const configContent = await (async () => {
        if (isRemotePath(configPath)) {
            const response = await fetch(configPath);
            if (!response.ok) {
                throw new Error(`Failed to fetch config file ${configPath}: ${response.statusText}`);
            }
            return response.text();
        } else {
            return readFile(configPath, {
                encoding: 'utf-8',
            });
        }
    })();

    const config = JSON.parse(stripJsonComments(configContent)) as SourcebotConfig;
    const isValidConfig = ajv.validate(indexSchema, config);
    if (!isValidConfig) {
        throw new Error(`Config file '${configPath}' is invalid: ${ajv.errorsText(ajv.errors)}`);
    }
    return config;
}
