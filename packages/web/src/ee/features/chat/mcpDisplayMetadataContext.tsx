'use client';

import { createContext, useContext } from 'react';

// Maps sanitized server name (e.g. "linear") to a favicon URL.
export type McpServerIconMap = Record<string, string>;

export const McpServerIconContext = createContext<McpServerIconMap>({});

export const useMcpServerIconMap = () => useContext(McpServerIconContext);

// Maps provider-safe model tool names back to raw MCP tool names for display.
export type McpToolNameMap = Record<string, string>;

export const McpToolNameContext = createContext<McpToolNameMap>({});

export const useMcpToolNameMap = () => useContext(McpToolNameContext);
