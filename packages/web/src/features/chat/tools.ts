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
import { ToolContext } from "@/features/tools/types";
import { ToolUIPart } from "ai";
import { SBChatMessageToolTypes } from "./types";

export const createTools = (context: ToolContext) => ({
    [readFileDefinition.name]: toVercelAITool(readFileDefinition, context),
    [listCommitsDefinition.name]: toVercelAITool(listCommitsDefinition, context),
    [listReposDefinition.name]: toVercelAITool(listReposDefinition, context),
    [grepDefinition.name]: toVercelAITool(grepDefinition, context),
    [findSymbolReferencesDefinition.name]: toVercelAITool(findSymbolReferencesDefinition, context),
    [findSymbolDefinitionsDefinition.name]: toVercelAITool(findSymbolDefinitionsDefinition, context),
    [listTreeDefinition.name]: toVercelAITool(listTreeDefinition, context),
});

export type ReadFileToolUIPart = ToolUIPart<{ read_file: SBChatMessageToolTypes['read_file'] }>;
export type ListCommitsToolUIPart = ToolUIPart<{ list_commits: SBChatMessageToolTypes['list_commits'] }>;
export type ListReposToolUIPart = ToolUIPart<{ list_repos: SBChatMessageToolTypes['list_repos'] }>;
export type GrepToolUIPart = ToolUIPart<{ grep: SBChatMessageToolTypes['grep'] }>;
export type FindSymbolReferencesToolUIPart = ToolUIPart<{ find_symbol_references: SBChatMessageToolTypes['find_symbol_references'] }>;
export type FindSymbolDefinitionsToolUIPart = ToolUIPart<{ find_symbol_definitions: SBChatMessageToolTypes['find_symbol_definitions'] }>;
export type ListTreeToolUIPart = ToolUIPart<{ list_tree: SBChatMessageToolTypes['list_tree'] }>;
