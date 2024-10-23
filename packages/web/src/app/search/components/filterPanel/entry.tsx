'use client';

import { FileIcon } from "@radix-ui/react-icons";
import clsx from "clsx";
import Image from "next/image";

export type Entry = {
    displayName: string;
    count: number;
    isSelected: boolean;
    icon?: string;
    iconAltText?: string;
    iconClassName?: string;
}

interface EntryProps {
    entry: Entry,
    onClicked: () => void
}

export const Entry = ({
    entry: {
        isSelected,
        icon,
        iconAltText,
        iconClassName,
        displayName,
        count,
    },
    onClicked,
}: EntryProps) => {

    return (
        <div
            className={clsx("flex flex-row items-center justify-between py-0.5 px-2 cursor-pointer rounded-md gap-2 select-none",
                {
                    "hover:bg-gray-200 dark:hover:bg-gray-700": !isSelected,
                    "bg-blue-200 dark:bg-blue-400": isSelected,
                }
            )}
            onClick={() => onClicked()}
        >
            <div className="flex flex-row items-center gap-1">
                {icon ? (
                    <Image
                        src={icon}
                        alt={iconAltText ?? ''}
                        className={`w-4 h-4 flex-shrink-0 ${iconClassName}`}
                    />
                ) : (
                    <FileIcon className="w-4 h-4 flex-shrink-0" />
                )}
                <p className="text-wrap">{displayName}</p>
            </div>
            <p>{count}</p>
        </div>
    );
}

export const compareEntries = (a: Entry, b: Entry) => {
    if (a.isSelected !== b.isSelected) {
        return a.isSelected ? 1 : -1;
    }

    return a.count - b.count;
}