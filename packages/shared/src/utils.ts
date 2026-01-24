import { readFile } from 'fs/promises';
import stripJsonComments from 'strip-json-comments';
import { z } from "zod";
import { DEFAULT_CONFIG_SETTINGS } from "./constants.js";
import { ConfigSettings } from "./types.js";
import { Repo } from "@sourcebot/db";
import path from "path";
import { env, isRemotePath, loadConfig } from "./env.server.js";

// From https://developer.mozilla.org/en-US/docs/Glossary/Base64#the_unicode_problem
export const base64Decode = (base64: string): string => {
    const binString = atob(base64);
    return Buffer.from(Uint8Array.from(binString, (m) => m.codePointAt(0)!).buffer).toString();
}

// TODO: Merge this with config loading logic which uses AJV
export const loadJsonFile = async <T>(
    filePath: string,
    schema: any
): Promise<T> => {
    const fileContent = await (async () => {
        if (isRemotePath(filePath)) {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`Failed to fetch file ${filePath}: ${response.statusText}`);
            }
            return response.text();
        } else {
            // Retry logic for handling race conditions with mounted volumes
            const maxAttempts = 5;
            const retryDelayMs = 2000;
            let lastError: Error | null = null;

            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    return await readFile(filePath, {
                        encoding: 'utf-8',
                    });
                } catch (error) {
                    lastError = error as Error;
                    
                    // Only retry on ENOENT errors (file not found)
                    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
                        throw error; // Throw immediately for non-ENOENT errors
                    }
                    
                    // Log warning before retry (except on the last attempt)
                    if (attempt < maxAttempts) {
                        console.warn(`File not found, retrying in 2s... (Attempt ${attempt}/${maxAttempts})`);
                        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
                    }
                }
            }
            
            // If we've exhausted all retries, throw the last ENOENT error
            if (lastError) {
                throw lastError;
            }
            
            throw new Error('Failed to load file after all retry attempts');
        }
    })();

    const parsedData = JSON.parse(stripJsonComments(fileContent));
    
    try {
        return schema.parse(parsedData);
    } catch (error) {
        if (error instanceof z.ZodError) {
            throw new Error(`File '${filePath}' is invalid: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
        }
        throw error;
    }
}


export const getConfigSettings = async (configPath?: string): Promise<ConfigSettings> => {
    if (!configPath) {
        return DEFAULT_CONFIG_SETTINGS;
    }

    const config = await loadConfig(configPath);

    return {
        ...DEFAULT_CONFIG_SETTINGS,
        ...config.settings,
    }
}

export const getRepoPath = (repo: Repo): { path: string, isReadOnly: boolean } => {
    // If we are dealing with a local repository, then use that as the path.
    // Mark as read-only since we aren't guaranteed to have write access to the local filesystem.
    const cloneUrl = new URL(repo.cloneUrl);
    if (repo.external_codeHostType === 'genericGitHost' && cloneUrl.protocol === 'file:') {
        return {
            path: cloneUrl.pathname,
            isReadOnly: true,
        }
    }

    const reposPath = path.join(env.DATA_CACHE_DIR, 'repos');

    return {
        path: path.join(reposPath, repo.id.toString()),
        isReadOnly: false,
    }
}