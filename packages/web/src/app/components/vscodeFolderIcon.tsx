'use client';

import { cn } from "@/lib/utils";
import { useMemo } from "react";
import { getIconForFolder } from "vscode-icons-js";
import { Icon } from "@iconify/react";

interface VscodeFolderIconProps {
    folderName: string;
    className?: string;
}

export const VscodeFolderIcon = ({ folderName, className }: VscodeFolderIconProps) => {
    const iconName = useMemo(() => {
        const icon = getIconForFolder(folderName);
        if (icon) {
            const iconName = `vscode-icons:${icon.substring(0, icon.indexOf('.')).replaceAll('_', '-')}`;
                return iconName;
        }

        return "vscode-icons:folder";
    }, [folderName]);

    return <Icon icon={iconName} className={cn("w-4 h-4 flex-shrink-0", className)} />;
}
