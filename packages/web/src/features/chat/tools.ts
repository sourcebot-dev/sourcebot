import {
    toVercelAITool,
    readFileDefinition,
    listCommitsDefinition,
    listReposDefinition,
    grepDefinition,
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
    [grepDefinition.name]: toVercelAITool(grepDefinition),
    [findSymbolReferencesDefinition.name]: toVercelAITool(findSymbolReferencesDefinition),
    [findSymbolDefinitionsDefinition.name]: toVercelAITool(findSymbolDefinitionsDefinition),
    [listTreeDefinition.name]: toVercelAITool(listTreeDefinition),
} as const;

export type ReadFileToolUIPart = ToolUIPart<{ read_file: SBChatMessageToolTypes['read_file'] }>;
export type ListCommitsToolUIPart = ToolUIPart<{ list_commits: SBChatMessageToolTypes['list_commits'] }>;
export type ListReposToolUIPart = ToolUIPart<{ list_repos: SBChatMessageToolTypes['list_repos'] }>;
export type GrepToolUIPart = ToolUIPart<{ grep: SBChatMessageToolTypes['grep'] }>;
export type FindSymbolReferencesToolUIPart = ToolUIPart<{ find_symbol_references: SBChatMessageToolTypes['find_symbol_references'] }>;
export type FindSymbolDefinitionsToolUIPart = ToolUIPart<{ find_symbol_definitions: SBChatMessageToolTypes['find_symbol_definitions'] }>;
export type ListTreeToolUIPart = ToolUIPart<{ list_tree: SBChatMessageToolTypes['list_tree'] }>;
