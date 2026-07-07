'use client';

import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { QuestionMarkCircledIcon } from "@radix-ui/react-icons";
import clsx from "clsx";

export type Entry = {
    key: string;
    displayName: string;
    count: number;
    isSelected: boolean;
    isHidden: boolean;
    isDisabled: boolean;
    Icon?: React.ReactNode;
}

interface EntryProps {
    entry: Entry,
    onClicked: () => void
}

export const Entry = ({
    entry: {
        isSelected,
        displayName,
        count,
        Icon,
        isDisabled,
    },
    onClicked,
}: EntryProps) => {
    let countText = count.toString();
    if (count > 999) {
        countText = "999+";
    }
    return (
        <button
            type="button"
            aria-pressed={isSelected}
            disabled={isDisabled && !isSelected}
            className={clsx(
                "flex w-full flex-row items-center justify-between py-0.5 px-1 cursor-pointer rounded-md gap-2 select-none text-left",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                {
                    "hover:bg-gray-200 dark:hover:bg-gray-700": !isSelected,
                    "bg-blue-200 dark:bg-blue-400": isSelected,
                    "opacity-50": isDisabled,
                }
            )}
            onClick={() => onClicked()}
        >
            <span className="flex flex-row items-center gap-1 overflow-hidden min-w-0">
                {Icon ? Icon : (
                    <QuestionMarkCircledIcon className="w-4 h-4 flex-shrink-0" />
                )}
                <span className="overflow-hidden flex-1 min-w-0">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="block overflow-hidden text-ellipsis whitespace-nowrap truncate-start">{displayName}</span>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-sm">
                            <p className="font-mono text-sm break-all whitespace-pre-wrap">{displayName}</p>
                        </TooltipContent>
                    </Tooltip>
                </span>
            </span>
            <span className="px-2 py-0.5 bg-accent text-sm rounded-md flex-shrink-0">
                {countText}
            </span>
        </button>
    );
}

export const compareEntries = (a: Entry, b: Entry) => {
    if (a.isSelected !== b.isSelected) {
        return a.isSelected ? 1 : -1;
    }

    return a.count - b.count;
}
