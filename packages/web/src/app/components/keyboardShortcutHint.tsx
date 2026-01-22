'use client';

import { cn, IS_MAC } from '@/lib/utils'
import React, { useMemo } from 'react'

interface KeyboardShortcutHintProps {
    shortcut: string
    label?: string
    className?: string
}

/**
 * Maps for converting react-hotkeys syntax to platform-specific symbols.
 * Accepts shortcuts like "mod+b", "alt+shift+f12", etc.
 */
const MAC_KEY_MAP: Record<string, string> = {
    mod: '⌘',
    meta: '⌘',
    ctrl: '⌃',
    control: '⌃',
    alt: '⌥',
    option: '⌥',
    shift: '⇧',
    enter: '↵',
    return: '↵',
    backspace: '⌫',
    delete: '⌦',
    escape: '⎋',
    esc: '⎋',
    tab: '⇥',
    space: '␣',
    up: '↑',
    down: '↓',
    left: '←',
    right: '→',
};

const WINDOWS_KEY_MAP: Record<string, string> = {
    mod: 'Ctrl',
    meta: 'Win',
    ctrl: 'Ctrl',
    control: 'Ctrl',
    alt: 'Alt',
    option: 'Alt',
    shift: 'Shift',
    enter: 'Enter',
    return: 'Enter',
    backspace: 'Backspace',
    delete: 'Delete',
    escape: 'Esc',
    esc: 'Esc',
    tab: 'Tab',
    space: 'Space',
    up: '↑',
    down: '↓',
    left: '←',
    right: '→',
};

/**
 * Converts a single key from react-hotkeys syntax to platform-appropriate display.
 */
function mapKey(key: string, keyMap: Record<string, string>): string {
    const lowerKey = key.toLowerCase();
    if (keyMap[lowerKey]) {
        return keyMap[lowerKey];
    }
    // For single letters, keep uppercase
    if (key.length === 1) {
        return key.toUpperCase();
    }
    // For function keys (F1-F12), keep as-is but uppercase
    if (/^f\d{1,2}$/i.test(key)) {
        return key.toUpperCase();
    }
    // Default: return the key with first letter capitalized
    return key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
}

/**
 * Converts react-hotkeys syntax to platform-appropriate keyboard shortcut display.
 * Accepts formats like: "mod+b", "alt+shift+f12", "ctrl enter"
 */
function getPlatformShortcut(shortcut: string): string {
    // Split by + or space to handle both "mod+b" and "⌘ B" formats
    const keys = shortcut.split(/[+\s]+/).filter(Boolean);
    const keyMap = IS_MAC ? MAC_KEY_MAP : WINDOWS_KEY_MAP;
    
    return keys.map(key => mapKey(key, keyMap)).join(' ');
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
