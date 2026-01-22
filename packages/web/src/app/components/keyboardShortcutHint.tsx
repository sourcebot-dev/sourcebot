'use client';

import { cn, IS_MAC } from '@/lib/utils'
import React, { useMemo } from 'react'

interface KeyboardShortcutHintProps {
  shortcut: string
  label?: string
  className?: string
}

/**
 * Converts Mac-specific keyboard shortcuts to platform-appropriate shortcuts.
 * On Mac: displays the shortcut as-is (e.g., "⌘")
 * On Windows/Linux: replaces "⌘" with "Ctrl"
 */
function getPlatformShortcut(shortcut: string): string {
    if (IS_MAC) {
        return shortcut;
    }
    // Replace Mac Command key symbol with Ctrl for non-Mac platforms
    return shortcut.replace(/⌘/g, 'Ctrl');
}

export function KeyboardShortcutHint({ shortcut, label, className }: KeyboardShortcutHintProps) {
    const platformShortcut = useMemo(() => getPlatformShortcut(shortcut), [shortcut]);

    return (
        <div className={cn("inline-flex items-center", className)} aria-label={label || `Keyboard shortcut: ${platformShortcut}`}>
            <kbd
                className="px-2 py-1 font-semibold font-sans border rounded-md"
                style={{
                    fontSize: "0.65rem",
                    lineHeight: "0.875rem",
                }}
            >
                {platformShortcut}
            </kbd>
        </div>
    )
}
