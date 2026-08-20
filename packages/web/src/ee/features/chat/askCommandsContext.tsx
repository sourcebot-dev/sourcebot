'use client';

import { createContext, useContext } from 'react';
import type { AskCommandDefinition } from '@/features/chat/commands/types';

// The chat page's server-rendered slash-command catalog, made available to
// nested chat components (e.g. the tool approval banner resolves a skill's
// display name from its slug + scope).
export const AskCommandsContext = createContext<AskCommandDefinition[]>([]);

export const useAskCommands = () => useContext(AskCommandsContext);
