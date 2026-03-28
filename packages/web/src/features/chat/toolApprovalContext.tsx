'use client';

import { createContext, useContext } from 'react';
import type { ChatAddToolApproveResponseFunction } from 'ai';

const ToolApprovalContext = createContext<ChatAddToolApproveResponseFunction | null>(null);

export const ToolApprovalProvider = ToolApprovalContext.Provider;
export const useToolApproval = () => useContext(ToolApprovalContext);