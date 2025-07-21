// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!

export type LanguageModel =
  | OpenAILanguageModel
  | AmazonBedrockLanguageModel
  | AnthropicLanguageModel
  | GoogleGenerativeAILanguageModel;

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
