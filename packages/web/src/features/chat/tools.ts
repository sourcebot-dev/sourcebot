import {
    toVercelAITool,
    readFileDefinition,
    listCommitsDefinition,
    listReposDefinition,
    searchCodeDefinition,
    findSymbolReferencesDefinition,
    findSymbolDefinitionsDefinition,
    listTreeDefinition,
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
    [listTreeDefinition.name]: toVercelAITool(listTreeDefinition),
} as const;

export type ReadFileToolUIPart = ToolUIPart<{ read_file: SBChatMessageToolTypes['read_file'] }>;
export type ListCommitsToolUIPart = ToolUIPart<{ list_commits: SBChatMessageToolTypes['list_commits'] }>;
export type ListReposToolUIPart = ToolUIPart<{ list_repos: SBChatMessageToolTypes['list_repos'] }>;
export type SearchCodeToolUIPart = ToolUIPart<{ search_code: SBChatMessageToolTypes['search_code'] }>;
export type FindSymbolReferencesToolUIPart = ToolUIPart<{ find_symbol_references: SBChatMessageToolTypes['find_symbol_references'] }>;
export type FindSymbolDefinitionsToolUIPart = ToolUIPart<{ find_symbol_definitions: SBChatMessageToolTypes['find_symbol_definitions'] }>;
export type ListTreeToolUIPart = ToolUIPart<{ list_tree: SBChatMessageToolTypes['list_tree'] }>;
