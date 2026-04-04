'use client';

import { useMemo } from "react";
import { VscodeFolderIcon } from "@/app/components/vscodeFolderIcon";
import { VscodeFileIcon } from "@/app/components/vscodeFileIcon";
import { FileTreeItem } from "@/features/git";

interface FileTreeItemIconProps {
    item: FileTreeItem;
    className?: string;
}

export const FileTreeItemIcon = ({ item, className }: FileTreeItemIconProps) => {
    const ItemIcon = useMemo(() => {
        if (item.type === 'tree') {
            return <VscodeFolderIcon folderName={item.name} className={className} />
        } else {
            return <VscodeFileIcon fileName={item.name} className={className} />
        }
    }, [item.name, item.type, className]);

    return ItemIcon;
}