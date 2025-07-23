'use client';

import { Button } from '@/components/ui/button';
import { AlertCircle, X } from "lucide-react";

interface ErrorBannerProps {
    error: Error;
    isVisible: boolean;
    onClose: () => void;
}

export const ErrorBanner = ({ error, isVisible, onClose }: ErrorBannerProps) => {
    if (!isVisible) {
        return null;
    }

    return (
        <div className="bg-red-50 border-b border-red-200 dark:bg-red-950/20 dark:border-red-800">
            <div className="max-w-5xl mx-auto px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                        <span className="text-sm font-medium text-red-800 dark:text-red-200">
                            Error occurred
                        </span>
                        <span className="text-sm text-red-600 dark:text-red-400">
                            {error.message || "An unexpected error occurred. Please try again."}
                        </span>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        className="h-6 w-6 p-0 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
} 