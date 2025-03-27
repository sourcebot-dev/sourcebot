'use client';

import { useSyntaxGuide } from "./syntaxGuideProvider";
import { KeyboardShortcutHint } from "../../components/keyboardShortcutHint";

export const SyntaxReferenceGuideHint = () => {
    const { isOpen, onOpenChanged } = useSyntaxGuide();

    return (
        <div
            className="text-sm cursor-pointer"
            onClick={() => onOpenChanged(!isOpen)}
        >
            <span className="dark:text-gray-300">Reference guide: </span><KeyboardShortcutHint shortcut="⌘" /> <KeyboardShortcutHint shortcut="/" />
        </div>
    )
}