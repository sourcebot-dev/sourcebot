'use client';

import { cn } from "@/lib/utils";
import { useMemo } from "react";
import { getIconForFile } from "vscode-icons-js";
import { Icon } from "@iconify/react";

interface VscodeFileIconProps {
    fileName: string;
    className?: string;
}

export const VscodeFileIcon = ({ fileName, className }: VscodeFileIconProps) => {
    const iconName = useMemo(() => {
        const icon = getIconForFile(fileName);
        if (icon) {
            const iconName = `vscode-icons:${icon.substring(0, icon.indexOf('.')).replaceAll('_', '-')}`;
            return iconName;
        }

        return "vscode-icons:file-type-unknown";
    }, [fileName]);

    return <Icon icon={iconName} className={cn("w-4 h-4 flex-shrink-0", className)} />;
}
