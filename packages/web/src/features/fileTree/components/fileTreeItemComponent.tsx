'use client';

import { FileTreeItem } from "../actions";
import { useEffect, useRef } from "react";
import clsx from "clsx";
import scrollIntoView from 'scroll-into-view-if-needed';
import { ChevronDownIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { FileTreeItemIcon } from "./fileTreeItemIcon";
import Link from "next/link";

export const FileTreeItemComponent = ({
    node,
    isActive,
    depth,
    isCollapsed = false,
    isCollapseChevronVisible = true,
    href,
    onClick,
    onNavigate,
    parentRef,
}: {
    node: FileTreeItem,
    isActive: boolean,
    depth: number,
    isCollapsed?: boolean,
    isCollapseChevronVisible?: boolean,
    href: string,
    onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void,
    onNavigate?: (e: { preventDefault: () => void }) => void,
    parentRef: React.RefObject<HTMLDivElement | null>,
}) => {
    const ref = useRef<HTMLAnchorElement>(null);

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
        <Link
            ref={ref}
            href={href}
            className={clsx("flex flex-row gap-1 items-center hover:bg-accent hover:text-accent-foreground rounded-sm cursor-pointer p-0.5", {
                'bg-accent': isActive,
            })}
            style={{ paddingLeft: `${depth * 16}px` }}
            tabIndex={0}
            onClick={onClick}
            onNavigate={onNavigate}
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
        </Link>
    )
}
