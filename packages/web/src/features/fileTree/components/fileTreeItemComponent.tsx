'use client';

import { FileTreeItem } from "../actions";
import { useEffect, useRef } from "react";
import clsx from "clsx";
import scrollIntoView from 'scroll-into-view-if-needed';
import { ChevronDownIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { FileTreeItemIcon } from "./fileTreeItemIcon";

export const FileTreeItemComponent = ({
    node,
    isActive,
    depth,
    isCollapsed = false,
    isCollapseChevronVisible = true,
    onClick,
    parentRef,
}: {
    node: FileTreeItem,
    isActive: boolean,
    depth: number,
    isCollapsed?: boolean,
    isCollapseChevronVisible?: boolean,
    onClick: () => void,
    parentRef: React.RefObject<HTMLDivElement>,
}) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isActive && ref.current) {
            scrollIntoView(ref.current, {
                scrollMode: 'if-needed',
                block: 'center',
                behavior: 'instant',
                // We only want to scroll if the element is hidden vertically
                // in the parent element.
                boundary: () => {
                    if (!parentRef.current || !ref.current) {
                        return false;
                    }

                    const rect = ref.current.getBoundingClientRect();
                    const parentRect = parentRef.current.getBoundingClientRect();

                    const completelyAbove = rect.bottom <= parentRect.top;
                    const completelyBelow = rect.top >= parentRect.bottom;
                    return completelyAbove || completelyBelow;
                }
            });
        }
    }, [isActive, parentRef]);

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
        >
            <div
                className="flex flex-row gap-1 cursor-pointer w-4 h-4 flex-shrink-0"
            >
                {isCollapseChevronVisible && (
                    isCollapsed ? (
                        <ChevronRightIcon className="w-4 h-4 flex-shrink-0" />
                    ) : (
                        <ChevronDownIcon className="w-4 h-4 flex-shrink-0" />
                    )
                )}
            </div>
            <FileTreeItemIcon item={node} />
            <span className="text-sm">{node.name}</span>
        </div>
    )
}
