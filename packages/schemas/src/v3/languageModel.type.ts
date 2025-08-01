// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!

export type LanguageModel =
  | AmazonBedrockLanguageModel
  | AnthropicLanguageModel
  | AzureLanguageModel
  | DeepSeekLanguageModel
  | GoogleGenerativeAILanguageModel
  | GoogleVertexAnthropicLanguageModel
  | GoogleVertexLanguageModel
  | MistralLanguageModel
  | OpenAILanguageModel
  | OpenAICompatibleLanguageModel
  | OpenRouterLanguageModel
  | XaiLanguageModel;

export interface AmazonBedrockLanguageModel {
  /**
   * Amazon Bedrock Configuration
   */
  provider: "amazon-bedrock";
  /**
   * The name of the language model.
   */
  model: string;
  /**
   * Optional display name.
   */
  displayName?: string;
  /**
   * Optional access key ID to use with the model. Defaults to the `AWS_ACCESS_KEY_ID` environment variable.
   */
  accessKeyId?:
    | {
        /**
         * The name of the secret that contains the token.
         */
        secret: string;
      }
    | {
        /**
         * The name of the environment variable that contains the token. Only supported in declarative connection configs.
         */
        env: string;
      };
  /**
   * Optional secret access key to use with the model. Defaults to the `AWS_SECRET_ACCESS_KEY` environment variable.
   */
  accessKeySecret?:
    | {
        /**
         * The name of the secret that contains the token.
         */
        secret: string;
      }
    | {
        /**
         * The name of the environment variable that contains the token. Only supported in declarative connection configs.
         */
        env: string;
      };
  /**
   * The AWS region. Defaults to the `AWS_REGION` environment variable.
   */
  region?: string;
  /**
   * Optional base URL.
   */
  baseUrl?: string;
}
export interface AnthropicLanguageModel {
  /**
   * Anthropic Configuration
   */
  provider: "anthropic";
  /**
   * The name of the language model.
   */
  model: string;
  /**
   * Optional display name.
   */
  displayName?: string;
  /**
   * Optional API key to use with the model. Defaults to the `ANTHROPIC_API_KEY` environment variable.
   */
  token?:
    | {
        /**
         * The name of the secret that contains the token.
         */
        secret: string;
      }
    | {
        /**
         * The name of the environment variable that contains the token. Only supported in declarative connection configs.
         */
        env: string;
      };
  /**
   * Optional base URL.
   */
  baseUrl?: string;
}
export interface AzureLanguageModel {
  /**
   * Azure Configuration
   */
  provider: "azure";
  /**
   * The deployment name of the Azure model.
   */
  model: string;
  /**
   * Optional display name.
   */
  displayName?: string;
  /**
   * Azure resource name. Defaults to the `AZURE_RESOURCE_NAME` environment variable.
   */
  resourceName?: string;
  /**
   * Optional API key to use with the model. Defaults to the `AZURE_API_KEY` environment variable.
   */
  token?:
    | {
        /**
         * The name of the secret that contains the token.
         */
        secret: string;
      }
    | {
        /**
         * The name of the environment variable that contains the token. Only supported in declarative connection configs.
         */
        env: string;
      };
  /**
   * Sets a custom api version. Defaults to `preview`.
   */
  apiVersion?: string;
  /**
   * Use a different URL prefix for API calls. Either this or `resourceName` can be used.
   */
  baseUrl?: string;
}
export interface DeepSeekLanguageModel {
  /**
   * DeepSeek Configuration
   */
  provider: "deepseek";
  /**
   * The name of the language model.
   */
  model: string;
  /**
   * Optional display name.
   */
  displayName?: string;
  /**
   * Optional API key to use with the model. Defaults to the `DEEPSEEK_API_KEY` environment variable.
   */
  token?:
    | {
        /**
         * The name of the secret that contains the token.
         */
        secret: string;
      }
    | {
        /**
         * The name of the environment variable that contains the token. Only supported in declarative connection configs.
         */
        env: string;
      };
  /**
   * Optional base URL.
   */
  baseUrl?: string;
}
export interface GoogleGenerativeAILanguageModel {
  /**
   * Google Generative AI Configuration
   */
  provider: "google-generative-ai";
  /**
   * The name of the language model.
   */
  model: string;
  /**
   * Optional display name.
   */
  displayName?: string;
  /**
   * Optional API key to use with the model. Defaults to the `GOOGLE_GENERATIVE_AI_API_KEY` environment variable.
   */
  token?:
    | {
        /**
         * The name of the secret that contains the token.
         */
        secret: string;
      }
    | {
        /**
         * The name of the environment variable that contains the token. Only supported in declarative connection configs.
         */
        env: string;
      };
  /**
   * Optional base URL.
   */
  baseUrl?: string;
}
export interface GoogleVertexAnthropicLanguageModel {
  /**
   * Google Vertex AI Anthropic Configuration
   */
  provider: "google-vertex-anthropic";
  /**
   * The name of the Anthropic language model running on Google Vertex.
   */
  model: string;
  /**
   * Optional display name.
   */
  displayName?: string;
  /**
   * The Google Cloud project ID. Defaults to the `GOOGLE_VERTEX_PROJECT` environment variable.
   */
  project?: string;
  /**
   * The Google Cloud region. Defaults to the `GOOGLE_VERTEX_REGION` environment variable.
   */
  region?: string;
  /**
   * Optional file path to service account credentials JSON. Defaults to the `GOOGLE_APPLICATION_CREDENTIALS` environment variable or application default credentials.
   */
  credentials?:
    | {
        /**
         * The name of the secret that contains the token.
         */
        secret: string;
      }
    | {
        /**
         * The name of the environment variable that contains the token. Only supported in declarative connection configs.
         */
        env: string;
      };
  /**
   * Optional base URL.
   */
  baseUrl?: string;
}
export interface GoogleVertexLanguageModel {
  /**
   * Google Vertex AI Configuration
   */
  provider: "google-vertex";
  /**
   * The name of the language model.
   */
  model: string;
  /**
   * Optional display name.
   */
  displayName?: string;
  /**
   * The Google Cloud project ID. Defaults to the `GOOGLE_VERTEX_PROJECT` environment variable.
   */
  project?: string;
  /**
   * The Google Cloud region. Defaults to the `GOOGLE_VERTEX_REGION` environment variable.
   */
  region?: string;
  /**
   * Optional file path to service account credentials JSON. Defaults to the `GOOGLE_APPLICATION_CREDENTIALS` environment variable or application default credentials.
   */
  credentials?:
    | {
        /**
         * The name of the secret that contains the token.
         */
        secret: string;
      }
    | {
        /**
         * The name of the environment variable that contains the token. Only supported in declarative connection configs.
         */
        env: string;
      };
  /**
   * Optional base URL.
   */
  baseUrl?: string;
}
export interface MistralLanguageModel {
  /**
   * Mistral AI Configuration
   */
  provider: "mistral";
  /**
   * The name of the language model.
   */
  model: string;
  /**
   * Optional display name.
   */
  displayName?: string;
  /**
   * Optional API key to use with the model. Defaults to the `MISTRAL_API_KEY` environment variable.
   */
  token?:
    | {
        /**
         * The name of the secret that contains the token.
         */
        secret: string;
      }
    | {
        /**
         * The name of the environment variable that contains the token. Only supported in declarative connection configs.
         */
        env: string;
      };
  /**
   * Optional base URL.
   */
  baseUrl?: string;
}
export interface OpenAILanguageModel {
  /**
   * OpenAI Configuration
   */
  provider: "openai";
  /**
   * The name of the language model.
   */
  model: string;
  /**
   * Optional display name.
   */
  displayName?: string;
  /**
   * Optional API key to use with the model. Defaults to the `OPENAI_API_KEY` environment variable.
   */
  token?:
    | {
        /**
         * The name of the secret that contains the token.
         */
        secret: string;
      }
    | {
        /**
         * The name of the environment variable that contains the token. Only supported in declarative connection configs.
         */
        env: string;
      };
  /**
   * Optional base URL.
   */
  baseUrl?: string;
}
export interface OpenAICompatibleLanguageModel {
  /**
   * OpenAI Compatible Configuration
   */
  provider: "openai-compatible";
  /**
   * The name of the language model.
   */
  model: string;
  /**
   * Optional display name.
   */
  displayName?: string;
  /**
   * Optional base URL.
   */
  baseUrl: string;
}
export interface OpenRouterLanguageModel {
  /**
   * OpenRouter Configuration
   */
  provider: "openrouter";
  /**
   * The name of the language model.
   */
  model: string;
  /**
   * Optional display name.
   */
  displayName?: string;
  /**
   * Optional API key to use with the model. Defaults to the `OPENROUTER_API_KEY` environment variable.
   */
  token?:
    | {
        /**
         * The name of the secret that contains the token.
         */
        secret: string;
      }
    | {
        /**
         * The name of the environment variable that contains the token. Only supported in declarative connection configs.
         */
        env: string;
      };
  /**
   * Optional base URL.
   */
  baseUrl?: string;
}
export interface XaiLanguageModel {
  /**
   * xAI Configuration
   */
  provider: "xai";
  /**
   * The name of the language model.
   */
  model: string;
  /**
   * Optional display name.
   */
  displayName?: string;
  /**
   * Optional API key to use with the model. Defaults to the `XAI_API_KEY` environment variable.
   */
  token?:
    | {
        /**
         * The name of the secret that contains the token.
         */
        secret: string;
      }
    | {
        /**
         * The name of the environment variable that contains the token. Only supported in declarative connection configs.
         */
        env: string;
      };
  /**
   * Optional base URL.
   */
  baseUrl?: string;
}
