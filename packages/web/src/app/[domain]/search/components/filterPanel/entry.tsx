'use client';

import { QuestionMarkCircledIcon } from "@radix-ui/react-icons";
import clsx from "clsx";

export type Entry = {
    key: string;
    displayName: string;
    count: number;
    isSelected: boolean;
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
    },
    onClicked,
}: EntryProps) => {
    let countText = count.toString();
    if (count > 999) {
        countText = "999+";
    }
    return (
        <div
            className={clsx(
                "flex flex-row items-center justify-between py-0.5 px-1 cursor-pointer rounded-md gap-2 select-none",
                {
                    "hover:bg-gray-200 dark:hover:bg-gray-700": !isSelected,
                    "bg-blue-200 dark:bg-blue-400": isSelected,
                }
            )}
            onClick={() => onClicked()}
        >
            <div className="flex flex-row items-center gap-1 overflow-hidden">
                {Icon ? Icon : (
                    <QuestionMarkCircledIcon className="w-4 h-4 flex-shrink-0" />
                )}
                <p className="overflow-hidden text-ellipsis whitespace-nowrap">{displayName}</p>
            </div>
            <div className="px-2 py-0.5 bg-accent text-sm rounded-md">
                {countText}
            </div>
        </div>
    );
}

export const compareEntries = (a: Entry, b: Entry) => {
    if (a.isSelected !== b.isSelected) {
        return a.isSelected ? 1 : -1;
    }

    return a.count - b.count;
}
