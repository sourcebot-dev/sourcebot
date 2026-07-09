'use client';

import { VscodeFileIcon } from "@/app/components/vscodeFileIcon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { MentionElement, RenderElementPropsFor } from "@/features/chat/types";
import { useIsMac } from "@/hooks/useIsMac";
import { cn } from "@/lib/utils";
import { Fragment, type ReactNode } from "react";
import { useFocused, useSelected } from "slate-react";

interface MentionChipProps {
    attributes: RenderElementPropsFor<MentionElement>["attributes"];
    children: ReactNode;
    content: ReactNode;
    tooltipContent: ReactNode;
}

export const MentionChip = ({
    attributes,
    children,
    content,
    tooltipContent,
}: MentionChipProps) => {
    const selected = useSelected();
    const focused = useFocused();
    const isMac = useIsMac();

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span
                    {...attributes}
                    contentEditable={false}
                    className={cn(
                        "mb-1 mr-1.5 inline-block rounded bg-muted px-1.5 py-0.5 align-baseline text-xs font-mono",
                        selected && focused ? "ring-2 ring-blue-300" : undefined,
                    )}
                >
                    <span contentEditable={false} className="flex select-none flex-row items-center">
                        {/* @see: https://github.com/ianstormtaylor/slate/issues/3490 */}
                        {isMac ? (
                            <Fragment>
                                {children}
                                {content}
                            </Fragment>
                        ) : (
                            <Fragment>
                                {content}
                                {children}
                            </Fragment>
                        )}
                    </span>
                </span>
            </TooltipTrigger>
            <TooltipContent>
                {tooltipContent}
            </TooltipContent>
        </Tooltip>
    );
};

export const FileMentionComponent = ({
    attributes,
    children,
    element: { data },
}: RenderElementPropsFor<MentionElement>) => {
    if (data.type !== "file") {
        return <span {...attributes}>{children}</span>;
    }

    return (
        <MentionChip
            attributes={attributes}
            content={
                <Fragment>
                    <VscodeFileIcon fileName={data.name} className="w-3 h-3 mr-1" />
                    {data.name}
                </Fragment>
            }
            tooltipContent={
                <span className="text-xs font-mono">
                    <span className="font-medium">{data.repo.split("/").pop()}</span>/{data.path}
                </span>
            }
        >
            {children}
        </MentionChip>
    );
};
