import React from 'react'

interface KeyboardShortcutHintProps {
  shortcut: string
  label?: string
}

export function KeyboardShortcutHint({ shortcut, label }: KeyboardShortcutHintProps) {
  return (
    <div className="inline-flex items-center" aria-label={label || `Keyboard shortcut: ${shortcut}`}>
      <kbd className="px-2 py-1 text-xs font-semibold border rounded-md">
        {shortcut}
      </kbd>
    </div>
  )
}
