import {
    toVercelAITool, 
    readFileDefinition,
    listCommitsDefinition,
    listReposDefinition,
    searchCodeDefinition,
    findSymbolReferencesDefinition,
    findSymbolDefinitionsDefinition,
} from "@/features/tools";
import { ToolUIPart } from "ai";
import { SBChatMessageToolTypes } from "./types";

export const tools = {
    [readFileDefinition.name]: toVercelAITool(readFileDefinition),
    [listCommitsDefinition.name]: toVercelAITool(listCommitsDefinition),
    [listReposDefinition.name]: toVercelAITool(listReposDefinition),
    [searchCodeDefinition.name]: toVercelAITool(searchCodeDefinition),
    [findSymbolReferencesDefinition.name]: toVercelAITool(findSymbolReferencesDefinition),
    [findSymbolDefinitionsDefinition.name]: toVercelAITool(findSymbolDefinitionsDefinition),
} as const;

export type ReadFileToolUIPart = ToolUIPart<{ readFile: SBChatMessageToolTypes['readFile'] }>;
export type ListCommitsToolUIPart = ToolUIPart<{ listCommits: SBChatMessageToolTypes['listCommits'] }>;
export type ListReposToolUIPart = ToolUIPart<{ listRepos: SBChatMessageToolTypes['listRepos'] }>;
export type SearchCodeToolUIPart = ToolUIPart<{ searchCode: SBChatMessageToolTypes['searchCode'] }>;
export type FindSymbolReferencesToolUIPart = ToolUIPart<{ findSymbolReferences: SBChatMessageToolTypes['findSymbolReferences'] }>;
export type FindSymbolDefinitionsToolUIPart = ToolUIPart<{ findSymbolDefinitions: SBChatMessageToolTypes['findSymbolDefinitions'] }>;
