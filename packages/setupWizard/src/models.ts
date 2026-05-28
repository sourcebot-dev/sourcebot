import { confirm, input, password, select } from '@inquirer/prompts';
import { select as searchSelect } from 'inquirer-select-pro';
import type {
    AmazonBedrockLanguageModel,
    AzureLanguageModel,
    GoogleVertexAnthropicLanguageModel,
    GoogleVertexLanguageModel,
    LanguageModel,
    OpenAICompatibleLanguageModel,
} from '@sourcebot/schemas/v3/languageModel.type';
import { INPUT_THEME, note, type EnvVars } from './utils.js';

type Provider = LanguageModel['provider'];

export const PROVIDER_ENV_KEYS: Record<string, string> = {
    'anthropic': 'ANTHROPIC_API_KEY',
    'openai': 'OPENAI_API_KEY',
    'google-generative-ai': 'GOOGLE_GENERATIVE_AI_API_KEY',
    'deepseek': 'DEEPSEEK_API_KEY',
    'mistral': 'MISTRAL_API_KEY',
    'xai': 'XAI_API_KEY',
    'openrouter': 'OPENROUTER_API_KEY',
    'openai-compatible': 'OPENAI_COMPATIBLE_API_KEY',
    'azure': 'AZURE_OPENAI_API_KEY',
};

// ─── models.dev catalog ────────────────────────────────────────────────────

type ModelsDevModel = {
    id: string;
    name?: string;
    release_date?: string;
};

type ModelsDevProvider = {
    id: string;
    name?: string;
    models?: Record<string, ModelsDevModel>;
};

type ModelsDevCatalog = Record<string, ModelsDevProvider>;

type ModelOption = {
    id: string;
    name: string;
    releaseDate?: string;
};

const MODELS_DEV_API_URL = 'https://models.dev/api.json';
const FETCH_TIMEOUT_MS = 8000;

const PROVIDER_ID_OVERRIDES: Record<string, string> = {
    'google-generative-ai': 'google',
};

let catalogPromise: Promise<ModelsDevCatalog | null> | null = null;

async function loadCatalog(): Promise<ModelsDevCatalog | null> {
    if (!catalogPromise) {
        catalogPromise = (async () => {
            try {
                const response = await fetch(MODELS_DEV_API_URL, {
                    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
                });
                if (!response.ok) {
                    return null;
                }
                return await response.json() as ModelsDevCatalog;
            } catch {
                return null;
            }
        })();
    }
    return catalogPromise;
}

async function getModelOptionsForProvider(providerKey: string): Promise<ModelOption[] | null> {
    const catalog = await loadCatalog();
    if (!catalog) {
        return null;
    }
    const providerId = PROVIDER_ID_OVERRIDES[providerKey] ?? providerKey;
    const provider = catalog[providerId];
    if (!provider || !provider.models) {
        return null;
    }
    const models = Object.values(provider.models);
    if (models.length === 0) {
        return null;
    }
    return models
        .map((m) => ({
            id: m.id,
            name: m.name || m.id,
            releaseDate: m.release_date,
        }))
        .sort((a, b) => {
            if (a.releaseDate && b.releaseDate) {
                return b.releaseDate.localeCompare(a.releaseDate);
            }
            if (a.releaseDate) {
                return -1;
            }
            if (b.releaseDate) {
                return 1;
            }
            return a.name.localeCompare(b.name);
        });
}

// ─── prompts ───────────────────────────────────────────────────────────────

async function searchModel(options: {
    message: string;
    models: ModelOption[];
}): Promise<string> {
    const choices = options.models.map((m) => ({
        name: m.name === m.id ? m.id : `${m.id}  ·  ${m.name}`,
        value: m.id,
    }));

    const result = await searchSelect<string, false>({
        message: options.message,
        multiple: false,
        loop: false,
        clearInputWhenSelected: false,
        placeholder: 'Type to search models, or enter a custom name',
        options: async (search) => {
            const trimmed = (search ?? '').trim();
            if (!trimmed) {
                return choices;
            }
            const lowered = trimmed.toLowerCase();
            const filtered = choices.filter((c) =>
                c.value.toLowerCase().includes(lowered) || c.name.toLowerCase().includes(lowered),
            );
            const hasExact = choices.some((c) => c.value === trimmed);
            if (!hasExact) {
                filtered.unshift({ name: `${trimmed}  (custom)`, value: trimmed });
            }
            return filtered;
        },
    });
    if (result === null) {
        throw new Error('Model name is required');
    }
    return result;
}

async function ensureApiKey(provider: Provider, env: EnvVars): Promise<string> {
    const envKey = PROVIDER_ENV_KEYS[provider] ?? `${provider.toUpperCase().replace(/-/g, '_')}_API_KEY`;
    if (!env[envKey]) {
        const apiKey = await password({
            message: `API key (stored locally in .env as ${envKey})`,
            mask: true,
            validate: (v) => !v?.trim() ? 'API key is required' : true,
        });
        env[envKey] = apiKey;
    }
    return envKey;
}

async function collectModelConfig(
    provider: Provider,
    model: string,
    env: EnvVars,
): Promise<LanguageModel> {
    switch (provider) {
        case 'anthropic':
        case 'openai':
        case 'google-generative-ai':
        case 'deepseek':
        case 'mistral':
        case 'xai':
        case 'openrouter': {
            const envKey = await ensureApiKey(provider, env);
            return { provider, model, token: { env: envKey } } satisfies LanguageModel;
        }
        case 'openai-compatible': {
            const baseUrl = await input({
                message: 'Base URL (e.g. https://your-endpoint.example.com/v1)',
                validate: (v) => {
                    if (!v?.trim()) {
                        return 'Base URL is required';
                    }
                    if (!/^https?:\/\//.test(v)) {
                        return 'Must start with http:// or https://';
                    }
                    return true;
                },
            });
            const envKey = await ensureApiKey(provider, env);
            const config: OpenAICompatibleLanguageModel = {
                provider,
                model,
                baseUrl,
                token: { env: envKey },
            };
            return config;
        }
        case 'azure': {
            const resourceName = await input({
                message: 'Azure resource name',
                validate: (v) => !v?.trim() ? 'Resource name is required' : true,
            });
            const apiVersion = await input({
                message: 'API version',
                default: '2024-08-01-preview',
                theme: INPUT_THEME,
                validate: (v) => !v?.trim() ? 'API version is required' : true,
            });
            const envKey = await ensureApiKey(provider, env);
            const config: AzureLanguageModel = {
                provider,
                model,
                resourceName,
                apiVersion,
                token: { env: envKey },
            };
            return config;
        }
        case 'amazon-bedrock': {
            const useDefaultChain = await confirm({
                message: 'Use the default AWS credential chain? (No to provide Access Key ID and Secret explicitly)',
                default: true,
            });

            const config: AmazonBedrockLanguageModel = { provider, model };

            if (!useDefaultChain) {
                if (!env['AWS_ACCESS_KEY_ID']) {
                    env['AWS_ACCESS_KEY_ID'] = await input({
                        message: 'AWS Access Key ID (stored locally in .env as AWS_ACCESS_KEY_ID)',
                        validate: (v) => !v?.trim() ? 'Access Key ID is required' : true,
                    });
                }
                config.accessKeyId = { env: 'AWS_ACCESS_KEY_ID' };

                if (!env['AWS_SECRET_ACCESS_KEY']) {
                    env['AWS_SECRET_ACCESS_KEY'] = await password({
                        message: 'AWS Secret Access Key (stored locally in .env as AWS_SECRET_ACCESS_KEY)',
                        mask: true,
                        validate: (v) => !v?.trim() ? 'Secret Access Key is required' : true,
                    });
                }
                config.accessKeySecret = { env: 'AWS_SECRET_ACCESS_KEY' };
            }

            config.region = await input({
                message: 'AWS region',
                default: 'us-east-1',
                theme: INPUT_THEME,
                validate: (v) => !v?.trim() ? 'Region is required' : true,
            });
            return config;
        }
        case 'google-vertex':
        case 'google-vertex-anthropic': {
            if (!env['GOOGLE_VERTEX_PROJECT']) {
                env['GOOGLE_VERTEX_PROJECT'] = await input({
                    message: 'Google Cloud project ID (stored locally in .env as GOOGLE_VERTEX_PROJECT)',
                    validate: (v) => !v?.trim() ? 'Project ID is required' : true,
                });
            }
            if (!env['GOOGLE_VERTEX_REGION']) {
                env['GOOGLE_VERTEX_REGION'] = await input({
                    message: 'Google Cloud region (stored locally in .env as GOOGLE_VERTEX_REGION)',
                    default: 'us-central1',
                    theme: INPUT_THEME,
                    validate: (v) => !v?.trim() ? 'Region is required' : true,
                });
            }

            const useAppDefault = await confirm({
                message: 'Use Application Default Credentials? (No to provide a service account credentials file path)',
                default: true,
            });

            const config: GoogleVertexLanguageModel | GoogleVertexAnthropicLanguageModel = {
                provider,
                model,
            };

            if (!useAppDefault) {
                if (!env['GOOGLE_APPLICATION_CREDENTIALS']) {
                    env['GOOGLE_APPLICATION_CREDENTIALS'] = await input({
                        message: 'Path to service account credentials JSON (stored locally in .env as GOOGLE_APPLICATION_CREDENTIALS)',
                        validate: (v) => !v?.trim() ? 'Credentials path is required' : true,
                    });
                }
                config.credentials = { env: 'GOOGLE_APPLICATION_CREDENTIALS' };
            }
            return config;
        }
    }
}

export async function collectModels(): Promise<{ models: LanguageModel[]; env: EnvVars }> {
    const models: LanguageModel[] = [];
    const env: EnvVars = {};

    note(
        [
            'AI features include Ask, which lets you ask questions about your codebase',
            'in natural language and get answers grounded in your indexed code.',
            '  https://docs.sourcebot.dev/docs/features/ask/overview',
            '',
            'You\'ll need an API key from at least one supported provider',
            '(Anthropic, OpenAI, Google, etc.) to enable these features.',
        ].join('\n'),
        'AI features',
    );

    const wantsAI = await confirm({
        message: 'Would you like to configure AI features?',
        default: true,
    });

    if (!wantsAI) {
        return { models, env };
    }

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const provider = await select<Provider>({
            message: 'Which AI provider?',
            loop: false,
            choices: [
                { value: 'anthropic', name: 'Anthropic' },
                { value: 'openai', name: 'OpenAI' },
                { value: 'openai-compatible', name: 'OpenAI-compatible', description: 'self-hosted / custom endpoint' },
                { value: 'amazon-bedrock', name: 'Amazon Bedrock' },
                { value: 'google-generative-ai', name: 'Google Gemini' },
                { value: 'google-vertex', name: 'Google Vertex AI', description: 'Gemini via Vertex' },
                { value: 'google-vertex-anthropic', name: 'Google Vertex AI (Anthropic)', description: 'Claude via Vertex' },
                { value: 'azure', name: 'Azure OpenAI' },
                { value: 'deepseek', name: 'DeepSeek' },
                { value: 'mistral', name: 'Mistral' },
                { value: 'openrouter', name: 'OpenRouter' },
                { value: 'xai', name: 'xAI', description: 'Grok' },
            ],
        });

        const modelOptions = provider === 'openai-compatible'
            ? null
            : await getModelOptionsForProvider(provider);
        const model = modelOptions && modelOptions.length > 0
            ? await searchModel({
                message: 'Model name',
                models: modelOptions,
            })
            : await input({
                message: 'Model name',
                validate: (v) => !v?.trim() ? 'Model name is required' : true,
            });

        const config = await collectModelConfig(provider, model, env);

        const displayName = (await input({
            message: 'Display name (optional, press enter to skip)',
        })).trim();
        if (displayName) {
            config.displayName = displayName;
        }
        models.push(config);

        const addAnother = await confirm({
            message: 'Add another model?',
            default: false,
        });

        if (!addAnother) {
            break;
        }
    }

    return { models, env };
}
