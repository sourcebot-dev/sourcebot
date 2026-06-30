'use client';

import { cn } from "@/lib/utils";
import { useMemo } from "react";
import { getIconForFile } from "vscode-icons-js";
import { Icon } from "@iconify/react";

interface VscodeFileIconProps {
    fileName: string;
    className?: string;
}

// `vscode-icons-js` returns some filenames whose stem does not match the id used
// by the Iconify `vscode-icons` set (the upstream theme ships versioned
// variants). A mismatched id resolves to nothing in Iconify, so the icon
// silently renders as a zero-size element. Remap the known offenders here.
const ICONIFY_NAME_OVERRIDES: Record<string, string> = {
    // Iconify only ships the `2` variant of the PDF icon.
    "file-type-pdf": "file-type-pdf2",
};

export const VscodeFileIcon = ({ fileName, className }: VscodeFileIconProps) => {
    const iconName = useMemo(() => {
        const icon = getIconForFile(fileName);
        if (icon && typeof icon === 'string') {
            const stem = icon.substring(0, icon.indexOf('.')).replaceAll('_', '-');
            return `vscode-icons:${ICONIFY_NAME_OVERRIDES[stem] ?? stem}`;
        }

        return "vscode-icons:default-file";
    }, [fileName]);

    return <Icon icon={iconName} className={cn("w-4 h-4 flex-shrink-0", className)} />;
}
