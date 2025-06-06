'use client';

import { FileTreeItem } from "../actions";
import { useMemo, useEffect, useRef } from "react";
import { getIconForFile, getIconForFolder } from "vscode-icons-js";
import { Icon } from '@iconify/react';
import clsx from "clsx";
import scrollIntoView from 'scroll-into-view-if-needed';
import { ChevronDownIcon, ChevronRightIcon } from "@radix-ui/react-icons";

export const FileTreeItemComponent = ({
    node,
    isActive,
    depth,
    isCollapsed = false,
    isCollapseChevronVisible = true,
    onClick,
    onMouseEnter,
}: {
    node: FileTreeItem,
    isActive: boolean,
    depth: number,
    isCollapsed?: boolean,
    isCollapseChevronVisible?: boolean,
    onClick: () => void,
    onMouseEnter: () => void,
}) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isActive && ref.current) {
            scrollIntoView(ref.current, {
                scrollMode: 'if-needed',
                block: 'center',
                behavior: 'instant',
            });
        }
    }, [isActive]);

    const iconName = useMemo(() => {
        if (node.type === 'tree') {
            const icon = getIconForFolder(node.name);
            if (icon) {
                const iconName = `vscode-icons:${icon.substring(0, icon.indexOf('.')).replaceAll('_', '-')}`;
                return iconName;
            }
        } else if (node.type === 'blob') {
            const icon = getIconForFile(node.name);
            if (icon) {
                const iconName = `vscode-icons:${icon.substring(0, icon.indexOf('.')).replaceAll('_', '-')}`;
                return iconName;
            }
        }

        return "vscode-icons:file-type-unknown";
    }, [node.name, node.type]);

    return (
        <div
            ref={ref}
            className={clsx("flex flex-row gap-1 items-center hover:bg-accent hover:text-accent-foreground rounded-sm cursor-pointer p-0.5", {
                'bg-accent': isActive,
            })}
            style={{ paddingLeft: `${depth * 16}px` }}
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    onClick();
                }
            }}
            onClick={onClick}
            onMouseEnter={onMouseEnter}
        >
            {isCollapseChevronVisible && (
                <div
                    className="flex flex-row gap-1 cursor-pointer w-4 h-4 flex-shrink-0"
                >
                    {isCollapsed ? (
                        <ChevronRightIcon className="w-4 h-4 flex-shrink-0" />
                    ) : (
                        <ChevronDownIcon className="w-4 h-4 flex-shrink-0" />
                    )}
                </div>
            )}
            <Icon icon={iconName} className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{node.name}</span>
        </div>
    )
}
