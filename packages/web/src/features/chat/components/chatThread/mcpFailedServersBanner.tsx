'use client';

import { Button } from '@/components/ui/button';
import { AlertTriangle, X } from 'lucide-react';

interface McpFailedServersBannerProps {
    serverNames: string[];
    isVisible: boolean;
    onClose: () => void;
}

export const McpFailedServersBanner = ({ serverNames, isVisible, onClose }: McpFailedServersBannerProps) => {
    if (!isVisible || serverNames.length === 0) {
        return null;
    }

    const message = serverNames.length === 1
        ? `MCP server "${serverNames[0]}" failed to load tools`
        : `${serverNames.length} MCP servers failed to load tools`;

    return (
        <div className="bg-yellow-50 border-b border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800">
            <div className="max-w-5xl mx-auto px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                        <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                            {message}
                        </span>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        className="h-6 w-6 p-0 text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-200"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
};