import { cn } from '@/lib/utils'
import React from 'react'

interface KeyboardShortcutHintProps {
  shortcut: string
  label?: string
  className?: string
}

export function KeyboardShortcutHint({ shortcut, label, className }: KeyboardShortcutHintProps) {
  return (
    <div className={cn("inline-flex items-center", className)} aria-label={label || `Keyboard shortcut: ${shortcut}`}>
      <kbd
        className="px-2 py-1 font-semibold font-sans border rounded-md"
        style={{
          fontSize: "0.65rem",
          lineHeight: "0.875rem",
        }}
      >
        {shortcut}
      </kbd>
    </div>
  )
}
