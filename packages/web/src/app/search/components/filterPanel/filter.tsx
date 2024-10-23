'use client';

import { useState } from "react";
import { compareEntries, Entry } from "./entry";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FilterProps {
    title: string,
    searchPlaceholder: string,
    entries: Record<string, Entry>,
    onEntryClicked: (key: string) => void,
}

export const Filter = ({
    title,
    searchPlaceholder,
    entries,
    onEntryClicked,
}: FilterProps) => {
    const [searchFilter, setSearchFilter] = useState<string>("");

    return (
        <div className="flex flex-col gap-2 p-1">
            <h2 className="text-sm font-semibold">{title}</h2>
            <Input
                placeholder={searchPlaceholder}
                className="h-8"
                onChange={(event) => setSearchFilter(event.target.value)}
            />

            <ScrollArea
                className="overflow-hidden"
            >
                <div
                    className="flex flex-col gap-0.5 text-sm h-full max-h-80 px-0.5"
                >
                    {Object.entries(entries)
                        .sort(([_, entryA], [__, entryB]) => compareEntries(entryB, entryA))
                        // @todo: replace with fuzzy find
                        .filter(([_, { displayName }]) => displayName.startsWith(searchFilter))
                        .map(([key, entry]) => (
                            <Entry
                                entry={entry}
                                onClicked={() => onEntryClicked(key)}
                            />
                        ))}
                </div>
            </ScrollArea>
        </div>
    )
}