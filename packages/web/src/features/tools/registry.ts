import { InferUITool, ToolUIPart } from "ai";
import { weatherDefinition } from "./weather";
import { readFileDefinition } from "./readFile";
import { listCommitsDefinition } from "./listCommits";
import { listReposDefinition } from "./listRepos";
import { toVercelAITool } from "./adapters";

export const toolRegistry = {
    [weatherDefinition.name]: weatherDefinition,
    [readFileDefinition.name]: readFileDefinition,
    [listCommitsDefinition.name]: listCommitsDefinition,
    [listReposDefinition.name]: listReposDefinition,
} as const;

// Vercel AI tool wrappers, keyed by tool name — pass directly to streamText.
export const vercelAITools = {
    [weatherDefinition.name]: toVercelAITool(weatherDefinition),
    [readFileDefinition.name]: toVercelAITool(readFileDefinition),
    [listCommitsDefinition.name]: toVercelAITool(listCommitsDefinition),
    [listReposDefinition.name]: toVercelAITool(listReposDefinition),
} as const;

// Derive SBChatMessageToolTypes from the registry so that adding a tool here
// automatically updates the message type. Import this into chat/types.ts.
export type ToolTypes = {
    [K in keyof typeof vercelAITools]: InferUITool<typeof vercelAITools[K]>;
};

export type ReadFileToolUIPart = ToolUIPart<{ readFile: ToolTypes['readFile'] }>;
export type ListCommitsToolUIPart = ToolUIPart<{ listCommits: ToolTypes['listCommits'] }>;
export type ListReposToolUIPart = ToolUIPart<{ listRepos: ToolTypes['listRepos'] }>;
