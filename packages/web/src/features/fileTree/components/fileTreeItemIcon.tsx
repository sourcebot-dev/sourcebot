'use client';

import { FileTreeItem } from "../actions";
import { useMemo } from "react";
import { getIconForFile, getIconForFolder } from "vscode-icons-js";
import { Icon } from '@iconify/react';
import { cn } from "@/lib/utils";

interface FileTreeItemIconProps {
    item: FileTreeItem;
    className?: string;
}

export const FileTreeItemIcon = ({ item, className }: FileTreeItemIconProps) => {
    const iconName = useMemo(() => {
        if (item.type === 'tree') {
            const icon = getIconForFolder(item.name);
            if (icon) {
                const iconName = `vscode-icons:${icon.substring(0, icon.indexOf('.')).replaceAll('_', '-')}`;
                return iconName;
            }
        } else if (item.type === 'blob') {
            const icon = getIconForFile(item.name);
            if (icon) {
                const iconName = `vscode-icons:${icon.substring(0, icon.indexOf('.')).replaceAll('_', '-')}`;
                return iconName;
            }
        }

        return "vscode-icons:file-type-unknown";
    }, [item.name, item.type]);

    return <Icon icon={iconName} className={cn("w-4 h-4 flex-shrink-0", className)} />;
}